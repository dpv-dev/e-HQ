import { describe, expect, it } from "vitest";

import {
  canCancelDistributionImportBatch,
  canOpenDistributionImportBatch,
  distributionImportBatchReadOnlyReason
} from "./import-batch-status.js";

describe("distribution import batch row-action guards", () => {
  it("allows open and cancel for non-voided batches", () => {
    expect(canOpenDistributionImportBatch({ status: "mapped" })).toBe(true);
    expect(canCancelDistributionImportBatch({ status: "mapped" })).toBe(true);
  });

  it("blocks open and cancel for voided batches", () => {
    expect(canOpenDistributionImportBatch({ status: "voided" })).toBe(false);
    expect(canCancelDistributionImportBatch({ status: "voided" })).toBe(false);
  });

  it("returns clear read-only reasons", () => {
    expect(distributionImportBatchReadOnlyReason({ status: "mapped" })).toBeNull();
    expect(distributionImportBatchReadOnlyReason({ status: "voided" })).toBe("Voided batches are read-only.");
    expect(distributionImportBatchReadOnlyReason(null)).toBe("Batch not loaded.");
  });
});
