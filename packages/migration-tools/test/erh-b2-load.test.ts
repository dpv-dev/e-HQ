import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createDistributionB2ErhLoadRequest,
  runDistributionB2ErhLoadFromDumpFile,
  runDistributionB2ErhLoadFromSql,
  serializeDistributionB2ErhLoadReport,
  formatDistributionB2ErhLoadReport,
  type DistributionB2ErhContractJson
} from "../src/index.ts";

const fixtureSql = `
INSERT INTO \`wp_erh_import_batches\` (\`id\`, \`source\`, \`file_name\`, \`status\`, \`imported_at\`, \`metadata\`, \`created_at\`, \`updated_at\`) VALUES
('batch_1', 'kontor', 'kontor.csv', 'completed', '2026-02-01 10:00:00', '{}', '2026-02-01 10:00:00', '2026-02-01 10:00:00');
INSERT INTO \`wp_erh_raw_import_rows\` (\`id\`, \`batch_id\`, \`row_number\`, \`raw_data\`, \`created_at\`) VALUES
('raw_1', 'batch_1', 1, '{"gross":"1.0000000001"}', '2026-02-01 10:00:00');
INSERT INTO \`wp_erh_normalized_earnings\` (\`id\`, \`batch_id\`, \`raw_import_row_id\`, \`dsp\`, \`gross_amount\`, \`quantity\`, \`currency\`, \`isrc\`, \`upc\`, \`raw_title\`, \`raw_artist\`, \`raw_label\`, \`mapping_status\`, \`calculation_status\`, \`created_at\`, \`updated_at\`) VALUES
('earning_1', 'batch_1', 'raw_1', 'Kontor', '1.0000000001', '2.500000', 'USD', 'ISRC1', 'UPC1', 'Song', 'Artist', 'Label', 'matched', 'calculated', '2026-02-01 10:00:00', '2026-02-01 10:00:00');
INSERT INTO \`wp_erh_payees\` (\`id\`, \`name\`, \`linked_artist_ids\`, \`preferred_currency\`, \`payment_method\`, \`tax_info\`, \`is_active\`, \`created_at\`, \`updated_at\`) VALUES
('payee_a', 'Payee A', '[]', 'USD', NULL, '{}', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
('payee_b', 'Payee B', '[]', 'USD', NULL, '{}', 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00');
INSERT INTO \`wp_erh_contracts\` (\`id\`, \`contract_number\`, \`title\`, \`status\`, \`effective_from\`, \`effective_to\`, \`signed_at\`, \`metadata\`, \`created_at\`, \`updated_at\`) VALUES
('contract_1', 'C-1', 'Contract 1', 'active', '2026-01-01', NULL, '0000-00-00 00:00:00', '{}', '2026-01-01 00:00:00', '2026-01-01 00:00:00');
INSERT INTO \`wp_erh_contract_cost_terms\` (\`id\`, \`contract_id\`, \`payee_id\`, \`amount\`, \`currency\`, \`recoupable\`, \`recovery_method\`, \`recovery_param\`, \`status\`, \`scope_type\`, \`scope_id\`, \`created_at\`, \`updated_at\`) VALUES
('cost_1', 'contract_1', 'payee_a', '0.2500000000', 'USD', 1, 'gross', '100.000000', 'open', NULL, NULL, '2026-01-01 00:00:00', '2026-01-01 00:00:00');
INSERT INTO \`wp_erh_calculation_runs\` (\`id\`, \`batch_id\`, \`status\`, \`reconciliation_json\`, \`started_at\`, \`finished_at\`, \`created_at\`) VALUES
('run_1', 'batch_1', 'calculated', '{}', '2026-02-01 11:00:00', '2026-02-01 11:05:00', '2026-02-01 11:00:00');
INSERT INTO \`wp_erh_earning_allocations\` (\`id\`, \`earning_id\`, \`calculation_run_id\`, \`payee_id\`, \`contract_id\`, \`track_id\`, \`gross_amount\`, \`original_gross_amount\`, \`fx_rate\`, \`gross_share\`, \`recoupment_applied\`, \`net_payable\`, \`split_percentage\`, \`currency\`, \`original_currency\`, \`status\`, \`created_at\`) VALUES
('alloc_a', 'earning_1', 'run_1', 'payee_a', 'contract_1', 'track_1', '1.0000000001', '1.0000000001', '1.0000000000', '0.6000000000', '0.2500000000', '0.3500000000', '60.000000', 'USD', 'USD', 'posted', '2026-02-01 12:00:00'),
('alloc_b', 'earning_1', 'run_1', 'payee_b', 'contract_1', 'track_1', '1.0000000001', '1.0000000001', '1.0000000000', '0.4000000001', '0.0000000000', '0.4000000001', '40.000000', 'USD', 'USD', 'posted', '2026-02-01 12:00:00');
INSERT INTO \`wp_erh_statements\` (\`id\`, \`payee_id\`, \`calculation_run_id\`, \`period_start\`, \`period_end\`, \`currency\`, \`gross_total\`, \`recoupment_total\`, \`net_payable\`, \`amount_due\`, \`version\`, \`status\`, \`locked_at\`, \`created_at\`, \`updated_at\`) VALUES
('statement_1', 'payee_a', 'run_1', '2026-02-01', '2026-02-28', 'USD', '0.6000000000', '0.2500000000', '0.3500000000', '0.3500000000', 1, 'generated', '0000-00-00 00:00:00', '2026-03-01 00:00:00', '2026-03-01 00:00:00');
INSERT INTO \`wp_erh_payee_balances\` (\`id\`, \`payee_id\`, \`statement_id\`, \`currency\`, \`opening_balance\`, \`period_net\`, \`closing_balance\`, \`movement_type\`, \`created_at\`) VALUES
('balance_1', 'payee_a', 'statement_1', 'USD', '0.0000000000', '0.3500000000', '0.0000000000', 'statement', '2026-03-01 00:00:00');
INSERT INTO \`wp_erh_statement_lines\` (\`id\`, \`statement_id\`, \`earning_allocation_id\`, \`track_id\`, \`gross_share\`, \`recoupment_applied\`, \`net_payable\`, \`quantity\`, \`created_at\`) VALUES
('line_1', 'statement_1', 'alloc_a', 'track_1', '0.6000000000', '0.2500000000', '0.3500000000', '2.500000', '2026-03-01 00:00:00');
INSERT INTO \`wp_erh_audit_logs\` (\`id\`, \`entity_type\`, \`entity_id\`, \`action\`, \`created_at\`) VALUES
('audit_1', 'statement', 'statement_1', 'generated', '2026-03-01 00:00:00');
`;

const fixtureContract: DistributionB2ErhContractJson = {
  sourceDatabaseName: "fixture",
  tablePrefix: "wp_",
  rawImportRowsMode: "migrate",
  expectedCounts: {
    import_batches: 1,
    raw_import_rows: 1,
    normalized_earnings: 1,
    payees: 2,
    contracts: 1,
    contract_cost_terms: 1,
    calculation_runs: 1,
    earning_allocations: 2,
    statements: 1,
    payee_balances: 1,
    statement_lines: 1,
    audit_logs: 1
  }
};

test("Distribution B2-erh load preserves scale-10 values and validates split groups through F3", () => {
  const report = runDistributionB2ErhLoadFromSql(
    fixtureSql,
    createDistributionB2ErhLoadRequest("2026-06-21T00:00:00.000Z", "fixture-erh.sql", fixtureContract)
  );

  assert.equal(report.target.moneyStorage, "NUMERIC(28,10)");
  assert.equal(report.counts.source.earning_allocations, 2);
  assert.equal(report.counts.target.raw_import_rows, 1);
  assert.equal(report.checksumGate.status, "pass");
  assert.equal(report.checksumGate.zeroDateNullCount, 2);
  assert.equal(report.splitInvariant.checkedEarningGroups, 1);
  assert.deepEqual(report.readableAssertions.tableCurrencyTotals.earning_allocations.currencyTotals.USD, {
    gross_amount: "2.0000000002",
    gross_share: "1.0000000001",
    recoupment_applied: "0.2500000000",
    net_payable: "0.7500000001"
  });
  assert.match(serializeDistributionB2ErhLoadReport(report), /"splitInvariant"/);
  assert.match(formatDistributionB2ErhLoadReport(report), /Distribution B2-erh parity report/);
});

test("Distribution B2-erh streaming load preserves fixture parity without retaining rowsets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ehq-erh-b2-"));
  const dumpPath = join(directory, "fixture.sql");
  await writeFile(dumpPath, fixtureSql, "utf8");
  const report = await runDistributionB2ErhLoadFromDumpFile(
    dumpPath,
    createDistributionB2ErhLoadRequest("2026-06-21T00:00:00.000Z", dumpPath, fixtureContract)
  );

  assert.equal(report.source.mode, "mysql-dump-streaming-parser");
  assert.equal(report.counts.source.earning_allocations, 2);
  assert.equal(report.counts.target.raw_import_rows, 1);
  assert.equal(report.checksumGate.status, "pass");
  assert.equal(report.splitInvariant.checkedEarningGroups, 1);
  assert.equal(report.moneyGoldens?.earning_allocations?.USD?.net_payable, "0.7500000001");
});

test("Distribution B2-erh can archive raw import rows by explicit decision", () => {
  const report = runDistributionB2ErhLoadFromSql(
    fixtureSql,
    createDistributionB2ErhLoadRequest("2026-06-21T00:00:00.000Z", "fixture-erh.sql", {
      ...fixtureContract,
      rawImportRowsMode: "archive"
    })
  );

  assert.equal(report.counts.source.raw_import_rows, 1);
  assert.equal(report.counts.target.raw_import_rows, 0);
  assert.ok(report.decisions.some((decision) => decision.includes("archived")));
});

test("Distribution B2-erh aborts on non-empty identity_link because Office unification is separate", () => {
  const sql = `${fixtureSql}
INSERT INTO \`wp_erh_identity_link\` (\`id\`, \`payee_id\`, \`office_partner_id\`, \`confidence\`, \`status\`, \`created_at\`, \`updated_at\`) VALUES
('link_1', 'payee_a', 'partner_1', '100.000000', 'linked', '2026-01-01 00:00:00', '2026-01-01 00:00:00');
`;

  assert.throws(
    () =>
      runDistributionB2ErhLoadFromSql(
        sql,
        createDistributionB2ErhLoadRequest("2026-06-21T00:00:00.000Z", "fixture-erh.sql", fixtureContract)
      ),
    /identity_link source table is not empty/
  );
});

test("Distribution B2-erh aborts when historical split percentages do not equal 100 via F3", () => {
  const sql = fixtureSql.replace("'40.000000', 'USD', 'USD', 'posted'", "'39.999999', 'USD', 'USD', 'posted'");

  assert.throws(
    () =>
      runDistributionB2ErhLoadFromSql(
        sql,
        createDistributionB2ErhLoadRequest("2026-06-21T00:00:00.000Z", "fixture-erh.sql", fixtureContract)
      ),
    /split invariant failed/
  );
});
