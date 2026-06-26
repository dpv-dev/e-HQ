import type {
  BasisPointShare,
  BasisPoints,
  CurrencyCode,
  MoneyAmount,
  MoneyMicroUnits
} from "./types.js";
import { raiseFinanceDomainError } from "./errors.js";

export const MICRO_UNITS_PER_UNIT = 1_000_000n;
export const BASIS_POINTS_PER_WHOLE = 10_000;
export const EOF_MONEY_SCALE = 2;
export const ERH_MONEY_SCALE = 10;

export type MoneyRoundingMode = "HALF_UP" | "TRUNCATE";

export interface DecimalFactor {
  readonly units: bigint;
  readonly scale: bigint;
  readonly normalized: string;
}

export interface MoneyKernelPreset {
  readonly scale: number;
  readonly roundingMode: MoneyRoundingMode;
  readonly parse: (value: string) => bigint;
  readonly format: (units: bigint) => string;
  readonly add: (left: bigint, right: bigint) => bigint;
  readonly sub: (left: bigint, right: bigint) => bigint;
  readonly mulByRatio: (units: bigint, numerator: bigint, denominator: bigint) => bigint;
  readonly applyDecimalFactor: (units: bigint, factor: string) => bigint;
  readonly percentage: (units: bigint, percentageValue: string) => bigint;
  readonly mulScaled: (left: bigint, right: bigint) => bigint;
  readonly divScaled: (left: bigint, right: bigint) => bigint;
}

interface DecimalParseOptions {
  readonly scale: number;
  readonly roundingMode: MoneyRoundingMode;
  readonly maximumFractionDigits: number | null;
  readonly invalidCode: "decimal_invalid" | "conversion_invalid";
}

interface ParsedDecimalText {
  readonly sign: -1n | 1n;
  readonly wholeText: string;
  readonly fractionText: string;
  readonly normalized: string;
}

export const eofMoney: MoneyKernelPreset = {
  scale: EOF_MONEY_SCALE,
  roundingMode: "HALF_UP",
  parse: parseEofMoney,
  format: formatEofMoney,
  add,
  sub,
  mulByRatio: mulByRatioEof,
  applyDecimalFactor: applyDecimalFactorEof,
  percentage: percentageEof,
  mulScaled: mulScaledEof,
  divScaled: divScaledEof
};

export const erhMoney: MoneyKernelPreset = {
  scale: ERH_MONEY_SCALE,
  roundingMode: "TRUNCATE",
  parse: parseErhMoney,
  format: formatErhMoney,
  add,
  sub,
  mulByRatio: mulByRatioErh,
  applyDecimalFactor: applyDecimalFactorErh,
  percentage: percentageErh,
  mulScaled: mulScaledErh,
  divScaled: divScaledErh
};

export function createCurrencyCode(value: string): CurrencyCode {
  if (!/^[A-Z]{3}$/.test(value)) {
    raiseFinanceDomainError("currency_invalid", "Currency code must be exactly three uppercase ISO letters.", {
      value
    });
  }

  return value as CurrencyCode;
}

export function createMoneyMicroUnits(value: bigint): MoneyMicroUnits {
  return value as MoneyMicroUnits;
}

export function createBasisPoints(value: number): BasisPoints {
  if (!Number.isSafeInteger(value) || value < 0 || value > BASIS_POINTS_PER_WHOLE) {
    raiseFinanceDomainError("basis_points_invalid", "Basis points must be an integer between 0 and 10000.", {
      value: String(value)
    });
  }

  return value as BasisPoints;
}

export function createMoneyAmount(amountMicro: MoneyMicroUnits, currency: CurrencyCode): MoneyAmount {
  return {
    amountMicro,
    currency
  };
}

export function parse(value: string, scale: number, mode: MoneyRoundingMode): bigint {
  return parseDecimalToUnits(value, {
    scale,
    roundingMode: mode,
    maximumFractionDigits: null,
    invalidCode: "decimal_invalid"
  });
}

export function format(units: bigint, scale: number): string {
  return formatScaledUnits(units, scale);
}

export function add(left: bigint, right: bigint): bigint {
  return left + right;
}

export function sub(left: bigint, right: bigint): bigint {
  return left - right;
}

export function roundRatioHalfUp(numerator: bigint, denominator: bigint): bigint {
  assertPositiveDenominator(denominator);
  const sign = numerator < 0n ? -1n : 1n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  return sign * ((absoluteNumerator + denominator / 2n) / denominator);
}

export function mulByRatio(units: bigint, numerator: bigint, denominator: bigint, mode: MoneyRoundingMode): bigint {
  assertPositiveDenominator(denominator);
  return roundQuotient(units * numerator, denominator, mode);
}

export function applyDecimalFactor(units: bigint, factorText: string, mode: MoneyRoundingMode): bigint {
  const factor = parseDecimalFactor(factorText, 12, "decimal_invalid");
  return mulByRatio(units, factor.units, factor.scale, mode);
}

export function percentage(units: bigint, percentageText: string, mode: MoneyRoundingMode): bigint {
  const factor = parseDecimalFactor(percentageText, 12, "decimal_invalid");
  return mulByRatio(units, factor.units, factor.scale * 100n, mode);
}

export function mulScaled(left: bigint, right: bigint, scale: number, mode: MoneyRoundingMode): bigint {
  return mulByRatio(left, right, scaleFactor(scale), mode);
}

export function divScaled(left: bigint, right: bigint, scale: number, mode: MoneyRoundingMode): bigint {
  if (right === 0n) {
    raiseFinanceDomainError("money_ratio_invalid", "Scaled division denominator must not be zero.", {
      left: left.toString(),
      right: right.toString(),
      scale: String(scale)
    });
  }

  const scaleMultiplier = scaleFactor(scale);
  if (right < 0n) {
    return roundQuotient(-(left * scaleMultiplier), -right, mode);
  }

  return roundQuotient(left * scaleMultiplier, right, mode);
}

export function splitRemainderLast(total: bigint, weightsBasisPoints: readonly number[]): readonly bigint[] {
  assertBasisPointWeights(weightsBasisPoints);
  const sign = total < 0n ? -1n : 1n;
  const absoluteTotal = total < 0n ? -total : total;
  const parts: bigint[] = [];
  let allocated = 0n;

  for (let index = 0; index < weightsBasisPoints.length - 1; index += 1) {
    const part = sign * ((absoluteTotal * BigInt(weightsBasisPoints[index] ?? 0)) / BigInt(BASIS_POINTS_PER_WHOLE));
    parts.push(part);
    allocated += part;
  }

  parts.push(total - allocated);
  return parts;
}

export function splitLargestRemainder(total: bigint, weights: readonly bigint[]): readonly bigint[] {
  if (weights.length === 0) {
    raiseFinanceDomainError("allocation_invalid", "Largest-remainder split requires at least one weight.", {
      weightCount: "0"
    });
  }

  const totalWeight = weights.reduce((sum: bigint, weight: bigint) => {
    if (weight < 0n) {
      raiseFinanceDomainError("allocation_invalid", "Largest-remainder weights must not be negative.", {
        weight: weight.toString()
      });
    }

    return sum + weight;
  }, 0n);
  if (totalWeight <= 0n) {
    raiseFinanceDomainError("allocation_invalid", "Largest-remainder weights must contain at least one positive value.", {
      totalWeight: totalWeight.toString()
    });
  }

  const sign = total < 0n ? -1n : 1n;
  const absoluteTotal = total < 0n ? -total : total;
  const rawParts = weights.map((weight: bigint, index: number) => {
    const numerator = absoluteTotal * weight;
    return {
      index,
      base: numerator / totalWeight,
      remainder: numerator % totalWeight
    };
  });
  const baseTotal = rawParts.reduce((sum: bigint, part: { readonly base: bigint }) => sum + part.base, 0n);
  let remaining = absoluteTotal - baseTotal;
  const extraIndexes = new Set<number>();
  const sortedParts = [...rawParts].sort((left, right) => {
    if (left.remainder === right.remainder) {
      return left.index - right.index;
    }

    return left.remainder > right.remainder ? -1 : 1;
  });

  for (const part of sortedParts) {
    if (remaining <= 0n) {
      break;
    }

    extraIndexes.add(part.index);
    remaining -= 1n;
  }

  return rawParts.map((part) => {
    const extra = extraIndexes.has(part.index) ? 1n : 0n;
    return sign * (part.base + extra);
  });
}

export function parseDecimalToMicroUnits(decimalValue: string, currency: CurrencyCode): MoneyAmount {
  return createMoneyAmount(parseDecimalStringToMicroUnits(decimalValue), currency);
}

export function parseDecimalStringToMicroUnits(decimalValue: string): MoneyMicroUnits {
  const normalized = parseDecimalToScaledUnits(decimalValue, 6, 6, "decimal_invalid");
  return createMoneyMicroUnits(normalized.units);
}

export function formatMoneyAmount(amount: MoneyAmount): string {
  return formatMicroUnitsToDecimal(amount.amountMicro);
}

export function formatMicroUnitsToDecimal(amountMicro: MoneyMicroUnits): string {
  return formatScaledUnits(amountMicro, 6);
}

export function addMoney(left: MoneyAmount, right: MoneyAmount): MoneyAmount {
  assertSameCurrency(left, right);
  return createMoneyAmount(createMoneyMicroUnits(left.amountMicro + right.amountMicro), left.currency);
}

export function subtractMoney(left: MoneyAmount, right: MoneyAmount): MoneyAmount {
  assertSameCurrency(left, right);
  return createMoneyAmount(createMoneyMicroUnits(left.amountMicro - right.amountMicro), left.currency);
}

export function allocateMoneyByBasisPoints(total: MoneyAmount, shares: readonly BasisPointShare[]): readonly MoneyAmount[] {
  assertSharesTotalBasisPoints(shares);

  const sign = total.amountMicro < 0n ? -1n : 1n;
  const absoluteTotal = total.amountMicro < 0n ? -total.amountMicro : total.amountMicro;
  const rawParts = shares.map((share: BasisPointShare, index: number) => {
    const numerator = absoluteTotal * BigInt(share.shareBasisPoints);
    return {
      index,
      base: numerator / BigInt(BASIS_POINTS_PER_WHOLE),
      remainder: numerator % BigInt(BASIS_POINTS_PER_WHOLE)
    };
  });
  const baseTotal = rawParts.reduce((sum: bigint, part: { readonly base: bigint }) => sum + part.base, 0n);
  let remaining = absoluteTotal - baseTotal;
  const extraIndexes = new Set<number>();
  const sortedParts = [...rawParts].sort((left, right) => {
    if (left.remainder === right.remainder) {
      return left.index - right.index;
    }
    return left.remainder > right.remainder ? -1 : 1;
  });
  for (const part of sortedParts) {
    if (remaining <= 0n) {
      break;
    }

    extraIndexes.add(part.index);
    remaining -= 1n;
  }

  return rawParts.map((part) => {
    const extra = extraIndexes.has(part.index) ? 1n : 0n;
    return createMoneyAmount(createMoneyMicroUnits(sign * (part.base + extra)), total.currency);
  });
}

export function assertSharesTotalBasisPoints(shares: readonly BasisPointShare[]): void {
  if (shares.length === 0) {
    raiseFinanceDomainError("basis_points_total_invalid", "Allocation requires at least one basis-point share.", {
      shareCount: "0"
    });
  }

  const total = shares.reduce((sum: number, share: BasisPointShare) => sum + share.shareBasisPoints, 0);
  if (total !== BASIS_POINTS_PER_WHOLE) {
    raiseFinanceDomainError("basis_points_total_invalid", "Basis-point shares must sum to exactly 10000.", {
      totalBasisPoints: String(total),
      expectedBasisPoints: String(BASIS_POINTS_PER_WHOLE)
    });
  }
}

export function sumMoney(amounts: readonly MoneyAmount[]): MoneyAmount {
  if (amounts.length === 0) {
    raiseFinanceDomainError("allocation_invalid", "Cannot sum an empty money list without a currency.", {
      amountCount: "0"
    });
  }

  const first = amounts[0];
  if (first === undefined) {
    raiseFinanceDomainError("allocation_invalid", "Cannot sum an empty money list without a currency.", {
      amountCount: "0"
    });
  }

  return amounts.slice(1).reduce((sum: MoneyAmount, amount: MoneyAmount) => addMoney(sum, amount), first);
}

export function parseDecimalToScaledUnits(
  decimalValue: string,
  scale: number,
  maximumFractionDigits: number,
  invalidCode: "decimal_invalid" | "conversion_invalid"
): { readonly units: MoneyMicroUnits; readonly normalized: string } {
  if (typeof decimalValue !== "string") {
    raiseFinanceDomainError(invalidCode, "Decimal value must be provided as a string.", {
      valueType: typeof decimalValue
    });
  }

  if (!Number.isSafeInteger(scale) || scale < 0 || !Number.isSafeInteger(maximumFractionDigits) || maximumFractionDigits < 0) {
    raiseFinanceDomainError("decimal_scale_invalid", "Decimal scale configuration must use non-negative safe integers.", {
      scale: String(scale),
      maximumFractionDigits: String(maximumFractionDigits)
    });
  }

  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(decimalValue);
  if (match === null) {
    raiseFinanceDomainError(invalidCode, "Decimal value must be a plain decimal string.", {
      decimalValue
    });
  }

  const signText = match[1] ?? "";
  const wholeText = match[2] ?? "";
  const fractionText = match[3] ?? "";
  if (fractionText.length > maximumFractionDigits) {
    raiseFinanceDomainError("decimal_scale_invalid", "Decimal value has more fractional digits than this boundary allows.", {
      decimalValue,
      maximumFractionDigits: String(maximumFractionDigits),
      actualFractionDigits: String(fractionText.length)
    });
  }

  const paddedFraction = fractionText.padEnd(scale, "0");
  const unitsText = `${wholeText}${paddedFraction}`;
  const unsignedUnits = BigInt(unitsText);
  const signedUnits = signText === "-" ? -unsignedUnits : unsignedUnits;
  const normalized = `${signText === "-" && signedUnits !== 0n ? "-" : ""}${wholeText}.${paddedFraction}`;

  return {
    units: createMoneyMicroUnits(signedUnits),
    normalized
  };
}

export function formatScaledUnits(units: bigint, scale: number): string {
  if (!Number.isSafeInteger(scale) || scale < 0) {
    raiseFinanceDomainError("decimal_scale_invalid", "Decimal format scale must be a non-negative safe integer.", {
      scale: String(scale)
    });
  }

  if (scale === 0) {
    return units.toString();
  }

  const negative = units < 0n;
  const absoluteText = (negative ? -units : units).toString().padStart(scale + 1, "0");
  const wholeText = absoluteText.slice(0, absoluteText.length - scale);
  const fractionText = absoluteText.slice(absoluteText.length - scale);
  return `${negative ? "-" : ""}${wholeText}.${fractionText}`;
}

export function assertSameCurrency(left: MoneyAmount, right: MoneyAmount): void {
  if (left.currency !== right.currency) {
    raiseFinanceDomainError("currency_mismatch", "Money amounts must use the same currency.", {
      leftCurrency: left.currency,
      rightCurrency: right.currency
    });
  }
}

function parseEofMoney(value: string): bigint {
  return parseDecimalToUnits(value, {
    scale: EOF_MONEY_SCALE,
    roundingMode: "HALF_UP",
    maximumFractionDigits: 12,
    invalidCode: "decimal_invalid"
  });
}

function parseErhMoney(value: string): bigint {
  return parseDecimalToUnits(value, {
    scale: ERH_MONEY_SCALE,
    roundingMode: "TRUNCATE",
    maximumFractionDigits: null,
    invalidCode: "decimal_invalid"
  });
}

function formatEofMoney(units: bigint): string {
  return formatScaledUnits(units, EOF_MONEY_SCALE);
}

function formatErhMoney(units: bigint): string {
  return formatScaledUnits(units, ERH_MONEY_SCALE);
}

function mulByRatioEof(units: bigint, numerator: bigint, denominator: bigint): bigint {
  return mulByRatio(units, numerator, denominator, "HALF_UP");
}

function mulByRatioErh(units: bigint, numerator: bigint, denominator: bigint): bigint {
  return mulByRatio(units, numerator, denominator, "TRUNCATE");
}

function applyDecimalFactorEof(units: bigint, factor: string): bigint {
  return applyDecimalFactor(units, factor, "HALF_UP");
}

function applyDecimalFactorErh(units: bigint, factor: string): bigint {
  return applyDecimalFactor(units, factor, "TRUNCATE");
}

function percentageEof(units: bigint, percentageText: string): bigint {
  return percentage(units, percentageText, "HALF_UP");
}

function percentageErh(units: bigint, percentageText: string): bigint {
  return percentage(units, percentageText, "TRUNCATE");
}

function mulScaledEof(left: bigint, right: bigint): bigint {
  return mulScaled(left, right, EOF_MONEY_SCALE, "HALF_UP");
}

function mulScaledErh(left: bigint, right: bigint): bigint {
  return mulScaled(left, right, ERH_MONEY_SCALE, "TRUNCATE");
}

function divScaledEof(left: bigint, right: bigint): bigint {
  return divScaled(left, right, EOF_MONEY_SCALE, "HALF_UP");
}

function divScaledErh(left: bigint, right: bigint): bigint {
  return divScaled(left, right, ERH_MONEY_SCALE, "TRUNCATE");
}

function parseDecimalToUnits(value: string, options: DecimalParseOptions): bigint {
  const parsed = parseDecimalText(value, options.invalidCode);
  if (options.maximumFractionDigits !== null && parsed.fractionText.length > options.maximumFractionDigits) {
    raiseFinanceDomainError("decimal_scale_invalid", "Decimal value has more fractional digits than this boundary allows.", {
      decimalValue: value,
      maximumFractionDigits: String(options.maximumFractionDigits),
      actualFractionDigits: String(parsed.fractionText.length)
    });
  }

  assertScale(options.scale);
  if (parsed.fractionText.length <= options.scale) {
    const paddedFraction = parsed.fractionText.padEnd(options.scale, "0");
    return parsed.sign * BigInt(`${parsed.wholeText}${paddedFraction}`);
  }

  const rawUnits = parsed.sign * BigInt(`${parsed.wholeText}${parsed.fractionText}`);
  const excessScale = parsed.fractionText.length - options.scale;
  return roundQuotient(rawUnits, scaleFactor(excessScale), options.roundingMode);
}

function parseDecimalFactor(value: string, maximumFractionDigits: number, invalidCode: "decimal_invalid" | "conversion_invalid"): DecimalFactor {
  const parsed = parseDecimalText(value, invalidCode);
  if (parsed.fractionText.length > maximumFractionDigits) {
    raiseFinanceDomainError("decimal_scale_invalid", "Decimal factor has more fractional digits than this boundary allows.", {
      decimalValue: value,
      maximumFractionDigits: String(maximumFractionDigits),
      actualFractionDigits: String(parsed.fractionText.length)
    });
  }

  const units = parsed.sign * BigInt(`${parsed.wholeText}${parsed.fractionText}`);
  const denominator = parsed.fractionText.length === 0 ? 1n : scaleFactor(parsed.fractionText.length);
  return {
    units,
    scale: denominator,
    normalized: parsed.normalized
  };
}

function parseDecimalText(value: string, invalidCode: "decimal_invalid" | "conversion_invalid"): ParsedDecimalText {
  if (typeof value !== "string") {
    raiseFinanceDomainError(invalidCode, "Decimal value must be provided as a string.", {
      valueType: typeof value
    });
  }

  const sanitized = value.replaceAll(",", "");
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(sanitized);
  if (match === null) {
    raiseFinanceDomainError(invalidCode, "Decimal value must be a plain decimal string.", {
      decimalValue: value
    });
  }

  const signText = match[1] ?? "";
  const wholeText = match[2] ?? "";
  const fractionText = match[3] ?? "";
  const sign = signText === "-" ? -1n : 1n;
  const normalized = `${signText === "-" ? "-" : ""}${wholeText}${fractionText.length === 0 ? "" : `.${fractionText}`}`;
  return {
    sign,
    wholeText,
    fractionText,
    normalized
  };
}

function roundQuotient(numerator: bigint, denominator: bigint, mode: MoneyRoundingMode): bigint {
  assertPositiveDenominator(denominator);
  if (mode === "HALF_UP") {
    return roundRatioHalfUp(numerator, denominator);
  }

  if (mode === "TRUNCATE") {
    const sign = numerator < 0n ? -1n : 1n;
    const absoluteNumerator = numerator < 0n ? -numerator : numerator;
    return sign * (absoluteNumerator / denominator);
  }

  raiseFinanceDomainError("money_ratio_invalid", "Unknown money rounding mode.", {
    mode
  });
}

function assertPositiveDenominator(denominator: bigint): void {
  if (denominator <= 0n) {
    raiseFinanceDomainError("money_ratio_invalid", "Ratio denominator must be greater than zero.", {
      denominator: denominator.toString()
    });
  }
}

function assertScale(scale: number): void {
  if (!Number.isSafeInteger(scale) || scale < 0) {
    raiseFinanceDomainError("decimal_scale_invalid", "Money scale must be a non-negative safe integer.", {
      scale: String(scale)
    });
  }
}

function scaleFactor(scale: number): bigint {
  assertScale(scale);
  return 10n ** BigInt(scale);
}

function assertBasisPointWeights(weightsBasisPoints: readonly number[]): void {
  if (weightsBasisPoints.length === 0) {
    raiseFinanceDomainError("basis_points_total_invalid", "Remainder-last split requires at least one basis-point weight.", {
      weightCount: "0"
    });
  }

  const total = weightsBasisPoints.reduce((sum: number, weight: number) => {
    if (!Number.isSafeInteger(weight) || weight < 0 || weight > BASIS_POINTS_PER_WHOLE) {
      raiseFinanceDomainError("basis_points_invalid", "Basis-point weight must be an integer between 0 and 10000.", {
        weight: String(weight)
      });
    }

    return sum + weight;
  }, 0);
  if (total !== BASIS_POINTS_PER_WHOLE) {
    raiseFinanceDomainError("basis_points_total_invalid", "Basis-point weights must sum to exactly 10000.", {
      totalBasisPoints: String(total),
      expectedBasisPoints: String(BASIS_POINTS_PER_WHOLE)
    });
  }
}
