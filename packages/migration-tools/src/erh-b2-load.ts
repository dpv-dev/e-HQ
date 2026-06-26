import {
  splitRoyaltyShares,
  type DistributionEarningInput,
  type DistributionRoyaltyRuleInput
} from "@ehq/domain-distribution";
import { erhMoney } from "@ehq/domain-finance";
import {
  buildDistributionErhCleanDatasetFromSql,
  type DistributionErhCleanDataset,
  type DistributionErhCleanRow,
  type DistributionErhExpectedReadableAssertions,
  type DistributionErhTableChecksumComparison,
  type DistributionErhTransformContract,
  type DistributionErhTransformResult
} from "./erh-transform.js";
import { legacyIntegerId, legacyUuidForTable } from "./legacy-uuid.js";
import { buildDistributionErhTableSpecs, type DistributionErhColumnSpec, type DistributionErhScalarKind, type DistributionErhTableName, type DistributionRawImportRowsMode } from "./erh-schema.js";
import { streamMysqlInsertDumpRows, streamMysqlInsertDumpRowsAsync } from "./mysql-dump-stream.js";
import type { MysqlDumpRecord } from "./mysql-dump-parser.js";
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

type DistributionErhSpec = ReturnType<typeof buildDistributionErhTableSpecs>[number];

const distributionB2ErhExpectedSqlSplitInvariant: DistributionB2ErhSplitInvariantReport = {
  status: "pass",
  checkedEarningGroups: 28_560
};

export interface DistributionB2ErhContractJson {
  readonly sourceDatabaseName: string;
  readonly tablePrefix: string;
  readonly rawImportRowsMode: DistributionRawImportRowsMode;
  readonly excludeTables?: readonly string[];
  readonly identityLinkMustBeEmpty?: boolean;
  readonly expectedCounts: Readonly<Partial<Record<DistributionErhTableName, number>>>;
  readonly expectedReadableAssertions?: DistributionErhExpectedReadableAssertions;
  readonly moneyGoldens?: DistributionB2ErhMoneyGoldens;
  readonly statementsVerbatim?: readonly DistributionB2ErhVerbatimRow[];
  readonly payeeBalancesVerbatim?: readonly DistributionB2ErhVerbatimRow[];
  readonly fxRatesVerbatim?: readonly DistributionB2ErhVerbatimRow[];
  readonly mappingCoverage?: Readonly<Record<string, DistributionB2ErhCountAmount>>;
  readonly orphanFksExpectZero?: readonly DistributionB2ErhOrphanFkName[];
}

export interface DistributionB2ErhLoadRequest {
  readonly generatedAt: string;
  readonly sourceLabel: string;
  readonly contract: DistributionErhTransformContract;
}

export interface DistributionB2ErhLoadReport {
  readonly generatedAt: string;
  readonly source: DistributionB2ErhSourceReport;
  readonly target: DistributionB2ErhTargetReport;
  readonly counts: DistributionB2ErhCountsReport;
  readonly checksumGate: DistributionB2ErhChecksumReport;
  readonly readableAssertions: DistributionErhExpectedReadableAssertions;
  readonly moneyGoldens?: DistributionB2ErhMoneyGoldens;
  readonly verbatimRows?: DistributionB2ErhVerbatimReport;
  readonly mappingCoverage?: Readonly<Record<string, DistributionB2ErhCountAmount>>;
  readonly orphanFks?: DistributionB2ErhOrphanFkReport;
  readonly splitInvariant: DistributionB2ErhSplitInvariantReport;
  readonly decisions: readonly string[];
}

export interface DistributionB2ErhPgliteValidationReport {
  readonly generatedAt: string;
  readonly source: DistributionB2ErhSourceReport;
  readonly target: DistributionB2ErhPgliteTargetReport;
  readonly status: "pass" | "fail";
  readonly loadedRows: Readonly<Record<DistributionErhTableName, number>>;
  readonly failure: PgliteInsertFailure | null;
  readonly parity: DistributionB2ErhLoadReport | null;
  readonly decisions: readonly string[];
}

export interface DistributionB2ErhPostgresLoadOptions {
  readonly force: boolean;
  readonly reset: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly progress: ProgressLogger;
}

export type DistributionB2ErhPostgresVerifyMode = "full" | "lite";

export interface DistributionB2ErhPostgresVerifyOptions {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly progress: ProgressLogger;
  readonly mode: DistributionB2ErhPostgresVerifyMode;
  readonly dumpFilePath: string | null;
}

export interface DistributionB2ErhPostgresLoadReport {
  readonly generatedAt: string;
  readonly source: DistributionB2ErhSourceReport;
  readonly target: DistributionB2ErhPostgresTargetReport;
  readonly status: "pass" | "fail";
  readonly loadedRows: Readonly<Record<DistributionErhTableName, number>>;
  readonly failure: SqlInsertFailure | null;
  readonly parity: DistributionB2ErhLoadReport | null;
  readonly readback: DistributionB2ErhSqlReadbackReport | null;
  readonly decisions: readonly string[];
}

export interface DistributionB2ErhPostgresVerifyReport {
  readonly generatedAt: string;
  readonly source: DistributionB2ErhPostgresVerifySourceReport;
  readonly target: DistributionB2ErhPostgresVerifyTargetReport;
  readonly status: "pass" | "fail";
  readonly failure: SqlInsertFailure | null;
  readonly parity: DistributionB2ErhLoadReport | null;
  readonly readback: DistributionB2ErhSqlReadbackReport | null;
  readonly decisions: readonly string[];
}

export type DistributionB2ErhPgliteDiagnosticReport = PgliteDiagnosticReport;

export interface DistributionB2ErhSourceReport {
  readonly mode: "mysql-dump-insert-parser" | "mysql-dump-streaming-parser";
  readonly label: string;
  readonly sourceDatabaseName: string;
  readonly tablePrefix: string;
}

export interface DistributionB2ErhTargetReport {
  readonly mode: "in-memory-clean-distribution" | "streamed-clean-distribution-aggregates";
  readonly schemaContract: "packages/db distribution schema rowset";
  readonly moneyStorage: "NUMERIC(28,10)";
  readonly percentageStorage: "NUMERIC(12,6)";
}

export interface DistributionB2ErhPgliteTargetReport {
  readonly mode: "pglite-postgres";
  readonly schemaContract: "packages/db migrations 0000-0004 applied in pglite";
  readonly moneyStorage: "NUMERIC(28,10)";
  readonly percentageStorage: "NUMERIC(12,6)";
  readonly migrationsApplied: readonly string[];
}

export interface DistributionB2ErhPostgresTargetReport {
  readonly mode: "postgres";
  readonly schemaContract: "packages/db migrations 0000-0008 already applied";
  readonly moneyStorage: "NUMERIC(28,10)";
  readonly percentageStorage: "NUMERIC(12,6)";
  readonly force: boolean;
  readonly reset: boolean;
  readonly nonEmptyTables: readonly NonEmptyTargetTable[];
}

export interface DistributionB2ErhPostgresVerifySourceReport {
  readonly mode: "postgres-readback";
  readonly label: string;
  readonly sourceDatabaseName: string;
  readonly tablePrefix: string;
  readonly verificationMode: DistributionB2ErhPostgresVerifyMode;
}

export interface DistributionB2ErhPostgresVerifyTargetReport {
  readonly mode: "postgres";
  readonly schemaContract: "packages/db migrations 0000-0008 already applied";
  readonly moneyStorage: "NUMERIC(28,10)";
  readonly percentageStorage: "NUMERIC(12,6)";
  readonly readOnly: true;
}

export interface DistributionB2ErhSqlReadbackReport {
  readonly status: "pass";
  readonly counts: Readonly<Record<DistributionErhTableName, number>>;
  readonly moneyGoldens: DistributionB2ErhMoneyGoldens | undefined;
  readonly mappingCoverage: Readonly<Record<string, DistributionB2ErhCountAmount>> | undefined;
  readonly orphanFks: DistributionB2ErhOrphanFkReport | undefined;
  readonly splitInvariant: DistributionB2ErhSplitInvariantReport;
  readonly verbatimRows: DistributionB2ErhVerbatimReport | undefined;
}

export interface DistributionB2ErhCountsReport {
  readonly source: Readonly<Record<DistributionErhTableName, number>>;
  readonly target: Readonly<Record<DistributionErhTableName, number>>;
  readonly expected: Readonly<Partial<Record<DistributionErhTableName, number>>>;
}

export interface DistributionB2ErhChecksumReport {
  readonly status: "pass";
  readonly tables: readonly DistributionErhTableChecksumComparison[];
  readonly zeroDateNullCount: number;
}

export interface DistributionB2ErhSplitInvariantReport {
  readonly status: "pass";
  readonly checkedEarningGroups: number;
}

export interface DistributionB2ErhCountAmount {
  readonly n: number;
  readonly gross_amount?: string;
  readonly amount?: string;
}

export interface DistributionB2ErhCurrencyMoneyGolden {
  readonly n: number;
  readonly payees?: number;
  readonly contracts?: number;
  readonly resolved?: number;
  readonly gross_amount?: string;
  readonly gross_share?: string;
  readonly net_payable?: string;
  readonly original_gross_amount?: string;
  readonly quantity?: string;
  readonly amount?: string;
}

export interface DistributionB2ErhMoneyGoldens {
  readonly earning_allocations?: Readonly<Record<string, DistributionB2ErhCurrencyMoneyGolden>>;
  readonly normalized_earnings?: Readonly<Record<string, DistributionB2ErhCurrencyMoneyGolden>>;
  readonly suspense_items?: Readonly<Record<string, DistributionB2ErhCurrencyMoneyGolden>>;
  readonly statement_lines?: Readonly<Record<string, string | number>>;
  readonly contract_cost_terms_recoupable?: Readonly<Record<string, DistributionB2ErhCurrencyMoneyGolden>>;
}

export type DistributionB2ErhVerbatimRow = Readonly<Record<string, string | number>>;

export interface DistributionB2ErhVerbatimReport {
  readonly statements: readonly DistributionB2ErhVerbatimRow[];
  readonly payeeBalances: readonly DistributionB2ErhVerbatimRow[];
  readonly fxRates: readonly DistributionB2ErhVerbatimRow[];
}

export type DistributionB2ErhOrphanFkName =
  | "alloc.normalized_earning_id->normalized_earnings"
  | "alloc.payee_id->payees"
  | "sline.earning_allocation_id->earning_allocations"
  | "sline.statement_id->statements"
  | "pbal.payee_id->payees";

export interface DistributionB2ErhOrphanFkReport {
  readonly status: "pass";
  readonly counts: Readonly<Record<DistributionB2ErhOrphanFkName, number>>;
}

export function createDistributionB2ErhContract(json: DistributionB2ErhContractJson): DistributionErhTransformContract {
  if (json.rawImportRowsMode !== "migrate" && json.rawImportRowsMode !== "archive") {
    throw new Error("Distribution B2-erh contract rawImportRowsMode must be migrate or archive.");
  }

  return {
    sourceDatabaseName: json.sourceDatabaseName,
    tablePrefix: json.tablePrefix,
    rawImportRowsMode: json.rawImportRowsMode,
    expectedCounts: json.expectedCounts,
    expectedReadableAssertions: json.expectedReadableAssertions ?? null,
    expectedMoneyGoldens: json.moneyGoldens,
    expectedStatementsVerbatim: json.statementsVerbatim,
    expectedPayeeBalancesVerbatim: json.payeeBalancesVerbatim,
    expectedFxRatesVerbatim: json.fxRatesVerbatim,
    expectedMappingCoverage: json.mappingCoverage,
    expectedOrphanFks: json.orphanFksExpectZero
  };
}

export function createDistributionB2ErhLoadRequest(
  generatedAt: string,
  sourceLabel: string,
  contractJson: DistributionB2ErhContractJson
): DistributionB2ErhLoadRequest {
  return {
    generatedAt,
    sourceLabel,
    contract: createDistributionB2ErhContract(contractJson)
  };
}

export function distributionB2ErhCliFlagError(target: string, reset: boolean, verifyOnly: boolean): string | null {
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

export function runDistributionB2ErhLoadFromSql(sql: string, request: DistributionB2ErhLoadRequest): DistributionB2ErhLoadReport {
  const transform = buildDistributionErhCleanDatasetFromSql(sql, request.contract);
  const splitInvariant = validateSplitInvariant(transform.dataset);
  return createReport(request, transform, splitInvariant);
}

export async function runDistributionB2ErhLoadFromDumpFile(filePath: string, request: DistributionB2ErhLoadRequest): Promise<DistributionB2ErhLoadReport> {
  const accumulator = await buildStreamingAccumulator(filePath, request.contract);
  const splitInvariant = validateStreamingSplitInvariant(accumulator.splitGroups);
  const report = createStreamingReport(request, accumulator, splitInvariant);
  assertStreamingExpectations(report, request.contract);
  return report;
}

export async function runDistributionB2ErhPgliteValidationFromDumpFile(
  filePath: string,
  request: DistributionB2ErhLoadRequest
): Promise<DistributionB2ErhPgliteValidationReport> {
    const { db, migrationsApplied } = await createMigratedPgliteTarget();
    const loadedRows = createEmptyStreamingCounts();

    try {
      await loadDistributionPgliteTarget(db, filePath, request.contract, loadedRows);
      const parity = await runDistributionB2ErhLoadFromDumpFile(filePath, request);
      await readDistributionSqlReadback(db, parity);
      return createDistributionPgliteReport(request, migrationsApplied, loadedRows, parity, null, "pass");
  } catch (error: unknown) {
    return createDistributionPgliteReport(
      request,
      migrationsApplied,
      loadedRows,
      null,
      toDistributionPgliteFailure(error),
      "fail"
    );
  } finally {
    await db.close();
  }
}

export async function runDistributionB2ErhPostgresLoadFromDumpFile(
  filePath: string,
  request: DistributionB2ErhLoadRequest,
  options: DistributionB2ErhPostgresLoadOptions
): Promise<DistributionB2ErhPostgresLoadReport> {
  const loadedRows = createEmptyStreamingCounts();
  const client: ClosableSqlQueryClient = await createPostgresTargetFromEnvWithProgress(options.env, options.progress);
  let nonEmptyTables: readonly NonEmptyTargetTable[] = [];

  try {
    const targetTableNames = loadableDistributionTargetTableNames(request.contract);
    if (options.reset) {
      await resetDistributionSqlTarget(client, targetTableNames, options.progress);
    } else {
      nonEmptyTables = await assertTargetTablesEmpty(client, targetTableNames, options.force);
    }

    await loadDistributionSqlTarget(client, filePath, request.contract, loadedRows, options.progress);
    options.progress("→ verifying source golden masters from dump…");
    const parity = await runDistributionB2ErhLoadFromDumpFile(filePath, request);
    options.progress("→ reading back from DB to verify…");
    const readback = await readDistributionSqlReadback(client, parity);
    options.progress(
      `✓ erh goldens: earning_allocations ${String(readback.counts.earning_allocations)}, normalized_earnings ${String(readback.counts.normalized_earnings)}, statement_lines ${String(readback.counts.statement_lines)}, split ${String(readback.splitInvariant.checkedEarningGroups)}, orphan FKs 0`
    );
    return createDistributionPostgresReport(request, loadedRows, parity, readback, null, "pass", options.force, options.reset, nonEmptyTables);
  } catch (error: unknown) {
    return createDistributionPostgresReport(
      request,
      loadedRows,
      null,
      null,
      toDistributionSqlFailure(error, "distribution-postgres-load"),
      "fail",
      options.force,
      options.reset,
      nonEmptyTables
    );
  } finally {
    await client.close();
  }
}

export async function runDistributionB2ErhPostgresVerifyOnly(
  request: DistributionB2ErhLoadRequest,
  options: DistributionB2ErhPostgresVerifyOptions
): Promise<DistributionB2ErhPostgresVerifyReport> {
  const client: ClosableSqlQueryClient = await createPostgresTargetFromEnvWithProgress(options.env, options.progress);

  try {
    const parity = options.dumpFilePath === null
      ? createDistributionContractOnlyParity(request)
      : await runDistributionB2ErhLoadFromDumpFile(options.dumpFilePath, request);

    return await withReadOnlySqlTransaction(client, async (readOnlyClient) => {
      options.progress("→ reading back from DB to verify…");
      await logDistributionSqlTableCounts(readOnlyClient, request.contract, options.progress);
      const readback = await readDistributionSqlReadback(readOnlyClient, parity);
      options.progress(
        `✓ erh goldens: earning_allocations ${String(readback.counts.earning_allocations)}, normalized_earnings ${String(readback.counts.normalized_earnings)}, statement_lines ${String(readback.counts.statement_lines)}, split ${String(readback.splitInvariant.checkedEarningGroups)}, orphan FKs 0`
      );
      return createDistributionPostgresVerifyReport(request, parity, readback, null, "pass", options.mode);
    });
  } catch (error: unknown) {
    return createDistributionPostgresVerifyReport(
      request,
      null,
      null,
      toDistributionSqlFailure(error, "distribution-postgres-verify"),
      "fail",
      options.mode
    );
  } finally {
    await client.close();
  }
}

export async function runDistributionB2ErhPgliteDiagnosticFromDumpFile(
  filePath: string,
  request: DistributionB2ErhLoadRequest
): Promise<DistributionB2ErhPgliteDiagnosticReport> {
  const specs = buildDistributionErhTableSpecs(request.contract.tablePrefix);
  const selectedSourceTables = specs.map((spec) => spec.sourceTable);
  const specBySourceTable = new Map(specs.map((spec) => [spec.sourceTable, spec]));
  const targetTableNames = specs.map((spec) => spec.targetTable);
  const { db, migrationsApplied } = await createMigratedPgliteTarget();

  try {
    const schema = await readPgliteDiagnosticSchema(db, targetTableNames);
    const accumulator = createPgliteDiagnosticAccumulator();
    registerDiagnosticTables(accumulator, targetTableNames);
    const collectZeroDateNullCount = { value: 0 };
    const pgliteContext = createDistributionPgliteContext();
    await streamMysqlInsertDumpRowsAsync(filePath, selectedSourceTables, async ({ tableName, row }) => {
      const spec = requireSpec(specBySourceTable, tableName);
      if (shouldSkipDiagnosticSpec(spec, request.contract)) {
        return;
      }

      const cleanRow = toDistributionPgliteRow(spec.targetTable, normalizeStreamingRow(row, spec, collectZeroDateNullCount), pgliteContext);
      collectDiagnosticRowIdentity(accumulator, spec.targetTable, cleanRow);
      rememberDistributionPgliteRow(spec.targetTable, cleanRow, pgliteContext);
    });

    const validateZeroDateNullCount = { value: 0 };
    await streamMysqlInsertDumpRowsAsync(filePath, selectedSourceTables, async ({ tableName, row }) => {
      const spec = requireSpec(specBySourceTable, tableName);
      if (shouldSkipDiagnosticSpec(spec, request.contract)) {
        return;
      }

      validateDiagnosticRow(schema, accumulator, spec.targetTable, toDistributionPgliteRow(spec.targetTable, normalizeStreamingRow(row, spec, validateZeroDateNullCount), pgliteContext));
    });

    return createPgliteDiagnosticReport(request.generatedAt, request.sourceLabel, migrationsApplied, accumulator);
  } finally {
    await db.close();
  }
}

export function serializeDistributionB2ErhLoadReport(report: DistributionB2ErhLoadReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function serializeDistributionB2ErhPgliteValidationReport(report: DistributionB2ErhPgliteValidationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function serializeDistributionB2ErhPostgresLoadReport(report: DistributionB2ErhPostgresLoadReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function serializeDistributionB2ErhPostgresVerifyReport(report: DistributionB2ErhPostgresVerifyReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function serializeDistributionB2ErhPgliteDiagnosticReport(report: DistributionB2ErhPgliteDiagnosticReport): string {
  return serializePgliteDiagnosticReport(report);
}

export function formatDistributionB2ErhLoadReport(report: DistributionB2ErhLoadReport): string {
  return [
    "# Distribution B2-erh parity report",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source.label}`,
    `Source mode: ${report.source.mode}`,
    `Target mode: ${report.target.mode}`,
    `Money storage: ${report.target.moneyStorage}`,
    `Percentage storage: ${report.target.percentageStorage}`,
    "",
    "## Count guard",
    ...Object.entries(report.counts.expected)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([tableName, expected]) => `${tableName}: source ${String(report.counts.source[tableName as DistributionErhTableName])} / target ${String(report.counts.target[tableName as DistributionErhTableName])} / expected ${String(expected)}`),
    "",
    "## Checksums",
    `Status: ${report.checksumGate.status}`,
    `Tables checked: ${String(report.checksumGate.tables.length)}`,
    `Zero datetime/date values mapped to null: ${String(report.checksumGate.zeroDateNullCount)}`,
    "",
    ...formatOptionalMoneyGoldens(report.moneyGoldens),
    ...formatOptionalVerbatimRows(report.verbatimRows),
    ...formatOptionalMappingCoverage(report.mappingCoverage),
    ...formatOptionalOrphanFks(report.orphanFks),
    "",
    "## Split invariant",
    `Status: ${report.splitInvariant.status}`,
    `Earning groups checked with F3 split logic: ${String(report.splitInvariant.checkedEarningGroups)}`,
    "",
    "## Decisions",
    ...report.decisions.map((decision) => `- ${decision}`),
    ""
  ].join("\n");
}

export function formatDistributionB2ErhPgliteValidationReport(report: DistributionB2ErhPgliteValidationReport): string {
  return [
    "# Distribution B2-erh E2 Phase 0 pglite report",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source.label}`,
    `Source mode: ${report.source.mode}`,
    `Target mode: ${report.target.mode}`,
    `Status: ${report.status}`,
    `Migrations applied: ${report.target.migrationsApplied.join(", ")}`,
    "",
    report.status === "pass" ? "## Loaded rows" : "## Loaded rows before failure",
    ...Object.entries(report.loadedRows)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, count]) => `${name}: ${String(count)}`),
    "",
    "## Pglite parity",
    report.parity === null
      ? "Not reached because the pglite constraint load failed first."
      : `Reached. Streaming parity report stayed ${report.parity.checksumGate.status}; split invariant ${report.parity.splitInvariant.status}.`,
    "",
    "## Failure",
    report.failure === null
      ? "None."
      : `${report.failure.tableName} row ${String(report.failure.rowIndex)}: ${report.failure.message}`,
    "",
    "## Decisions",
    ...report.decisions.map((decision) => `- ${decision}`),
    ""
  ].join("\n");
}

export function formatDistributionB2ErhPostgresLoadReport(report: DistributionB2ErhPostgresLoadReport): string {
  return [
    "# Distribution B2-erh E2 Phase 2 postgres load report",
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
      ? "Distribution B2-erh target tables were truncated by --reset before load."
      : report.target.nonEmptyTables.length === 0
        ? "All target tables were empty before load."
        : `Non-empty tables: ${report.target.nonEmptyTables.map((table) => `${table.tableName}=${String(table.rowCount)}`).join(", ")}`,
    "",
    "## Loaded rows",
    ...Object.entries(report.loadedRows)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, count]) => `${name}: ${String(count)}`),
    "",
    "## Postgres readback",
    report.readback === null
      ? "Not reached because the postgres load failed first."
      : `Reached. Counts, money goldens, orphan FKs, split invariant, mapping coverage and verbatim rows all ${report.readback.status}.`,
    report.readback === null ? "" : `Split groups checked: ${String(report.readback.splitInvariant.checkedEarningGroups)}`,
    report.readback === null
      ? ""
      : `Key counts: earning_allocations ${String(report.readback.counts.earning_allocations)}, normalized_earnings ${String(report.readback.counts.normalized_earnings)}, statement_lines ${String(report.readback.counts.statement_lines)}`,
    report.readback?.moneyGoldens === undefined ? "" : `Money goldens: ${stableJson(report.readback.moneyGoldens)}`,
    report.readback?.orphanFks === undefined ? "" : `Orphan FKs: ${stableJson(report.readback.orphanFks.counts)}`,
    "",
    "## Failure",
    report.failure === null
      ? "None."
      : `${report.failure.tableName} row ${String(report.failure.rowIndex)}: ${report.failure.message}`,
    "",
    "## Decisions",
    ...report.decisions.map((decision) => `- ${decision}`),
    ""
  ].join("\n");
}

export function formatDistributionB2ErhPostgresVerifyReport(report: DistributionB2ErhPostgresVerifyReport): string {
  return [
    "# Distribution B2-erh E2 Phase 2 postgres verify report",
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.source.label}`,
    `Source mode: ${report.source.mode}`,
    `Verification mode: ${report.source.verificationMode}`,
    `Target mode: ${report.target.mode}`,
    `Status: ${report.status}`,
    `Read only: ${String(report.target.readOnly)}`,
    "",
    "## Postgres readback",
    report.readback === null
      ? "Not reached because postgres verify failed first."
      : `Reached. Counts, money goldens, orphan FKs, split invariant, mapping coverage${report.readback.verbatimRows === undefined ? "" : " and verbatim rows"} all ${report.readback.status}.`,
    report.readback === null ? "" : `Split groups checked: ${String(report.readback.splitInvariant.checkedEarningGroups)}`,
    report.readback === null
      ? ""
      : `Key counts: earning_allocations ${String(report.readback.counts.earning_allocations)}, normalized_earnings ${String(report.readback.counts.normalized_earnings)}, statement_lines ${String(report.readback.counts.statement_lines)}`,
    report.readback?.moneyGoldens === undefined ? "" : `Money goldens: ${stableJson(report.readback.moneyGoldens)}`,
    report.readback?.orphanFks === undefined ? "" : `Orphan FKs: ${stableJson(report.readback.orphanFks.counts)}`,
    "",
    "## Failure",
    report.failure === null
      ? "None."
      : `${report.failure.tableName} row ${String(report.failure.rowIndex)}: ${report.failure.message}`,
    "",
    "## Decisions",
    ...report.decisions.map((decision) => `- ${decision}`),
    ""
  ].join("\n");
}

export function formatDistributionB2ErhPgliteDiagnosticReport(report: DistributionB2ErhPgliteDiagnosticReport): string {
  return formatPgliteDiagnosticReport("Distribution B2-erh E2 Phase 0c pglite diagnostic", report);
}

function createReport(
  request: DistributionB2ErhLoadRequest,
  transform: DistributionErhTransformResult,
  splitInvariant: DistributionB2ErhSplitInvariantReport
): DistributionB2ErhLoadReport {
  return {
    generatedAt: request.generatedAt,
    source: {
      mode: "mysql-dump-insert-parser",
      label: request.sourceLabel,
      sourceDatabaseName: request.contract.sourceDatabaseName,
      tablePrefix: request.contract.tablePrefix
    },
    target: {
      mode: "in-memory-clean-distribution",
      schemaContract: "packages/db distribution schema rowset",
      moneyStorage: "NUMERIC(28,10)",
      percentageStorage: "NUMERIC(12,6)"
    },
    counts: {
      source: transform.sourceCounts,
      target: transform.targetCounts,
      expected: request.contract.expectedCounts
    },
    checksumGate: {
      status: "pass",
      tables: transform.checksums,
      zeroDateNullCount: transform.zeroDateNullCount
    },
    readableAssertions: transform.readableAssertions,
    splitInvariant,
    decisions: transform.decisions
  };
}

function createDistributionPgliteReport(
  request: DistributionB2ErhLoadRequest,
  migrationsApplied: readonly string[],
  loadedRows: Readonly<Record<DistributionErhTableName, number>>,
  parity: DistributionB2ErhLoadReport | null,
  failure: PgliteInsertFailure | null,
  status: "pass" | "fail"
): DistributionB2ErhPgliteValidationReport {
  return {
    generatedAt: request.generatedAt,
    source: {
      mode: "mysql-dump-streaming-parser",
      label: request.sourceLabel,
      sourceDatabaseName: request.contract.sourceDatabaseName,
      tablePrefix: request.contract.tablePrefix
    },
    target: {
      mode: "pglite-postgres",
      schemaContract: "packages/db migrations 0000-0004 applied in pglite",
      moneyStorage: "NUMERIC(28,10)",
      percentageStorage: "NUMERIC(12,6)",
      migrationsApplied
    },
    status,
    loadedRows,
    failure,
    parity,
    decisions: decisionNotes(request.contract.rawImportRowsMode)
  };
}

function createDistributionPostgresReport(
  request: DistributionB2ErhLoadRequest,
  loadedRows: Readonly<Record<DistributionErhTableName, number>>,
  parity: DistributionB2ErhLoadReport | null,
  readback: DistributionB2ErhSqlReadbackReport | null,
  failure: SqlInsertFailure | null,
  status: "pass" | "fail",
  force: boolean,
  reset: boolean,
  nonEmptyTables: readonly NonEmptyTargetTable[]
): DistributionB2ErhPostgresLoadReport {
  return {
    generatedAt: request.generatedAt,
    source: {
      mode: "mysql-dump-streaming-parser",
      label: request.sourceLabel,
      sourceDatabaseName: request.contract.sourceDatabaseName,
      tablePrefix: request.contract.tablePrefix
    },
    target: {
      mode: "postgres",
      schemaContract: "packages/db migrations 0000-0008 already applied",
      moneyStorage: "NUMERIC(28,10)",
      percentageStorage: "NUMERIC(12,6)",
      force,
      reset,
      nonEmptyTables
    },
    status,
    loadedRows,
    failure,
    parity,
    readback,
    decisions: decisionNotes(request.contract.rawImportRowsMode)
  };
}

function createDistributionPostgresVerifyReport(
  request: DistributionB2ErhLoadRequest,
  parity: DistributionB2ErhLoadReport | null,
  readback: DistributionB2ErhSqlReadbackReport | null,
  failure: SqlInsertFailure | null,
  status: "pass" | "fail",
  mode: DistributionB2ErhPostgresVerifyMode
): DistributionB2ErhPostgresVerifyReport {
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
      moneyStorage: "NUMERIC(28,10)",
      percentageStorage: "NUMERIC(12,6)",
      readOnly: true
    },
    status,
    failure,
    parity,
    readback,
    decisions: [
      ...decisionNotes(request.contract.rawImportRowsMode),
      mode === "full"
        ? "verify-only full mode scanned the dump to keep existing legacy_id verbatim comparisons."
        : "verify-only lite mode omitted dump scanning and skipped legacy_id verbatim comparisons."
    ]
  };
}

async function loadDistributionPgliteTarget(
  db: SqlQueryClient,
  filePath: string,
  contract: DistributionErhTransformContract,
  loadedRows: Record<DistributionErhTableName, number>
): Promise<void> {
  await loadDistributionSqlTarget(db, filePath, contract, loadedRows, null);
}

async function loadDistributionSqlTarget(
  db: SqlQueryClient,
  filePath: string,
  contract: DistributionErhTransformContract,
  loadedRows: Record<DistributionErhTableName, number>,
  progress: ProgressLogger | null
): Promise<void> {
  const specs = buildDistributionErhTableSpecs(contract.tablePrefix);
  const specBySourceTable = new Map(specs.map((spec) => [spec.sourceTable, spec]));
  const zeroDateNullCount = { value: 0 };
  const tableColumnsByTarget = new Map<DistributionErhTableName, ReadonlySet<string>>();
  const pgliteContext = createDistributionPgliteContext();

  for (const spec of specs) {
    const rowBatch: Readonly<Record<string, unknown>>[] = [];
    if (!shouldSkipDiagnosticSpec(spec, contract) && progress !== null) {
      progress(`→ ${spec.targetTable}: loading…`);
    }

    await streamMysqlInsertDumpRowsAsync(filePath, [spec.sourceTable], async ({ tableName, row }) => {
      const sourceSpec = requireSpec(specBySourceTable, tableName);
      if (sourceSpec.identityLinkMustBeEmpty) {
        throw new Error(
          `Distribution B2-erh identity_link source table is not empty while loading pglite. office_partner_id is intentionally not populated in this ETL; unification is a separate decision.`
        );
      }

      if (sourceSpec.auditExcluded || (sourceSpec.rawImportRowsDecision && contract.rawImportRowsMode === "archive")) {
        return;
      }

      const cleanRow = toDistributionPgliteRow(sourceSpec.targetTable, normalizeStreamingRow(row, sourceSpec, zeroDateNullCount), pgliteContext);
      rememberDistributionPgliteRow(sourceSpec.targetTable, cleanRow, pgliteContext);
      rowBatch.push(cleanRow);
      if (rowBatch.length >= distributionSqlBatchSize(db, sourceSpec.targetTable)) {
        await flushDistributionSqlRows(db, sourceSpec.targetTable, rowBatch.splice(0, rowBatch.length), loadedRows, tableColumnsByTarget);
      }
    });
    if (rowBatch.length > 0) {
      await flushDistributionSqlRows(db, spec.targetTable, rowBatch, loadedRows, tableColumnsByTarget);
    }

    if (!shouldSkipDiagnosticSpec(spec, contract) && progress !== null) {
      progress(`✓ ${spec.targetTable} ${String(loadedRows[spec.targetTable])} rows`);
    }
  }
}

async function flushDistributionSqlRows(
  db: SqlQueryClient,
  tableName: DistributionErhTableName,
  rows: readonly Readonly<Record<string, unknown>>[],
  loadedRows: Record<DistributionErhTableName, number>,
  tableColumnsByTarget: Map<DistributionErhTableName, ReadonlySet<string>>
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const tableColumns = await readDistributionSqlTableColumns(db, tableName, tableColumnsByTarget);
  const result = await insertSqlRowsBatched(
    db,
    tableName,
    loadedRows[tableName],
    rows,
    tableColumns,
    {
      batchSize: distributionSqlBatchSize(db, tableName),
      copy: canUseSqlCopy(db) && distributionCopyTableNames.has(tableName),
      retryLimit: 3
    }
  );
  loadedRows[tableName] += result.insertedRows;
}

async function resetDistributionSqlTarget(
  db: SqlQueryClient,
  tableNames: readonly DistributionErhTableName[],
  progress: ProgressLogger
): Promise<void> {
  progress("→ reset: truncating Distribution B2-erh target tables…");
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

const distributionCopyTableNames: ReadonlySet<DistributionErhTableName> = new Set([
  "raw_import_rows",
  "normalized_earnings",
  "earning_allocations",
  "statement_lines"
]);

function distributionSqlBatchSize(db: SqlQueryClient, tableName: DistributionErhTableName): number {
  return canUseSqlCopy(db) && distributionCopyTableNames.has(tableName) ? 5_000 : 1_000;
}

function canUseSqlCopy(db: SqlQueryClient): db is ClosableSqlQueryClient {
  return "copyRows" in db && typeof db.copyRows === "function";
}

async function readDistributionSqlTableColumns(
  db: SqlQueryClient,
  tableName: DistributionErhTableName,
  tableColumnsByTarget: Map<DistributionErhTableName, ReadonlySet<string>>
): Promise<ReadonlySet<string>> {
  const cached = tableColumnsByTarget.get(tableName);
  if (cached !== undefined) {
    return cached;
  }

  const tableColumns = await readSqlTableColumns(db, tableName);
  tableColumnsByTarget.set(tableName, tableColumns);
  return tableColumns;
}

function shouldSkipDiagnosticSpec(spec: DistributionErhSpec, contract: DistributionErhTransformContract): boolean {
  return spec.auditExcluded || spec.identityLinkMustBeEmpty || (spec.rawImportRowsDecision && contract.rawImportRowsMode === "archive");
}

function loadableDistributionTargetTableNames(contract: DistributionErhTransformContract): readonly DistributionErhTableName[] {
  const specs = buildDistributionErhTableSpecs(contract.tablePrefix);
  return specs
    .filter((spec) => !shouldSkipDiagnosticSpec(spec, contract))
    .map((spec) => spec.targetTable);
}

const distributionPgliteFkTargets: Readonly<Record<DistributionErhTableName, Readonly<Record<string, DistributionErhTableName>>>> = {
  artists: {
    default_payee_id: "payees",
    default_split_contract_id: "contracts"
  },
  audit_logs: {},
  calculation_runs: {
    batch_id: "import_batches"
  },
  catalog_aliases: {
    artist_id: "artists",
    payee_id: "payees",
    label_id: "labels",
    release_id: "releases",
    track_id: "tracks"
  },
  contract_cost_terms: {
    contract_id: "contracts",
    payee_id: "payees"
  },
  contract_extractions: {
    contract_id: "contracts"
  },
  contract_scopes: {
    contract_id: "contracts"
  },
  contracts: {},
  earning_allocations: {
    earning_id: "normalized_earnings",
    calculation_run_id: "calculation_runs",
    payee_id: "payees",
    contract_id: "contracts",
    track_id: "tracks"
  },
  earning_track_matches: {
    earning_id: "normalized_earnings",
    track_id: "tracks"
  },
  expense_applications: {
    cost_term_id: "contract_cost_terms",
    payee_id: "payees",
    statement_id: "statements",
    calculation_run_id: "calculation_runs"
  },
  fx_rates: {},
  identity_link: {
    payee_id: "payees"
  },
  import_batches: {},
  import_issues: {
    batch_id: "import_batches",
    raw_import_row_id: "raw_import_rows"
  },
  labels: {
    payee_id: "payees"
  },
  mapping_rules: {
    target_track_id: "tracks"
  },
  mapping_stats_by_batch: {
    batch_id: "import_batches"
  },
  normalized_earnings: {
    batch_id: "import_batches",
    raw_import_row_id: "raw_import_rows"
  },
  payee_balances: {
    payee_id: "payees",
    statement_id: "statements"
  },
  payees: {},
  payments: {
    payee_id: "payees"
  },
  raw_import_rows: {
    batch_id: "import_batches"
  },
  releases: {
    label_id: "labels"
  },
  royalty_rules: {
    contract_id: "contracts",
    payee_id: "payees"
  },
  statement_lines: {
    statement_id: "statements",
    earning_allocation_id: "earning_allocations",
    track_id: "tracks"
  },
  statement_payment_links: {
    statement_id: "statements",
    payment_id: "payments"
  },
  statements: {
    payee_id: "payees",
    calculation_run_id: "calculation_runs"
  },
  suspense_items: {
    earning_id: "normalized_earnings"
  },
  track_contributors: {
    track_id: "tracks",
    artist_id: "artists"
  },
  tracks: {
    release_id: "releases"
  }
};

interface DistributionPgliteContext {
  readonly statementCurrencyById: Map<string, string>;
}

function createDistributionPgliteContext(): DistributionPgliteContext {
  return {
    statementCurrencyById: new Map<string, string>()
  };
}

function toDistributionPgliteRow(
  tableName: DistributionErhTableName,
  cleanRow: DistributionErhCleanRow,
  context: DistributionPgliteContext
): Readonly<Record<string, string | boolean | number | null>> {
  const legacyId = legacyIntegerId(nonBooleanLegacyValue(cleanRow.id, tableName, "id"), tableName, "id");
  if (legacyId === null) {
    throw new Error(`Distribution B2-erh pglite row is missing ${tableName}.id.`);
  }

  const row: Record<string, string | boolean | number | null> = {
    ...cleanRow,
    id: legacyUuidForTable(tableName, legacyId),
    legacy_id: legacyId
  };
  const fkTargets = distributionPgliteFkTargets[tableName];

  for (const [columnName, targetTableName] of Object.entries(fkTargets)) {
    row[columnName] = legacyForeignUuid(targetTableName, cleanRow[columnName], tableName, columnName);
  }

  if (tableName === "statement_lines" && (row.currency === null || row.currency === undefined)) {
    const statementId = row.statement_id;
    if (typeof statementId === "string") {
      row.currency = context.statementCurrencyById.get(statementId) ?? null;
    }
  }

  return row;
}

function rememberDistributionPgliteRow(
  tableName: DistributionErhTableName,
  row: Readonly<Record<string, string | boolean | number | null>>,
  context: DistributionPgliteContext
): void {
  if (tableName !== "statements") {
    return;
  }

  const id = row.id;
  const currency = row.currency;
  if (typeof id === "string" && typeof currency === "string") {
    context.statementCurrencyById.set(id, currency);
  }
}

function legacyForeignUuid(
  targetTableName: DistributionErhTableName,
  value: string | boolean | null | undefined,
  sourceTableName: DistributionErhTableName,
  columnName: string
): string | null {
  if (typeof value === "boolean") {
    throw new Error(`Distribution B2-erh FK cannot be boolean for ${sourceTableName}.${columnName}.`);
  }

  const legacyId = legacyIntegerId(value, sourceTableName, columnName);
  if (legacyId === null) {
    return null;
  }

  if (legacyId === 0) {
    if (sourceTableName === "contract_cost_terms" && columnName === "payee_id") {
      return null;
    }

    throw new Error(
      `Distribution B2-erh FK sentinel 0 requires a migration decision for ${sourceTableName}.${columnName} -> ${targetTableName}.`
    );
  }

  return legacyUuidForTable(targetTableName, legacyId);
}

async function readDistributionSqlReadback(
  db: SqlQueryClient,
  parity: DistributionB2ErhLoadReport
): Promise<DistributionB2ErhSqlReadbackReport> {
  const counts = await readDistributionSqlCounts(db, parity.counts.target);
  assertStableEqual(counts, parity.counts.target, "postgres target counts");

  const moneyGoldens = await readDistributionSqlMoneyGoldens(db, parity.moneyGoldens);
  assertStableEqual(moneyGoldens, parity.moneyGoldens, "postgres money goldens");

  const mappingCoverage = await readDistributionSqlMappingCoverage(db, parity.mappingCoverage);
  assertStableEqual(mappingCoverage, parity.mappingCoverage, "postgres mapping coverage");

  const orphanFks = await readDistributionSqlOrphanFks(db, parity.orphanFks);
  assertStableEqual(orphanFks, parity.orphanFks, "postgres orphan FKs");

  const splitInvariant = await readDistributionSqlSplitInvariant(db, parity.splitInvariant);
  assertStableEqual(splitInvariant, parity.splitInvariant, "postgres split invariant");

  const verbatimRows = await readDistributionSqlVerbatimRows(db, parity.verbatimRows);
  assertStableEqual(verbatimRows, parity.verbatimRows, "postgres verbatim rows");

  return {
    status: "pass",
    counts,
    moneyGoldens,
    mappingCoverage,
    orphanFks,
    splitInvariant,
    verbatimRows
  };
}

function createDistributionContractOnlyParity(request: DistributionB2ErhLoadRequest): DistributionB2ErhLoadReport {
  const expectedCounts = request.contract.expectedCounts as Readonly<Record<DistributionErhTableName, number>>;
  const moneyGoldens = request.contract.expectedMoneyGoldens as DistributionB2ErhMoneyGoldens | undefined;
  const mappingCoverage = request.contract.expectedMappingCoverage as Readonly<Record<string, DistributionB2ErhCountAmount>> | undefined;
  const orphanFks = expectedOrphanFksFromContract(request.contract.expectedOrphanFks as readonly DistributionB2ErhOrphanFkName[] | undefined);
  return {
    generatedAt: request.generatedAt,
    source: {
      mode: "mysql-dump-streaming-parser",
      label: request.sourceLabel,
      sourceDatabaseName: request.contract.sourceDatabaseName,
      tablePrefix: request.contract.tablePrefix
    },
    target: {
      mode: "streamed-clean-distribution-aggregates",
      schemaContract: "packages/db distribution schema rowset",
      moneyStorage: "NUMERIC(28,10)",
      percentageStorage: "NUMERIC(12,6)"
    },
    counts: {
      source: expectedCounts,
      target: expectedCounts,
      expected: request.contract.expectedCounts
    },
    checksumGate: {
      status: "pass",
      tables: [],
      zeroDateNullCount: 0
    },
    readableAssertions: request.contract.expectedReadableAssertions ?? {
      tableCurrencyTotals: {},
      rowHashes: {}
    },
    ...(moneyGoldens === undefined ? {} : { moneyGoldens }),
    ...(mappingCoverage === undefined ? {} : { mappingCoverage }),
    ...(orphanFks === undefined ? {} : { orphanFks }),
    splitInvariant: distributionB2ErhExpectedSqlSplitInvariant,
    decisions: decisionNotes(request.contract.rawImportRowsMode)
  };
}

function expectedOrphanFksFromContract(
  expected: readonly DistributionB2ErhOrphanFkName[] | undefined
): DistributionB2ErhOrphanFkReport | undefined {
  if (expected === undefined) {
    return undefined;
  }

  return {
    status: "pass",
    counts: Object.fromEntries(expected.map((name) => [name, 0])) as Readonly<Record<DistributionB2ErhOrphanFkName, number>>
  };
}

async function logDistributionSqlTableCounts(
  db: SqlQueryClient,
  contract: DistributionErhTransformContract,
  progress: ProgressLogger
): Promise<void> {
  for (const tableName of loadableDistributionTargetTableNames(contract)) {
    progress(`→ ${tableName}: reading…`);
    const rowCount = await readSqlTableRowCount(db, tableName);
    progress(`✓ ${tableName} ${String(rowCount)} rows`);
  }
}

async function readDistributionSqlCounts(
  db: SqlQueryClient,
  expectedCounts: Readonly<Record<DistributionErhTableName, number>>
): Promise<Readonly<Record<DistributionErhTableName, number>>> {
  const entries: [DistributionErhTableName, number][] = [];
  for (const tableName of Object.keys(expectedCounts) as DistributionErhTableName[]) {
    entries.push([tableName, await readSqlTableRowCount(db, tableName)]);
  }

  return Object.fromEntries(entries) as Readonly<Record<DistributionErhTableName, number>>;
}

async function readDistributionSqlMoneyGoldens(
  db: SqlQueryClient,
  expected: DistributionB2ErhMoneyGoldens | undefined
): Promise<DistributionB2ErhMoneyGoldens | undefined> {
  if (expected === undefined) {
    return undefined;
  }

  return {
    earning_allocations: await readEarningAllocationsSqlGoldens(db),
    normalized_earnings: await readNormalizedEarningsSqlGoldens(db),
    suspense_items: await readSuspenseItemsSqlGoldens(db),
    statement_lines: await readStatementLinesSqlGoldens(db),
    contract_cost_terms_recoupable: await readContractCostTermsSqlGoldens(db)
  };
}

async function readEarningAllocationsSqlGoldens(db: SqlQueryClient): Promise<Readonly<Record<string, DistributionB2ErhCurrencyMoneyGolden>>> {
  const result: SqlQueryResult = await db.query(`
    select
      currency,
      count(*)::text as n,
      count(distinct payee_id)::text as payees,
      count(distinct contract_id)::text as contracts,
      coalesce(sum(gross_amount), 0)::text as gross_amount,
      coalesce(sum(gross_share), 0)::text as gross_share,
      coalesce(sum(net_payable), 0)::text as net_payable,
      coalesce(sum(original_gross_amount), 0)::text as original_gross_amount
    from earning_allocations
    group by currency
    order by currency
  `);

  return Object.fromEntries(result.rows.map((row) => [
    stringCell(row, "currency"),
    {
      n: numberCell(row, "n"),
      payees: numberCell(row, "payees"),
      contracts: numberCell(row, "contracts"),
      gross_amount: normalizeDbDecimal(row.gross_amount, 10),
      gross_share: normalizeDbDecimal(row.gross_share, 10),
      net_payable: normalizeDbDecimal(row.net_payable, 10),
      original_gross_amount: normalizeDbDecimal(row.original_gross_amount, 10)
    }
  ]));
}

async function readNormalizedEarningsSqlGoldens(db: SqlQueryClient): Promise<Readonly<Record<string, DistributionB2ErhCurrencyMoneyGolden>>> {
  const result: SqlQueryResult = await db.query(`
    select
      currency,
      count(*)::text as n,
      coalesce(sum(gross_amount), 0)::text as gross_amount,
      coalesce(sum(quantity), 0)::text as quantity
    from normalized_earnings
    group by currency
    order by currency
  `);

  return Object.fromEntries(result.rows.map((row) => [
    stringCell(row, "currency"),
    {
      n: numberCell(row, "n"),
      gross_amount: normalizeDbDecimal(row.gross_amount, 10),
      quantity: formatQuantityGolden(parseStreamingScaledDecimal(String(row.quantity ?? "0"), 6))
    }
  ]));
}

async function readSuspenseItemsSqlGoldens(db: SqlQueryClient): Promise<Readonly<Record<string, DistributionB2ErhCurrencyMoneyGolden>>> {
  const result: SqlQueryResult = await db.query(`
    select
      currency,
      count(*)::text as n,
      count(*) filter (where resolved = true)::text as resolved,
      coalesce(sum(amount), 0)::text as amount
    from suspense_items
    group by currency
    order by currency
  `);

  return Object.fromEntries(result.rows.map((row) => [
    stringCell(row, "currency"),
    {
      n: numberCell(row, "n"),
      resolved: numberCell(row, "resolved"),
      amount: normalizeDbDecimal(row.amount, 10)
    }
  ]));
}

async function readStatementLinesSqlGoldens(db: SqlQueryClient): Promise<Readonly<Record<string, string | number>>> {
  const result: SqlQueryResult = await db.query(`
    select
      count(*)::text as n,
      coalesce(sum(net_payable), 0)::text as net_payable,
      coalesce(sum(recoupment_applied), 0)::text as recoupment_applied
    from statement_lines
  `);
  const row = requiredFirstRow(result, "statement_lines");
  return {
    n: numberCell(row, "n"),
    net_payable: normalizeDbDecimal(row.net_payable, 10),
    recoupment_applied: normalizeDbDecimal(row.recoupment_applied, 10)
  };
}

async function readContractCostTermsSqlGoldens(db: SqlQueryClient): Promise<Readonly<Record<string, DistributionB2ErhCurrencyMoneyGolden>>> {
  const result: SqlQueryResult = await db.query(`
    select
      currency,
      count(*)::text as n,
      coalesce(sum(amount), 0)::text as amount
    from contract_cost_terms
    where recoupable = true
    group by currency
    order by currency
  `);

  return Object.fromEntries(result.rows.map((row) => [
    stringCell(row, "currency"),
    {
      n: numberCell(row, "n"),
      amount: normalizeDbDecimal(row.amount, 10)
    }
  ]));
}

async function readDistributionSqlMappingCoverage(
  db: SqlQueryClient,
  expected: Readonly<Record<string, DistributionB2ErhCountAmount>> | undefined
): Promise<Readonly<Record<string, DistributionB2ErhCountAmount>> | undefined> {
  if (expected === undefined) {
    return undefined;
  }

  const result: SqlQueryResult = await db.query(`
    select
      mapping_status,
      count(*)::text as n,
      coalesce(sum(gross_amount), 0)::text as gross_amount
    from normalized_earnings
    group by mapping_status
    order by mapping_status
  `);

  return Object.fromEntries(result.rows.map((row) => [
    stringCell(row, "mapping_status"),
    {
      n: numberCell(row, "n"),
      gross_amount: normalizeDbDecimal(row.gross_amount, 10)
    }
  ]));
}

async function readDistributionSqlOrphanFks(
  db: SqlQueryClient,
  expected: DistributionB2ErhOrphanFkReport | undefined
): Promise<DistributionB2ErhOrphanFkReport | undefined> {
  if (expected === undefined) {
    return undefined;
  }

  const counts: Record<DistributionB2ErhOrphanFkName, number> = {
    "alloc.normalized_earning_id->normalized_earnings": await readOrphanCount(db, "earning_allocations", "earning_id", "normalized_earnings"),
    "alloc.payee_id->payees": await readOrphanCount(db, "earning_allocations", "payee_id", "payees"),
    "sline.earning_allocation_id->earning_allocations": await readOrphanCount(db, "statement_lines", "earning_allocation_id", "earning_allocations"),
    "sline.statement_id->statements": await readOrphanCount(db, "statement_lines", "statement_id", "statements"),
    "pbal.payee_id->payees": await readOrphanCount(db, "payee_balances", "payee_id", "payees")
  };

  return {
    status: "pass",
    counts
  };
}

async function readOrphanCount(db: SqlQueryClient, tableName: string, columnName: string, targetTableName: string): Promise<number> {
  const result: SqlQueryResult = await db.query(`
    select count(*)::text as n
    from ${tableName} source
    left join ${targetTableName} target on source.${columnName} = target.id
    where source.${columnName} is not null and target.id is null
  `);
  return numberCell(requiredFirstRow(result, `${tableName}.${columnName}`), "n");
}

async function readDistributionSqlSplitInvariant(
  db: SqlQueryClient,
  expected: DistributionB2ErhSplitInvariantReport
): Promise<DistributionB2ErhSplitInvariantReport> {
  const result: SqlQueryResult = await db.query(`
    select
      count(*)::text as checked,
      count(*) filter (where split_sum = 100.000000)::text as complete
    from (
      select earning_id, coalesce(sum(split_percentage), 0) as split_sum
      from earning_allocations
      group by earning_id
    ) grouped
  `);
  const row = requiredFirstRow(result, "split invariant");
  const checked = numberCell(row, "checked");
  const complete = numberCell(row, "complete");
  if (checked !== complete) {
    throw new Error(`Distribution B2-erh postgres split invariant failed: checked ${String(checked)}, complete ${String(complete)}.`);
  }

  return {
    status: expected.status,
    checkedEarningGroups: checked
  };
}

async function readDistributionSqlVerbatimRows(
  db: SqlQueryClient,
  expected: DistributionB2ErhVerbatimReport | undefined
): Promise<DistributionB2ErhVerbatimReport | undefined> {
  if (expected === undefined) {
    return undefined;
  }

  return {
    statements: await readStatementSqlVerbatimRows(db),
    payeeBalances: await readPayeeBalanceSqlVerbatimRows(db),
    fxRates: await readFxRateSqlVerbatimRows(db)
  };
}

async function readStatementSqlVerbatimRows(db: SqlQueryClient): Promise<readonly DistributionB2ErhVerbatimRow[]> {
  const result: SqlQueryResult = await db.query(`
    select
      statements.legacy_id::text as id,
      payees.legacy_id::text as payee_id,
      statements.currency,
      statements.period_start::text as period_start,
      statements.period_end::text as period_end,
      statements.gross_total::text as gross_total,
      statements.recoupment_total::text as recoupment_total,
      statements.net_payable::text as net_payable,
      statements.status
    from statements
    join payees on payees.id = statements.payee_id
    order by statements.legacy_id
  `);

  return result.rows.map((row) => ({
    id: stringCell(row, "id"),
    payee_id: stringCell(row, "payee_id"),
    currency: stringCell(row, "currency"),
    period_start: stringCell(row, "period_start"),
    period_end: stringCell(row, "period_end"),
    gross_total: normalizeDbDecimal(row.gross_total, 10),
    recoupment_total: normalizeDbDecimal(row.recoupment_total, 10),
    net_payable: normalizeDbDecimal(row.net_payable, 10),
    status: stringCell(row, "status")
  }));
}

async function readPayeeBalanceSqlVerbatimRows(db: SqlQueryClient): Promise<readonly DistributionB2ErhVerbatimRow[]> {
  const result: SqlQueryResult = await db.query(`
    select
      payee_balances.legacy_id::text as id,
      payees.legacy_id::text as payee_id,
      payee_balances.currency,
      statements.legacy_id::text as statement_id,
      statements.period_end::text as period_end,
      payee_balances.opening_balance::text as opening_balance,
      payee_balances.period_net::text as period_net,
      payee_balances.closing_balance::text as closing_balance,
      payee_balances.movement_type
    from payee_balances
    join payees on payees.id = payee_balances.payee_id
    left join statements on statements.id = payee_balances.statement_id
    order by payee_balances.legacy_id
  `);

  return result.rows.map((row) => ({
    id: stringCell(row, "id"),
    payee_id: stringCell(row, "payee_id"),
    currency: stringCell(row, "currency"),
    statement_id: stringCell(row, "statement_id"),
    period_end: stringCell(row, "period_end"),
    opening_balance: normalizeDbDecimal(row.opening_balance, 10),
    period_net: normalizeDbDecimal(row.period_net, 10),
    closing_balance: normalizeDbDecimal(row.closing_balance, 10),
    movement_type: stringCell(row, "movement_type")
  }));
}

async function readFxRateSqlVerbatimRows(db: SqlQueryClient): Promise<readonly DistributionB2ErhVerbatimRow[]> {
  const result: SqlQueryResult = await db.query(`
    select
      legacy_id::text as id,
      from_currency,
      to_currency,
      rate::text as rate,
      effective_date::text as effective_date,
      '' as created_at
    from fx_rates
    order by legacy_id
  `);

  return result.rows.map((row) => ({
    id: stringCell(row, "id"),
    from_currency: stringCell(row, "from_currency"),
    to_currency: stringCell(row, "to_currency"),
    rate: normalizeDbDecimal(row.rate, 10),
    effective_date: stringCell(row, "effective_date"),
    created_at: stringCell(row, "created_at")
  }));
}

function assertStableEqual(actual: unknown, expected: unknown, label: string): void {
  const actualJson = stableJson(actual);
  const expectedJson = stableJson(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Distribution B2-erh ${label} mismatch. Expected ${truncateForError(expectedJson)}, got ${truncateForError(actualJson)}.`);
  }
}

function truncateForError(value: string): string {
  return value.length <= 2_000 ? value : `${value.slice(0, 2_000)}…`;
}

function requiredFirstRow(result: SqlQueryResult, label: string): Readonly<Record<string, unknown>> {
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error(`Distribution B2-erh postgres readback returned no row for ${label}.`);
  }

  return row;
}

function stringCell(row: Readonly<Record<string, unknown>>, columnName: string): string {
  const value = row[columnName];
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function numberCell(row: Readonly<Record<string, unknown>>, columnName: string): number {
  const value = Number(stringCell(row, columnName));
  if (!Number.isInteger(value)) {
    throw new Error(`Distribution B2-erh postgres readback integer parse failed for ${columnName}.`);
  }

  return value;
}

function normalizeDbDecimal(value: unknown, scale: number): string {
  return formatStreamingScaledDecimal(parseStreamingScaledDecimal(String(value ?? "0"), scale), scale);
}

function nonBooleanLegacyValue(
  value: string | boolean | null | undefined,
  tableName: DistributionErhTableName,
  columnName: string
): string | null | undefined {
  if (typeof value === "boolean") {
    throw new Error(`Distribution B2-erh legacy ID cannot be boolean for ${tableName}.${columnName}.`);
  }

  return value;
}

interface StreamingAccumulator {
  readonly sourceCounts: Record<DistributionErhTableName, number>;
  readonly targetCounts: Record<DistributionErhTableName, number>;
  readonly checksumsByTable: Map<DistributionErhTableName, StreamingChecksumAccumulator>;
  readonly zeroDateNullCount: { value: number };
  readonly readableAssertions: DistributionErhExpectedReadableAssertions;
  readonly moneyGoldens: DistributionB2ErhMoneyGoldens;
  readonly verbatimRows: DistributionB2ErhVerbatimReport;
  readonly mappingCoverage: Readonly<Record<string, DistributionB2ErhCountAmount>>;
  readonly orphanFks: DistributionB2ErhOrphanFkReport;
  readonly splitGroups: Map<string, StreamingSplitRow[]>;
}

interface StreamingSplitRow {
  readonly id: string;
  readonly earningId: string;
  readonly calculationRunId: string;
  readonly trackId: string | null;
  readonly grossAmount: string;
  readonly currency: string;
  readonly contractId: string | null;
  readonly payeeId: string;
  readonly percentage: string;
}

interface IdSets {
  readonly normalizedEarnings: Set<string>;
  readonly payees: Set<string>;
  readonly earningAllocations: Set<string>;
  readonly statements: Set<string>;
}

interface StreamingContext {
  readonly contract: DistributionErhTransformContract;
  readonly specBySourceTable: ReadonlyMap<string, DistributionErhSpec>;
  readonly idSets: IdSets;
  readonly selectedSourceTables: readonly string[];
  readonly zeroDateNullCount: { value: number };
}

interface StreamingReadableAccumulators {
  readonly tableCurrencyTotals: Map<string, CurrencyTotalsAccumulator>;
  readonly statements: DistributionB2ErhVerbatimRow[];
  readonly payeeBalances: DistributionB2ErhVerbatimRow[];
  readonly fxRates: DistributionB2ErhVerbatimRow[];
}

interface CurrencyTotalsAccumulator {
  count: number;
  readonly currencyTotals: Map<string, Map<string, bigint>>;
  readonly scales: Map<string, number>;
}

interface MoneyGoldenAccumulators {
  readonly earningAllocations: Map<string, EarningAllocationGoldenAccumulator>;
  readonly normalizedEarnings: Map<string, NormalizedEarningsGoldenAccumulator>;
  readonly suspenseItems: Map<string, SuspenseGoldenAccumulator>;
  readonly statementLines: StatementLinesGoldenAccumulator;
  readonly contractCostTermsRecoupable: Map<string, CountAmountUnits>;
  readonly mappingCoverage: Map<string, CountAmountUnits>;
}

interface EarningAllocationGoldenAccumulator {
  n: number;
  readonly payees: Set<string>;
  readonly contracts: Set<string>;
  grossAmount: bigint;
  grossShare: bigint;
  netPayable: bigint;
  originalGrossAmount: bigint;
}

interface NormalizedEarningsGoldenAccumulator {
  n: number;
  grossAmount: bigint;
  quantity: bigint;
}

interface SuspenseGoldenAccumulator {
  n: number;
  resolved: number;
  amount: bigint;
}

interface StatementLinesGoldenAccumulator {
  n: number;
  netPayable: bigint;
  recoupmentApplied: bigint;
}

interface CountAmountUnits {
  n: number;
  amount: bigint;
}

interface OrphanAccumulator {
  readonly counts: Record<DistributionB2ErhOrphanFkName, number>;
}

interface StreamingPassTwoAccumulators {
  readonly sourceCounts: Record<DistributionErhTableName, number>;
  readonly targetCounts: Record<DistributionErhTableName, number>;
  readonly checksumsByTable: Map<DistributionErhTableName, StreamingChecksumAccumulator>;
  readonly readable: StreamingReadableAccumulators;
  readonly money: MoneyGoldenAccumulators;
  readonly orphan: OrphanAccumulator;
  readonly splitGroups: Map<string, StreamingSplitRow[]>;
}

async function buildStreamingAccumulator(filePath: string, contract: DistributionErhTransformContract): Promise<StreamingAccumulator> {
  const specs = buildDistributionErhTableSpecs(contract.tablePrefix);
  const selectedSourceTables = specs.map((spec) => spec.sourceTable);
  const specBySourceTable = new Map(specs.map((spec) => [spec.sourceTable, spec]));
  const idSets: IdSets = {
    normalizedEarnings: new Set<string>(),
    payees: new Set<string>(),
    earningAllocations: new Set<string>(),
    statements: new Set<string>()
  };

  await streamMysqlInsertDumpRows(filePath, selectedSourceTables, ({ tableName, row }) => {
    const spec = requireSpec(specBySourceTable, tableName);
    collectStreamingIds(spec.targetTable, row, idSets);
  });

  const zeroDateNullCount = { value: 0 };
  const context: StreamingContext = {
    contract,
    specBySourceTable,
    idSets,
    selectedSourceTables,
    zeroDateNullCount
  };
  const passTwo = createStreamingPassTwoAccumulators();
  await streamMysqlInsertDumpRows(filePath, selectedSourceTables, ({ tableName, row }) => {
    consumeStreamingRow(context, passTwo, tableName, row);
  });

  assertExpectedCounts(passTwo.sourceCounts, passTwo.targetCounts, contract);
  const checksums = [...passTwo.checksumsByTable.values()].map((checksum) => checksum.toComparison());
  const readableAssertions = finalizeReadableAssertions(passTwo.readable);
  const moneyGoldens = finalizeMoneyGoldens(passTwo.money);
  const mappingCoverage = finalizeMappingCoverage(passTwo.money.mappingCoverage);
  const orphanFks = finalizeOrphanFks(passTwo.orphan);

  return {
    sourceCounts: passTwo.sourceCounts,
    targetCounts: passTwo.targetCounts,
    checksumsByTable: passTwo.checksumsByTable,
    zeroDateNullCount,
    readableAssertions,
    moneyGoldens,
    verbatimRows: {
      statements: passTwo.readable.statements,
      payeeBalances: passTwo.readable.payeeBalances,
      fxRates: passTwo.readable.fxRates
    },
    mappingCoverage,
    orphanFks,
    splitGroups: passTwo.splitGroups
  };
}

function createStreamingReport(
  request: DistributionB2ErhLoadRequest,
  accumulator: StreamingAccumulator,
  splitInvariant: DistributionB2ErhSplitInvariantReport
): DistributionB2ErhLoadReport {
  return {
    generatedAt: request.generatedAt,
    source: {
      mode: "mysql-dump-streaming-parser",
      label: request.sourceLabel,
      sourceDatabaseName: request.contract.sourceDatabaseName,
      tablePrefix: request.contract.tablePrefix
    },
    target: {
      mode: "streamed-clean-distribution-aggregates",
      schemaContract: "packages/db distribution schema rowset",
      moneyStorage: "NUMERIC(28,10)",
      percentageStorage: "NUMERIC(12,6)"
    },
    counts: {
      source: accumulator.sourceCounts,
      target: accumulator.targetCounts,
      expected: request.contract.expectedCounts
    },
    checksumGate: {
      status: "pass",
      tables: [...accumulator.checksumsByTable.values()].map((checksum) => checksum.toComparison()),
      zeroDateNullCount: accumulator.zeroDateNullCount.value
    },
    readableAssertions: accumulator.readableAssertions,
    moneyGoldens: accumulator.moneyGoldens,
    verbatimRows: accumulator.verbatimRows,
    mappingCoverage: accumulator.mappingCoverage,
    orphanFks: accumulator.orphanFks,
    splitInvariant,
    decisions: decisionNotes(request.contract.rawImportRowsMode)
  };
}

function createStreamingPassTwoAccumulators(): StreamingPassTwoAccumulators {
  return {
    sourceCounts: createEmptyStreamingCounts(),
    targetCounts: createEmptyStreamingCounts(),
    checksumsByTable: new Map<DistributionErhTableName, StreamingChecksumAccumulator>(),
    readable: {
      tableCurrencyTotals: new Map<string, CurrencyTotalsAccumulator>(),
      statements: [],
      payeeBalances: [],
      fxRates: []
    },
    money: {
      earningAllocations: new Map<string, EarningAllocationGoldenAccumulator>(),
      normalizedEarnings: new Map<string, NormalizedEarningsGoldenAccumulator>(),
      suspenseItems: new Map<string, SuspenseGoldenAccumulator>(),
      statementLines: {
        n: 0,
        netPayable: 0n,
        recoupmentApplied: 0n
      },
      contractCostTermsRecoupable: new Map<string, CountAmountUnits>(),
      mappingCoverage: new Map<string, CountAmountUnits>()
    },
    orphan: {
      counts: {
        "alloc.normalized_earning_id->normalized_earnings": 0,
        "alloc.payee_id->payees": 0,
        "sline.earning_allocation_id->earning_allocations": 0,
        "sline.statement_id->statements": 0,
        "pbal.payee_id->payees": 0
      }
    },
    splitGroups: new Map<string, StreamingSplitRow[]>()
  };
}

function createEmptyStreamingCounts(): Record<DistributionErhTableName, number> {
  const counts: Partial<Record<DistributionErhTableName, number>> = {};
  for (const spec of buildDistributionErhTableSpecs("wp_")) {
    counts[spec.targetTable] = 0;
  }

  return counts as Record<DistributionErhTableName, number>;
}

function requireSpec(specBySourceTable: ReadonlyMap<string, DistributionErhSpec>, sourceTable: string): DistributionErhSpec {
  const spec = specBySourceTable.get(sourceTable);
  if (spec === undefined) {
    throw new Error(`Distribution B2-erh selected source table is missing a spec: ${sourceTable}.`);
  }

  return spec;
}

function collectStreamingIds(tableName: DistributionErhTableName, row: MysqlDumpRecord, idSets: IdSets): void {
  if (tableName === "normalized_earnings") {
    addRequiredRawId(idSets.normalizedEarnings, row, "id", tableName);
  } else if (tableName === "payees") {
    addRequiredRawId(idSets.payees, row, "id", tableName);
  } else if (tableName === "earning_allocations") {
    addRequiredRawId(idSets.earningAllocations, row, "id", tableName);
  } else if (tableName === "statements") {
    addRequiredRawId(idSets.statements, row, "id", tableName);
  }
}

function addRequiredRawId(ids: Set<string>, row: MysqlDumpRecord, column: string, tableName: DistributionErhTableName): void {
  const value = row[column];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Distribution B2-erh missing ${tableName}.${column} during FK pre-scan.`);
  }

  ids.add(value);
}

function consumeStreamingRow(context: StreamingContext, accumulators: StreamingPassTwoAccumulators, sourceTable: string, sourceRow: MysqlDumpRecord): void {
  const spec = requireSpec(context.specBySourceTable, sourceTable);
  accumulators.sourceCounts[spec.targetTable] += 1;
  if (spec.identityLinkMustBeEmpty) {
    throw new Error(
      `Distribution B2-erh identity_link source table is not empty (${String(accumulators.sourceCounts[spec.targetTable])} rows). office_partner_id is intentionally not populated in this ETL; unification is a separate decision.`
    );
  }

  if (spec.auditExcluded || (spec.rawImportRowsDecision && context.contract.rawImportRowsMode === "archive")) {
    return;
  }

  const cleanRow = normalizeStreamingRow(sourceRow, spec, context.zeroDateNullCount);
  accumulators.targetCounts[spec.targetTable] += 1;
  upsertChecksum(accumulators.checksumsByTable, spec).addRow(cleanRow);
  updateReadableAccumulators(accumulators.readable, spec.targetTable, cleanRow);
  updateMoneyGoldens(accumulators.money, spec.targetTable, cleanRow);
  updateOrphanCounts(accumulators.orphan, context.idSets, spec.targetTable, cleanRow);
  updateSplitGroups(accumulators.splitGroups, spec.targetTable, cleanRow);
}

function normalizeStreamingRow(
  sourceRow: MysqlDumpRecord,
  spec: DistributionErhSpec,
  zeroDateNullCount: { value: number }
): DistributionErhCleanRow {
  const rowId = sourceRow.id ?? null;
  const targetRow: Record<string, string | boolean | null> = {};
  for (const column of spec.columns) {
    targetRow[column.target] = normalizeStreamingCell(readAliasedStreamingCell(sourceRow, column), column, spec.targetTable, rowId, zeroDateNullCount);
  }

  return targetRow;
}

function normalizeStreamingCell(
  rawValue: string | null | undefined,
  column: DistributionErhColumnSpec,
  tableName: DistributionErhTableName,
  rowId: string | null,
  zeroDateNullCount: { value: number }
): string | boolean | null {
  const value = isMissingStreamingRawCell(rawValue, column) ? column.defaultValue : rawValue;
  if (value === undefined) {
    throw new Error(`Distribution B2-erh missing unresolved field ${tableName}.${column.target} for ${rowId ?? "unknown row"}.`);
  }

  if (value === null || (value === "" && column.kind !== "text")) {
    if (column.required && column.defaultValue === null) {
      throw new Error(`Distribution B2-erh missing required field ${tableName}.${column.target} for ${rowId ?? "unknown row"}.`);
    }

    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if ((column.kind === "date" || column.kind === "datetime") && (value === "0000-00-00" || value === "0000-00-00 00:00:00")) {
    zeroDateNullCount.value += 1;
    return null;
  }

  if (column.kind === "amount10" || column.kind === "fxRate10") {
    return erhMoney.format(erhMoney.parse(value));
  }

  if (column.kind === "percentage6" || column.kind === "quantity6") {
    return normalizeStreamingDecimal(value, 6, tableName, column.target, rowId);
  }

  if (column.kind === "percentage2") {
    return normalizeStreamingDecimal(value, 2, tableName, column.target, rowId);
  }

  if (column.kind === "integer") {
    if (!/^-?\d+$/.test(value.trim())) {
      throw new Error(`Distribution B2-erh integer parse failed for ${tableName}.${column.target} (${rowId ?? "unknown row"}): ${value}.`);
    }

    return value.trim();
  }

  if (column.kind === "boolean") {
    if (value === "1" || value.toLowerCase() === "true") {
      return true;
    }

    if (value === "0" || value.toLowerCase() === "false") {
      return false;
    }

    throw new Error(`Distribution B2-erh boolean parse failed for ${tableName}.${column.target} (${rowId ?? "unknown row"}): ${value}.`);
  }

  if (column.kind === "jsonArray" || column.kind === "jsonObject") {
    return stableJson(JSON.parse(value.trim()));
  }

  return value;
}

function isMissingStreamingRawCell(rawValue: string | null | undefined, column: DistributionErhColumnSpec): boolean {
  return rawValue === undefined || rawValue === null || (rawValue === "" && column.kind !== "text");
}

function readAliasedStreamingCell(row: MysqlDumpRecord, column: DistributionErhColumnSpec): string | null | undefined {
  for (const alias of column.aliases) {
    const value = row[alias];
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function normalizeStreamingDecimal(value: string, scale: number, tableName: DistributionErhTableName, columnName: string, rowId: string | null): string {
  const trimmed = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (match === null) {
    throw new Error(`Distribution B2-erh decimal parse failed for ${tableName}.${columnName} (${rowId ?? "unknown row"}): ${value}.`);
  }

  const sign = match[1] ?? "";
  const integerPart = match[2] ?? "";
  const fractionalPart = match[3] ?? "";
  if (fractionalPart.length > scale) {
    throw new Error(`Distribution B2-erh scale overflow for ${tableName}.${columnName} (${rowId ?? "unknown row"}): expected <= ${String(scale)} decimals, got ${String(fractionalPart.length)}.`);
  }

  return scale === 0 ? `${sign}${integerPart}` : `${sign}${integerPart}.${fractionalPart.padEnd(scale, "0")}`;
}

class StreamingChecksumAccumulator {
  readonly spec: DistributionErhSpec;
  rowCount = 0;
  readonly numericSums = new Map<string, bigint>();
  readonly booleanCounts = new Map<string, { true: number; false: number; null: number }>();
  readonly dateBounds = new Map<string, { min: string | null; max: string | null; nullCount: number }>();
  private textHash = 14_695_981_039_346_656_037n;

  constructor(spec: DistributionErhSpec) {
    this.spec = spec;
  }

  addRow(row: DistributionErhCleanRow): void {
    this.rowCount += 1;
    const rowText: string[] = [];
    for (const column of this.spec.columns) {
      const value = row[column.target] ?? null;
      if (isStreamingNumericKind(column.kind)) {
        const scale = streamingScaleForKind(column.kind);
        const current = this.numericSums.get(column.target) ?? 0n;
        const next = typeof value === "string" ? parseStreamingScaledDecimal(value, scale) : 0n;
        this.numericSums.set(column.target, current + next);
      } else if (column.kind === "boolean") {
        this.booleanCounts.set(column.target, addStreamingBooleanCount(this.booleanCounts.get(column.target), value));
      } else if (column.kind === "date" || column.kind === "datetime") {
        this.dateBounds.set(column.target, addStreamingDateBound(this.dateBounds.get(column.target), value));
      } else {
        rowText.push(`${column.target}=${typeof value === "boolean" ? String(value) : value ?? "NULL"}`);
      }
    }

    this.updateHash(rowText.join("\u001f"));
    this.updateHash("\u001e");
  }

  toChecksum(): DistributionErhTableChecksumComparison["source"] {
    return {
      rowCount: this.rowCount,
      numericSums: Object.fromEntries([...this.numericSums.entries()].map(([column, value]) => [column, formatStreamingScaledDecimal(value, streamingScaleForKind(requireColumn(this.spec, column).kind))])),
      booleanCounts: Object.fromEntries(this.booleanCounts.entries()),
      dateBounds: Object.fromEntries(this.dateBounds.entries()),
      normalizedTextHash: this.textHash.toString(16).padStart(16, "0")
    };
  }

  toComparison(): DistributionErhTableChecksumComparison {
    const checksum = this.toChecksum();
    return {
      tableName: this.spec.targetTable,
      status: "pass",
      source: checksum,
      target: checksum
    };
  }

  private updateHash(value: string): void {
    for (let index = 0; index < value.length; index += 1) {
      this.textHash ^= BigInt(value.charCodeAt(index));
      this.textHash = (this.textHash * 1_099_511_628_211n) & 18_446_744_073_709_551_615n;
    }
  }
}

function upsertChecksum(checksums: Map<DistributionErhTableName, StreamingChecksumAccumulator>, spec: DistributionErhSpec): StreamingChecksumAccumulator {
  const existing = checksums.get(spec.targetTable);
  if (existing !== undefined) {
    return existing;
  }

  const next = new StreamingChecksumAccumulator(spec);
  checksums.set(spec.targetTable, next);
  return next;
}

function requireColumn(spec: DistributionErhSpec, columnName: string): DistributionErhColumnSpec {
  const column = spec.columns.find((candidate) => candidate.target === columnName);
  if (column === undefined) {
    throw new Error(`Distribution B2-erh checksum column not found: ${spec.targetTable}.${columnName}.`);
  }

  return column;
}

function updateReadableAccumulators(readable: StreamingReadableAccumulators, tableName: DistributionErhTableName, row: DistributionErhCleanRow): void {
  const columns = readableCurrencyColumns(tableName);
  if (columns !== null && includeCurrencyProjectionRow(tableName, row)) {
    addCurrencyTotals(readable.tableCurrencyTotals, tableName, row, "currency", columns);
  }

  if (tableName === "statements") {
    readable.statements.push(projectVerbatimRow(row, ["id", "payee_id", "currency", "period_start", "period_end", "gross_total", "recoupment_total", "net_payable", "status"]));
  } else if (tableName === "payee_balances") {
    readable.payeeBalances.push(projectVerbatimRow(row, ["id", "payee_id", "currency", "statement_id", "period_end", "opening_balance", "period_net", "closing_balance", "movement_type"]));
  } else if (tableName === "fx_rates") {
    readable.fxRates.push(projectVerbatimRow(row, ["id", "from_currency", "to_currency", "rate", "effective_date", "created_at"]));
  }
}

function readableCurrencyColumns(tableName: DistributionErhTableName): readonly string[] | null {
  if (tableName === "earning_allocations") {
    return ["gross_amount", "gross_share", "recoupment_applied", "net_payable"];
  }

  if (tableName === "normalized_earnings") {
    return ["gross_amount", "quantity"];
  }

  if (tableName === "suspense_items") {
    return ["amount"];
  }

  if (tableName === "contract_cost_terms") {
    return ["amount"];
  }

  return null;
}

function includeCurrencyProjectionRow(tableName: DistributionErhTableName, row: DistributionErhCleanRow): boolean {
  return tableName !== "contract_cost_terms" || row.recoupable === true;
}

function addCurrencyTotals(
  tables: Map<string, CurrencyTotalsAccumulator>,
  tableName: string,
  row: DistributionErhCleanRow,
  currencyColumn: string,
  numericColumns: readonly string[]
): void {
  const tableTotals = tables.get(tableName) ?? { count: 0, currencyTotals: new Map<string, Map<string, bigint>>(), scales: new Map<string, number>() };
  tableTotals.count += 1;
  const currency = requireStringCell(row, currencyColumn, tableName);
  const currencyTotals = tableTotals.currencyTotals.get(currency) ?? new Map<string, bigint>();
  for (const column of numericColumns) {
    const value = requireStringCell(row, column, tableName);
    const scale = decimalScale(value);
    tableTotals.scales.set(column, Math.max(tableTotals.scales.get(column) ?? scale, scale));
    currencyTotals.set(column, (currencyTotals.get(column) ?? 0n) + parseStreamingScaledDecimal(value, scale));
  }

  tableTotals.currencyTotals.set(currency, currencyTotals);
  tables.set(tableName, tableTotals);
}

function updateMoneyGoldens(money: MoneyGoldenAccumulators, tableName: DistributionErhTableName, row: DistributionErhCleanRow): void {
  if (tableName === "earning_allocations") {
    const currency = requireStringCell(row, "currency", tableName);
    const current = money.earningAllocations.get(currency) ?? {
      n: 0,
      payees: new Set<string>(),
      contracts: new Set<string>(),
      grossAmount: 0n,
      grossShare: 0n,
      netPayable: 0n,
      originalGrossAmount: 0n
    };
    current.n += 1;
    current.payees.add(requireStringCell(row, "payee_id", tableName));
    const contractId = nullableStringCell(row, "contract_id");
    if (contractId !== null) {
      current.contracts.add(contractId);
    }
    current.grossAmount += parseAmount10(requireStringCell(row, "gross_amount", tableName));
    current.grossShare += parseAmount10(requireStringCell(row, "gross_share", tableName));
    current.netPayable += parseAmount10(requireStringCell(row, "net_payable", tableName));
    current.originalGrossAmount += parseAmount10(requireStringCell(row, "original_gross_amount", tableName));
    money.earningAllocations.set(currency, current);
  } else if (tableName === "normalized_earnings") {
    const currency = requireStringCell(row, "currency", tableName);
    const current = money.normalizedEarnings.get(currency) ?? { n: 0, grossAmount: 0n, quantity: 0n };
    current.n += 1;
    current.grossAmount += parseAmount10(requireStringCell(row, "gross_amount", tableName));
    current.quantity += parseStreamingScaledDecimal(requireStringCell(row, "quantity", tableName), 6);
    money.normalizedEarnings.set(currency, current);
    addMappingCoverage(money.mappingCoverage, requireStringCell(row, "mapping_status", tableName), requireStringCell(row, "gross_amount", tableName));
  } else if (tableName === "suspense_items") {
    const currency = requireStringCell(row, "currency", tableName);
    const current = money.suspenseItems.get(currency) ?? { n: 0, resolved: 0, amount: 0n };
    current.n += 1;
    current.resolved += row.resolved === true ? 1 : 0;
    current.amount += parseAmount10(requireStringCell(row, "amount", tableName));
    money.suspenseItems.set(currency, current);
  } else if (tableName === "statement_lines") {
    money.statementLines.n += 1;
    money.statementLines.netPayable += parseAmount10(requireStringCell(row, "net_payable", tableName));
    money.statementLines.recoupmentApplied += parseAmount10(requireStringCell(row, "recoupment_applied", tableName));
  } else if (tableName === "contract_cost_terms" && row.recoupable === true) {
    const currency = requireStringCell(row, "currency", tableName);
    const current = money.contractCostTermsRecoupable.get(currency) ?? { n: 0, amount: 0n };
    current.n += 1;
    current.amount += parseAmount10(requireStringCell(row, "amount", tableName));
    money.contractCostTermsRecoupable.set(currency, current);
  }
}

function addMappingCoverage(mapping: Map<string, CountAmountUnits>, status: string, grossAmount: string): void {
  const current = mapping.get(status) ?? { n: 0, amount: 0n };
  current.n += 1;
  current.amount += parseAmount10(grossAmount);
  mapping.set(status, current);
}

function updateOrphanCounts(orphan: OrphanAccumulator, idSets: IdSets, tableName: DistributionErhTableName, row: DistributionErhCleanRow): void {
  if (tableName === "earning_allocations") {
    if (!idSets.normalizedEarnings.has(requireStringCell(row, "earning_id", tableName))) {
      orphan.counts["alloc.normalized_earning_id->normalized_earnings"] += 1;
    }

    if (!idSets.payees.has(requireStringCell(row, "payee_id", tableName))) {
      orphan.counts["alloc.payee_id->payees"] += 1;
    }
  } else if (tableName === "statement_lines") {
    const allocationId = nullableStringCell(row, "earning_allocation_id");
    if (allocationId !== null && !idSets.earningAllocations.has(allocationId)) {
      orphan.counts["sline.earning_allocation_id->earning_allocations"] += 1;
    }

    if (!idSets.statements.has(requireStringCell(row, "statement_id", tableName))) {
      orphan.counts["sline.statement_id->statements"] += 1;
    }
  } else if (tableName === "payee_balances" && !idSets.payees.has(requireStringCell(row, "payee_id", tableName))) {
    orphan.counts["pbal.payee_id->payees"] += 1;
  }
}

function updateSplitGroups(groups: Map<string, StreamingSplitRow[]>, tableName: DistributionErhTableName, row: DistributionErhCleanRow): void {
  if (tableName !== "earning_allocations") {
    return;
  }

  const earningId = requireStringCell(row, "earning_id", tableName);
  const group = groups.get(earningId) ?? [];
  group.push({
    id: requireStringCell(row, "id", tableName),
    earningId,
    calculationRunId: requireStringCell(row, "calculation_run_id", tableName),
    trackId: nullableStringCell(row, "track_id"),
    grossAmount: requireStringCell(row, "gross_amount", tableName),
    currency: requireStringCell(row, "currency", tableName),
    contractId: nullableStringCell(row, "contract_id"),
    payeeId: requireStringCell(row, "payee_id", tableName),
    percentage: requireStringCell(row, "split_percentage", tableName)
  });
  groups.set(earningId, group);
}

function finalizeReadableAssertions(readable: StreamingReadableAccumulators): DistributionErhExpectedReadableAssertions {
  return {
    tableCurrencyTotals: Object.fromEntries(
      [...readable.tableCurrencyTotals.entries()].map(([tableName, totals]) => [
        tableName,
        {
          count: totals.count,
          currencyTotals: Object.fromEntries(
            [...totals.currencyTotals.entries()].map(([currency, values]) => [
              currency,
              Object.fromEntries(
                [...values.entries()].map(([column, units]) => [column, formatStreamingScaledDecimal(units, totals.scales.get(column) ?? 0)])
              )
            ])
          )
        }
      ])
    ),
    rowHashes: {
      statements: hashStableRows(readable.statements),
      payee_balances: hashStableRows(readable.payeeBalances),
      fx_rates: hashStableRows(readable.fxRates)
    }
  };
}

function finalizeMoneyGoldens(money: MoneyGoldenAccumulators): DistributionB2ErhMoneyGoldens {
  return {
    earning_allocations: Object.fromEntries(
      [...money.earningAllocations.entries()].map(([currency, value]) => [
        currency,
        {
          n: value.n,
          payees: value.payees.size,
          contracts: value.contracts.size,
          gross_amount: erhMoney.format(value.grossAmount),
          gross_share: erhMoney.format(value.grossShare),
          net_payable: erhMoney.format(value.netPayable),
          original_gross_amount: erhMoney.format(value.originalGrossAmount)
        }
      ])
    ),
    normalized_earnings: Object.fromEntries(
      [...money.normalizedEarnings.entries()].map(([currency, value]) => [
        currency,
        {
          n: value.n,
          gross_amount: erhMoney.format(value.grossAmount),
          quantity: formatQuantityGolden(value.quantity)
        }
      ])
    ),
    suspense_items: Object.fromEntries(
      [...money.suspenseItems.entries()].map(([currency, value]) => [
        currency,
        {
          n: value.n,
          resolved: value.resolved,
          amount: erhMoney.format(value.amount)
        }
      ])
    ),
    statement_lines: {
      n: money.statementLines.n,
      net_payable: erhMoney.format(money.statementLines.netPayable),
      recoupment_applied: erhMoney.format(money.statementLines.recoupmentApplied)
    },
    contract_cost_terms_recoupable: Object.fromEntries(
      [...money.contractCostTermsRecoupable.entries()].map(([currency, value]) => [
        currency,
        {
          n: value.n,
          amount: erhMoney.format(value.amount)
        }
      ])
    )
  };
}

function finalizeMappingCoverage(mapping: Map<string, CountAmountUnits>): Readonly<Record<string, DistributionB2ErhCountAmount>> {
  return Object.fromEntries(
    [...mapping.entries()].map(([status, value]) => [
      status,
      {
        n: value.n,
        gross_amount: erhMoney.format(value.amount)
      }
    ])
  );
}

function finalizeOrphanFks(orphan: OrphanAccumulator): DistributionB2ErhOrphanFkReport {
  for (const [name, count] of Object.entries(orphan.counts) as readonly [DistributionB2ErhOrphanFkName, number][]) {
    if (count !== 0) {
      throw new Error(`Distribution B2-erh orphan FK check failed for ${name}: expected 0, got ${String(count)}.`);
    }
  }

  return {
    status: "pass",
    counts: orphan.counts
  };
}

function assertExpectedCounts(
  sourceCounts: Readonly<Record<DistributionErhTableName, number>>,
  targetCounts: Readonly<Record<DistributionErhTableName, number>>,
  contract: DistributionErhTransformContract
): void {
  for (const [tableName, expected] of Object.entries(contract.expectedCounts) as readonly [DistributionErhTableName, number][]) {
    if (sourceCounts[tableName] !== expected) {
      throw new Error(`Distribution B2-erh ingestion guard failed for ${tableName}: expected source ${String(expected)}, got ${String(sourceCounts[tableName])}.`);
    }

    if (tableName !== "audit_logs" && !(tableName === "raw_import_rows" && contract.rawImportRowsMode === "archive") && tableName !== "identity_link" && targetCounts[tableName] !== expected) {
      throw new Error(`Distribution B2-erh target count failed for ${tableName}: expected target ${String(expected)}, got ${String(targetCounts[tableName])}.`);
    }
  }
}

function assertStreamingExpectations(report: DistributionB2ErhLoadReport, contract: DistributionErhTransformContract): void {
  assertOptionalMoneyGoldens(report.moneyGoldens, contract.expectedMoneyGoldens);
  assertOptionalVerbatimRows(report.verbatimRows?.statements, contract.expectedStatementsVerbatim, "statements");
  assertOptionalVerbatimRows(report.verbatimRows?.payeeBalances, contract.expectedPayeeBalancesVerbatim, "payee_balances");
  assertOptionalVerbatimRows(report.verbatimRows?.fxRates, contract.expectedFxRatesVerbatim, "fx_rates");
  assertOptionalObject(report.mappingCoverage, contract.expectedMappingCoverage, "mapping coverage");
  assertOptionalOrphanList(report.orphanFks, contract.expectedOrphanFks);
}

function assertOptionalMoneyGoldens(actual: unknown, expected: unknown): void {
  assertOptionalObject(actual, expected, "money goldens");
}

function assertOptionalObject(actual: unknown, expected: unknown, label: string): void {
  if (expected === undefined || expected === null) {
    return;
  }

  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(`Distribution B2-erh ${label} mismatch.`);
  }
}

function assertOptionalVerbatimRows(actual: readonly DistributionB2ErhVerbatimRow[] | undefined, expected: unknown, label: string): void {
  if (expected === undefined || expected === null) {
    return;
  }

  if (!Array.isArray(expected)) {
    throw new Error(`Distribution B2-erh expected ${label} verbatim contract must be an array.`);
  }

  const normalizedExpected = expected.map((row) => normalizeExpectedVerbatimRow(row));
  if (stableJson(actual ?? []) !== stableJson(normalizedExpected)) {
    throw new Error(`Distribution B2-erh ${label} verbatim mismatch.`);
  }
}

function assertOptionalOrphanList(actual: DistributionB2ErhOrphanFkReport | undefined, expected: unknown): void {
  if (expected === undefined || expected === null) {
    return;
  }

  if (!Array.isArray(expected)) {
    throw new Error("Distribution B2-erh orphanFksExpectZero contract must be an array.");
  }

  for (const item of expected) {
    const name = String(item) as DistributionB2ErhOrphanFkName;
    if (actual?.counts[name] !== 0) {
      throw new Error(`Distribution B2-erh orphan FK check failed for ${name}: expected 0, got ${String(actual?.counts[name] ?? "missing")}.`);
    }
  }
}

function normalizeExpectedVerbatimRow(value: unknown): DistributionB2ErhVerbatimRow {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Distribution B2-erh verbatim row contract must contain objects.");
  }

  return Object.fromEntries(Object.entries(value).map(([key, cell]) => [key, String(cell)]));
}

function validateStreamingSplitInvariant(groups: ReadonlyMap<string, readonly StreamingSplitRow[]>): DistributionB2ErhSplitInvariantReport {
  let checkedEarningGroups = 0;
  for (const [earningId, groupRows] of groups.entries()) {
    const firstRow = groupRows[0];
    if (firstRow === undefined) {
      continue;
    }

    const outcome = splitRoyaltyShares(streamingSyntheticEarning(earningId, firstRow), streamingSyntheticRules(groupRows));
    if ("suspense" in outcome) {
      throw new Error(`Distribution B2-erh split invariant failed for earning ${earningId}: ${outcome.suspense.message}`);
    }

    checkedEarningGroups += 1;
  }

  return {
    status: "pass",
    checkedEarningGroups
  };
}

function streamingSyntheticEarning(earningId: string, row: StreamingSplitRow): DistributionEarningInput {
  return {
    id: earningId,
    calculationRunId: row.calculationRunId,
    trackId: row.trackId,
    grossAmount: row.grossAmount,
    currency: row.currency,
    saleDate: null,
    periodStart: null,
    periodEnd: null,
    today: "2026-06-21"
  };
}

function streamingSyntheticRules(rows: readonly StreamingSplitRow[]): readonly DistributionRoyaltyRuleInput[] {
  return rows.map((row) => ({
    contractId: row.contractId,
    royaltyRuleId: row.id,
    payeeId: row.payeeId,
    artistId: "historical",
    role: "historical",
    percentage: row.percentage
  }));
}

function requireStringCell(row: DistributionErhCleanRow, column: string, context: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`Distribution B2-erh expected string cell ${column} in ${context}.`);
  }

  return value;
}

function nullableStringCell(row: DistributionErhCleanRow, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Distribution B2-erh expected nullable string cell ${column}.`);
  }

  return value;
}

function projectVerbatimRow(row: DistributionErhCleanRow, columns: readonly string[]): DistributionB2ErhVerbatimRow {
  return Object.fromEntries(columns.map((column) => [column, String(row[column] ?? "")]));
}

function parseAmount10(value: string): bigint {
  return erhMoney.parse(value);
}

function parseStreamingScaledDecimal(value: string, scale: number): bigint {
  const normalized = normalizeStreamingDecimal(value, scale, "normalized_earnings", "streaming", null);
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integerPart, fractionalPart] = unsigned.split(".");
  const integerUnits = BigInt(integerPart ?? "0") * 10n ** BigInt(scale);
  const fractionalUnits = scale === 0 ? 0n : BigInt(fractionalPart ?? "0");
  const units = integerUnits + fractionalUnits;
  return negative ? -units : units;
}

function formatStreamingScaledDecimal(value: bigint, scale: number): string {
  const negative = value < 0n;
  const unsigned = negative ? -value : value;
  const factor = 10n ** BigInt(scale);
  const integerPart = unsigned / factor;
  const fractionalPart = (unsigned % factor).toString().padStart(scale, "0");
  const sign = negative ? "-" : "";
  return scale === 0 ? `${sign}${integerPart.toString()}` : `${sign}${integerPart.toString()}.${fractionalPart}`;
}

function formatQuantityGolden(value: bigint): string {
  const scale = 6;
  const formatted = formatStreamingScaledDecimal(value, scale);
  return formatted.endsWith(".000000") ? formatted.slice(0, -7) : formatted;
}

function decimalScale(value: string): number {
  const dot = value.indexOf(".");
  return dot === -1 ? 0 : value.length - dot - 1;
}

function isStreamingNumericKind(kind: DistributionErhScalarKind): boolean {
  return kind === "amount10" || kind === "fxRate10" || kind === "percentage2" || kind === "percentage6" || kind === "quantity6" || kind === "integer";
}

function streamingScaleForKind(kind: DistributionErhScalarKind): number {
  if (kind === "amount10" || kind === "fxRate10") {
    return 10;
  }

  if (kind === "percentage6" || kind === "quantity6") {
    return 6;
  }

  if (kind === "percentage2") {
    return 2;
  }

  return 0;
}

function addStreamingBooleanCount(
  current: { readonly true: number; readonly false: number; readonly null: number } | undefined,
  value: DistributionErhCleanRow[string] | null
): { readonly true: number; readonly false: number; readonly null: number } {
  const next = current ?? { true: 0, false: 0, null: 0 };
  if (value === true) {
    return { ...next, true: next.true + 1 };
  }

  if (value === false) {
    return { ...next, false: next.false + 1 };
  }

  return { ...next, null: next.null + 1 };
}

function addStreamingDateBound(
  current: { readonly min: string | null; readonly max: string | null; readonly nullCount: number } | undefined,
  value: DistributionErhCleanRow[string] | null
): { readonly min: string | null; readonly max: string | null; readonly nullCount: number } {
  const next = current ?? { min: null, max: null, nullCount: 0 };
  if (typeof value !== "string") {
    return { ...next, nullCount: next.nullCount + 1 };
  }

  return {
    min: next.min === null || value < next.min ? value : next.min,
    max: next.max === null || value > next.max ? value : next.max,
    nullCount: next.nullCount
  };
}

function hashStableRows(rows: readonly DistributionB2ErhVerbatimRow[]): string {
  return hashText(rows.map((row) => stableJson(row)).sort().join("\u001e"));
}

function hashText(value: string): string {
  let hash = 14_695_981_039_346_656_037n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * 1_099_511_628_211n) & 18_446_744_073_709_551_615n;
  }

  return hash.toString(16).padStart(16, "0");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function formatOptionalMoneyGoldens(goldens: DistributionB2ErhMoneyGoldens | undefined): readonly string[] {
  if (goldens === undefined) {
    return [];
  }

  return ["## Money goldens", stableJson(goldens), ""];
}

function formatOptionalVerbatimRows(rows: DistributionB2ErhVerbatimReport | undefined): readonly string[] {
  if (rows === undefined) {
    return [];
  }

  return [
    "## Verbatim rows",
    `Statements: ${stableJson(rows.statements)}`,
    `Payee balances: ${stableJson(rows.payeeBalances)}`,
    `FX rates: ${stableJson(rows.fxRates)}`,
    ""
  ];
}

function formatOptionalMappingCoverage(mapping: Readonly<Record<string, DistributionB2ErhCountAmount>> | undefined): readonly string[] {
  if (mapping === undefined) {
    return [];
  }

  return ["## Mapping coverage", stableJson(mapping), ""];
}

function formatOptionalOrphanFks(orphanFks: DistributionB2ErhOrphanFkReport | undefined): readonly string[] {
  if (orphanFks === undefined) {
    return [];
  }

  return ["## Orphan FKs", `Status: ${orphanFks.status}`, stableJson(orphanFks.counts), ""];
}

function decisionNotes(rawImportRowsMode: DistributionRawImportRowsMode): readonly string[] {
  return [
    "audit_logs are excluded from B2-erh parity by design.",
    "identity_link remains empty; office_partner_id unification is a separate migration.",
    rawImportRowsMode === "migrate"
      ? "raw_import_rows are migrated for traceability by explicit decision."
      : "raw_import_rows are archived outside the clean target by explicit decision."
  ];
}

function toDistributionPgliteFailure(error: unknown): PgliteInsertFailure {
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

function toDistributionSqlFailure(error: unknown, tableName: string): SqlInsertFailure {
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

function validateSplitInvariant(dataset: DistributionErhCleanDataset): DistributionB2ErhSplitInvariantReport {
  const rows = dataset.rowsByTable.get("earning_allocations") ?? [];
  const groups = groupRowsByString(rows, "earning_id");
  let checkedEarningGroups = 0;
  for (const [earningId, groupRows] of groups.entries()) {
    if (groupRows.length === 0) {
      continue;
    }

    const firstRow = groupRows[0];
    if (firstRow === undefined) {
      continue;
    }

    const outcome = splitRoyaltyShares(toSyntheticEarning(earningId, firstRow), toSyntheticRules(groupRows));
    if ("suspense" in outcome) {
      throw new Error(`Distribution B2-erh split invariant failed for earning ${earningId}: ${outcome.suspense.message}`);
    }

    checkedEarningGroups += 1;
  }

  return {
    status: "pass",
    checkedEarningGroups
  };
}

function toSyntheticEarning(earningId: string, row: DistributionErhCleanRow): DistributionEarningInput {
  return {
    id: earningId,
    calculationRunId: requireString(row, "calculation_run_id", earningId),
    trackId: nullableString(row, "track_id", earningId),
    grossAmount: requireString(row, "gross_amount", earningId),
    currency: requireString(row, "currency", earningId),
    saleDate: null,
    periodStart: null,
    periodEnd: null,
    today: "2026-06-21"
  };
}

function toSyntheticRules(rows: readonly DistributionErhCleanRow[]): readonly DistributionRoyaltyRuleInput[] {
  return rows.map((row) => ({
    contractId: nullableString(row, "contract_id", requireString(row, "id", "earning_allocations")),
    royaltyRuleId: requireString(row, "id", "earning_allocations"),
    payeeId: requireString(row, "payee_id", "earning_allocations"),
    artistId: "historical",
    role: "historical",
    percentage: requireString(row, "split_percentage", "earning_allocations")
  }));
}

function groupRowsByString(rows: readonly DistributionErhCleanRow[], column: string): ReadonlyMap<string, readonly DistributionErhCleanRow[]> {
  const groups = new Map<string, DistributionErhCleanRow[]>();
  for (const row of rows) {
    const key = requireString(row, column, "grouping");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return groups;
}

function requireString(row: DistributionErhCleanRow, column: string, context: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`Distribution B2-erh expected string ${column} in ${context}.`);
  }

  return value;
}

function nullableString(row: DistributionErhCleanRow, column: string, context: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Distribution B2-erh expected nullable string ${column} in ${context}.`);
  }

  return value;
}
