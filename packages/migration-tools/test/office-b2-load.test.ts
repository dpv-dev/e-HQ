import assert from "node:assert/strict";
import test from "node:test";
import type { OfficeB2Contract } from "@ehq/domain-office";
import {
  parseMysqlInsertDump,
  parseMysqlInsertStatementRows,
  runOfficeB2LoadFromSql,
  serializeOfficeB2LoadReport,
  formatOfficeB2LoadReport,
  normalizeOfficeTemporalVerbatimValue
} from "../src/index.ts";
import type { MysqlDumpRecord } from "../src/index.ts";

const fixtureContract: OfficeB2Contract = {
  sourceDatabaseName: "fixture",
  tablePrefix: "wp_",
  expectedCounts: {
    transactions: 5,
    financialAllocations: 2,
    categories: 2,
    departments: 4,
    partners: 1,
    projects: 1,
    bankAccounts: 1,
    bankRawTransactions: 2,
    bankReconciliations: 1
  },
  expectedTransactionStatusCounts: {
    validated: 3,
    draft: 1,
    cancelled: 1
  },
  expectedQuality: {
    inconsistentCategories: 0,
    emptyCurrencyRows: 0,
    allocationSumMismatch: 0,
    orphanForeignKeys: 0,
    ignoredDivisionNameDrift: 1
  },
  parity: {
    validatedTransactionCount: 2,
    incomeMinor: 10_000n,
    expenseMinor: 4_000n
  }
};

const fixtureSql = `
INSERT INTO \`ignored_table\` (\`id\`, \`label\`) VALUES ('1', 'outside scope');
INSERT INTO \`wp_eof_departments\` (\`id\`, \`name\`, \`slug\`, \`parent_id\`, \`type\`, \`color\`, \`is_active\`, \`created_at\`) VALUES
('dept_music', 'Music', 'music', NULL, 'mixed', NULL, 1, '2026-01-01 00:00:00'),
('div_streaming', 'Streaming', 'streaming', 'dept_music', NULL, NULL, 1, '2026-01-01 00:00:00'),
('dept_ops', 'Operations', 'operations', NULL, 'expense', NULL, 1, '2026-01-01 00:00:00'),
('div_admin', 'Admin', 'admin', 'dept_ops', NULL, NULL, 1, '2026-01-01 00:00:00');
INSERT INTO \`wp_eof_categories\` (\`id\`, \`name\`, \`type\`, \`department_id\`, \`division_id\`, \`is_active\`) VALUES
('cat_streaming', 'Streaming revenue', 'income', 'dept_music', 'div_streaming', 1),
('cat_bank_fee', 'Bank fees', 'expense', 'dept_ops', 'div_admin', 1);
INSERT INTO \`wp_eof_partners\` (\`id\`, \`name\`, \`type\`, \`is_active\`) VALUES
('partner_kontor', 'Kontor\\'s account', 'client', 1);
INSERT INTO \`wp_eof_projects\` (\`id\`, \`name\`, \`status\`, \`state\`, \`is_active\`) VALUES
('project_catalog', 'Catalog', 'active', 'active', 1);
INSERT INTO \`wp_eof_transactions\` (\`id\`, \`transaction_date\`, \`type\`, \`status\`, \`is_active\`, \`description\`, \`category_id\`, \`partner_id\`, \`project_id\`, \`amount_mur\`, \`original_amount\`, \`original_currency\`, \`exchange_rate\`) VALUES
('tx_income', '2026-02-01 10:00:00', 'income', 'validated', 1, 'Streaming revenue; premium', 'cat_streaming', 'partner_kontor', 'project_catalog', '100.00', NULL, NULL, NULL),
('tx_expense', '2026-02-02 10:00:00', 'expense', 'validated', 1, 'Bank fees', 'cat_bank_fee', NULL, NULL, '40.00', NULL, 'MUR', NULL),
('tx_draft', '2026-02-03 10:00:00', 'income', 'draft', 1, 'Draft row', 'cat_streaming', NULL, NULL, '999.00', NULL, NULL, NULL),
('tx_cancelled', '2026-02-04 10:00:00', 'expense', 'cancelled', 1, 'Cancelled row', 'cat_bank_fee', NULL, NULL, '777.77', NULL, NULL, NULL),
('tx_inactive', '2026-02-05 10:00:00', 'income', 'validated', 0, 'Inactive row', 'cat_streaming', NULL, NULL, '999.00', NULL, NULL, NULL);
INSERT INTO \`wp_eof_financial_allocations\` (\`id\`, \`transaction_id\`, \`department_id\`, \`division_name\`, \`amount_mur\`, \`percentage_bp\`, \`role_slug\`) VALUES
('alloc_income', 'tx_income', 'dept_music', 'Music', '100.00', '10000', NULL),
('alloc_expense', 'tx_expense', 'dept_ops', 'Admin', '40.00', '10000', NULL);
INSERT INTO \`wp_eof_bank_accounts\` (\`id\`, \`name\`, \`account_number\`, \`bank_name\`, \`currency\`, \`is_active\`, \`notes\`, \`created_at\`, \`institution\`) VALUES
('1', 'MCB Current', '000455164517', NULL, 'MUR', 1, NULL, '2026-01-01 00:00:00', 'Mauritius Commercial Bank');
INSERT INTO \`wp_eof_bank_raw_transactions\` (\`id\`, \`import_id\`, \`account_id\`, \`external_id\`, \`transaction_date\`, \`description\`, \`direction\`, \`amount\`, \`balance\`, \`status\`, \`raw_payload\`, \`created_at\`, \`dedupe_hash\`) VALUES
('101', '10', '1', 'ext_1', '2026-02-01 00:00:00', 'Kontor payment', 'credit', '100.00', '100.00', 'matched', NULL, '2026-02-01 12:00:00', NULL),
('102', '10', '1', 'ext_2', '2026-02-02 00:00:00', 'Bank fee', 'debit', '40.00', '60.00', 'pending', NULL, '2026-02-02 12:00:00', NULL);
INSERT INTO \`wp_eof_bank_reconciliations\` (\`id\`, \`transaction_id\`, \`bank_raw_transaction_id\`, \`amount_linked\`, \`status\`, \`created_by_user_id\`, \`validated_by_user_id\`, \`validated_at\`, \`created_at\`) VALUES
('201', 'tx_income', '101', '100.00', 'validated', '1', '1', '2026-02-03 00:00:00', '2026-02-02 12:00:00');
`;

test("MySQL dump parser reads selected multi-row INSERTs with NULLs and escapes", () => {
  const parsed = parseMysqlInsertDump(fixtureSql, ["wp_eof_partners", "wp_eof_transactions"]);
  assert.equal(parsed.tables.size, 2);
  assert.equal(parsed.tables.get("wp_eof_partners")?.rows[0]?.name, "Kontor's account");
  assert.equal(parsed.tables.get("wp_eof_transactions")?.rows[0]?.description, "Streaming revenue; premium");
  assert.equal(parsed.tables.get("wp_eof_transactions")?.rows[0]?.original_currency, null);
});

test("MySQL dump streaming parser reads INSERTs preceded by dump comments", () => {
  const rows: MysqlDumpRecord[] = [];
  const tableName = parseMysqlInsertStatementRows(
    `
--
-- Dumping data for table \`wp_eof_partners\`
--

INSERT INTO \`wp_eof_partners\` (\`id\`, \`name\`) VALUES
('partner_1', 'Partner 1');
`,
    0,
    ["wp_eof_partners"],
    (_tableName: string, row: MysqlDumpRecord) => {
      rows.push(row);
    }
  );

  assert.equal(tableName, "wp_eof_partners");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.name, "Partner 1");
});

test("Office B2 load report proves ingestion, clean-target raw sums, and domain P&L parity", () => {
  const report = runOfficeB2LoadFromSql(fixtureSql, {
    generatedAt: "2026-06-21T00:00:00.000Z",
    sourceLabel: "fixture.sql",
    contract: fixtureContract
  });

  assert.equal(report.ingestionGuard.status, "pass");
  assert.deepEqual(report.source.transactionStatusCounts, {
    validated: 3,
    draft: 1,
    cancelled: 1
  });
  assert.equal(report.target.mode, "in-memory-clean-office");
  assert.deepEqual(report.target.transactionStatusCounts, {
    validated: 3,
    draft: 1,
    cancelled: 1
  });
  assert.equal(report.parity.rawPostgresEquivalent.incomeMinor, "10000");
  assert.equal(report.parity.rawPostgresEquivalent.expenseMinor, "4000");
  assert.equal(report.parity.domainOfficeGlobalPnl.incomeMinor, "10000");
  assert.equal(report.expectedDivergences[0]?.code, "BUG-M1");
  assert.match(serializeOfficeB2LoadReport(report), /"status": "pass"/);
  assert.match(formatOfficeB2LoadReport(report), /Office B2 parity report/);
  assert.match(formatOfficeB2LoadReport(report), /Transaction statuses: validated 3, draft 1, cancelled 1/);
});

test("Office B2 load aborts when the dump count differs from the golden guard", () => {
  const badContract: OfficeB2Contract = {
    ...fixtureContract,
    expectedCounts: {
      ...fixtureContract.expectedCounts,
      transactions: 6
    }
  };

  assert.throws(
    () =>
      runOfficeB2LoadFromSql(fixtureSql, {
        generatedAt: "2026-06-21T00:00:00.000Z",
        sourceLabel: "fixture.sql",
        contract: badContract
      }),
    /ingestion guard failed for transactions/
  );
});

test("Office B2 verbatim comparison normalizes date and timestamp columns by value", () => {
  assert.equal(
    normalizeOfficeTemporalVerbatimValue("timestamp", "2024-03-14 00:00:00"),
    normalizeOfficeTemporalVerbatimValue("timestamp", "2024-03-14T00:00:00.000Z")
  );
  assert.equal(
    normalizeOfficeTemporalVerbatimValue("date", "2024-03-14"),
    normalizeOfficeTemporalVerbatimValue("date", "2024-03-14T00:00:00.000Z")
  );
  assert.notEqual(
    normalizeOfficeTemporalVerbatimValue("timestamp", "2024-03-14 00:00:00"),
    normalizeOfficeTemporalVerbatimValue("timestamp", "2024-03-14T00:00:01.000Z")
  );
  assert.notEqual(
    normalizeOfficeTemporalVerbatimValue("date", "2024-03-14"),
    normalizeOfficeTemporalVerbatimValue("date", "2024-03-15T00:00:00.000Z")
  );
  assert.equal(
    normalizeOfficeTemporalVerbatimValue("timestamp", "0000-00-00 00:00:00"),
    normalizeOfficeTemporalVerbatimValue("timestamp", null)
  );
  assert.equal(
    normalizeOfficeTemporalVerbatimValue("date", ""),
    normalizeOfficeTemporalVerbatimValue("date", undefined)
  );
});
