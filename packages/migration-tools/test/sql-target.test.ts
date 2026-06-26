import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  assertTargetTablesEmpty,
  chunkSqlRows,
  distributionB2ErhCliFlagError,
  insertSqlRowsBatched,
  officeB2CliFlagError,
  officeB2ResetTableNames,
  requireDatabaseUrl,
  TargetNotEmptyError,
  type SqlQueryResult,
  withReadOnlySqlTransaction
} from "../src/index.ts";

test("postgres target refuses to run without DATABASE_URL", () => {
  assert.throws(
    () => requireDatabaseUrl({}),
    /DATABASE_URL is required/
  );
});

test("anti-double-load guard refuses non-empty target tables unless force is explicit", async () => {
  const db = new PGlite();
  try {
    await db.query("create table target_probe (id text primary key)");
    await db.query("insert into target_probe (id) values ('already-loaded')");

    await assert.rejects(
      async () => assertTargetTablesEmpty(db, ["target_probe"], false),
      (error: unknown): boolean => error instanceof TargetNotEmptyError && error.tables[0]?.tableName === "target_probe"
    );

    const nonEmptyTables = await assertTargetTablesEmpty(db, ["target_probe"], true);
    assert.deepEqual(nonEmptyTables, [{ tableName: "target_probe", rowCount: 1 }]);
  } finally {
    await db.close();
  }
});

test("read-only SQL transaction rejects writes", async () => {
  const db = new PGlite();
  try {
    await db.query("create table readonly_probe (id text primary key)");

    await assert.rejects(
      async () => withReadOnlySqlTransaction(db, async (client) => {
        await client.query("insert into readonly_probe (id) values ('blocked')");
      }),
      /read-only|readonly|write/i
    );

    const result = await db.query("select count(*)::text as row_count from readonly_probe");
    assert.equal(result.rows[0]?.row_count, "0");
  } finally {
    await db.close();
  }
});

test("batched SQL insert commits at chunk boundaries", async () => {
  const client = new RecordingSqlClient();
  const rows = [
    { id: "1", label: "one" },
    { id: "2", label: "two" },
    { id: "3", label: "three" },
    { id: "4", label: "four" },
    { id: "5", label: "five" }
  ];

  const result = await insertSqlRowsBatched(
    client,
    "target_probe",
    0,
    rows,
    new Set(["id", "label"]),
    { batchSize: 2, copy: false, retryLimit: 3 }
  );

  assert.deepEqual(chunkSqlRows(rows, 2).map((batch) => batch.length), [2, 2, 1]);
  assert.equal(result.insertedRows, 5);
  assert.equal(result.committedBatches, 3);
  assert.equal(client.statements.filter((statement) => statement === "begin").length, 3);
  assert.equal(client.statements.filter((statement) => statement === "commit").length, 3);
});

test("Distribution reset and verify-only flags are rejected together", () => {
  assert.equal(distributionB2ErhCliFlagError("postgres", true, true), "--reset and --verify-only are mutually exclusive.");
  assert.equal(distributionB2ErhCliFlagError("pglite", true, false), "--reset requires --target postgres.");
  assert.equal(distributionB2ErhCliFlagError("pglite", false, true), "--verify-only requires --target postgres.");
  assert.equal(distributionB2ErhCliFlagError("postgres", true, false), null);
});

test("Office reset and verify-only flags are rejected together", () => {
  assert.equal(officeB2CliFlagError("postgres", true, true), "--reset and --verify-only are mutually exclusive.");
  assert.equal(officeB2CliFlagError("pglite", true, false), "--reset requires --target postgres.");
  assert.equal(officeB2CliFlagError("pglite", false, true), "--verify-only requires --target postgres.");
  assert.equal(officeB2CliFlagError("postgres", true, false), null);
});

test("Office reset table list is scoped to Office B2 target tables only", () => {
  assert.deepEqual(officeB2ResetTableNames, [
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
  ]);
  assert.equal(officeB2ResetTableNames.some((tableName) => tableName.startsWith("wp_erh_") || tableName.includes("earning") || tableName === "raw_import_rows"), false);
});

class RecordingSqlClient {
  readonly statements: string[] = [];

  async query(sql: string): Promise<SqlQueryResult> {
    const normalized = sql.trim().split(/\s+/u)[0]?.toLowerCase() ?? "";
    this.statements.push(normalized);
    return { rows: [] };
  }
}
