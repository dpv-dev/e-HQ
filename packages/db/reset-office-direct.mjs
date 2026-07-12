import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const packageDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageDir, "../..");
const outputDir = resolve(repoRoot, "services/api/output");

loadEnvFile(resolve(repoRoot, ".env"));

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error("DATABASE_URL is required in the untracked root .env.");
}

const execute = process.argv.includes("--execute");
const confirmed = process.argv.includes("--confirmation=DELETE_ALL_OFFICE_DATA");
if (execute && !confirmed) {
  throw new Error("Execution requires --confirmation=DELETE_ALL_OFFICE_DATA.");
}

const officeTables = [
  "identity_link",
  "api_import_previews",
  "office_bank_reconciliation_matches",
  "office_cashflow_projection_rows",
  "office_bank_statement_lines",
  "office_bank_import_batches",
  "financial_allocations",
  "transactions",
  "office_bank_accounts",
  "project_members",
  "project_budget_lines",
  "project_departments",
  "shared_cost_rules",
  "projects",
  "categories",
  "divisions",
  "departments",
  "partners"
];

const distributionTables = [
  "import_batches",
  "normalized_earnings",
  "releases",
  "tracks",
  "payees",
  "contracts",
  "royalty_rules",
  "contract_cost_terms",
  "earning_allocations",
  "statements",
  "payments",
  "suspense_items"
];

const pool = new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl) });
const client = await pool.connect();

try {
  await client.query("begin isolation level serializable");
  await client.query("select pg_advisory_xact_lock(hashtext('ehq:office-full-reset'))");

  const distributionBefore = await countTables(client, distributionTables);
  const officeBefore = await countOfficeTables(client);

  if (!execute) {
    await client.query("rollback");
    console.log(JSON.stringify({ mode: "dry-run", officeBefore, distributionBefore }, null, 2));
    process.exitCode = 0;
  } else {
    const backup = {
      createdAt: new Date().toISOString(),
      scope: "office-full-reset",
      officeCounts: officeBefore,
      distributionFingerprint: distributionBefore,
      tables: await readOfficeTables(client)
    };

    mkdirSync(outputDir, { recursive: true });
    const timestamp = backup.createdAt.replaceAll(":", "-").replaceAll(".", "-");
    const backupPath = resolve(outputDir, `office-full-reset-backup-${timestamp}.json`);
    writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

    const deleted = await deleteOfficeRows(client);
    const officeAfter = await countOfficeTables(client);
    const distributionAfter = await countTables(client, distributionTables);

    assertAllZero(officeAfter);
    assertCountsEqual(distributionBefore, distributionAfter, "Distribution changed during Office reset");

    const auditId = randomUUID();
    await client.query(
      `insert into audit_logs (
        id, entity_type, entity_id, action, actor_user_id, before, after, metadata
      ) values ($1, 'office_workspace', 'all', 'office_full_reset', null, $2::jsonb, $3::jsonb, $4::jsonb)`,
      [
        auditId,
        JSON.stringify({ counts: officeBefore }),
        JSON.stringify({ counts: officeAfter, deleted }),
        JSON.stringify({
          approval: "explicit_user_go_reset_office",
          backupPath,
          distributionFingerprint: distributionAfter
        })
      ]
    );

    await client.query("commit");
    console.log(JSON.stringify({
      mode: "executed",
      backupPath,
      auditId,
      deleted,
      officeAfter,
      distributionAfter
    }, null, 2));
  }
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    // Preserve the original failure.
  }
  throw error;
} finally {
  client.release();
  await pool.end();
}

async function readOfficeTables(client) {
  const tables = {};
  for (const table of officeTables) {
    const where = table === "api_import_previews" ? " where kind like 'office_%'" : "";
    const result = await client.query(`select * from ${table}${where}`);
    tables[table] = result.rows;
  }
  return tables;
}

async function countOfficeTables(client) {
  const counts = {};
  for (const table of officeTables) {
    const where = table === "api_import_previews" ? " where kind like 'office_%'" : "";
    const result = await client.query(`select count(*)::int as count from ${table}${where}`);
    counts[table] = result.rows[0]?.count ?? 0;
  }
  return counts;
}

async function countTables(client, tables) {
  const counts = {};
  for (const table of tables) {
    const result = await client.query(`select count(*)::int as count from ${table}`);
    counts[table] = result.rows[0]?.count ?? 0;
  }
  return counts;
}

async function deleteOfficeRows(client) {
  const statements = [
    ["identity_link", "delete from identity_link"],
    ["api_import_previews", "delete from api_import_previews where kind like 'office_%'"],
    ["office_bank_reconciliation_matches", "delete from office_bank_reconciliation_matches"],
    ["office_cashflow_projection_rows", "delete from office_cashflow_projection_rows"],
    ["office_bank_statement_lines", "delete from office_bank_statement_lines"],
    ["office_bank_import_batches", "delete from office_bank_import_batches"],
    ["financial_allocations", "delete from financial_allocations"],
    ["transactions", "delete from transactions"],
    ["office_bank_accounts", "delete from office_bank_accounts"],
    ["project_members", "delete from project_members"],
    ["project_budget_lines", "delete from project_budget_lines"],
    ["project_departments", "delete from project_departments"],
    ["shared_cost_rules", "delete from shared_cost_rules"],
    ["projects", "delete from projects"],
    ["categories", "delete from categories"],
    ["divisions", "delete from divisions"],
    ["departments", "delete from departments"],
    ["partners", "delete from partners"]
  ];

  const deleted = {};
  for (const [table, statement] of statements) {
    const result = await client.query(statement);
    deleted[table] = result.rowCount ?? 0;
  }
  return deleted;
}

function assertAllZero(counts) {
  const remaining = Object.entries(counts).filter(([, count]) => count !== 0);
  if (remaining.length > 0) {
    throw new Error(`Office reset left rows behind: ${JSON.stringify(Object.fromEntries(remaining))}`);
  }
}

function assertCountsEqual(before, after, message) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`${message}: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
}

function normalizeDatabaseUrl(value) {
  if (value.includes("sslmode=")) {
    return value.replace(/sslmode=[^&]*/u, "sslmode=no-verify");
  }
  return `${value}${value.includes("?") ? "&" : "?"}sslmode=no-verify`;
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line.trim());
    if (match === null || line.trim().startsWith("#")) {
      continue;
    }
    const key = match[1];
    let value = (match[2] ?? "").trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key !== undefined && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
