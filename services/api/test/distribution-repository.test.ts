import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresDistributionReadRuntime } from "../src/distribution-repository.js";

test("Distribution mapping repository scopes live rows and paginates with an opaque keyset cursor", async () => {
  const pglite = new PGlite();
  try {
    await createMappingTables(pglite);
    await seedMappingRows(pglite);
    const repository = createPostgresDistributionReadRuntime(asPoolQuery(pglite));

    const first = await repository.listMappingRows({
      workspaceId: "eeee-mu",
      batchId: null,
      status: "suggested",
      search: null,
      cursor: null,
      limit: 1
    });
    assert.equal(first.items.length, 1);
    assert.equal(first.items[0]?.sourceTitle, "Alpha suggestion");
    assert.equal(first.items[0]?.status, "suggested");
    assert.equal(first.items[0]?.confidenceBp, 9900);
    assert.equal(first.items[0]?.exactFixPath, "mapping_rules");
    assert.ok(first.nextCursor !== null);
    assert.doesNotMatch(first.nextCursor, /^\d+$/u);

    const second = await repository.listMappingRows({
      workspaceId: "eeee-mu",
      batchId: null,
      status: "suggested",
      search: null,
      cursor: first.nextCursor,
      limit: 1
    });
    assert.deepEqual(second.items.map((row) => row.sourceTitle), ["Delta suggestion"]);
    assert.equal(second.nextCursor, null);
  } finally {
    await pglite.close();
  }
});

test("Distribution mapping repository applies server search, status semantics, and workspace isolation", async () => {
  const pglite = new PGlite();
  try {
    await createMappingTables(pglite);
    await seedMappingRows(pglite);
    const repository = createPostgresDistributionReadRuntime(asPoolQuery(pglite));

    const searched = await repository.listMappingRows({
      workspaceId: "eeee-mu",
      batchId: null,
      status: "unmapped",
      search: "beta artist",
      cursor: null,
      limit: 50
    });
    assert.deepEqual(searched.items.map((row) => row.sourceTitle), ["Beta unmapped"]);
    assert.equal(searched.items[0]?.suggestedTrackId, null);
    assert.equal(searched.items[0]?.exactFixPath, "catalog");

    const mapped = await repository.listMappingRows({
      workspaceId: "eeee-mu",
      batchId: null,
      status: "mapped",
      search: null,
      cursor: null,
      limit: 50
    });
    assert.deepEqual(mapped.items.map((row) => row.sourceTitle), ["Gamma mapped"]);

    const otherWorkspace = await repository.listMappingRows({
      workspaceId: "other-workspace",
      batchId: null,
      status: null,
      search: null,
      cursor: null,
      limit: 50
    });
    assert.deepEqual(otherWorkspace.items.map((row) => row.sourceTitle), ["Other workspace"]);
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

async function createMappingTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table normalized_earnings (
      id uuid primary key,
      legacy_id integer,
      workspace_id text not null,
      batch_id uuid not null,
      raw_title text,
      raw_artist text,
      raw_label text,
      dsp text not null,
      isrc text,
      upc text,
      gross_amount numeric(28, 10) not null,
      currency char(3) not null,
      mapping_status text not null
    );
    create table tracks (
      id uuid primary key,
      title text not null
    );
    create table earning_track_matches (
      id uuid primary key,
      earning_id uuid not null,
      track_id uuid not null,
      confidence numeric(12, 6) not null,
      status text not null
    );
  `);
}

async function seedMappingRows(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    insert into tracks (id, title) values
      ('10000000-0000-0000-0000-000000000001', 'Alpha canonical'),
      ('10000000-0000-0000-0000-000000000002', 'Gamma canonical'),
      ('10000000-0000-0000-0000-000000000003', 'Delta canonical'),
      ('10000000-0000-0000-0000-000000000004', 'Other canonical');

    insert into normalized_earnings (
      id, legacy_id, workspace_id, batch_id, raw_title, raw_artist, raw_label, dsp,
      isrc, upc, gross_amount, currency, mapping_status
    ) values
      ('20000000-0000-0000-0000-000000000001', 1, 'eeee-mu', '30000000-0000-0000-0000-000000000001', 'Alpha suggestion', 'Alpha artist', 'Label A', 'Tidal', 'ISRC-A', null, 1.25, 'EUR', 'unmapped'),
      ('20000000-0000-0000-0000-000000000002', 2, 'eeee-mu', '30000000-0000-0000-0000-000000000001', 'Beta unmapped', 'Beta artist', 'Label B', 'Spotify', 'ISRC-B', null, 2.50, 'USD', 'unmapped'),
      ('20000000-0000-0000-0000-000000000003', 3, 'eeee-mu', '30000000-0000-0000-0000-000000000001', 'Gamma mapped', 'Gamma artist', 'Label C', 'Apple', 'ISRC-C', null, 3.75, 'EUR', 'matched'),
      ('20000000-0000-0000-0000-000000000004', 4, 'eeee-mu', '30000000-0000-0000-0000-000000000002', 'Delta suggestion', 'Delta artist', 'Label D', 'Deezer', null, null, 4.00, 'USD', 'unmatched'),
      ('20000000-0000-0000-0000-000000000005', 1, 'other-workspace', '30000000-0000-0000-0000-000000000003', 'Other workspace', 'Hidden artist', 'Label X', 'Tidal', null, null, 5.00, 'USD', 'unmapped');

    insert into earning_track_matches (id, earning_id, track_id, confidence, status) values
      ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 99.000000, 'unmatched'),
      ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 100.000000, 'matched'),
      ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', 90.000000, 'unmatched'),
      ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000004', 98.000000, 'unmatched');
  `);
}
