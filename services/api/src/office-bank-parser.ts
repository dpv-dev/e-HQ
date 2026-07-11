import { eofMoney } from "@ehq/domain-finance";

export type OfficeBankParseSource = "sbi" | "mcb" | "csv";

interface ParsedBankRow {
  readonly date: string;
  readonly description: string;
  readonly amountMinor: bigint;
  readonly direction: "debit" | "credit";
  readonly balanceMinor: bigint | null;
  readonly reference: string | null;
}

interface StatementDraftRow {
  readonly date: string;
  readonly description: string;
  readonly amountMinor: bigint;
  readonly balanceMinor: bigint | null;
  readonly reference: string | null;
}

export interface OfficeBankParseInput {
  readonly text: string;
  readonly fileName: string;
  readonly sourceHint: "sbi" | "mcb" | "csv" | "pdf" | null;
}

export interface OfficeBankParseOutput {
  readonly source: OfficeBankParseSource;
  readonly currency: string;
  readonly parsedRowCount: number;
  readonly rows: readonly Readonly<Record<string, string>>[];
  readonly parsingNotes: readonly string[];
}

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

const SBI_DATE_LINE =
  /^\s*(\d{1,2},[A-Za-z]{3,9},\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/u;

const MCB_LINE =
  /^\s*(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/u;

export function parseOfficeBankImportText(input: OfficeBankParseInput): OfficeBankParseOutput {
  const parseAsCsv =
    input.sourceHint === "csv" ||
    input.fileName.trim().toLowerCase().endsWith(".csv");

  if (parseAsCsv) {
    const rows = parseBankCsv(input.text);
    const currency = detectCsvCurrency(input.text) ?? "MUR";
    return {
      source: "csv",
      currency,
      parsedRowCount: rows.length,
      rows: rows.map((row: ParsedBankRow): Readonly<Record<string, string>> =>
        bankRowToRecord(row, currency)
      ),
      parsingNotes: [
        "Parsed on API from CSV content and normalized before import preview."
      ]
    };
  }

  const source =
    input.sourceHint === "mcb" || input.sourceHint === "sbi"
      ? input.sourceHint
      : detectBankFormat(input.text) === "mcb"
        ? "mcb"
        : "sbi";
  const rows =
    source === "mcb"
      ? parseMcbStatementText(input.text)
      : parseSbiStatementText(input.text);
  const currency = detectStatementCurrency(input.text);

  return {
    source,
    currency,
    parsedRowCount: rows.length,
    rows: rows.map((row: ParsedBankRow): Readonly<Record<string, string>> =>
      bankRowToRecord(row, currency)
    ),
    parsingNotes: [
      "Parsed on API from extracted statement text and normalized before import preview."
    ]
  };
}

function bankRowToRecord(
  row: ParsedBankRow,
  currency: string
): Readonly<Record<string, string>> {
  const record: Record<string, string> = {
    transactionDate: row.date,
    description: row.description,
    currency
  };

  record[row.direction] = eofMoney.format(absBigInt(row.amountMinor));
  if (row.balanceMinor !== null) {
    record.balance = eofMoney.format(row.balanceMinor);
  }
  if (row.reference !== null) {
    record.reference = row.reference;
  }

  return record;
}

function parseAmountUnits(input: string): bigint | null {
  const cleaned = cleanMoneyText(input);
  if (cleaned.length === 0 || cleaned === "-" || cleaned === "+") {
    return null;
  }

  try {
    return eofMoney.parse(cleaned);
  } catch {
    return null;
  }
}

function parseDate(input: string): string | null {
  const value = input.trim();
  if (value.length === 0) {
    return null;
  }

  const sbi = value.match(/^([0-9]{1,2})\s*,\s*([A-Za-z]{3,})\s*,\s*([0-9]{4})$/u);
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
  if (
    dmyShort !== null &&
    dmyShort[1] !== undefined &&
    dmyShort[2] !== undefined &&
    dmyShort[3] !== undefined
  ) {
    const year = 2000 + Number.parseInt(dmyShort[3], 10);
    return `${year}-${pad2(Number.parseInt(dmyShort[2], 10))}-${pad2(Number.parseInt(dmyShort[1], 10))}`;
  }

  return null;
}

function parseSbiStatementText(text: string): readonly ParsedBankRow[] {
  const drafts: StatementDraftRow[] = [];
  for (const block of splitIntoBlocks(text)) {
    const draft = sbiDraftFromBlock(block);
    if (draft !== null) {
      drafts.push(draft);
    }
  }

  return assignDirectionsByNeighbors(drafts);
}

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

function sbiDraftFromBlock(block: readonly string[]): StatementDraftRow | null {
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
  const middleText = match[2];
  const amountStr = match[3];
  const balanceStr = match[4];
  if (dateStr === undefined || amountStr === undefined) {
    return null;
  }

  const date = parseDate(dateStr);
  const amountMinor = parseAmountUnits(amountStr);
  if (date === null || amountMinor === null) {
    return null;
  }

  const parts: string[] = [];
  let reference: string | null = null;
  for (let index = 0; index < block.length; index += 1) {
    const lineText =
      index === dateLineIndex ? (middleText ?? "").trim() : (block[index] ?? "").trim();
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
    amountMinor: absBigInt(amountMinor),
    balanceMinor: balanceStr !== undefined ? parseAmountUnits(balanceStr) : null,
    description: parts.join(" ").replace(/\s+/gu, " ").trim(),
    reference
  };
}

function assignDirectionsByNeighbors(
  drafts: readonly StatementDraftRow[]
): readonly ParsedBankRow[] {
  return drafts.map((row: StatementDraftRow, index: number): ParsedBankRow => {
    if (row.balanceMinor === null) {
      return toRow(row, "debit");
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
      (delta: bigint): boolean => absBigInt(absBigInt(delta) - row.amountMinor) <= 1n
    );
    if (matched !== undefined) {
      return toRow(row, matched < 0n ? "debit" : "credit");
    }

    const firstDelta = candidates[0];
    if (firstDelta !== undefined) {
      return toRow(row, firstDelta > 0n ? "credit" : "debit");
    }

    return toRow(row, "debit");
  });
}

function parseMcbStatementText(text: string): readonly ParsedBankRow[] {
  const lines = text.split(/\r\n|\r|\n/u);
  const drafts: StatementDraftRow[] = [];
  let current: StatementDraftRow | null = null;
  let openingBalanceMinor: bigint | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    const opening = line.match(/^Opening Balance\s+([\d,]+\.\d{2})$/iu);
    if (opening !== null && opening[1] !== undefined) {
      openingBalanceMinor = parseAmountUnits(opening[1]);
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
    if (
      match !== null &&
      match[1] !== undefined &&
      match[3] !== undefined &&
      match[4] !== undefined
    ) {
      if (current !== null) {
        drafts.push(current);
      }

      const date = parseDate(match[1]);
      const amountMinor = parseAmountUnits(match[3]);
      if (date === null || amountMinor === null) {
        current = null;
        continue;
      }

      current = {
        date,
        amountMinor: absBigInt(amountMinor),
        balanceMinor: parseAmountUnits(match[4]),
        description: (match[2] ?? "").trim(),
        reference: null
      };
      continue;
    }

    if (current !== null) {
      current = {
        ...current,
        description: `${current.description} ${line}`.replace(/\s+/gu, " ").trim()
      };
    }
  }

  if (current !== null) {
    drafts.push(current);
  }

  return assignDirectionsSequential(drafts, openingBalanceMinor);
}

function assignDirectionsSequential(
  drafts: readonly StatementDraftRow[],
  openingBalanceMinor: bigint | null
): readonly ParsedBankRow[] {
  let previousBalanceMinor = openingBalanceMinor;

  return drafts.map((row: StatementDraftRow): ParsedBankRow => {
    const balanceMinor = row.balanceMinor;
    if (balanceMinor === null || previousBalanceMinor === null) {
      previousBalanceMinor = balanceMinor ?? previousBalanceMinor;
      return toRow(row, "debit");
    }

    const delta = balanceMinor - previousBalanceMinor;
    previousBalanceMinor = balanceMinor;
    return toRow(row, delta < 0n ? "debit" : "credit");
  });
}

function toRow(
  row: StatementDraftRow,
  direction: "debit" | "credit"
): ParsedBankRow {
  return {
    date: row.date,
    description: row.description,
    amountMinor: row.amountMinor,
    direction,
    balanceMinor: row.balanceMinor,
    reference: row.reference
  };
}

type BankFormat = "mcb" | "sbi" | "unknown";

function detectBankFormat(text: string): BankFormat {
  const lower = text.toLowerCase();

  if (
    lower.includes("transactions list") ||
    lower.includes("particulars") ||
    lower.includes("instrument id") ||
    lower.includes("txn date") ||
    lower.includes("narration") ||
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

function detectStatementCurrency(text: string): string {
  const labelled = text.match(/Currency\s*:?\s*([A-Za-z]{3})/u);
  if (labelled !== null && labelled[1] !== undefined) {
    return labelled[1].toUpperCase();
  }

  if (/\bEUR\b/u.test(text)) {
    return "EUR";
  }

  return "MUR";
}

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

function detectDayFirstDates(
  rows: readonly (readonly string[])[],
  dateIndex: number
): boolean {
  for (const cells of rows) {
    const match = cellAt(cells, dateIndex).match(/^([0-9]{1,2})[/\-]([0-9]{1,2})[/\-][0-9]{2,4}$/u);
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

function parseBankCsv(text: string): readonly ParsedBankRow[] {
  const lines = text
    .split(/\r\n|\r|\n/u)
    .filter((line: string): boolean => line.trim().length > 0);
  const firstLine = lines[0];
  if (lines.length < 2 || firstLine === undefined) {
    return [];
  }

  const header = splitCsvLine(firstLine).map((value: string): string =>
    value.toLowerCase()
  );
  const dateIndex = headerIndex(header, [
    "date",
    "transaction date",
    "trans date",
    "value date",
    "posting date"
  ]);
  const descriptionIndex = headerIndex(header, [
    "description",
    "details",
    "narration",
    "particulars",
    "memo",
    "transaction details"
  ]);
  const debitIndex = headerIndex(header, ["debit", "withdrawal", "dr", "debit amount"]);
  const creditIndex = headerIndex(header, [
    "credit",
    "deposit",
    "cr",
    "credit amount"
  ]);
  const amountIndex = headerIndex(header, ["amount"]);
  const balanceIndex = headerIndex(header, ["balance", "running balance", "closing balance"]);
  const referenceIndex = headerIndex(header, [
    "reference",
    "ref",
    "transaction id",
    "cheque",
    "cheque no"
  ]);

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

    const debit = debitIndex >= 0 ? parseAmountUnits(cellAt(cells, debitIndex)) : null;
    const credit = creditIndex >= 0 ? parseAmountUnits(cellAt(cells, creditIndex)) : null;

    let amountMinor: bigint | null = null;
    let direction: "debit" | "credit" = "debit";

    if (credit !== null && credit !== 0n && (debit === null || debit === 0n)) {
      amountMinor = absBigInt(credit);
      direction = "credit";
    } else if (debit !== null && debit !== 0n) {
      amountMinor = absBigInt(debit);
      direction = "debit";
    } else if (amountIndex >= 0) {
      const signed = parseAmountUnits(cellAt(cells, amountIndex));
      if (signed !== null && signed !== 0n) {
        amountMinor = absBigInt(signed);
        direction = signed < 0n ? "debit" : "credit";
      }
    }

    if (amountMinor === null || amountMinor === 0n) {
      continue;
    }

    const reference = referenceIndex >= 0 ? cellAt(cells, referenceIndex) : "";
    rows.push({
      date,
      description: cellAt(cells, descriptionIndex),
      amountMinor,
      direction,
      balanceMinor: balanceIndex >= 0 ? parseAmountUnits(cellAt(cells, balanceIndex)) : null,
      reference: reference.length > 0 ? reference : null
    });
  }

  return rows;
}

function detectCsvCurrency(text: string): string | null {
  const lines = text
    .split(/\r\n|\r|\n/u)
    .filter((line: string): boolean => line.trim().length > 0);
  const firstLine = lines[0];
  if (lines.length < 2 || firstLine === undefined) {
    return null;
  }

  const header = splitCsvLine(firstLine).map((value: string): string =>
    value.toLowerCase()
  );
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

function cleanMoneyText(value: string): string {
  const original = value.trim();
  if (original.length === 0) {
    return "";
  }

  let sign = "";
  let trimmed = original;

  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    sign = "-";
    trimmed = trimmed.slice(1, -1).trim();
  }

  if (trimmed.startsWith("+")) {
    trimmed = trimmed.slice(1).trim();
  } else if (trimmed.startsWith("-")) {
    sign = "-";
    trimmed = trimmed.slice(1).trim();
  }

  const compacted = trimmed
    .replaceAll(/\u00a0/g, "")
    .replaceAll(" ", "")
    .replace(/[^0-9.,]/gu, "");

  if (compacted.length === 0) {
    return "";
  }

  const lastComma = compacted.lastIndexOf(",");
  const lastDot = compacted.lastIndexOf(".");

  if (lastComma === -1 && lastDot === -1) {
    return `${sign}${compacted}`;
  }

  if (lastComma === -1) {
    return `${sign}${compacted.replace(/,/gu, "")}`;
  }

  if (lastDot === -1) {
    const decimalPart = compacted.slice(lastComma + 1);
    const integerWithGroup = compacted.slice(0, lastComma);
    const integerGroups = integerWithGroup.split(",");

    if (
      decimalPart.length > 0 &&
      decimalPart.length <= 2 &&
      integerGroups.every((group: string, groupIndex: number): boolean =>
        groupIndex === 0
          ? group.length >= 1 && group.length <= 3
          : group.length === 3
      )
    ) {
      return `${sign}${integerWithGroup.replace(/,/gu, "")}.${decimalPart}`;
    }

    return `${sign}${compacted.replace(/,/gu, "")}`;
  }

  if (lastComma > lastDot) {
    return `${sign}${compacted.slice(0, lastComma).replace(/,/gu, "")}.${compacted.slice(lastComma + 1)}`;
  }

  return `${sign}${compacted.replace(/,/gu, "")}`;
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
