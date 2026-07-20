import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  check
} from "drizzle-orm/pg-core";
import { partners as officePartners } from "../office/schema.js";

export const distributionImportStatusEnum = pgEnum("distribution_import_status", ["draft", "processing", "normalized", "completed", "failed", "void"]);
export const distributionMappingStatusEnum = pgEnum("distribution_mapping_status", ["unmapped", "unmatched", "matched", "suspense", "ignored"]);
export const distributionCalculationStatusEnum = pgEnum("distribution_calculation_status", [
  "pending",
  "allocated",
  "calculated",
  "suspense",
  "completed",
  "failed",
  "running",
  "error",
  "excluded"
]);
export const distributionIssueSeverityEnum = pgEnum("distribution_issue_severity", ["info", "warning", "error"]);
export const distributionIdentityStatusEnum = pgEnum("distribution_identity_status", ["pending", "linked", "rejected", "archived"]);
export const distributionContractStatusEnum = pgEnum("distribution_contract_status", ["draft", "active", "paused", "expired", "terminated", "archived"]);
export const distributionCostTermStatusEnum = pgEnum("distribution_cost_term_status", [
  "draft",
  "active",
  "open",
  "partially_recovered",
  "recovered",
  "non_recoverable",
  "satisfied",
  "cancelled",
  "deleted"
]);
export const distributionRoyaltyRuleStatusEnum = pgEnum("distribution_royalty_rule_status", ["draft", "active", "inactive", "archived"]);
export const distributionAllocationStatusEnum = pgEnum("distribution_allocation_status", ["preview", "calculated", "statemented", "posted", "void", "error"]);
export const distributionStatementStatusEnum = pgEnum("distribution_statement_status", ["draft", "generated", "locked", "sent", "paid", "void"]);
export const distributionPaymentStatusEnum = pgEnum("distribution_payment_status", ["recorded", "edited", "void", "reconciled"]);
export const distributionBalanceMovementTypeEnum = pgEnum("distribution_balance_movement_type", [
  "opening",
  "period",
  "statement",
  "void_reversal",
  "adjustment",
  "carry_forward"
]);

export const apiIdempotencyKeys = pgTable("api_idempotency_keys", {
  key: text("key").primaryKey(),
  route: text("route").notNull(),
  requestHash: text("request_hash").notNull(),
  responseJson: jsonb("response_json").$type<Readonly<Record<string, unknown>> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
});

export const apiImportPreviews = pgTable(
  "api_import_previews",
  {
    previewId: text("preview_id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    kind: varchar("kind", { length: 64 }).notNull(),
    payloadJson: jsonb("payload_json").$type<Readonly<Record<string, unknown>>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" })
  },
  (table) => [
    index("api_import_previews_workspace_kind_idx").on(table.workspaceId, table.kind),
    index("api_import_previews_expires_at_idx").on(table.expiresAt)
  ]
);

export const commandCenterSettings = pgTable(
  "command_center_settings",
  {
    workspaceId: text("workspace_id").notNull(),
    key: text("key").notNull(),
    valueJson: jsonb("value_json").$type<Readonly<Record<string, unknown>>>().notNull(),
    status: text("status").notNull(),
    updatedByUserId: text("updated_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("command_center_settings_pk").on(table.workspaceId, table.key),
    index("command_center_settings_workspace_idx").on(table.workspaceId)
  ]
);

export const commandCenterIntegrationStates = pgTable(
  "command_center_integration_states",
  {
    workspaceId: text("workspace_id").notNull(),
    integrationId: text("integration_id").notNull(),
    enabled: boolean("enabled").notNull(),
    status: text("status").notNull(),
    updatedByUserId: text("updated_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("command_center_integration_states_pk").on(table.workspaceId, table.integrationId),
    index("command_center_integration_states_workspace_idx").on(table.workspaceId)
  ]
);

export const commandCenterUserPermissions = pgTable(
  "command_center_user_permissions",
  {
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    permissionsJson: jsonb("permissions_json").$type<Readonly<Record<string, unknown>>>().notNull(),
    updatedByUserId: text("updated_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("command_center_user_permissions_pk").on(table.workspaceId, table.userId),
    index("command_center_user_permissions_workspace_idx").on(table.workspaceId)
  ]
);

function createdAtColumn() {
  return timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
}

function updatedAtColumn() {
  return timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
}

function legacyIdColumn() {
  return integer("legacy_id");
}

function amountColumn(name: string) {
  return numeric(name, { precision: 28, scale: 10 });
}

function percentageColumn(name: string) {
  return numeric(name, { precision: 12, scale: 6 });
}

function quantityColumn(name: string) {
  return numeric(name, { precision: 24, scale: 6 });
}

function fxRateColumn(name: string) {
  return numeric(name, { precision: 24, scale: 10 });
}

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    source: varchar("source", { length: 160 }).notNull(),
    fileName: text("file_name").notNull(),
    status: distributionImportStatusEnum("status").notNull().default("draft"),
    importedAt: timestamp("imported_at", { withTimezone: true, mode: "string" }),
    metadata: jsonb("metadata").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("import_batches_legacy_id_unique").on(table.legacyId),
    index("import_batches_workspace_id_idx").on(table.workspaceId),
    index("import_batches_source_idx").on(table.source),
    index("import_batches_status_idx").on(table.status),
    index("import_batches_imported_at_idx").on(table.importedAt)
  ]
);

export const rawImportRows = pgTable(
  "raw_import_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade", onUpdate: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    rawData: jsonb("raw_data").$type<Readonly<Record<string, unknown>>>().notNull(),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("raw_import_rows_legacy_id_unique").on(table.legacyId),
    uniqueIndex("raw_import_rows_batch_row_unique").on(table.batchId, table.rowNumber),
    index("raw_import_rows_batch_id_idx").on(table.batchId),
    check("raw_import_rows_row_number_check", sql`${table.rowNumber} > 0`)
  ]
);

export const normalizedEarnings = pgTable(
  "normalized_earnings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade", onUpdate: "cascade" }),
    rawImportRowId: uuid("raw_import_row_id").references(() => rawImportRows.id, { onDelete: "set null", onUpdate: "cascade" }),
    dsp: varchar("dsp", { length: 160 }).notNull(),
    grossAmount: amountColumn("gross_amount").notNull(),
    quantity: quantityColumn("quantity").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    isrc: varchar("isrc", { length: 32 }),
    upc: varchar("upc", { length: 32 }),
    rawTitle: text("raw_title"),
    rawArtist: text("raw_artist"),
    rawLabel: text("raw_label"),
    mappingStatus: distributionMappingStatusEnum("mapping_status").notNull().default("unmapped"),
    calculationStatus: distributionCalculationStatusEnum("calculation_status").notNull().default("pending"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("normalized_earnings_legacy_id_unique").on(table.legacyId),
    index("normalized_earnings_batch_id_idx").on(table.batchId),
    index("normalized_earnings_workspace_id_idx").on(table.workspaceId),
    index("normalized_earnings_raw_import_row_id_idx").on(table.rawImportRowId),
    index("normalized_earnings_isrc_idx").on(table.isrc),
    index("normalized_earnings_upc_idx").on(table.upc),
    index("normalized_earnings_mapping_status_idx").on(table.mappingStatus),
    index("normalized_earnings_mapping_workbench_idx").on(table.workspaceId, table.mappingStatus, table.legacyId, table.id),
    index("normalized_earnings_calculation_status_idx").on(table.calculationStatus)
  ]
);

export const mappingStatsByBatch = pgTable(
  "mapping_stats_by_batch",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade", onUpdate: "cascade" }),
    totalRows: integer("total_rows").notNull().default(0),
    matchedRows: integer("matched_rows").notNull().default(0),
    suspenseRows: integer("suspense_rows").notNull().default(0),
    ignoredRows: integer("ignored_rows").notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("mapping_stats_by_batch_legacy_id_unique").on(table.legacyId),
    uniqueIndex("mapping_stats_by_batch_batch_unique").on(table.batchId),
    check("mapping_stats_by_batch_counts_check", sql`${table.totalRows} >= 0 and ${table.matchedRows} >= 0 and ${table.suspenseRows} >= 0 and ${table.ignoredRows} >= 0`)
  ]
);

export const importIssues = pgTable(
  "import_issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade", onUpdate: "cascade" }),
    rawImportRowId: uuid("raw_import_row_id").references(() => rawImportRows.id, { onDelete: "set null", onUpdate: "cascade" }),
    severity: distributionIssueSeverityEnum("severity").notNull(),
    code: varchar("code", { length: 160 }).notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("import_issues_legacy_id_unique").on(table.legacyId),
    index("import_issues_batch_id_idx").on(table.batchId),
    index("import_issues_raw_import_row_id_idx").on(table.rawImportRowId),
    index("import_issues_severity_idx").on(table.severity)
  ]
);

export const payees = pgTable(
  "payees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    linkedArtistIds: jsonb("linked_artist_ids").$type<readonly string[]>().notNull().default(sql`'[]'::jsonb`),
    preferredCurrency: char("preferred_currency", { length: 3 }).notNull().default("MUR"),
    paymentMethod: text("payment_method"),
    taxInfo: jsonb("tax_info").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("payees_legacy_id_unique").on(table.legacyId),
    index("payees_is_active_idx").on(table.isActive),
    index("payees_workspace_id_idx").on(table.workspaceId),
    index("payees_preferred_currency_idx").on(table.preferredCurrency)
  ]
);

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    contractNumber: varchar("contract_number", { length: 160 }),
    title: text("title").notNull(),
    status: distributionContractStatusEnum("status").notNull().default("draft"),
    effectiveFrom: date("effective_from", { mode: "string" }),
    effectiveTo: date("effective_to", { mode: "string" }),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "string" }),
    metadata: jsonb("metadata").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("contracts_legacy_id_unique").on(table.legacyId),
    uniqueIndex("contracts_contract_number_unique").on(table.contractNumber),
    index("contracts_status_idx").on(table.status),
    index("contracts_effective_from_idx").on(table.effectiveFrom)
  ]
);

export const artists = pgTable(
  "artists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    name: text("name").notNull(),
    aliases: jsonb("aliases").$type<readonly string[]>().notNull().default(sql`'[]'::jsonb`),
    defaultPayeeId: uuid("default_payee_id").references(() => payees.id, { onDelete: "set null", onUpdate: "cascade" }),
    defaultSplitContractId: uuid("default_split_contract_id").references(() => contracts.id, { onDelete: "set null", onUpdate: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("artists_legacy_id_unique").on(table.legacyId),
    index("artists_default_payee_id_idx").on(table.defaultPayeeId),
    index("artists_default_split_contract_id_idx").on(table.defaultSplitContractId),
    index("artists_is_active_idx").on(table.isActive)
  ]
);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    name: text("name").notNull(),
    defaultSplitPct: numeric("default_split_pct", { precision: 5, scale: 2 }),
    payeeId: uuid("payee_id").references(() => payees.id, { onDelete: "set null", onUpdate: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("labels_legacy_id_unique").on(table.legacyId),
    index("labels_payee_id_idx").on(table.payeeId),
    index("labels_is_active_idx").on(table.isActive),
    check("labels_default_split_pct_check", sql`${table.defaultSplitPct} is null or (${table.defaultSplitPct} >= 0 and ${table.defaultSplitPct} <= 100)`)
  ]
);

export const releases = pgTable(
  "releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    title: text("title").notNull(),
    artistName: text("artist_name").notNull().default("Unknown artist"),
    catalogStatus: varchar("catalog_status", { length: 20 }).notNull().default("released"),
    upc: varchar("upc", { length: 32 }),
    labelId: uuid("label_id").references(() => labels.id, { onDelete: "set null", onUpdate: "cascade" }),
    labelName: text("label_name"),
    releaseDate: date("release_date", { mode: "string" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("releases_legacy_id_unique").on(table.legacyId),
    index("releases_workspace_id_idx").on(table.workspaceId),
    index("releases_catalog_workbench_idx").on(table.workspaceId, table.releaseDate, table.labelId, table.id),
    index("releases_label_id_idx").on(table.labelId),
    index("releases_upc_idx").on(table.upc)
  ]
);

export const tracks = pgTable(
  "tracks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    title: text("title").notNull(),
    artistName: text("artist_name").notNull().default("Unknown artist"),
    catalogStatus: varchar("catalog_status", { length: 20 }).notNull().default("released"),
    isrc: varchar("isrc", { length: 32 }),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "set null", onUpdate: "cascade" }),
    versionTitle: text("version_title"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("tracks_legacy_id_unique").on(table.legacyId),
    index("tracks_workspace_id_idx").on(table.workspaceId),
    index("tracks_catalog_workbench_idx").on(table.workspaceId, table.catalogStatus, table.legacyId, table.id),
    index("tracks_isrc_idx").on(table.isrc),
    index("tracks_release_id_idx").on(table.releaseId)
  ]
);

export const trackContributors = pgTable(
  "track_contributors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade", onUpdate: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: varchar("role", { length: 160 }).notNull(),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("track_contributors_legacy_id_unique").on(table.legacyId),
    uniqueIndex("track_contributors_track_artist_role_unique").on(table.trackId, table.artistId, table.role),
    index("track_contributors_track_id_idx").on(table.trackId),
    index("track_contributors_artist_id_idx").on(table.artistId)
  ]
);

export const catalogContributorOverrides = pgTable(
  "catalog_contributor_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "restrict", onUpdate: "cascade" }),
    contributorsJson: jsonb("contributors_json")
      .$type<readonly Readonly<{ name: string; role: string }>[]>()
      .notNull(),
    reason: text("reason").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("catalog_contributor_overrides_workspace_idempotency_unique").on(table.workspaceId, table.idempotencyKey),
    index("catalog_contributor_overrides_latest_idx").on(table.workspaceId, table.trackId, table.createdAt, table.id)
  ]
);

export const contractRuleSetOverrides = pgTable(
  "contract_rule_set_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "restrict", onUpdate: "cascade" }),
    baseContractId: uuid("base_contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "restrict", onUpdate: "cascade" }),
    rulesJson: jsonb("rules_json")
      .$type<readonly Readonly<{ payeeId: string; percentage: string }>[]>()
      .notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    currency: char("currency", { length: 3 }).notNull(),
    reason: text("reason").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("contract_rule_set_overrides_workspace_track_idempotency_unique").on(
      table.workspaceId,
      table.trackId,
      table.idempotencyKey
    ),
    index("contract_rule_set_overrides_latest_idx").on(table.workspaceId, table.trackId, table.createdAt, table.id),
    check("contract_rule_set_overrides_json_array_check", sql`jsonb_typeof(${table.rulesJson}) = 'array' and jsonb_array_length(${table.rulesJson}) > 0`),
    check("contract_rule_set_overrides_dates_check", sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`)
  ]
);

export const identityLink = pgTable(
  "identity_link",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    payeeId: uuid("payee_id")
      .notNull()
      .references(() => payees.id, { onDelete: "cascade", onUpdate: "cascade" }),
    officePartnerId: uuid("office_partner_id")
      .notNull()
      .references(() => officePartners.id, { onDelete: "restrict", onUpdate: "cascade" }),
    confidence: percentageColumn("confidence").notNull(),
    status: distributionIdentityStatusEnum("status").notNull().default("pending"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("identity_link_legacy_id_unique").on(table.legacyId),
    uniqueIndex("identity_link_payee_office_partner_unique").on(table.payeeId, table.officePartnerId),
    index("identity_link_payee_id_idx").on(table.payeeId),
    index("identity_link_office_partner_id_idx").on(table.officePartnerId),
    check("identity_link_confidence_check", sql`${table.confidence} >= 0 and ${table.confidence} <= 100`)
  ]
);

export const contractScopes = pgTable(
  "contract_scopes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    scopeType: varchar("scope_type", { length: 80 }).notNull(),
    scopeId: text("scope_id").notNull(),
    territory: varchar("territory", { length: 80 }),
    dsp: varchar("dsp", { length: 160 }),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("contract_scopes_legacy_id_unique").on(table.legacyId),
    index("contract_scopes_contract_id_idx").on(table.contractId),
    index("contract_scopes_scope_idx").on(table.scopeType, table.scopeId),
    index("contract_scopes_dsp_idx").on(table.dsp)
  ]
);

export const contractCostTerms = pgTable(
  "contract_cost_terms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    payeeId: uuid("payee_id").references(() => payees.id, { onDelete: "set null", onUpdate: "cascade" }),
    category: varchar("category", { length: 40 }).notNull().default("other"),
    description: text("description"),
    incurredOn: date("incurred_on"),
    amount: amountColumn("amount").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    recoupable: boolean("recoupable").notNull().default(true),
    recoveryMethod: varchar("recovery_method", { length: 160 }).notNull(),
    recoveryParam: percentageColumn("recovery_param"),
    status: distributionCostTermStatusEnum("status").notNull().default("draft"),
    scopeType: varchar("scope_type", { length: 80 }),
    scopeId: text("scope_id"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("contract_cost_terms_legacy_id_unique").on(table.legacyId),
    index("contract_cost_terms_contract_id_idx").on(table.contractId),
    index("contract_cost_terms_payee_id_idx").on(table.payeeId),
    index("contract_cost_terms_status_idx").on(table.status)
  ]
);

export const contractExtractions = pgTable(
  "contract_extractions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    rawText: text("raw_text").notNull(),
    extractedJson: jsonb("extracted_json").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("contract_extractions_legacy_id_unique").on(table.legacyId),index("contract_extractions_contract_id_idx").on(table.contractId)]
);

export const royaltyRules = pgTable(
  "royalty_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    payeeId: uuid("payee_id")
      .notNull()
      .references(() => payees.id, { onDelete: "restrict", onUpdate: "cascade" }),
    percentage: percentageColumn("percentage").notNull(),
    scopeType: varchar("scope_type", { length: 80 }),
    scopeId: text("scope_id"),
    priority: integer("priority").notNull().default(0),
    effectiveFrom: date("effective_from", { mode: "string" }),
    effectiveTo: date("effective_to", { mode: "string" }),
    recoupable: boolean("recoupable").notNull().default(true),
    status: distributionRoyaltyRuleStatusEnum("status").notNull().default("draft"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("royalty_rules_legacy_id_unique").on(table.legacyId),
    index("royalty_rules_contract_id_idx").on(table.contractId),
    index("royalty_rules_payee_id_idx").on(table.payeeId),
    index("royalty_rules_scope_idx").on(table.scopeType, table.scopeId),
    index("royalty_rules_priority_idx").on(table.priority),
    check("royalty_rules_percentage_check", sql`${table.percentage} >= 0 and ${table.percentage} <= 100`)
  ]
);

export const earningTrackMatches = pgTable(
  "earning_track_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    earningId: uuid("earning_id")
      .notNull()
      .references(() => normalizedEarnings.id, { onDelete: "cascade", onUpdate: "cascade" }),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "restrict", onUpdate: "cascade" }),
    confidence: percentageColumn("confidence").notNull(),
    status: distributionMappingStatusEnum("status").notNull().default("matched"),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("earning_track_matches_legacy_id_unique").on(table.legacyId),
    index("earning_track_matches_earning_id_idx").on(table.earningId),
    index("earning_track_matches_track_id_idx").on(table.trackId),
    index("earning_track_matches_workbench_idx").on(table.earningId, table.status, table.confidence, table.id),
    check("earning_track_matches_confidence_check", sql`${table.confidence} >= 0 and ${table.confidence} <= 100`)
  ]
);

export const mappingRules = pgTable(
  "mapping_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    name: text("name").notNull(),
    source: varchar("source", { length: 160 }).notNull(),
    conditionsJson: jsonb("conditions_json").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    targetTrackId: uuid("target_track_id").references(() => tracks.id, { onDelete: "set null", onUpdate: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("mapping_rules_legacy_id_unique").on(table.legacyId),
    index("mapping_rules_source_idx").on(table.source),
    index("mapping_rules_target_track_id_idx").on(table.targetTrackId),
    index("mapping_rules_is_active_idx").on(table.isActive)
  ]
);

export const catalogAliases = pgTable(
  "catalog_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    aliasText: text("alias_text").notNull(),
    artistId: uuid("artist_id").references(() => artists.id, { onDelete: "cascade", onUpdate: "cascade" }),
    payeeId: uuid("payee_id").references(() => payees.id, { onDelete: "cascade", onUpdate: "cascade" }),
    labelId: uuid("label_id").references(() => labels.id, { onDelete: "cascade", onUpdate: "cascade" }),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "cascade", onUpdate: "cascade" }),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "cascade", onUpdate: "cascade" }),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("catalog_aliases_legacy_id_unique").on(table.legacyId),
    index("catalog_aliases_alias_text_idx").on(table.aliasText),
    index("catalog_aliases_artist_id_idx").on(table.artistId),
    index("catalog_aliases_payee_id_idx").on(table.payeeId),
    index("catalog_aliases_label_id_idx").on(table.labelId),
    index("catalog_aliases_release_id_idx").on(table.releaseId),
    index("catalog_aliases_track_id_idx").on(table.trackId)
  ]
);

export const calculationRuns = pgTable(
  "calculation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    batchId: uuid("batch_id").references(() => importBatches.id, { onDelete: "set null", onUpdate: "cascade" }),
    status: distributionCalculationStatusEnum("status").notNull().default("pending"),
    reconciliationJson: jsonb("reconciliation_json").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("calculation_runs_legacy_id_unique").on(table.legacyId),
    index("calculation_runs_workspace_id_idx").on(table.workspaceId),
    index("calculation_runs_batch_id_idx").on(table.batchId),
    index("calculation_runs_status_idx").on(table.status)
  ]
);

export const earningAllocations = pgTable(
  "earning_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    earningId: uuid("earning_id")
      .notNull()
      .references(() => normalizedEarnings.id, { onDelete: "cascade", onUpdate: "cascade" }),
    calculationRunId: uuid("calculation_run_id")
      .notNull()
      .references(() => calculationRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
    payeeId: uuid("payee_id")
      .notNull()
      .references(() => payees.id, { onDelete: "restrict", onUpdate: "cascade" }),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null", onUpdate: "cascade" }),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null", onUpdate: "cascade" }),
    grossAmount: amountColumn("gross_amount").notNull(),
    originalGrossAmount: amountColumn("original_gross_amount").notNull(),
    fxRate: fxRateColumn("fx_rate"),
    grossShare: amountColumn("gross_share").notNull(),
    recoupmentApplied: amountColumn("recoupment_applied").notNull(),
    netPayable: amountColumn("net_payable").notNull(),
    splitPercentage: percentageColumn("split_percentage").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    originalCurrency: char("original_currency", { length: 3 }).notNull(),
    status: distributionAllocationStatusEnum("status").notNull().default("preview"),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("earning_allocations_legacy_id_unique").on(table.legacyId),
    index("earning_allocations_earning_id_idx").on(table.earningId),
    index("earning_allocations_calculation_run_id_idx").on(table.calculationRunId),
    index("earning_allocations_payee_id_idx").on(table.payeeId),
    index("earning_allocations_contract_id_idx").on(table.contractId),
    index("earning_allocations_track_id_idx").on(table.trackId),
    index("earning_allocations_status_idx").on(table.status),
    check("earning_allocations_split_percentage_check", sql`${table.splitPercentage} >= 0 and ${table.splitPercentage} <= 100`)
  ]
);

export const suspenseItems = pgTable(
  "suspense_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    earningId: uuid("earning_id").references(() => normalizedEarnings.id, { onDelete: "set null", onUpdate: "cascade" }),
    amount: amountColumn("amount").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    reasonCode: varchar("reason_code", { length: 160 }).notNull(),
    resolved: boolean("resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("suspense_items_legacy_id_unique").on(table.legacyId),
    index("suspense_items_earning_id_idx").on(table.earningId),
    index("suspense_items_reason_code_idx").on(table.reasonCode),
    index("suspense_items_resolved_idx").on(table.resolved)
  ]
);

export const statements = pgTable(
  "statements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    payeeId: uuid("payee_id")
      .notNull()
      .references(() => payees.id, { onDelete: "restrict", onUpdate: "cascade" }),
    calculationRunId: uuid("calculation_run_id").references(() => calculationRuns.id, { onDelete: "set null", onUpdate: "cascade" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    grossTotal: amountColumn("gross_total").notNull(),
    recoupmentTotal: amountColumn("recoupment_total").notNull(),
    netPayable: amountColumn("net_payable").notNull(),
    amountDue: amountColumn("amount_due").notNull(),
    version: integer("version").notNull().default(1),
    status: distributionStatementStatusEnum("status").notNull().default("draft"),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("statements_legacy_id_unique").on(table.legacyId),
    uniqueIndex("statements_payee_period_currency_version_unique").on(table.payeeId, table.periodStart, table.periodEnd, table.currency, table.version),
    index("statements_payee_id_idx").on(table.payeeId),
    index("statements_workspace_id_idx").on(table.workspaceId),
    index("statements_calculation_run_id_idx").on(table.calculationRunId),
    index("statements_status_idx").on(table.status)
  ]
);

export const payeeBalances = pgTable(
  "payee_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    payeeId: uuid("payee_id")
      .notNull()
      .references(() => payees.id, { onDelete: "restrict", onUpdate: "cascade" }),
    statementId: uuid("statement_id").references(() => statements.id, { onDelete: "set null", onUpdate: "cascade" }),
    currency: char("currency", { length: 3 }).notNull(),
    openingBalance: amountColumn("opening_balance").notNull(),
    periodNet: amountColumn("period_net").notNull(),
    closingBalance: amountColumn("closing_balance").notNull(),
    movementType: distributionBalanceMovementTypeEnum("movement_type").notNull(),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("payee_balances_legacy_id_unique").on(table.legacyId),
    index("payee_balances_payee_currency_idx").on(table.payeeId, table.currency),
    index("payee_balances_statement_id_idx").on(table.statementId),
    index("payee_balances_movement_type_idx").on(table.movementType)
  ]
);

export const statementLines = pgTable(
  "statement_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    statementId: uuid("statement_id")
      .notNull()
      .references(() => statements.id, { onDelete: "cascade", onUpdate: "cascade" }),
    earningAllocationId: uuid("earning_allocation_id").references(() => earningAllocations.id, { onDelete: "set null", onUpdate: "cascade" }),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null", onUpdate: "cascade" }),
    grossShare: amountColumn("gross_share").notNull(),
    recoupmentApplied: amountColumn("recoupment_applied").notNull(),
    netPayable: amountColumn("net_payable").notNull(),
    quantity: quantityColumn("quantity").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("statement_lines_legacy_id_unique").on(table.legacyId),
    index("statement_lines_statement_id_idx").on(table.statementId),
    index("statement_lines_earning_allocation_id_idx").on(table.earningAllocationId),
    index("statement_lines_track_id_idx").on(table.trackId)
  ]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    payeeId: uuid("payee_id")
      .notNull()
      .references(() => payees.id, { onDelete: "restrict", onUpdate: "cascade" }),
    amount: amountColumn("amount").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    exchangeRate: fxRateColumn("exchange_rate"),
    method: varchar("method", { length: 40 }).notNull().default("bank_transfer"),
    status: distributionPaymentStatusEnum("status").notNull().default("recorded"),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),
    reference: text("reference"),
    notes: text("notes"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("payments_legacy_id_unique").on(table.legacyId),
    index("payments_payee_id_idx").on(table.payeeId),
    index("payments_status_idx").on(table.status),
    index("payments_paid_at_idx").on(table.paidAt)
  ]
);

export const statementPaymentLinks = pgTable(
  "statement_payment_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    statementId: uuid("statement_id")
      .notNull()
      .references(() => statements.id, { onDelete: "cascade", onUpdate: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade", onUpdate: "cascade" }),
    amountApplied: amountColumn("amount_applied").notNull(),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("statement_payment_links_legacy_id_unique").on(table.legacyId),
    uniqueIndex("statement_payment_links_statement_payment_unique").on(table.statementId, table.paymentId),
    index("statement_payment_links_statement_id_idx").on(table.statementId),
    index("statement_payment_links_payment_id_idx").on(table.paymentId)
  ]
);

export const expenseApplications = pgTable(
  "expense_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    costTermId: uuid("cost_term_id")
      .notNull()
      .references(() => contractCostTerms.id, { onDelete: "restrict", onUpdate: "cascade" }),
    payeeId: uuid("payee_id")
      .notNull()
      .references(() => payees.id, { onDelete: "restrict", onUpdate: "cascade" }),
    statementId: uuid("statement_id").references(() => statements.id, { onDelete: "set null", onUpdate: "cascade" }),
    calculationRunId: uuid("calculation_run_id").references(() => calculationRuns.id, { onDelete: "set null", onUpdate: "cascade" }),
    amountApplied: amountColumn("amount_applied").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("expense_applications_legacy_id_unique").on(table.legacyId),
    index("expense_applications_cost_term_id_idx").on(table.costTermId),
    index("expense_applications_payee_id_idx").on(table.payeeId),
    index("expense_applications_statement_id_idx").on(table.statementId),
    index("expense_applications_calculation_run_id_idx").on(table.calculationRunId)
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    entityType: varchar("entity_type", { length: 160 }).notNull(),
    entityId: text("entity_id").notNull(),
    action: varchar("action", { length: 160 }).notNull(),
    actorUserId: text("actor_user_id"),
    before: jsonb("before").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    after: jsonb("after").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    metadata: jsonb("metadata").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("audit_logs_legacy_id_unique").on(table.legacyId),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_at_idx").on(table.createdAt)
  ]
);

export const fxRates = pgTable(
  "fx_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    fromCurrency: char("from_currency", { length: 3 }).notNull(),
    toCurrency: char("to_currency", { length: 3 }).notNull(),
    rate: fxRateColumn("rate").notNull(),
    effectiveDate: date("effective_date", { mode: "string" }).notNull(),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("fx_rates_legacy_id_unique").on(table.legacyId),
    uniqueIndex("fx_rates_currency_date_unique").on(table.fromCurrency, table.toCurrency, table.effectiveDate),
    index("fx_rates_effective_date_idx").on(table.effectiveDate),
    check("fx_rates_rate_check", sql`${table.rate} > 0`)
  ]
);
