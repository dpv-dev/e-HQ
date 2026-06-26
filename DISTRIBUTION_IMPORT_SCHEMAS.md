# Distribution Import Schemas

Reference for Distribution distributor exports handled through `erh/v1`.
This is a boundary contract for preview/confirm import screens, not a parser or
financial engine implementation.

## Safe Workflow

- Imports are distributor royalty exports only: Kontor CSV and RouteNote XLSX.
- Office owns bank statements, cash flow, and bank reconciliation imports.
- Distribution import writes use `preview` -> `confirm` with an `Idempotency-Key`.
- Unmatched catalogue rows go to suspense with an exact fix path. The UI never
  guesses a catalogue match or creates catalogue facts automatically.
- Money stays in native source currency as integer micro-units. No floats and no
  automatic FX conversion.
- Revenue is grouped by source currency. USD and EUR totals are not merged.

## Universal Matching Keys

Primary matching uses `ISRC` for track identity plus `EAN/UPC` or `UPC/EAN` for
release identity.

Fallback identifiers:

- Kontor: `Art.No.`, `Labelcode`, `GRid`.
- RouteNote: no reliable Channel ID or Asset ID in the sample; both are empty.

## Kontor CSV

Observed sample:

- File: `1180_04_2026Q01_AB4C_738853_001.CSV`
- Customer: `Electrocaine Ltd.`
- Account: `738853-001`
- Statement reference: `1A02610196`
- Statement period: `2026Q01`
- Declared currency: `EUR`
- Rows: `13,385`
- Columns: `39`
- Unique ISRCs: `360`
- Territories: `124`
- Sales periods inside statement: `202510` to `202602`
- Payable source amount: `Royalty Amount Customer`
- Observed payable total: `2707.63106272 EUR`

Format notes:

- UTF-8 CSV.
- Preamble precedes the data header.
- Data starts at the `Clearing Code;...` header row.
- Delimiter is semicolon.
- Decimal separator is comma.
- `Royalty Amount Customer` is the payable amount after copyright deductions.
  Do not use `Net Revenue` as the payable amount.

Idempotency fingerprint:

```text
kontor:{Reference No.}:{Account No.}
```

## RouteNote XLSX

Observed sample:

- File: `RNSales_Jan2026_eeeemusic.xlsx`
- Sheet: `Sheet1`
- Payout currency: `USD` from `Earnings($)`
- Rows: `3,640` data rows plus one total/footer row
- Columns: `19`
- Unique ISRCs: `97`
- Territories: `225`
- Retailer currencies: `27`
- Streams: `4,983,500`
- Downloads: `3`
- Creations: `3,239`
- Observed payable total: `920.41004 USD`

Format notes:

- `Earnings($)` is the payable USD value.
- `Retailer Currency` is source sale context only.
- `Channel ID` and `Asset ID` are empty in the sample.
- HTML entities may appear in titles and should be decoded before display.
- The trailing total/footer row is skipped during preview.

Idempotency fingerprint:

```text
routenote:{content-hash-or-file-hash}:{period-or-filename}
```

## Normalized Preview Line

The API preview shape should normalize each raw distributor row into fields
like:

```ts
interface RoyaltyImportLine {
  readonly source: "kontor" | "routenote";
  readonly statementReference: string;
  readonly sourceRowId: string;
  readonly labelName: string;
  readonly artistName: string;
  readonly releaseTitle: string;
  readonly trackTitle: string;
  readonly isrc: string | null;
  readonly upc: string | null;
  readonly retailerName: string | null;
  readonly territory: string | null;
  readonly salesPeriod: string;
  readonly quantity: string;
  readonly quantityType: "stream" | "download" | "creation" | "unit" | "video";
  readonly payableMicro: string;
  readonly currency: string;
  readonly matchStatus: "matched" | "suggested" | "suspense";
  readonly exactFixPath: "mapping" | "catalog" | "contracts" | "imports";
}
```

This model is illustrative documentation only; concrete OpenAPI/Zod contracts
remain the implementation source of truth when the API service is built.
