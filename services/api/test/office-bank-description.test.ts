import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeOfficeBankDescription } from "../src/office-bank-description.ts";

test("bank description read model removes legacy MCB page chrome", () => {
  const polluted = "FT26183S4TQB IB Account Transfer|Internet online|POUPINEL DE VALENCE D LAWRENCE A MR The Mauritius Commercial Bank Ltd. 9-15 Sir William Newton Street, Port-Louis, Republic of Mauritius";
  assert.equal(
    sanitizeOfficeBankDescription(polluted),
    "FT26183S4TQB IB Account Transfer|Internet online|POUPINEL DE VALENCE D LAWRENCE A MR"
  );
});

test("bank description read model leaves ordinary descriptions unchanged", () => {
  assert.equal(sanitizeOfficeBankDescription("MCB transfer to supplier"), "MCB transfer to supplier");
});
