export type FinanceErrorCode =
  | "currency_invalid"
  | "currency_mismatch"
  | "decimal_invalid"
  | "decimal_scale_invalid"
  | "money_ratio_invalid"
  | "money_overflow"
  | "basis_points_invalid"
  | "basis_points_total_invalid"
  | "allocation_invalid"
  | "conversion_invalid";

export interface FinanceDomainError extends Error {
  readonly code: FinanceErrorCode;
  readonly context: Readonly<Record<string, string>>;
}

export function createFinanceDomainError(
  code: FinanceErrorCode,
  message: string,
  context: Readonly<Record<string, string>>
): FinanceDomainError {
  const error = new Error(message) as FinanceDomainError;
  Object.defineProperty(error, "name", { value: "FinanceDomainError", enumerable: true });
  Object.defineProperty(error, "code", { value: code, enumerable: true });
  Object.defineProperty(error, "context", { value: context, enumerable: true });
  return error;
}

export function raiseFinanceDomainError(
  code: FinanceErrorCode,
  message: string,
  context: Readonly<Record<string, string>>
): never {
  throw createFinanceDomainError(code, message, context);
}
