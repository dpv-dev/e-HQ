import type { AllocationLine, Expense, MoneyAmount } from "@ehq/domain-finance";

export * from "./allocation.js";
export * from "./reads.js";
export * from "./statements.js";

export interface DistributionStatementDraft {
  readonly payeeId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currencyTotal: MoneyAmount;
  readonly allocationLines: readonly AllocationLine[];
  readonly openExpenses: readonly Expense[];
}

export function createDistributionStatementDraft(): never {
  throw new Error("TODO(domain-distribution): build on domain-finance after kernel approval.");
}
