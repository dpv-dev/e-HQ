import type { PGlite } from "@electric-sql/pglite";
import { legacyIntegerId, legacyUuidForTable } from "./legacy-uuid.js";

export type DiagnosticCellValue = string | number | bigint | boolean | null | undefined;
export type DiagnosticRow = Readonly<Record<string, DiagnosticCellValue>>;

export interface PgliteDiagnosticSchema {
  readonly columnsByTable: ReadonlyMap<string, readonly PgliteDiagnosticColumn[]>;
  readonly foreignKeys: readonly PgliteDiagnosticForeignKey[];
  readonly enumValuesByType: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface PgliteDiagnosticColumn {
  readonly tableName: string;
  readonly columnName: string;
  readonly notNull: boolean;
  readonly hasDefault: boolean;
  readonly udtName: string;
}

export interface PgliteDiagnosticForeignKey {
  readonly constraintName: string;
  readonly sourceTable: string;
  readonly sourceColumn: string;
  readonly targetTable: string;
  readonly targetColumn: string;
}

export interface PgliteDiagnosticAccumulator {
  readonly rowCounts: Map<string, number>;
  readonly idsByTable: Map<string, Set<string>>;
  readonly legacyIdsByTable: Map<string, Set<number>>;
  readonly tablesByLegacyId: Map<number, Set<string>>;
  readonly fkViolations: Map<string, MutableFkViolation>;
  readonly notNullViolations: Map<string, MutableNotNullViolation>;
  readonly enumViolations: Map<string, MutableEnumViolation>;
  readonly reverseLegacyIdCache: Map<string, number | null>;
}

export interface PgliteDiagnosticReport {
  readonly generatedAt: string;
  readonly sourceLabel: string;
  readonly target: PgliteDiagnosticTargetReport;
  readonly rowsRead: Readonly<Record<string, number>>;
  readonly fkViolations: readonly FkViolationReport[];
  readonly notNullViolations: readonly NotNullViolationReport[];
  readonly enumViolations: readonly EnumViolationReport[];
  readonly otherViolations: readonly string[];
}

export interface PgliteDiagnosticTargetReport {
  readonly mode: "pglite-schema-dry-run";
  readonly migrationsApplied: readonly string[];
}

export interface FkViolationReport {
  readonly constraintName: string;
  readonly source: string;
  readonly target: string;
  readonly count: number;
  readonly sourceLegacyIdExamples: readonly number[];
  readonly missingTargetLegacyIdExamples: readonly number[];
  readonly siblingHints: readonly SiblingHintReport[];
}

export interface SiblingHintReport {
  readonly missingTargetLegacyId: number;
  readonly tables: readonly string[];
}

export interface NotNullViolationReport {
  readonly column: string;
  readonly count: number;
  readonly sourceLegacyIdExamples: readonly number[];
}

export interface EnumViolationReport {
  readonly column: string;
  readonly enumType: string;
  readonly invalidValues: readonly EnumInvalidValueReport[];
}

export interface EnumInvalidValueReport {
  readonly value: string;
  readonly count: number;
  readonly sourceLegacyIdExamples: readonly number[];
}

interface MutableFkViolation {
  readonly constraintName: string;
  readonly sourceTable: string;
  readonly sourceColumn: string;
  readonly targetTable: string;
  readonly targetColumn: string;
  count: number;
  readonly sourceLegacyIdExamples: number[];
  readonly missingTargetLegacyIdExamples: number[];
  readonly siblingHintsByLegacyId: Map<number, Set<string>>;
}

interface MutableNotNullViolation {
  readonly tableName: string;
  readonly columnName: string;
  count: number;
  readonly sourceLegacyIdExamples: number[];
}

interface MutableEnumViolation {
  readonly tableName: string;
  readonly columnName: string;
  readonly enumType: string;
  readonly values: Map<string, MutableEnumInvalidValue>;
}

interface MutableEnumInvalidValue {
  count: number;
  readonly sourceLegacyIdExamples: number[];
}

export async function readPgliteDiagnosticSchema(db: PGlite, tableNames: readonly string[]): Promise<PgliteDiagnosticSchema> {
  const selectedTables = new Set(tableNames);
  const columnsByTable = await readDiagnosticColumns(db, selectedTables);
  const foreignKeys = await readDiagnosticForeignKeys(db, selectedTables);
  const enumValuesByType = await readDiagnosticEnumValues(db);
  return { columnsByTable, foreignKeys, enumValuesByType };
}

export function createPgliteDiagnosticAccumulator(): PgliteDiagnosticAccumulator {
  return {
    rowCounts: new Map<string, number>(),
    idsByTable: new Map<string, Set<string>>(),
    legacyIdsByTable: new Map<string, Set<number>>(),
    tablesByLegacyId: new Map<number, Set<string>>(),
    fkViolations: new Map<string, MutableFkViolation>(),
    notNullViolations: new Map<string, MutableNotNullViolation>(),
    enumViolations: new Map<string, MutableEnumViolation>(),
    reverseLegacyIdCache: new Map<string, number | null>()
  };
}

export function registerDiagnosticTables(accumulator: PgliteDiagnosticAccumulator, tableNames: readonly string[]): void {
  for (const tableName of tableNames) {
    accumulator.rowCounts.set(tableName, accumulator.rowCounts.get(tableName) ?? 0);
    setFor(accumulator.idsByTable, tableName);
    setFor(accumulator.legacyIdsByTable, tableName);
  }
}

export function collectDiagnosticRowIdentity(accumulator: PgliteDiagnosticAccumulator, tableName: string, row: DiagnosticRow): void {
  accumulator.rowCounts.set(tableName, (accumulator.rowCounts.get(tableName) ?? 0) + 1);

  const id = stringCell(row.id);
  if (id !== null) {
    setFor(accumulator.idsByTable, tableName).add(id);
  }

  const legacyId = rowLegacyId(row, tableName);
  if (legacyId !== null) {
    setFor(accumulator.legacyIdsByTable, tableName).add(legacyId);
    setFor(accumulator.tablesByLegacyId, legacyId).add(tableName);
  }
}

export function validateDiagnosticRow(
  schema: PgliteDiagnosticSchema,
  accumulator: PgliteDiagnosticAccumulator,
  tableName: string,
  row: DiagnosticRow
): void {
  validateNotNullColumns(schema, accumulator, tableName, row);
  validateEnumColumns(schema, accumulator, tableName, row);
  validateForeignKeys(schema, accumulator, tableName, row);
}

export function createPgliteDiagnosticReport(
  generatedAt: string,
  sourceLabel: string,
  migrationsApplied: readonly string[],
  accumulator: PgliteDiagnosticAccumulator
): PgliteDiagnosticReport {
  return {
    generatedAt,
    sourceLabel,
    target: {
      mode: "pglite-schema-dry-run",
      migrationsApplied
    },
    rowsRead: Object.fromEntries([...accumulator.rowCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
    fkViolations: [...accumulator.fkViolations.values()]
      .map((violation) => toFkViolationReport(violation))
      .sort((left, right) => left.source.localeCompare(right.source)),
    notNullViolations: [...accumulator.notNullViolations.values()]
      .map((violation) => ({
        column: `${violation.tableName}.${violation.columnName}`,
        count: violation.count,
        sourceLegacyIdExamples: violation.sourceLegacyIdExamples
      }))
      .sort((left, right) => left.column.localeCompare(right.column)),
    enumViolations: [...accumulator.enumViolations.values()]
      .map((violation) => ({
        column: `${violation.tableName}.${violation.columnName}`,
        enumType: violation.enumType,
        invalidValues: [...violation.values.entries()]
          .map(([value, invalid]) => ({
            value,
            count: invalid.count,
            sourceLegacyIdExamples: invalid.sourceLegacyIdExamples
          }))
          .sort((left, right) => left.value.localeCompare(right.value))
      }))
      .sort((left, right) => left.column.localeCompare(right.column)),
    otherViolations: []
  };
}

export function serializePgliteDiagnosticReport(report: PgliteDiagnosticReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function formatPgliteDiagnosticReport(title: string, report: PgliteDiagnosticReport): string {
  return [
    `# ${title}`,
    "",
    `Generated: ${report.generatedAt}`,
    `Source: ${report.sourceLabel}`,
    `Target mode: ${report.target.mode}`,
    `Migrations applied: ${report.target.migrationsApplied.join(", ")}`,
    "",
    "## Rows read",
    ...Object.entries(report.rowsRead).map(([tableName, count]) => `${tableName}: ${String(count)}`),
    "",
    "## FK violations",
    report.fkViolations.length === 0 ? "None." : "",
    ...report.fkViolations.flatMap((violation) => [
      `- ${violation.source} -> ${violation.target}: ${String(violation.count)} rows`,
      `  source legacy_id examples: ${violation.sourceLegacyIdExamples.join(", ") || "none"}`,
      `  missing target legacy_id examples: ${violation.missingTargetLegacyIdExamples.join(", ") || "none"}`,
      `  sibling hints: ${formatSiblingHints(violation.siblingHints)}`
    ]),
    "",
    "## NOT NULL violations",
    report.notNullViolations.length === 0 ? "None." : "",
    ...report.notNullViolations.map((violation) => `- ${violation.column}: ${String(violation.count)} rows; examples ${violation.sourceLegacyIdExamples.join(", ") || "none"}`),
    "",
    "## Enum violations",
    report.enumViolations.length === 0 ? "None." : "",
    ...report.enumViolations.flatMap((violation) => [
      `- ${violation.column} (${violation.enumType})`,
      ...violation.invalidValues.map((invalid) => `  ${invalid.value}: ${String(invalid.count)} rows; examples ${invalid.sourceLegacyIdExamples.join(", ") || "none"}`)
    ]),
    "",
    "## Other violations",
    report.otherViolations.length === 0 ? "None." : "",
    ...report.otherViolations.map((violation) => `- ${violation}`),
    ""
  ].join("\n");
}

async function readDiagnosticColumns(db: PGlite, selectedTables: ReadonlySet<string>): Promise<ReadonlyMap<string, readonly PgliteDiagnosticColumn[]>> {
  const result: {
    readonly rows: readonly {
      readonly table_name: string;
      readonly column_name: string;
      readonly is_nullable: string;
      readonly column_default: string | null;
      readonly udt_name: string;
    }[];
  } = await db.query(
    "select table_name, column_name, is_nullable, column_default, udt_name from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position",
  );
  const columnsByTable = new Map<string, PgliteDiagnosticColumn[]>();

  for (const row of result.rows) {
    if (!selectedTables.has(row.table_name)) {
      continue;
    }

    const columns = columnsByTable.get(row.table_name) ?? [];
    columns.push({
      tableName: row.table_name,
      columnName: row.column_name,
      notNull: row.is_nullable === "NO",
      hasDefault: row.column_default !== null,
      udtName: row.udt_name
    });
    columnsByTable.set(row.table_name, columns);
  }

  return columnsByTable;
}

async function readDiagnosticForeignKeys(db: PGlite, selectedTables: ReadonlySet<string>): Promise<readonly PgliteDiagnosticForeignKey[]> {
  const result: {
    readonly rows: readonly {
      readonly conname: string;
      readonly source_table: string;
      readonly source_column: string;
      readonly target_table: string;
      readonly target_column: string;
    }[];
  } = await db.query(`
    select
      con.conname,
      rel.relname as source_table,
      att.attname as source_column,
      frel.relname as target_table,
      fatt.attname as target_column
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_class frel on frel.oid = con.confrelid
    join unnest(con.conkey) with ordinality as src(attnum, ord) on true
    join unnest(con.confkey) with ordinality as tgt(attnum, ord) on src.ord = tgt.ord
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = src.attnum
    join pg_attribute fatt on fatt.attrelid = frel.oid and fatt.attnum = tgt.attnum
    where con.contype = 'f'
    order by source_table, source_column
  `);

  return result.rows
    .filter((row) => selectedTables.has(row.source_table) && selectedTables.has(row.target_table))
    .map((row) => ({
      constraintName: row.conname,
      sourceTable: row.source_table,
      sourceColumn: row.source_column,
      targetTable: row.target_table,
      targetColumn: row.target_column
    }));
}

async function readDiagnosticEnumValues(db: PGlite): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  const result: {
    readonly rows: readonly {
      readonly typname: string;
      readonly enumlabel: string;
    }[];
  } = await db.query("select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid = t.oid order by t.typname, e.enumsortorder");
  const enumValuesByType = new Map<string, Set<string>>();

  for (const row of result.rows) {
    setFor(enumValuesByType, row.typname).add(row.enumlabel);
  }

  return enumValuesByType;
}

function validateNotNullColumns(
  schema: PgliteDiagnosticSchema,
  accumulator: PgliteDiagnosticAccumulator,
  tableName: string,
  row: DiagnosticRow
): void {
  const columns = schema.columnsByTable.get(tableName) ?? [];
  for (const column of columns) {
    if (!column.notNull || column.hasDefault) {
      continue;
    }

    const value = row[column.columnName];
    if (value !== null && value !== undefined) {
      continue;
    }

    const key = `${tableName}.${column.columnName}`;
    const violation =
      accumulator.notNullViolations.get(key) ??
      {
        tableName,
        columnName: column.columnName,
        count: 0,
        sourceLegacyIdExamples: []
      };
    violation.count += 1;
    addExample(violation.sourceLegacyIdExamples, rowLegacyId(row, tableName));
    accumulator.notNullViolations.set(key, violation);
  }
}

function validateEnumColumns(
  schema: PgliteDiagnosticSchema,
  accumulator: PgliteDiagnosticAccumulator,
  tableName: string,
  row: DiagnosticRow
): void {
  const columns = schema.columnsByTable.get(tableName) ?? [];
  for (const column of columns) {
    const enumValues = schema.enumValuesByType.get(column.udtName);
    if (enumValues === undefined) {
      continue;
    }

    const value = row[column.columnName];
    if (value === null || value === undefined || enumValues.has(String(value))) {
      continue;
    }

    const key = `${tableName}.${column.columnName}`;
    const violation =
      accumulator.enumViolations.get(key) ??
      {
        tableName,
        columnName: column.columnName,
        enumType: column.udtName,
        values: new Map<string, MutableEnumInvalidValue>()
      };
    const stringValue = String(value);
    const invalid =
      violation.values.get(stringValue) ??
      {
        count: 0,
        sourceLegacyIdExamples: []
      };
    invalid.count += 1;
    addExample(invalid.sourceLegacyIdExamples, rowLegacyId(row, tableName));
    violation.values.set(stringValue, invalid);
    accumulator.enumViolations.set(key, violation);
  }
}

function validateForeignKeys(
  schema: PgliteDiagnosticSchema,
  accumulator: PgliteDiagnosticAccumulator,
  tableName: string,
  row: DiagnosticRow
): void {
  const foreignKeys = schema.foreignKeys.filter((foreignKey) => foreignKey.sourceTable === tableName);

  for (const foreignKey of foreignKeys) {
    const value = stringCell(row[foreignKey.sourceColumn]);
    if (value === null) {
      continue;
    }

    const targetIds = accumulator.idsByTable.get(foreignKey.targetTable) ?? new Set<string>();
    if (targetIds.has(value)) {
      continue;
    }

    const key = `${foreignKey.constraintName}:${foreignKey.sourceTable}.${foreignKey.sourceColumn}`;
    const violation =
      accumulator.fkViolations.get(key) ??
      {
        constraintName: foreignKey.constraintName,
        sourceTable: foreignKey.sourceTable,
        sourceColumn: foreignKey.sourceColumn,
        targetTable: foreignKey.targetTable,
        targetColumn: foreignKey.targetColumn,
        count: 0,
        sourceLegacyIdExamples: [],
        missingTargetLegacyIdExamples: [],
        siblingHintsByLegacyId: new Map<number, Set<string>>()
      };

    violation.count += 1;
    addExample(violation.sourceLegacyIdExamples, rowLegacyId(row, tableName));
    const missingLegacyId = resolveMissingTargetLegacyId(accumulator, foreignKey.targetTable, value);
    addExample(violation.missingTargetLegacyIdExamples, missingLegacyId);
    if (missingLegacyId !== null) {
      const siblingTables = accumulator.tablesByLegacyId.get(missingLegacyId) ?? new Set<string>();
      const siblings = [...siblingTables].filter((siblingTable) => siblingTable !== foreignKey.targetTable);
      if (siblings.length > 0) {
        violation.siblingHintsByLegacyId.set(missingLegacyId, new Set(siblings));
      }
    }

    accumulator.fkViolations.set(key, violation);
  }
}

function resolveMissingTargetLegacyId(accumulator: PgliteDiagnosticAccumulator, targetTable: string, missingUuid: string): number | null {
  const cacheKey = `${targetTable}:${missingUuid}`;
  const cached = accumulator.reverseLegacyIdCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  for (const legacyId of accumulator.tablesByLegacyId.keys()) {
    if (legacyUuidForTable(targetTable, legacyId) === missingUuid) {
      accumulator.reverseLegacyIdCache.set(cacheKey, legacyId);
      return legacyId;
    }
  }

  accumulator.reverseLegacyIdCache.set(cacheKey, null);
  return null;
}

function rowLegacyId(row: DiagnosticRow, tableName: string): number | null {
  const value = row.legacy_id;
  if (typeof value === "boolean") {
    throw new Error(`Diagnostic legacy_id cannot be boolean for ${tableName}.legacy_id.`);
  }

  return legacyIntegerId(value, tableName, "legacy_id");
}

function addExample(examples: number[], value: number | null): void {
  if (value === null || examples.includes(value) || examples.length >= 3) {
    return;
  }

  examples.push(value);
}

function stringCell(value: DiagnosticCellValue): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  return String(value);
}

function setFor<Key, Value>(map: Map<Key, Set<Value>>, key: Key): Set<Value> {
  const existing = map.get(key);
  if (existing !== undefined) {
    return existing;
  }

  const next = new Set<Value>();
  map.set(key, next);
  return next;
}

function toFkViolationReport(violation: MutableFkViolation): FkViolationReport {
  return {
    constraintName: violation.constraintName,
    source: `${violation.sourceTable}.${violation.sourceColumn}`,
    target: `${violation.targetTable}.${violation.targetColumn}`,
    count: violation.count,
    sourceLegacyIdExamples: violation.sourceLegacyIdExamples,
    missingTargetLegacyIdExamples: violation.missingTargetLegacyIdExamples,
    siblingHints: [...violation.siblingHintsByLegacyId.entries()]
      .map(([missingTargetLegacyId, tables]) => ({
        missingTargetLegacyId,
        tables: [...tables].sort()
      }))
      .sort((left, right) => left.missingTargetLegacyId - right.missingTargetLegacyId)
  };
}

function formatSiblingHints(hints: readonly SiblingHintReport[]): string {
  if (hints.length === 0) {
    return "none";
  }

  return hints.map((hint) => `${String(hint.missingTargetLegacyId)} in ${hint.tables.join(", ")}`).join("; ");
}
