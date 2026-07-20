import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresDistributionReadRuntime } from "../src/distribution-repository.js";

test("Distribution Contracts repository exposes track-centric splits, overrides, expenses, and cursor pagination", async () => {
  const pglite = new PGlite();
  try {
    await createContractTables(pglite);
    await seedContractRows(pglite);
    const repository = createPostgresDistributionReadRuntime(asPoolQuery(pglite));

    const first = await repository.listContractTracks({
      workspaceId: "eeee-mu",
      search: null,
      status: null,
      workflow: null,
      cursor: null,
      limit: 2
    });
    assert.deepEqual(first.items.map((row) => row.title), ["Alpha", "Beta"]);
    assert.equal(first.items[0]?.splitTotalPercentage, "100.000000");
    assert.equal(first.items[0]?.expenseCount, 1);
    assert.deepEqual(first.items[0]?.openExpenseTotals, [{ currency: "EUR", amountMicro: "80.0000000000" }]);
    assert.ok(first.nextCursor !== null);
    assert.deepEqual(first.summary, {
      activeTrackOnlyCount: 3,
      activeEffectiveCount: 4,
      expiredContractCount: 1,
      draftContractCount: 1,
      directTrackRuleCount: 5,
      noEffectiveSplitCount: 1,
      ambiguousCount: 1,
      unallocatedRowCount: 1,
      openRecoupmentTotals: [{ currency: "EUR", amountMicro: "80.0000000000" }]
    });

    const second = await repository.listContractTracks({
      workspaceId: "eeee-mu",
      search: null,
      status: null,
      workflow: null,
      cursor: first.nextCursor,
      limit: 2
    });
    assert.deepEqual(second.items.map((row) => row.title), ["Gamma", "Delta"]);

    const override = await repository.listContractTracks({
      workspaceId: "eeee-mu",
      search: "override payee",
      status: "active",
      workflow: "ready",
      cursor: null,
      limit: 50
    });
    assert.deepEqual(override.items.map((row) => row.title), ["Epsilon"]);
    assert.equal(override.items[0]?.splitSource, "override");
    assert.deepEqual(override.items[0]?.splits.map((split) => split.percentage), ["100.000000"]);

    const attention = await repository.listContractTracks({
      workspaceId: "eeee-mu",
      search: null,
      status: null,
      workflow: "needs_attention",
      cursor: null,
      limit: 50
    });
    assert.deepEqual(attention.items.map((row) => row.status), ["no_split", "ambiguous"]);

    const otherWorkspace = await repository.listContractTracks({
      workspaceId: "other-workspace",
      search: null,
      status: null,
      workflow: null,
      cursor: null,
      limit: 50
    });
    assert.deepEqual(otherWorkspace.items.map((row) => row.title), ["Hidden"]);

    const delta = await repository.getContractTrack("eeee-mu", "20000000-0000-0000-0000-000000000004");
    assert.equal(delta?.splitSource, "release");
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

async function createContractTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table labels (id uuid primary key, name text not null);
    create table releases (
      id uuid primary key, legacy_id integer, workspace_id text not null, title text not null, label_id uuid, label_name text
    );
    create table tracks (
      id uuid primary key, legacy_id integer, workspace_id text not null, title text not null,
      version_title text, artist_name text not null, isrc text, release_id uuid
    );
    create table payees (id uuid primary key, workspace_id text not null, name text not null);
    create table contracts (
      id uuid primary key, workspace_id text not null, title text not null, status text not null
    );
    create table royalty_rules (
      id uuid primary key, contract_id uuid not null, payee_id uuid not null, percentage numeric(18, 6) not null,
      scope_type text, scope_id text, priority integer not null, status text not null
    );
    create table contract_rule_set_overrides (
      id uuid primary key, workspace_id text not null, track_id uuid not null, base_contract_id uuid not null,
      rules_json jsonb not null, created_at timestamptz not null
    );
    create table normalized_earnings (
      id uuid primary key, workspace_id text not null, raw_artist text,
      mapping_status text not null, calculation_status text not null
    );
    create table earning_track_matches (
      id uuid primary key, earning_id uuid not null, track_id uuid not null, status text not null
    );
    create table earning_allocations (id uuid primary key, earning_id uuid not null);
    create table contract_cost_terms (
      id uuid primary key, contract_id uuid not null, currency char(3) not null, amount numeric(28, 10) not null,
      recoupable boolean not null, status text not null
    );
    create table expense_applications (id uuid primary key, cost_term_id uuid not null, amount_applied numeric(28, 10) not null);
  `);
}

async function seedContractRows(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    insert into labels values ('01000000-0000-0000-0000-000000000001', 'Label A');
    insert into releases values
      ('10000000-0000-0000-0000-000000000001', 101, 'eeee-mu', 'Release A', '01000000-0000-0000-0000-000000000001', null),
      ('10000000-0000-0000-0000-000000000002', 102, 'eeee-mu', 'Release D', null, 'Label D');
    insert into tracks values
      ('20000000-0000-0000-0000-000000000001', 1, 'eeee-mu', 'Alpha', null, 'Alpha Artist', 'ISRC-A', '10000000-0000-0000-0000-000000000001'),
      ('20000000-0000-0000-0000-000000000002', 2, 'eeee-mu', 'Beta', null, 'Beta Artist', 'ISRC-B', '10000000-0000-0000-0000-000000000001'),
      ('20000000-0000-0000-0000-000000000003', 3, 'eeee-mu', 'Gamma', null, 'Gamma Artist', 'ISRC-C', '10000000-0000-0000-0000-000000000001'),
      ('20000000-0000-0000-0000-000000000004', 4, 'eeee-mu', 'Delta', null, 'Delta Artist', 'ISRC-D', '10000000-0000-0000-0000-000000000002'),
      ('20000000-0000-0000-0000-000000000005', 5, 'eeee-mu', 'Epsilon', null, 'Epsilon Artist', 'ISRC-E', '10000000-0000-0000-0000-000000000001'),
      ('20000000-0000-0000-0000-000000000006', 1, 'other-workspace', 'Hidden', null, 'Hidden Artist', null, null);
    insert into payees values
      ('30000000-0000-0000-0000-000000000001', 'eeee-mu', 'Payee One'),
      ('30000000-0000-0000-0000-000000000002', 'eeee-mu', 'Payee Two'),
      ('30000000-0000-0000-0000-000000000003', 'eeee-mu', 'Override Payee'),
      ('30000000-0000-0000-0000-000000000004', 'other-workspace', 'Hidden Payee');
    insert into contracts values
      ('40000000-0000-0000-0000-000000000001', 'eeee-mu', 'Alpha deal', 'active'),
      ('40000000-0000-0000-0000-000000000002', 'eeee-mu', 'Gamma deal one', 'active'),
      ('40000000-0000-0000-0000-000000000003', 'eeee-mu', 'Gamma deal two', 'active'),
      ('40000000-0000-0000-0000-000000000004', 'eeee-mu', 'Release D deal', 'active'),
      ('40000000-0000-0000-0000-000000000005', 'eeee-mu', 'Epsilon imported deal', 'active'),
      ('40000000-0000-0000-0000-000000000006', 'eeee-mu', 'Expired deal', 'expired'),
      ('40000000-0000-0000-0000-000000000007', 'eeee-mu', 'Draft deal', 'draft'),
      ('40000000-0000-0000-0000-000000000008', 'other-workspace', 'Hidden deal', 'active');
    insert into royalty_rules values
      ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 60, 'track', '1', 2, 'active'),
      ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 40, 'track', '1', 1, 'active'),
      ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 100, 'track', '20000000-0000-0000-0000-000000000003', 1, 'active'),
      ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 100, 'track', '20000000-0000-0000-0000-000000000003', 1, 'active'),
      ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 100, 'release', '102', 1, 'active'),
      ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', 100, 'track', '20000000-0000-0000-0000-000000000005', 1, 'active'),
      ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000004', 100, 'track', '20000000-0000-0000-0000-000000000006', 1, 'active');
    insert into contract_rule_set_overrides values
      ('60000000-0000-0000-0000-000000000001', 'eeee-mu', '20000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005',
       '[{"payeeId":"30000000-0000-0000-0000-000000000003","percentage":"100.000000"}]', now());
    insert into normalized_earnings values
      ('70000000-0000-0000-0000-000000000001', 'eeee-mu', 'Alpha Artist', 'matched', 'allocated'),
      ('70000000-0000-0000-0000-000000000002', 'eeee-mu', 'Beta Artist', 'matched', 'pending');
    insert into earning_track_matches values
      ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'matched');
    insert into earning_allocations values
      ('72000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001');
    insert into contract_cost_terms values
      ('80000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'EUR', 100, true, 'open');
    insert into expense_applications values
      ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 20);
  `);
}
