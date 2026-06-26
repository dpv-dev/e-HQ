import type { BasisPoints, MoneyAmount } from "./types.js";

const todoMessage = "TODO(domain-finance): implement VAT calculations after approval.";

export interface VatBreakdown {
  readonly netAmount: MoneyAmount;
  readonly vatAmount: MoneyAmount;
  readonly grossAmount: MoneyAmount;
}

export function calculateVat(grossAmount: MoneyAmount, vatRateBasisPoints: BasisPoints): VatBreakdown {
  throw new Error(todoMessage);
}
