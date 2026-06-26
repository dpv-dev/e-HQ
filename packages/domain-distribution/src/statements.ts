import { erhMoney } from "@ehq/domain-finance";

export interface DistributionStatementPeriod {
  readonly start: string;
  readonly end: string;
}

export interface DistributionPayeeInput {
  readonly id: string;
}

export interface StatementAllocationInput {
  readonly id: string;
  readonly payeeId: string;
  readonly trackId: string | null;
  readonly currency: string;
  readonly grossShare: string;
  readonly recoupmentApplied: string;
  readonly netPayable: string;
  readonly quantity: string;
}

export interface PayeeBalanceLedgerInput {
  readonly id: string;
  readonly payeeId: string;
  readonly statementId: string | null;
  readonly currency: string;
  readonly openingBalance: string;
  readonly periodNet: string;
  readonly closingBalance: string;
  readonly movementType: "opening" | "period" | "statement" | "void_reversal" | "adjustment" | "carry_forward";
  readonly createdAt: string;
}

export interface DistributionCarryResult {
  readonly opening: string;
  readonly periodNet: string;
  readonly available: string;
  readonly amountDue: string;
  readonly closing: string;
}

export interface StatementInsertPlan {
  readonly payeeId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: string;
  readonly grossTotal: string;
  readonly recoupmentTotal: string;
  readonly netPayable: string;
  readonly amountDue: string;
  readonly version: number;
  readonly status: "generated";
}

export interface StatementLineInsertPlan {
  readonly earningAllocationId: string;
  readonly trackId: string | null;
  readonly grossShare: string;
  readonly recoupmentApplied: string;
  readonly netPayable: string;
  readonly quantity: string;
  readonly currency: string;
}

export interface PayeeBalanceInsertPlan {
  readonly payeeId: string;
  readonly statementId: string | null;
  readonly currency: string;
  readonly openingBalance: string;
  readonly periodNet: string;
  readonly closingBalance: string;
  readonly movementType: "statement" | "void_reversal";
}

export interface DistributionStatementPlan {
  readonly statement: StatementInsertPlan;
  readonly lines: readonly StatementLineInsertPlan[];
  readonly balanceLedgerRow: PayeeBalanceInsertPlan;
}

export interface StatementForVoidInput {
  readonly id: string;
  readonly status: string;
}

export interface StatementStatusUpdate {
  readonly id: string;
  readonly status: "void";
}

export interface DistributionStatementVoidPlan {
  readonly reversalLedgerRow: PayeeBalanceInsertPlan;
  readonly statementStatusUpdate: StatementStatusUpdate;
}

export interface StatementPaymentLinkInput {
  readonly statementId: string;
  readonly amountApplied: string;
  readonly currency: string;
}

export interface StatementBalanceInput {
  readonly id: string;
  readonly currency: string;
  readonly amountDue: string;
}

export interface StatementBalanceResult {
  readonly statementId: string;
  readonly currency: string;
  readonly amountDue: string;
  readonly paymentsApplied: string;
  readonly statementBalance: string;
}

export interface StatementGroupTotal {
  readonly currency: string;
  readonly statementBalance: string;
}

interface StatementAccumulator {
  readonly currency: string;
  grossTotalUnits: bigint;
  recoupmentTotalUnits: bigint;
  netPayableUnits: bigint;
}

export function computeCarry(opening: string, periodNet: string): DistributionCarryResult {
  const openingUnits = parseErhAmount(opening);
  const periodNetUnits = parseErhAmount(periodNet);
  const availableUnits = erhMoney.add(openingUnits, periodNetUnits);
  const amountDueUnits = availableUnits > 0n ? availableUnits : 0n;
  const closingUnits = availableUnits < 0n ? availableUnits : 0n;

  return {
    opening: formatErhAmount(openingUnits),
    periodNet: formatErhAmount(periodNetUnits),
    available: formatErhAmount(availableUnits),
    amountDue: formatErhAmount(amountDueUnits),
    closing: formatErhAmount(closingUnits)
  };
}

export function buildStatementPlan(
  payee: DistributionPayeeInput,
  period: DistributionStatementPeriod,
  currency: string,
  allocations: readonly StatementAllocationInput[],
  lastClosing: string,
  version: number
): DistributionStatementPlan {
  const periodAllocations = allocations.filter((allocation) => allocation.payeeId === payee.id && allocation.currency === currency);
  const totals = sumAllocations(currency, periodAllocations);
  const carry = computeCarry(lastClosing, formatErhAmount(totals.netPayableUnits));

  return {
    statement: {
      payeeId: payee.id,
      periodStart: period.start,
      periodEnd: period.end,
      currency,
      grossTotal: formatErhAmount(totals.grossTotalUnits),
      recoupmentTotal: formatErhAmount(totals.recoupmentTotalUnits),
      netPayable: formatErhAmount(totals.netPayableUnits),
      amountDue: carry.amountDue,
      version,
      status: "generated"
    },
    lines: periodAllocations.map((allocation) => ({
      earningAllocationId: allocation.id,
      trackId: allocation.trackId,
      grossShare: formatErhAmount(parseErhAmount(allocation.grossShare)),
      recoupmentApplied: formatErhAmount(parseErhAmount(allocation.recoupmentApplied)),
      netPayable: formatErhAmount(parseErhAmount(allocation.netPayable)),
      quantity: allocation.quantity,
      currency
    })),
    balanceLedgerRow: {
      payeeId: payee.id,
      statementId: null,
      currency,
      openingBalance: carry.opening,
      periodNet: carry.periodNet,
      closingBalance: carry.closing,
      movementType: "statement"
    }
  };
}

export function buildStatementsForPeriod(
  payees: readonly DistributionPayeeInput[],
  period: DistributionStatementPeriod,
  allocations: readonly StatementAllocationInput[],
  lastClosings: readonly PayeeBalanceLedgerInput[]
): readonly DistributionStatementPlan[] {
  const activeKeys = new Set(allocations.map((allocation) => `${allocation.payeeId}:${allocation.currency}`));
  const plans: DistributionStatementPlan[] = [];
  for (const key of activeKeys) {
    const [payeeId, currency] = key.split(":");
    if (payeeId === undefined || currency === undefined) {
      continue;
    }

    const payee = payees.find((candidate) => candidate.id === payeeId);
    if (payee === undefined) {
      continue;
    }

    plans.push(buildStatementPlan(payee, period, currency, allocations, findLastClosing(payeeId, currency, lastClosings), 1));
  }

  return plans;
}

export function buildVoidPlan(statement: StatementForVoidInput, ledgerRow: PayeeBalanceLedgerInput): DistributionStatementVoidPlan {
  const reversalNetUnits = -parseErhAmount(ledgerRow.periodNet);
  return {
    reversalLedgerRow: {
      payeeId: ledgerRow.payeeId,
      statementId: statement.id,
      currency: ledgerRow.currency,
      openingBalance: formatErhAmount(parseErhAmount(ledgerRow.closingBalance)),
      periodNet: formatErhAmount(reversalNetUnits),
      closingBalance: formatErhAmount(parseErhAmount(ledgerRow.openingBalance)),
      movementType: "void_reversal"
    },
    statementStatusUpdate: {
      id: statement.id,
      status: "void"
    }
  };
}

export function computeStatementBalance(
  statement: StatementBalanceInput,
  paymentLinks: readonly StatementPaymentLinkInput[]
): StatementBalanceResult {
  const paymentUnits = sumPaymentsForStatement(statement.id, statement.currency, paymentLinks);
  const amountDueUnits = parseErhAmount(statement.amountDue);
  const balanceUnits = erhMoney.sub(amountDueUnits, paymentUnits);

  return {
    statementId: statement.id,
    currency: statement.currency,
    amountDue: formatErhAmount(amountDueUnits),
    paymentsApplied: formatErhAmount(paymentUnits),
    statementBalance: formatErhAmount(balanceUnits)
  };
}

export function computeStatementGroupTotals(
  statements: readonly StatementBalanceInput[],
  paymentLinks: readonly StatementPaymentLinkInput[]
): readonly StatementGroupTotal[] {
  const totals = new Map<string, bigint>();
  for (const statement of statements) {
    const balance = computeStatementBalance(statement, paymentLinks);
    const current = totals.get(balance.currency) ?? 0n;
    totals.set(balance.currency, erhMoney.add(current, parseErhAmount(balance.statementBalance)));
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, units]) => ({
      currency,
      statementBalance: formatErhAmount(units)
    }));
}

function sumAllocations(currency: string, allocations: readonly StatementAllocationInput[]): StatementAccumulator {
  const accumulator: StatementAccumulator = {
    currency,
    grossTotalUnits: 0n,
    recoupmentTotalUnits: 0n,
    netPayableUnits: 0n
  };
  for (const allocation of allocations) {
    accumulator.grossTotalUnits = erhMoney.add(accumulator.grossTotalUnits, parseErhAmount(allocation.grossShare));
    accumulator.recoupmentTotalUnits = erhMoney.add(accumulator.recoupmentTotalUnits, parseErhAmount(allocation.recoupmentApplied));
    accumulator.netPayableUnits = erhMoney.add(accumulator.netPayableUnits, parseErhAmount(allocation.netPayable));
  }

  return accumulator;
}

function sumPaymentsForStatement(statementId: string, currency: string, paymentLinks: readonly StatementPaymentLinkInput[]): bigint {
  return paymentLinks
    .filter((link) => link.statementId === statementId && link.currency === currency)
    .reduce((sum: bigint, link: StatementPaymentLinkInput) => erhMoney.add(sum, parseErhAmount(link.amountApplied)), 0n);
}

function findLastClosing(payeeId: string, currency: string, rows: readonly PayeeBalanceLedgerInput[]): string {
  const candidates = rows
    .filter((row) => row.payeeId === payeeId && row.currency === currency)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const latest = candidates[0];
  return latest?.closingBalance ?? "0.0000000000";
}

function parseErhAmount(value: string): bigint {
  return erhMoney.parse(value);
}

function formatErhAmount(value: bigint): string {
  return erhMoney.format(value);
}
