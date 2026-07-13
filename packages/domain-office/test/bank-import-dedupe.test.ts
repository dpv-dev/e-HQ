import assert from "node:assert/strict";
import test from "node:test";
import {
  type OfficeBankDedupeLine,
  detectOfficeBankImportDuplicates
} from "../src/bank-import-dedupe.ts";

function bankLine(
  id: string,
  overrides: Partial<OfficeBankDedupeLine> = {}
): OfficeBankDedupeLine {
  return {
    id,
    accountId: "account_sbi_mur",
    occurredOn: "2026-07-01",
    valueOn: null,
    description: "Bank movement",
    direction: "debit",
    amountMinor: 125_000n,
    balanceMinor: 9_875_000n,
    currency: "MUR",
    reference: null,
    ...overrides
  };
}

test("matches a duplicate by balance even when descriptions are not part of the key", () => {
  const results = detectOfficeBankImportDuplicates(
    [bankLine("candidate", { description: "New PDF wording" })],
    [bankLine("existing", { description: "Legacy import wording" })]
  );

  assert.deepEqual(results, [
    {
      candidateId: "candidate",
      match: { existingId: "existing", reason: "balance" }
    }
  ]);
});

test("does not match movements with distinct balances", () => {
  const results = detectOfficeBankImportDuplicates(
    [bankLine("candidate", { balanceMinor: 9_800_000n, reference: "REF-001" })],
    [bankLine("existing", { balanceMinor: 9_875_000n, reference: "ref 001" })]
  );

  assert.deepEqual(results, [{ candidateId: "candidate", match: null }]);
});

test("falls back to a normalized non-empty reference when a balance is absent", () => {
  const results = detectOfficeBankImportDuplicates(
    [bankLine("candidate", { balanceMinor: null, reference: " chq-001 / 42 " })],
    [bankLine("existing", { reference: "CHQ 00142" })]
  );

  assert.deepEqual(results, [
    {
      candidateId: "candidate",
      match: { existingId: "existing", reason: "reference" }
    }
  ]);
});

test("does not match without either a balance pair or a non-empty reference", () => {
  const results = detectOfficeBankImportDuplicates(
    [bankLine("candidate", { balanceMinor: null, reference: "  - /  " })],
    [bankLine("existing", { balanceMinor: null, reference: null })]
  );

  assert.deepEqual(results, [{ candidateId: "candidate", match: null }]);
});

test("does not use a short ambiguous reference as a strong key", () => {
  const results = detectOfficeBankImportDuplicates(
    [bankLine("candidate", { balanceMinor: null, reference: "01" })],
    [bankLine("existing", { balanceMinor: null, reference: "01" })]
  );

  assert.deepEqual(results, [{ candidateId: "candidate", match: null }]);
});

test("consumes an existing line only once for identical candidate movements", () => {
  const results = detectOfficeBankImportDuplicates(
    [bankLine("candidate_1"), bankLine("candidate_2")],
    [bankLine("existing")]
  );

  assert.deepEqual(results, [
    {
      candidateId: "candidate_1",
      match: { existingId: "existing", reason: "balance" }
    },
    { candidateId: "candidate_2", match: null }
  ]);
});

test("matches occurred and value dates as alternatives", () => {
  const results = detectOfficeBankImportDuplicates(
    [bankLine("candidate", { occurredOn: "2026-07-02", valueOn: "2026-07-03" })],
    [bankLine("existing", { occurredOn: "2026-07-03", valueOn: "2026-07-04" })]
  );

  assert.deepEqual(results[0]?.match, { existingId: "existing", reason: "balance" });
});
