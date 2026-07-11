import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectCsvCurrency,
  detectStatementCurrency,
  parseBankCsv,
  parseBankStatement
} from "../../../apps/hq/src/app/bank-parser.ts";
import { parseOfficeBankImportText } from "../src/office-bank-parser.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const casesPath = path.resolve(repoRoot, "services/api/test/fixtures/parser-parity/cases.json");
const outputPath = path.resolve(repoRoot, "services/api/output/parser-parity-report.json");

function frontendRowToRecord(row, currency) {
  const record = {
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

function diffRows(frontend, backend) {
  const diffs = [];
  const max = Math.max(frontend.length, backend.length);
  for (let i = 0; i < max; i += 1) {
    const left = frontend[i] ?? null;
    const right = backend[i] ?? null;
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      diffs.push({ index: i, frontend: left, backend: right });
    }
  }
  return diffs;
}

const raw = await readFile(casesPath, "utf8");
const cases = JSON.parse(raw);

const generatedAt = new Date().toISOString();
const results = [];
let failed = 0;

for (const entry of cases) {
  const frontendCurrency = entry.kind === "csv"
    ? (detectCsvCurrency(entry.text) ?? "MUR")
    : detectStatementCurrency(entry.text);
  const frontendParsed = entry.kind === "csv"
    ? parseBankCsv(entry.text)
    : parseBankStatement(entry.text);
  const frontendRows = frontendParsed.map((row) => frontendRowToRecord(row, frontendCurrency));

  const backend = parseOfficeBankImportText({
    text: entry.text,
    fileName: entry.fileName,
    sourceHint: entry.sourceHint
  });

  const rowDiffs = diffRows(frontendRows, backend.rows);
  const casePassed = frontendCurrency === backend.currency && frontendRows.length === backend.parsedRowCount && rowDiffs.length === 0;
  if (!casePassed) {
    failed += 1;
  }

  results.push({
    id: entry.id,
    fileName: entry.fileName,
    kind: entry.kind,
    sourceHint: entry.sourceHint,
    frontendCurrency,
    backendCurrency: backend.currency,
    frontendRowCount: frontendRows.length,
    backendRowCount: backend.parsedRowCount,
    passed: casePassed,
    rowDiffCount: rowDiffs.length,
    rowDiffs: rowDiffs.slice(0, 20)
  });
}

const report = {
  generatedAt,
  totalCases: results.length,
  failedCases: failed,
  passedCases: results.length - failed,
  results
};

await writeFile(outputPath, JSON.stringify(report, null, 2));

if (failed > 0) {
  console.error(`parser-parity-report: FAILED (${failed}/${results.length} cases)`);
  process.exit(1);
}

console.log(`parser-parity-report: ok (${results.length} cases) -> ${outputPath}`);
