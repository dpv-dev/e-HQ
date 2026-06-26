import type { CurrencyCode, LegacyDistributionConversion, MoneyAmount } from "./types.js";
import { raiseFinanceDomainError } from "./errors.js";
import {
  createMoneyAmount,
  createMoneyMicroUnits,
  formatScaledUnits,
  parseDecimalToScaledUnits
} from "./money.js";

export interface LegacyOfficeConversionInput {
  readonly source: string;
  readonly decimalValue: string;
  readonly currency: CurrencyCode;
}

export interface LegacyDistributionConversionInput {
  readonly source: string;
  readonly decimalValue: string;
  readonly currency: CurrencyCode;
}

export function convertOfficeDecimal15_2ToMoney(input: LegacyOfficeConversionInput): MoneyAmount {
  assertSource(input.source);
  const integerDigits = countIntegerDigits(input.decimalValue);
  if (integerDigits > 13) {
    raiseFinanceDomainError("conversion_invalid", "Office DECIMAL(15,2) integer part exceeds 13 digits.", {
      source: input.source,
      decimalValue: input.decimalValue,
      integerDigits: String(integerDigits)
    });
  }

  const parsed = parseDecimalToScaledUnits(input.decimalValue, 6, 2, "conversion_invalid");
  return createMoneyAmount(parsed.units, input.currency);
}

export function convertDistributionDecimal24_10ToMoney(input: LegacyDistributionConversionInput): LegacyDistributionConversion {
  assertSource(input.source);
  const integerDigits = countIntegerDigits(input.decimalValue);
  if (integerDigits > 14) {
    raiseFinanceDomainError("conversion_invalid", "Distribution DECIMAL(24,10) integer part exceeds 14 digits.", {
      source: input.source,
      decimalValue: input.decimalValue,
      integerDigits: String(integerDigits)
    });
  }

  const parsed = parseDecimalToScaledUnits(input.decimalValue, 10, 10, "conversion_invalid");
  const sourceUnits10dp = parsed.units;
  const sign = sourceUnits10dp < 0n ? -1n : 1n;
  const absoluteUnits10dp = sourceUnits10dp < 0n ? -sourceUnits10dp : sourceUnits10dp;
  const baseMicro = absoluteUnits10dp / 10_000n;
  const remainder = absoluteUnits10dp % 10_000n;
  const roundedMicro = sign * (baseMicro + (remainder >= 5_000n ? 1n : 0n));
  const resultMicro = createMoneyMicroUnits(roundedMicro);
  const result10dpUnits = roundedMicro * 10_000n;
  const delta10dpUnits = result10dpUnits - sourceUnits10dp;

  return {
    amount: createMoneyAmount(resultMicro, input.currency),
    auditRecord: {
      source: input.source,
      original_10dp: parsed.normalized,
      result_micro: resultMicro,
      delta: formatScaledUnits(delta10dpUnits, 10)
    }
  };
}

function assertSource(source: string): void {
  if (source.length === 0) {
    raiseFinanceDomainError("conversion_invalid", "Legacy conversion source is required.", {
      source
    });
  }
}

function countIntegerDigits(decimalValue: string): number {
  const match = /^[+-]?(\d+)(?:\.\d+)?$/.exec(decimalValue);
  if (match === null) {
    raiseFinanceDomainError("conversion_invalid", "Decimal value must be a plain decimal string.", {
      decimalValue
    });
  }

  const digits = match[1] ?? "";
  const trimmed = digits.replace(/^0+/, "");
  return trimmed.length === 0 ? 1 : trimmed.length;
}
