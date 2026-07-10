import type { MoneyAmount, ReconciliationResult } from "./types.js";
import { raiseFinanceDomainError } from "./errors.js";
import { addMoney, assertSameCurrency, createMoneyAmount, createMoneyMicroUnits } from "./money.js";

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
  if (request.transactionId.length === 0) {
    raiseFinanceDomainError("allocation_invalid", "Reconciliation transaction id is required.", {
      transactionId: request.transactionId
    });
  }

  const zero = createMoneyAmount(createMoneyMicroUnits(0n), request.expectedAmount.currency);
  const reconciledAmount = request.candidates.reduce((sum: MoneyAmount, candidate: BankTransactionCandidate) => {
    if (candidate.id.length === 0) {
      raiseFinanceDomainError("allocation_invalid", "Bank transaction candidate id is required.", {
        transactionId: request.transactionId
      });
    }

    assertSameCurrency(request.expectedAmount, candidate.amount);
    return addMoney(sum, candidate.amount);
  }, zero);

  if (reconciledAmount.amountMicro !== request.expectedAmount.amountMicro) {
    raiseFinanceDomainError("allocation_invalid", "Reconciled amount must equal the expected transaction amount.", {
      transactionId: request.transactionId,
      expectedMicro: request.expectedAmount.amountMicro.toString(),
      reconciledMicro: reconciledAmount.amountMicro.toString()
    });
  }

  return {
    transactionId: request.transactionId,
    linkedBankTransactionIds: request.candidates.map((candidate: BankTransactionCandidate) => candidate.id),
    reconciledAmount
  };
}
