import type { Pool } from "pg";
import type {
  DistributionCatalogArtistSource,
  DistributionCatalogContributor,
  DistributionCatalogReviewFilter,
  DistributionCatalogTrackRow,
  DistributionCatalogWorkbenchResponse,
  DistributionMappingRow,
  PageResult
} from "@ehq/api-client";

type PgRow = Readonly<Record<string, unknown>>;

export interface DistributionMappingPageQuery {
  readonly workspaceId: string;
  readonly batchId: string | null;
  readonly status: DistributionMappingRow["status"] | null;
  readonly search: string | null;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface DistributionCatalogPageQuery {
  readonly workspaceId: string;
  readonly search: string | null;
  readonly artistSource: DistributionCatalogArtistSource;
  readonly isrc: string | null;
  readonly role: string | null;
  readonly review: DistributionCatalogReviewFilter | null;
  readonly label: string | null;
  readonly releaseFrom: string | null;
  readonly releaseTo: string | null;
  readonly status: "draft" | "released" | "archived" | null;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface DistributionReadRuntime {
  readonly listMappingRows: (query: DistributionMappingPageQuery) => Promise<PageResult<DistributionMappingRow>>;
  readonly listCatalogTracks: (query: DistributionCatalogPageQuery) => Promise<DistributionCatalogWorkbenchResponse>;
  readonly getCatalogTrack: (workspaceId: string, trackId: string) => Promise<DistributionCatalogTrackRow | null>;
}

interface MappingCursor {
  readonly legacySort: number;
  readonly id: string;
}

interface MappingRowWithCursor {
  readonly item: DistributionMappingRow;
  readonly cursor: MappingCursor;
}

interface CatalogCursor {
  readonly legacySort: number;
  readonly id: string;
}

interface CatalogRowWithCursor {
  readonly item: DistributionCatalogTrackRow;
  readonly cursor: CatalogCursor;
}

export class DistributionMappingCursorError extends Error {
  constructor() {
    super("Invalid Distribution mapping cursor.");
    this.name = "DistributionMappingCursorError";
  }
}

export class DistributionCatalogCursorError extends Error {
  constructor() {
    super("Invalid Distribution catalog cursor.");
    this.name = "DistributionCatalogCursorError";
  }
}

export function createPostgresDistributionReadRuntime(pool: Pick<Pool, "query">): DistributionReadRuntime {
  return {
    listMappingRows: async (query: DistributionMappingPageQuery): Promise<PageResult<DistributionMappingRow>> =>
      readDistributionMappingPage(pool, query),
    listCatalogTracks: async (query: DistributionCatalogPageQuery): Promise<DistributionCatalogWorkbenchResponse> =>
      readDistributionCatalogPage(pool, query),
    getCatalogTrack: async (workspaceId: string, trackId: string): Promise<DistributionCatalogTrackRow | null> =>
      readDistributionCatalogTrack(pool, workspaceId, trackId)
  };
}

export async function readDistributionMappingPage(
  pool: Pick<Pool, "query">,
  query: DistributionMappingPageQuery
): Promise<PageResult<DistributionMappingRow>> {
  const limit = normalizeLimit(query.limit);
  const cursor = decodeMappingCursor(query.cursor);
  const parameters: unknown[] = [query.workspaceId];
  const where: string[] = ["ne.workspace_id = $1"];

  if (query.batchId !== null) {
    parameters.push(query.batchId);
    where.push(`ne.batch_id = $${String(parameters.length)}::uuid`);
  }

  if (query.status !== null) {
    where.push(mappingStatusPredicate(query.status));
  }

  const search = query.search?.trim() ?? "";
  if (search !== "") {
    parameters.push(`%${search}%`);
    const parameter = `$${String(parameters.length)}`;
    where.push(`(
      ne.raw_title ilike ${parameter}
      or ne.raw_artist ilike ${parameter}
      or ne.raw_label ilike ${parameter}
      or ne.dsp ilike ${parameter}
      or ne.isrc ilike ${parameter}
      or ne.upc ilike ${parameter}
      or track_match.track_title ilike ${parameter}
    )`);
  }

  if (cursor !== null) {
    parameters.push(cursor.legacySort, cursor.id);
    const legacyParameter = `$${String(parameters.length - 1)}`;
    const idParameter = `$${String(parameters.length)}`;
    where.push(`(
      coalesce(ne.legacy_id, 2147483647) > ${legacyParameter}
      or (
        coalesce(ne.legacy_id, 2147483647) = ${legacyParameter}
        and ne.id::text > ${idParameter}
      )
    )`);
  }

  parameters.push(limit + 1);
  const limitParameter = `$${String(parameters.length)}`;
  const result = await pool.query(
    `select
       ne.id::text,
       ne.batch_id::text,
       ne.raw_title,
       ne.raw_artist,
       ne.raw_label,
       ne.dsp,
       ne.isrc,
       ne.upc,
       ne.gross_amount::text,
       ne.currency,
       ne.mapping_status,
       track_match.track_id,
       track_match.track_title,
       track_match.confidence,
       coalesce(ne.legacy_id, 2147483647) as legacy_sort
     from normalized_earnings ne
     left join lateral (
       select
         etm.track_id::text,
         t.title as track_title,
         etm.confidence::text
       from earning_track_matches etm
       join tracks t on t.id = etm.track_id
       where etm.earning_id = ne.id
         and etm.status not in ('ignored', 'suspense')
       order by
         case when etm.status = 'matched' then 0 else 1 end,
         etm.confidence desc,
         etm.id
       limit 1
     ) track_match on true
     where ${where.join("\n       and ")}
     order by coalesce(ne.legacy_id, 2147483647), ne.id
     limit ${limitParameter}`,
    parameters
  );

  const mappedRows = result.rows.map(toMappingRowWithCursor);
  const hasMore = mappedRows.length > limit;
  const pageRows = mappedRows.slice(0, limit);
  const last = pageRows[pageRows.length - 1];
  return {
    items: pageRows.map((row) => row.item),
    nextCursor: hasMore && last !== undefined ? encodeMappingCursor(last.cursor) : null
  };
}

export async function readDistributionCatalogPage(
  pool: Pick<Pool, "query">,
  query: DistributionCatalogPageQuery
): Promise<DistributionCatalogWorkbenchResponse> {
  const limit = normalizeLimit(query.limit);
  const cursor = decodeCatalogCursor(query.cursor);
  const parameters: unknown[] = [query.workspaceId];
  const where: string[] = ["t.workspace_id = $1"];

  const search = query.search?.trim() ?? "";
  if (search !== "") {
    parameters.push(search.toLocaleLowerCase());
    const parameter = `$${String(parameters.length)}`;
    const artistFields = query.artistSource === "import_only"
      ? `strpos(lower(coalesce(import_artist.artist_import, '')), ${parameter}) > 0`
      : query.artistSource === "catalog_contributors"
        ? `(strpos(lower(t.artist_name), ${parameter}) > 0
          or exists (
            select 1 from jsonb_array_elements(effective_contributors.contributors_json) contributor
            where strpos(lower(coalesce(contributor->>'name', '')), ${parameter}) > 0
          ))`
        : `(strpos(lower(t.artist_name), ${parameter}) > 0
          or strpos(lower(coalesce(import_artist.artist_import, '')), ${parameter}) > 0
          or exists (
            select 1 from jsonb_array_elements(effective_contributors.contributors_json) contributor
            where strpos(lower(coalesce(contributor->>'name', '')), ${parameter}) > 0
          ))`;
    where.push(`(
      strpos(lower(t.title), ${parameter}) > 0
      or strpos(lower(coalesce(t.version_title, '')), ${parameter}) > 0
      or strpos(lower(coalesce(t.isrc, '')), ${parameter}) > 0
      or strpos(lower(coalesce(r.title, '')), ${parameter}) > 0
      or strpos(lower(coalesce(r.upc, '')), ${parameter}) > 0
      or strpos(lower(coalesce(l.name, r.label_name, '')), ${parameter}) > 0
      or ${artistFields}
    )`);
  }

  if (query.artistSource === "catalog_contributors") {
    where.push("jsonb_array_length(effective_contributors.contributors_json) > 0");
  } else if (query.artistSource === "import_only") {
    where.push("nullif(trim(import_artist.artist_import), '') is not null");
  }

  const isrc = query.isrc?.trim() ?? "";
  if (isrc !== "") {
    parameters.push(isrc.toLocaleLowerCase());
    where.push(`strpos(lower(coalesce(t.isrc, '')), $${String(parameters.length)}) > 0`);
  }

  if (query.role !== null) {
    parameters.push(query.role);
    where.push(`exists (
      select 1 from jsonb_array_elements(effective_contributors.contributors_json) contributor
      where contributor->>'role' = $${String(parameters.length)}
    )`);
  }

  if (query.review !== null) {
    where.push(catalogReviewPredicate(query.review));
  }

  if (query.label !== null) {
    parameters.push(query.label);
    where.push(`coalesce(l.name, r.label_name, '') = $${String(parameters.length)}`);
  }

  if (query.releaseFrom !== null) {
    parameters.push(query.releaseFrom);
    where.push(`r.release_date >= $${String(parameters.length)}::date`);
  }

  if (query.releaseTo !== null) {
    parameters.push(query.releaseTo);
    where.push(`r.release_date <= $${String(parameters.length)}::date`);
  }

  if (query.status !== null) {
    parameters.push(query.status);
    where.push(`t.catalog_status = $${String(parameters.length)}`);
  }

  if (cursor !== null) {
    parameters.push(cursor.legacySort, cursor.id);
    const legacyParameter = `$${String(parameters.length - 1)}`;
    const idParameter = `$${String(parameters.length)}`;
    where.push(`(
      coalesce(t.legacy_id, 2147483647) > ${legacyParameter}
      or (
        coalesce(t.legacy_id, 2147483647) = ${legacyParameter}
        and t.id::text > ${idParameter}
      )
    )`);
  }

  parameters.push(limit + 1);
  const result = await pool.query(
    `${catalogTrackSelectSql()}
     where ${where.join("\n       and ")}
     order by coalesce(t.legacy_id, 2147483647), t.id
     limit $${String(parameters.length)}`,
    parameters
  );
  const mappedRows = result.rows.map(toCatalogRowWithCursor);
  const hasMore = mappedRows.length > limit;
  const pageRows = mappedRows.slice(0, limit);
  const last = pageRows[pageRows.length - 1];
  const [facets, summary] = await Promise.all([
    readCatalogFacets(pool, query.workspaceId),
    readCatalogSummary(pool, query.workspaceId)
  ]);

  return {
    items: pageRows.map((row) => row.item),
    nextCursor: hasMore && last !== undefined ? encodeCatalogCursor(last.cursor) : null,
    facets,
    summary
  };
}

export async function readDistributionCatalogTrack(
  pool: Pick<Pool, "query">,
  workspaceId: string,
  trackId: string
): Promise<DistributionCatalogTrackRow | null> {
  const result = await pool.query(
    `${catalogTrackSelectSql()}
     where t.workspace_id = $1 and t.id = $2::uuid
     limit 1`,
    [workspaceId, trackId]
  );
  const row = result.rows[0];
  return row === undefined ? null : toCatalogRowWithCursor(row).item;
}

function catalogTrackSelectSql(): string {
  return `select
       t.id::text,
       t.title,
       t.version_title,
       t.artist_name as catalog_artist,
       t.isrc,
       t.catalog_status,
       t.release_id::text,
       r.title as release_title,
       r.upc,
       r.release_date,
       coalesce(l.name, r.label_name) as label,
       import_artist.artist_import,
       effective_contributors.contributors_json,
       contributor_override.override_id,
       coalesce(t.legacy_id, 2147483647) as legacy_sort
     from tracks t
     left join releases r on r.id = t.release_id and r.workspace_id = t.workspace_id
     left join labels l on l.id = r.label_id
     left join lateral (
       select cco.id::text as override_id, cco.contributors_json
       from catalog_contributor_overrides cco
       where cco.workspace_id = t.workspace_id
         and cco.track_id = t.id
       order by cco.created_at desc, cco.id desc
       limit 1
     ) contributor_override on true
     left join lateral (
       select coalesce(
         jsonb_agg(jsonb_build_object('name', a.name, 'role', tc.role) order by a.name, tc.role),
         '[]'::jsonb
       ) as contributors_json
       from track_contributors tc
       join artists a on a.id = tc.artist_id
       where tc.track_id = t.id
     ) imported_contributors on true
     left join lateral (
       select ne.raw_artist as artist_import
       from earning_track_matches etm
       join normalized_earnings ne on ne.id = etm.earning_id and ne.workspace_id = t.workspace_id
       where etm.track_id = t.id
         and nullif(trim(ne.raw_artist), '') is not null
         and etm.status not in ('ignored', 'suspense')
       group by ne.raw_artist
       order by count(*) desc, ne.raw_artist
       limit 1
     ) import_artist on true
     left join lateral (
       select coalesce(
         contributor_override.contributors_json,
         imported_contributors.contributors_json,
         '[]'::jsonb
       ) as contributors_json
     ) effective_contributors on true`;
}

function catalogReviewPredicate(review: DistributionCatalogReviewFilter): string {
  if (review === "no_contributors") {
    return catalogNoContributorsSql();
  }

  if (review === "artist_mismatch") {
    return catalogArtistMismatchSql();
  }

  return `(contributor_override.override_id is null or ${catalogNoContributorsSql()} or ${catalogArtistMismatchSql()})`;
}

function catalogNoContributorsSql(): string {
  return "jsonb_array_length(effective_contributors.contributors_json) = 0";
}

function catalogArtistMismatchSql(): string {
  return `(nullif(trim(import_artist.artist_import), '') is not null
    and lower(trim(import_artist.artist_import)) <> lower(trim(t.artist_name))
    and not exists (
      select 1 from jsonb_array_elements(effective_contributors.contributors_json) contributor
      where lower(trim(coalesce(contributor->>'name', ''))) = lower(trim(import_artist.artist_import))
    ))`;
}

async function readCatalogFacets(
  pool: Pick<Pool, "query">,
  workspaceId: string
): Promise<DistributionCatalogWorkbenchResponse["facets"]> {
  const [labels, roles, releases] = await Promise.all([
    pool.query(
      `select coalesce(l.name, r.label_name) as value, count(t.id)::int as count
       from tracks t
       join releases r on r.id = t.release_id and r.workspace_id = t.workspace_id
       left join labels l on l.id = r.label_id
       where t.workspace_id = $1
         and nullif(trim(coalesce(l.name, r.label_name)), '') is not null
       group by coalesce(l.name, r.label_name)
       order by coalesce(l.name, r.label_name)`,
      [workspaceId]
    ),
    pool.query(
      `select contributor->>'role' as value, count(*)::int as count
       from tracks t
       left join lateral (
         select cco.contributors_json
         from catalog_contributor_overrides cco
         where cco.workspace_id = t.workspace_id and cco.track_id = t.id
         order by cco.created_at desc, cco.id desc
         limit 1
       ) contributor_override on true
       left join lateral (
         select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'role', tc.role)), '[]'::jsonb) as contributors_json
         from track_contributors tc
         join artists a on a.id = tc.artist_id
         where tc.track_id = t.id
       ) imported_contributors on true
       cross join lateral jsonb_array_elements(coalesce(contributor_override.contributors_json, imported_contributors.contributors_json, '[]'::jsonb)) contributor
       where t.workspace_id = $1
         and nullif(trim(contributor->>'role'), '') is not null
       group by contributor->>'role'
       order by contributor->>'role'`,
      [workspaceId]
    ),
    pool.query(
      `select id::text, title, artist_name
       from releases
       where workspace_id = $1
       order by title, artist_name, id`,
      [workspaceId]
    )
  ]);

  return {
    labels: labels.rows.map((row) => ({
      value: stringCell(row, "value"),
      label: stringCell(row, "value"),
      count: integerCell(row, "count")
    })),
    roles: roles.rows.map((row) => ({
      value: stringCell(row, "value"),
      label: humanizeCatalogRole(stringCell(row, "value")),
      count: integerCell(row, "count")
    })),
    releases: releases.rows.map((row) => ({
      id: stringCell(row, "id"),
      title: stringCell(row, "title"),
      artistName: stringCell(row, "artist_name")
    }))
  };
}

async function readCatalogSummary(
  pool: Pick<Pool, "query">,
  workspaceId: string
): Promise<DistributionCatalogWorkbenchResponse["summary"]> {
  const result = await pool.query(
    `select
       count(*)::int as track_count,
       count(*) filter (where contributor_override.override_id is null or ${catalogNoContributorsSql()} or ${catalogArtistMismatchSql()})::int as needs_review_count,
       count(*) filter (where ${catalogArtistMismatchSql()})::int as artist_mismatch_count,
       count(*) filter (where ${catalogNoContributorsSql()})::int as no_contributor_count
     from tracks t
     left join lateral (
       select cco.id::text as override_id, cco.contributors_json
       from catalog_contributor_overrides cco
       where cco.workspace_id = t.workspace_id and cco.track_id = t.id
       order by cco.created_at desc, cco.id desc
       limit 1
     ) contributor_override on true
     left join lateral (
       select coalesce(jsonb_agg(jsonb_build_object('name', a.name, 'role', tc.role)), '[]'::jsonb) as contributors_json
       from track_contributors tc
       join artists a on a.id = tc.artist_id
       where tc.track_id = t.id
     ) imported_contributors on true
     left join lateral (
       select ne.raw_artist as artist_import
       from earning_track_matches etm
       join normalized_earnings ne on ne.id = etm.earning_id and ne.workspace_id = t.workspace_id
       where etm.track_id = t.id
         and nullif(trim(ne.raw_artist), '') is not null
         and etm.status not in ('ignored', 'suspense')
       group by ne.raw_artist
       order by count(*) desc, ne.raw_artist
       limit 1
     ) import_artist on true
     left join lateral (
       select coalesce(contributor_override.contributors_json, imported_contributors.contributors_json, '[]'::jsonb) as contributors_json
     ) effective_contributors on true
     where t.workspace_id = $1`,
    [workspaceId]
  );
  const row = result.rows[0] ?? {};
  return {
    trackCount: integerCell(row, "track_count"),
    needsReviewCount: integerCell(row, "needs_review_count"),
    artistMismatchCount: integerCell(row, "artist_mismatch_count"),
    noContributorCount: integerCell(row, "no_contributor_count")
  };
}

function mappingStatusPredicate(status: DistributionMappingRow["status"]): string {
  if (status === "mapped") {
    return "ne.mapping_status = 'matched'";
  }

  if (status === "suggested") {
    return "ne.mapping_status in ('unmapped', 'unmatched', 'suspense') and track_match.track_id is not null";
  }

  return "ne.mapping_status in ('unmapped', 'unmatched', 'suspense') and track_match.track_id is null";
}

function toMappingRowWithCursor(row: PgRow): MappingRowWithCursor {
  const suggestedTrackId = nullableStringCell(row, "track_id");
  const sourceIsrc = nullableStringCell(row, "isrc");
  const sourceUpc = nullableStringCell(row, "upc");
  const mappingStatus = stringCell(row, "mapping_status");
  return {
    item: {
      id: stringCell(row, "id"),
      batchId: stringCell(row, "batch_id"),
      sourceTitle: nullableStringCell(row, "raw_title") ?? "",
      sourceArtist: nullableStringCell(row, "raw_artist") ?? "",
      sourceLabel: nullableStringCell(row, "raw_label") ?? "",
      sourceStore: stringCell(row, "dsp"),
      sourceIsrc,
      sourceUpc,
      grossMicro: stringCell(row, "gross_amount"),
      currency: stringCell(row, "currency"),
      suggestedTrackId,
      suggestedTrackTitle: nullableStringCell(row, "track_title"),
      confidenceBp: percentageToBasisPoints(nullableStringCell(row, "confidence") ?? "0"),
      status: mappingStatus === "matched" ? "mapped" : suggestedTrackId === null ? "unmapped" : "suggested",
      exactFixPath: suggestedTrackId !== null ? "mapping_rules" : sourceIsrc !== null || sourceUpc !== null ? "catalog" : "manual_track"
    },
    cursor: {
      legacySort: integerCell(row, "legacy_sort"),
      id: stringCell(row, "id")
    }
  };
}

function toCatalogRowWithCursor(row: PgRow): CatalogRowWithCursor {
  const contributors = contributorArrayCell(row, "contributors_json");
  const artistImport = nullableStringCell(row, "artist_import");
  const catalogArtist = stringCell(row, "catalog_artist");
  const overrideId = nullableStringCell(row, "override_id");
  return {
    item: {
      id: stringCell(row, "id"),
      title: stringCell(row, "title"),
      versionTitle: nullableStringCell(row, "version_title"),
      artistImport,
      catalogArtist,
      isrc: nullableStringCell(row, "isrc"),
      upc: nullableStringCell(row, "upc"),
      releaseId: nullableStringCell(row, "release_id"),
      releaseTitle: nullableStringCell(row, "release_title"),
      releaseDate: nullableDateStringCell(row, "release_date"),
      label: nullableStringCell(row, "label"),
      status: catalogStatusCell(row, "catalog_status"),
      contributors,
      contributorSource: overrideId === null ? "imported" : "override",
      reviewReason: catalogReviewReason(contributors, artistImport, catalogArtist, overrideId)
    },
    cursor: {
      legacySort: integerCell(row, "legacy_sort"),
      id: stringCell(row, "id")
    }
  };
}

function catalogReviewReason(
  contributors: readonly DistributionCatalogContributor[],
  artistImport: string | null,
  catalogArtist: string,
  overrideId: string | null
): DistributionCatalogTrackRow["reviewReason"] {
  if (contributors.length === 0) {
    return "no_contributors";
  }

  const normalizedImport = artistImport?.trim().toLocaleLowerCase() ?? "";
  const artistMatches = normalizedImport === "" || normalizedImport === catalogArtist.trim().toLocaleLowerCase() ||
    contributors.some((contributor) => contributor.name.trim().toLocaleLowerCase() === normalizedImport);
  if (!artistMatches) {
    return "artist_mismatch";
  }

  return overrideId === null ? "needs_review" : null;
}

function encodeMappingCursor(cursor: MappingCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeMappingCursor(value: string | null): MappingCursor | null {
  if (value === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "legacySort" in parsed &&
      Number.isSafeInteger(parsed.legacySort) &&
      "id" in parsed &&
      typeof parsed.id === "string" &&
      parsed.id !== ""
    ) {
      return { legacySort: parsed.legacySort as number, id: parsed.id };
    }
  } catch {
    // The API edge turns repository validation errors into a typed envelope.
  }

  throw new DistributionMappingCursorError();
}

function encodeCatalogCursor(cursor: CatalogCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCatalogCursor(value: string | null): CatalogCursor | null {
  if (value === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "legacySort" in parsed &&
      Number.isSafeInteger(parsed.legacySort) &&
      "id" in parsed &&
      typeof parsed.id === "string" &&
      parsed.id !== ""
    ) {
      return { legacySort: parsed.legacySort as number, id: parsed.id };
    }
  } catch {
    // The API edge turns repository validation errors into a typed envelope.
  }

  throw new DistributionCatalogCursorError();
}

function normalizeLimit(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Distribution page limit must be a positive integer.");
  }
  return Math.min(value, 100);
}

function stringCell(row: PgRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`Postgres column ${column} must be text.`);
  }
  return value;
}

function nullableStringCell(row: PgRow, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Postgres column ${column} must be nullable text.`);
  }
  return value;
}

function nullableDateStringCell(row: PgRow, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  throw new Error(`Postgres column ${column} must be a nullable date.`);
}

function integerCell(row: PgRow, column: string): number {
  const value = row[column];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Postgres column ${column} must be an integer.`);
  }
  return parsed;
}

function catalogStatusCell(row: PgRow, column: string): DistributionCatalogTrackRow["status"] {
  const value = stringCell(row, column);
  if (value === "draft" || value === "released" || value === "archived") {
    return value;
  }
  throw new Error(`Postgres column ${column} has an unsupported catalog status.`);
}

function contributorArrayCell(row: PgRow, column: string): readonly DistributionCatalogContributor[] {
  const raw = row[column];
  const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(value)) {
    throw new Error(`Postgres column ${column} must be a contributor array.`);
  }

  return value.map((entry: unknown): DistributionCatalogContributor => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("name" in entry) ||
      typeof entry.name !== "string" ||
      entry.name.trim() === "" ||
      !("role" in entry) ||
      typeof entry.role !== "string" ||
      entry.role.trim() === ""
    ) {
      throw new Error(`Postgres column ${column} contains an invalid contributor.`);
    }
    return { name: entry.name, role: entry.role };
  });
}

function humanizeCatalogRole(value: string): string {
  const words = value.replaceAll("_", " ");
  return words.length === 0 ? words : `${words.slice(0, 1).toLocaleUpperCase()}${words.slice(1)}`;
}

function percentageToBasisPoints(value: string): number {
  const [whole = "0", fraction = ""] = value.split(".");
  const scaled = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  const parsed = Number(scaled);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10000) {
    throw new Error(`Mapping confidence is outside the basis-point range: ${value}.`);
  }
  return parsed;
}
