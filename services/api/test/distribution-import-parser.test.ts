import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeDistributionImportRows,
  parseDistributionImportPreview
} from "../src/distribution-import-parser.ts";

test("distribution parse-preview: Kontor rows parse amount/currency and join keys", () => {
  const parsed = parseDistributionImportPreview("kontor", [
    {
      Title: "Track A",
      Artist: "Artist A",
      ISRC: "MU-AAA-26-00001",
      Currency: "EUR",
      Amount: "12.50"
    }
  ]);

  assert.equal(parsed.acceptedRowCount, 1);
  assert.equal(parsed.rejectedRowCount, 0);
  assert.deepEqual(parsed.currencyCodes, ["EUR"]);
  assert.deepEqual(parsed.joinKeys, ["ISRC", "title", "artist"]);
  assert.equal(parsed.payableMicro, "12.5000000000");
  assert.equal(parsed.rowResults[0]?.status, "accepted");
});

test("distribution parse-preview: RouteNote parser falls back to generic columns", () => {
  const parsed = parseDistributionImportPreview("routenote", [
    {
      Track: "Fallback Song",
      Performer: "Fallback Artist",
      "Currency Code": "USD",
      Revenue: "9.99"
    }
  ]);

  assert.equal(parsed.acceptedRowCount, 1);
  assert.equal(parsed.rejectedRowCount, 0);
  assert.deepEqual(parsed.currencyCodes, ["USD"]);
  assert.equal(parsed.payableMicro, "9.9900000000");
  assert.equal(parsed.rowResults[0]?.status, "accepted");
});

test("distribution parse-preview: invalid rows are rejected with warning", () => {
  const parsed = parseDistributionImportPreview("routenote", [
    {
      Title: "",
      Currency: "USD",
      Amount: ""
    }
  ]);

  assert.equal(parsed.acceptedRowCount, 0);
  assert.equal(parsed.rejectedRowCount, 1);
  assert.equal(parsed.rowResults[0]?.status, "rejected");
  assert.ok(parsed.warnings.some((message) => message.includes("rejected")));
});

test("distribution normalization extracts exact fields, report period, and duplicate issues", () => {
  const rows = [
    {
      Title: "Track A",
      Artist: "Artist A",
      ISRC: "MU-AAA-26-00001",
      Currency: "EUR",
      Amount: "12.50",
      Quantity: "3",
      "Report Period": "2026-06",
      Store: "Kontor"
    },
    {
      Title: "Track A",
      Artist: "Artist A",
      ISRC: "MU-AAA-26-00001",
      Currency: "EUR",
      Amount: "12.50",
      Quantity: "3",
      "Report Period": "2026-06",
      Store: "Kontor"
    }
  ].map((rawData, index) => ({ id: `row_${String(index + 1)}`, rowNumber: index + 1, rawData }));

  const normalized = normalizeDistributionImportRows("kontor", rows);
  assert.equal(normalized.acceptedRows.length, 1);
  assert.equal(normalized.acceptedRows[0]?.grossAmount, "12.5000000000");
  assert.equal(normalized.acceptedRows[0]?.quantity, "3.000000");
  assert.equal(normalized.acceptedRows[0]?.isrc, "MUAAA2600001");
  assert.equal(normalized.acceptedRows[0]?.sourcePeriodStart, "2026-06-01");
  assert.equal(normalized.acceptedRows[0]?.sourcePeriodEnd, "2026-06-30");
  assert.deepEqual(normalized.rejectedRows[0]?.issues, ["duplicate_source_row"]);
});
