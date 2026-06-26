import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  check
} from "drizzle-orm/pg-core";

export const financialTypeEnum = pgEnum("financial_type", ["income", "expense"]);
export const departmentTypeEnum = pgEnum("department_type", ["income", "expense", "mixed"]);
export const partnerTypeEnum = pgEnum("partner_type", ["client", "supplier", "both"]);
export const projectStatusEnum = pgEnum("project_status", ["draft", "active", "paused", "completed", "cancelled", "archived"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["validated", "draft", "cancelled"]);
export const transactionSourceEnum = pgEnum("transaction_source", ["manual", "bank_import", "cashflow_import", "invoice_import", "adjustment"]);
export const officeBankImportSourceEnum = pgEnum("office_bank_import_source", ["sbi", "mcb", "csv", "cashflow", "pdf"]);
export const officeBankImportStatusEnum = pgEnum("office_bank_import_status", ["previewed", "confirmed", "failed", "void"]);
export const officeBankLineDirectionEnum = pgEnum("office_bank_line_direction", ["credit", "debit"]);
export const officeBankReconciliationStatusEnum = pgEnum("office_bank_reconciliation_status", ["unmatched", "suggested", "matched", "rejected"]);

function createdAtColumn() {
  return timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
}

function updatedAtColumn() {
  return timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
}

function legacyIdColumn() {
  return integer("legacy_id");
}

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    type: departmentTypeEnum("type").notNull(),
    color: varchar("color", { length: 64 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("departments_legacy_id_unique").on(table.legacyId),
    uniqueIndex("departments_slug_unique").on(table.slug),
    index("departments_type_idx").on(table.type),
    index("departments_is_active_idx").on(table.isActive)
  ]
);

export const divisions = pgTable(
  "divisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict", onUpdate: "cascade" }),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("divisions_legacy_id_unique").on(table.legacyId),
    uniqueIndex("divisions_department_slug_unique").on(table.departmentId, table.slug),
    index("divisions_department_id_idx").on(table.departmentId),
    index("divisions_is_active_idx").on(table.isActive)
  ]
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    name: text("name").notNull(),
    type: financialTypeEnum("type").notNull(),
    divisionId: uuid("division_id").references(() => divisions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("categories_legacy_id_unique").on(table.legacyId),
    index("categories_type_idx").on(table.type),
    index("categories_division_id_idx").on(table.divisionId),
    index("categories_is_active_idx").on(table.isActive)
  ]
);

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    name: text("name").notNull(),
    type: partnerTypeEnum("type").notNull().default("client"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    taxId: text("tax_id"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("partners_legacy_id_unique").on(table.legacyId),
    index("partners_type_idx").on(table.type),
    index("partners_is_active_idx").on(table.isActive)
  ]
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatusEnum("status").notNull().default("draft"),
    state: text("state").notNull().default("draft"),
    stateChangedAt: timestamp("state_changed_at", { withTimezone: true, mode: "string" }),
    isActive: boolean("is_active").notNull().default(true),
    ownerDepartmentId: uuid("owner_department_id").references(() => departments.id, {
      onDelete: "set null",
      onUpdate: "cascade"
    }),
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null", onUpdate: "cascade" }),
    eventStartDate: date("event_start_date", { mode: "string" }),
    eventEndDate: date("event_end_date", { mode: "string" }),
    venue: text("venue"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("projects_legacy_id_unique").on(table.legacyId),
    index("projects_status_idx").on(table.status),
    index("projects_state_idx").on(table.state),
    index("projects_is_active_idx").on(table.isActive),
    index("projects_owner_department_id_idx").on(table.ownerDepartmentId),
    index("projects_partner_id_idx").on(table.partnerId)
  ]
);

export const projectDepartments = pgTable(
  "project_departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade", onUpdate: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict", onUpdate: "cascade" }),
    expectedBp: integer("expected_bp")
  },
  (table) => [
    uniqueIndex("project_departments_legacy_id_unique").on(table.legacyId),
    uniqueIndex("project_departments_project_department_unique").on(table.projectId, table.departmentId),
    index("project_departments_project_id_idx").on(table.projectId),
    index("project_departments_department_id_idx").on(table.departmentId),
    check("project_departments_expected_bp_check", sql`${table.expectedBp} is null or (${table.expectedBp} >= 0 and ${table.expectedBp} <= 10000)`)
  ]
);

export const projectBudgetLines = pgTable(
  "project_budget_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade", onUpdate: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict", onUpdate: "cascade" }),
    type: financialTypeEnum("type").notNull(),
    plannedAmountMinor: bigint("planned_amount_minor", { mode: "bigint" }).notNull().default(sql`0`)
  },
  (table) => [
    uniqueIndex("project_budget_lines_legacy_id_unique").on(table.legacyId),
    uniqueIndex("project_budget_lines_project_category_type_unique").on(table.projectId, table.categoryId, table.type),
    index("project_budget_lines_project_id_idx").on(table.projectId),
    index("project_budget_lines_category_id_idx").on(table.categoryId),
    check("project_budget_lines_planned_amount_minor_check", sql`${table.plannedAmountMinor} >= 0`)
  ]
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade", onUpdate: "cascade" }),
    personName: text("person_name").notNull(),
    role: text("role")
  },
  (table) => [
    uniqueIndex("project_members_legacy_id_unique").on(table.legacyId),
    uniqueIndex("project_members_project_person_unique").on(table.projectId, table.personName),
    index("project_members_project_id_idx").on(table.projectId)
  ]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    transactionDate: timestamp("transaction_date", { withTimezone: true, mode: "string" }).notNull(),
    type: financialTypeEnum("type").notNull(),
    status: transactionStatusEnum("status").notNull().default("draft"),
    isActive: boolean("is_active").notNull().default(true),
    description: text("description"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "restrict", onUpdate: "cascade" }),
    partnerId: uuid("partner_id").references(() => partners.id, { onDelete: "set null", onUpdate: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null", onUpdate: "cascade" }),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    originalAmountMinor: bigint("original_amount_minor", { mode: "bigint" }),
    originalCurrency: char("original_currency", { length: 3 }),
    exchangeRateE10: bigint("exchange_rate_e10", { mode: "bigint" }),
    vatApplicable: boolean("vat_applicable").notNull().default(false),
    vatRateBp: integer("vat_rate_bp"),
    vatAmountMinor: bigint("vat_amount_minor", { mode: "bigint" }).notNull().default(sql`0`),
    totalAmountMinor: bigint("total_amount_minor", { mode: "bigint" }).notNull().default(sql`0`),
    paymentMethod: text("payment_method"),
    notes: text("notes"),
    source: transactionSourceEnum("source").notNull().default("manual"),
    externalId: text("external_id"),
    createdByUserId: text("created_by_user_id"),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
    isFullyReconciled: boolean("is_fully_reconciled").notNull().default(false),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("transactions_legacy_id_unique").on(table.legacyId),
    index("transactions_transaction_date_idx").on(table.transactionDate),
    index("transactions_type_idx").on(table.type),
    index("transactions_status_idx").on(table.status),
    index("transactions_category_id_idx").on(table.categoryId),
    index("transactions_partner_id_idx").on(table.partnerId),
    index("transactions_project_id_idx").on(table.projectId),
    index("transactions_external_id_idx").on(table.externalId),
    check("transactions_vat_rate_bp_check", sql`${table.vatRateBp} is null or (${table.vatRateBp} >= 0 and ${table.vatRateBp} <= 10000)`)
  ]
);

export const financialAllocations = pgTable(
  "financial_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade", onUpdate: "cascade" }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "restrict", onUpdate: "cascade" }),
    roleSlug: varchar("role_slug", { length: 160 }).notNull().default(""),
    percentageBp: integer("percentage_bp"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("financial_allocations_legacy_id_unique").on(table.legacyId),
    index("financial_allocations_transaction_id_idx").on(table.transactionId),
    index("financial_allocations_department_id_idx").on(table.departmentId),
    check("financial_allocations_percentage_bp_check", sql`${table.percentageBp} is null or (${table.percentageBp} >= 0 and ${table.percentageBp} <= 10000)`)
  ]
);

export const sharedCostRules = pgTable(
  "shared_cost_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    sourceCategoryId: uuid("source_category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade", onUpdate: "cascade" }),
    targetDepartmentId: uuid("target_department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict", onUpdate: "cascade" }),
    percentageBp: integer("percentage_bp").notNull(),
    isActive: boolean("is_active").notNull().default(true)
  },
  (table) => [
    uniqueIndex("shared_cost_rules_legacy_id_unique").on(table.legacyId),
    uniqueIndex("shared_cost_rules_source_target_unique").on(table.sourceCategoryId, table.targetDepartmentId),
    index("shared_cost_rules_source_category_id_idx").on(table.sourceCategoryId),
    index("shared_cost_rules_target_department_id_idx").on(table.targetDepartmentId),
    check("shared_cost_rules_percentage_bp_check", sql`${table.percentageBp} >= 0 and ${table.percentageBp} <= 10000`)
  ]
);

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    fromCurrency: char("from_currency", { length: 3 }).notNull(),
    toCurrency: char("to_currency", { length: 3 }).notNull().default("MUR"),
    rateE10: bigint("rate_e10", { mode: "bigint" }).notNull(),
    effectiveDate: date("effective_date", { mode: "string" }).notNull()
  },
  (table) => [
    uniqueIndex("exchange_rates_legacy_id_unique").on(table.legacyId),
    uniqueIndex("exchange_rates_currency_date_unique").on(table.fromCurrency, table.toCurrency, table.effectiveDate),
    index("exchange_rates_effective_date_idx").on(table.effectiveDate),
    check("exchange_rates_rate_e10_check", sql`${table.rateE10} > 0`)
  ]
);

export const officeBankAccounts = pgTable(
  "office_bank_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    bankName: text("bank_name").notNull(),
    accountLabel: text("account_label").notNull(),
    accountReferenceHash: text("account_reference_hash").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    currentBalanceMinor: bigint("current_balance_minor", { mode: "bigint" }).notNull().default(sql`0`),
    currentBalanceMurMinor: bigint("current_balance_mur_minor", { mode: "bigint" }),
    balanceAsOf: timestamp("balance_as_of", { withTimezone: true, mode: "string" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("office_bank_accounts_legacy_id_unique").on(table.legacyId),
    uniqueIndex("office_bank_accounts_reference_unique").on(table.workspaceId, table.accountReferenceHash),
    index("office_bank_accounts_workspace_idx").on(table.workspaceId),
    index("office_bank_accounts_currency_idx").on(table.currency),
    index("office_bank_accounts_is_active_idx").on(table.isActive)
  ]
);

export const officeBankImportBatches = pgTable(
  "office_bank_import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    workspaceId: text("workspace_id").notNull(),
    source: officeBankImportSourceEnum("source").notNull(),
    fileName: text("file_name").notNull(),
    checksum: text("checksum").notNull(),
    accountId: uuid("account_id").references(() => officeBankAccounts.id, { onDelete: "set null", onUpdate: "cascade" }),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }),
    openingBalanceMinor: bigint("opening_balance_minor", { mode: "bigint" }),
    closingBalanceMinor: bigint("closing_balance_minor", { mode: "bigint" }),
    currency: char("currency", { length: 3 }),
    acceptedRowCount: integer("accepted_row_count").notNull().default(0),
    rejectedRowCount: integer("rejected_row_count").notNull().default(0),
    duplicateRowCount: integer("duplicate_row_count").notNull().default(0),
    idempotencyFingerprint: text("idempotency_fingerprint").notNull(),
    status: officeBankImportStatusEnum("status").notNull().default("previewed"),
    importedAt: timestamp("imported_at", { withTimezone: true, mode: "string" }),
    metadata: jsonb("metadata").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("office_bank_import_batches_legacy_id_unique").on(table.legacyId),
    uniqueIndex("office_bank_import_batches_fingerprint_unique").on(table.workspaceId, table.idempotencyFingerprint),
    index("office_bank_import_batches_workspace_idx").on(table.workspaceId),
    index("office_bank_import_batches_source_idx").on(table.source),
    index("office_bank_import_batches_account_id_idx").on(table.accountId),
    index("office_bank_import_batches_status_idx").on(table.status),
    index("office_bank_import_batches_imported_at_idx").on(table.importedAt),
    check("office_bank_import_batches_row_counts_check", sql`${table.acceptedRowCount} >= 0 and ${table.rejectedRowCount} >= 0 and ${table.duplicateRowCount} >= 0`)
  ]
);

export const officeBankStatementLines = pgTable(
  "office_bank_statement_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    importBatchId: uuid("import_batch_id")
      .notNull()
      .references(() => officeBankImportBatches.id, { onDelete: "restrict", onUpdate: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => officeBankAccounts.id, { onDelete: "restrict", onUpdate: "cascade" }),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    valueOn: date("value_on", { mode: "string" }),
    description: text("description").notNull(),
    reference: text("reference"),
    direction: officeBankLineDirectionEnum("direction").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    balanceMinor: bigint("balance_minor", { mode: "bigint" }),
    currency: char("currency", { length: 3 }).notNull(),
    amountMurMinor: bigint("amount_mur_minor", { mode: "bigint" }).notNull(),
    balanceMurMinor: bigint("balance_mur_minor", { mode: "bigint" }),
    isDuplicateCandidate: boolean("is_duplicate_candidate").notNull().default(false),
    reconciliationStatus: officeBankReconciliationStatusEnum("reconciliation_status").notNull().default("unmatched"),
    matchedTransactionId: uuid("matched_transaction_id").references(() => transactions.id, { onDelete: "set null", onUpdate: "cascade" }),
    rawData: jsonb("raw_data").$type<Readonly<Record<string, unknown>>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("office_bank_statement_lines_legacy_id_unique").on(table.legacyId),
    index("office_bank_statement_lines_import_batch_id_idx").on(table.importBatchId),
    index("office_bank_statement_lines_account_id_idx").on(table.accountId),
    index("office_bank_statement_lines_occurred_on_idx").on(table.occurredOn),
    index("office_bank_statement_lines_reference_idx").on(table.reference),
    index("office_bank_statement_lines_reconciliation_status_idx").on(table.reconciliationStatus),
    index("office_bank_statement_lines_matched_transaction_id_idx").on(table.matchedTransactionId),
    check("office_bank_statement_lines_amount_minor_check", sql`${table.amountMinor} >= 0`)
  ]
);

export const officeBankReconciliationMatches = pgTable(
  "office_bank_reconciliation_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    bankStatementLineId: uuid("bank_statement_line_id")
      .notNull()
      .references(() => officeBankStatementLines.id, { onDelete: "restrict", onUpdate: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict", onUpdate: "cascade" }),
    confidenceBp: integer("confidence_bp").notNull(),
    status: officeBankReconciliationStatusEnum("status").notNull().default("suggested"),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => [
    uniqueIndex("office_bank_reconciliation_matches_legacy_id_unique").on(table.legacyId),
    uniqueIndex("office_bank_reconciliation_matches_line_tx_unique").on(table.bankStatementLineId, table.transactionId),
    index("office_bank_reconciliation_matches_line_id_idx").on(table.bankStatementLineId),
    index("office_bank_reconciliation_matches_transaction_id_idx").on(table.transactionId),
    index("office_bank_reconciliation_matches_status_idx").on(table.status),
    check("office_bank_reconciliation_matches_confidence_bp_check", sql`${table.confidenceBp} >= 0 and ${table.confidenceBp} <= 10000`)
  ]
);

export const officeCashflowProjectionRows = pgTable(
  "office_cashflow_projection_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legacyId: legacyIdColumn(),
    importBatchId: uuid("import_batch_id").references(() => officeBankImportBatches.id, { onDelete: "set null", onUpdate: "cascade" }),
    accountId: uuid("account_id").references(() => officeBankAccounts.id, { onDelete: "set null", onUpdate: "cascade" }),
    workspaceId: text("workspace_id").notNull(),
    periodMonth: char("period_month", { length: 7 }).notNull(),
    expectedInflowMinor: bigint("expected_inflow_minor", { mode: "bigint" }).notNull().default(sql`0`),
    expectedOutflowMinor: bigint("expected_outflow_minor", { mode: "bigint" }).notNull().default(sql`0`),
    expectedClosingBalanceMinor: bigint("expected_closing_balance_minor", { mode: "bigint" }).notNull().default(sql`0`),
    currency: char("currency", { length: 3 }).notNull().default("MUR"),
    sourceRowRef: text("source_row_ref"),
    createdAt: createdAtColumn()
  },
  (table) => [
    uniqueIndex("office_cashflow_projection_rows_legacy_id_unique").on(table.legacyId),
    index("office_cashflow_projection_rows_workspace_idx").on(table.workspaceId),
    index("office_cashflow_projection_rows_import_batch_id_idx").on(table.importBatchId),
    index("office_cashflow_projection_rows_account_id_idx").on(table.accountId),
    index("office_cashflow_projection_rows_period_month_idx").on(table.periodMonth)
  ]
);
