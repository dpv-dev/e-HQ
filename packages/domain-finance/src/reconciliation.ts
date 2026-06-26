import type { MoneyAmount, ReconciliationResult } from "./types.js";

const todoMessage = "TODO(domain-finance): implement atomic reconciliation after approval.";

export interface BankTransactionCandidate {
  readonly id: string;
  readonly amount: MoneyAmount;
  readonly transactionDate: string;
}

export interface ReconciliationRequest {
  readonly transactionId: string;
  readonly expectedAmount: MoneyAmount;
  readonly candidates: readonly BankTransactionCandidate[];
}

export function reconcileTransaction(request: ReconciliationRequest): ReconciliationResult {
  throw new Error(todoMessage);
}
