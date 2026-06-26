export type DistributionRawImportRowsMode = "migrate" | "archive";

export type DistributionErhScalarKind =
  | "amount10"
  | "boolean"
  | "date"
  | "datetime"
  | "fxRate10"
  | "integer"
  | "jsonArray"
  | "jsonObject"
  | "percentage2"
  | "percentage6"
  | "quantity6"
  | "text";

export interface DistributionErhColumnSpec {
  readonly target: string;
  readonly aliases: readonly string[];
  readonly kind: DistributionErhScalarKind;
  readonly required: boolean;
  readonly defaultValue: string | boolean | null;
}

export interface DistributionErhTableSpec {
  readonly targetTable: DistributionErhTableName;
  readonly sourceTable: string;
  readonly columns: readonly DistributionErhColumnSpec[];
  readonly auditExcluded: boolean;
  readonly rawImportRowsDecision: boolean;
  readonly identityLinkMustBeEmpty: boolean;
}

export type DistributionErhTableName =
  | "artists"
  | "audit_logs"
  | "calculation_runs"
  | "catalog_aliases"
  | "contract_cost_terms"
  | "contract_extractions"
  | "contract_scopes"
  | "contracts"
  | "earning_allocations"
  | "earning_track_matches"
  | "expense_applications"
  | "fx_rates"
  | "identity_link"
  | "import_batches"
  | "import_issues"
  | "labels"
  | "mapping_rules"
  | "mapping_stats_by_batch"
  | "normalized_earnings"
  | "payee_balances"
  | "payees"
  | "payments"
  | "raw_import_rows"
  | "releases"
  | "royalty_rules"
  | "statement_lines"
  | "statement_payment_links"
  | "statements"
  | "suspense_items"
  | "track_contributors"
  | "tracks";

export const distributionErhMigratedTableNames: readonly DistributionErhTableName[] = [
  "import_batches",
  "raw_import_rows",
  "normalized_earnings",
  "mapping_stats_by_batch",
  "import_issues",
  "payees",
  "contracts",
  "artists",
  "labels",
  "releases",
  "tracks",
  "track_contributors",
  "identity_link",
  "contract_scopes",
  "contract_cost_terms",
  "contract_extractions",
  "royalty_rules",
  "earning_track_matches",
  "mapping_rules",
  "catalog_aliases",
  "calculation_runs",
  "earning_allocations",
  "suspense_items",
  "statements",
  "payee_balances",
  "statement_lines",
  "payments",
  "statement_payment_links",
  "expense_applications",
  "fx_rates"
];

export const distributionErhExcludedTableNames: readonly DistributionErhTableName[] = ["audit_logs"];

export function buildDistributionErhTableSpecs(tablePrefix: string): readonly DistributionErhTableSpec[] {
  const specByTarget: Record<DistributionErhTableName, DistributionErhTableSpec> = {
    import_batches: table("import_batches", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("source", ["source", "distributor"], "text", true, null),
      col("file_name", ["file_name", "filename", "source_filename"], "text", true, null),
      col("status", ["status"], "text", true, "draft"),
      col("imported_at", ["imported_at"], "datetime", false, null),
      col("metadata", ["metadata"], "jsonObject", false, null),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    raw_import_rows: table("raw_import_rows", tablePrefix, false, true, false, [
      col("id", ["id"], "text", true, null),
      col("batch_id", ["batch_id"], "text", true, null),
      col("row_number", ["row_number"], "integer", true, null),
      col("raw_data", ["raw_data", "raw_json"], "jsonObject", true, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    normalized_earnings: table("normalized_earnings", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("batch_id", ["batch_id"], "text", true, null),
      col("raw_import_row_id", ["raw_import_row_id", "raw_row_id"], "text", true, null),
      col("dsp", ["dsp"], "text", false, null),
      col("gross_amount", ["gross_amount"], "amount10", true, null),
      col("quantity", ["quantity"], "quantity6", true, null),
      col("currency", ["currency"], "text", true, null),
      col("isrc", ["isrc"], "text", false, null),
      col("upc", ["upc"], "text", false, null),
      col("raw_title", ["raw_title", "title", "track_title_raw"], "text", false, null),
      col("raw_artist", ["raw_artist", "artist", "artist_name_raw"], "text", false, null),
      col("raw_label", ["raw_label", "label"], "text", false, null),
      col("mapping_status", ["mapping_status"], "text", true, "unmapped"),
      col("calculation_status", ["calculation_status"], "text", true, "pending"),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    mapping_stats_by_batch: table("mapping_stats_by_batch", tablePrefix, false, false, false, [
      col("id", ["id", "batch_id"], "text", true, null),
      col("batch_id", ["batch_id"], "text", true, null),
      col("total_rows", ["total_rows"], "integer", true, "0"),
      col("matched_rows", ["matched_rows", "mapped_rows"], "integer", true, "0"),
      col("suspense_rows", ["suspense_rows"], "integer", true, "0"),
      col("ignored_rows", ["ignored_rows"], "integer", true, "0"),
      col("created_at", ["created_at", "last_updated_at"], "datetime", true, null),
      col("updated_at", ["updated_at", "last_updated_at"], "datetime", true, null)
    ]),
    import_issues: table("import_issues", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("batch_id", ["batch_id"], "text", true, null),
      col("raw_import_row_id", ["raw_import_row_id"], "text", false, null),
      col("severity", ["severity"], "text", true, null),
      col("code", ["code", "issue_code"], "text", true, null),
      col("message", ["message"], "text", true, null),
      col("metadata", ["metadata"], "jsonObject", false, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    payees: table("payees", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("name", ["name", "display_name"], "text", true, null),
      col("linked_artist_ids", ["linked_artist_ids"], "jsonArray", false, null),
      col("preferred_currency", ["preferred_currency"], "text", false, null),
      col("payment_method", ["payment_method"], "text", false, null),
      col("tax_info", ["tax_info"], "jsonObject", false, null),
      col("is_active", ["is_active", "active"], "boolean", false, null),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    contracts: table("contracts", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("contract_number", ["contract_number"], "text", false, null),
      col("title", ["title", "name", "contract_name"], "text", true, null),
      col("status", ["status"], "text", true, "draft"),
      col("effective_from", ["effective_from", "start_date"], "date", true, null),
      col("effective_to", ["effective_to", "end_date"], "date", false, null),
      col("signed_at", ["signed_at"], "datetime", false, null),
      col("metadata", ["metadata"], "jsonObject", false, null),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    artists: table("artists", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("name", ["name", "display_name"], "text", true, null),
      col("aliases", ["aliases"], "jsonArray", false, null),
      col("default_payee_id", ["default_payee_id"], "text", false, null),
      col("default_split_contract_id", ["default_split_contract_id"], "text", false, null),
      col("is_active", ["is_active", "active"], "boolean", false, null),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    labels: table("labels", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("name", ["name"], "text", true, null),
      col("default_split_pct", ["default_split_pct"], "percentage2", false, null),
      col("payee_id", ["payee_id"], "text", false, null),
      col("is_active", ["is_active", "active"], "boolean", false, null),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    releases: table("releases", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("title", ["title", "name"], "text", true, null),
      col("upc", ["upc"], "text", false, null),
      col("label_id", ["label_id"], "text", false, null),
      col("label_name", ["label_name"], "text", false, null),
      col("release_date", ["release_date"], "date", false, null),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    tracks: table("tracks", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("title", ["title", "name"], "text", true, null),
      col("isrc", ["isrc"], "text", false, null),
      col("release_id", ["release_id"], "text", false, null),
      col("version_title", ["version_title"], "text", false, null),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    track_contributors: table("track_contributors", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("track_id", ["track_id"], "text", true, null),
      col("artist_id", ["artist_id"], "text", true, null),
      col("role", ["role"], "text", true, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    identity_link: table("identity_link", tablePrefix, false, false, true, [
      col("id", ["id"], "text", true, null),
      col("payee_id", ["payee_id"], "text", true, null),
      col("office_partner_id", ["office_partner_id"], "text", true, null),
      col("confidence", ["confidence"], "percentage6", true, null),
      col("status", ["status"], "text", true, "pending"),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", true, null)
    ]),
    contract_scopes: table("contract_scopes", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("contract_id", ["contract_id"], "text", true, null),
      col("scope_type", ["scope_type"], "text", true, null),
      col("scope_id", ["scope_id"], "text", false, null),
      col("territory", ["territory"], "text", false, null),
      col("dsp", ["dsp"], "text", false, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    contract_cost_terms: table("contract_cost_terms", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("contract_id", ["contract_id"], "text", true, null),
      col("payee_id", ["payee_id"], "text", false, null),
      col("amount", ["amount"], "amount10", true, null),
      col("currency", ["currency"], "text", true, null),
      col("recoupable", ["recoupable"], "boolean", true, "1"),
      col("recovery_method", ["recovery_method"], "text", true, "gross"),
      col("recovery_param", ["recovery_param"], "percentage6", false, null),
      col("status", ["status"], "text", true, "draft"),
      col("scope_type", ["scope_type"], "text", false, null),
      col("scope_id", ["scope_id"], "text", false, null),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    contract_extractions: table("contract_extractions", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("contract_id", ["contract_id"], "text", false, null),
      col("raw_text", ["raw_text"], "text", true, null),
      col("extracted_json", ["extracted_json"], "jsonObject", true, "{}"),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    royalty_rules: table("royalty_rules", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("contract_id", ["contract_id"], "text", true, null),
      col("payee_id", ["payee_id"], "text", true, null),
      col("percentage", ["percentage"], "percentage6", true, null),
      col("scope_type", ["scope_type"], "text", false, null),
      col("scope_id", ["scope_id"], "text", false, null),
      col("priority", ["priority"], "integer", true, "0"),
      col("effective_from", ["effective_from"], "date", true, null),
      col("effective_to", ["effective_to"], "date", false, null),
      col("recoupable", ["recoupable"], "boolean", true, "1"),
      col("status", ["status"], "text", true, "draft"),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    earning_track_matches: table("earning_track_matches", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("earning_id", ["earning_id", "normalized_earning_id"], "text", true, null),
      col("track_id", ["track_id"], "text", true, null),
      col("confidence", ["confidence"], "percentage6", true, null),
      col("status", ["status"], "text", false, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    mapping_rules: table("mapping_rules", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("name", ["name", "identifier_value"], "text", true, null),
      col("source", ["source", "method"], "text", true, null),
      col("conditions_json", ["conditions_json"], "jsonObject", false, null),
      col("target_track_id", ["target_track_id", "track_id"], "text", false, null),
      col("is_active", ["is_active", "active"], "boolean", false, null),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    catalog_aliases: table("catalog_aliases", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("alias_text", ["alias_text", "raw_value"], "text", true, null),
      col("artist_id", ["artist_id"], "text", false, null),
      col("payee_id", ["payee_id"], "text", false, null),
      col("label_id", ["label_id"], "text", false, null),
      col("release_id", ["release_id"], "text", false, null),
      col("track_id", ["track_id"], "text", false, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    calculation_runs: table("calculation_runs", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("batch_id", ["batch_id"], "text", false, null),
      col("status", ["status"], "text", true, "pending"),
      col("reconciliation_json", ["reconciliation_json"], "jsonObject", false, null),
      col("started_at", ["started_at"], "datetime", false, null),
      col("finished_at", ["finished_at", "completed_at"], "datetime", false, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    earning_allocations: table("earning_allocations", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("earning_id", ["earning_id", "normalized_earning_id"], "text", true, null),
      col("calculation_run_id", ["calculation_run_id"], "text", true, null),
      col("payee_id", ["payee_id"], "text", true, null),
      col("contract_id", ["contract_id"], "text", true, null),
      col("track_id", ["track_id"], "text", true, null),
      col("gross_amount", ["gross_amount"], "amount10", true, null),
      col("original_gross_amount", ["original_gross_amount"], "amount10", false, null),
      col("fx_rate", ["fx_rate"], "fxRate10", false, null),
      col("gross_share", ["gross_share"], "amount10", true, null),
      col("recoupment_applied", ["recoupment_applied"], "amount10", true, null),
      col("net_payable", ["net_payable"], "amount10", true, null),
      col("split_percentage", ["split_percentage"], "percentage6", true, null),
      col("currency", ["currency"], "text", true, null),
      col("original_currency", ["original_currency"], "text", false, null),
      col("status", ["status"], "text", true, "preview"),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    suspense_items: table("suspense_items", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("earning_id", ["earning_id", "normalized_earning_id"], "text", true, null),
      col("amount", ["amount"], "amount10", true, null),
      col("currency", ["currency"], "text", true, null),
      col("reason_code", ["reason_code"], "text", true, null),
      col("resolved", ["resolved"], "boolean", true, "0"),
      col("resolved_at", ["resolved_at"], "datetime", false, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    statements: table("statements", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("payee_id", ["payee_id"], "text", true, null),
      col("calculation_run_id", ["calculation_run_id"], "text", false, null),
      col("period_start", ["period_start"], "date", true, null),
      col("period_end", ["period_end"], "date", true, null),
      col("currency", ["currency"], "text", true, null),
      col("gross_total", ["gross_total"], "amount10", true, null),
      col("recoupment_total", ["recoupment_total"], "amount10", true, null),
      col("net_payable", ["net_payable"], "amount10", true, null),
      col("amount_due", ["amount_due"], "amount10", true, null),
      col("version", ["version"], "integer", true, "1"),
      col("status", ["status"], "text", true, "draft"),
      col("locked_at", ["locked_at"], "datetime", false, null),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", false, null)
    ]),
    payee_balances: table("payee_balances", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("payee_id", ["payee_id"], "text", true, null),
      col("statement_id", ["statement_id"], "text", false, null),
      col("period_end", ["period_end"], "date", false, null),
      col("currency", ["currency"], "text", true, null),
      col("opening_balance", ["opening_balance"], "amount10", true, null),
      col("period_net", ["period_net"], "amount10", true, null),
      col("closing_balance", ["closing_balance"], "amount10", true, null),
      col("movement_type", ["movement_type"], "text", true, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    statement_lines: table("statement_lines", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("statement_id", ["statement_id"], "text", true, null),
      col("earning_allocation_id", ["earning_allocation_id"], "text", true, null),
      col("track_id", ["track_id"], "text", true, null),
      col("gross_share", ["gross_share"], "amount10", true, null),
      col("recoupment_applied", ["recoupment_applied"], "amount10", true, null),
      col("net_payable", ["net_payable"], "amount10", true, null),
      col("quantity", ["quantity"], "quantity6", true, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    payments: table("payments", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("payee_id", ["payee_id"], "text", true, null),
      col("amount", ["amount"], "amount10", true, null),
      col("currency", ["currency"], "text", true, null),
      col("exchange_rate", ["exchange_rate"], "fxRate10", false, null),
      col("status", ["status"], "text", true, "recorded"),
      col("paid_at", ["paid_at"], "datetime", false, null),
      col("reference", ["reference"], "text", false, null),
      col("created_at", ["created_at"], "datetime", true, null),
      col("updated_at", ["updated_at"], "datetime", true, null)
    ]),
    statement_payment_links: table("statement_payment_links", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("statement_id", ["statement_id"], "text", true, null),
      col("payment_id", ["payment_id"], "text", true, null),
      col("amount_applied", ["amount_applied"], "amount10", true, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    expense_applications: table("expense_applications", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("cost_term_id", ["cost_term_id"], "text", true, null),
      col("payee_id", ["payee_id"], "text", true, null),
      col("statement_id", ["statement_id"], "text", false, null),
      col("calculation_run_id", ["calculation_run_id"], "text", false, null),
      col("amount_applied", ["amount_applied"], "amount10", true, null),
      col("currency", ["currency"], "text", true, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    fx_rates: table("fx_rates", tablePrefix, false, false, false, [
      col("id", ["id"], "text", true, null),
      col("from_currency", ["from_currency"], "text", true, null),
      col("to_currency", ["to_currency"], "text", true, null),
      col("rate", ["rate"], "fxRate10", true, null),
      col("effective_date", ["effective_date"], "date", true, null),
      col("created_at", ["created_at"], "datetime", true, null)
    ]),
    audit_logs: table("audit_logs", tablePrefix, true, false, false, [])
  };

  return [...distributionErhMigratedTableNames, ...distributionErhExcludedTableNames].map((targetTable) => specByTarget[targetTable]);
}

function table(
  targetTable: DistributionErhTableName,
  tablePrefix: string,
  auditExcluded: boolean,
  rawImportRowsDecision: boolean,
  identityLinkMustBeEmpty: boolean,
  columns: readonly DistributionErhColumnSpec[]
): DistributionErhTableSpec {
  return {
    targetTable,
    sourceTable: `${tablePrefix}erh_${targetTable}`,
    columns,
    auditExcluded,
    rawImportRowsDecision,
    identityLinkMustBeEmpty
  };
}

function col(
  target: string,
  aliases: readonly string[],
  kind: DistributionErhScalarKind,
  required: boolean,
  defaultValue: string | boolean | null
): DistributionErhColumnSpec {
  return {
    target,
    aliases,
    kind,
    required,
    defaultValue
  };
}
