import type { LedgerTransaction, MoneyAmount } from "./types.js";
import { raiseFinanceDomainError } from "./errors.js";
import { addMoney, createMoneyAmount, createMoneyMicroUnits, subtractMoney } from "./money.js";

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
  assertLedgerPeriod(period);

  const periodTransactions = transactions.filter((transaction: LedgerTransaction) =>
    transaction.transactionDate >= period.startsOn && transaction.transactionDate <= period.endsOn
  );
  const first = periodTransactions[0];
  if (first === undefined) {
    raiseFinanceDomainError("allocation_invalid", "Ledger summary requires at least one transaction to infer currency.", {
      startsOn: period.startsOn,
      endsOn: period.endsOn
    });
  }

  const zero = createMoneyAmount(createMoneyMicroUnits(0n), first.amount.currency);
  let income = zero;
  let expense = zero;

  for (const transaction of periodTransactions) {
    if (transaction.direction === "income") {
      income = addMoney(income, transaction.amount);
      continue;
    }

    expense = addMoney(expense, transaction.amount);
  }

  return {
    period,
    income,
    expense,
    profit: subtractMoney(income, expense)
  };
}

function assertLedgerPeriod(period: LedgerPeriod): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(period.startsOn) || !/^\d{4}-\d{2}-\d{2}$/u.test(period.endsOn)) {
    raiseFinanceDomainError("allocation_invalid", "Ledger period dates must use YYYY-MM-DD.", {
      startsOn: period.startsOn,
      endsOn: period.endsOn
    });
  }

  if (period.startsOn > period.endsOn) {
    raiseFinanceDomainError("allocation_invalid", "Ledger period start must be before or equal to period end.", {
      startsOn: period.startsOn,
      endsOn: period.endsOn
    });
  }
}
