import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresDistributionReadRuntime } from "../src/distribution-repository.js";

test("Distribution Allocations repository exposes scoped readiness, batch queue, royalty bank, and run totals", async () => {
  const pglite = new PGlite();
  try {
    await createAllocationTables(pglite);
    await seedAllocationRows(pglite);
    const repository = createPostgresDistributionReadRuntime(asPoolQuery(pglite));

    const first = await repository.readAllocationWorkbench({
      workspaceId: "eeee-mu",
      search: null,
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      batchCursor: null,
      bankCursor: null,
      limit: 1
    });

    assert.deepEqual(first.summary, {
      readyRowCount: 2,
      openSuspenseCount: 3,
      missingContractCount: 2,
      matchedUnallocatedCount: 1,
      allocationLinkIssueCount: 1
    });
    assert.deepEqual(first.suspenseReasons, [
      { reason: "missing_contract", openRowCount: 2 },
      { reason: "mapping_low_confidence", openRowCount: 1 }
    ]);
    assert.deepEqual(first.batches.items.map((row) => row.fileName), ["batch-one.csv"]);
    assert.ok(first.batches.nextCursor !== null);
    assert.equal(first.batches.items[0]?.pendingRowCount, 1);
    assert.equal(first.batches.items[0]?.allocatedRowCount, 1);
    assert.deepEqual(first.batches.items[0]?.currencyTotals, [{
      currency: "EUR",
      openAmountMicro: "100.0000000000",
      allocatedAmountMicro: "250.0000000000"
    }]);
    assert.equal(first.unallocatedBank.items[0]?.trackTitle, "Night & Day");
    assert.equal(first.unallocatedBank.items[0]?.rowCount, 2);
    assert.equal(first.unallocatedBank.items[0]?.batchCount, 2);
    assert.deepEqual(first.unallocatedBank.items[0]?.currencyTotals, [{ currency: "EUR", amountMicro: "300.0000000000" }]);
    assert.equal(first.recentBatches[0]?.rowCount, 1);
    assert.deepEqual(first.recentBatches[0]?.totals, [{
      currency: "EUR",
      grossMicro: "300.0000000000",
      recoupmentMicro: "50.0000000000",
      netMicro: "250.0000000000"
    }]);

    const second = await repository.readAllocationWorkbench({
      workspaceId: "eeee-mu",
      search: null,
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      batchCursor: first.batches.nextCursor,
      bankCursor: null,
      limit: 1
    });
    assert.deepEqual(second.batches.items.map((row) => row.fileName), ["batch-two.csv"]);

    const runs = await repository.listAllocationRuns({
      workspaceId: "eeee-mu",
      period: "2026-06",
      status: "completed",
      cursor: null,
      limit: 10
    });
    assert.deepEqual(runs.items.map((row) => row.id), ["80000000-0000-0000-0000-000000000001"]);
    assert.deepEqual(runs.items[0]?.currencyTotals, first.recentBatches[0]?.totals);

    const otherWorkspace = await repository.readAllocationWorkbench({
      workspaceId: "other-workspace",
      search: null,
      dateFrom: null,
      dateTo: null,
      batchCursor: null,
      bankCursor: null,
      limit: 50
    });
    assert.equal(otherWorkspace.summary.readyRowCount, 0);
    assert.deepEqual(otherWorkspace.batches.items.map((row) => row.fileName), ["hidden.csv"]);
  } finally {
    await pglite.close();
  }
});

function asPoolQuery(pglite: PGlite): Pick<Pool, "query"> {
  return {
    query: async (text: string, values?: readonly unknown[]) =>
      pglite.query(text, values === undefined ? [] : [...values])
  } as unknown as Pick<Pool, "query">;
}

async function createAllocationTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table import_batches (
      id uuid primary key, legacy_id integer, workspace_id text not null, source text not null,
      file_name text not null, status text not null, imported_at timestamptz, created_at timestamptz not null
    );
    create table normalized_earnings (
      id uuid primary key, workspace_id text not null, batch_id uuid not null, gross_amount numeric(28, 10) not null,
      currency char(3) not null, isrc text, mapping_status text not null, calculation_status text not null,
      created_at timestamptz not null
    );
    create table releases (
      id uuid primary key, workspace_id text not null, title text not null
    );
    create table tracks (
      id uuid primary key, workspace_id text not null, release_id uuid, title text not null, isrc text
    );
    create table earning_track_matches (
      id uuid primary key, earning_id uuid not null, track_id uuid not null,
      confidence numeric(12, 6) not null, status text not null
    );
    create table suspense_items (
      id uuid primary key, workspace_id text not null, earning_id uuid, amount numeric(28, 10) not null,
      currency char(3) not null, reason_code text not null, resolved boolean not null, created_at timestamptz not null
    );
    create table payees (id uuid primary key, workspace_id text not null, name text not null);
    create table calculation_runs (
      id uuid primary key, workspace_id text not null, batch_id uuid, status text not null,
      reconciliation_json jsonb not null, started_at timestamptz, finished_at timestamptz, created_at timestamptz not null
    );
    create table earning_allocations (
      id uuid primary key, earning_id uuid not null, calculation_run_id uuid not null, payee_id uuid not null,
      contract_id uuid, track_id uuid, gross_share numeric(28, 10) not null,
      recoupment_applied numeric(28, 10) not null, net_payable numeric(28, 10) not null,
      currency char(3) not null, status text not null
    );
  `);
}

async function seedAllocationRows(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    insert into import_batches values
      ('10000000-0000-0000-0000-000000000001', 1, 'eeee-mu', 'believe', 'batch-one.csv', 'completed', null, '2026-06-15T10:00:00Z'),
      ('10000000-0000-0000-0000-000000000002', 2, 'eeee-mu', 'believe', 'batch-two.csv', 'completed', null, '2026-06-16T10:00:00Z'),
      ('10000000-0000-0000-0000-000000000003', 1, 'other-workspace', 'hidden', 'hidden.csv', 'completed', null, '2026-06-17T10:00:00Z');
    insert into releases values
      ('20000000-0000-0000-0000-000000000001', 'eeee-mu', 'Night Release');
    insert into tracks values
      ('30000000-0000-0000-0000-000000000001', 'eeee-mu', '20000000-0000-0000-0000-000000000001', 'Night & Day', 'ISRC-NIGHT');
    insert into normalized_earnings values
      ('40000000-0000-0000-0000-000000000001', 'eeee-mu', '10000000-0000-0000-0000-000000000001', 100, 'EUR', 'ISRC-NIGHT', 'matched', 'pending', '2026-06-15T10:01:00Z'),
      ('40000000-0000-0000-0000-000000000002', 'eeee-mu', '10000000-0000-0000-0000-000000000002', 200, 'EUR', 'ISRC-NIGHT', 'matched', 'pending', '2026-06-16T10:01:00Z'),
      ('40000000-0000-0000-0000-000000000003', 'eeee-mu', '10000000-0000-0000-0000-000000000001', 300, 'EUR', 'ISRC-NIGHT', 'matched', 'allocated', '2026-06-15T10:02:00Z'),
      ('40000000-0000-0000-0000-000000000004', 'eeee-mu', '10000000-0000-0000-0000-000000000001', 400, 'EUR', null, 'matched', 'allocated', '2026-06-15T10:03:00Z'),
      ('40000000-0000-0000-0000-000000000005', 'eeee-mu', '10000000-0000-0000-0000-000000000002', 500, 'EUR', null, 'unmapped', 'suspense', '2026-06-16T10:04:00Z');
    insert into earning_track_matches values
      ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 100, 'matched'),
      ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 100, 'matched');
    insert into suspense_items values
      ('60000000-0000-0000-0000-000000000001', 'eeee-mu', '40000000-0000-0000-0000-000000000001', 100, 'EUR', 'missing_contract', false, '2026-06-15T10:05:00Z'),
      ('60000000-0000-0000-0000-000000000002', 'eeee-mu', '40000000-0000-0000-0000-000000000002', 200, 'EUR', 'missing_contract', false, '2026-06-16T10:05:00Z'),
      ('60000000-0000-0000-0000-000000000003', 'eeee-mu', '40000000-0000-0000-0000-000000000005', 500, 'EUR', 'mapping_low_confidence', false, '2026-06-16T10:06:00Z');
    insert into payees values
      ('70000000-0000-0000-0000-000000000001', 'eeee-mu', 'Artist One');
    insert into calculation_runs values
      ('80000000-0000-0000-0000-000000000001', 'eeee-mu', '10000000-0000-0000-0000-000000000001', 'completed',
       '{"period":"2026-06","lockKey":"distribution:allocation:test"}', '2026-06-18T10:00:00Z', '2026-06-18T10:01:00Z', '2026-06-18T10:00:00Z');
    insert into earning_allocations values
      ('90000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001',
       '70000000-0000-0000-0000-000000000001', null, '30000000-0000-0000-0000-000000000001', 300, 50, 250, 'EUR', 'posted');
  `);
}
