import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresDistributionReadRuntime } from "../src/distribution-repository.js";

test("Distribution Catalog repository exposes review semantics, facets, and opaque keyset pagination", async () => {
  const pglite = new PGlite();
  try {
    await createCatalogTables(pglite);
    await seedCatalogRows(pglite);
    const repository = createPostgresDistributionReadRuntime(asPoolQuery(pglite));

    const first = await repository.listCatalogTracks({
      workspaceId: "eeee-mu",
      search: null,
      artistSource: "catalog_import",
      isrc: null,
      role: null,
      review: "needs_review",
      label: null,
      releaseFrom: null,
      releaseTo: null,
      status: null,
      cursor: null,
      limit: 1
    });
    assert.deepEqual(first.items.map((row) => row.title), ["Alpha"]);
    assert.equal(first.items[0]?.reviewReason, "needs_review");
    assert.ok(first.nextCursor !== null);
    assert.doesNotMatch(first.nextCursor, /^\d+$/u);
    assert.deepEqual(first.summary, {
      trackCount: 4,
      needsReviewCount: 3,
      artistMismatchCount: 1,
      noContributorCount: 1
    });
    assert.deepEqual(first.facets.labels.map((item) => item.value), ["Label A", "Label B"]);
    assert.deepEqual(first.facets.roles.map((item) => item.value), ["main_artist", "remixer"]);

    const second = await repository.listCatalogTracks({
      workspaceId: "eeee-mu",
      search: null,
      artistSource: "catalog_import",
      isrc: null,
      role: null,
      review: "needs_review",
      label: null,
      releaseFrom: null,
      releaseTo: null,
      status: null,
      cursor: first.nextCursor,
      limit: 1
    });
    assert.deepEqual(second.items.map((row) => row.title), ["Beta"]);
    assert.equal(second.items[0]?.reviewReason, "artist_mismatch");
  } finally {
    await pglite.close();
  }
});

test("Distribution Catalog repository applies contributor, import artist, date, and workspace filters", async () => {
  const pglite = new PGlite();
  try {
    await createCatalogTables(pglite);
    await seedCatalogRows(pglite);
    const repository = createPostgresDistributionReadRuntime(asPoolQuery(pglite));

    const overrideRows = await repository.listCatalogTracks({
      workspaceId: "eeee-mu",
      search: "delta",
      artistSource: "catalog_contributors",
      isrc: "isrc-d",
      role: "remixer",
      review: null,
      label: "Label B",
      releaseFrom: "2024-01-01",
      releaseTo: "2024-12-31",
      status: "released",
      cursor: null,
      limit: 50
    });
    assert.deepEqual(overrideRows.items.map((row) => row.title), ["Delta"]);
    assert.equal(overrideRows.items[0]?.contributorSource, "override");
    assert.equal(overrideRows.items[0]?.reviewReason, null);

    const importedArtist = await repository.listCatalogTracks({
      workspaceId: "eeee-mu",
      search: "different artist",
      artistSource: "import_only",
      isrc: null,
      role: null,
      review: "artist_mismatch",
      label: null,
      releaseFrom: null,
      releaseTo: null,
      status: null,
      cursor: null,
      limit: 50
    });
    assert.deepEqual(importedArtist.items.map((row) => row.title), ["Beta"]);

    const otherWorkspace = await repository.listCatalogTracks({
      workspaceId: "other-workspace",
      search: null,
      artistSource: "catalog_import",
      isrc: null,
      role: null,
      review: null,
      label: null,
      releaseFrom: null,
      releaseTo: null,
      status: null,
      cursor: null,
      limit: 50
    });
    assert.deepEqual(otherWorkspace.items.map((row) => row.title), ["Hidden"]);

    const delta = await repository.getCatalogTrack("eeee-mu", "20000000-0000-0000-0000-000000000004");
    assert.deepEqual(delta?.contributors, [{ name: "Delta Artist", role: "remixer" }]);
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

async function createCatalogTables(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    create table labels (
      id uuid primary key,
      name text not null
    );
    create table releases (
      id uuid primary key,
      legacy_id integer,
      workspace_id text not null,
      title text not null,
      artist_name text not null,
      catalog_status text not null,
      upc text,
      label_id uuid,
      label_name text,
      release_date date
    );
    create table tracks (
      id uuid primary key,
      legacy_id integer,
      workspace_id text not null,
      title text not null,
      version_title text,
      artist_name text not null,
      catalog_status text not null,
      isrc text,
      release_id uuid
    );
    create table artists (
      id uuid primary key,
      name text not null
    );
    create table track_contributors (
      id uuid primary key,
      track_id uuid not null,
      artist_id uuid not null,
      role text not null
    );
    create table catalog_contributor_overrides (
      id uuid primary key,
      workspace_id text not null,
      track_id uuid not null,
      contributors_json jsonb not null,
      created_at timestamptz not null
    );
    create table normalized_earnings (
      id uuid primary key,
      workspace_id text not null,
      raw_artist text
    );
    create table earning_track_matches (
      id uuid primary key,
      earning_id uuid not null,
      track_id uuid not null,
      status text not null
    );
  `);
}

async function seedCatalogRows(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    insert into labels (id, name) values
      ('01000000-0000-0000-0000-000000000001', 'Label A'),
      ('01000000-0000-0000-0000-000000000002', 'Label B');
    insert into releases (id, legacy_id, workspace_id, title, artist_name, catalog_status, upc, label_id, release_date) values
      ('10000000-0000-0000-0000-000000000001', 1, 'eeee-mu', 'Release A', 'Alpha Artist', 'released', 'UPC-A', '01000000-0000-0000-0000-000000000001', '2023-06-01'),
      ('10000000-0000-0000-0000-000000000002', 2, 'eeee-mu', 'Release B', 'Delta Artist', 'released', 'UPC-B', '01000000-0000-0000-0000-000000000002', '2024-06-01'),
      ('10000000-0000-0000-0000-000000000003', 1, 'other-workspace', 'Hidden Release', 'Hidden Artist', 'released', null, null, '2024-01-01');
    insert into tracks (id, legacy_id, workspace_id, title, version_title, artist_name, catalog_status, isrc, release_id) values
      ('20000000-0000-0000-0000-000000000001', 1, 'eeee-mu', 'Alpha', null, 'Alpha Artist', 'released', 'ISRC-A', '10000000-0000-0000-0000-000000000001'),
      ('20000000-0000-0000-0000-000000000002', 2, 'eeee-mu', 'Beta', null, 'Beta Artist', 'released', 'ISRC-B', '10000000-0000-0000-0000-000000000001'),
      ('20000000-0000-0000-0000-000000000003', 3, 'eeee-mu', 'Gamma', null, 'Gamma Artist', 'draft', null, null),
      ('20000000-0000-0000-0000-000000000004', 4, 'eeee-mu', 'Delta', 'Club Mix', 'Delta Artist', 'released', 'ISRC-D', '10000000-0000-0000-0000-000000000002'),
      ('20000000-0000-0000-0000-000000000005', 1, 'other-workspace', 'Hidden', null, 'Hidden Artist', 'released', 'ISRC-X', '10000000-0000-0000-0000-000000000003');
    insert into artists (id, name) values
      ('30000000-0000-0000-0000-000000000001', 'Alpha Artist'),
      ('30000000-0000-0000-0000-000000000002', 'Beta Artist'),
      ('30000000-0000-0000-0000-000000000003', 'Delta Artist');
    insert into track_contributors (id, track_id, artist_id, role) values
      ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'main_artist'),
      ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'main_artist'),
      ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', 'main_artist');
    insert into normalized_earnings (id, workspace_id, raw_artist) values
      ('50000000-0000-0000-0000-000000000001', 'eeee-mu', 'Alpha Artist'),
      ('50000000-0000-0000-0000-000000000002', 'eeee-mu', 'Different Artist'),
      ('50000000-0000-0000-0000-000000000003', 'eeee-mu', 'Delta Artist');
    insert into earning_track_matches (id, earning_id, track_id, status) values
      ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'matched'),
      ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'matched'),
      ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004', 'matched');
    insert into catalog_contributor_overrides (id, workspace_id, track_id, contributors_json, created_at) values
      ('70000000-0000-0000-0000-000000000001', 'eeee-mu', '20000000-0000-0000-0000-000000000004', '[{"name":"Delta Artist","role":"remixer"}]', '2026-07-20T00:00:00Z');
  `);
}
