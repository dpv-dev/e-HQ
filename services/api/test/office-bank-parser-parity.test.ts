import assert from "node:assert/strict";
import test from "node:test";
import {
  detectCsvCurrency,
  detectStatementCurrency,
  parseBankCsv,
  parseBankStatement,
  type ParsedBankRow
} from "../../../apps/hq/src/app/bank-parser.ts";
import { parseOfficeBankImportText } from "../src/office-bank-parser.ts";

function frontendRowToRecord(row: ParsedBankRow, currency: string): Readonly<Record<string, string>> {
  const record: Record<string, string> = {
    transactionDate: row.date,
    description: row.description,
    currency,
    [row.direction]: row.amount.toFixed(2)
  };
  if (row.balance !== null) {
    record.balance = row.balance.toFixed(2);
  }
  if (row.reference !== null) {
    record.reference = row.reference;
  }
  return record;
}

test("backend parser parity: CSV normalization matches frontend parser output", () => {
  const csv = [
    "Date,Description,Debit,Credit,Currency,Reference",
    "05/27/2026,CHARGES FOR BILL I,40.00,,MUR,REF-1",
    "05/28/2026,PAYMENT RECEIVED,,125.00,MUR,REF-2"
  ].join("\n");

  const frontendCurrency = detectCsvCurrency(csv) ?? "MUR";
  const frontendRows = parseBankCsv(csv).map((row: ParsedBankRow): Readonly<Record<string, string>> =>
    frontendRowToRecord(row, frontendCurrency)
  );

  const backend = parseOfficeBankImportText({
    text: csv,
    fileName: "sbi-export.csv",
    sourceHint: "csv"
  });

  assert.equal(backend.source, "csv");
  assert.equal(backend.currency, frontendCurrency);
  assert.equal(backend.parsedRowCount, frontendRows.length);
  assert.deepEqual(backend.rows, frontendRows);
});

test("backend parser parity: MCB extracted text normalization matches frontend parser output", () => {
  const statementText = [
    "Current Account Statement",
    "Currency : EUR",
    "Opening Balance 1,000.00",
    "11/02/2026 11/02/2026 PAYMENT RECEIVED 250.00 1,250.00",
    "12/02/2026 12/02/2026 TRANSFER OUT 100.00 1,150.00",
    "Closing Balance 1,150.00"
  ].join("\n");

  const frontendCurrency = detectStatementCurrency(statementText);
  const frontendRows = parseBankStatement(statementText).map((row: ParsedBankRow): Readonly<Record<string, string>> =>
    frontendRowToRecord(row, frontendCurrency)
  );

  const backend = parseOfficeBankImportText({
    text: statementText,
    fileName: "mcb-eur.pdf",
    sourceHint: null
  });

  assert.equal(backend.source, "mcb");
  assert.equal(backend.currency, frontendCurrency);
  assert.equal(backend.parsedRowCount, frontendRows.length);
  assert.deepEqual(backend.rows, frontendRows);
});

test("backend parser parity: SBI extracted text normalization matches frontend parser output", () => {
  const statementText = [
    "Transactions List",
    "Currency : MUR",
    "",
    "11,Sep,2024 TRANSFER INWARD 1,000.00 5,000.00",
    "ID: ABC123",
    "",
    "12,Sep,2024 BILL PAYMENT 200.00 4,800.00",
    "ID: XYZ999"
  ].join("\n");

  const frontendCurrency = detectStatementCurrency(statementText);
  const frontendRows = parseBankStatement(statementText).map((row: ParsedBankRow): Readonly<Record<string, string>> =>
    frontendRowToRecord(row, frontendCurrency)
  );

  const backend = parseOfficeBankImportText({
    text: statementText,
    fileName: "sbi-mur.pdf",
    sourceHint: null
  });

  assert.equal(backend.source, "sbi");
  assert.equal(backend.currency, frontendCurrency);
  assert.equal(backend.parsedRowCount, frontendRows.length);
  assert.deepEqual(backend.rows, frontendRows);
});
