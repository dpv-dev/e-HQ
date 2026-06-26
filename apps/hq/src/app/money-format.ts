import type { Tone } from "@ehq/ui";

export const formatMoneyValue = (amountValue: string, currency: string): string => {
  const value = amountValue.trim();

  if (/^[+-]?\d+$/u.test(value)) {
    return formatMicroUnits(BigInt(value), currency);
  }

  if (/^[+-]?\d+(?:\.\d+)?$/u.test(value)) {
    return formatDecimalAmount(value, currency);
  }

  throw new Error(`Invalid API money value: ${amountValue}.`);
};

export const formatSignedMoneyValue = (amountValue: string, currency: string): string => {
  const formatted = formatMoneyValue(amountValue, currency);

  if (moneySignForValue(amountValue) > 0 && !formatted.startsWith("+")) {
    return `+${formatted}`;
  }

  return formatted;
};

export const moneyToneForValue = (amountValue: string): Tone => {
  const sign = moneySignForValue(amountValue);

  if (sign > 0) {
    return "success";
  }

  if (sign < 0) {
    return "error";
  }

  return "muted";
};

export const moneySignForValue = (amountValue: string): -1 | 0 | 1 => {
  const value = apiMoneyToMicroUnits(amountValue);

  if (value > 0n) {
    return 1;
  }

  if (value < 0n) {
    return -1;
  }

  return 0;
};

export const apiMoneyToMicroUnits = (amountValue: string): bigint => {
  const value = amountValue.trim();

  if (/^[+-]?\d+$/u.test(value)) {
    return BigInt(value);
  }

  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/u.exec(value);

  if (match === null) {
    throw new Error(`Invalid API money value: ${amountValue}.`);
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const wholeText = match[2] ?? "0";
  const fractionText = (match[3] ?? "").padEnd(6, "0").slice(0, 6);

  return sign * (BigInt(wholeText) * 1_000_000n + BigInt(fractionText));
};

const formatDecimalAmount = (amountValue: string, currency: string): string => {
  const sign = amountValue.startsWith("-") ? "-" : "";
  const unsigned = amountValue.replace(/^[+-]/u, "");
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const rounded = roundDecimalToCents(whole, fraction);
  const wholeText = rounded.whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  const fractionText = rounded.fraction;

  return formatCurrencyText(`${sign}${wholeText}.${fractionText}`, currency);
};

const formatMicroUnits = (amount: bigint, currency: string): string => {
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  const cents = (absolute + 5_000n) / 10_000n;
  const units = cents / 100n;
  const fraction = cents % 100n;
  const unitText = units.toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ",");

  return formatCurrencyText(`${sign}${unitText}.${fraction.toString().padStart(2, "0")}`, currency);
};

const roundDecimalToCents = (whole: string, fraction: string): { readonly whole: string; readonly fraction: string } => {
  const normalizedFraction = fraction.padEnd(3, "0");
  const cents = BigInt(whole) * 100n +
    BigInt(normalizedFraction.slice(0, 2)) +
    (Number.parseInt(normalizedFraction.slice(2, 3), 10) >= 5 ? 1n : 0n);
  const roundedWhole = cents / 100n;
  const roundedFraction = cents % 100n;

  return {
    whole: roundedWhole.toString(),
    fraction: roundedFraction.toString().padStart(2, "0")
  };
};

const formatCurrencyText = (amountText: string, currency: string): string => {
  if (currency === "MUR") {
    return `${amountText} Rs`;
  }

  if (currency === "USD") {
    return `US$ ${amountText}`;
  }

  if (currency === "EUR") {
    return `€ ${amountText}`;
  }

  return `${amountText} ${currency}`;
};
