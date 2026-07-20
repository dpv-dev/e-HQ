import type { Pool } from "pg";
import type {
  DistributionCatalogArtistSource,
  DistributionCatalogContributor,
  DistributionCatalogReviewFilter,
  DistributionCatalogTrackRow,
  DistributionCatalogWorkbenchResponse,
  DistributionContractCurrencyTotal,
  DistributionContractSplit,
  DistributionContractTrackRow,
  DistributionContractTrackStatus,
  DistributionContractWorkbenchResponse,
  DistributionContractWorkflowFilter,
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

export interface DistributionContractPageQuery {
  readonly workspaceId: string;
  readonly search: string | null;
  readonly status: DistributionContractTrackStatus | null;
  readonly workflow: DistributionContractWorkflowFilter | null;
  readonly cursor: string | null;
  readonly limit: number;
}

export interface DistributionReadRuntime {
  readonly listMappingRows: (query: DistributionMappingPageQuery) => Promise<PageResult<DistributionMappingRow>>;
  readonly listCatalogTracks: (query: DistributionCatalogPageQuery) => Promise<DistributionCatalogWorkbenchResponse>;
  readonly getCatalogTrack: (workspaceId: string, trackId: string) => Promise<DistributionCatalogTrackRow | null>;
  readonly listContractTracks: (query: DistributionContractPageQuery) => Promise<DistributionContractWorkbenchResponse>;
  readonly getContractTrack: (workspaceId: string, trackId: string) => Promise<DistributionContractTrackRow | null>;
  readonly validateContractPayees: (workspaceId: string, payeeIds: readonly string[]) => Promise<boolean>;
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

interface ContractCursor {
  readonly legacySort: number;
  readonly id: string;
}

interface ContractRowWithCursor {
  readonly item: DistributionContractTrackRow;
  readonly cursor: ContractCursor;
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

export class DistributionContractCursorError extends Error {
  constructor() {
    super("Invalid Distribution contract cursor.");
    this.name = "DistributionContractCursorError";
  }
}

export function createPostgresDistributionReadRuntime(pool: Pick<Pool, "query">): DistributionReadRuntime {
  return {
    listMappingRows: async (query: DistributionMappingPageQuery): Promise<PageResult<DistributionMappingRow>> =>
      readDistributionMappingPage(pool, query),
    listCatalogTracks: async (query: DistributionCatalogPageQuery): Promise<DistributionCatalogWorkbenchResponse> =>
      readDistributionCatalogPage(pool, query),
    getCatalogTrack: async (workspaceId: string, trackId: string): Promise<DistributionCatalogTrackRow | null> =>
      readDistributionCatalogTrack(pool, workspaceId, trackId),
    listContractTracks: async (query: DistributionContractPageQuery): Promise<DistributionContractWorkbenchResponse> =>
      readDistributionContractPage(pool, query),
    getContractTrack: async (workspaceId: string, trackId: string): Promise<DistributionContractTrackRow | null> =>
      readDistributionContractTrack(pool, workspaceId, trackId),
    validateContractPayees: async (workspaceId: string, payeeIds: readonly string[]): Promise<boolean> =>
      validateDistributionContractPayees(pool, workspaceId, payeeIds)
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

export async function readDistributionContractPage(
  pool: Pick<Pool, "query">,
  query: DistributionContractPageQuery
): Promise<DistributionContractWorkbenchResponse> {
  const limit = normalizeLimit(query.limit);
  const cursor = decodeContractCursor(query.cursor);
  const parameters: unknown[] = [query.workspaceId];
  const where: string[] = ["workspace_id = $1"];

  const search = query.search?.trim() ?? "";
  if (search !== "") {
    parameters.push(search.toLocaleLowerCase());
    const parameter = `$${String(parameters.length)}`;
    where.push(`(
      strpos(lower(title), ${parameter}) > 0
      or strpos(lower(coalesce(version_title, '')), ${parameter}) > 0
      or strpos(lower(coalesce(release_title, '')), ${parameter}) > 0
      or strpos(lower(coalesce(artist_import, '')), ${parameter}) > 0
      or strpos(lower(catalog_artist), ${parameter}) > 0
      or strpos(lower(coalesce(isrc, '')), ${parameter}) > 0
      or strpos(lower(coalesce(label, '')), ${parameter}) > 0
      or exists (
        select 1 from jsonb_array_elements(splits_json) split
        where strpos(lower(coalesce(split->>'payeeName', '')), ${parameter}) > 0
      )
    )`);
  }

  if (query.status !== null) {
    parameters.push(query.status);
    where.push(`split_status = $${String(parameters.length)}`);
  }

  if (query.workflow === "all_splits") {
    where.push("jsonb_array_length(splits_json) > 0");
  } else if (query.workflow === "needs_attention") {
    where.push("split_status <> 'active'");
  } else if (query.workflow === "ready") {
    where.push("split_status = 'active'");
  } else if (query.workflow === "with_expenses") {
    where.push("expense_count > 0");
  }

  if (cursor !== null) {
    parameters.push(cursor.legacySort, cursor.id);
    const legacyParameter = `$${String(parameters.length - 1)}`;
    const idParameter = `$${String(parameters.length)}`;
    where.push(`(
      legacy_sort > ${legacyParameter}
      or (legacy_sort = ${legacyParameter} and track_id > ${idParameter})
    )`);
  }

  parameters.push(limit + 1);
  const result = await pool.query(
    `${contractTrackSelectSql()}
     where ${where.join("\n       and ")}
     order by legacy_sort, track_id
     limit $${String(parameters.length)}`,
    parameters
  );
  const mappedRows = result.rows.map(toContractRowWithCursor);
  const hasMore = mappedRows.length > limit;
  const pageRows = mappedRows.slice(0, limit);
  const last = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map((row) => row.item),
    nextCursor: hasMore && last !== undefined ? encodeContractCursor(last.cursor) : null,
    summary: await readContractSummary(pool, query.workspaceId)
  };
}

export async function readDistributionContractTrack(
  pool: Pick<Pool, "query">,
  workspaceId: string,
  trackId: string
): Promise<DistributionContractTrackRow | null> {
  const result = await pool.query(
    `${contractTrackSelectSql()}
     where workspace_id = $1 and track_id = $2
     limit 1`,
    [workspaceId, trackId]
  );
  const row = result.rows[0];
  return row === undefined ? null : toContractRowWithCursor(row).item;
}

export async function validateDistributionContractPayees(
  pool: Pick<Pool, "query">,
  workspaceId: string,
  payeeIds: readonly string[]
): Promise<boolean> {
  if (payeeIds.length === 0) {
    return false;
  }
  const result = await pool.query(
    `select count(*)::int as payee_count
     from payees
     where workspace_id = $1 and id::text = any($2::text[]) and is_active = true`,
    [workspaceId, payeeIds]
  );
  return integerCell(result.rows[0] ?? {}, "payee_count") === new Set(payeeIds).size;
}

function contractTrackSelectSql(): string {
  return `with import_artist_ranked as (
    select
      etm.track_id,
      ne.workspace_id,
      ne.raw_artist as artist_import,
      row_number() over (
        partition by etm.track_id
        order by count(*) desc, ne.raw_artist
      ) as artist_rank
    from earning_track_matches etm
    join normalized_earnings ne on ne.id = etm.earning_id
    where ne.workspace_id = $1
      and nullif(trim(ne.raw_artist), '') is not null
      and etm.status not in ('ignored', 'suspense')
    group by etm.track_id, ne.workspace_id, ne.raw_artist
  ), contract_tracks as (
    select
      t.id::text as track_id,
      t.workspace_id,
      t.title,
      t.version_title,
      r.title as release_title,
      t.artist_name as catalog_artist,
      t.isrc,
      coalesce(l.name, r.label_name) as label,
      import_artist.artist_import,
      coalesce(t.legacy_id, 2147483647) as legacy_sort,
      rule_override.override_id,
      rule_override.base_contract_id,
      rule_override.contract_title as override_contract_title,
      rule_override.splits_json as override_splits_json,
      rule_override.total_percentage as override_total_percentage,
      direct_rules.contract_count as direct_contract_count,
      direct_rules.contract_id as direct_contract_id,
      direct_rules.contract_ids as direct_contract_ids,
      direct_rules.contract_title as direct_contract_title,
      direct_rules.rule_count as direct_rule_count,
      direct_rules.total_percentage as direct_total_percentage,
      direct_rules.splits_json as direct_splits_json,
      release_rules.contract_count as release_contract_count,
      release_rules.contract_id as release_contract_id,
      release_rules.contract_ids as release_contract_ids,
      release_rules.contract_title as release_contract_title,
      release_rules.rule_count as release_rule_count,
      release_rules.total_percentage as release_total_percentage,
      release_rules.splits_json as release_splits_json
    from tracks t
    left join releases r on r.id = t.release_id and r.workspace_id = t.workspace_id
    left join labels l on l.id = r.label_id
    left join import_artist_ranked import_artist on import_artist.track_id = t.id
      and import_artist.workspace_id = t.workspace_id
      and import_artist.artist_rank = 1
    left join lateral (
      select
        cro.id::text as override_id,
        cro.base_contract_id::text,
        c.title as contract_title,
        coalesce(jsonb_agg(jsonb_build_object(
          'payeeId', split.value->>'payeeId',
          'payeeName', p.name,
          'percentage', split.value->>'percentage',
          'role', 'royalty'
        ) order by split.ordinality), '[]'::jsonb) as splits_json,
        coalesce(sum((split.value->>'percentage')::numeric), 0)::text as total_percentage
      from contract_rule_set_overrides cro
      join contracts c on c.id = cro.base_contract_id and c.workspace_id = cro.workspace_id
      cross join lateral jsonb_array_elements(cro.rules_json) with ordinality split(value, ordinality)
      join payees p on p.id::text = split.value->>'payeeId' and p.workspace_id = cro.workspace_id
      where cro.workspace_id = t.workspace_id and cro.track_id = t.id
      group by cro.id, cro.base_contract_id, c.title, cro.created_at
      order by cro.created_at desc, cro.id desc
      limit 1
    ) rule_override on true
    left join lateral (
      select
        count(distinct c.id)::int as contract_count,
        min(c.id::text) as contract_id,
        coalesce(jsonb_agg(distinct c.id::text), '[]'::jsonb) as contract_ids,
        min(c.title) as contract_title,
        count(rr.id)::int as rule_count,
        coalesce(sum(rr.percentage), 0)::text as total_percentage,
        coalesce(jsonb_agg(jsonb_build_object(
          'payeeId', rr.payee_id::text,
          'payeeName', p.name,
          'percentage', rr.percentage::text,
          'role', coalesce(rr.scope_type, 'royalty')
        ) order by rr.priority desc, p.name, rr.id), '[]'::jsonb) as splits_json
      from royalty_rules rr
      join contracts c on c.id = rr.contract_id and c.workspace_id = t.workspace_id and c.status = 'active'
      join payees p on p.id = rr.payee_id and p.workspace_id = t.workspace_id
      where rr.scope_type = 'track'
        and (rr.scope_id = t.id::text or rr.scope_id = t.legacy_id::text)
        and rr.status = 'active'
    ) direct_rules on true
    left join lateral (
      select
        count(distinct c.id)::int as contract_count,
        min(c.id::text) as contract_id,
        coalesce(jsonb_agg(distinct c.id::text), '[]'::jsonb) as contract_ids,
        min(c.title) as contract_title,
        count(rr.id)::int as rule_count,
        coalesce(sum(rr.percentage), 0)::text as total_percentage,
        coalesce(jsonb_agg(jsonb_build_object(
          'payeeId', rr.payee_id::text,
          'payeeName', p.name,
          'percentage', rr.percentage::text,
          'role', coalesce(rr.scope_type, 'royalty')
        ) order by rr.priority desc, p.name, rr.id), '[]'::jsonb) as splits_json
      from royalty_rules rr
      join contracts c on c.id = rr.contract_id and c.workspace_id = t.workspace_id and c.status = 'active'
      join payees p on p.id = rr.payee_id and p.workspace_id = t.workspace_id
      where rr.scope_type = 'release'
        and (rr.scope_id = t.release_id::text or rr.scope_id = r.legacy_id::text)
        and rr.status = 'active'
    ) release_rules on true
  ), effective_contracts as (
    select
      contract_tracks.*,
      case
        when override_id is not null and override_total_percentage::numeric = 100 then 'active'
        when override_id is not null then 'ambiguous'
        when direct_rule_count > 0 and direct_contract_count = 1 and direct_total_percentage::numeric = 100 then 'active'
        when direct_rule_count > 0 then 'ambiguous'
        when release_rule_count > 0 and release_contract_count = 1 and release_total_percentage::numeric = 100 then 'active'
        when release_rule_count > 0 then 'ambiguous'
        else 'no_split'
      end as split_status,
      case when override_id is not null then base_contract_id when direct_rule_count > 0 then direct_contract_id when release_rule_count > 0 then release_contract_id else null end as contract_id,
      case when override_id is not null then jsonb_build_array(base_contract_id) when direct_rule_count > 0 then direct_contract_ids when release_rule_count > 0 then release_contract_ids else '[]'::jsonb end as contract_ids,
      case when override_id is not null then override_contract_title when direct_rule_count > 0 then direct_contract_title when release_rule_count > 0 then release_contract_title else null end as contract_title,
      case when override_id is not null then 'override' when direct_rule_count > 0 then 'track' when release_rule_count > 0 then 'release' else null end as split_source,
      case when override_id is not null then override_splits_json when direct_rule_count > 0 then direct_splits_json when release_rule_count > 0 then release_splits_json else '[]'::jsonb end as splits_json,
      case when override_id is not null then override_total_percentage when direct_rule_count > 0 then direct_total_percentage when release_rule_count > 0 then release_total_percentage else '0' end as split_total_percentage
    from contract_tracks
  ), contract_rows as (
    select
      effective_contracts.*,
      coalesce(expenses.expense_count, 0)::int as expense_count,
      coalesce(expenses.open_totals, '[]'::jsonb) as open_expense_totals
    from effective_contracts
    left join lateral (
      select
        (select count(*)::int
         from contract_cost_terms cct
         where cct.contract_id::text = effective_contracts.contract_id and cct.status <> 'deleted') as expense_count,
        (select coalesce(jsonb_agg(jsonb_build_object(
           'currency', totals.currency,
           'amountMicro', totals.open_amount
         ) order by totals.currency), '[]'::jsonb)
         from (
           select
             cct.currency,
             sum(greatest(cct.amount - coalesce(applications.applied_amount, 0), 0))::text as open_amount
           from contract_cost_terms cct
           left join lateral (
             select coalesce(sum(ea.amount_applied), 0) as applied_amount
             from expense_applications ea
             where ea.cost_term_id = cct.id
           ) applications on true
           where cct.contract_id::text = effective_contracts.contract_id
             and cct.recoupable = true
             and cct.status not in ('recovered', 'satisfied', 'cancelled', 'deleted')
           group by cct.currency
           having sum(greatest(cct.amount - coalesce(applications.applied_amount, 0), 0)) > 0
         ) totals) as open_totals
    ) expenses on true
  )
  select * from contract_rows`;
}

async function readContractSummary(
  pool: Pick<Pool, "query">,
  workspaceId: string
): Promise<DistributionContractWorkbenchResponse["summary"]> {
  const [trackCounts, contractCounts, unallocatedRows, recoupmentTotals] = await Promise.all([
    pool.query(
      `with latest_overrides as (
         select distinct on (workspace_id, track_id)
           workspace_id, track_id, rules_json
         from contract_rule_set_overrides
         where workspace_id = $1
         order by workspace_id, track_id, created_at desc, id desc
       ), override_stats as (
         select
           override.track_id,
           jsonb_array_length(override.rules_json)::int as rule_count,
           coalesce(sum((split.value->>'percentage')::numeric), 0) as total_percentage
         from latest_overrides override
         cross join lateral jsonb_array_elements(override.rules_json) split(value)
         group by override.track_id, override.rules_json
       ), direct_stats as (
         select
           t.id as track_id,
           count(distinct c.id)::int as contract_count,
           count(rr.id)::int as rule_count,
           coalesce(sum(rr.percentage), 0) as total_percentage
         from tracks t
         join royalty_rules rr on rr.scope_type = 'track'
           and (rr.scope_id = t.id::text or rr.scope_id = t.legacy_id::text)
           and rr.status = 'active'
         join contracts c on c.id = rr.contract_id
           and c.workspace_id = t.workspace_id
           and c.status = 'active'
         where t.workspace_id = $1
         group by t.id
       ), release_stats as (
         select
           r.id as release_id,
           count(distinct c.id)::int as contract_count,
           count(rr.id)::int as rule_count,
           coalesce(sum(rr.percentage), 0) as total_percentage
         from releases r
         join royalty_rules rr on rr.scope_type = 'release'
           and (rr.scope_id = r.id::text or rr.scope_id = r.legacy_id::text)
           and rr.status = 'active'
         join contracts c on c.id = rr.contract_id
           and c.workspace_id = r.workspace_id
           and c.status = 'active'
         where r.workspace_id = $1
         group by r.id
       ), effective_stats as (
         select
           t.id as track_id,
           case
             when override.track_id is not null and override.total_percentage = 100 then 'active'
             when override.track_id is not null then 'ambiguous'
             when direct.rule_count > 0 and direct.contract_count = 1 and direct.total_percentage = 100 then 'active'
             when direct.rule_count > 0 then 'ambiguous'
             when release.rule_count > 0 and release.contract_count = 1 and release.total_percentage = 100 then 'active'
             when release.rule_count > 0 then 'ambiguous'
             else 'no_split'
           end as split_status,
           case
             when override.track_id is not null then 'override'
             when direct.rule_count > 0 then 'track'
             when release.rule_count > 0 then 'release'
             else null
           end as split_source,
           case
             when override.track_id is not null then override.rule_count
             else coalesce(direct.rule_count, 0)
           end as effective_direct_rule_count
         from tracks t
         left join override_stats override on override.track_id = t.id
         left join direct_stats direct on direct.track_id = t.id
         left join release_stats release on release.release_id = t.release_id
         where t.workspace_id = $1
       )
       select
         count(*) filter (where split_source in ('track', 'override'))::int as active_track_only_count,
         count(*) filter (where split_source is not null)::int as active_effective_count,
         count(*) filter (where split_status = 'no_split')::int as no_effective_split_count,
         count(*) filter (where split_status = 'ambiguous')::int as ambiguous_count,
         coalesce(sum(effective_direct_rule_count), 0)::int as direct_track_rule_count
       from effective_stats`,
      [workspaceId]
    ),
    pool.query(
      `select
         count(*) filter (where status in ('expired', 'terminated', 'archived'))::int as expired_count,
         count(*) filter (where status = 'draft')::int as draft_count
       from contracts where workspace_id = $1`,
      [workspaceId]
    ),
    pool.query(
      `select count(ne.id)::int as row_count
       from normalized_earnings ne
       where ne.workspace_id = $1
         and ne.mapping_status = 'matched'
         and ne.calculation_status = 'pending'
         and not exists (select 1 from earning_allocations ea where ea.earning_id = ne.id)`,
      [workspaceId]
    ),
    pool.query(
      `select cct.currency,
         sum(greatest(cct.amount - coalesce(applications.applied_amount, 0), 0))::text as amount_micro
       from contract_cost_terms cct
       join contracts c on c.id = cct.contract_id and c.workspace_id = $1
       left join lateral (
         select coalesce(sum(ea.amount_applied), 0) as applied_amount
         from expense_applications ea where ea.cost_term_id = cct.id
       ) applications on true
       where cct.recoupable = true and cct.status not in ('recovered', 'satisfied', 'cancelled', 'deleted')
       group by cct.currency
       having sum(greatest(cct.amount - coalesce(applications.applied_amount, 0), 0)) >= 0.01
       order by cct.currency`,
      [workspaceId]
    )
  ]);
  const trackRow = trackCounts.rows[0] ?? {};
  const contractRow = contractCounts.rows[0] ?? {};
  const unallocatedRow = unallocatedRows.rows[0] ?? {};
  return {
    activeTrackOnlyCount: integerCell(trackRow, "active_track_only_count"),
    activeEffectiveCount: integerCell(trackRow, "active_effective_count"),
    expiredContractCount: integerCell(contractRow, "expired_count"),
    draftContractCount: integerCell(contractRow, "draft_count"),
    directTrackRuleCount: integerCell(trackRow, "direct_track_rule_count"),
    noEffectiveSplitCount: integerCell(trackRow, "no_effective_split_count"),
    ambiguousCount: integerCell(trackRow, "ambiguous_count"),
    unallocatedRowCount: integerCell(unallocatedRow, "row_count"),
    openRecoupmentTotals: recoupmentTotals.rows.map((row) => ({
      currency: stringCell(row, "currency"),
      amountMicro: stringCell(row, "amount_micro")
    }))
  };
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

function toContractRowWithCursor(row: PgRow): ContractRowWithCursor {
  return {
    item: {
      trackId: stringCell(row, "track_id"),
      title: stringCell(row, "title"),
      versionTitle: nullableStringCell(row, "version_title"),
      releaseTitle: nullableStringCell(row, "release_title"),
      artistImport: nullableStringCell(row, "artist_import"),
      catalogArtist: stringCell(row, "catalog_artist"),
      isrc: nullableStringCell(row, "isrc"),
      label: nullableStringCell(row, "label"),
      status: contractTrackStatusCell(row, "split_status"),
      contractId: nullableStringCell(row, "contract_id"),
      contractIds: stringArrayCell(row, "contract_ids"),
      contractTitle: nullableStringCell(row, "contract_title"),
      splitSource: contractSplitSourceCell(row, "split_source"),
      splits: contractSplitArrayCell(row, "splits_json"),
      splitTotalPercentage: stringCell(row, "split_total_percentage"),
      expenseCount: integerCell(row, "expense_count"),
      openExpenseTotals: contractCurrencyTotalArrayCell(row, "open_expense_totals")
    },
    cursor: {
      legacySort: integerCell(row, "legacy_sort"),
      id: stringCell(row, "track_id")
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

function encodeContractCursor(cursor: ContractCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeContractCursor(value: string | null): ContractCursor | null {
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

  throw new DistributionContractCursorError();
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

function jsonArrayCell(row: PgRow, column: string): readonly unknown[] {
  const raw = row[column];
  const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(value)) {
    throw new Error(`Postgres column ${column} must be a JSON array.`);
  }
  return value;
}

function stringArrayCell(row: PgRow, column: string): readonly string[] {
  return jsonArrayCell(row, column).map((value) => {
    if (typeof value !== "string") {
      throw new Error(`Postgres column ${column} must contain only strings.`);
    }
    return value;
  });
}

function contractSplitArrayCell(row: PgRow, column: string): readonly DistributionContractSplit[] {
  return jsonArrayCell(row, column).map((value) => {
    if (
      typeof value !== "object" || value === null ||
      !("payeeId" in value) || typeof value.payeeId !== "string" ||
      !("payeeName" in value) || typeof value.payeeName !== "string" ||
      !("percentage" in value) || typeof value.percentage !== "string" ||
      !("role" in value) || typeof value.role !== "string"
    ) {
      throw new Error(`Postgres column ${column} contains an invalid contract split.`);
    }
    return {
      payeeId: value.payeeId,
      payeeName: value.payeeName,
      percentage: value.percentage,
      role: value.role
    };
  });
}

function contractCurrencyTotalArrayCell(row: PgRow, column: string): readonly DistributionContractCurrencyTotal[] {
  return jsonArrayCell(row, column).map((value) => {
    if (
      typeof value !== "object" || value === null ||
      !("currency" in value) || typeof value.currency !== "string" ||
      !("amountMicro" in value) || typeof value.amountMicro !== "string"
    ) {
      throw new Error(`Postgres column ${column} contains an invalid currency total.`);
    }
    return { currency: value.currency, amountMicro: value.amountMicro };
  });
}

function contractTrackStatusCell(row: PgRow, column: string): DistributionContractTrackStatus {
  const value = stringCell(row, column);
  if (value === "active" || value === "no_split" || value === "ambiguous") {
    return value;
  }
  throw new Error(`Postgres column ${column} has an unsupported contract track status.`);
}

function contractSplitSourceCell(row: PgRow, column: string): DistributionContractTrackRow["splitSource"] {
  const value = nullableStringCell(row, column);
  if (value === null || value === "override" || value === "track" || value === "release") {
    return value;
  }
  throw new Error(`Postgres column ${column} has an unsupported contract split source.`);
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
