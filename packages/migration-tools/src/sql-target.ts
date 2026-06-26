import { readFileSync } from "node:fs";
import { Readable, type Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setTimeout as sleep } from "node:timers/promises";

export type SqlValue = string | number | boolean | null;

export interface SqlQueryResult {
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

export interface SqlQueryClient {
  query(sql: string, values?: readonly SqlValue[]): Promise<SqlQueryResult>;
}

export interface ClosableSqlQueryClient extends SqlQueryClient {
  close(): Promise<void>;
  copyRows?(tableName: string, columns: readonly string[], rows: readonly (readonly unknown[])[]): Promise<void>;
  reconnect?(): Promise<void>;
}

export type ProgressLogger = (message: string) => void;

export interface SqlInsertFailure {
  readonly tableName: string;
  readonly rowIndex: number;
  readonly message: string;
  readonly detail: string | null;
}

export interface NonEmptyTargetTable {
  readonly tableName: string;
  readonly rowCount: number;
}

export interface SqlRowsInsertOptions {
  readonly batchSize: number;
  readonly copy: boolean;
  readonly retryLimit: number;
}

export interface SqlRowsInsertResult {
  readonly insertedRows: number;
  readonly committedBatches: number;
}

export class SqlInsertError extends Error {
  readonly failure: SqlInsertFailure;

  constructor(failure: SqlInsertFailure) {
    super(`SQL insert failed for ${failure.tableName} row ${String(failure.rowIndex)}: ${failure.message}`);
    this.name = "SqlInsertError";
    this.failure = failure;
  }
}

export class TargetNotEmptyError extends Error {
  readonly tables: readonly NonEmptyTargetTable[];

  constructor(tables: readonly NonEmptyTargetTable[]) {
    super(`Target tables are not empty: ${tables.map((table) => `${table.tableName}=${String(table.rowCount)}`).join(", ")}.`);
    this.name = "TargetNotEmptyError";
    this.tables = tables;
  }
}

export function requireDatabaseUrl(env: Readonly<Record<string, string | undefined>>): string {
  const databaseUrl: string | undefined = env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error("DATABASE_URL is required for the postgres load target. Use the direct Supabase port 5432 URL in a local untracked .env.");
  }

  return databaseUrl;
}

export async function createPostgresTargetFromEnv(env: Readonly<Record<string, string | undefined>>): Promise<ClosableSqlQueryClient> {
  loadDefaultEnvFiles();
  const databaseUrl: string = requireDatabaseUrl(env);
  const target = parseDatabaseTarget(databaseUrl);
  const progress: ProgressLogger | null = null;
  return createPostgresTarget(databaseUrl, target, progress);
}

export async function createPostgresTargetFromEnvWithProgress(
  env: Readonly<Record<string, string | undefined>>,
  progress: ProgressLogger
): Promise<ClosableSqlQueryClient> {
  loadDefaultEnvFiles();
  const databaseUrl: string = requireDatabaseUrl(env);
  const target = parseDatabaseTarget(databaseUrl);
  progress(`→ connecting to ${target.host}:${target.port} …`);
  const client = await createPostgresTarget(databaseUrl, target, progress);
  progress("✓ connected");
  return client;
}

async function createPostgresTarget(
  databaseUrl: string,
  target: DatabaseTarget,
  progress: ProgressLogger | null
): Promise<ClosableSqlQueryClient> {
  const pgModule: typeof import("pg") = await import("pg");
  let client: import("pg").Client = createPgClient(pgModule, databaseUrl);

  try {
    await client.connect();
    await client.query("select 1");
  } catch (error: unknown) {
    await closePgClient(client);
    const message = sanitizeConnectionError(error, databaseUrl);
    throw new Error(`Postgres connection failed for ${target.host}:${target.port}: ${message}`);
  }

  await client.query("set statement_timeout = '10min'");

  return {
    async query(sql: string, values?: readonly SqlValue[]): Promise<SqlQueryResult> {
      const result: { readonly rows: readonly Readonly<Record<string, unknown>>[] } = await client.query(sql, values);
      return { rows: result.rows };
    },
    async copyRows(tableName: string, columns: readonly string[], rows: readonly (readonly unknown[])[]): Promise<void> {
      const copyModule: typeof import("pg-copy-streams") = await import("pg-copy-streams");
      const sql = `copy ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(", ")}) from stdin`;
      const writable = (client as unknown as { query(queryConfig: unknown): Writable }).query(copyModule.from(sql));
      await pipeline(Readable.from(rows.map((row) => `${row.map(toCopyTextValue).join("\t")}\n`)), writable);
    },
    async reconnect(): Promise<void> {
      if (progress !== null) {
        progress(`→ reconnecting to ${target.host}:${target.port} …`);
      }

      await closePgClient(client);
      client = createPgClient(pgModule, databaseUrl);
      await client.connect();
      await client.query("set statement_timeout = '10min'");
      if (progress !== null) {
        progress("✓ reconnected");
      }
    },
    async close(): Promise<void> {
      await closePgClient(client);
    }
  };
}

function createPgClient(pgModule: typeof import("pg"), databaseUrl: string): import("pg").Client {
  return new pgModule.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    query_timeout: 600_000,
    statement_timeout: 600_000,
    ssl: sslFromDatabaseUrl(databaseUrl)
  });
}

async function closePgClient(client: import("pg").Client): Promise<void> {
  try {
    await client.end();
  } catch {
    // Closing after a broken socket may fail; the original query error is more useful.
  }
}

interface DatabaseTarget {
  readonly host: string;
  readonly port: string;
}

function parseDatabaseTarget(databaseUrl: string): DatabaseTarget {
  try {
    const url = new URL(databaseUrl);
    const defaultPort = url.protocol === "postgresql:" || url.protocol === "postgres:" ? "5432" : "";
    return {
      host: url.hostname,
      port: url.port.length > 0 ? url.port : defaultPort
    };
  } catch {
    return {
      host: "unknown-host",
      port: "unknown-port"
    };
  }
}

function sslFromDatabaseUrl(databaseUrl: string): false | { readonly rejectUnauthorized: boolean } {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get("sslmode");
  if (sslMode === "disable") {
    return false;
  }

  if (sslMode === "verify-ca" || sslMode === "verify-full") {
    return { rejectUnauthorized: true };
  }

  return { rejectUnauthorized: false };
}

function sanitizeConnectionError(error: unknown, databaseUrl: string): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const url = new URL(databaseUrl);
  const sensitiveParts: readonly string[] = [databaseUrl, url.username, url.password].filter((value) => value.length > 0);
  return sensitiveParts.reduce((message, value) => message.split(value).join("[redacted]"), rawMessage);
}

export function loadDefaultEnvFiles(): void {
  loadEnvFile(new URL("../../../.env", import.meta.url));
  loadEnvFile(new URL("../.env", import.meta.url));
}

function loadEnvFile(filePath: URL): void {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (error: unknown) {
    if (isMissingEnvFileError(error)) {
      return;
    }

    throw error;
  }

  const lines: readonly string[] = text.split(/\r?\n/u);
  for (const line of lines) {
    const parsed: EnvEntry | null = parseEnvLine(line);
    if (parsed === null || process.env[parsed.key] !== undefined) {
      continue;
    }

    process.env[parsed.key] = parsed.value;
  }
}

function isMissingEnvFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

interface EnvEntry {
  readonly key: string;
  readonly value: string;
}

function parseEnvLine(line: string): EnvEntry | null {
  const trimmed: string = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return null;
  }

  const match: RegExpExecArray | null = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(trimmed);
  if (match === null) {
    return null;
  }

  return {
    key: match[1] ?? "",
    value: unquoteEnvValue((match[2] ?? "").trim())
  };
}

function unquoteEnvValue(value: string): string {
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1).replaceAll("\\\"", "\"");
  }

  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}

export async function readSqlTableColumns(client: SqlQueryClient, tableName: string): Promise<ReadonlySet<string>> {
  const result: SqlQueryResult = await client.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position",
    [tableName],
  );
  return new Set(result.rows.map((row: Readonly<Record<string, unknown>>): string => String(row.column_name)));
}

export async function assertTargetTablesEmpty(
  client: SqlQueryClient,
  tableNames: readonly string[],
  force: boolean
): Promise<readonly NonEmptyTargetTable[]> {
  const nonEmptyTables: NonEmptyTargetTable[] = [];
  for (const tableName of tableNames) {
    const rowCount: number = await readSqlTableRowCount(client, tableName);
    if (rowCount > 0) {
      nonEmptyTables.push({ tableName, rowCount });
    }
  }

  if (nonEmptyTables.length > 0 && !force) {
    throw new TargetNotEmptyError(nonEmptyTables);
  }

  return nonEmptyTables;
}

export async function readSqlTableRowCount(client: SqlQueryClient, tableName: string): Promise<number> {
  const result: SqlQueryResult = await client.query(`select count(*)::text as row_count from ${quoteIdentifier(tableName)}`);
  const row: Readonly<Record<string, unknown>> | undefined = result.rows[0];
  if (row === undefined) {
    throw new Error(`Could not read row count for ${tableName}.`);
  }

  return Number(row.row_count ?? 0);
}

export async function withReadOnlySqlTransaction<T>(
  client: SqlQueryClient,
  work: (transactionClient: SqlQueryClient) => Promise<T>
): Promise<T> {
  await client.query("begin");
  try {
    await client.query("set transaction read only");
    const result: T = await work(client);
    await client.query("commit");
    return result;
  } catch (error: unknown) {
    await client.query("rollback");
    throw error;
  }
}

export async function insertSqlRow(
  client: SqlQueryClient,
  tableName: string,
  rowIndex: number,
  row: Readonly<Record<string, unknown>>,
  tableColumns: ReadonlySet<string>
): Promise<void> {
  const entries: readonly (readonly [string, unknown])[] = Object.entries(row).filter(
    ([columnName, value]: readonly [string, unknown]): boolean => tableColumns.has(columnName) && value !== undefined && value !== null,
  );

  const sql: string =
    entries.length === 0
      ? `insert into ${quoteIdentifier(tableName)} default values`
      : `insert into ${quoteIdentifier(tableName)} (${entries
          .map(([columnName]: readonly [string, unknown]): string => quoteIdentifier(columnName))
          .join(", ")}) values (${entries
          .map((_: readonly [string, unknown], index: number): string => `$${String(index + 1)}`)
          .join(", ")})`;
  const values: SqlValue[] = entries.map((entry: readonly [string, unknown]): SqlValue => toSqlValue(entry[1]));

  try {
    await client.query(sql, values);
  } catch (error: unknown) {
    throw new SqlInsertError({
      tableName,
      rowIndex,
      message: error instanceof Error ? error.message : String(error),
      detail: error instanceof Error && error.stack ? error.stack : null
    });
  }
}

export async function insertSqlRowsBatched(
  client: ClosableSqlQueryClient | SqlQueryClient,
  tableName: string,
  startRowIndex: number,
  rows: readonly Readonly<Record<string, unknown>>[],
  tableColumns: ReadonlySet<string>,
  options: SqlRowsInsertOptions
): Promise<SqlRowsInsertResult> {
  let committedBatches = 0;
  let insertedRows = 0;
  for (const batch of chunkSqlRows(rows, options.batchSize)) {
    for (const group of groupRowsByInsertColumns(batch, tableColumns)) {
      await runSqlWriteBatch(client, tableName, startRowIndex + insertedRows + group.firstRowOffset, options.retryLimit, async () => {
        if (options.copy && "copyRows" in client && typeof client.copyRows === "function") {
          await client.copyRows(tableName, group.columns, group.rows.map((row) => group.columns.map((columnName) => row[columnName])));
        } else {
          await insertSqlRowsStatement(client, tableName, group.columns, group.rows);
        }
      });
      committedBatches += 1;
    }
    insertedRows += batch.length;
  }

  return { insertedRows, committedBatches };
}

export function chunkSqlRows<T>(rows: readonly T[], batchSize: number): readonly (readonly T[])[] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error(`SQL batch size must be a positive integer, got ${String(batchSize)}.`);
  }

  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    batches.push(rows.slice(index, index + batchSize));
  }

  return batches;
}

async function runSqlWriteBatch(
  client: ClosableSqlQueryClient | SqlQueryClient,
  tableName: string,
  rowIndex: number,
  retryLimit: number,
  work: () => Promise<void>
): Promise<void> {
  for (let attempt = 1; attempt <= retryLimit; attempt += 1) {
    try {
      await client.query("begin");
      await work();
      await client.query("commit");
      return;
    } catch (error: unknown) {
      await rollbackSqlBatch(client);
      if (attempt < retryLimit && isRetryableNetworkError(error)) {
        if ("reconnect" in client && typeof client.reconnect === "function") {
          await client.reconnect();
        }

        await sleep(250 * attempt);
        continue;
      }

      throw new SqlInsertError({
        tableName,
        rowIndex,
        message: error instanceof Error ? error.message : String(error),
        detail: error instanceof Error && error.stack ? error.stack : null
      });
    }
  }
}

async function rollbackSqlBatch(client: SqlQueryClient): Promise<void> {
  try {
    await client.query("rollback");
  } catch {
    // A broken socket can make rollback impossible; retry logic will reconnect.
  }
}

interface SqlRowsColumnGroup {
  readonly columns: readonly string[];
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly firstRowOffset: number;
}

function groupRowsByInsertColumns(
  rows: readonly Readonly<Record<string, unknown>>[],
  tableColumns: ReadonlySet<string>
): readonly SqlRowsColumnGroup[] {
  const groups = new Map<string, { columns: readonly string[]; rows: Readonly<Record<string, unknown>>[]; firstRowOffset: number }>();
  rows.forEach((row, rowOffset) => {
    const columns = insertColumnsForRow(row, tableColumns);
    const key = columns.join("\u0000");
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { columns, rows: [row], firstRowOffset: rowOffset });
      return;
    }

    existing.rows.push(row);
  });

  return [...groups.values()];
}

function insertColumnsForRow(row: Readonly<Record<string, unknown>>, tableColumns: ReadonlySet<string>): readonly string[] {
  return Object.entries(row)
    .filter(([columnName, value]) => tableColumns.has(columnName) && value !== undefined && value !== null)
    .map(([columnName]) => columnName)
    .sort();
}

async function insertSqlRowsStatement(
  client: SqlQueryClient,
  tableName: string,
  columns: readonly string[],
  rows: readonly Readonly<Record<string, unknown>>[]
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  if (columns.length === 0) {
    for (const _row of rows) {
      await client.query(`insert into ${quoteIdentifier(tableName)} default values`);
    }
    return;
  }

  const values: SqlValue[] = [];
  const placeholders = rows.map((row, rowIndex) => {
    const rowPlaceholders = columns.map((columnName, columnIndex) => {
      values.push(toSqlValue(row[columnName]));
      return `$${String(rowIndex * columns.length + columnIndex + 1)}`;
    });
    return `(${rowPlaceholders.join(", ")})`;
  });
  await client.query(
    `insert into ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(", ")}) values ${placeholders.join(", ")}`,
    values
  );
}

function isRetryableNetworkError(error: unknown): boolean {
  const code = error instanceof Error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : String(error);
  return code === "EADDRNOTAVAIL" || code === "ECONNRESET" || code === "ETIMEDOUT" || /\b(EADDRNOTAVAIL|ECONNRESET|ETIMEDOUT)\b/u.test(message);
}

function toCopyTextValue(value: unknown): string {
  const sqlValue = toSqlValue(value);
  if (sqlValue === null) {
    return "\\N";
  }

  return String(sqlValue)
    .replaceAll("\\", "\\\\")
    .replaceAll("\t", "\\t")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
}

export function quoteIdentifier(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/u.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

export function toSqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return JSON.stringify(value);
}
