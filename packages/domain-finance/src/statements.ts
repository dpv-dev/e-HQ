import type { CurrencyCode, MoneyAmount, MoneyMicroUnits } from "./types.js";
import { raiseFinanceDomainError } from "./errors.js";
import { addMoney, assertSameCurrency, createMoneyAmount, createMoneyMicroUnits } from "./money.js";

export interface StatementLineInput {
  readonly earningAllocationId: string;
  readonly sourceId: string;
  readonly payeeId: string;
  readonly trackId: string | null;
  readonly releaseId: string | null;
  readonly dsp: string | null;
  readonly country: string | null;
  readonly quantity: string;
  readonly grossShare: MoneyAmount;
  readonly recoupmentApplied: MoneyAmount;
  readonly netPayable: MoneyAmount;
}

export interface StatementAssemblyRequest {
  readonly statementId: string;
  readonly payeeId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: CurrencyCode;
  readonly version: number;
  readonly openingBalance: MoneyAmount;
  readonly lines: readonly StatementLineInput[];
}

export interface StatementLine {
  readonly statementId: string;
  readonly earningAllocationId: string;
  readonly sourceId: string;
  readonly trackId: string | null;
  readonly releaseId: string | null;
  readonly dsp: string | null;
  readonly country: string | null;
  readonly quantity: string;
  readonly grossShare: MoneyAmount;
  readonly recoupmentApplied: MoneyAmount;
  readonly netPayable: MoneyAmount;
}

export interface PayeeBalanceMovement {
  readonly payeeId: string;
  readonly currency: CurrencyCode;
  readonly statementId: string;
  readonly periodEnd: string;
  readonly openingBalance: MoneyAmount;
  readonly periodNet: MoneyAmount;
  readonly closingBalance: MoneyAmount;
  readonly movementType: "statement";
}

export interface StatementAuditRecord {
  readonly action: "generate_statement" | "payee_balance.carried";
  readonly entity_type: "statement" | "payee_balance";
  readonly entity_id: string;
  readonly payee: string;
  readonly gross_micro: MoneyMicroUnits;
  readonly recouped_micro: MoneyMicroUnits;
  readonly net_micro: MoneyMicroUnits;
  readonly amount_due_micro: MoneyMicroUnits;
  readonly closing_balance_micro: MoneyMicroUnits;
}

export interface StatementSummary {
  readonly id: string;
  readonly payeeId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: CurrencyCode;
  readonly grossTotal: MoneyAmount;
  readonly recoupmentTotal: MoneyAmount;
  readonly netPayable: MoneyAmount;
  readonly amountDue: MoneyAmount;
  readonly status: "generated";
  readonly version: number;
}

export interface StatementAssembly {
  readonly statement: StatementSummary;
  readonly lines: readonly StatementLine[];
  readonly balanceMovement: PayeeBalanceMovement;
  readonly auditRecords: readonly StatementAuditRecord[];
}

export interface CarryForwardResult {
  readonly amountDue: MoneyAmount;
  readonly closingBalance: MoneyAmount;
}

export function assembleStatement(request: StatementAssemblyRequest): StatementAssembly {
  assertStatementRequest(request);

  const zero = createMoneyAmount(createMoneyMicroUnits(0n), request.currency);
  const lines = request.lines.map((line: StatementLineInput) => normalizeStatementLine(request, line));
  const grossTotal = lines.map((line: StatementLine) => line.grossShare).reduce(addMoney, zero);
  const recoupmentTotal = lines.map((line: StatementLine) => line.recoupmentApplied).reduce(addMoney, zero);
  const netPayable = lines.map((line: StatementLine) => line.netPayable).reduce(addMoney, zero);
  assertStatementTotals(grossTotal, recoupmentTotal, netPayable);

  const carry = computeCarryForward(request.openingBalance, netPayable);
  const statement: StatementSummary = {
    id: request.statementId,
    payeeId: request.payeeId,
    periodStart: request.periodStart,
    periodEnd: request.periodEnd,
    currency: request.currency,
    grossTotal,
    recoupmentTotal,
    netPayable,
    amountDue: carry.amountDue,
    status: "generated",
    version: request.version
  };
  const balanceMovement: PayeeBalanceMovement = {
    payeeId: request.payeeId,
    currency: request.currency,
    statementId: request.statementId,
    periodEnd: request.periodEnd,
    openingBalance: request.openingBalance,
    periodNet: netPayable,
    closingBalance: carry.closingBalance,
    movementType: "statement"
  };

  return {
    statement,
    lines,
    balanceMovement,
    auditRecords: [
      createStatementAuditRecord("generate_statement", "statement", request.statementId, request.payeeId, statement, carry.closingBalance),
      createStatementAuditRecord("payee_balance.carried", "payee_balance", request.statementId, request.payeeId, statement, carry.closingBalance)
    ]
  };
}

export function computeCarryForward(openingBalance: MoneyAmount, periodNet: MoneyAmount): CarryForwardResult {
  assertSameCurrency(openingBalance, periodNet);
  const available = addMoney(openingBalance, periodNet);
  const zero = createMoneyAmount(createMoneyMicroUnits(0n), openingBalance.currency);
  return {
    amountDue: available.amountMicro > 0n ? available : zero,
    closingBalance: available.amountMicro < 0n ? available : zero
  };
}

function assertStatementRequest(request: StatementAssemblyRequest): void {
  if (request.statementId.length === 0 || request.payeeId.length === 0) {
    raiseFinanceDomainError("allocation_invalid", "Statement id and payee id are required.", {
      statementId: request.statementId,
      payeeId: request.payeeId
    });
  }

  if (!Number.isSafeInteger(request.version) || request.version < 1) {
    raiseFinanceDomainError("allocation_invalid", "Statement version must be a positive integer.", {
      version: String(request.version)
    });
  }

  if (request.lines.length === 0) {
    raiseFinanceDomainError("allocation_invalid", "Statement assembly requires at least one statement line.", {
      statementId: request.statementId
    });
  }

  if (request.openingBalance.currency !== request.currency) {
    raiseFinanceDomainError("currency_mismatch", "Statement opening balance must use the statement currency.", {
      statementCurrency: request.currency,
      openingCurrency: request.openingBalance.currency
    });
  }
}

function normalizeStatementLine(request: StatementAssemblyRequest, line: StatementLineInput): StatementLine {
  if (line.payeeId !== request.payeeId) {
    raiseFinanceDomainError("allocation_invalid", "Statement line payee must match statement payee.", {
      statementPayee: request.payeeId,
      linePayee: line.payeeId,
      earningAllocationId: line.earningAllocationId
    });
  }

  if (
    line.grossShare.currency !== request.currency ||
    line.recoupmentApplied.currency !== request.currency ||
    line.netPayable.currency !== request.currency
  ) {
    raiseFinanceDomainError("currency_mismatch", "Statement line amounts must use the statement currency.", {
      statementCurrency: request.currency,
      earningAllocationId: line.earningAllocationId
    });
  }

  const lineCheck = addMoney(line.recoupmentApplied, line.netPayable);
  if (lineCheck.amountMicro !== line.grossShare.amountMicro) {
    raiseFinanceDomainError("allocation_invalid", "Statement line recoupment plus net payable must equal gross share.", {
      earningAllocationId: line.earningAllocationId,
      grossMicro: line.grossShare.amountMicro.toString(),
      recoupedMicro: line.recoupmentApplied.amountMicro.toString(),
      netMicro: line.netPayable.amountMicro.toString()
    });
  }

  return {
    statementId: request.statementId,
    earningAllocationId: line.earningAllocationId,
    sourceId: line.sourceId,
    trackId: line.trackId,
    releaseId: line.releaseId,
    dsp: line.dsp,
    country: line.country,
    quantity: line.quantity,
    grossShare: line.grossShare,
    recoupmentApplied: line.recoupmentApplied,
    netPayable: line.netPayable
  };
}

function assertStatementTotals(grossTotal: MoneyAmount, recoupmentTotal: MoneyAmount, netPayable: MoneyAmount): void {
  const lineTotal = addMoney(recoupmentTotal, netPayable);
  if (lineTotal.amountMicro !== grossTotal.amountMicro) {
    raiseFinanceDomainError("allocation_invalid", "Statement totals must reconcile: recoupment total plus net payable equals gross total.", {
      grossMicro: grossTotal.amountMicro.toString(),
      recoupedMicro: recoupmentTotal.amountMicro.toString(),
      netMicro: netPayable.amountMicro.toString()
    });
  }
}

function createStatementAuditRecord(
  action: StatementAuditRecord["action"],
  entityType: StatementAuditRecord["entity_type"],
  entityId: string,
  payeeId: string,
  statement: StatementSummary,
  closingBalance: MoneyAmount
): StatementAuditRecord {
  assertSameCurrency(statement.amountDue, closingBalance);
  return {
    action,
    entity_type: entityType,
    entity_id: entityId,
    payee: payeeId,
    gross_micro: statement.grossTotal.amountMicro,
    recouped_micro: statement.recoupmentTotal.amountMicro,
    net_micro: statement.netPayable.amountMicro,
    amount_due_micro: statement.amountDue.amountMicro,
    closing_balance_micro: closingBalance.amountMicro
  };
}
