import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresDistributionReadRuntime } from "../src/distribution-repository.js";

test("Distribution Suspense repository reads the exact workspace queue with filters and cursors", async () => {
  const pglite = new PGlite();
  try {
    await createSuspenseTables(pglite);
    await seedSuspenseRows(pglite);
    const repository = createPostgresDistributionReadRuntime(asPoolQuery(pglite));
    const query = {
      workspaceId: "eeee-mu",
      search: null,
      batchReference: null,
      reasonCode: null,
      status: "open" as const,
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      cursor: null,
      limit: 1
    };

    const first = await repository.readSuspenseWorkbench(query);
    assert.deepEqual(first.summary, {
      filteredRowCount: 3,
      reasonTypeCount: 2,
      totals: [
        { currency: "EUR", amountMicro: "200.0000000000" },
        { currency: "USD", amountMicro: "50.0000000000" }
      ]
    });
    assert.deepEqual(first.reasonGroups.map((group) => [group.reasonCode, group.rowCount, group.fixPath]), [
      ["missing_contract", 2, "contracts"],
      ["negative_amount", 1, "suspense"]
    ]);
    assert.equal(first.items.items.length, 1);
    assert.equal(first.items.items[0]?.reasonCode, "negative_amount");
    assert.equal(first.items.items[0]?.batchReference, "#8");
    assert.equal(first.items.items[0]?.trackTitle, "Other song");
    assert.equal(first.items.items[0]?.splitPercentage, null);
    assert.ok(first.items.nextCursor !== null);

    const second = await repository.readSuspenseWorkbench({ ...query, cursor: first.items.nextCursor });
    assert.deepEqual(second.items.items.map((row) => row.reasonCode), ["missing_contract"]);

    const byLegacyBatch = await repository.readSuspenseWorkbench({ ...query, batchReference: "#7", limit: 10 });
    assert.equal(byLegacyBatch.summary.filteredRowCount, 2);
    const bySearch = await repository.readSuspenseWorkbench({ ...query, search: "night", limit: 10 });
    assert.equal(bySearch.summary.filteredRowCount, 2);
    const byReason = await repository.readSuspenseWorkbench({ ...query, reasonCode: "negative_amount", limit: 10 });
    assert.deepEqual(byReason.items.items.map((row) => row.currency), ["USD"]);

    const detail = await repository.getSuspenseItem("eeee-mu", "60000000-0000-0000-0000-000000000001");
    assert.equal(detail?.reasonTitle, "Missing contract");
    assert.equal(detail?.trackTitle, "Night & Day");
    assert.equal(detail?.splitPercentage, "100");
    assert.equal(await repository.getSuspenseItem("other-workspace", "60000000-0000-0000-0000-000000000001"), null);

    const otherWorkspace = await repository.readSuspenseWorkbench({ ...query, workspaceId: "other-workspace", limit: 10 });
    assert.equal(otherWorkspace.summary.filteredRowCount, 1);
    assert.deepEqual(otherWorkspace.items.items.map((row) => row.reasonCode), ["unmapped_track"]);
  } finally {
    await pglite.close();
  }
});

function asPoolQuery(pglite: PGlite): Pick<Pool, "query"> {
  return {
    query: async (text: string, values?: readonly unknown[]) => pglite.query(text, values === undefined ? [] : [...values])
  } as unknown as Pick<Pool, "query">;
}

async function createSuspenseTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table import_batches (
      id uuid primary key, legacy_id integer, workspace_id text not null, file_name text not null,
      imported_at timestamptz, created_at timestamptz not null
    );
    create table normalized_earnings (
      id uuid primary key, workspace_id text not null, batch_id uuid, raw_title text, raw_artist text,
      isrc text, upc text, mapping_status text not null default 'unmapped', calculation_status text not null default 'suspense'
    );
    create table releases (id uuid primary key, workspace_id text not null, upc text);
    create table tracks (
      id uuid primary key, workspace_id text not null, release_id uuid, title text not null, artist_name text, isrc text
    );
    create table earning_track_matches (
      id uuid primary key, earning_id uuid not null, track_id uuid not null, confidence numeric(12, 6) not null, status text not null
    );
    create table contract_rule_set_overrides (
      id uuid primary key, workspace_id text not null, track_id uuid not null, rules_json jsonb not null, created_at timestamptz not null
    );
    create table contracts (id uuid primary key, workspace_id text not null, status text not null);
    create table royalty_rules (
      id uuid primary key, contract_id uuid not null, scope_type text not null, scope_id text not null,
      percentage numeric(12, 6) not null, status text not null
    );
    create table suspense_items (
      id uuid primary key, workspace_id text not null, earning_id uuid, amount numeric(28, 10) not null,
      currency char(3) not null, reason_code text not null, resolved boolean not null,
      created_at timestamptz not null, resolved_at timestamptz
    );
  `);
}

async function seedSuspenseRows(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    insert into import_batches values
      ('10000000-0000-0000-0000-000000000001', 7, 'eeee-mu', 'June royalty export.csv', '2026-06-12T10:00:00Z', '2026-06-12T10:00:00Z'),
      ('10000000-0000-0000-0000-000000000002', 8, 'eeee-mu', 'July royalty export.csv', '2026-06-13T10:00:00Z', '2026-06-13T10:00:00Z'),
      ('10000000-0000-0000-0000-000000000003', 1, 'other-workspace', 'hidden.csv', '2026-06-13T10:00:00Z', '2026-06-13T10:00:00Z');
    insert into releases values ('20000000-0000-0000-0000-000000000001', 'eeee-mu', 'UPC-NIGHT');
    insert into tracks values ('30000000-0000-0000-0000-000000000001', 'eeee-mu', '20000000-0000-0000-0000-000000000001', 'Night & Day', 'Artist One', 'ISRC-NIGHT');
    insert into normalized_earnings values
      ('40000000-0000-0000-0000-000000000001', 'eeee-mu', '10000000-0000-0000-0000-000000000001', 'Night & Day', 'Artist One', 'ISRC-NIGHT', 'UPC-NIGHT', 'matched', 'suspense'),
      ('40000000-0000-0000-0000-000000000002', 'eeee-mu', '10000000-0000-0000-0000-000000000001', 'Night & Day', 'Artist One', 'ISRC-NIGHT', 'UPC-NIGHT', 'matched', 'suspense'),
      ('40000000-0000-0000-0000-000000000003', 'eeee-mu', '10000000-0000-0000-0000-000000000002', 'Other song', 'Artist Two', 'ISRC-OTHER', 'UPC-OTHER', 'unmapped', 'suspense'),
      ('40000000-0000-0000-0000-000000000004', 'other-workspace', '10000000-0000-0000-0000-000000000003', 'Hidden', 'Artist Three', null, null, 'unmapped', 'suspense');
    insert into earning_track_matches values
      ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 100, 'matched'),
      ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 100, 'matched');
    insert into contract_rule_set_overrides values
      ('70000000-0000-0000-0000-000000000001', 'eeee-mu', '30000000-0000-0000-0000-000000000001', '[{"percentage":"100"}]', '2026-06-01T00:00:00Z');
    insert into suspense_items values
      ('60000000-0000-0000-0000-000000000001', 'eeee-mu', '40000000-0000-0000-0000-000000000001', 100, 'EUR', 'missing_contract', false, '2026-06-12T10:05:00Z', null),
      ('60000000-0000-0000-0000-000000000002', 'eeee-mu', '40000000-0000-0000-0000-000000000002', 100, 'EUR', 'missing_contract', false, '2026-06-12T10:04:00Z', null),
      ('60000000-0000-0000-0000-000000000003', 'eeee-mu', '40000000-0000-0000-0000-000000000003', 50, 'USD', 'negative_amount', false, '2026-06-13T10:05:00Z', null),
      ('60000000-0000-0000-0000-000000000004', 'eeee-mu', '40000000-0000-0000-0000-000000000003', 20, 'USD', 'unmapped_track', true, '2026-06-10T10:05:00Z', '2026-06-11T10:05:00Z'),
      ('60000000-0000-0000-0000-000000000005', 'other-workspace', '40000000-0000-0000-0000-000000000004', 1, 'EUR', 'unmapped_track', false, '2026-06-13T10:05:00Z', null);
  `);
}
