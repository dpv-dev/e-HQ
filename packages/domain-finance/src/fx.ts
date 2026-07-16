import type { CurrencyCode, MoneyAmount } from "./types.js";
import { raiseFinanceDomainError } from "./errors.js";
import { applyDecimalFactor, createMoneyAmount, createMoneyMicroUnits, roundRatioHalfUp } from "./money.js";

export interface FxRate {
  readonly fromCurrency: CurrencyCode;
  readonly toCurrency: CurrencyCode;
  readonly rateDecimal: string;
  readonly effectiveDate: string;
  readonly source: string;
}

export interface DatedFxRate {
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly effectiveDate: string;
}

export interface ScaledFxRate extends DatedFxRate {
  readonly rateE10: bigint;
}

export const FX_RATE_E10_SCALE = 10_000_000_000n;

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

// Shared effective-date selection for every persisted FX path. When no historic
// rate exists, retain the established fallback to the latest configured rate.
export function pickEffectiveFxRate<TRate extends DatedFxRate>(
  rates: readonly TRate[],
  fromCurrency: string,
  toCurrency: string,
  effectiveDate: string
): TRate | null {
  const candidates = rates.filter(
    (rate: TRate): boolean => rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency
  );
  if (candidates.length === 0) {
    return null;
  }

  const onOrBefore = candidates.filter((rate: TRate): boolean => rate.effectiveDate <= effectiveDate);
  return latestEffectiveRate(onOrBefore.length > 0 ? onOrBefore : candidates);
}

export function convertMoneyWithE10(
  amount: MoneyAmount,
  targetCurrency: CurrencyCode,
  rate: ScaledFxRate
): MoneyAmount {
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

  if (rate.rateE10 <= 0n) {
    raiseFinanceDomainError("conversion_invalid", "FX rate must be greater than zero.", {
      rateE10: rate.rateE10.toString()
    });
  }

  return createMoneyAmount(
    createMoneyMicroUnits(roundRatioHalfUp(amount.amountMicro * rate.rateE10, FX_RATE_E10_SCALE)),
    targetCurrency
  );
}

function latestEffectiveRate<TRate extends DatedFxRate>(rates: readonly TRate[]): TRate | null {
  return rates.reduce<TRate | null>(
    (latest, rate) => latest === null || rate.effectiveDate > latest.effectiveDate ? rate : latest,
    null
  );
}
