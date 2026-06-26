import type { CurrencyCode, MoneyAmount } from "./types.js";

const todoMessage = "TODO(domain-finance): implement FX conversion after approval.";

export interface FxRate {
  readonly fromCurrency: CurrencyCode;
  readonly toCurrency: CurrencyCode;
  readonly rateDecimal: string;
  readonly effectiveDate: string;
  readonly source: string;
}

export function convertMoney(amount: MoneyAmount, targetCurrency: CurrencyCode, rate: FxRate): MoneyAmount {
  throw new Error(todoMessage);
}
