import type { LedgerTransaction, ReconciliationResult } from "@ehq/domain-finance";

export * from "./allocations.js";
export * from "./analytics.js";
export * from "./bank-import-dedupe.js";
export * from "./etl.js";
export * from "./pl.js";

export interface OfficeWorkbenchSnapshot {
  readonly transactions: readonly LedgerTransaction[];
  readonly reconciliations: readonly ReconciliationResult[];
}

export function createOfficeWorkbenchSnapshot(input: Partial<OfficeWorkbenchSnapshot> = {}): OfficeWorkbenchSnapshot {
  return {
    transactions: input.transactions ?? [],
    reconciliations: input.reconciliations ?? []
  };
}
