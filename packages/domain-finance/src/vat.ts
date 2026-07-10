import type { BasisPoints, MoneyAmount } from "./types.js";
import { BASIS_POINTS_PER_WHOLE, createMoneyAmount, createMoneyMicroUnits, roundRatioHalfUp, subtractMoney } from "./money.js";

export interface VatBreakdown {
  readonly netAmount: MoneyAmount;
  readonly vatAmount: MoneyAmount;
  readonly grossAmount: MoneyAmount;
}

export function calculateVat(grossAmount: MoneyAmount, vatRateBasisPoints: BasisPoints): VatBreakdown {
  const denominator = BigInt(BASIS_POINTS_PER_WHOLE + vatRateBasisPoints);
  const vatAmount = createMoneyAmount(
    createMoneyMicroUnits(roundRatioHalfUp(grossAmount.amountMicro * BigInt(vatRateBasisPoints), denominator)),
    grossAmount.currency
  );
  const netAmount = subtractMoney(grossAmount, vatAmount);

  return {
    netAmount,
    vatAmount,
    grossAmount
  };
}
