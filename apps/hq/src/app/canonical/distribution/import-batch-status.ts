import type { DistributionImportBatch } from "@ehq/api-client";
import type { Tone } from "@ehq/ui";

type DistributionImportBatchLike = Pick<DistributionImportBatch, "status"> | null;

export function distributionImportStatusTone(status: DistributionImportBatch["status"]): Tone {
  if (status === "validated") {
    return "success";
  }

  if (status === "voided") {
    return "muted";
  }

  if (status === "failed") {
    return "error";
  }

  if (status === "mapped") {
    return "info";
  }

  return "warning";
}

export function distributionImportActionLabel(batch: Pick<DistributionImportBatch, "status" | "nextAction">): string {
  if (batch.status === "voided") {
    return "voided batch";
  }

  return exactImportAction(batch.nextAction);
}

export function isDistributionImportBatchReversible(status: DistributionImportBatch["status"]): boolean {
  return status !== "voided";
}

export function canOpenDistributionImportBatch(item: DistributionImportBatchLike): boolean {
  return item !== null && item.status !== "voided";
}

export function canCancelDistributionImportBatch(item: DistributionImportBatchLike): boolean {
  return item !== null && isDistributionImportBatchReversible(item.status);
}

export function distributionImportBatchReadOnlyReason(item: DistributionImportBatchLike): string | null {
  if (item === null) {
    return "Batch not loaded.";
  }

  if (item.status === "voided") {
    return "Voided batches are read-only.";
  }

  return null;
}

function exactImportAction(action: DistributionImportBatch["nextAction"]): string {
  switch (action) {
    case "review_mapping":
      return "review mapping";
    case "apply_rules":
      return "apply rules";
    case "validate":
      return "validate";
    case "retry":
      return "retry";
    default:
      return "review mapping";
  }
}
