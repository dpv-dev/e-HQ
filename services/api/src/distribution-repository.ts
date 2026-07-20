import type { Pool } from "pg";
import type { DistributionMappingRow, PageResult } from "@ehq/api-client";

type PgRow = Readonly<Record<string, unknown>>;

export interface DistributionMappingPageQuery {
  readonly workspaceId: string;
  readonly batchId: string | null;
  readonly status: DistributionMappingRow["status"] | null;
  readonly search: string | null;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface DistributionReadRuntime {
  readonly listMappingRows: (query: DistributionMappingPageQuery) => Promise<PageResult<DistributionMappingRow>>;
}

interface MappingCursor {
  readonly legacySort: number;
  readonly id: string;
}

interface MappingRowWithCursor {
  readonly item: DistributionMappingRow;
  readonly cursor: MappingCursor;
}

export class DistributionMappingCursorError extends Error {
  constructor() {
    super("Invalid Distribution mapping cursor.");
    this.name = "DistributionMappingCursorError";
  }
}

export function createPostgresDistributionReadRuntime(pool: Pick<Pool, "query">): DistributionReadRuntime {
  return {
    listMappingRows: async (query: DistributionMappingPageQuery): Promise<PageResult<DistributionMappingRow>> =>
      readDistributionMappingPage(pool, query)
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

function normalizeLimit(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Distribution mapping page limit must be a positive integer.");
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

function integerCell(row: PgRow, column: string): number {
  const value = row[column];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Postgres column ${column} must be an integer.`);
  }
  return parsed;
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
