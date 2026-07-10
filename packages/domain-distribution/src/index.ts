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

export function createDistributionStatementDraft(input: DistributionStatementDraft): DistributionStatementDraft {
  return {
    payeeId: input.payeeId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    currencyTotal: input.currencyTotal,
    allocationLines: input.allocationLines,
    openExpenses: input.openExpenses
  };
}
