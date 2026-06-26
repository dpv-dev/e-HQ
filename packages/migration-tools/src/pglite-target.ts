import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { insertSqlRow, readSqlTableColumns, SqlInsertError, type SqlInsertFailure } from "./sql-target.js";

const migrationFileNames: readonly string[] = [
  "0000_superb_khan.sql",
  "0001_flat_ulik.sql",
  "0002_old_valeria_richards.sql",
  "0003_fancy_albert_cleary.sql",
  "0004_familiar_silver_fox.sql",
  "0005_brainy_garia.sql",
  "0006_new_luckman.sql",
  "0007_nappy_prism.sql",
  "0008_bored_blur.sql",
];

export type PgliteInsertFailure = SqlInsertFailure;

export class PgliteInsertError extends Error {
  readonly failure: PgliteInsertFailure;

  constructor(failure: PgliteInsertFailure) {
    super(`PGlite insert failed for ${failure.tableName} row ${failure.rowIndex}: ${failure.message}`);
    this.name = "PgliteInsertError";
    this.failure = failure;
  }
}

export async function createMigratedPgliteTarget(): Promise<{
  readonly db: PGlite;
  readonly migrationsApplied: readonly string[];
}> {
  const db: PGlite = new PGlite();
  const migrationsApplied: readonly string[] = await applyPgliteMigrations(db);
  return { db, migrationsApplied };
}

export async function applyPgliteMigrations(db: PGlite): Promise<readonly string[]> {
  const applied: string[] = [];

  for (const fileName of migrationFileNames) {
    const sql: string = readFileSync(new URL(`../../db/migrations/${fileName}`, import.meta.url), "utf8");
    const statements: readonly string[] = splitMigrationStatements(sql);

    for (const statement of statements) {
      await db.query(statement);
    }

    applied.push(fileName);
  }

  return applied;
}

export async function readPgliteTableColumns(db: PGlite, tableName: string): Promise<ReadonlySet<string>> {
  return readSqlTableColumns(db, tableName);
}

export async function insertPgliteRow(
  db: PGlite,
  tableName: string,
  rowIndex: number,
  row: Readonly<Record<string, unknown>>,
  tableColumns: ReadonlySet<string>,
): Promise<void> {
  try {
    await insertSqlRow(db, tableName, rowIndex, row, tableColumns);
  } catch (error: unknown) {
    if (error instanceof SqlInsertError) {
      throw new PgliteInsertError(error.failure);
    }

    throw new PgliteInsertError({
      tableName,
      rowIndex,
      message: error instanceof Error ? error.message : String(error),
      detail: error instanceof Error && error.stack ? error.stack : null,
    });
  }
}

function splitMigrationStatements(sql: string): readonly string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((statement: string): string => statement.trim())
    .filter((statement: string): boolean => statement.length > 0);
}
