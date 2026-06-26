import type { AllocationLine, MoneyAmount, MoneyMicroUnits } from "./types.js";
import { raiseFinanceDomainError } from "./errors.js";
import { addMoney, assertSameCurrency, createMoneyAmount, createMoneyMicroUnits, subtractMoney } from "./money.js";

export type RecoupableExpenseStatus = "open" | "partially-recovered" | "recovered" | "deleted" | "non-recoverable";

export interface RecoupableExpense {
  readonly id: string;
  readonly contractId: string;
  readonly payeeId: string | null;
  readonly amount: MoneyAmount;
  readonly appliedAmount: MoneyAmount;
  readonly recoupable: boolean;
  readonly status: RecoupableExpenseStatus;
  readonly expenseDate: string | null;
}

export interface RecoupmentAuditRecord {
  readonly payee: string;
  readonly expense_id: string;
  readonly applied_micro: MoneyMicroUnits;
  readonly balance_before: MoneyMicroUnits;
  readonly balance_after: MoneyMicroUnits;
}

export interface RecoupmentApplication {
  readonly expenseId: string;
  readonly appliedAmount: MoneyAmount;
  readonly balanceBefore: MoneyAmount;
  readonly balanceAfter: MoneyAmount;
}

export interface RecoupmentRequest {
  readonly allocationLine: AllocationLine;
  readonly contractId: string | null;
  readonly payeeId: string;
  readonly role: string;
  readonly openExpenses: readonly RecoupableExpense[];
}

export interface RecoupmentResult {
  readonly allocationLine: AllocationLine;
  readonly recoupedAmount: MoneyAmount;
  readonly netPayable: MoneyAmount;
  readonly openBalanceBefore: MoneyAmount;
  readonly openBalanceAfter: MoneyAmount;
  readonly applications: readonly RecoupmentApplication[];
  readonly auditRecords: readonly RecoupmentAuditRecord[];
  readonly expensesAfter: readonly RecoupableExpense[];
}

export function applyRecoupments(request: RecoupmentRequest): RecoupmentResult {
  if (request.payeeId.length === 0) {
    raiseFinanceDomainError("allocation_invalid", "Recoupment payee id is required.", {
      sourceId: request.allocationLine.sourceId
    });
  }

  if (request.allocationLine.grossAmount.amountMicro < 0n) {
    raiseFinanceDomainError("allocation_invalid", "Recoupment earnings must be non-negative.", {
      sourceId: request.allocationLine.sourceId,
      grossMicro: request.allocationLine.grossAmount.amountMicro.toString()
    });
  }

  const eligibleExpenses = selectEligibleExpenses(request);
  const openBalanceBefore = sumExpenseOpenBalances(eligibleExpenses, request.allocationLine.grossAmount);
  const zero = createMoneyAmount(createMoneyMicroUnits(0n), request.allocationLine.grossAmount.currency);
  if (request.contractId === null || request.role === "label" || eligibleExpenses.length === 0 || openBalanceBefore.amountMicro <= 0n) {
    return {
      allocationLine: request.allocationLine,
      recoupedAmount: zero,
      netPayable: request.allocationLine.grossAmount,
      openBalanceBefore,
      openBalanceAfter: openBalanceBefore,
      applications: [],
      auditRecords: [],
      expensesAfter: request.openExpenses
    };
  }

  let remainingEarnings = request.allocationLine.grossAmount;
  const applications: RecoupmentApplication[] = [];
  const auditRecords: RecoupmentAuditRecord[] = [];
  const appliedByExpenseId = new Map<string, MoneyAmount>();

  for (const expense of eligibleExpenses) {
    if (remainingEarnings.amountMicro <= 0n) {
      break;
    }

    const balanceBefore = expenseOpenBalance(expense);
    if (balanceBefore.amountMicro <= 0n) {
      continue;
    }

    const appliedAmount = minMoney(remainingEarnings, balanceBefore);
    const balanceAfter = subtractMoney(balanceBefore, appliedAmount);
    applications.push({
      expenseId: expense.id,
      appliedAmount,
      balanceBefore,
      balanceAfter
    });
    auditRecords.push({
      payee: request.payeeId,
      expense_id: expense.id,
      applied_micro: appliedAmount.amountMicro,
      balance_before: balanceBefore.amountMicro,
      balance_after: balanceAfter.amountMicro
    });
    appliedByExpenseId.set(expense.id, appliedAmount);
    remainingEarnings = subtractMoney(remainingEarnings, appliedAmount);
  }

  const recoupedAmount = applications
    .map((application: RecoupmentApplication) => application.appliedAmount)
    .reduce((sum: MoneyAmount, amount: MoneyAmount) => addMoney(sum, amount), zero);
  const netPayable = subtractMoney(request.allocationLine.grossAmount, recoupedAmount);
  const openBalanceAfter = subtractMoney(openBalanceBefore, recoupedAmount);
  assertRecoupmentConserved(request.allocationLine.grossAmount, recoupedAmount, netPayable, openBalanceBefore, openBalanceAfter);

  return {
    allocationLine: {
      ...request.allocationLine,
      recoupmentAmount: recoupedAmount,
      netAmount: netPayable
    },
    recoupedAmount,
    netPayable,
    openBalanceBefore,
    openBalanceAfter,
    applications,
    auditRecords,
    expensesAfter: request.openExpenses.map((expense: RecoupableExpense) => applyExpenseRecovery(expense, appliedByExpenseId))
  };
}

export function expenseOpenBalance(expense: RecoupableExpense): MoneyAmount {
  assertSameCurrency(expense.amount, expense.appliedAmount);
  const balance = subtractMoney(expense.amount, expense.appliedAmount);
  if (balance.amountMicro < 0n) {
    raiseFinanceDomainError("allocation_invalid", "Recoupable expense has more applied recovery than its source amount.", {
      expenseId: expense.id,
      amountMicro: expense.amount.amountMicro.toString(),
      appliedMicro: expense.appliedAmount.amountMicro.toString()
    });
  }

  return balance;
}

export function compareRecoupableExpenseOrder(left: RecoupableExpense, right: RecoupableExpense): number {
  const leftDate = left.expenseDate ?? "";
  const rightDate = right.expenseDate ?? "";
  if (leftDate !== rightDate) {
    return leftDate < rightDate ? -1 : 1;
  }

  return compareExpenseIds(left.id, right.id);
}

function selectEligibleExpenses(request: RecoupmentRequest): readonly RecoupableExpense[] {
  if (request.contractId === null || request.role === "label") {
    return [];
  }

  return request.openExpenses
    .filter((expense: RecoupableExpense) => isEligibleExpense(expense, request))
    .sort(compareRecoupableExpenseOrder);
}

function isEligibleExpense(expense: RecoupableExpense, request: RecoupmentRequest): boolean {
  assertSameCurrency(expense.amount, expense.appliedAmount);
  if (expense.amount.currency !== request.allocationLine.grossAmount.currency) {
    return false;
  }

  return (
    expense.contractId === request.contractId &&
    expense.recoupable &&
    (expense.status === "open" || expense.status === "partially-recovered") &&
    (expense.payeeId === null || expense.payeeId === request.payeeId)
  );
}

function sumExpenseOpenBalances(expenses: readonly RecoupableExpense[], referenceAmount: MoneyAmount): MoneyAmount {
  const zero = createMoneyAmount(createMoneyMicroUnits(0n), referenceAmount.currency);
  return expenses
    .map((expense: RecoupableExpense) => expenseOpenBalance(expense))
    .reduce((sum: MoneyAmount, balance: MoneyAmount) => addMoney(sum, balance), zero);
}

function minMoney(left: MoneyAmount, right: MoneyAmount): MoneyAmount {
  assertSameCurrency(left, right);
  return left.amountMicro <= right.amountMicro ? left : right;
}

function applyExpenseRecovery(
  expense: RecoupableExpense,
  appliedByExpenseId: ReadonlyMap<string, MoneyAmount>
): RecoupableExpense {
  const appliedAmount = appliedByExpenseId.get(expense.id);
  if (appliedAmount === undefined) {
    return expense;
  }

  assertSameCurrency(expense.appliedAmount, appliedAmount);
  const nextAppliedAmount = addMoney(expense.appliedAmount, appliedAmount);
  const balanceAfter = subtractMoney(expense.amount, nextAppliedAmount);
  const nextStatus: RecoupableExpenseStatus = balanceAfter.amountMicro === 0n ? "recovered" : "partially-recovered";
  return {
    ...expense,
    appliedAmount: nextAppliedAmount,
    status: nextStatus
  };
}

function assertRecoupmentConserved(
  earnings: MoneyAmount,
  recoupedAmount: MoneyAmount,
  netPayable: MoneyAmount,
  openBalanceBefore: MoneyAmount,
  openBalanceAfter: MoneyAmount
): void {
  const earningsCheck = addMoney(recoupedAmount, netPayable);
  if (earningsCheck.amountMicro !== earnings.amountMicro) {
    raiseFinanceDomainError("allocation_invalid", "Recouped amount plus net payable must equal earnings.", {
      earningsMicro: earnings.amountMicro.toString(),
      recoupedMicro: recoupedAmount.amountMicro.toString(),
      netPayableMicro: netPayable.amountMicro.toString()
    });
  }

  const balanceCheck = subtractMoney(openBalanceBefore, recoupedAmount);
  if (balanceCheck.amountMicro !== openBalanceAfter.amountMicro || openBalanceAfter.amountMicro < 0n) {
    raiseFinanceDomainError("allocation_invalid", "Open balance after recoupment must equal open balance before minus recouped amount and never be negative.", {
      openBeforeMicro: openBalanceBefore.amountMicro.toString(),
      recoupedMicro: recoupedAmount.amountMicro.toString(),
      openAfterMicro: openBalanceAfter.amountMicro.toString()
    });
  }
}

function compareExpenseIds(left: string, right: string): number {
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    const leftId = BigInt(left);
    const rightId = BigInt(right);
    if (leftId === rightId) {
      return 0;
    }

    return leftId < rightId ? -1 : 1;
  }

  return left.localeCompare(right);
}
