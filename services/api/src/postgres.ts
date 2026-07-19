import { Pool } from "pg";
import type {
  CurrencyCode,
  DistributionAlias,
  DistributionContract,
  DistributionContractExpense,
  DistributionMappingRow,
  OfficePartnerClassificationSuggestion,
  OfficePartnerPayeeLink,
  OfficeProjectCoherenceViolation
} from "@ehq/api-client";
import type {
  DistributionCostTermInput,
  DistributionExistingExpenseApplication,
  DistributionFxRateInput,
  PayeeBalanceLedgerInput,
  DistributionReadDataset
} from "@ehq/domain-distribution";
import type {
  OfficeAnalyticsDataset,
  OfficeBankImportBatchRow,
  OfficeBankReconciliationMatchRow,
  OfficeBankStatementLineRow,
  OfficeCashflowManualEntryRow,
  OfficeCashflowProjectionRowInput,
  OfficeCategoryRow,
  OfficeDepartmentRow,
  OfficeDivisionRow,
  OfficeFinancialAllocationRow,
  OfficePartnerRow,
  OfficeProjectBudgetLineRow,
  OfficeProjectRow,
  OfficeAdvanceApplicationRow,
  OfficeManagedAdvanceRow,
  OfficeTransactionRow
} from "@ehq/domain-office";
import { erhMoney } from "@ehq/domain-finance";
import { createEmptyApiFixtureStore, type ApiDistributionRoyaltyRuleInput, type ApiFixtureStore } from "./fixtures.js";
import { sanitizeOfficeBankDescription } from "./office-bank-description.js";
import { createPostgresPersistenceRuntime, type ApiPersistenceRuntime } from "./persistence.js";
import { createApiStartupReadiness, type ApiStartupReadiness } from "./startup.js";

type PgRow = Readonly<Record<string, unknown>>;
type DistributionImportStatus = DistributionReadDataset["importBatches"][number]["status"];
type DistributionMappingStatus = DistributionReadDataset["normalizedEarnings"][number]["mappingStatus"];
type DistributionCalculationStatus = DistributionReadDataset["normalizedEarnings"][number]["calculationStatus"];
type DistributionAllocationStatus = DistributionReadDataset["earningAllocations"][number]["status"];
type DistributionStatementStatus = DistributionReadDataset["statements"][number]["status"];
type DistributionPaymentStatus = DistributionReadDataset["payments"][number]["status"];

export interface ApiPostgresRuntime {
  readonly fixtures: ApiFixtureStore;
  readonly persistence: ApiPersistenceRuntime;
  readonly health: () => Promise<ApiPostgresHealth>;
  readonly close: () => Promise<void>;
}

export interface ApiStartingPostgresRuntime extends ApiPostgresRuntime {
  readonly readiness: ApiStartupReadiness;
}

export interface ApiPostgresHealth {
  readonly status: "ok";
  readonly database: "postgres";
  readonly officeTransactions: number;
  readonly distributionStatements: number;
}

type OfficeFixtureSlice = Pick<
  ApiFixtureStore,
  | "office"
  | "officeAuditLog"
  | "officeClassificationSuggestions"
  | "officePartnerPayeeLinks"
  | "officeProjectViolations"
  | "officeCashflowManualEntries"
  | "officeAdvances"
  | "officeAdvanceApplications"
>;

type DistributionFixtureSlice = Omit<ApiFixtureStore, keyof OfficeFixtureSlice>;

export function startPostgresApiRuntime(
  env: Readonly<Record<string, string | undefined>>
): ApiStartingPostgresRuntime {
  const pool = createPostgresPool(env);
  const fixtures = createEmptyApiFixtureStore();
  const office = loadFixturePhase("office", async (): Promise<OfficeFixtureSlice> => readOfficeFixtureSlice(pool), (slice) => {
    Object.assign(fixtures, slice);
  });
  const distribution = loadFixturePhase(
    "distribution",
    async (): Promise<DistributionFixtureSlice> => readDistributionFixtureSlice(pool),
    (slice) => {
      Object.assign(fixtures, slice);
    }
  );
  const readiness = createApiStartupReadiness({ office, distribution });

  return {
    fixtures,
    persistence: createPostgresPersistenceRuntime(pool, env),
    health: async (): Promise<ApiPostgresHealth> => readPostgresHealth(pool),
    close: async (): Promise<void> => {
      await pool.end();
    },
    readiness
  };
}

export async function createPostgresApiRuntime(env: Readonly<Record<string, string | undefined>>): Promise<ApiPostgresRuntime> {
  const pool = createPostgresPool(env);
  try {
    const fixtures = await readApiFixtureStoreFromPostgres(pool);
    return {
      fixtures,
      persistence: createPostgresPersistenceRuntime(pool, env),
      health: async (): Promise<ApiPostgresHealth> => readPostgresHealth(pool),
      close: async (): Promise<void> => {
        await pool.end();
      }
    };
  } catch (error: unknown) {
    await pool.end();
    throw error;
  }
}

export function createPostgresPool(env: Readonly<Record<string, string | undefined>>): Pool {
  const databaseUrl = requireDatabaseUrl(env);
  return new Pool({
    connectionString: databaseUrl,
    // max:1 forced every write to queue behind the previous one — the "heavy/slow buttons"
    // symptom when two people (or a bot) saved at once. A small pool lets concurrent writes
    // proceed; the Supabase transaction pooler handles the extra connections. Tunable via
    // DB_POOL_MAX without a code change; default 5 is safe for this team's load.
    max: parsePoolMax(env.DB_POOL_MAX),
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    query_timeout: 60_000,
    statement_timeout: 60_000,
    ssl: sslForDatabaseUrl(databaseUrl)
  });
}

function parsePoolMax(raw: string | undefined): number {
  if (raw === undefined || raw.trim().length === 0) {
    return 5;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    return 5;
  }
  return parsed;
}

export function requireDatabaseUrl(env: Readonly<Record<string, string | undefined>>): string {
  const value = env.DATABASE_URL;
  if (value === undefined || value.trim().length === 0) {
    throw new Error("DATABASE_URL is required to run the Hono shadow API against migrated Postgres.");
  }

  return value;
}

export async function readApiFixtureStoreFromPostgres(pool: Pool): Promise<ApiFixtureStore> {
  const [office, distribution] = await Promise.all([
    readOfficeFixtureSlice(pool),
    readDistributionFixtureSlice(pool)
  ]);
  return { ...office, ...distribution };
}

async function readOfficeFixtureSlice(pool: Pool): Promise<OfficeFixtureSlice> {
  const [
    office,
    officePartnerPayeeLinks,
    officeCashflowManualEntries,
    officeAdvances,
    officeAdvanceApplications
  ] = await Promise.all([
    readOfficeDataset(pool),
    readOfficePartnerPayeeLinks(pool),
    readOfficeCashflowManualEntries(pool),
    readOfficeAdvances(pool),
    readOfficeAdvanceApplications(pool)
  ]);
  return {
    office,
    officeAuditLog: [],
    officeClassificationSuggestions: emptyRecord<readonly OfficePartnerClassificationSuggestion[]>(),
    officePartnerPayeeLinks,
    officeProjectViolations: emptyRecord<readonly OfficeProjectCoherenceViolation[]>(),
    officeCashflowManualEntries,
    officeAdvances,
    officeAdvanceApplications
  };
}

async function readDistributionFixtureSlice(pool: Pool): Promise<DistributionFixtureSlice> {
  const [
    distribution,
    distributionContracts,
    distributionContractExpenses,
    distributionMappingRows,
    distributionRoyaltyRules,
    distributionCostTerms,
    distributionExpenseApplications,
    distributionFxRates,
    distributionPayeeBalances,
    distributionAliases
  ] = await Promise.all([
    readDistributionDataset(pool),
    readDistributionContracts(pool),
    readDistributionContractExpenses(pool),
    readDistributionMappingRows(pool),
    readDistributionRoyaltyRules(pool),
    readDistributionAllocationCostTerms(pool),
    readDistributionExistingExpenseApplications(pool),
    readDistributionFxRates(pool),
    readDistributionPayeeBalances(pool),
    readDistributionAliases(pool)
  ]);
  return {
    distribution,
    distributionContracts,
    distributionContractExpenses,
    distributionMappingRows,
    distributionRoyaltyRules,
    distributionCostTerms,
    distributionExpenseApplications,
    distributionFxRates,
    distributionPayeeBalances,
    distributionAliases
  };
}

async function loadFixturePhase<TSlice>(
  phase: "office" | "distribution",
  load: () => Promise<TSlice>,
  apply: (slice: TSlice) => void
): Promise<void> {
  const startedAtMs = Date.now();
  console.log(JSON.stringify({ level: "info", msg: "api_startup_phase", phase, status: "starting" }));
  try {
    const slice = await load();
    apply(slice);
    console.log(JSON.stringify({
      level: "info",
      msg: "api_startup_phase",
      phase,
      status: "ready",
      durationMs: Date.now() - startedAtMs,
      ...fixturePhaseCounts(phase, slice)
    }));
  } catch (error: unknown) {
    console.error(JSON.stringify({
      level: "error",
      msg: "api_startup_phase",
      phase,
      status: "failed",
      durationMs: Date.now() - startedAtMs,
      errorName: error instanceof Error ? error.name : "UnknownError"
    }));
    throw error;
  }
}

function fixturePhaseCounts<TSlice>(phase: "office" | "distribution", slice: TSlice): Readonly<Record<string, number>> {
  if (phase === "office") {
    const officeSlice = slice as OfficeFixtureSlice;
    return {
      transactionCount: officeSlice.office.transactions.length,
      bankLineCount: officeSlice.office.bankStatementLines.length
    };
  }

  const distributionSlice = slice as DistributionFixtureSlice;
  return {
    earningCount: distributionSlice.distribution.normalizedEarnings.length,
    allocationCount: distributionSlice.distribution.earningAllocations.length
  };
}

async function readOfficeCashflowManualEntries(pool: Pool): Promise<readonly OfficeCashflowManualEntryRow[]> {
  const rows = await queryRows(
    pool,
    `select id::text, workspace_id, account_id::text, partner_id::text, project_id::text, entry_date,
      direction, amount_minor::text, currency, label, notes, status, created_by_user_id, created_at, updated_at
     from office_cashflow_manual_entries order by entry_date, id`,
    []
  );
  return rows.map(toOfficeCashflowManualEntry);
}

async function readOfficeAdvances(pool: Pool): Promise<readonly OfficeManagedAdvanceRow[]> {
  const rows = await queryRows(
    pool,
    `select id::text, workspace_id, beneficiary_type, beneficiary_name, partner_id::text, project_id::text, bank_statement_line_id::text,
      transaction_id::text, label, planned_payment_on, paid_on, original_amount_minor::text, currency,
      status, notes, created_by_user_id, created_at, updated_at
     from office_advances order by planned_payment_on, id`,
    []
  );
  return rows.map(toOfficeManagedAdvance);
}

async function readOfficeAdvanceApplications(pool: Pool): Promise<readonly OfficeAdvanceApplicationRow[]> {
  const rows = await queryRows(
    pool,
    `select id::text, advance_id::text, applied_on, amount_minor::text, kind, reference, notes,
      created_by_user_id, created_at
     from office_advance_applications order by applied_on, id`,
    []
  );
  return rows.map(toOfficeAdvanceApplication);
}

async function readPostgresHealth(pool: Pool): Promise<ApiPostgresHealth> {
  const officeTransactions = await readCount(pool, "transactions");
  const distributionStatements = await readCount(pool, "statements");
  return {
    status: "ok",
    database: "postgres",
    officeTransactions,
    distributionStatements
  };
}

async function readOfficeDataset(pool: Pool): Promise<OfficeAnalyticsDataset> {
  const [
    departments,
    divisions,
    categories,
    partners,
    projects,
    projectBudgetLines,
    transactions,
    financialAllocations,
    bankAccounts,
    bankImportBatches,
    bankStatementLines,
    bankReconciliationMatches,
    cashflowProjectionRows,
    exchangeRates
  ] = await Promise.all([
    queryRows(pool, "select id::text, name, type, color, is_active from departments order by legacy_id nulls last, id", []),
    queryRows(pool, "select id::text, department_id::text, name, is_active from divisions order by legacy_id nulls last, id", []),
    queryRows(pool, "select id::text, division_id::text, name, type, account_code, account_label, is_active from categories order by legacy_id nulls last, id", []),
    queryRows(pool, "select id::text, name, type, is_active from partners order by legacy_id nulls last, id", []),
    queryRows(pool, "select id::text, name, description, status, state, is_active from projects order by legacy_id nulls last, id", []),
    queryRows(pool, "select id::text, project_id::text, category_id::text, type, planned_amount_minor::text from project_budget_lines order by legacy_id nulls last, id", []),
    queryRows(
      pool,
      "select id::text, workspace_id, transaction_date, type, status, is_active, description, category_id::text, partner_id::text, project_id::text, account_id::text, amount_minor::text, original_currency, exchange_rate_e10::text, vat_applicable, vat_rate_bp::text, vat_amount_minor::text from transactions order by transaction_date, id",
      []
    ),
    queryRows(pool, "select id::text, transaction_id::text, department_id::text, amount_minor::text from financial_allocations order by legacy_id nulls last, id", []),
    queryRows(
      pool,
      "select id::text, workspace_id, bank_name, account_label, account_reference_hash, currency, current_balance_minor::text, current_balance_mur_minor::text, is_active, balance_as_of from office_bank_accounts order by legacy_id nulls last, id",
      []
    ),
    queryRows(
      pool,
      "select id::text, workspace_id, source, file_name, checksum, account_id::text, period_start, period_end, opening_balance_minor::text, closing_balance_minor::text, currency, accepted_row_count, rejected_row_count, duplicate_row_count, idempotency_fingerprint, status, imported_at, metadata from office_bank_import_batches order by legacy_id nulls last, id",
      []
    ),
    queryRows(
      pool,
      "select id::text, import_batch_id::text, account_id::text, occurred_on, value_on, description, reference, direction, amount_minor::text, balance_minor::text, currency, amount_mur_minor::text, balance_mur_minor::text, is_duplicate_candidate, reconciliation_status, matched_transaction_id::text, raw_data from office_bank_statement_lines order by occurred_on, id",
      []
    ),
    queryRows(
      pool,
      "select id::text, bank_statement_line_id::text, transaction_id::text, confidence_bp, status, approved_by_user_id, approved_at from office_bank_reconciliation_matches order by legacy_id nulls last, id",
      []
    ),
    queryRows(
      pool,
      `select rows.id::text, rows.import_batch_id::text, rows.workspace_id, rows.account_id::text, rows.period_month,
        rows.expected_inflow_minor::text, rows.expected_outflow_minor::text,
        rows.expected_closing_balance_minor::text, rows.currency, rows.created_at
       from office_cashflow_projection_rows rows
       left join office_bank_import_batches batches on batches.id = rows.import_batch_id
       where rows.import_batch_id is null or batches.id is null or batches.status <> 'void'
       order by rows.period_month, rows.id`,
      []
    ),
    queryRows(
      pool,
      "select from_currency, to_currency, rate_e10::text, effective_date from exchange_rates order by effective_date, from_currency, to_currency",
      []
    )
  ]);

  return {
    departments: departments.map(toOfficeDepartment),
    divisions: divisions.map(toOfficeDivision),
    categories: categories.map(toOfficeCategory),
    partners: partners.map(toOfficePartner),
    projects: projects.map(toOfficeProject),
    projectBudgetLines: projectBudgetLines.map(toOfficeProjectBudgetLine),
    transactions: transactions.map(toOfficeTransaction),
    financialAllocations: financialAllocations.map(toOfficeFinancialAllocation),
    bankAccounts: bankAccounts.map(toOfficeBankAccount),
    bankImportBatches: bankImportBatches.map(toOfficeBankImportBatch),
    bankStatementLines: bankStatementLines.map(toOfficeBankStatementLine),
    bankReconciliationMatches: bankReconciliationMatches.map(toOfficeBankReconciliationMatch),
    cashflowProjectionRows: cashflowProjectionRows.map(toOfficeCashflowProjectionRow),
    exchangeRates: exchangeRates.map(toOfficeExchangeRate)
  };
}

async function readDistributionDataset(pool: Pool): Promise<DistributionReadDataset> {
  const [
    importBatches,
    normalizedEarnings,
    calculationRuns,
    earningAllocations,
    suspenseItems,
    statements,
    statementLines,
    statementPaymentLinks,
    payments,
    payees,
    releases,
    tracks
  ] = await Promise.all([
    queryRows(pool, "select id::text, source, file_name, status, imported_at from import_batches order by legacy_id nulls last, id", []),
    queryRows(
      pool,
      "select id::text, batch_id::text, dsp, gross_amount::text, quantity::text, currency, isrc, upc, raw_title, raw_artist, raw_label, mapping_status, calculation_status from normalized_earnings order by legacy_id nulls last, id",
      []
    ),
    queryRows(pool, "select id::text, batch_id::text, status, started_at, finished_at, created_at from calculation_runs order by legacy_id nulls last, id", []),
    queryRows(
      pool,
      "select id::text, earning_id::text, calculation_run_id::text, payee_id::text, contract_id::text, track_id::text, gross_amount::text, gross_share::text, recoupment_applied::text, net_payable::text, split_percentage::text, currency, status, created_at from earning_allocations order by legacy_id nulls last, id",
      []
    ),
    queryRows(pool, "select id::text, earning_id::text, amount::text, currency, reason_code, resolved, resolved_at, created_at from suspense_items order by legacy_id nulls last, id", []),
    queryRows(
      pool,
      "select id::text, payee_id::text, calculation_run_id::text, period_start, period_end, currency, gross_total::text, recoupment_total::text, net_payable::text, amount_due::text, version, status, created_at from statements order by period_end, id",
      []
    ),
    queryRows(
      pool,
      "select id::text, statement_id::text, earning_allocation_id::text, track_id::text, gross_share::text, recoupment_applied::text, net_payable::text, quantity::text, currency from statement_lines order by legacy_id nulls last, id",
      []
    ),
    queryRows(pool, "select id::text, statement_id::text, payment_id::text, amount_applied::text from statement_payment_links order by legacy_id nulls last, id", []),
    queryRows(pool, "select id::text, payee_id::text, amount::text, currency, exchange_rate::text, method, status, paid_at, reference, notes from payments order by legacy_id nulls last, id", []),
    queryRows(pool, "select id::text, name, email, preferred_currency, is_active from payees order by legacy_id nulls last, id", []),
    queryRows(pool, "select id::text, title, artist_name, catalog_status, upc, release_date from releases order by legacy_id nulls last, id", []),
    queryRows(pool, "select id::text, title, artist_name, catalog_status, isrc, release_id::text from tracks order by legacy_id nulls last, id", [])
  ]);

  return {
    importBatches: importBatches.map(toDistributionImportBatchRow),
    normalizedEarnings: normalizedEarnings.map(toDistributionNormalizedEarning),
    calculationRuns: calculationRuns.map(toDistributionCalculationRun),
    earningAllocations: earningAllocations.map(toDistributionEarningAllocation),
    suspenseItems: suspenseItems.map(toDistributionSuspenseItem),
    statements: statements.map(toDistributionStatement),
    statementLines: statementLines.map(toDistributionStatementLine),
    statementPaymentLinks: statementPaymentLinks.map(toDistributionStatementPaymentLink),
    payments: payments.map(toDistributionPayment),
    payees: payees.map(toDistributionPayee),
    releases: releases.map(toDistributionRelease),
    tracks: tracks.map(toDistributionTrack)
  };
}

async function readDistributionContracts(pool: Pool): Promise<readonly DistributionContract[]> {
  const rows = await queryRows(
    pool,
    `select c.id::text, c.title, c.status, c.effective_from, c.effective_to, rr.payee_id::text, rr.percentage::text,
      coalesce(ct.currency, 'MUR') as currency,
      coalesce(sum(
        ct.amount - coalesce((
          select sum(ea.amount_applied) from expense_applications ea where ea.cost_term_id = ct.id
        ), 0)
      ) filter (where ct.recoupable = true and ct.status not in ('recovered', 'satisfied', 'cancelled', 'deleted')), 0)::text as open_expense
     from contracts c
     left join royalty_rules rr on rr.contract_id = c.id
     left join contract_cost_terms ct on ct.contract_id = c.id
     group by c.id, c.title, c.status, c.effective_from, c.effective_to, rr.payee_id, rr.percentage, ct.currency
     order by c.title, c.id`,
    []
  );
  return rows.map((row) => ({
    id: stringCell(row, "id"),
    payeeId: nullableStringCell(row, "payee_id") ?? "unassigned",
    title: stringCell(row, "title"),
    status: toApiContractStatus(stringCell(row, "status")),
    effectiveFrom: nullableDateCell(row, "effective_from") ?? "1970-01-01",
    effectiveTo: nullableDateCell(row, "effective_to"),
    splitBp: percentageToBasisPoints(nullableStringCell(row, "percentage") ?? "0"),
    openExpenseMicro: stringCell(row, "open_expense"),
    currency: currencyCell(row, "currency")
  }));
}

async function readDistributionContractExpenses(pool: Pool): Promise<readonly DistributionContractExpense[]> {
  const rows = await queryRows(
    pool,
    `select cct.id::text, cct.contract_id::text, cct.payee_id::text, cct.category, cct.description, cct.incurred_on,
      cct.amount::text, cct.currency, cct.recoupable, cct.status, cct.created_at,
      coalesce(sum(ea.amount_applied), 0)::text as applied_amount
     from contract_cost_terms cct
     left join expense_applications ea on ea.cost_term_id = cct.id
     group by cct.id, cct.contract_id, cct.payee_id, cct.category, cct.description, cct.incurred_on,
       cct.amount, cct.currency, cct.recoupable, cct.status, cct.created_at
     order by cct.legacy_id nulls last, cct.id`,
    []
  );
  return rows.map((row) => {
    const isOpen = isOpenExpenseStatus(stringCell(row, "status"));
    const fullAmount = stringCell(row, "amount");
    const appliedAmount = stringCell(row, "applied_amount");
    // Subtract already-applied amounts so the open balance reflects reality.
    // Use integer arithmetic on the scale-10 micro strings.
    let openAmountMicro = "0.0000000000";
    if (isOpen) {
      const remaining = erhMoney.sub(erhMoney.parse(fullAmount), erhMoney.parse(appliedAmount));
      openAmountMicro = erhMoney.format(remaining > 0n ? remaining : 0n);
    }
    return {
      id: stringCell(row, "id"),
      contractId: stringCell(row, "contract_id"),
      payeeId: nullableStringCell(row, "payee_id"),
      incurredOn: nullableDateCell(row, "incurred_on") ?? timestampCell(row, "created_at").slice(0, 10),
      category: toApiExpenseCategory(nullableStringCell(row, "category")),
      label: nullableStringCell(row, "description") ?? "Contract cost term",
      originalAmountMicro: fullAmount,
      openAmountMicro,
      currency: currencyCell(row, "currency"),
      recoverable: booleanCell(row, "recoupable"),
      status: toApiExpenseStatus(stringCell(row, "status"))
    };
  });
}

async function readDistributionMappingRows(pool: Pool): Promise<readonly DistributionMappingRow[]> {
  const rows = await queryRows(
    pool,
    `select ne.id::text, ne.batch_id::text, ne.raw_title, ne.raw_artist, ne.raw_label, ne.dsp, ne.isrc, ne.upc,
      ne.gross_amount::text, ne.currency, ne.mapping_status, etm.track_id::text, t.title as track_title, etm.confidence::text
     from normalized_earnings ne
     left join earning_track_matches etm on etm.earning_id = ne.id
     left join tracks t on t.id = etm.track_id
     order by ne.legacy_id nulls last, ne.id
     limit 1000`,
    []
  );
  return rows.map((row) => ({
    id: stringCell(row, "id"),
    batchId: stringCell(row, "batch_id"),
    sourceTitle: nullableStringCell(row, "raw_title") ?? "",
    sourceArtist: nullableStringCell(row, "raw_artist") ?? "",
    sourceLabel: nullableStringCell(row, "raw_label") ?? "",
    sourceStore: stringCell(row, "dsp"),
    sourceIsrc: nullableStringCell(row, "isrc"),
    sourceUpc: nullableStringCell(row, "upc"),
    grossMicro: stringCell(row, "gross_amount"),
    currency: currencyCell(row, "currency"),
    suggestedTrackId: nullableStringCell(row, "track_id"),
    suggestedTrackTitle: nullableStringCell(row, "track_title"),
    confidenceBp: percentageToBasisPoints(nullableStringCell(row, "confidence") ?? "0"),
    status: toApiMappingStatus(stringCell(row, "mapping_status")),
    exactFixPath: "manual_track"
  }));
}

async function readDistributionRoyaltyRules(pool: Pool): Promise<readonly ApiDistributionRoyaltyRuleInput[]> {
  const rows = await queryRows(
    pool,
    `select id::text, contract_id::text, payee_id::text, percentage::text, scope_type, scope_id,
      effective_from, effective_to, status
     from royalty_rules
     order by priority desc, legacy_id nulls last, id`,
    []
  );
  return rows.map((row) => {
    const scopeType = nullableStringCell(row, "scope_type");
    const scopeId = nullableStringCell(row, "scope_id");
    const payeeId = stringCell(row, "payee_id");
    return {
      contractId: stringCell(row, "contract_id"),
      royaltyRuleId: stringCell(row, "id"),
      payeeId,
      artistId: scopeType === "artist" && scopeId !== null ? scopeId : payeeId,
      role: scopeType ?? "artist",
      percentage: stringCell(row, "percentage"),
      scopeType,
      scopeId,
      effectiveFrom: nullableDateCell(row, "effective_from"),
      effectiveTo: nullableDateCell(row, "effective_to"),
      status: enumCell(row, "status", ["draft", "active", "inactive", "archived"])
    };
  });
}

async function readDistributionAllocationCostTerms(pool: Pool): Promise<readonly DistributionCostTermInput[]> {
  const rows = await queryRows(
    pool,
    `select id::text, contract_id::text, payee_id::text, amount::text, currency, recoupable, status, created_at
     from contract_cost_terms
     order by legacy_id nulls last, id`,
    []
  );
  return rows.map((row) => ({
    id: stringCell(row, "id"),
    contractId: stringCell(row, "contract_id"),
    payeeId: nullableStringCell(row, "payee_id"),
    amount: stringCell(row, "amount"),
    currency: currencyCell(row, "currency"),
    recoupable: booleanCell(row, "recoupable"),
    status: enumCell(row, "status", [
      "draft",
      "active",
      "open",
      "partially_recovered",
      "recovered",
      "non_recoverable",
      "satisfied",
      "cancelled",
      "deleted"
    ]),
    expenseDate: timestampCell(row, "created_at").slice(0, 10)
  }));
}

async function readDistributionExistingExpenseApplications(pool: Pool): Promise<readonly DistributionExistingExpenseApplication[]> {
  const rows = await queryRows(
    pool,
    "select cost_term_id::text, amount_applied::text, currency, calculation_run_id::text from expense_applications order by legacy_id nulls last, id",
    []
  );
  return rows.map((row) => ({
    costTermId: stringCell(row, "cost_term_id"),
    amountApplied: stringCell(row, "amount_applied"),
    currency: currencyCell(row, "currency"),
    calculationRunId: nullableStringCell(row, "calculation_run_id")
  }));
}

async function readDistributionFxRates(pool: Pool): Promise<readonly DistributionFxRateInput[]> {
  const rows = await queryRows(
    pool,
    "select from_currency, to_currency, effective_date, rate::text from fx_rates order by effective_date, from_currency, to_currency",
    []
  );
  return rows.map((row) => ({
    fromCurrency: currencyCell(row, "from_currency"),
    toCurrency: currencyCell(row, "to_currency"),
    effectiveDate: dateCell(row, "effective_date"),
    rate: stringCell(row, "rate")
  }));
}

async function readDistributionPayeeBalances(pool: Pool): Promise<readonly PayeeBalanceLedgerInput[]> {
  const rows = await queryRows(
    pool,
    `select id::text, payee_id::text, statement_id::text, currency, opening_balance::text, period_net::text,
      closing_balance::text, movement_type, created_at
     from payee_balances
     order by created_at, id`,
    []
  );
  return rows.map((row) => ({
    id: stringCell(row, "id"),
    payeeId: stringCell(row, "payee_id"),
    statementId: nullableStringCell(row, "statement_id"),
    currency: currencyCell(row, "currency"),
    openingBalance: stringCell(row, "opening_balance"),
    periodNet: stringCell(row, "period_net"),
    closingBalance: stringCell(row, "closing_balance"),
    movementType: enumCell(row, "movement_type", ["opening", "period", "statement", "void_reversal", "adjustment", "carry_forward"]),
    createdAt: timestampCell(row, "created_at")
  }));
}

async function readDistributionAliases(pool: Pool): Promise<readonly DistributionAlias[]> {
  const rows = await queryRows(
    pool,
    `select ca.id::text, ca.alias_text,
      case
        when ca.track_id is not null then 'track'
        when ca.release_id is not null then 'release'
        when ca.label_id is not null then 'label'
        when ca.artist_id is not null then 'artist'
        when ca.payee_id is not null then 'payee'
        else 'unassigned'
      end as target_type,
      coalesce(ca.track_id::text, ca.release_id::text, ca.label_id::text, ca.artist_id::text, ca.payee_id::text) as target_id,
      coalesce(t.title, r.title, l.name, a.name, p.name, ca.alias_text) as target
     from catalog_aliases ca
     left join tracks t on t.id = ca.track_id
     left join releases r on r.id = ca.release_id
     left join labels l on l.id = ca.label_id
     left join artists a on a.id = ca.artist_id
     left join payees p on p.id = ca.payee_id
     order by ca.alias_text, ca.id`,
    []
  );

  return rows.map((row) => ({
    id: stringCell(row, "id"),
    aliasText: stringCell(row, "alias_text"),
    target: stringCell(row, "target"),
    targetType: enumCell(row, "target_type", ["artist", "payee", "label", "release", "track", "unassigned"]),
    targetId: nullableStringCell(row, "target_id")
  }));
}

function toOfficeDepartment(row: PgRow): OfficeDepartmentRow {
  return {
    id: stringCell(row, "id"),
    name: stringCell(row, "name"),
    type: enumCell(row, "type", ["income", "expense", "mixed"]),
    color: nullableStringCell(row, "color"),
    isActive: booleanCell(row, "is_active")
  };
}

function toOfficeDivision(row: PgRow): OfficeDivisionRow {
  return {
    id: stringCell(row, "id"),
    departmentId: stringCell(row, "department_id"),
    name: stringCell(row, "name"),
    isActive: booleanCell(row, "is_active")
  };
}

function toOfficeCategory(row: PgRow): OfficeCategoryRow {
  return {
    id: stringCell(row, "id"),
    divisionId: nullableStringCell(row, "division_id"),
    name: stringCell(row, "name"),
    type: enumCell(row, "type", ["income", "expense"]),
    accountCode: nullableStringCell(row, "account_code"),
    accountLabel: nullableStringCell(row, "account_label"),
    isActive: booleanCell(row, "is_active")
  };
}

function toOfficePartner(row: PgRow): OfficePartnerRow {
  return {
    id: stringCell(row, "id"),
    name: stringCell(row, "name"),
    type: enumCell(row, "type", ["client", "supplier", "both"]),
    isActive: booleanCell(row, "is_active")
  };
}

function toOfficeProject(row: PgRow): OfficeProjectRow {
  return {
    id: stringCell(row, "id"),
    name: stringCell(row, "name"),
    description: nullableStringCell(row, "description"),
    status: enumCell(row, "status", ["draft", "active", "paused", "completed", "cancelled", "archived"]),
    state: stringCell(row, "state"),
    isActive: booleanCell(row, "is_active")
  };
}

function toOfficeProjectBudgetLine(row: PgRow): OfficeProjectBudgetLineRow {
  return {
    id: stringCell(row, "id"),
    projectId: stringCell(row, "project_id"),
    categoryId: stringCell(row, "category_id"),
    type: enumCell(row, "type", ["income", "expense"]),
    plannedAmountMinor: bigintCell(row, "planned_amount_minor")
  };
}

function toOfficeTransaction(row: PgRow): OfficeTransactionRow {
  return {
    id: stringCell(row, "id"),
    workspaceId: stringCell(row, "workspace_id"),
    transactionDate: timestampCell(row, "transaction_date"),
    type: enumCell(row, "type", ["income", "expense"]),
    status: enumCell(row, "status", ["validated", "draft", "cancelled"]),
    isActive: booleanCell(row, "is_active"),
    description: nullableStringCell(row, "description"),
    categoryId: nullableStringCell(row, "category_id"),
    partnerId: nullableStringCell(row, "partner_id"),
    projectId: nullableStringCell(row, "project_id"),
    accountId: nullableStringCell(row, "account_id"),
    amountMinor: bigintCell(row, "amount_minor"),
    originalCurrency: nullableStringCell(row, "original_currency"),
    exchangeRateE10: nullableBigintCell(row, "exchange_rate_e10"),
    vatApplicable: booleanCell(row, "vat_applicable"),
    vatRateBp: nullableIntegerCell(row, "vat_rate_bp"),
    vatAmountMinor: bigintCell(row, "vat_amount_minor")
  };
}

function toOfficeFinancialAllocation(row: PgRow): OfficeFinancialAllocationRow {
  return {
    id: stringCell(row, "id"),
    transactionId: stringCell(row, "transaction_id"),
    departmentId: nullableStringCell(row, "department_id"),
    amountMinor: bigintCell(row, "amount_minor")
  };
}

function toOfficeBankAccount(row: PgRow): OfficeAnalyticsDataset["bankAccounts"][number] {
  return {
    id: stringCell(row, "id"),
    workspaceId: stringCell(row, "workspace_id"),
    bankName: stringCell(row, "bank_name"),
    accountLabel: stringCell(row, "account_label"),
    accountReferenceHash: stringCell(row, "account_reference_hash"),
    currency: currencyCell(row, "currency"),
    currentBalanceMinor: bigintCell(row, "current_balance_minor"),
    currentBalanceMurMinor: nullableBigintCell(row, "current_balance_mur_minor"),
    isActive: booleanCell(row, "is_active"),
    balanceAsOf: nullableTimestampCell(row, "balance_as_of")
  };
}

function toOfficeExchangeRate(row: PgRow): OfficeAnalyticsDataset["exchangeRates"][number] {
  return {
    fromCurrency: stringCell(row, "from_currency"),
    toCurrency: stringCell(row, "to_currency"),
    rateE10: bigintCell(row, "rate_e10"),
    effectiveDate: dateCell(row, "effective_date")
  };
}

function toOfficeBankImportBatch(row: PgRow): OfficeBankImportBatchRow {
  return {
    id: stringCell(row, "id"),
    workspaceId: stringCell(row, "workspace_id"),
    source: enumCell(row, "source", ["sbi", "mcb", "csv", "cashflow", "pdf"]),
    fileName: stringCell(row, "file_name"),
    checksum: stringCell(row, "checksum"),
    accountId: nullableStringCell(row, "account_id"),
    periodStart: nullableDateCell(row, "period_start"),
    periodEnd: nullableDateCell(row, "period_end"),
    openingBalanceMinor: nullableBigintCell(row, "opening_balance_minor"),
    closingBalanceMinor: nullableBigintCell(row, "closing_balance_minor"),
    currency: nullableCurrencyCell(row, "currency"),
    acceptedRowCount: numberCell(row, "accepted_row_count"),
    rejectedRowCount: numberCell(row, "rejected_row_count"),
    duplicateRowCount: numberCell(row, "duplicate_row_count"),
    idempotencyFingerprint: stringCell(row, "idempotency_fingerprint"),
    status: enumCell(row, "status", ["previewed", "confirmed", "failed", "void"]),
    importedAt: nullableTimestampCell(row, "imported_at"),
    metadata: jsonRecordCell(row, "metadata")
  };
}

function toOfficeBankStatementLine(row: PgRow): OfficeBankStatementLineRow {
  return {
    id: stringCell(row, "id"),
    importBatchId: stringCell(row, "import_batch_id"),
    accountId: stringCell(row, "account_id"),
    occurredOn: dateCell(row, "occurred_on"),
    valueOn: nullableDateCell(row, "value_on"),
    description: sanitizeOfficeBankDescription(stringCell(row, "description")),
    reference: nullableStringCell(row, "reference"),
    direction: enumCell(row, "direction", ["credit", "debit"]),
    amountMinor: bigintCell(row, "amount_minor"),
    balanceMinor: nullableBigintCell(row, "balance_minor"),
    currency: currencyCell(row, "currency"),
    amountMurMinor: bigintCell(row, "amount_mur_minor"),
    balanceMurMinor: nullableBigintCell(row, "balance_mur_minor"),
    isDuplicateCandidate: booleanCell(row, "is_duplicate_candidate"),
    reconciliationStatus: enumCell(row, "reconciliation_status", ["unmatched", "suggested", "matched", "rejected", "ignored"]),
    matchedTransactionId: nullableStringCell(row, "matched_transaction_id"),
    rawData: jsonRecordCell(row, "raw_data")
  };
}

function toOfficeBankReconciliationMatch(row: PgRow): OfficeBankReconciliationMatchRow {
  return {
    id: stringCell(row, "id"),
    bankStatementLineId: stringCell(row, "bank_statement_line_id"),
    transactionId: stringCell(row, "transaction_id"),
    confidenceBp: numberCell(row, "confidence_bp"),
    status: enumCell(row, "status", ["unmatched", "suggested", "matched", "rejected"]),
    approvedByUserId: nullableStringCell(row, "approved_by_user_id"),
    approvedAt: nullableTimestampCell(row, "approved_at")
  };
}

function toOfficeCashflowProjectionRow(row: PgRow): OfficeCashflowProjectionRowInput {
  return {
    id: stringCell(row, "id"),
    importBatchId: nullableStringCell(row, "import_batch_id"),
    workspaceId: stringCell(row, "workspace_id"),
    accountId: nullableStringCell(row, "account_id"),
    periodMonth: stringCell(row, "period_month"),
    expectedInflowMinor: bigintCell(row, "expected_inflow_minor"),
    expectedOutflowMinor: bigintCell(row, "expected_outflow_minor"),
    expectedClosingBalanceMinor: bigintCell(row, "expected_closing_balance_minor"),
    currency: currencyCell(row, "currency"),
    createdAt: timestampCell(row, "created_at")
  };
}

function toOfficeCashflowManualEntry(row: PgRow): OfficeCashflowManualEntryRow {
  return {
    id: stringCell(row, "id"),
    workspaceId: stringCell(row, "workspace_id"),
    accountId: nullableStringCell(row, "account_id"),
    partnerId: nullableStringCell(row, "partner_id"),
    projectId: nullableStringCell(row, "project_id"),
    entryDate: dateCell(row, "entry_date"),
    direction: enumCell(row, "direction", ["inflow", "outflow"]),
    amountMinor: bigintCell(row, "amount_minor"),
    currency: currencyCell(row, "currency"),
    label: stringCell(row, "label"),
    notes: nullableStringCell(row, "notes"),
    status: enumCell(row, "status", ["planned", "confirmed", "cancelled"]),
    createdByUserId: nullableStringCell(row, "created_by_user_id"),
    createdAt: timestampCell(row, "created_at"),
    updatedAt: timestampCell(row, "updated_at")
  };
}

function toOfficeManagedAdvance(row: PgRow): OfficeManagedAdvanceRow {
  return {
    id: stringCell(row, "id"),
    workspaceId: stringCell(row, "workspace_id"),
    beneficiaryType: enumCell(row, "beneficiary_type", ["staff", "freelancer", "artist", "supplier", "contractor", "other"]),
    beneficiaryName: stringCell(row, "beneficiary_name"),
    partnerId: nullableStringCell(row, "partner_id"),
    projectId: nullableStringCell(row, "project_id"),
    bankStatementLineId: nullableStringCell(row, "bank_statement_line_id"),
    transactionId: nullableStringCell(row, "transaction_id"),
    label: stringCell(row, "label"),
    plannedPaymentOn: dateCell(row, "planned_payment_on"),
    paidOn: nullableDateCell(row, "paid_on"),
    originalAmountMinor: bigintCell(row, "original_amount_minor"),
    currency: currencyCell(row, "currency"),
    status: enumCell(row, "status", ["planned", "paid", "partially_applied", "settled", "refunded", "waived", "written_off"]),
    notes: nullableStringCell(row, "notes"),
    createdByUserId: nullableStringCell(row, "created_by_user_id"),
    createdAt: timestampCell(row, "created_at"),
    updatedAt: timestampCell(row, "updated_at")
  };
}

function toOfficeAdvanceApplication(row: PgRow): OfficeAdvanceApplicationRow {
  return {
    id: stringCell(row, "id"),
    advanceId: stringCell(row, "advance_id"),
    appliedOn: dateCell(row, "applied_on"),
    amountMinor: bigintCell(row, "amount_minor"),
    kind: enumCell(row, "kind", ["invoice", "expense", "refund", "write_off"]),
    reference: nullableStringCell(row, "reference"),
    notes: nullableStringCell(row, "notes"),
    createdByUserId: nullableStringCell(row, "created_by_user_id"),
    createdAt: timestampCell(row, "created_at")
  };
}

function toDistributionImportBatchRow(row: PgRow): DistributionReadDataset["importBatches"][number] {
  return {
    id: stringCell(row, "id"),
    source: stringCell(row, "source"),
    fileName: stringCell(row, "file_name"),
    status: enumCell<DistributionImportStatus>(row, "status", ["draft", "processing", "normalized", "completed", "failed", "void"]),
    importedAt: nullableTimestampCell(row, "imported_at")
  };
}

function toDistributionNormalizedEarning(row: PgRow): DistributionReadDataset["normalizedEarnings"][number] {
  return {
    id: stringCell(row, "id"),
    batchId: stringCell(row, "batch_id"),
    dsp: stringCell(row, "dsp"),
    grossAmount: stringCell(row, "gross_amount"),
    quantity: stringCell(row, "quantity"),
    currency: currencyCell(row, "currency"),
    isrc: nullableStringCell(row, "isrc"),
    upc: nullableStringCell(row, "upc"),
    rawTitle: nullableStringCell(row, "raw_title"),
    rawArtist: nullableStringCell(row, "raw_artist"),
    rawLabel: nullableStringCell(row, "raw_label"),
    mappingStatus: enumCell<DistributionMappingStatus>(row, "mapping_status", ["unmapped", "unmatched", "matched", "suspense", "ignored"]),
    calculationStatus: enumCell<DistributionCalculationStatus>(row, "calculation_status", ["pending", "allocated", "calculated", "suspense", "completed", "failed", "running", "error", "excluded"])
  };
}

function toDistributionCalculationRun(row: PgRow): DistributionReadDataset["calculationRuns"][number] {
  return {
    id: stringCell(row, "id"),
    batchId: nullableStringCell(row, "batch_id"),
    status: enumCell<DistributionCalculationStatus>(row, "status", ["pending", "allocated", "calculated", "suspense", "completed", "failed", "running", "error", "excluded"]),
    startedAt: nullableTimestampCell(row, "started_at"),
    finishedAt: nullableTimestampCell(row, "finished_at"),
    createdAt: timestampCell(row, "created_at")
  };
}

function toDistributionEarningAllocation(row: PgRow): DistributionReadDataset["earningAllocations"][number] {
  return {
    id: stringCell(row, "id"),
    earningId: stringCell(row, "earning_id"),
    calculationRunId: stringCell(row, "calculation_run_id"),
    payeeId: stringCell(row, "payee_id"),
    contractId: nullableStringCell(row, "contract_id"),
    trackId: nullableStringCell(row, "track_id"),
    grossAmount: stringCell(row, "gross_amount"),
    grossShare: stringCell(row, "gross_share"),
    recoupmentApplied: stringCell(row, "recoupment_applied"),
    netPayable: stringCell(row, "net_payable"),
    splitPercentage: stringCell(row, "split_percentage"),
    currency: currencyCell(row, "currency"),
    status: enumCell<DistributionAllocationStatus>(row, "status", ["preview", "calculated", "statemented", "posted", "void", "error"]),
    createdAt: timestampCell(row, "created_at")
  };
}

function toDistributionSuspenseItem(row: PgRow): DistributionReadDataset["suspenseItems"][number] {
  return {
    id: stringCell(row, "id"),
    earningId: nullableStringCell(row, "earning_id"),
    amount: stringCell(row, "amount"),
    currency: currencyCell(row, "currency"),
    reasonCode: stringCell(row, "reason_code"),
    resolved: booleanCell(row, "resolved"),
    resolvedAt: nullableTimestampCell(row, "resolved_at"),
    createdAt: timestampCell(row, "created_at")
  };
}

function toDistributionStatement(row: PgRow): DistributionReadDataset["statements"][number] {
  return {
    id: stringCell(row, "id"),
    payeeId: stringCell(row, "payee_id"),
    calculationRunId: nullableStringCell(row, "calculation_run_id"),
    periodStart: dateCell(row, "period_start"),
    periodEnd: dateCell(row, "period_end"),
    currency: currencyCell(row, "currency"),
    grossTotal: stringCell(row, "gross_total"),
    recoupmentTotal: stringCell(row, "recoupment_total"),
    netPayable: stringCell(row, "net_payable"),
    amountDue: stringCell(row, "amount_due"),
    version: numberCell(row, "version"),
    status: enumCell<DistributionStatementStatus>(row, "status", ["draft", "generated", "locked", "sent", "paid", "void"]),
    createdAt: timestampCell(row, "created_at")
  };
}

function toDistributionStatementLine(row: PgRow): DistributionReadDataset["statementLines"][number] {
  return {
    id: stringCell(row, "id"),
    statementId: stringCell(row, "statement_id"),
    earningAllocationId: nullableStringCell(row, "earning_allocation_id"),
    trackId: nullableStringCell(row, "track_id"),
    grossShare: stringCell(row, "gross_share"),
    recoupmentApplied: stringCell(row, "recoupment_applied"),
    netPayable: stringCell(row, "net_payable"),
    quantity: stringCell(row, "quantity"),
    currency: currencyCell(row, "currency")
  };
}

function toDistributionStatementPaymentLink(row: PgRow): DistributionReadDataset["statementPaymentLinks"][number] {
  return {
    id: stringCell(row, "id"),
    statementId: stringCell(row, "statement_id"),
    paymentId: stringCell(row, "payment_id"),
    amountApplied: stringCell(row, "amount_applied")
  };
}

function toDistributionPayment(row: PgRow): DistributionReadDataset["payments"][number] {
  return {
    id: stringCell(row, "id"),
    payeeId: stringCell(row, "payee_id"),
    amount: stringCell(row, "amount"),
    currency: currencyCell(row, "currency"),
    exchangeRate: nullableStringCell(row, "exchange_rate"),
    method: stringCell(row, "method"),
    status: enumCell<DistributionPaymentStatus>(row, "status", ["recorded", "edited", "void", "reconciled"]),
    paidAt: nullableTimestampCell(row, "paid_at"),
    reference: nullableStringCell(row, "reference"),
    notes: nullableStringCell(row, "notes")
  };
}

function toDistributionPayee(row: PgRow): DistributionReadDataset["payees"][number] {
  return {
    id: stringCell(row, "id"),
    name: stringCell(row, "name"),
    email: nullableStringCell(row, "email"),
    preferredCurrency: currencyCell(row, "preferred_currency"),
    isActive: booleanCell(row, "is_active")
  };
}

function toDistributionRelease(row: PgRow): DistributionReadDataset["releases"][number] {
  return {
    id: stringCell(row, "id"),
    title: stringCell(row, "title"),
    artistName: stringCell(row, "artist_name"),
    catalogStatus: stringCell(row, "catalog_status"),
    upc: nullableStringCell(row, "upc"),
    releaseDate: nullableDateCell(row, "release_date")
  };
}

function toDistributionTrack(row: PgRow): DistributionReadDataset["tracks"][number] {
  return {
    id: stringCell(row, "id"),
    title: stringCell(row, "title"),
    artistName: stringCell(row, "artist_name"),
    catalogStatus: stringCell(row, "catalog_status"),
    isrc: nullableStringCell(row, "isrc"),
    releaseId: nullableStringCell(row, "release_id")
  };
}

async function readOfficePartnerPayeeLinks(pool: Pool): Promise<Readonly<Record<string, OfficePartnerPayeeLink>>> {
  const rows = await queryRows(
    pool,
    `select il.office_partner_id::text, op.name as partner_name, il.payee_id::text, p.name as payee_name,
      p.is_active as payee_is_active, il.confidence::text
     from identity_link il
     join partners op on op.id = il.office_partner_id
     join payees p on p.id = il.payee_id
     where il.status = 'linked'
     order by il.updated_at desc, il.created_at desc, il.id`,
    []
  );
  const links: Record<string, OfficePartnerPayeeLink> = {};
  for (const row of rows) {
    const partnerId = stringCell(row, "office_partner_id");
    if (links[partnerId] !== undefined) {
      continue;
    }

    links[partnerId] = {
      partnerId,
      partnerName: stringCell(row, "partner_name"),
      payeeId: stringCell(row, "payee_id"),
      payeeName: stringCell(row, "payee_name"),
      resolution: "stored_link",
      status: booleanCell(row, "payee_is_active") ? "active" : "inactive",
      source: "identity_link",
      confidence: stringCell(row, "confidence")
    };
  }

  return links;
}

function sslForDatabaseUrl(databaseUrl: string): false | { readonly rejectUnauthorized: boolean } {
  const parsed = new URL(databaseUrl);
  const sslMode = parsed.searchParams.get("sslmode");
  if (sslMode === "disable") {
    return false;
  }

  return { rejectUnauthorized: false };
}

async function queryRows(pool: Pool, sql: string, values: readonly unknown[]): Promise<readonly PgRow[]> {
  const result = await pool.query(sql, values);
  return result.rows;
}

async function readCount(pool: Pool, tableName: string): Promise<number> {
  const rows = await queryRows(pool, `select count(*)::text as n from ${quoteIdentifier(tableName)}`, []);
  const first = rows[0];
  if (first === undefined) {
    throw new Error(`Postgres count returned no row for ${tableName}.`);
  }

  return numberFromText(stringCell(first, "n"), `${tableName}.count`);
}

function emptyRecord<TValue>(): Readonly<Record<string, TValue>> {
  return {};
}

function stringCell(row: PgRow, columnName: string): string {
  const value = row[columnName];
  if (value === null || value === undefined) {
    throw new Error(`Postgres row is missing required column ${columnName}.`);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function nullableStringCell(row: PgRow, columnName: string): string | null {
  const value = row[columnName];
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function booleanCell(row: PgRow, columnName: string): boolean {
  const value = row[columnName];
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Postgres column ${columnName} is not boolean.`);
}

function bigintCell(row: PgRow, columnName: string): bigint {
  return BigInt(stringCell(row, columnName));
}

function nullableBigintCell(row: PgRow, columnName: string): bigint | null {
  const value = nullableStringCell(row, columnName);
  return value === null ? null : BigInt(value);
}

function nullableIntegerCell(row: PgRow, columnName: string): number | null {
  const value = nullableStringCell(row, columnName);
  return value === null ? null : numberFromText(value, columnName);
}

function numberCell(row: PgRow, columnName: string): number {
  return numberFromText(stringCell(row, columnName), columnName);
}

function numberFromText(value: string, label: string): number {
  if (!/^-?\d+$/u.test(value)) {
    throw new Error(`Postgres column ${label} is not an integer: ${value}.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Postgres column ${label} is outside safe integer range: ${value}.`);
  }

  return parsed;
}

function timestampCell(row: PgRow, columnName: string): string {
  const value = stringCell(row, columnName);
  return value.includes("T") ? value : `${value.replace(" ", "T")}.000Z`;
}

function nullableTimestampCell(row: PgRow, columnName: string): string | null {
  const value = nullableStringCell(row, columnName);
  if (value === null) {
    return null;
  }

  return value.includes("T") ? value : `${value.replace(" ", "T")}.000Z`;
}

function dateCell(row: PgRow, columnName: string): string {
  return stringCell(row, columnName).slice(0, 10);
}

function nullableDateCell(row: PgRow, columnName: string): string | null {
  return nullableStringCell(row, columnName)?.slice(0, 10) ?? null;
}

function currencyCell(row: PgRow, columnName: string): CurrencyCode {
  const value = stringCell(row, columnName);
  if (!/^[A-Z]{3}$/u.test(value)) {
    throw new Error(`Postgres column ${columnName} is not a 3-letter currency: ${value}.`);
  }

  return value as CurrencyCode;
}

function nullableCurrencyCell(row: PgRow, columnName: string): CurrencyCode | null {
  const value = nullableStringCell(row, columnName);
  if (value === null) {
    return null;
  }

  if (!/^[A-Z]{3}$/u.test(value)) {
    throw new Error(`Postgres column ${columnName} is not a 3-letter currency: ${value}.`);
  }

  return value as CurrencyCode;
}

function jsonRecordCell(row: PgRow, columnName: string): Readonly<Record<string, unknown>> {
  const value = row[columnName];
  if (value === null || value === undefined) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Postgres column ${columnName} is not a JSON object.`);
  }

  return value as Readonly<Record<string, unknown>>;
}

function enumCell<TValue extends string>(row: PgRow, columnName: string, allowed: readonly TValue[]): TValue {
  const value = stringCell(row, columnName);
  for (const candidate of allowed) {
    if (value === candidate) {
      return candidate;
    }
  }

  throw new Error(`Postgres column ${columnName} has unsupported value ${value}.`);
}

function percentageToBasisPoints(value: string): number {
  const [whole = "0", fraction = ""] = value.split(".");
  const scaled = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  const parsed = Number(scaled);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Percentage is outside basis-point range: ${value}.`);
  }

  return parsed;
}

function toApiContractStatus(value: string): DistributionContract["status"] {
  if (value === "active" || value === "draft" || value === "paused") {
    return value;
  }

  return "ended";
}

function toApiExpenseStatus(value: string): DistributionContractExpense["status"] {
  if (value === "recovered" || value === "satisfied") {
    return "recouped";
  }

  if (value === "cancelled" || value === "deleted" || value === "non_recoverable") {
    return "waived";
  }

  return "open";
}

function toApiExpenseCategory(value: string | null): DistributionContractExpense["category"] {
  if (value === "advance" || value === "recoupment" || value === "studio" || value === "marketing" || value === "distribution") {
    return value;
  }

  return "other";
}

function isOpenExpenseStatus(value: string): boolean {
  return toApiExpenseStatus(value) === "open";
}

function toApiMappingStatus(value: string): DistributionMappingRow["status"] {
  if (value === "matched") {
    return "mapped";
  }

  if (value === "unmapped" || value === "unmatched" || value === "suspense") {
    return "unmapped";
  }

  return "suggested";
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}.`);
  }

  return `"${identifier}"`;
}
