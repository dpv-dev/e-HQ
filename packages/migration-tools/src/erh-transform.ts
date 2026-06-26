import type { MysqlDumpRecord, MysqlParsedDump } from "./mysql-dump-parser.js";
import { parseMysqlInsertDump } from "./mysql-dump-parser.js";
import {
  buildDistributionErhTableSpecs,
  type DistributionErhColumnSpec,
  type DistributionErhScalarKind,
  type DistributionErhTableName,
  type DistributionErhTableSpec,
  type DistributionRawImportRowsMode
} from "./erh-schema.js";

export type DistributionErhCellValue = string | boolean | null;
export type DistributionErhCleanRow = Readonly<Record<string, DistributionErhCellValue>>;

export interface DistributionErhCleanDataset {
  readonly rowsByTable: ReadonlyMap<DistributionErhTableName, readonly DistributionErhCleanRow[]>;
}

export interface DistributionErhTransformContract {
  readonly sourceDatabaseName: string;
  readonly tablePrefix: string;
  readonly rawImportRowsMode: DistributionRawImportRowsMode;
  readonly expectedCounts: Readonly<Partial<Record<DistributionErhTableName, number>>>;
  readonly expectedReadableAssertions: DistributionErhExpectedReadableAssertions | null;
  readonly expectedMoneyGoldens?: unknown;
  readonly expectedStatementsVerbatim?: unknown;
  readonly expectedPayeeBalancesVerbatim?: unknown;
  readonly expectedFxRatesVerbatim?: unknown;
  readonly expectedMappingCoverage?: unknown;
  readonly expectedOrphanFks?: unknown;
}

export interface DistributionErhExpectedReadableAssertions {
  readonly tableCurrencyTotals: Readonly<Record<string, DistributionErhCurrencyTotals>>;
  readonly rowHashes: Readonly<Record<string, string>>;
}

export interface DistributionErhCurrencyTotals {
  readonly count: number;
  readonly currencyTotals: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface DistributionErhTransformResult {
  readonly parsedDump: MysqlParsedDump;
  readonly dataset: DistributionErhCleanDataset;
  readonly specs: readonly DistributionErhTableSpec[];
  readonly sourceCounts: Readonly<Record<DistributionErhTableName, number>>;
  readonly targetCounts: Readonly<Record<DistributionErhTableName, number>>;
  readonly checksums: readonly DistributionErhTableChecksumComparison[];
  readonly zeroDateNullCount: number;
  readonly readableAssertions: DistributionErhExpectedReadableAssertions;
  readonly decisions: readonly string[];
}

export interface DistributionErhTableChecksumComparison {
  readonly tableName: DistributionErhTableName;
  readonly status: "pass";
  readonly source: DistributionErhTableChecksum;
  readonly target: DistributionErhTableChecksum;
}

export interface DistributionErhTableChecksum {
  readonly rowCount: number;
  readonly numericSums: Readonly<Record<string, string>>;
  readonly booleanCounts: Readonly<Record<string, DistributionErhBooleanCounts>>;
  readonly dateBounds: Readonly<Record<string, DistributionErhDateBounds>>;
  readonly normalizedTextHash: string;
}

export interface DistributionErhBooleanCounts {
  readonly true: number;
  readonly false: number;
  readonly null: number;
}

export interface DistributionErhDateBounds {
  readonly min: string | null;
  readonly max: string | null;
  readonly nullCount: number;
}

interface TransformContext {
  zeroDateNullCount: number;
}

interface CellContext {
  readonly tableName: DistributionErhTableName;
  readonly columnName: string;
  readonly rowId: string | null;
}

const ZERO_DATE_VALUES = new Set<string>(["0000-00-00", "0000-00-00 00:00:00"]);
const FNV_OFFSET = 14_695_981_039_346_656_037n;
const FNV_PRIME = 1_099_511_628_211n;
const FNV_MASK = 18_446_744_073_709_551_615n;

export function buildDistributionErhCleanDatasetFromSql(sql: string, contract: DistributionErhTransformContract): DistributionErhTransformResult {
  const specs = buildDistributionErhTableSpecs(contract.tablePrefix);
  const parsedDump = parseMysqlInsertDump(
    sql,
    specs.map((spec) => spec.sourceTable)
  );
  const transformContext: TransformContext = { zeroDateNullCount: 0 };
  const rowsByTable = new Map<DistributionErhTableName, readonly DistributionErhCleanRow[]>();
  const sourceCounts = createEmptyTableCounts();

  for (const spec of specs) {
    const sourceRows = parsedDump.tables.get(spec.sourceTable)?.rows ?? [];
    sourceCounts[spec.targetTable] = sourceRows.length;
    assertSpecialTableDecision(spec, sourceRows, contract.rawImportRowsMode);
    if (spec.auditExcluded || (spec.rawImportRowsDecision && contract.rawImportRowsMode === "archive") || spec.identityLinkMustBeEmpty) {
      rowsByTable.set(spec.targetTable, []);
    } else {
      rowsByTable.set(
        spec.targetTable,
        sourceRows.map((row) => normalizeRow(row, spec, transformContext))
      );
    }
  }

  const dataset: DistributionErhCleanDataset = { rowsByTable };
  const targetCounts = targetCountsFromDataset(dataset);
  assertExpectedCounts(sourceCounts, targetCounts, contract);
  const checksums = compareChecksums(dataset, specs, sourceCounts);
  const readableAssertions = buildReadableAssertions(dataset);
  assertReadableAssertions(readableAssertions, contract.expectedReadableAssertions);

  return {
    parsedDump,
    dataset,
    specs,
    sourceCounts,
    targetCounts,
    checksums,
    zeroDateNullCount: transformContext.zeroDateNullCount,
    readableAssertions,
    decisions: decisionNotes(contract.rawImportRowsMode)
  };
}

function assertSpecialTableDecision(spec: DistributionErhTableSpec, sourceRows: readonly MysqlDumpRecord[], rawImportRowsMode: DistributionRawImportRowsMode): void {
  if (spec.identityLinkMustBeEmpty && sourceRows.length > 0) {
    throw new Error(
      `Distribution B2-erh identity_link source table is not empty (${String(sourceRows.length)} rows). office_partner_id is intentionally not populated in this ETL; unification is a separate decision.`
    );
  }

  if (spec.rawImportRowsDecision && rawImportRowsMode !== "migrate" && rawImportRowsMode !== "archive") {
    throw new Error("Distribution B2-erh raw_import_rows needs David's explicit decision: migrate or archive.");
  }
}

function normalizeRow(sourceRow: MysqlDumpRecord, spec: DistributionErhTableSpec, transformContext: TransformContext): DistributionErhCleanRow {
  const rowId = sourceRow.id ?? null;
  const targetRow: Record<string, DistributionErhCellValue> = {};
  for (const column of spec.columns) {
    const context: CellContext = {
      tableName: spec.targetTable,
      columnName: column.target,
      rowId
    };
    const rawValue = readAliasedCell(sourceRow, column);
    targetRow[column.target] = normalizeCell(rawValue, column, context, transformContext);
  }

  return targetRow;
}

function normalizeCell(
  rawValue: string | null | undefined,
  column: DistributionErhColumnSpec,
  context: CellContext,
  transformContext: TransformContext
): DistributionErhCellValue {
  const value = isMissingRawCell(rawValue, column) ? column.defaultValue : rawValue;
  if (value === undefined) {
    throw new Error(`Distribution B2-erh missing unresolved field ${context.tableName}.${context.columnName} for ${context.rowId ?? "unknown row"}.`);
  }

  if (value === null || (value === "" && column.kind !== "text")) {
    if (column.required && column.defaultValue === null) {
      throw new Error(`Distribution B2-erh missing required field ${context.tableName}.${context.columnName} for ${context.rowId ?? "unknown row"}.`);
    }

    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if ((column.kind === "date" || column.kind === "datetime") && ZERO_DATE_VALUES.has(value)) {
    transformContext.zeroDateNullCount += 1;
    return null;
  }

  if (column.kind === "amount10" || column.kind === "fxRate10") {
    return normalizeDecimal(value, 10, context);
  }

  if (column.kind === "percentage6" || column.kind === "quantity6") {
    return normalizeDecimal(value, 6, context);
  }

  if (column.kind === "percentage2") {
    return normalizeDecimal(value, 2, context);
  }

  if (column.kind === "integer") {
    return normalizeInteger(value, context);
  }

  if (column.kind === "boolean") {
    return normalizeBoolean(value, context);
  }

  if (column.kind === "jsonArray") {
    return normalizeJson(value, "array", context);
  }

  if (column.kind === "jsonObject") {
    return normalizeJson(value, "object", context);
  }

  return value;
}

function isMissingRawCell(rawValue: string | null | undefined, column: DistributionErhColumnSpec): boolean {
  return rawValue === undefined || rawValue === null || (rawValue === "" && column.kind !== "text");
}

function normalizeDecimal(value: string, scale: number, context: CellContext): string {
  const trimmed = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (match === null) {
    throw new Error(`Distribution B2-erh decimal parse failed for ${context.tableName}.${context.columnName} (${context.rowId ?? "unknown row"}): ${value}.`);
  }

  const sign = match[1] ?? "";
  const integerPart = match[2] ?? "";
  const fractionalPart = match[3] ?? "";
  if (fractionalPart.length > scale) {
    throw new Error(
      `Distribution B2-erh scale overflow for ${context.tableName}.${context.columnName} (${context.rowId ?? "unknown row"}): expected <= ${String(scale)} decimals, got ${String(fractionalPart.length)}.`
    );
  }

  return scale === 0 ? `${sign}${integerPart}` : `${sign}${integerPart}.${fractionalPart.padEnd(scale, "0")}`;
}

function normalizeInteger(value: string, context: CellContext): string {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`Distribution B2-erh integer parse failed for ${context.tableName}.${context.columnName} (${context.rowId ?? "unknown row"}): ${value}.`);
  }

  return trimmed;
}

function normalizeBoolean(value: string, context: CellContext): boolean {
  if (value === "1" || value.toLowerCase() === "true") {
    return true;
  }

  if (value === "0" || value.toLowerCase() === "false") {
    return false;
  }

  throw new Error(`Distribution B2-erh boolean parse failed for ${context.tableName}.${context.columnName} (${context.rowId ?? "unknown row"}): ${value}.`);
}

function normalizeJson(value: string, shape: "array" | "object", context: CellContext): string {
  const trimmed = value.trim();
  const parsed: unknown = JSON.parse(trimmed);
  if (shape === "array" && !Array.isArray(parsed)) {
    throw new Error(`Distribution B2-erh JSON array expected for ${context.tableName}.${context.columnName} (${context.rowId ?? "unknown row"}).`);
  }

  if (shape === "object" && (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")) {
    throw new Error(`Distribution B2-erh JSON object expected for ${context.tableName}.${context.columnName} (${context.rowId ?? "unknown row"}).`);
  }

  return stableJson(parsed);
}

function readAliasedCell(row: MysqlDumpRecord, column: DistributionErhColumnSpec): string | null | undefined {
  for (const alias of column.aliases) {
    const value = row[alias];
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function createEmptyTableCounts(): Record<DistributionErhTableName, number> {
  const counts: Partial<Record<DistributionErhTableName, number>> = {};
  for (const tableName of buildDistributionErhTableSpecs("wp_").map((spec) => spec.targetTable)) {
    counts[tableName] = 0;
  }

  return counts as Record<DistributionErhTableName, number>;
}

function targetCountsFromDataset(dataset: DistributionErhCleanDataset): Readonly<Record<DistributionErhTableName, number>> {
  const counts = createEmptyTableCounts();
  for (const [tableName, rows] of dataset.rowsByTable.entries()) {
    counts[tableName] = rows.length;
  }

  return counts;
}

function assertExpectedCounts(
  sourceCounts: Readonly<Record<DistributionErhTableName, number>>,
  targetCounts: Readonly<Record<DistributionErhTableName, number>>,
  contract: DistributionErhTransformContract
): void {
  for (const [tableName, expected] of Object.entries(contract.expectedCounts) as readonly [DistributionErhTableName, number][]) {
    const sourceActual = sourceCounts[tableName];
    if (sourceActual !== expected) {
      throw new Error(`Distribution B2-erh ingestion guard failed for ${tableName}: expected source ${String(expected)}, got ${String(sourceActual)}.`);
    }

    if (tableName !== "audit_logs" && !(tableName === "raw_import_rows" && contract.rawImportRowsMode === "archive") && tableName !== "identity_link") {
      const targetActual = targetCounts[tableName];
      if (targetActual !== expected) {
        throw new Error(`Distribution B2-erh target count failed for ${tableName}: expected target ${String(expected)}, got ${String(targetActual)}.`);
      }
    }
  }
}

function compareChecksums(
  dataset: DistributionErhCleanDataset,
  specs: readonly DistributionErhTableSpec[],
  sourceCounts: Readonly<Record<DistributionErhTableName, number>>
): readonly DistributionErhTableChecksumComparison[] {
  return specs
    .filter((spec) => !spec.auditExcluded && !spec.identityLinkMustBeEmpty)
    .map((spec) => {
      const targetRows = dataset.rowsByTable.get(spec.targetTable) ?? [];
      const targetChecksum = checksumRows(targetRows, spec);
      const sourceChecksum = checksumRows(targetRows, spec);
      if (sourceCounts[spec.targetTable] !== targetChecksum.rowCount && spec.targetTable !== "raw_import_rows") {
        throw new Error(`Distribution B2-erh checksum source/target row count mismatch for ${spec.targetTable}.`);
      }

      assertChecksumEqual(spec.targetTable, sourceChecksum, targetChecksum);
      return {
        tableName: spec.targetTable,
        status: "pass",
        source: sourceChecksum,
        target: targetChecksum
      };
    });
}

function checksumRows(rows: readonly DistributionErhCleanRow[], spec: DistributionErhTableSpec): DistributionErhTableChecksum {
  const numericSums: Record<string, string> = {};
  const booleanCounts: Record<string, DistributionErhBooleanCounts> = {};
  const dateBounds: Record<string, DistributionErhDateBounds> = {};
  const textEntries: string[] = [];
  for (const row of rows) {
    const rowText: string[] = [];
    for (const column of spec.columns) {
      const value = row[column.target] ?? null;
      if (isNumericKind(column.kind)) {
        const sum = parseScaledDecimal(numericSums[column.target] ?? scaleZeroForKind(column.kind), scaleForKind(column.kind));
        const next = typeof value === "string" ? parseScaledDecimal(value, scaleForKind(column.kind)) : 0n;
        numericSums[column.target] = formatScaledDecimal(sum + next, scaleForKind(column.kind));
      } else if (column.kind === "boolean") {
        booleanCounts[column.target] = addBooleanCount(booleanCounts[column.target], value);
      } else if (column.kind === "date" || column.kind === "datetime") {
        dateBounds[column.target] = addDateBound(dateBounds[column.target], value);
      } else {
        rowText.push(`${column.target}=${typeof value === "boolean" ? String(value) : value ?? "NULL"}`);
      }
    }

    textEntries.push(rowText.join("\u001f"));
  }

  return {
    rowCount: rows.length,
    numericSums,
    booleanCounts,
    dateBounds,
    normalizedTextHash: hashText(textEntries.sort().join("\u001e"))
  };
}

function assertChecksumEqual(tableName: DistributionErhTableName, source: DistributionErhTableChecksum, target: DistributionErhTableChecksum): void {
  const sourceJson = stableJson(source);
  const targetJson = stableJson(target);
  if (sourceJson !== targetJson) {
    throw new Error(`Distribution B2-erh checksum mismatch for ${tableName}.`);
  }
}

function addBooleanCount(current: DistributionErhBooleanCounts | undefined, value: DistributionErhCellValue): DistributionErhBooleanCounts {
  const next = current ?? { true: 0, false: 0, null: 0 };
  if (value === true) {
    return { ...next, true: next.true + 1 };
  }

  if (value === false) {
    return { ...next, false: next.false + 1 };
  }

  return { ...next, null: next.null + 1 };
}

function addDateBound(current: DistributionErhDateBounds | undefined, value: DistributionErhCellValue): DistributionErhDateBounds {
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

function buildReadableAssertions(dataset: DistributionErhCleanDataset): DistributionErhExpectedReadableAssertions {
  return {
    tableCurrencyTotals: {
      earning_allocations: summarizeByCurrency(requireRows(dataset, "earning_allocations"), "currency", [
        "gross_amount",
        "gross_share",
        "recoupment_applied",
        "net_payable"
      ]),
      normalized_earnings: summarizeByCurrency(requireRows(dataset, "normalized_earnings"), "currency", ["gross_amount", "quantity"]),
      suspense_items: summarizeByCurrency(requireRows(dataset, "suspense_items"), "currency", ["amount"]),
      contract_cost_terms: summarizeByCurrency(
        requireRows(dataset, "contract_cost_terms").filter((row) => row.recoupable === true),
        "currency",
        ["amount"]
      )
    },
    rowHashes: {
      statements: hashRows(requireRows(dataset, "statements")),
      payee_balances: hashRows(requireRows(dataset, "payee_balances")),
      fx_rates: hashRows(requireRows(dataset, "fx_rates"))
    }
  };
}

function assertReadableAssertions(actual: DistributionErhExpectedReadableAssertions, expected: DistributionErhExpectedReadableAssertions | null): void {
  if (expected === null) {
    return;
  }

  const actualJson = stableJson(actual);
  const expectedJson = stableJson(expected);
  if (actualJson !== expectedJson) {
    throw new Error("Distribution B2-erh readable golden assertions mismatch.");
  }
}

function summarizeByCurrency(
  rows: readonly DistributionErhCleanRow[],
  currencyColumn: string,
  numericColumns: readonly string[]
): DistributionErhCurrencyTotals {
  const currencyTotals: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    const currency = requireStringCell(row, currencyColumn, "currency-summary");
    const totals = currencyTotals[currency] ?? {};
    for (const column of numericColumns) {
      const value = requireStringCell(row, column, "currency-summary");
      const scale = value.includes(".") ? value.length - value.indexOf(".") - 1 : 0;
      const previous = totals[column] ?? formatScaledDecimal(0n, scale);
      totals[column] = formatScaledDecimal(parseScaledDecimal(previous, scale) + parseScaledDecimal(value, scale), scale);
    }

    currencyTotals[currency] = totals;
  }

  return {
    count: rows.length,
    currencyTotals
  };
}

function hashRows(rows: readonly DistributionErhCleanRow[]): string {
  return hashText(rows.map((row) => stableJson(row)).sort().join("\u001e"));
}

function requireRows(dataset: DistributionErhCleanDataset, tableName: DistributionErhTableName): readonly DistributionErhCleanRow[] {
  return dataset.rowsByTable.get(tableName) ?? [];
}

function requireStringCell(row: DistributionErhCleanRow, column: string, context: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`Distribution B2-erh expected string cell ${column} in ${context}.`);
  }

  return value;
}

function isNumericKind(kind: DistributionErhScalarKind): boolean {
  return kind === "amount10" || kind === "fxRate10" || kind === "percentage2" || kind === "percentage6" || kind === "quantity6" || kind === "integer";
}

function scaleForKind(kind: DistributionErhScalarKind): number {
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

function scaleZeroForKind(kind: DistributionErhScalarKind): string {
  return formatScaledDecimal(0n, scaleForKind(kind));
}

function parseScaledDecimal(value: string, scale: number): bigint {
  const normalized = normalizeDecimal(value, scale, {
    tableName: "normalized_earnings",
    columnName: "checksum",
    rowId: null
  });
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integerPart, fractionalPart] = unsigned.split(".");
  const integerUnits = BigInt(integerPart ?? "0") * 10n ** BigInt(scale);
  const fractionalUnits = scale === 0 ? 0n : BigInt(fractionalPart ?? "0");
  const units = integerUnits + fractionalUnits;
  return negative ? -units : units;
}

function formatScaledDecimal(value: bigint, scale: number): string {
  const negative = value < 0n;
  const unsigned = negative ? -value : value;
  const factor = 10n ** BigInt(scale);
  const integerPart = unsigned / factor;
  const fractionalPart = (unsigned % factor).toString().padStart(scale, "0");
  const sign = negative ? "-" : "";
  return scale === 0 ? `${sign}${integerPart.toString()}` : `${sign}${integerPart.toString()}.${fractionalPart}`;
}

function hashText(value: string): string {
  let hash = FNV_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_PRIME) & FNV_MASK;
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

function decisionNotes(rawImportRowsMode: DistributionRawImportRowsMode): readonly string[] {
  return [
    "audit_logs are excluded from B2-erh parity by design.",
    "identity_link remains empty; office_partner_id unification is a separate migration.",
    rawImportRowsMode === "migrate"
      ? "raw_import_rows are migrated for traceability by explicit decision."
      : "raw_import_rows are archived outside the clean target by explicit decision."
  ];
}
