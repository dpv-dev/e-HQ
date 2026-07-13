// Bank-statement parsing, ported from the WordPress e-office-financial PHP parsers
// (class-eof-pdf-parser-bank-statement-sbi, BankParsers, BankImporter).
// Pure functions: text -> structured rows. No DOM, no framework — easy to test and reuse.
// PDF text extraction (pdftotext-equivalent) happens upstream (e.g. pdf.js in the browser)
// and is fed here as the `text` argument.

export type BankDirection = "debit" | "credit";

export interface ParsedBankRow {
  readonly date: string; // ISO "YYYY-MM-DD"
  readonly description: string;
  readonly amount: number; // positive magnitude, 2 decimals
  readonly direction: BankDirection;
  readonly directionConfidence: "high" | "low";
  readonly balance: number | null;
  readonly reference: string | null;
}

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

// Parse money exactly into integer minor units. The public parser still exposes
// numbers for UI compatibility, but only after a safe-integer boundary check.
function parseAmountMinor(input: string): bigint | null {
  if (input.trim().length === 0) {
    return null;
  }

  let value = input.trim();
  let negative = false;

  const parenMatch = value.match(/^\((.*)\)$/u);
  if (parenMatch !== null && parenMatch[1] !== undefined) {
    value = parenMatch[1];
    negative = true;
  }

  value = value.replace(/[^0-9.\-,]/gu, "");

  if (/^\d{1,3}(\.\d{3})+,\d+$/u.test(value)) {
    // European: 1.234,56
    value = value.replace(/\./gu, "").replace(",", ".");
  } else if ((value.match(/,/gu)?.length ?? 0) === 1 && !value.includes(".")) {
    // Single comma, no dot -> decimal comma
    value = value.replace(",", ".");
  } else {
    // US/UK: commas are thousands separators
    value = value.replace(/,/gu, "");
  }

  if (value.length === 0 || value === "-") {
    return null;
  }

  const signedMatch = value.match(/^(-?)(\d*)(?:\.(\d*))?$/u);
  if (signedMatch === null || signedMatch[2] === undefined) {
    return null;
  }

  const wholeDigits = signedMatch[2];
  const fractionDigits = signedMatch[3] ?? "";
  if (wholeDigits.length === 0 && fractionDigits.length === 0) {
    return null;
  }

  const wholeMinor = BigInt(wholeDigits.length > 0 ? wholeDigits : "0") * 100n;
  const paddedFraction = `${fractionDigits}00`;
  let absoluteMinor = wholeMinor + BigInt(paddedFraction.slice(0, 2));
  if ((fractionDigits[2] ?? "0") >= "5") {
    absoluteMinor += 1n;
  }

  const lexicalSign = signedMatch[1] === "-" ? -1n : 1n;
  const sign = negative ? -lexicalSign : lexicalSign;
  return sign * absoluteMinor;
}

function minorUnitsToNumber(minor: bigint): number | null {
  if (minor > MAX_SAFE_MINOR_UNITS || minor < -MAX_SAFE_MINOR_UNITS) {
    return null;
  }
  return Number(minor) / 100;
}

function absMinor(minor: bigint): bigint {
  return minor < 0n ? -minor : minor;
}

// Parse an amount string (US "1,234.56" or European "1.234,56", parentheses = negative).
export function parseAmount(input: string): number | null {
  const minor = parseAmountMinor(input);
  return minor === null ? null : minorUnitsToNumber(minor);
}

// Parse a date string into ISO "YYYY-MM-DD". Supports SBI "11,Sep,2024", ISO,
// DD/MM/YYYY and DD/MM/YY. Returns null when unparseable.
export function parseDate(input: string): string | null {
  const value = input.trim();
  if (value.length === 0) {
    return null;
  }

  const sbi = value.match(/^(\d{1,2})\s*,\s*([A-Za-z]{3,})\s*,\s*(\d{4})$/u);
  if (sbi !== null && sbi[1] !== undefined && sbi[2] !== undefined && sbi[3] !== undefined) {
    const month = MONTHS[sbi[2].slice(0, 3).toLowerCase()];
    if (month === undefined) {
      return null;
    }
    return `${sbi[3]}-${pad2(month)}-${pad2(Number.parseInt(sbi[1], 10))}`;
  }

  if (/^\d{4}-\d{2}-\d{2}/u.test(value)) {
    return value.slice(0, 10);
  }

  const dmy = value.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/u);
  if (dmy !== null && dmy[1] !== undefined && dmy[2] !== undefined && dmy[3] !== undefined) {
    return `${dmy[3]}-${pad2(Number.parseInt(dmy[2], 10))}-${pad2(Number.parseInt(dmy[1], 10))}`;
  }

  const dmyShort = value.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$/u);
  if (dmyShort !== null && dmyShort[1] !== undefined && dmyShort[2] !== undefined && dmyShort[3] !== undefined) {
    const year = 2000 + Number.parseInt(dmyShort[3], 10);
    return `${year}-${pad2(Number.parseInt(dmyShort[2], 10))}-${pad2(Number.parseInt(dmyShort[1], 10))}`;
  }

  return null;
}

// An SBI transaction's anchor line: date, then particulars/instrument text, then the
// debit OR credit amount, then the running balance (the empty debit/credit column is
// whitespace, so the last two numbers are always amount + balance).
const SBI_DATE_LINE = /^\s*(\d{1,2},[A-Za-z]{3,9},\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/u;
const SBI_FIXED_DATE_LINE = /^\s*(\d{1,2}-\d{1,2}-\d{4})\b/u;
const MONEY_TOKEN = /[0-9][0-9,]*\.[0-9]{2}/gu;

interface MoneyToken {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

interface StatementDraftRow {
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  reference: string | null;
}

interface SbiStatementDraftRow {
  readonly date: string;
  readonly description: string;
  readonly amountMinor: bigint;
  readonly balanceMinor: bigint | null;
  readonly reference: string | null;
}

// Parse SBI / SBM Mauritius bank-statement text (pdftotext -layout output) into rows.
// The layout wraps each transaction's particulars ACROSS the date line (text above and
// below it), with blank lines separating transactions — so we parse block by block:
// each blank-line-delimited block contributes at most one transaction. Page headers and
// footers form their own blocks with no date line and are skipped. Debit vs credit is
// recovered from the running-balance movement (assignDirections).
export function parseSbiStatementText(text: string): readonly ParsedBankRow[] {
  const fixedRows = parseFixedSbiStatementText(text);
  if (fixedRows.length > 0) {
    return fixedRows;
  }

  const drafts: SbiStatementDraftRow[] = [];
  for (const block of splitIntoBlocks(text)) {
    const draft = sbiDraftFromBlock(block);
    if (draft !== null) {
      drafts.push(draft);
    }
  }
  return assignDirections(drafts);
}

// SBI corporate statements expose explicit withdrawal/deposit columns. Read the
// amount's fixed position instead of guessing direction from neighbouring rows.
function parseFixedSbiStatementText(text: string): readonly ParsedBankRow[] {
  const rows: ParsedBankRow[] = [];
  let chequeColumn: number | null = null;
  let withdrawalsColumn: number | null = null;
  let depositsColumn: number | null = null;
  let fixedHeaderDetected = false;

  for (const rawLine of text.split(/\r\n|\r|\n/u)) {
    const upper = rawLine.toUpperCase();
    if (
      upper.includes("PARTICULARS") &&
      upper.includes("WITHDRAWALS") &&
      upper.includes("DEPOSITS") &&
      upper.includes("BALANCE")
    ) {
      fixedHeaderDetected = true;
      chequeColumn = positiveColumn(upper.indexOf("CHQ.NO."));
      withdrawalsColumn = positiveColumn(upper.indexOf("WITHDRAWALS"));
      depositsColumn = positiveColumn(upper.indexOf("DEPOSITS"));
      continue;
    }

    if (!fixedHeaderDetected || depositsColumn === null) {
      continue;
    }

    const dateMatch = rawLine.match(SBI_FIXED_DATE_LINE);
    if (dateMatch === null || dateMatch[1] === undefined) {
      continue;
    }

    const tokens = moneyTokens(rawLine);
    if (tokens.length === 1 && /\bB\s*\/\s*F\b/iu.test(rawLine)) {
      continue;
    }
    if (tokens.length < 2) {
      continue;
    }

    const amountToken = tokens[tokens.length - 2];
    const balanceToken = tokens[tokens.length - 1];
    const date = parseDate(dateMatch[1]);
    const amountMinor = amountToken === undefined ? null : parseAmountMinor(amountToken.text);
    const balanceMinor = balanceToken === undefined ? null : signedBalanceMinor(rawLine, balanceToken);
    if (date === null || amountMinor === null || balanceMinor === null || amountToken === undefined) {
      continue;
    }

    const amount = minorUnitsToNumber(absMinor(amountMinor));
    const balance = minorUnitsToNumber(balanceMinor);
    if (amount === null || balance === null) {
      continue;
    }

    const details = fixedSbiDetails(
      rawLine,
      dateMatch[0].length,
      amountToken.start,
      chequeColumn,
      withdrawalsColumn
    );
    rows.push({
      date,
      description: details.description,
      amount,
      direction: amountToken.end >= depositsColumn ? "credit" : "debit",
      directionConfidence: "high",
      balance,
      reference: details.reference
    });
  }

  return rows;
}

function positiveColumn(index: number): number | null {
  return index >= 0 ? index : null;
}

function moneyTokens(line: string): readonly MoneyToken[] {
  return [...line.matchAll(MONEY_TOKEN)].flatMap((match: RegExpMatchArray): readonly MoneyToken[] => {
    const text = match[0];
    const start = match.index;
    return text === undefined || start === undefined
      ? []
      : [{ text, start, end: start + text.length }];
  });
}

function signedBalanceMinor(line: string, token: MoneyToken): bigint | null {
  const amountMinor = parseAmountMinor(token.text);
  if (amountMinor === null) {
    return null;
  }
  const marker = line.slice(token.end).match(/^\s*(Dr|Cr)\b/iu)?.[1]?.toLowerCase();
  return marker === "dr" ? -absMinor(amountMinor) : absMinor(amountMinor);
}

function fixedSbiDetails(
  line: string,
  dateEnd: number,
  amountStart: number,
  chequeColumn: number | null,
  withdrawalsColumn: number | null
): { readonly description: string; readonly reference: string | null } {
  const detailsEnd = Math.min(amountStart, withdrawalsColumn ?? amountStart);
  const safeChequeColumn = chequeColumn !== null && chequeColumn > dateEnd && chequeColumn < detailsEnd
    ? chequeColumn
    : null;
  const descriptionSlice = line.slice(dateEnd, safeChequeColumn ?? detailsEnd).trim();
  const referenceSlice = safeChequeColumn === null
    ? ""
    : line.slice(safeChequeColumn, detailsEnd).trim();
  const reference = /^[A-Z0-9][A-Z0-9./-]{3,}$/iu.test(referenceSlice)
    ? referenceSlice
    : null;
  const description = [descriptionSlice, reference === null ? referenceSlice : ""]
    .filter((part: string): boolean => part.length > 0)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
  return { description, reference };
}

// Group non-empty lines into blocks delimited by blank lines.
function splitIntoBlocks(text: string): readonly (readonly string[])[] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const rawLine of text.split(/\r\n|\r|\n/u)) {
    if (rawLine.trim().length === 0) {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(rawLine);
  }
  if (current.length > 0) {
    blocks.push(current);
  }
  return blocks;
}

function sbiDraftFromBlock(block: readonly string[]): SbiStatementDraftRow | null {
  let dateLineIndex = -1;
  let match: RegExpMatchArray | null = null;
  for (let index = 0; index < block.length; index += 1) {
    const candidate = (block[index] ?? "").match(SBI_DATE_LINE);
    if (candidate !== null) {
      match = candidate;
      dateLineIndex = index;
      break;
    }
  }
  if (match === null) {
    return null;
  }

  const dateStr = match[1];
  const midText = match[2];
  const amountStr = match[3];
  const balanceStr = match[4];
  if (dateStr === undefined || amountStr === undefined) {
    return null;
  }
  const date = parseDate(dateStr);
  const amountMinor = parseAmountMinor(amountStr);
  if (date === null || amountMinor === null) {
    return null;
  }

  // Description = every block line (the date line reduced to its middle text), minus the
  // ID line which becomes the reference.
  const parts: string[] = [];
  let reference: string | null = null;
  for (let index = 0; index < block.length; index += 1) {
    const lineText = (index === dateLineIndex ? (midText ?? "") : (block[index] ?? "")).trim();
    if (lineText.length === 0) {
      continue;
    }
    const idMatch = lineText.match(/^ID:\s*(\S+)/iu);
    if (idMatch !== null && idMatch[1] !== undefined) {
      if (reference === null) {
        reference = idMatch[1];
      }
      continue;
    }
    parts.push(lineText);
  }

  return {
    date,
    amountMinor: absMinor(amountMinor),
    balanceMinor: balanceStr !== undefined ? parseAmountMinor(balanceStr) : null,
    description: parts.join(" ").replace(/\s+/gu, " ").trim(),
    reference
  };
}

function assignDirections(drafts: readonly SbiStatementDraftRow[]): readonly ParsedBankRow[] {
  return drafts.flatMap((row: SbiStatementDraftRow, index: number): readonly ParsedBankRow[] => {
    if (row.balanceMinor === null) {
      const parsed = toSbiRow(row, "debit", "low");
      return parsed === null ? [] : [parsed];
    }

    const candidates: bigint[] = [];
    const prev = drafts[index - 1];
    const next = drafts[index + 1];
    if (prev !== undefined && prev.balanceMinor !== null) {
      candidates.push(row.balanceMinor - prev.balanceMinor);
    }
    if (next !== undefined && next.balanceMinor !== null) {
      candidates.push(row.balanceMinor - next.balanceMinor);
    }

    const matched = candidates.find(
      (delta: bigint): boolean => absMinor(absMinor(delta) - row.amountMinor) <= 1n
    );
    if (matched !== undefined) {
      const parsed = toSbiRow(row, matched < 0n ? "debit" : "credit", "high");
      return parsed === null ? [] : [parsed];
    }

    const firstDelta = candidates[0];
    if (firstDelta !== undefined) {
      const parsed = toSbiRow(row, firstDelta > 0n ? "credit" : "debit", "low");
      return parsed === null ? [] : [parsed];
    }

    const parsed = toSbiRow(row, "debit", "low");
    return parsed === null ? [] : [parsed];
  });
}

function toSbiRow(
  row: SbiStatementDraftRow,
  direction: BankDirection,
  confidence: "high" | "low"
): ParsedBankRow | null {
  const amount = minorUnitsToNumber(row.amountMinor);
  const balance = row.balanceMinor === null ? null : minorUnitsToNumber(row.balanceMinor);
  if (amount === null || (row.balanceMinor !== null && balance === null)) {
    return null;
  }
  return {
    date: row.date,
    description: row.description,
    amount,
    direction,
    directionConfidence: confidence,
    balance,
    reference: row.reference
  };
}

function toRow(row: StatementDraftRow, direction: BankDirection, confidence: "high" | "low"): ParsedBankRow {
  return {
    date: row.date,
    description: row.description,
    amount: row.amount,
    direction,
    directionConfidence: confidence,
    balance: row.balance,
    reference: row.reference
  };
}

const MCB_LINE = /^\s*(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/u;

// Parse an MCB (Mauritius) Euro current-account statement (pdftotext -layout output).
// Each transaction line carries a single amount (debit or credit) + running balance;
// the direction is recovered from the sequential balance movement.
export function parseMcbStatementText(text: string): readonly ParsedBankRow[] {
  const lines = text.split(/\r\n|\r|\n/u);
  const drafts: StatementDraftRow[] = [];
  let current: StatementDraftRow | null = null;
  let openingBalance: number | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    const opening = line.match(/^Opening Balance\s+([\d,]+\.\d{2})$/iu);
    if (opening !== null && opening[1] !== undefined) {
      openingBalance = parseAmount(opening[1]);
      continue;
    }

    if (/^Closing Balance/iu.test(line)) {
      if (current !== null) {
        drafts.push(current);
        current = null;
      }
      continue;
    }

    const match = line.match(MCB_LINE);
    if (match !== null && match[1] !== undefined && match[3] !== undefined && match[4] !== undefined) {
      if (current !== null) {
        drafts.push(current);
      }
      const date = parseDate(match[1]);
      const amount = parseAmount(match[3]);
      if (date === null || amount === null) {
        current = null;
        continue;
      }
      current = {
        date,
        amount,
        balance: parseAmount(match[4]),
        description: (match[2] ?? "").trim(),
        reference: null
      };
      continue;
    }

    if (current !== null) {
      current.description = `${current.description} ${line}`.replace(/\s+/gu, " ").trim();
    }
  }

  if (current !== null) {
    drafts.push(current);
  }

  return assignDirectionsSequential(drafts, openingBalance);
}

// Direction from the running balance: a balance lower than the previous one is a debit,
// higher is a credit. High confidence when the movement magnitude equals the printed amount.
function assignDirectionsSequential(
  drafts: readonly StatementDraftRow[],
  openingBalance: number | null
): readonly ParsedBankRow[] {
  let previousBalance = openingBalance;
  return drafts.map((row: StatementDraftRow): ParsedBankRow => {
    const balance = row.balance;
    if (balance === null || previousBalance === null) {
      previousBalance = balance ?? previousBalance;
      return toRow(row, "debit", "low");
    }
    const delta = Math.round((balance - previousBalance) * 100) / 100;
    previousBalance = balance;
    const direction: BankDirection = delta < 0 ? "debit" : "credit";
    const confidence = Math.abs(Math.abs(delta) - row.amount) <= 0.01 ? "high" : "low";
    return toRow(row, direction, confidence);
  });
}

export type BankFormat = "mcb" | "sbi" | "unknown";

// Detect the statement format from extracted text so the right parser is picked.
// SBI/SBM is checked first with layout-specific markers: an MCB-style "mcbl" substring
// also appears inside SBI instrument references, so it must NOT drive MCB detection.
export function detectBankFormat(text: string): BankFormat {
  const lower = text.toLowerCase();
  if (
    lower.includes("transactions list") ||
    lower.includes("particulars") ||
    lower.includes("instrument id") ||
    lower.includes("txn date") ||
    lower.includes("narration") ||
    lower.includes("sbi (mauritius)") ||
    lower.includes("sbi mauritius") ||
    lower.includes("state bank") ||
    lower.includes("sbm")
  ) {
    return "sbi";
  }
  if (lower.includes("current account statement") || /mcbl09\d/u.test(lower)) {
    return "mcb";
  }
  return "unknown";
}

// Detect the format then parse with the matching parser.
export function parseBankStatement(text: string): readonly ParsedBankRow[] {
  return detectBankFormat(text) === "mcb" ? parseMcbStatementText(text) : parseSbiStatementText(text);
}

// Read the statement currency from the header (e.g. "Currency : EUR" / "Currency : MUR").
// EUR and MUR statements share the same layout — only the printed currency differs.
export function detectStatementCurrency(text: string): string {
  const labelled = text.match(/Currency\s*:?\s*([A-Za-z]{3})/u);
  if (labelled !== null && labelled[1] !== undefined) {
    return labelled[1].toUpperCase();
  }
  if (/\bEUR\b/u.test(text)) {
    return "EUR";
  }
  return "MUR";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// --- CSV bank statements ------------------------------------------------------
// Header-driven, generic parser for CSV exports (e.g. the SBI MUR export
// "Date,Description,Debit,Credit,Currency,Status"). Columns are matched by header
// name, the date orientation (D/M vs M/D) is auto-detected, and debit/credit
// columns (or a single signed amount column) give the direction directly.

// Split one CSV line into trimmed cells, honouring RFC-4180 quoting.
function splitCsvLine(line: string): readonly string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char ?? "";
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += char ?? "";
    }
  }
  cells.push(cell);
  return cells.map((value: string): string => value.trim());
}

function headerIndex(header: readonly string[], names: readonly string[]): number {
  for (const name of names) {
    const index = header.indexOf(name);
    if (index >= 0) {
      return index;
    }
  }
  return -1;
}

function cellAt(cells: readonly string[], index: number): string {
  if (index < 0) {
    return "";
  }
  const value = cells[index];
  return value !== undefined ? value : "";
}

// Parse a CSV date. dayFirst=true -> D/M/Y, false -> M/D/Y. Also accepts ISO and 2-digit years.
function parseCsvDate(input: string, dayFirst: boolean): string | null {
  const value = input.trim();
  if (value.length === 0) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}/u.test(value)) {
    return value.slice(0, 10);
  }
  const match = value.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2}|\d{4})$/u);
  if (match === null || match[1] === undefined || match[2] === undefined || match[3] === undefined) {
    return null;
  }
  const first = Number.parseInt(match[1], 10);
  const second = Number.parseInt(match[2], 10);
  const day = dayFirst ? first : second;
  const month = dayFirst ? second : first;
  const yearRaw = Number.parseInt(match[3], 10);
  const year = match[3].length === 2 ? 2000 + yearRaw : yearRaw;
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

// Day-first when any date's first component exceeds 12; month-first when any second
// component does; otherwise default to month-first (US-style exports like SBI).
function detectDayFirstDates(rows: readonly (readonly string[])[], dateIndex: number): boolean {
  for (const cells of rows) {
    const match = cellAt(cells, dateIndex).match(/^(\d{1,2})[/\-](\d{1,2})[/\-]\d{2,4}$/u);
    if (match !== null && match[1] !== undefined && match[2] !== undefined) {
      if (Number.parseInt(match[1], 10) > 12) {
        return true;
      }
      if (Number.parseInt(match[2], 10) > 12) {
        return false;
      }
    }
  }
  return false;
}

// Parse a bank-statement CSV into transaction rows. Returns [] when the header has
// no recognisable date/amount columns (so the caller can fall back / report).
export function parseBankCsv(text: string): readonly ParsedBankRow[] {
  const lines = text.split(/\r\n|\r|\n/u).filter((line: string): boolean => line.trim().length > 0);
  const firstLine = lines[0];
  if (lines.length < 2 || firstLine === undefined) {
    return [];
  }
  const header = splitCsvLine(firstLine).map((value: string): string => value.toLowerCase());

  const dateIndex = headerIndex(header, ["date", "transaction date", "trans date", "value date", "posting date"]);
  const descriptionIndex = headerIndex(header, ["description", "details", "narration", "particulars", "memo", "transaction details"]);
  const debitIndex = headerIndex(header, ["debit", "withdrawal", "dr", "debit amount"]);
  const creditIndex = headerIndex(header, ["credit", "deposit", "cr", "credit amount"]);
  const amountIndex = headerIndex(header, ["amount"]);
  const balanceIndex = headerIndex(header, ["balance", "running balance", "closing balance"]);
  const referenceIndex = headerIndex(header, ["reference", "ref", "transaction id", "cheque", "cheque no"]);
  if (dateIndex < 0 || (debitIndex < 0 && creditIndex < 0 && amountIndex < 0)) {
    return [];
  }

  const dataRows = lines.slice(1).map(splitCsvLine);
  const dayFirst = detectDayFirstDates(dataRows, dateIndex);

  const rows: ParsedBankRow[] = [];
  for (const cells of dataRows) {
    const date = parseCsvDate(cellAt(cells, dateIndex), dayFirst);
    if (date === null) {
      continue;
    }

    const debit = debitIndex >= 0 ? parseAmount(cellAt(cells, debitIndex)) : null;
    const credit = creditIndex >= 0 ? parseAmount(cellAt(cells, creditIndex)) : null;

    let amount: number | null = null;
    let direction: BankDirection = "debit";
    if (credit !== null && credit !== 0 && (debit === null || debit === 0)) {
      amount = credit;
      direction = "credit";
    } else if (debit !== null && debit !== 0) {
      amount = debit;
      direction = "debit";
    } else if (amountIndex >= 0) {
      const signed = parseAmount(cellAt(cells, amountIndex));
      if (signed !== null && signed !== 0) {
        amount = Math.abs(signed);
        direction = signed < 0 ? "debit" : "credit";
      }
    }
    if (amount === null || amount === 0) {
      continue;
    }

    const reference = referenceIndex >= 0 ? cellAt(cells, referenceIndex) : "";
    rows.push({
      date,
      description: cellAt(cells, descriptionIndex),
      amount: Math.abs(amount),
      direction,
      directionConfidence: "high",
      balance: balanceIndex >= 0 ? parseAmount(cellAt(cells, balanceIndex)) : null,
      reference: reference.length > 0 ? reference : null
    });
  }
  return rows;
}

// Parse a CSV into header-keyed records (generic — for imports like cashflow that send
// raw records to the API for server-side parsing).
export function parseCsvRecords(text: string): readonly Readonly<Record<string, string>>[] {
  const lines = text.split(/\r\n|\r|\n/u).filter((line: string): boolean => line.trim().length > 0);
  const firstLine = lines[0];
  if (lines.length < 2 || firstLine === undefined) {
    return [];
  }
  const header = splitCsvLine(firstLine);
  return lines.slice(1).map((line: string): Readonly<Record<string, string>> => {
    const cells = splitCsvLine(line);
    const record: Record<string, string> = {};
    for (let index = 0; index < header.length; index += 1) {
      const key = header[index];
      if (key !== undefined && key.length > 0) {
        record[key] = cells[index] ?? "";
      }
    }
    return record;
  });
}

// Read the statement currency from a CSV "Currency" column (first valid 3-letter code).
export function detectCsvCurrency(text: string): string | null {
  const lines = text.split(/\r\n|\r|\n/u).filter((line: string): boolean => line.trim().length > 0);
  const firstLine = lines[0];
  if (lines.length < 2 || firstLine === undefined) {
    return null;
  }
  const header = splitCsvLine(firstLine).map((value: string): string => value.toLowerCase());
  const currencyIndex = headerIndex(header, ["currency", "ccy", "currency code"]);
  if (currencyIndex < 0) {
    return null;
  }
  for (const line of lines.slice(1)) {
    const value = cellAt(splitCsvLine(line), currencyIndex).toUpperCase();
    if (/^[A-Z]{3}$/u.test(value)) {
      return value;
    }
  }
  return null;
}
