import {
  erhMoney,
  format as formatScaledUnits,
  parse as parseScaledUnits
} from "@ehq/domain-finance";
import type {
  CurrencyCode,
  DistributionImportPreviewRowResult
} from "@ehq/api-client";
import type { ApiImportPreviewRow } from "./persistence.js";

export type DistributionImportSource = "kontor" | "routenote";

interface ParsedDistributionImportRow {
  readonly row: ApiImportPreviewRow;
  readonly currency: CurrencyCode;
  readonly grossAmount: string;
}

interface DistributionColumnProfile {
  readonly amountKeys: readonly string[];
  readonly currencyKeys: readonly string[];
  readonly titleKeys: readonly string[];
  readonly artistKeys: readonly string[];
  readonly isrcKeys: readonly string[];
  readonly upcKeys: readonly string[];
  readonly quantityKeys: readonly string[];
}

export interface DistributionImportParsePreview {
  readonly rows: readonly ApiImportPreviewRow[];
  readonly acceptedRowCount: number;
  readonly rejectedRowCount: number;
  readonly rowResults: readonly DistributionImportPreviewRowResult[];
  readonly currencyCodes: readonly CurrencyCode[];
  readonly joinKeys: readonly string[];
  readonly payableMicro: string;
  readonly warnings: readonly string[];
}

const GENERAL_AMOUNT_KEYS: readonly string[] = [
  "amount",
  "gross amount",
  "gross",
  "earnings",
  "net earnings",
  "royalty",
  "revenue"
];

const GENERAL_CURRENCY_KEYS: readonly string[] = [
  "currency",
  "currency code",
  "currency_code"
];

const GENERAL_TITLE_KEYS: readonly string[] = [
  "title",
  "song title",
  "track title",
  "track"
];

const GENERAL_ARTIST_KEYS: readonly string[] = [
  "artist",
  "artist name",
  "performer"
];

const GENERAL_ISRC_KEYS: readonly string[] = ["isrc"];
const GENERAL_UPC_KEYS: readonly string[] = ["upc", "ean"];
const GENERAL_QUANTITY_KEYS: readonly string[] = ["quantity", "units", "streams", "downloads"];

const KONTOR_PROFILE: DistributionColumnProfile = {
  amountKeys: ["amount eur", "amount usd", "gross payout", ...GENERAL_AMOUNT_KEYS],
  currencyKeys: ["currency", "curr", ...GENERAL_CURRENCY_KEYS],
  titleKeys: ["title", "song", "track", ...GENERAL_TITLE_KEYS],
  artistKeys: ["artist", "main artist", ...GENERAL_ARTIST_KEYS],
  isrcKeys: [...GENERAL_ISRC_KEYS],
  upcKeys: [...GENERAL_UPC_KEYS],
  quantityKeys: [...GENERAL_QUANTITY_KEYS]
};

const ROUTENOTE_PROFILE: DistributionColumnProfile = {
  amountKeys: ["earnings", "net earnings", "royalty", "royalty amount", ...GENERAL_AMOUNT_KEYS],
  currencyKeys: ["currency", "currency code", ...GENERAL_CURRENCY_KEYS],
  titleKeys: ["track name", "title", ...GENERAL_TITLE_KEYS],
  artistKeys: ["artist name", "artist", ...GENERAL_ARTIST_KEYS],
  isrcKeys: [...GENERAL_ISRC_KEYS],
  upcKeys: [...GENERAL_UPC_KEYS],
  quantityKeys: [...GENERAL_QUANTITY_KEYS]
};

export function parseDistributionImportPreview(
  source: DistributionImportSource,
  rows: readonly Readonly<Record<string, string>>[]
): DistributionImportParsePreview {
  const previewRows = toPreviewRows(rows);
  const profile = source === "kontor" ? KONTOR_PROFILE : ROUTENOTE_PROFILE;

  const acceptedRows: ParsedDistributionImportRow[] = [];
  const rowResults: DistributionImportPreviewRowResult[] = [];
  const joinKeySourceRows: Readonly<Record<string, string>>[] = [];
  const currencyCodes = new Set<CurrencyCode>();

  for (const previewRow of previewRows) {
    const parsed = parseRow(profile, previewRow);
    if (parsed === null) {
      rowResults.push({
        id: previewRow.id,
        rowNumber: previewRow.rowNumber,
        status: "rejected",
        issues: [
          "amount_or_currency_missing",
          "title_or_identifier_missing"
        ]
      });
      continue;
    }

    acceptedRows.push(parsed);
    joinKeySourceRows.push(previewRow.rawData);
    currencyCodes.add(parsed.currency);
    rowResults.push({
      id: previewRow.id,
      rowNumber: previewRow.rowNumber,
      status: "accepted",
      issues: []
    });
  }

  const rejectedRowCount = previewRows.length - acceptedRows.length;
  const warnings = buildWarnings(source, rejectedRowCount, previewRows.length);
  const payableMicro = erhMoney.format(
    acceptedRows.reduce(
      (sum: bigint, parsed: ParsedDistributionImportRow): bigint =>
        erhMoney.add(sum, erhMoney.parse(parsed.grossAmount)),
      0n
    )
  );

  return {
    rows: previewRows,
    acceptedRowCount: acceptedRows.length,
    rejectedRowCount,
    rowResults,
    currencyCodes: [...currencyCodes],
    joinKeys: joinKeysFromRows(joinKeySourceRows),
    payableMicro,
    warnings
  };
}

function toPreviewRows(
  rows: readonly Readonly<Record<string, string>>[]
): readonly ApiImportPreviewRow[] {
  return rows.map(
    (row: Readonly<Record<string, string>>, index: number): ApiImportPreviewRow => ({
      id: `row_${String(index + 1)}`,
      rowNumber: index + 1,
      rawData: row
    })
  );
}

function parseRow(
  profile: DistributionColumnProfile,
  row: ApiImportPreviewRow
): ParsedDistributionImportRow | null {
  const amountValue = rowValue(row.rawData, profile.amountKeys);
  const currency = normalizedCurrency(rowValue(row.rawData, profile.currencyKeys));

  const isrc = normalizeIdentifier(rowValue(row.rawData, profile.isrcKeys));
  const upc = normalizeIdentifier(rowValue(row.rawData, profile.upcKeys));
  const title = nonEmptyValue(rowValue(row.rawData, profile.titleKeys));
  const artist = nonEmptyValue(rowValue(row.rawData, profile.artistKeys));

  const hasTrackIdentity = title !== null || artist !== null || isrc !== null || upc !== null;
  if (!hasTrackIdentity) {
    return null;
  }

  if (currency === null) {
    return null;
  }

  const grossAmount = parseErhAmount(amountValue);
  if (grossAmount === null) {
    return null;
  }

  const quantityValue = rowValue(row.rawData, profile.quantityKeys);
  const quantity = parseQuantity(quantityValue);
  if (quantity === null) {
    return null;
  }

  void quantity;
  return {
    row,
    currency,
    grossAmount
  };
}

function parseErhAmount(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = normalizeDecimalText(value);
  if (normalized === null) {
    return null;
  }

  try {
    return erhMoney.format(erhMoney.parse(normalized));
  } catch {
    return null;
  }
}

function parseQuantity(value: string | null): string | null {
  if (value === null) {
    return "1.000000";
  }

  const normalized = normalizeDecimalText(value);
  if (normalized === null) {
    return null;
  }

  try {
    const units = parseScaledUnits(normalized, 6, "TRUNCATE");
    if (units < 0n) {
      return null;
    }

    return formatScaledUnits(units, 6);
  } catch {
    return null;
  }
}

function normalizeDecimalText(value: string): string | null {
  const compact = value.trim().replace(/,/gu, "");
  if (compact.length === 0) {
    return null;
  }

  if (!/^[+-]?\d+(?:\.\d+)?$/u.test(compact)) {
    return null;
  }

  return compact;
}

function rowValue(
  row: Readonly<Record<string, string>>,
  candidateKeys: readonly string[]
): string | null {
  const normalizedCandidates = new Set<string>(candidateKeys.map(normalizeColumnKey));
  for (const [key, value] of Object.entries(row)) {
    if (!normalizedCandidates.has(normalizeColumnKey(key))) {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

function normalizeColumnKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function normalizedCurrency(value: string | null): CurrencyCode | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (/^[A-Z]{3}$/u.test(normalized)) {
    return normalized as CurrencyCode;
  }

  return null;
}

function normalizeIdentifier(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/gu, "");
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function nonEmptyValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function joinKeysFromRows(rows: readonly Readonly<Record<string, string>>[]): readonly string[] {
  const normalizedKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      normalizedKeys.add(normalizeColumnKey(key));
    }
  }

  const keys: string[] = [];
  if (normalizedKeys.has("isrc")) {
    keys.push("ISRC");
  }

  if (normalizedKeys.has("upc") || normalizedKeys.has("ean")) {
    keys.push("UPC/EAN");
  }

  if (normalizedKeys.has("title") || normalizedKeys.has("tracktitle") || normalizedKeys.has("trackname")) {
    keys.push("title");
  }

  if (normalizedKeys.has("artist") || normalizedKeys.has("artistname")) {
    keys.push("artist");
  }

  return keys.length === 0 ? ["raw_row"] : keys;
}

function buildWarnings(
  source: DistributionImportSource,
  rejectedRowCount: number,
  totalRowCount: number
): readonly string[] {
  const warnings: string[] = [];

  if (rejectedRowCount > 0) {
    warnings.push(
      `${String(rejectedRowCount)} row(s) were rejected during ${source} parser preflight because required amount/currency/identity fields were missing or invalid.`
    );
  }

  if (rejectedRowCount === totalRowCount && totalRowCount > 0) {
    warnings.push("No parseable rows were found. Verify file columns before confirming import.");
  }

  return warnings;
}
