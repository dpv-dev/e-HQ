import type { LedgerTransaction, ReconciliationResult } from "@ehq/domain-finance";

export * from "./allocations.js";
export * from "./analytics.js";
export * from "./etl.js";
export * from "./pl.js";

export interface OfficeWorkbenchSnapshot {
  readonly transactions: readonly LedgerTransaction[];
  readonly reconciliations: readonly ReconciliationResult[];
}

export function createOfficeWorkbenchSnapshot(): never {
  throw new Error("TODO(domain-office): build on domain-finance after kernel approval.");
}
