import type { CurrencyCode, MoneyAmount } from "./types.js";
import { raiseFinanceDomainError } from "./errors.js";
import { applyDecimalFactor, createMoneyAmount, createMoneyMicroUnits } from "./money.js";

export interface FxRate {
  readonly fromCurrency: CurrencyCode;
  readonly toCurrency: CurrencyCode;
  readonly rateDecimal: string;
  readonly effectiveDate: string;
  readonly source: string;
}

export function convertMoney(amount: MoneyAmount, targetCurrency: CurrencyCode, rate: FxRate): MoneyAmount {
  if (rate.fromCurrency !== amount.currency) {
    raiseFinanceDomainError("currency_mismatch", "FX rate source currency must match the amount currency.", {
      amountCurrency: amount.currency,
      rateFromCurrency: rate.fromCurrency
    });
  }

  if (rate.toCurrency !== targetCurrency) {
    raiseFinanceDomainError("currency_mismatch", "FX rate target currency must match the requested currency.", {
      targetCurrency,
      rateToCurrency: rate.toCurrency
    });
  }

  return createMoneyAmount(
    createMoneyMicroUnits(applyDecimalFactor(amount.amountMicro, rate.rateDecimal, "HALF_UP")),
    targetCurrency
  );
}
