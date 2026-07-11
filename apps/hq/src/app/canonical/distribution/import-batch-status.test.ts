import { describe, expect, it } from "vitest";

import {
  distributionImportActionLabel,
  distributionImportStatusTone,
  isDistributionImportBatchReversible
} from "./import-batch-status.js";

describe("distribution import batch status helpers", () => {
  it("returns muted tone for voided batches", () => {
    expect(distributionImportStatusTone("voided")).toBe("muted");
  });

  it("returns explicit voided action label for voided batches", () => {
    expect(distributionImportActionLabel({ status: "voided", nextAction: "validate" })).toBe("voided batch");
  });

  it("prevents reverse action when batch is already voided", () => {
    expect(isDistributionImportBatchReversible("voided")).toBe(false);
    expect(isDistributionImportBatchReversible("mapped")).toBe(true);
  });
});
