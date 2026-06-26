import type { LedgerTransaction, MoneyAmount } from "./types.js";

const todoMessage = "TODO(domain-finance): implement ledger calculations after approval.";

export interface LedgerPeriod {
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface LedgerSummary {
  readonly period: LedgerPeriod;
  readonly income: MoneyAmount;
  readonly expense: MoneyAmount;
  readonly profit: MoneyAmount;
}

export function summarizeLedger(transactions: readonly LedgerTransaction[], period: LedgerPeriod): LedgerSummary {
  throw new Error(todoMessage);
}
