#!/usr/bin/env node
// ë • HQ — SQL INSERT column completeness check.
//
// Scans services/api/src/ for raw `INSERT INTO table (col1, col2, ...)` statements
// and verifies that every required column (NOT NULL, no server-side default) is
// present. This is the static safety net that catches the class of bug where a
// newly added NOT NULL column is missing from an existing INSERT path.
//
// HOW TO MAINTAIN:
//   REQUIRED_COLUMNS maps table -> [required columns]. Update it whenever:
//   - A migration adds a NOT NULL column without a DB-level default.
//   - A NOT NULL column gets a DB default (remove it from the list).
//   Add "// sql-columns-ok" to any INSERT that intentionally omits a column
//   (e.g. generated columns, columns with application-provided defaults).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const API_SRC = join(__dir, "..", "services", "api", "src");

// Columns that MUST appear in every INSERT for the given table.
// Only list columns that are NOT NULL with no DB-level default expression.
// Generated/serial/defaultRandom/defaultNow columns are excluded.
const REQUIRED_COLUMNS = {
  transactions: [
    "id",
    "workspace_id",
    "transaction_date",
    "type",
    "status",
    "is_active",
    "description",
    "amount_minor",
    "source",
    "created_by_user_id"
  ],
  office_bank_accounts: [
    "id",
    "workspace_id",
    "bank_name",
    "account_label",
    "account_reference_hash",
    "currency",
    "current_balance_minor",
    "is_active"
  ],
  office_bank_import_batches: [
    "id",
    "workspace_id",
    "account_id",
    "source",
    "file_name",
    "status"
  ],
  office_bank_statement_lines: [
    "id",
    "import_batch_id",
    "account_id",
    "occurred_on",
    "direction",
    "amount_minor",
    "currency"
  ],
  calculation_runs: [
    "id",
    "status",
    "started_at"
  ],
  expense_applications: [
    "id",
    "cost_term_id",
    "payee_id",
    "amount_applied",
    "currency"
  ]
};

// Collect all .ts files under API_SRC
function collectTsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (extname(full) === ".ts") {
      files.push(full);
    }
  }
  return files;
}

// Parse INSERT INTO table (col1, col2) from source, handling multi-line strings.
// Returns array of { table, cols, lineNumber, skipCheck }.
function extractInserts(source) {
  const inserts = [];
  // Match: insert into table_name (col_list)
  // The column list may span multiple lines inside a template literal.
  const pattern = /insert\s+into\s+(\w+)\s*\(([^)]+)\)/gis;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const table = match[1].toLowerCase();
    const colsRaw = match[2].replace(/\s+/gu, " ").trim();
    const cols = colsRaw.split(",").map(c => c.trim().toLowerCase()).filter(Boolean);
    // Find approximate line number
    const lineNumber = source.slice(0, match.index).split("\n").length;
    // Check for opt-out comment on the same or previous line
    const context = source.slice(Math.max(0, match.index - 120), match.index + match[0].length);
    const skipCheck = context.includes("// sql-columns-ok");
    inserts.push({ table, cols, lineNumber, skipCheck });
  }
  return inserts;
}

let failed = false;

for (const file of collectTsFiles(API_SRC)) {
  const source = readFileSync(file, "utf8");
  const relative = file.replace(join(__dir, "..") + "/", "");
  const inserts = extractInserts(source);

  for (const { table, cols, lineNumber, skipCheck } of inserts) {
    if (skipCheck) continue;
    const required = REQUIRED_COLUMNS[table];
    if (!required) continue; // table not in watchlist

    const missing = required.filter(req => !cols.includes(req));
    if (missing.length > 0) {
      console.error(
        `SQL_COLUMNS: ${relative}:${lineNumber}: INSERT INTO ${table} missing required column(s): ${missing.join(", ")}`
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error("check-sql-columns: FAILED");
  process.exit(1);
}

console.log(`check-sql-columns: ok (${Object.keys(REQUIRED_COLUMNS).length} tables watched)`);
