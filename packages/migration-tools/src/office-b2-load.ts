import {
  officeB2LiveContract,
  readGlobalPnl,
  transformOfficeLegacyDump,
  countOfficeB2TransactionStatuses,
  type OfficeAnalyticsDataset,
  type OfficeB2Contract,
  type OfficeB2ExpectedCounts,
  type OfficeB2TransactionStatusCounts,
  type OfficeB2TransformResult,
  type OfficeTransactionRow
} from "@ehq/domain-office";
import { eofMoney } from "@ehq/domain-finance";
import { legacyIntegerId, legacyUuidForTable } from "./legacy-uuid.js";
import { buildLegacyOfficeDumpFromSql, type OfficeDumpBuildResult } from "./office-dump.js";
import {
  createMigratedPgliteTarget,
  PgliteInsertError,
  type PgliteInsertFailure
} from "./pglite-target.js";
import {
  collectDiagnosticRowIdentity,
  createPgliteDiagnosticAccumulator,
  createPgliteDiagnosticReport,
  formatPgliteDiagnosticReport,
  readPgliteDiagnosticSchema,
  registerDiagnosticTables,
  serializePgliteDiagnosticReport,
  validateDiagnosticRow,
  type DiagnosticRow,
  type PgliteDiagnosticReport
} from "./pglite-diagnostic.js";
import {
  assertTargetTablesEmpty,
  createPostgresTargetFromEnvWithProgress,
  insertSqlRowsBatched,
  quoteIdentifier,
  readSqlTableColumns,
  readSqlTableRowCount,
  SqlInsertError,
  TargetNotEmptyError,
  withReadOnlySqlTransaction,
  type ClosableSqlQueryClient,
  type NonEmptyTargetTable,
  type ProgressLogger,
  type SqlInsertFailure,
  type SqlQueryClient,
  type SqlQueryResult
} from "./sql-target.js";

export type OfficeB2LoadSourceMode = "mysql-dump-insert-parser";
export type OfficeB2LoadTargetMode = "in-memory-clean-office";
export type OfficeB2PgliteTargetMode = "pglite-postgres";
export type OfficeB2PostgresTargetMode = "postgres";
export type OfficeB2GateStatus = "pass";
export type OfficeB2PgliteStatus = "pass" | "fail";
export type OfficeB2PostgresStatus = "pass" | "fail";
export type OfficeVerbatimTemporalKind = "date" | "timestamp";

export interface OfficeB2LoadRequest {
  readonly generatedAt: string;
  readonly sourceLabel: string;
  readonly contract: OfficeB2Contract;
}

export interface OfficeB2LoadReport {
  readonly generatedAt: string;
  readonly source: OfficeB2LoadSourceReport;
  readonly ingestionGuard: OfficeB2GateReport;
  readonly qualityGuard: OfficeB2QualityGuardReport;
  readonly target: OfficeB2TargetReport;
  readonly parity: OfficeB2ParityGateReport;
  readonly expectedDivergences: readonly OfficeB2ExpectedDivergenceReport[];
  readonly notes: readonly string[];
}

export interface OfficeB2PgliteValidationReport {
  readonly generatedAt: string;
  readonly source: OfficeB2LoadSourceReport;
  readonly target: OfficeB2PgliteTargetReport;
  readonly status: OfficeB2PgliteStatus;
  readonly ingestionGuard: OfficeB2GateReport;
  readonly qualityGuard: OfficeB2QualityGuardReport;
  readonly loadedRows: OfficeB2LoadedRowCounts;
  readonly parity: OfficeB2ParityGateReport | null;
  readonly failure: PgliteInsertFailure | null;
  readonly expectedDivergences: readonly OfficeB2ExpectedDivergenceReport[];
  readonly notes: readonly string[];
}

export interface OfficeB2PostgresLoadOptions {
  readonly force: boolean;
  readonly reset: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly progress: ProgressLogger;
}

export type OfficeB2PostgresVerifyMode = "full" | "lite";

export interface OfficeB2PostgresVerifyOptions {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly progress: ProgressLogger;
  readonly mode: OfficeB2PostgresVerifyMode;
  readonly sql: string | null;
}

export interface OfficeB2PostgresLoadReport {
  readonly generatedAt: string;
  readonly source: OfficeB2LoadSourceReport;
  readonly target: OfficeB2PostgresTargetReport;
  readonly status: OfficeB2PostgresStatus;
  readonly ingestionGuard: OfficeB2GateReport;
  readonly qualityGuard: OfficeB2QualityGuardReport;
  readonly loadedRows: OfficeB2LoadedRowCounts;
  readonly parity: OfficeB2ParityGateReport | null;
  readonly failure: SqlInsertFailure | null;
  readonly expectedDivergences: readonly OfficeB2ExpectedDivergenceReport[];
  readonly notes: readonly string[];
}

export interface OfficeB2PostgresVerifyReport {
  readonly generatedAt: string;
  readonly source: OfficeB2PostgresVerifySourceReport;
  readonly target: OfficeB2PostgresVerifyTargetReport;
  readonly status: OfficeB2PostgresStatus;
  readonly tableCounts: Readonly<Record<string, number>>;
  readonly parity: OfficeB2ParityGateReport | null;
  readonly verbatim: OfficeB2PostgresVerbatimReport | null;
  readonly failure: SqlInsertFailure | null;
  readonly expectedDivergences: readonly OfficeB2ExpectedDivergenceReport[];
  readonly notes: readonly string[];
}

export interface OfficeB2PostgresVerbatimReport {
  readonly status: "pass";
  readonly comparedRows: Readonly<Record<string, number>>;
}

export type OfficeB2PgliteDiagnosticReport = PgliteDiagnosticReport;

export interface OfficeB2LoadSourceReport {
  readonly mode: OfficeB2LoadSourceMode;
  readonly label: string;
  readonly sourceDatabaseName: string;
  readonly tablePrefix: string;
  readonly tableRows: OfficeB2ExpectedCounts;
  readonly transactionStatusCounts: OfficeB2TransactionStatusCounts;
  readonly insertStatements: OfficeB2ExpectedCounts;
}

export interface OfficeB2GateReport {
  readonly status: OfficeB2GateStatus;
  readonly expected: OfficeB2ExpectedCounts;
  readonly actual: OfficeB2ExpectedCounts;
}

export interface OfficeB2QualityGuardReport {
  readonly status: OfficeB2GateStatus;
  readonly inconsistentCategories: number;
  readonly emptyCurrencyRows: number;
  readonly allocationSumMismatch: number;
  readonly orphanForeignKeys: number;
  readonly ignoredDivisionNameDrift: number;
}

export interface OfficeB2TargetReport {
  readonly mode: OfficeB2LoadTargetMode;
  readonly schemaContract: "packages/db office migrations 0000-0004 rowset";
  readonly loadedRows: OfficeB2LoadedRowCounts;
  readonly transactionStatusCounts: OfficeB2TransactionStatusCounts;
}

export interface OfficeB2PgliteTargetReport {
  readonly mode: OfficeB2PgliteTargetMode;
  readonly schemaContract: "packages/db migrations 0000-0004 applied in pglite";
  readonly migrationsApplied: readonly string[];
}

export interface OfficeB2PostgresTargetReport {
  readonly mode: OfficeB2PostgresTargetMode;
  readonly schemaContract: "packages/db migrations 0000-0008 already applied";
  readonly force: boolean;
  readonly reset: boolean;
  readonly nonEmptyTables: readonly NonEmptyTargetTable[];
}

export interface OfficeB2PostgresVerifySourceReport {
  readonly mode: "postgres-readback";
  readonly label: string;
  readonly sourceDatabaseName: string;
  readonly tablePrefix: string;
  readonly verificationMode: OfficeB2PostgresVerifyMode;
}

export interface OfficeB2PostgresVerifyTargetReport {
  readonly mode: OfficeB2PostgresTargetMode;
  readonly schemaContract: "packages/db migrations 0000-0008 already applied";
  readonly readOnly: true;
}

export interface OfficeB2LoadedRowCounts {
  readonly departments: number;
  readonly divisions: number;
  readonly categories: number;
  readonly partners: number;
  readonly projects: number;
  readonly projectBudgetLines: number;
  readonly transactions: number;
  readonly financialAllocations: number;
  readonly bankAccounts: number;
  readonly bankImportBatches: number;
  readonly bankStatementLines: number;
  readonly bankReconciliationMatches: number;
  readonly cashflowProjectionRows: number;
}

export interface OfficeB2ParityGateReport {
  readonly rawPostgresEquivalent: OfficeB2ParityCheckReport;
  readonly domainOfficeGlobalPnl: OfficeB2ParityCheckReport;
}

export interface OfficeB2ParityCheckReport {
  readonly status: OfficeB2GateStatus;
  readonly validatedTransactionCount: number;
  readonly incomeMinor: string;
  readonly expenseMinor: string;
  readonly expectedValidatedTransactionCount: number;
  readonly expectedIncomeMinor: string;
  readonly expectedExpenseMinor: string;
}

export interface OfficeB2ExpectedDivergenceReport {
  readonly code: "BUG-M1";
  readonly status: "recorded";
  readonly legacyBehaviour: "org-wide project/partner P&L returns Rs 0";
  readonly newBehaviour: "domain-office returns actual ledger totals";
}

interface OfficeB2RawParity {
  readonly validatedTransactionCount: number;
  readonly incomeMinor: bigint;
  readonly expenseMinor: bigint;
}

interface OfficeCleanTargetSnapshot {
  readonly mode: OfficeB2LoadTargetMode;
  readonly dataset: OfficeAnalyticsDataset;
}

const officeSqlTableNames: readonly string[] = [
  "departments",
  "divisions",
  "categories",
  "partners",
  "projects",
  "project_budget_lines",
  "transactions",
  "financial_allocations",
  "office_bank_accounts",
  "office_bank_import_batches",
  "office_bank_statement_lines",
  "office_bank_reconciliation_matches",
  "office_cashflow_projection_rows"
];

export const officeB2ResetTableNames: readonly string[] = officeSqlTableNames;

export function officeB2CliFlagError(target: string, reset: boolean, verifyOnly: boolean): string | null {
  if (reset && verifyOnly) {
    return "--reset and --verify-only are mutually exclusive.";
  }

  if (reset && target !== "postgres") {
    return "--reset requires --target postgres.";
  }

  if (verifyOnly && target !== "postgres") {
    return "--verify-only requires --target postgres.";
  }

  return null;
}

export function runOfficeB2LoadFromSql(sql: string, request: OfficeB2LoadRequest): OfficeB2LoadReport {
  const dumpBuild = buildLegacyOfficeDumpFromSql(sql, request.contract);
  const transform = transformOfficeLegacyDump(dumpBuild.dump, request.contract);
  const target = loadOfficeCleanTarget(transform.dataset);
  const rawTargetParity = readTargetRawParity(target);
  const engineParity = readEngineGlobalParity(target.dataset);
  assertParity("raw clean target", rawTargetParity, request.contract);
  assertParity("domain-office global P&L", engineParity, request.contract);

  return createReport(request, dumpBuild, transform, target, rawTargetParity, engineParity);
}

export async function runOfficeB2PgliteValidationFromSql(
  sql: string,
  request: OfficeB2LoadRequest
): Promise<OfficeB2PgliteValidationReport> {
  const dumpBuild = buildLegacyOfficeDumpFromSql(sql, request.contract);
  const transform = transformOfficeLegacyDump(dumpBuild.dump, request.contract);
  const { db, migrationsApplied } = await createMigratedPgliteTarget();
  const loadedRows = emptyLoadedRowCounts();

  try {
    await loadOfficeSqlTarget(db, transform.dataset, loadedRows, null);
    const rawTargetParity = await readSqlRawParity(db);
    const engineParity = readEngineGlobalParity(await readSqlGlobalPnlDataset(db));
    assertParity("pglite raw target", rawTargetParity, request.contract);
    assertParity("domain-office transformed P&L", engineParity, request.contract);

    return createPgliteValidationReport(
      request,
      dumpBuild,
      transform,
      migrationsApplied,
      loadedRows,
      {
        rawPostgresEquivalent: parityCheck(rawTargetParity, request.contract),
        domainOfficeGlobalPnl: parityCheck(engineParity, request.contract)
      },
      null,
      "pass"
    );
  } catch (error: unknown) {
    const failure: PgliteInsertFailure = toPgliteFailure(error);
    return createPgliteValidationReport(
      request,
      dumpBuild,
      transform,
      migrationsApplied,
      loadedRows,
      null,
      failure,
      "fail"
    );
  } finally {
    await db.close();
  }
}

export async function runOfficeB2PostgresLoadFromSql(
  sql: string,
  request: OfficeB2LoadRequest,
  options: OfficeB2PostgresLoadOptions
): Promise<OfficeB2PostgresLoadReport> {
  const dumpBuild = buildLegacyOfficeDumpFromSql(sql, request.contract);
  const transform = transformOfficeLegacyDump(dumpBuild.dump, request.contract);
  const loadedRows = emptyLoadedRowCounts();
  const client: ClosableSqlQueryClient = await createPostgresTargetFromEnvWithProgress(options.env, options.progress);
  let nonEmptyTables: readonly NonEmptyTargetTable[] = [];

  try {
    if (options.reset) {
      await resetOfficeSqlTarget(client, officeSqlTableNames, options.progress);
    } else {
      nonEmptyTables = await assertTargetTablesEmpty(client, officeSqlTableNames, options.force);
    }

    await loadOfficeSqlTarget(client, transform.dataset, loadedRows, options.progress);
    options.progress("→ reading back from DB to verify…");
    const rawTargetParity = await readSqlRawParity(client);
    const engineParity = readEngineGlobalParity(await readSqlGlobalPnlDataset(client));
    assertParity("postgres raw target", rawTargetParity, request.contract);
    assertParity("domain-office postgres P&L", engineParity, request.contract);
    options.progress(
      `✓ office goldens: ${String(rawTargetParity.validatedTransactionCount)} validated, income ${rawTargetParity.incomeMinor.toString()} c, expense ${rawTargetParity.expenseMinor.toString()} c`
    );

    return createPostgresLoadReport(
      request,
      dumpBuild,
      transform,
      loadedRows,
      {
        rawPostgresEquivalent: parityCheck(rawTargetParity, request.contract),
        domainOfficeGlobalPnl: parityCheck(engineParity, request.contract)
      },
      null,
      "pass",
      options.force,
      options.reset,
      nonEmptyTables
    );
  } catch (error: unknown) {
    return createPostgresLoadReport(
      request,
      dumpBuild,
      transform,
      loadedRows,
      null,
      toSqlFailure(error, "office-postgres-load"),
      "fail",
      options.force,
      options.reset,
      nonEmptyTables
    );
  } finally {
    await client.close();
  }
}

export async function runOfficeB2PostgresVerifyOnly(
  request: OfficeB2LoadRequest,
  options: OfficeB2PostgresVerifyOptions
): Promise<OfficeB2PostgresVerifyReport> {
  const client: ClosableSqlQueryClient = await createPostgresTargetFromEnvWithProgress(options.env, options.progress);

  try {
    const transform = options.sql === null
      ? null
      : transformOfficeLegacyDump(buildLegacyOfficeDumpFromSql(options.sql, request.contract).dump, request.contract);

    return await withReadOnlySqlTransaction(client, async (readOnlyClient) => {
      options.progress("→ reading back from DB to verify…");
      const tableCounts = await readOfficeSqlTableCounts(readOnlyClient, options.progress);
      const rawTargetParity = await readSqlRawParity(readOnlyClient);
      const engineParity = readEngineGlobalParity(await readSqlGlobalPnlDataset(readOnlyClient));
      assertParity("postgres verify raw target", rawTargetParity, request.contract);
      options.progress(
        `✓ office raw parity: ${String(rawTargetParity.validatedTransactionCount)} validated, income ${rawTargetParity.incomeMinor.toString()} c, expense ${rawTargetParity.expenseMinor.toString()} c`
      );
      assertParity("domain-office postgres verify P&L", engineParity, request.contract);
      options.progress(
        `✓ office P&L parity: ${String(engineParity.validatedTransactionCount)} validated, income ${engineParity.incomeMinor.toString()} c, expense ${engineParity.expenseMinor.toString()} c`
      );
      const verbatim = transform === null
        ? null
        : await readOfficeSqlVerbatimReport(readOnlyClient, transform.dataset, options.progress);

      return createPostgresVerifyReport(
        request,
        options.mode,
        tableCounts,
        {
          rawPostgresEquivalent: parityCheck(rawTargetParity, request.contract),
          domainOfficeGlobalPnl: parityCheck(engineParity, request.contract)
        },
        verbatim,
        null,
        "pass"
      );
    });
  } catch (error: unknown) {
    return createPostgresVerifyReport(
      request,
      options.mode,
      {},
      null,
      null,
      toSqlFailure(error, "office-postgres-verify"),
      "fail"
    );
  } finally {
    await client.close();
  }
}

export async function runOfficeB2PgliteDiagnosticFromSql(
  sql: string,
  request: OfficeB2LoadRequest
): Promise<OfficeB2PgliteDiagnosticReport> {
  const dumpBuild = buildLegacyOfficeDumpFromSql(sql, request.contract);
  const transform = transformOfficeLegacyDump(dumpBuild.dump, request.contract);
  const { db, migrationsApplied } = await createMigratedPgliteTarget();

  try {
    const rowsByTable = buildOfficeDiagnosticRows(transform.dataset);
    const schema = await readPgliteDiagnosticSchema(db, [...rowsByTable.keys()]);
    const accumulator = createPgliteDiagnosticAccumulator();
    registerDiagnosticTables(accumulator, [...rowsByTable.keys()]);

    for (const [tableName, rows] of rowsByTable.entries()) {
      for (const row of rows) {
        collectDiagnosticRowIdentity(accumulator, tableName, row);
      }
    }

    for (const [tableName, rows] of rowsByTable.entries()) {
      for (const row of rows) {
        validateDiagnosticRow(schema, accumulator, tableName, row);
      }
    }

    return createPgliteDiagnosticReport(request.generatedAt, request.sourceLabel, migrationsApplied, accumulator);
  } finally {
    await db.close();
  }
}

export function createOfficeB2LoadRequest(generatedAt: string, sourceLabel: string): OfficeB2LoadRequest {
  return {
    generatedAt,
    sourceLabel,
    contract: officeB2LiveContract
  };
}

export function serializeOfficeB2LoadReport(report: OfficeB2LoadReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function serializeOfficeB2PgliteValidationReport(report: OfficeB2PgliteValidationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function serializeOfficeB2PostgresLoadReport(report: OfficeB2PostgresLoadReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function serializeOfficeB2PostgresVerifyReport(report: OfficeB2PostgresVerifyReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function serializeOfficeB2PgliteDiagnosticReport(report: OfficeB2PgliteDiagnosticReport): string {
  return serializePgliteDiagnosticReport(report);
}

export function formatOfficeB2LoadReport(report: OfficeB2LoadReport): string {
  return [
    "# Office B2 parity report",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source.label}`,
    `Source mode: ${report.source.mode}`,
    `Target mode: ${report.target.mode}`,
    "",
    "## Ingestion guard",
    `Status: ${report.ingestionGuard.status}`,
    `Transactions: ${String(report.ingestionGuard.actual.transactions)} / ${String(report.ingestionGuard.expected.transactions)}`,
    `Financial allocations: ${String(report.ingestionGuard.actual.financialAllocations)} / ${String(report.ingestionGuard.expected.financialAllocations)}`,
    `Categories: ${String(report.ingestionGuard.actual.categories)} / ${String(report.ingestionGuard.expected.categories)}`,
    `Departments: ${String(report.ingestionGuard.actual.departments)} / ${String(report.ingestionGuard.expected.departments)}`,
    `Partners: ${String(report.ingestionGuard.actual.partners)} / ${String(report.ingestionGuard.expected.partners)}`,
    `Projects: ${String(report.ingestionGuard.actual.projects)} / ${String(report.ingestionGuard.expected.projects)}`,
    `Bank accounts: ${String(report.ingestionGuard.actual.bankAccounts)} / ${String(report.ingestionGuard.expected.bankAccounts)}`,
    `Bank raw transactions: ${String(report.ingestionGuard.actual.bankRawTransactions)} / ${String(report.ingestionGuard.expected.bankRawTransactions)}`,
    `Bank reconciliations: ${String(report.ingestionGuard.actual.bankReconciliations)} / ${String(report.ingestionGuard.expected.bankReconciliations)}`,
    `Transaction statuses: validated ${String(report.source.transactionStatusCounts.validated)}, draft ${String(report.source.transactionStatusCounts.draft)}, cancelled ${String(report.source.transactionStatusCounts.cancelled)}`,
    "",
    "## Parity",
    `Raw clean target: ${report.parity.rawPostgresEquivalent.status} (${report.parity.rawPostgresEquivalent.validatedTransactionCount} validated, income ${report.parity.rawPostgresEquivalent.incomeMinor} c, expense ${report.parity.rawPostgresEquivalent.expenseMinor} c)`,
    `domain-office P&L: ${report.parity.domainOfficeGlobalPnl.status} (${report.parity.domainOfficeGlobalPnl.validatedTransactionCount} validated, income ${report.parity.domainOfficeGlobalPnl.incomeMinor} c, expense ${report.parity.domainOfficeGlobalPnl.expenseMinor} c)`,
    "",
    "## Expected divergence",
    ...report.expectedDivergences.map((divergence) => `${divergence.code}: ${divergence.status} - legacy ${divergence.legacyBehaviour}; new ${divergence.newBehaviour}.`),
    "",
    "## Notes",
    ...report.notes.map((note) => `- ${note}`),
    ""
  ].join("\n");
}

export function formatOfficeB2PgliteValidationReport(report: OfficeB2PgliteValidationReport): string {
  return [
    "# Office E2 Phase 0 pglite report",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source.label}`,
    `Source mode: ${report.source.mode}`,
    `Target mode: ${report.target.mode}`,
    `Status: ${report.status}`,
    `Migrations applied: ${report.target.migrationsApplied.join(", ")}`,
    "",
    "## Ingestion guard",
    `Transactions: ${String(report.ingestionGuard.actual.transactions)} / ${String(report.ingestionGuard.expected.transactions)}`,
    `Financial allocations: ${String(report.ingestionGuard.actual.financialAllocations)} / ${String(report.ingestionGuard.expected.financialAllocations)}`,
    `Categories: ${String(report.ingestionGuard.actual.categories)} / ${String(report.ingestionGuard.expected.categories)}`,
    `Departments: ${String(report.ingestionGuard.actual.departments)} / ${String(report.ingestionGuard.expected.departments)}`,
    `Partners: ${String(report.ingestionGuard.actual.partners)} / ${String(report.ingestionGuard.expected.partners)}`,
    `Projects: ${String(report.ingestionGuard.actual.projects)} / ${String(report.ingestionGuard.expected.projects)}`,
    `Bank accounts: ${String(report.ingestionGuard.actual.bankAccounts)} / ${String(report.ingestionGuard.expected.bankAccounts)}`,
    `Bank raw transactions: ${String(report.ingestionGuard.actual.bankRawTransactions)} / ${String(report.ingestionGuard.expected.bankRawTransactions)}`,
    `Bank reconciliations: ${String(report.ingestionGuard.actual.bankReconciliations)} / ${String(report.ingestionGuard.expected.bankReconciliations)}`,
    "",
    report.status === "pass" ? "## Loaded rows" : "## Loaded rows before failure",
    ...Object.entries(report.loadedRows).map(([name, count]) => `${name}: ${String(count)}`),
    "",
    "## Pglite parity",
    report.parity === null
      ? "Not reached because the pglite constraint load failed first."
      : `Raw pglite target: ${report.parity.rawPostgresEquivalent.status} (${report.parity.rawPostgresEquivalent.validatedTransactionCount} validated, income ${report.parity.rawPostgresEquivalent.incomeMinor} c, expense ${report.parity.rawPostgresEquivalent.expenseMinor} c)`,
    report.parity === null
      ? ""
      : `domain-office P&L: ${report.parity.domainOfficeGlobalPnl.status} (${report.parity.domainOfficeGlobalPnl.validatedTransactionCount} validated, income ${report.parity.domainOfficeGlobalPnl.incomeMinor} c, expense ${report.parity.domainOfficeGlobalPnl.expenseMinor} c)`,
    "## Failure",
    report.failure === null
      ? "None."
      : `${report.failure.tableName} row ${String(report.failure.rowIndex)}: ${report.failure.message}`,
    "",
    "## Notes",
    ...report.notes.map((note) => `- ${note}`),
    ""
  ].join("\n");
}

export function formatOfficeB2PostgresLoadReport(report: OfficeB2PostgresLoadReport): string {
  return [
    "# Office E2 Phase 2 postgres load report",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source.label}`,
    `Source mode: ${report.source.mode}`,
    `Target mode: ${report.target.mode}`,
    `Status: ${report.status}`,
    `Force: ${String(report.target.force)}`,
    `Reset: ${String(report.target.reset)}`,
    "",
    report.target.reset ? "## Reset" : "## Anti-double-load guard",
    report.target.reset
      ? "Office B2 target tables were truncated by --reset before load."
      : report.target.nonEmptyTables.length === 0
        ? "All target tables were empty before load."
        : `Non-empty tables: ${report.target.nonEmptyTables.map((table) => `${table.tableName}=${String(table.rowCount)}`).join(", ")}`,
    "",
    "## Loaded rows",
    ...Object.entries(report.loadedRows).map(([name, count]) => `${name}: ${String(count)}`),
    "",
    "## Postgres parity",
    report.parity === null
      ? "Not reached because the postgres load failed first."
      : `Raw postgres target: ${report.parity.rawPostgresEquivalent.status} (${report.parity.rawPostgresEquivalent.validatedTransactionCount} validated, income ${report.parity.rawPostgresEquivalent.incomeMinor} c, expense ${report.parity.rawPostgresEquivalent.expenseMinor} c)`,
    report.parity === null
      ? ""
      : `domain-office P&L: ${report.parity.domainOfficeGlobalPnl.status} (${report.parity.domainOfficeGlobalPnl.validatedTransactionCount} validated, income ${report.parity.domainOfficeGlobalPnl.incomeMinor} c, expense ${report.parity.domainOfficeGlobalPnl.expenseMinor} c)`,
    "## Failure",
    report.failure === null
      ? "None."
      : `${report.failure.tableName} row ${String(report.failure.rowIndex)}: ${report.failure.message}`,
    "",
    "## Expected divergence",
    ...report.expectedDivergences.map((divergence) => `${divergence.code}: ${divergence.status} - legacy ${divergence.legacyBehaviour}; new ${divergence.newBehaviour}.`),
    "",
    "## Notes",
    ...report.notes.map((note) => `- ${note}`),
    ""
  ].join("\n");
}

export function formatOfficeB2PostgresVerifyReport(report: OfficeB2PostgresVerifyReport): string {
  return [
    "# Office E2 Phase 2 postgres verify report",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source.label}`,
    `Source mode: ${report.source.mode}`,
    `Verification mode: ${report.source.verificationMode}`,
    `Target mode: ${report.target.mode}`,
    `Status: ${report.status}`,
    `Read only: ${String(report.target.readOnly)}`,
    "",
    "## Table counts",
    ...Object.entries(report.tableCounts).map(([name, count]) => `${name}: ${String(count)}`),
    "",
    "## Postgres parity",
    report.parity === null
      ? "Not reached because postgres verify failed first."
      : `Raw postgres target: ${report.parity.rawPostgresEquivalent.status} (${report.parity.rawPostgresEquivalent.validatedTransactionCount} validated, income ${report.parity.rawPostgresEquivalent.incomeMinor} c, expense ${report.parity.rawPostgresEquivalent.expenseMinor} c)`,
    report.parity === null
      ? ""
      : `domain-office P&L: ${report.parity.domainOfficeGlobalPnl.status} (${report.parity.domainOfficeGlobalPnl.validatedTransactionCount} validated, income ${report.parity.domainOfficeGlobalPnl.incomeMinor} c, expense ${report.parity.domainOfficeGlobalPnl.expenseMinor} c)`,
    report.verbatim === null
      ? "Verbatim legacy_id rows: skipped (lite mode)."
      : `Verbatim legacy_id rows: ${report.verbatim.status} (${Object.entries(report.verbatim.comparedRows).map(([name, count]) => `${name} ${String(count)}`).join(", ")})`,
    "",
    "## Failure",
    report.failure === null
      ? "None."
      : `${report.failure.tableName} row ${String(report.failure.rowIndex)}: ${report.failure.message}`,
    "",
    "## Expected divergence",
    ...report.expectedDivergences.map((divergence) => `${divergence.code}: ${divergence.status} - legacy ${divergence.legacyBehaviour}; new ${divergence.newBehaviour}.`),
    "",
    "## Notes",
    ...report.notes.map((note) => `- ${note}`),
    ""
  ].join("\n");
}

export function formatOfficeB2PgliteDiagnosticReport(report: OfficeB2PgliteDiagnosticReport): string {
  return formatPgliteDiagnosticReport("Office E2 Phase 0c pglite diagnostic", report);
}

function createReport(
  request: OfficeB2LoadRequest,
  dumpBuild: OfficeDumpBuildResult,
  transform: OfficeB2TransformResult,
  target: OfficeCleanTargetSnapshot,
  rawTargetParity: OfficeB2RawParity,
  engineParity: OfficeB2RawParity
): OfficeB2LoadReport {
  const actualCounts = sourceCountsFromDumpBuild(dumpBuild);
  const sourceTransactionStatusCounts = countOfficeB2TransactionStatuses(dumpBuild.dump.transactions, "Office B2 load source");
  return {
    generatedAt: request.generatedAt,
    source: {
      mode: "mysql-dump-insert-parser",
      label: request.sourceLabel,
      sourceDatabaseName: request.contract.sourceDatabaseName,
      tablePrefix: request.contract.tablePrefix,
      tableRows: actualCounts,
      transactionStatusCounts: sourceTransactionStatusCounts,
      insertStatements: insertStatementCounts(dumpBuild)
    },
    ingestionGuard: {
      status: "pass",
      expected: request.contract.expectedCounts,
      actual: actualCounts
    },
    qualityGuard: {
      status: "pass",
      inconsistentCategories: request.contract.expectedQuality.inconsistentCategories,
      emptyCurrencyRows: request.contract.expectedQuality.emptyCurrencyRows,
      allocationSumMismatch: request.contract.expectedQuality.allocationSumMismatch,
      orphanForeignKeys: request.contract.expectedQuality.orphanForeignKeys,
      ignoredDivisionNameDrift: transform.ignoredDivisionNameDriftCount
    },
    target: {
      mode: target.mode,
      schemaContract: "packages/db office migrations 0000-0004 rowset",
      loadedRows: loadedRowCounts(target.dataset),
      transactionStatusCounts: countOfficeB2TransactionStatuses(target.dataset.transactions, "Office B2 load target")
    },
    parity: {
      rawPostgresEquivalent: parityCheck(rawTargetParity, request.contract),
      domainOfficeGlobalPnl: parityCheck(engineParity, request.contract)
    },
    expectedDivergences: [
      {
        code: "BUG-M1",
        status: "recorded",
        legacyBehaviour: "org-wide project/partner P&L returns Rs 0",
        newBehaviour: "domain-office returns actual ledger totals"
      }
    ],
    notes: transform.notes
  };
}

function createPgliteValidationReport(
  request: OfficeB2LoadRequest,
  dumpBuild: OfficeDumpBuildResult,
  transform: OfficeB2TransformResult,
  migrationsApplied: readonly string[],
  loadedRows: OfficeB2LoadedRowCounts,
  parity: OfficeB2ParityGateReport | null,
  failure: PgliteInsertFailure | null,
  status: OfficeB2PgliteStatus
): OfficeB2PgliteValidationReport {
  const actualCounts = sourceCountsFromDumpBuild(dumpBuild);
  return {
    generatedAt: request.generatedAt,
    source: {
      mode: "mysql-dump-insert-parser",
      label: request.sourceLabel,
      sourceDatabaseName: request.contract.sourceDatabaseName,
      tablePrefix: request.contract.tablePrefix,
      tableRows: actualCounts,
      transactionStatusCounts: countOfficeB2TransactionStatuses(dumpBuild.dump.transactions, "Office B2 pglite source"),
      insertStatements: insertStatementCounts(dumpBuild)
    },
    target: {
      mode: "pglite-postgres",
      schemaContract: "packages/db migrations 0000-0004 applied in pglite",
      migrationsApplied
    },
    status,
    ingestionGuard: {
      status: "pass",
      expected: request.contract.expectedCounts,
      actual: actualCounts
    },
    qualityGuard: {
      status: "pass",
      inconsistentCategories: request.contract.expectedQuality.inconsistentCategories,
      emptyCurrencyRows: request.contract.expectedQuality.emptyCurrencyRows,
      allocationSumMismatch: request.contract.expectedQuality.allocationSumMismatch,
      orphanForeignKeys: request.contract.expectedQuality.orphanForeignKeys,
      ignoredDivisionNameDrift: transform.ignoredDivisionNameDriftCount
    },
    loadedRows,
    parity,
    failure,
    expectedDivergences: [
      {
        code: "BUG-M1",
        status: "recorded",
        legacyBehaviour: "org-wide project/partner P&L returns Rs 0",
        newBehaviour: "domain-office returns actual ledger totals"
      }
    ],
    notes: transform.notes
  };
}

function createPostgresLoadReport(
  request: OfficeB2LoadRequest,
  dumpBuild: OfficeDumpBuildResult,
  transform: OfficeB2TransformResult,
  loadedRows: OfficeB2LoadedRowCounts,
  parity: OfficeB2ParityGateReport | null,
  failure: SqlInsertFailure | null,
  status: OfficeB2PostgresStatus,
  force: boolean,
  reset: boolean,
  nonEmptyTables: readonly NonEmptyTargetTable[]
): OfficeB2PostgresLoadReport {
  const actualCounts = sourceCountsFromDumpBuild(dumpBuild);
  return {
    generatedAt: request.generatedAt,
    source: {
      mode: "mysql-dump-insert-parser",
      label: request.sourceLabel,
      sourceDatabaseName: request.contract.sourceDatabaseName,
      tablePrefix: request.contract.tablePrefix,
      tableRows: actualCounts,
      transactionStatusCounts: countOfficeB2TransactionStatuses(dumpBuild.dump.transactions, "Office B2 postgres source"),
      insertStatements: insertStatementCounts(dumpBuild)
    },
    target: {
      mode: "postgres",
      schemaContract: "packages/db migrations 0000-0008 already applied",
      force,
      reset,
      nonEmptyTables
    },
    status,
    ingestionGuard: {
      status: "pass",
      expected: request.contract.expectedCounts,
      actual: actualCounts
    },
    qualityGuard: {
      status: "pass",
      inconsistentCategories: request.contract.expectedQuality.inconsistentCategories,
      emptyCurrencyRows: request.contract.expectedQuality.emptyCurrencyRows,
      allocationSumMismatch: request.contract.expectedQuality.allocationSumMismatch,
      orphanForeignKeys: request.contract.expectedQuality.orphanForeignKeys,
      ignoredDivisionNameDrift: transform.ignoredDivisionNameDriftCount
    },
    loadedRows,
    parity,
    failure,
    expectedDivergences: [
      {
        code: "BUG-M1",
        status: "recorded",
        legacyBehaviour: "org-wide project/partner P&L returns Rs 0",
        newBehaviour: "domain-office returns actual ledger totals"
      }
    ],
    notes: transform.notes
  };
}

function createPostgresVerifyReport(
  request: OfficeB2LoadRequest,
  mode: OfficeB2PostgresVerifyMode,
  tableCounts: Readonly<Record<string, number>>,
  parity: OfficeB2ParityGateReport | null,
  verbatim: OfficeB2PostgresVerbatimReport | null,
  failure: SqlInsertFailure | null,
  status: OfficeB2PostgresStatus
): OfficeB2PostgresVerifyReport {
  return {
    generatedAt: request.generatedAt,
    source: {
      mode: "postgres-readback",
      label: request.sourceLabel,
      sourceDatabaseName: request.contract.sourceDatabaseName,
      tablePrefix: request.contract.tablePrefix,
      verificationMode: mode
    },
    target: {
      mode: "postgres",
      schemaContract: "packages/db migrations 0000-0008 already applied",
      readOnly: true
    },
    status,
    tableCounts,
    parity,
    verbatim,
    failure,
    expectedDivergences: [
      {
        code: "BUG-M1",
        status: "recorded",
        legacyBehaviour: "org-wide project/partner P&L returns Rs 0",
        newBehaviour: "domain-office returns actual ledger totals"
      }
    ],
    notes: [
      "verify-only opens a READ ONLY transaction and skips loading plus the anti-double-load guard.",
      mode === "full"
        ? "dump path was provided for operator traceability; Office verifies the existing post-load read-back parity set."
        : "dump path was omitted; Office verifies the golden constants from live Postgres read-back."
    ]
  };
}

async function loadOfficeSqlTarget(
  db: SqlQueryClient,
  dataset: OfficeAnalyticsDataset,
  loadedRows: OfficeB2LoadedRowCounts,
  progress: ProgressLogger | null
): Promise<void> {
  const mutableLoadedRows = loadedRows as MutableLoadedRowCounts;
  const allocationDepartmentResolution = buildOfficeAllocationDepartmentResolution(dataset);
  await insertOfficeRows(db, "departments", dataset.departments.map(toPgliteDepartmentRow), mutableLoadedRows, "departments", progress);
  await insertOfficeRows(db, "divisions", dataset.divisions.map(toPgliteDivisionRow), mutableLoadedRows, "divisions", progress);
  await insertOfficeRows(db, "categories", dataset.categories.map(toPgliteCategoryRow), mutableLoadedRows, "categories", progress);
  await insertOfficeRows(db, "partners", dataset.partners.map(toPglitePartnerRow), mutableLoadedRows, "partners", progress);
  await insertOfficeRows(db, "projects", dataset.projects.map(toPgliteProjectRow), mutableLoadedRows, "projects", progress);
  await insertOfficeRows(db, "project_budget_lines", dataset.projectBudgetLines.map(toPgliteProjectBudgetLineRow), mutableLoadedRows, "projectBudgetLines", progress);
  await insertOfficeRows(db, "transactions", dataset.transactions.map(toPgliteTransactionRow), mutableLoadedRows, "transactions", progress);
  await insertOfficeRows(
    db,
    "financial_allocations",
    dataset.financialAllocations.map((row) => toPgliteFinancialAllocationRow(row, allocationDepartmentResolution)),
    mutableLoadedRows,
    "financialAllocations",
    progress
  );
  await insertOfficeRows(db, "office_bank_accounts", dataset.bankAccounts.map(toPgliteBankAccountRow), mutableLoadedRows, "bankAccounts", progress);
  await insertOfficeRows(db, "office_bank_import_batches", dataset.bankImportBatches.map(toPgliteBankImportBatchRow), mutableLoadedRows, "bankImportBatches", progress);
  await insertOfficeRows(db, "office_bank_statement_lines", dataset.bankStatementLines.map(toPgliteBankStatementLineRow), mutableLoadedRows, "bankStatementLines", progress);
  await insertOfficeRows(db, "office_bank_reconciliation_matches", dataset.bankReconciliationMatches.map(toPgliteBankReconciliationMatchRow), mutableLoadedRows, "bankReconciliationMatches", progress);
  await insertOfficeRows(db, "office_cashflow_projection_rows", dataset.cashflowProjectionRows.map(toPgliteCashflowProjectionRow), mutableLoadedRows, "cashflowProjectionRows", progress);
}

function buildOfficeDiagnosticRows(dataset: OfficeAnalyticsDataset): ReadonlyMap<string, readonly DiagnosticRow[]> {
  const allocationDepartmentResolution = buildOfficeAllocationDepartmentResolution(dataset);
  return new Map<string, readonly DiagnosticRow[]>([
    ["departments", dataset.departments.map((row) => toDiagnosticRow(toPgliteDepartmentRow(row)))],
    ["divisions", dataset.divisions.map((row) => toDiagnosticRow(toPgliteDivisionRow(row)))],
    ["categories", dataset.categories.map((row) => toDiagnosticRow(toPgliteCategoryRow(row)))],
    ["partners", dataset.partners.map((row) => toDiagnosticRow(toPglitePartnerRow(row)))],
    ["projects", dataset.projects.map((row) => toDiagnosticRow(toPgliteProjectRow(row)))],
    ["project_budget_lines", dataset.projectBudgetLines.map((row) => toDiagnosticRow(toPgliteProjectBudgetLineRow(row)))],
    ["transactions", dataset.transactions.map((row) => toDiagnosticRow(toPgliteTransactionRow(row)))],
    ["financial_allocations", dataset.financialAllocations.map((row) => toDiagnosticRow(toPgliteFinancialAllocationRow(row, allocationDepartmentResolution)))],
    ["office_bank_accounts", dataset.bankAccounts.map((row) => toDiagnosticRow(toPgliteBankAccountRow(row)))],
    ["office_bank_import_batches", dataset.bankImportBatches.map((row) => toDiagnosticRow(toPgliteBankImportBatchRow(row)))],
    ["office_bank_statement_lines", dataset.bankStatementLines.map((row) => toDiagnosticRow(toPgliteBankStatementLineRow(row)))],
    ["office_bank_reconciliation_matches", dataset.bankReconciliationMatches.map((row) => toDiagnosticRow(toPgliteBankReconciliationMatchRow(row)))],
    ["office_cashflow_projection_rows", dataset.cashflowProjectionRows.map((row) => toDiagnosticRow(toPgliteCashflowProjectionRow(row)))]
  ]);
}

function toDiagnosticRow(row: Readonly<Record<string, unknown>>): DiagnosticRow {
  return row as DiagnosticRow;
}

type MutableLoadedRowCounts = {
  -readonly [Key in keyof OfficeB2LoadedRowCounts]: OfficeB2LoadedRowCounts[Key];
};

async function insertOfficeRows(
  db: SqlQueryClient,
  tableName: string,
  rows: readonly Readonly<Record<string, unknown>>[],
  loadedRows: MutableLoadedRowCounts,
  countKey: keyof OfficeB2LoadedRowCounts,
  progress: ProgressLogger | null
): Promise<void> {
  if (progress !== null) {
    progress(`→ ${tableName}: loading…`);
  }

  const tableColumns = await readSqlTableColumns(db, tableName);
  const result = await insertSqlRowsBatched(
    db,
    tableName,
    loadedRows[countKey],
    rows,
    tableColumns,
    {
      batchSize: officeSqlBatchSize,
      copy: false,
      retryLimit: 3
    }
  );
  loadedRows[countKey] += result.insertedRows;

  if (progress !== null) {
    progress(`✓ ${tableName} ${String(rows.length)} rows`);
  }
}

const officeSqlBatchSize = 1_000;

async function resetOfficeSqlTarget(
  db: SqlQueryClient,
  tableNames: readonly string[],
  progress: ProgressLogger
): Promise<void> {
  progress("→ reset: truncating Office B2 target tables…");
  await db.query("begin");
  try {
    for (const tableName of [...tableNames].reverse()) {
      progress(`→ reset: truncating ${tableName}`);
      await db.query(`truncate table ${quoteIdentifier(tableName)} restart identity cascade`);
    }

    await db.query("commit");
    progress("✓ reset complete");
  } catch (error: unknown) {
    try {
      await db.query("rollback");
    } catch {
      // A failed reset should surface the original error.
    }

    throw error;
  }
}

async function readOfficeSqlTableCounts(
  db: SqlQueryClient,
  progress: ProgressLogger
): Promise<Readonly<Record<string, number>>> {
  const entries: [string, number][] = [];
  for (const tableName of officeSqlTableNames) {
    progress(`→ ${tableName}: reading…`);
    const rowCount = await readSqlTableRowCount(db, tableName);
    progress(`✓ ${tableName} ${String(rowCount)} rows`);
    entries.push([tableName, rowCount]);
  }

  return Object.fromEntries(entries);
}

async function readOfficeSqlVerbatimReport(
  db: SqlQueryClient,
  dataset: OfficeAnalyticsDataset,
  progress: ProgressLogger
): Promise<OfficeB2PostgresVerbatimReport> {
  const comparedRows: [string, number][] = [];
  for (const [tableName, rows] of buildOfficeVerbatimRows(dataset).entries()) {
    progress(`→ ${tableName}: verbatim legacy_id compare…`);
    await compareOfficeSqlVerbatimRows(db, tableName, rows);
    progress(`✓ ${tableName} verbatim ${String(rows.length)} rows`);
    comparedRows.push([tableName, rows.length]);
  }

  return {
    status: "pass",
    comparedRows: Object.fromEntries(comparedRows)
  };
}

function buildOfficeVerbatimRows(dataset: OfficeAnalyticsDataset): ReadonlyMap<string, readonly Readonly<Record<string, unknown>>[]> {
  const allocationDepartmentResolution = buildOfficeAllocationDepartmentResolution(dataset);
  return new Map<string, readonly Readonly<Record<string, unknown>>[]>([
    ["departments", dataset.departments.map(toPgliteDepartmentRow)],
    ["divisions", dataset.divisions.map(toPgliteDivisionRow)],
    ["categories", dataset.categories.map(toPgliteCategoryRow)],
    ["partners", dataset.partners.map(toPglitePartnerRow)],
    ["projects", dataset.projects.map(toPgliteProjectRow)],
    ["project_budget_lines", dataset.projectBudgetLines.map(toPgliteProjectBudgetLineRow)],
    ["transactions", dataset.transactions.map(toPgliteTransactionRow)],
    ["financial_allocations", dataset.financialAllocations.map((row) => toPgliteFinancialAllocationRow(row, allocationDepartmentResolution))],
    ["office_bank_accounts", dataset.bankAccounts.map(toPgliteBankAccountRow)],
    ["office_bank_import_batches", dataset.bankImportBatches.map(toPgliteBankImportBatchRow)],
    ["office_bank_statement_lines", dataset.bankStatementLines.map(toPgliteBankStatementLineRow)],
    ["office_bank_reconciliation_matches", dataset.bankReconciliationMatches.map(toPgliteBankReconciliationMatchRow)],
    ["office_cashflow_projection_rows", dataset.cashflowProjectionRows.map(toPgliteCashflowProjectionRow)]
  ]);
}

async function compareOfficeSqlVerbatimRows(
  db: SqlQueryClient,
  tableName: string,
  expectedRows: readonly Readonly<Record<string, unknown>>[]
): Promise<void> {
  if (expectedRows.length === 0) {
    const actualCount = await readSqlTableRowCount(db, tableName);
    if (actualCount !== 0) {
      throw new Error(`Office B2 postgres verbatim mismatch for ${tableName}: expected 0 rows, got ${String(actualCount)}.`);
    }

    return;
  }

  const columns = verbatimColumns(expectedRows);
  const result = await db.query(`
    select ${columns.map((columnName) => quoteIdentifier(columnName)).join(", ")}
    from ${quoteIdentifier(tableName)}
    order by legacy_id
  `);
  if (result.rows.length !== expectedRows.length) {
    throw new Error(`Office B2 postgres verbatim mismatch for ${tableName}: expected ${String(expectedRows.length)} rows, got ${String(result.rows.length)}.`);
  }

  const expectedByLegacyId = new Map(expectedRows.map((row) => [normalizeOfficeVerbatimCell(row.legacy_id, null), row]));
  for (const actualRow of result.rows) {
    const legacyId = normalizeOfficeVerbatimCell(actualRow.legacy_id, null);
    const expectedRow = expectedByLegacyId.get(legacyId);
    if (expectedRow === undefined) {
      throw new Error(`Office B2 postgres verbatim mismatch for ${tableName}: unexpected legacy_id ${legacyId}.`);
    }

    for (const columnName of columns) {
      const temporalKind = officeVerbatimTemporalKind(tableName, columnName);
      const actual = normalizeOfficeVerbatimCell(actualRow[columnName], temporalKind);
      const expected = normalizeOfficeVerbatimCell(expectedRow[columnName], temporalKind);
      if (actual !== expected) {
        throw new Error(`Office B2 postgres verbatim mismatch for ${tableName}.${columnName} legacy_id ${legacyId}: expected ${expected}, got ${actual}.`);
      }
    }
  }
}

function verbatimColumns(rows: readonly Readonly<Record<string, unknown>>[]): readonly string[] {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const columnName of Object.keys(row)) {
      columns.add(columnName);
    }
  }

  return [...columns].sort();
}

const officeVerbatimTemporalColumns: Readonly<Record<string, Readonly<Record<string, OfficeVerbatimTemporalKind>>>> = {
  projects: {
    event_start_date: "date",
    event_end_date: "date",
    state_changed_at: "timestamp"
  },
  transactions: {
    approved_at: "timestamp",
    transaction_date: "timestamp"
  },
  office_bank_accounts: {
    balance_as_of: "timestamp"
  },
  office_bank_import_batches: {
    imported_at: "timestamp",
    period_end: "date",
    period_start: "date"
  },
  office_bank_statement_lines: {
    occurred_on: "date",
    value_on: "date"
  },
  office_bank_reconciliation_matches: {
    approved_at: "timestamp"
  }
};

function officeVerbatimTemporalKind(tableName: string, columnName: string): OfficeVerbatimTemporalKind | null {
  return officeVerbatimTemporalColumns[tableName]?.[columnName] ?? null;
}

function normalizeOfficeVerbatimCell(value: unknown, temporalKind: OfficeVerbatimTemporalKind | null): string {
  if (temporalKind !== null) {
    return normalizeOfficeTemporalVerbatimValue(temporalKind, value);
  }

  if (value === null || value === undefined) {
    return "[null]";
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

export function normalizeOfficeTemporalVerbatimValue(kind: OfficeVerbatimTemporalKind, value: unknown): string {
  if (value === null || value === undefined) {
    return "[null]";
  }

  if (value instanceof Date) {
    return kind === "date" ? value.toISOString().slice(0, 10) : value.toISOString();
  }

  const rawValue = String(value).trim();
  if (rawValue === "" || rawValue === "0000-00-00" || rawValue === "0000-00-00 00:00:00") {
    return "[null]";
  }

  return kind === "date" ? normalizeOfficeVerbatimDate(rawValue) : normalizeOfficeVerbatimTimestamp(rawValue);
}

function normalizeOfficeVerbatimDate(value: string): string {
  const dateOnlyMatch = /^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(value);
  if (dateOnlyMatch !== null && dateOnlyMatch[1] !== undefined) {
    assertOfficeVerbatimDatePart(dateOnlyMatch[1], value);
    return dateOnlyMatch[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Office B2 postgres verbatim invalid date value: ${value}.`);
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeOfficeVerbatimTimestamp(value: string): string {
  const mysqlTimestampMatch = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?)?$/.exec(value);
  if (mysqlTimestampMatch !== null && mysqlTimestampMatch[1] !== undefined) {
    const datePart = mysqlTimestampMatch[1];
    const timePart = mysqlTimestampMatch[2] ?? "00:00:00";
    const fractionPart = mysqlTimestampMatch[3] ?? "";
    const millisecondPart = fractionPart.padEnd(3, "0").slice(0, 3);
    const normalizedTimestamp = `${datePart}T${timePart}.${millisecondPart}Z`;
    assertOfficeVerbatimTimestamp(normalizedTimestamp, value);
    return normalizedTimestamp;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Office B2 postgres verbatim invalid timestamp value: ${value}.`);
  }

  return parsed.toISOString();
}

function assertOfficeVerbatimDatePart(datePart: string, originalValue: string): void {
  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== datePart) {
    throw new Error(`Office B2 postgres verbatim invalid date value: ${originalValue}.`);
  }
}

function assertOfficeVerbatimTimestamp(timestamp: string, originalValue: string): void {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== timestamp) {
    throw new Error(`Office B2 postgres verbatim invalid timestamp value: ${originalValue}.`);
  }
}

async function readSqlRawParity(db: SqlQueryClient): Promise<OfficeB2RawParity> {
  const result: SqlQueryResult = await db.query(`
    select
      count(*) filter (where status = 'validated' and is_active = true)::text as validated_transaction_count,
      coalesce(sum(amount_minor) filter (where status = 'validated' and is_active = true and type = 'income'), 0)::text as income_minor,
      coalesce(sum(amount_minor) filter (where status = 'validated' and is_active = true and type = 'expense'), 0)::text as expense_minor
    from transactions
  `);
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error("Office B2 pglite raw parity returned no rows.");
  }

  return {
    validatedTransactionCount: Number(row.validated_transaction_count ?? 0),
    incomeMinor: BigInt(String(row.income_minor ?? "0")),
    expenseMinor: BigInt(String(row.expense_minor ?? "0"))
  };
}

async function readSqlGlobalPnlDataset(db: SqlQueryClient): Promise<OfficeAnalyticsDataset> {
  const result: SqlQueryResult = await db.query(`
    select
      id::text,
      transaction_date::text,
      type,
      status,
      is_active,
      description,
      category_id::text,
      partner_id::text,
      project_id::text,
      amount_minor::text,
      original_currency,
      exchange_rate_e10::text
    from transactions
  `);

  return {
    departments: [],
    divisions: [],
    categories: [],
    partners: [],
    projects: [],
    projectBudgetLines: [],
    transactions: result.rows.map((row) => {
      const exchangeRate = optionalStringColumn(row, "exchange_rate_e10");
      return {
        id: requiredStringColumn(row, "id"),
        transactionDate: requiredStringColumn(row, "transaction_date"),
        type: officeTransactionTypeColumn(row, "type"),
        status: officeTransactionStatusColumn(row, "status"),
        isActive: requiredBooleanColumn(row, "is_active"),
        description: optionalStringColumn(row, "description"),
        categoryId: optionalStringColumn(row, "category_id"),
        partnerId: optionalStringColumn(row, "partner_id"),
        projectId: optionalStringColumn(row, "project_id"),
        amountMinor: BigInt(requiredStringColumn(row, "amount_minor")),
        originalCurrency: optionalStringColumn(row, "original_currency"),
        exchangeRateE10: exchangeRate === null ? null : BigInt(exchangeRate)
      };
    }),
    financialAllocations: [],
    bankAccounts: [],
    bankImportBatches: [],
    bankStatementLines: [],
    bankReconciliationMatches: [],
    cashflowProjectionRows: []
  };
}

function requiredStringColumn(row: Readonly<Record<string, unknown>>, columnName: string): string {
  const value = row[columnName];
  if (value === null || value === undefined) {
    throw new Error(`Office B2 postgres readback missing ${columnName}.`);
  }

  return String(value);
}

function optionalStringColumn(row: Readonly<Record<string, unknown>>, columnName: string): string | null {
  const value = row[columnName];
  return value === null || value === undefined ? null : String(value);
}

function requiredBooleanColumn(row: Readonly<Record<string, unknown>>, columnName: string): boolean {
  const value = row[columnName];
  if (typeof value !== "boolean") {
    throw new Error(`Office B2 postgres readback expected boolean ${columnName}.`);
  }

  return value;
}

function officeTransactionTypeColumn(row: Readonly<Record<string, unknown>>, columnName: string): "income" | "expense" {
  const value = requiredStringColumn(row, columnName);
  if (value !== "income" && value !== "expense") {
    throw new Error(`Office B2 postgres readback invalid transaction type: ${value}.`);
  }

  return value;
}

function officeTransactionStatusColumn(row: Readonly<Record<string, unknown>>, columnName: string): "validated" | "draft" | "cancelled" {
  const value = requiredStringColumn(row, columnName);
  if (value !== "validated" && value !== "draft" && value !== "cancelled") {
    throw new Error(`Office B2 postgres readback invalid transaction status: ${value}.`);
  }

  return value;
}

function toPgliteDepartmentRow(row: OfficeAnalyticsDataset["departments"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("departments", row.id, "id"),
    slug: slugFromLegacy("department", row.id, row.name),
    name: row.name,
    type: row.type,
    color: row.color,
    is_active: row.isActive
  };
}

function toPgliteDivisionRow(row: OfficeAnalyticsDataset["divisions"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("divisions", row.id, "id"),
    department_id: legacyForeignUuid("departments", row.departmentId, "divisions", "department_id"),
    slug: slugFromLegacy("division", row.id, row.name),
    name: row.name,
    is_active: row.isActive
  };
}

function toPgliteCategoryRow(row: OfficeAnalyticsDataset["categories"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("categories", row.id, "id"),
    name: row.name,
    type: row.type,
    division_id: legacyForeignUuid("divisions", row.divisionId, "categories", "division_id"),
    is_active: row.isActive
  };
}

function toPglitePartnerRow(row: OfficeAnalyticsDataset["partners"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("partners", row.id, "id"),
    name: row.name,
    type: row.type,
    is_active: row.isActive
  };
}

function toPgliteProjectRow(row: OfficeAnalyticsDataset["projects"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("projects", row.id, "id"),
    name: row.name,
    status: row.status,
    state: row.state,
    is_active: row.isActive
  };
}

function toPgliteProjectBudgetLineRow(row: OfficeAnalyticsDataset["projectBudgetLines"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("project_budget_lines", row.id, "id"),
    project_id: legacyForeignUuid("projects", row.projectId, "project_budget_lines", "project_id"),
    category_id: legacyForeignUuid("categories", row.categoryId, "project_budget_lines", "category_id"),
    type: row.type,
    planned_amount_minor: row.plannedAmountMinor
  };
}

function toPgliteTransactionRow(row: OfficeAnalyticsDataset["transactions"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("transactions", row.id, "id"),
    transaction_date: row.transactionDate,
    type: row.type,
    status: row.status,
    is_active: row.isActive,
    description: row.description,
    category_id: legacyForeignUuid("categories", row.categoryId, "transactions", "category_id"),
    partner_id: legacyForeignUuid("partners", row.partnerId, "transactions", "partner_id"),
    project_id: legacyForeignUuid("projects", row.projectId, "transactions", "project_id"),
    amount_minor: row.amountMinor,
    original_currency: row.originalCurrency,
    exchange_rate_e10: row.exchangeRateE10
  };
}

function toPgliteFinancialAllocationRow(
  row: OfficeAnalyticsDataset["financialAllocations"][number],
  departmentResolution: OfficeAllocationDepartmentResolution
): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("financial_allocations", row.id, "id"),
    transaction_id: legacyForeignUuid("transactions", row.transactionId, "financial_allocations", "transaction_id"),
    department_id: legacyForeignUuid("departments", resolveAllocationDepartmentLegacyId(row.departmentId, departmentResolution), "financial_allocations", "department_id"),
    amount_minor: row.amountMinor
  };
}

function toPgliteBankAccountRow(row: OfficeAnalyticsDataset["bankAccounts"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("office_bank_accounts", row.id, "id"),
    workspace_id: row.workspaceId,
    bank_name: row.bankName,
    account_label: row.accountLabel,
    account_reference_hash: row.accountReferenceHash,
    currency: row.currency,
    current_balance_minor: row.currentBalanceMinor,
    current_balance_mur_minor: row.currentBalanceMurMinor,
    is_active: row.isActive,
    balance_as_of: row.balanceAsOf
  };
}

function toPgliteBankImportBatchRow(row: OfficeAnalyticsDataset["bankImportBatches"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("office_bank_import_batches", row.id, "id"),
    workspace_id: row.workspaceId,
    source: row.source,
    file_name: row.fileName,
    checksum: row.checksum,
    account_id: legacyForeignUuid("office_bank_accounts", row.accountId, "office_bank_import_batches", "account_id"),
    period_start: row.periodStart,
    period_end: row.periodEnd,
    opening_balance_minor: row.openingBalanceMinor,
    closing_balance_minor: row.closingBalanceMinor,
    currency: row.currency,
    accepted_row_count: row.acceptedRowCount,
    rejected_row_count: row.rejectedRowCount,
    duplicate_row_count: row.duplicateRowCount,
    idempotency_fingerprint: row.idempotencyFingerprint,
    status: row.status,
    imported_at: row.importedAt,
    metadata: row.metadata
  };
}

function toPgliteBankStatementLineRow(row: OfficeAnalyticsDataset["bankStatementLines"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("office_bank_statement_lines", row.id, "id"),
    import_batch_id: legacyForeignUuid("office_bank_import_batches", row.importBatchId, "office_bank_statement_lines", "import_batch_id"),
    account_id: legacyForeignUuid("office_bank_accounts", row.accountId, "office_bank_statement_lines", "account_id"),
    occurred_on: row.occurredOn,
    value_on: row.valueOn,
    description: row.description,
    reference: row.reference,
    direction: row.direction,
    amount_minor: row.amountMinor,
    balance_minor: row.balanceMinor,
    currency: row.currency,
    amount_mur_minor: row.amountMurMinor,
    balance_mur_minor: row.balanceMurMinor,
    is_duplicate_candidate: row.isDuplicateCandidate,
    reconciliation_status: row.reconciliationStatus,
    matched_transaction_id: legacyForeignUuid("transactions", row.matchedTransactionId, "office_bank_statement_lines", "matched_transaction_id"),
    raw_data: row.rawData
  };
}

function toPgliteBankReconciliationMatchRow(row: OfficeAnalyticsDataset["bankReconciliationMatches"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("office_bank_reconciliation_matches", row.id, "id"),
    bank_statement_line_id: legacyForeignUuid("office_bank_statement_lines", row.bankStatementLineId, "office_bank_reconciliation_matches", "bank_statement_line_id"),
    transaction_id: legacyForeignUuid("transactions", row.transactionId, "office_bank_reconciliation_matches", "transaction_id"),
    confidence_bp: row.confidenceBp,
    status: row.status,
    approved_by_user_id: row.approvedByUserId,
    approved_at: row.approvedAt
  };
}

function toPgliteCashflowProjectionRow(row: OfficeAnalyticsDataset["cashflowProjectionRows"][number]): Readonly<Record<string, unknown>> {
  return {
    ...legacyIdentity("office_cashflow_projection_rows", row.id, "id"),
    workspace_id: row.workspaceId,
    account_id: legacyForeignUuid("office_bank_accounts", row.accountId, "office_cashflow_projection_rows", "account_id"),
    period_month: row.periodMonth,
    expected_inflow_minor: row.expectedInflowMinor,
    expected_outflow_minor: row.expectedOutflowMinor,
    expected_closing_balance_minor: row.expectedClosingBalanceMinor,
    currency: row.currency
  };
}

function legacyIdentity(tableName: string, value: string | number | bigint | null | undefined, columnName: string): Readonly<Record<string, unknown>> {
  const legacyId = legacyIntegerId(value, tableName, columnName);
  if (legacyId === null) {
    throw new Error(`Legacy ID cannot be null for ${tableName}.${columnName}.`);
  }

  return {
    id: legacyUuidForTable(tableName, legacyId),
    legacy_id: legacyId
  };
}

function legacyForeignUuid(
  targetTableName: string,
  value: string | number | bigint | null | undefined,
  sourceTableName: string,
  columnName: string
): string | null {
  const legacyId = legacyIntegerId(value, sourceTableName, columnName);
  return legacyId === null ? null : legacyUuidForTable(targetTableName, legacyId);
}

interface OfficeAllocationDepartmentResolution {
  readonly departmentIds: ReadonlySet<string>;
  readonly parentDepartmentIdByDivisionId: ReadonlyMap<string, string>;
}

function buildOfficeAllocationDepartmentResolution(dataset: OfficeAnalyticsDataset): OfficeAllocationDepartmentResolution {
  return {
    departmentIds: new Set(dataset.departments.map((department) => department.id)),
    parentDepartmentIdByDivisionId: new Map(dataset.divisions.map((division) => [division.id, division.departmentId]))
  };
}

function resolveAllocationDepartmentLegacyId(
  legacyId: string | null,
  departmentResolution: OfficeAllocationDepartmentResolution
): string | null {
  if (legacyId === null) {
    return null;
  }

  if (departmentResolution.departmentIds.has(legacyId)) {
    return legacyId;
  }

  return departmentResolution.parentDepartmentIdByDivisionId.get(legacyId) ?? null;
}

function slugFromLegacy(prefix: string, legacyId: string, name: string): string {
  return `${prefix}-${legacyId}-${name}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/gu, "")
    .trim()
    .replace(/[\s_]+/gu, "-")
    .replace(/-+/gu, "-")
    .slice(0, 160);
}

function loadOfficeCleanTarget(dataset: OfficeAnalyticsDataset): OfficeCleanTargetSnapshot {
  return {
    mode: "in-memory-clean-office",
    dataset: {
      departments: [...dataset.departments],
      divisions: [...dataset.divisions],
      categories: [...dataset.categories],
      partners: [...dataset.partners],
      projects: [...dataset.projects],
      projectBudgetLines: [...dataset.projectBudgetLines],
      transactions: [...dataset.transactions],
      financialAllocations: [...dataset.financialAllocations],
      bankAccounts: [...dataset.bankAccounts],
      bankImportBatches: [...dataset.bankImportBatches],
      bankStatementLines: [...dataset.bankStatementLines],
      bankReconciliationMatches: [...dataset.bankReconciliationMatches],
      cashflowProjectionRows: [...dataset.cashflowProjectionRows]
    }
  };
}

function readTargetRawParity(target: OfficeCleanTargetSnapshot): OfficeB2RawParity {
  return rawValidatedParity(target.dataset.transactions);
}

function readEngineGlobalParity(dataset: OfficeAnalyticsDataset): OfficeB2RawParity {
  const result = readGlobalPnl(dataset, { dateFrom: null, dateTo: null, departmentId: null });
  return {
    validatedTransactionCount: result.tx_count,
    incomeMinor: eofMoney.parse(result.income),
    expenseMinor: eofMoney.parse(result.expense)
  };
}

function rawValidatedParity(rows: readonly OfficeTransactionRow[]): OfficeB2RawParity {
  let validatedTransactionCount = 0;
  let incomeMinor = 0n;
  let expenseMinor = 0n;
  for (const row of rows) {
    if (row.status !== "validated" || !row.isActive) {
      continue;
    }

    validatedTransactionCount += 1;
    if (row.type === "income") {
      incomeMinor += row.amountMinor;
    } else {
      expenseMinor += row.amountMinor;
    }
  }

  return {
    validatedTransactionCount,
    incomeMinor,
    expenseMinor
  };
}

function assertParity(label: string, actual: OfficeB2RawParity, contract: OfficeB2Contract): void {
  if (actual.validatedTransactionCount !== contract.parity.validatedTransactionCount) {
    throw new Error(
      `Office B2 ${label} parity failed for validatedTransactionCount: expected ${String(contract.parity.validatedTransactionCount)}, got ${String(actual.validatedTransactionCount)}.`
    );
  }

  if (actual.incomeMinor !== contract.parity.incomeMinor) {
    throw new Error(`Office B2 ${label} parity failed for incomeMinor: expected ${String(contract.parity.incomeMinor)}, got ${String(actual.incomeMinor)}.`);
  }

  if (actual.expenseMinor !== contract.parity.expenseMinor) {
    throw new Error(`Office B2 ${label} parity failed for expenseMinor: expected ${String(contract.parity.expenseMinor)}, got ${String(actual.expenseMinor)}.`);
  }
}

function parityCheck(actual: OfficeB2RawParity, contract: OfficeB2Contract): OfficeB2ParityCheckReport {
  return {
    status: "pass",
    validatedTransactionCount: actual.validatedTransactionCount,
    incomeMinor: actual.incomeMinor.toString(),
    expenseMinor: actual.expenseMinor.toString(),
    expectedValidatedTransactionCount: contract.parity.validatedTransactionCount,
    expectedIncomeMinor: contract.parity.incomeMinor.toString(),
    expectedExpenseMinor: contract.parity.expenseMinor.toString()
  };
}

function sourceCountsFromDumpBuild(dumpBuild: OfficeDumpBuildResult): OfficeB2ExpectedCounts {
  return {
    transactions: dumpBuild.dump.transactions.length,
    financialAllocations: dumpBuild.dump.financialAllocations.length,
    categories: dumpBuild.dump.categories.length,
    departments: dumpBuild.dump.departments.length,
    partners: dumpBuild.dump.partners.length,
    projects: dumpBuild.dump.projects.length,
    bankAccounts: dumpBuild.dump.bankAccounts.length,
    bankRawTransactions: dumpBuild.dump.bankRawTransactions.length,
    bankReconciliations: dumpBuild.dump.bankReconciliations.length
  };
}

function insertStatementCounts(dumpBuild: OfficeDumpBuildResult): OfficeB2ExpectedCounts {
  return {
    transactions: insertCountForTable(dumpBuild, dumpBuild.tableNames.transactions),
    financialAllocations: insertCountForTable(dumpBuild, dumpBuild.tableNames.financialAllocations),
    categories: insertCountForTable(dumpBuild, dumpBuild.tableNames.categories),
    departments: insertCountForTable(dumpBuild, dumpBuild.tableNames.departments),
    partners: insertCountForTable(dumpBuild, dumpBuild.tableNames.partners),
    projects: insertCountForTable(dumpBuild, dumpBuild.tableNames.projects),
    bankAccounts: insertCountForTable(dumpBuild, dumpBuild.tableNames.bankAccounts),
    bankRawTransactions: insertCountForTable(dumpBuild, dumpBuild.tableNames.bankRawTransactions),
    bankReconciliations: insertCountForTable(dumpBuild, dumpBuild.tableNames.bankReconciliations)
  };
}

function insertCountForTable(dumpBuild: OfficeDumpBuildResult, tableName: string): number {
  return dumpBuild.parsedTables.tables.get(tableName)?.insertStatementCount ?? 0;
}

function emptyLoadedRowCounts(): OfficeB2LoadedRowCounts {
  return {
    departments: 0,
    divisions: 0,
    categories: 0,
    partners: 0,
    projects: 0,
    projectBudgetLines: 0,
    transactions: 0,
    financialAllocations: 0,
    bankAccounts: 0,
    bankImportBatches: 0,
    bankStatementLines: 0,
    bankReconciliationMatches: 0,
    cashflowProjectionRows: 0
  };
}

function loadedRowCounts(dataset: OfficeAnalyticsDataset): OfficeB2LoadedRowCounts {
  return {
    departments: dataset.departments.length,
    divisions: dataset.divisions.length,
    categories: dataset.categories.length,
    partners: dataset.partners.length,
    projects: dataset.projects.length,
    projectBudgetLines: dataset.projectBudgetLines.length,
    transactions: dataset.transactions.length,
    financialAllocations: dataset.financialAllocations.length,
    bankAccounts: dataset.bankAccounts.length,
    bankImportBatches: dataset.bankImportBatches.length,
    bankStatementLines: dataset.bankStatementLines.length,
    bankReconciliationMatches: dataset.bankReconciliationMatches.length,
    cashflowProjectionRows: dataset.cashflowProjectionRows.length
  };
}

function toPgliteFailure(error: unknown): PgliteInsertFailure {
  if (error instanceof PgliteInsertError) {
    return error.failure;
  }

  if (error instanceof SqlInsertError) {
    return error.failure;
  }

  return {
    tableName: "pglite-validation",
    rowIndex: -1,
    message: error instanceof Error ? error.message : String(error),
    detail: error instanceof Error && error.stack ? error.stack : null
  };
}

function toSqlFailure(error: unknown, tableName: string): SqlInsertFailure {
  if (error instanceof SqlInsertError) {
    return error.failure;
  }

  if (error instanceof TargetNotEmptyError) {
    return {
      tableName: "anti-double-load-guard",
      rowIndex: -1,
      message: error.message,
      detail: JSON.stringify(error.tables)
    };
  }

  return {
    tableName,
    rowIndex: -1,
    message: error instanceof Error ? error.message : String(error),
    detail: error instanceof Error && error.stack ? error.stack : null
  };
}
