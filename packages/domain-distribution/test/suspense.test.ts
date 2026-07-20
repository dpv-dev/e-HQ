import assert from "node:assert/strict";
import test from "node:test";
import { distributionSuspenseReasonDefinition } from "../src/suspense.ts";

test("Suspense reason definitions provide deterministic workflows and a safe fallback", () => {
  assert.deepEqual(distributionSuspenseReasonDefinition("missing_split"), {
    title: "Missing split",
    description: "Create a complete effective split, then retry the affected row.",
    fixPath: "contracts",
    actionLabel: "Fix exact split",
    resolutionMode: "retry"
  });
  assert.equal(distributionSuspenseReasonDefinition("unmapped_track").resolutionMode, "map");
  assert.deepEqual(distributionSuspenseReasonDefinition("unexpected_legacy_reason"), {
    title: "Catalog review",
    description: "Review the exact source row and correct its catalog data before retrying.",
    fixPath: "catalog",
    actionLabel: "Review catalog",
    resolutionMode: "manual_review"
  });
});
