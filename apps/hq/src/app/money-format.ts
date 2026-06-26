import type { Tone } from "@ehq/ui";

export const formatMoneyValue = (amountValue: string, currency: string): string => {
  const value = amountValue.trim();
  const prefix = currencyPrefix(currency);

  if (/^[+-]?\d+$/u.test(value)) {
    return formatMicroUnits(BigInt(value), prefix);
  }

  if (/^[+-]?\d+(?:\.\d+)?$/u.test(value)) {
    return formatDecimalAmount(value, prefix);
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

const formatDecimalAmount = (amountValue: string, prefix: string): string => {
  const sign = amountValue.startsWith("-") ? "-" : "";
  const unsigned = amountValue.replace(/^[+-]/u, "");
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const wholeText = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  const fractionText = fraction.replace(/0+$/u, "");

  if (fractionText.length === 0) {
    return `${sign}${prefix}${wholeText}`;
  }

  return `${sign}${prefix}${wholeText}.${fractionText}`;
};

const formatMicroUnits = (amount: bigint, prefix: string): string => {
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  const units = absolute / 1_000_000n;
  const micros = absolute % 1_000_000n;
  const unitText = units.toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ",");

  if (micros === 0n) {
    return `${sign}${prefix}${unitText}`;
  }

  return `${sign}${prefix}${unitText}.${micros.toString().padStart(6, "0")}`;
};

const currencyPrefix = (currency: string): string => {
  if (currency === "MUR") {
    return "Rs ";
  }

  if (currency === "USD") {
    return "US$ ";
  }

  if (currency === "EUR") {
    return "€ ";
  }

  return `${currency} `;
};
