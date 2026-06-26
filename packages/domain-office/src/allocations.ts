import type { Department, ExchangeRate, FinancialAllocation, ProjectDepartment, SharedCostRule, Transaction } from "@ehq/db";
import { BASIS_POINTS_PER_WHOLE, splitRemainderLast } from "@ehq/domain-finance";

export type OfficeWriteTransactionStatus = Transaction["status"];
export type OfficeWriteTransactionRow = Omit<
  Pick<
    Transaction,
    | "id"
    | "type"
    | "status"
    | "categoryId"
    | "projectId"
    | "amountMinor"
    | "originalAmountMinor"
    | "originalCurrency"
    | "exchangeRateE10"
    | "vatApplicable"
    | "vatAmountMinor"
    | "transactionDate"
  >,
  "status"
> & {
  readonly status: OfficeWriteTransactionStatus;
};
export type OfficeWriteDepartmentRow = Pick<Department, "id" | "isActive">;
export type OfficeWriteExchangeRateRow = Pick<ExchangeRate, "fromCurrency" | "toCurrency" | "rateE10" | "effectiveDate">;
export type OfficeWriteSharedCostRuleRow = Pick<SharedCostRule, "id" | "sourceCategoryId" | "targetDepartmentId" | "percentageBp" | "isActive">;
export type OfficeWriteProjectDepartmentRow = Pick<ProjectDepartment, "projectId" | "departmentId">;
export type OfficeWriteExistingAllocationRow = Pick<FinancialAllocation, "id" | "transactionId" | "departmentId" | "roleSlug" | "percentageBp" | "amountMinor">;

export type OfficeValidationFailureReason =
  | "amount_invalid"
  | "fx_missing"
  | "vat_missing"
  | "allocations_missing"
  | "allocations_incomplete";

export type OfficeAllocationErrorCode =
  | "transaction_not_found"
  | "transaction_read_only"
  | "department_invalid"
  | "allocation_invalid"
  | "role_invalid"
  | "shared_cost_rules_incomplete"
  | "shared_cost_split_invalid"
  | "allocations_incomplete";

export interface OfficeAllocationError extends Error {
  readonly code: OfficeAllocationErrorCode;
  readonly context: Readonly<Record<string, string>>;
}

export interface OfficeIncomingAllocation {
  readonly departmentId: string;
  readonly percentageBp: number;
  readonly amountMinor: bigint;
  readonly roleSlug: string | null;
}

export interface OfficePersistedAllocationInput {
  readonly transactionId: string;
  readonly departmentId: string;
  readonly percentageBp: number;
  readonly amountMinor: bigint;
  readonly roleSlug: string;
}

export interface OfficeAllocationCompleteness {
  readonly complete: boolean;
  readonly percentageBpTotal: number;
  readonly amountMinorTotal: bigint;
  readonly percentageBpDelta: number;
  readonly amountMinorDelta: bigint;
}

export type OfficeTransactionValidationResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly reason: OfficeValidationFailureReason;
      readonly context: Readonly<Record<string, string>>;
    };

export interface OfficeAllocationReplaceDataset {
  readonly transactions: readonly OfficeWriteTransactionRow[];
  readonly departments: readonly OfficeWriteDepartmentRow[];
  readonly existingAllocations: readonly OfficeWriteExistingAllocationRow[];
  readonly sharedCostRules: readonly OfficeWriteSharedCostRuleRow[];
  readonly projectDepartments: readonly OfficeWriteProjectDepartmentRow[];
}

export interface OfficeAllocationReplaceRequest {
  readonly transactionId: string;
  readonly allocations: readonly OfficeIncomingAllocation[];
  readonly knownRoleSlugs: readonly string[];
  readonly actorUserId: string;
  readonly now: string;
}

export interface OfficeProjectDepartmentInsert {
  readonly projectId: string;
  readonly departmentId: string;
}

export interface OfficeAllocationAlert {
  readonly level: "info";
  readonly code: "project_department_auto_added";
  readonly projectId: string;
  readonly departmentId: string;
  readonly message: string;
}

export interface OfficeAllocationAuditEvent {
  readonly type: "office.allocations.replace";
  readonly transactionId: string;
  readonly actorUserId: string;
  readonly occurredAt: string;
  readonly before: readonly OfficeWriteExistingAllocationRow[];
  readonly after: readonly OfficePersistedAllocationInput[];
}

export interface OfficeAllocationReplacePlan {
  readonly transactionId: string;
  readonly deleteExistingAllocations: true;
  readonly insertAllocations: readonly OfficePersistedAllocationInput[];
  readonly insertProjectDepartments: readonly OfficeProjectDepartmentInsert[];
  readonly alerts: readonly OfficeAllocationAlert[];
  readonly auditEvent: OfficeAllocationAuditEvent;
}

export function createOfficeAllocationError(
  code: OfficeAllocationErrorCode,
  message: string,
  context: Readonly<Record<string, string>>
): OfficeAllocationError {
  const error = new Error(message) as OfficeAllocationError;
  Object.defineProperty(error, "name", { value: "OfficeAllocationError", enumerable: true });
  Object.defineProperty(error, "code", { value: code, enumerable: true });
  Object.defineProperty(error, "context", { value: context, enumerable: true });
  return error;
}

export function allocationsAreComplete(txAmountMinor: bigint, allocations: readonly OfficeIncomingAllocation[]): boolean {
  return describeAllocationCompleteness(txAmountMinor, allocations).complete;
}

export function describeAllocationCompleteness(txAmountMinor: bigint, allocations: readonly OfficeIncomingAllocation[]): OfficeAllocationCompleteness {
  const percentageBpTotal = allocations.reduce((sum: number, allocation: OfficeIncomingAllocation) => sum + allocation.percentageBp, 0);
  const amountMinorTotal = allocations.reduce((sum: bigint, allocation: OfficeIncomingAllocation) => sum + allocation.amountMinor, 0n);
  const percentageBpDelta = percentageBpTotal - BASIS_POINTS_PER_WHOLE;
  const amountMinorDelta = amountMinorTotal - txAmountMinor;

  return {
    complete: absoluteBpDelta(percentageBpDelta) <= 1 && absoluteBigInt(amountMinorDelta) <= 1n,
    percentageBpTotal,
    amountMinorTotal,
    percentageBpDelta,
    amountMinorDelta
  };
}

export function transactionCanBeValidated(
  transaction: OfficeWriteTransactionRow,
  allocations: readonly OfficeIncomingAllocation[],
  exchangeRates: readonly OfficeWriteExchangeRateRow[]
): OfficeTransactionValidationResult {
  if (transaction.amountMinor < 0n) {
    return failure("amount_invalid", {
      transactionId: transaction.id,
      amountMinor: transaction.amountMinor.toString()
    });
  }

  if (transaction.amountMinor === 0n && allocations.length > 0) {
    return failure("amount_invalid", {
      transactionId: transaction.id,
      amountMinor: transaction.amountMinor.toString(),
      allocationCount: String(allocations.length)
    });
  }

  if (requiresFx(transaction) && !hasMatchingFx(transaction, exchangeRates)) {
    return failure("fx_missing", {
      transactionId: transaction.id,
      originalCurrency: transaction.originalCurrency ?? ""
    });
  }

  if (transaction.vatApplicable && transaction.vatAmountMinor <= 0n) {
    return failure("vat_missing", {
      transactionId: transaction.id,
      vatAmountMinor: transaction.vatAmountMinor.toString()
    });
  }

  if (allocations.length === 0) {
    if (transaction.amountMinor === 0n) {
      return { ok: true };
    }

    return failure("allocations_missing", {
      transactionId: transaction.id,
      amountMinor: transaction.amountMinor.toString()
    });
  }

  const completeness = describeAllocationCompleteness(transaction.amountMinor, allocations);
  if (!completeness.complete) {
    return failure("allocations_incomplete", {
      transactionId: transaction.id,
      percentageBpTotal: String(completeness.percentageBpTotal),
      amountMinorTotal: completeness.amountMinorTotal.toString(),
      amountMinor: transaction.amountMinor.toString()
    });
  }

  return { ok: true };
}

export function createReplaceAllocationsPlan(
  dataset: OfficeAllocationReplaceDataset,
  request: OfficeAllocationReplaceRequest
): OfficeAllocationReplacePlan {
  const transaction = findTransaction(dataset.transactions, request.transactionId);
  assertTransactionWritable(transaction);
  const normalizedInput = normalizeIncomingAllocations(dataset.departments, request.allocations, request.knownRoleSlugs);
  const insertAllocations = expandSharedCostAllocations(dataset, transaction, normalizedInput);
  assertPersistedAllocationsComplete(transaction, insertAllocations);
  const existingAllocations = dataset.existingAllocations.filter((allocation) => allocation.transactionId === transaction.id);
  const autoAddProjectDepartments = buildProjectDepartmentInserts(transaction, dataset.projectDepartments, insertAllocations);
  const alerts = autoAddProjectDepartments.map((insert) => ({
    level: "info" as const,
    code: "project_department_auto_added" as const,
    projectId: insert.projectId,
    departmentId: insert.departmentId,
    message: "Project department was added because an allocation targets it."
  }));

  return {
    transactionId: transaction.id,
    deleteExistingAllocations: true,
    insertAllocations,
    insertProjectDepartments: autoAddProjectDepartments,
    alerts,
    auditEvent: {
      type: "office.allocations.replace",
      transactionId: transaction.id,
      actorUserId: request.actorUserId,
      occurredAt: request.now,
      before: existingAllocations,
      after: insertAllocations
    }
  };
}

function normalizeIncomingAllocations(
  departments: readonly OfficeWriteDepartmentRow[],
  allocations: readonly OfficeIncomingAllocation[],
  knownRoleSlugs: readonly string[]
): readonly OfficeIncomingAllocation[] {
  return allocations.map((allocation) => {
    assertDepartmentActive(departments, allocation.departmentId);
    assertIncomingAllocation(allocation);
    assertRoleAllowed(knownRoleSlugs, allocation.roleSlug);
    return {
      departmentId: allocation.departmentId,
      percentageBp: allocation.percentageBp,
      amountMinor: allocation.amountMinor,
      roleSlug: allocation.roleSlug
    };
  });
}

function expandSharedCostAllocations(
  dataset: OfficeAllocationReplaceDataset,
  transaction: OfficeWriteTransactionRow,
  allocations: readonly OfficeIncomingAllocation[]
): readonly OfficePersistedAllocationInput[] {
  if (transaction.categoryId === null) {
    return allocations.map((allocation) => toPersistedAllocation(transaction.id, allocation));
  }

  const activeRules = dataset.sharedCostRules.filter((rule) => rule.isActive && rule.sourceCategoryId === transaction.categoryId);
  if (activeRules.length === 0) {
    return allocations.map((allocation) => toPersistedAllocation(transaction.id, allocation));
  }

  const rulesTotal = activeRules.reduce((sum: number, rule: OfficeWriteSharedCostRuleRow) => sum + rule.percentageBp, 0);
  if (absoluteBpDelta(rulesTotal - BASIS_POINTS_PER_WHOLE) > 1) {
    raiseOfficeAllocationError("shared_cost_rules_incomplete", "Shared-cost rules must sum to 10000 basis points within the EOF tolerance.", {
      transactionId: transaction.id,
      categoryId: transaction.categoryId,
      percentageBpTotal: String(rulesTotal)
    });
  }

  const adjustedRules = normalizeSharedCostRules(activeRules, rulesTotal, transaction.id);
  const weights = adjustedRules.map((rule) => rule.percentageBp);
  const parts = splitRemainderLast(transaction.amountMinor, weights);
  return adjustedRules.map((rule, index) => {
    assertDepartmentActive(dataset.departments, rule.targetDepartmentId);
    const amountMinor = parts[index];
    if (amountMinor === undefined || amountMinor < 0n) {
      raiseOfficeAllocationError("shared_cost_split_invalid", "Shared-cost expansion produced an invalid allocation amount.", {
        transactionId: transaction.id,
        targetDepartmentId: rule.targetDepartmentId,
        amountMinor: amountMinor?.toString() ?? ""
      });
    }

    return {
      transactionId: transaction.id,
      departmentId: rule.targetDepartmentId,
      percentageBp: rule.percentageBp,
      amountMinor,
      roleSlug: ""
    };
  });
}

function normalizeSharedCostRules(
  rules: readonly OfficeWriteSharedCostRuleRow[],
  percentageBpTotal: number,
  transactionId: string
): readonly OfficeWriteSharedCostRuleRow[] {
  const delta = BASIS_POINTS_PER_WHOLE - percentageBpTotal;
  if (delta === 0) {
    return rules;
  }

  const lastRule = rules.at(-1);
  if (lastRule === undefined) {
    raiseOfficeAllocationError("shared_cost_rules_incomplete", "Shared-cost expansion requires at least one active rule.", {
      transactionId
    });
  }

  const adjustedPercentageBp = lastRule.percentageBp + delta;
  if (adjustedPercentageBp < 0 || adjustedPercentageBp > BASIS_POINTS_PER_WHOLE) {
    raiseOfficeAllocationError("shared_cost_rules_incomplete", "Shared-cost tolerance adjustment would produce an invalid basis-point rule.", {
      transactionId,
      ruleId: lastRule.id,
      adjustedPercentageBp: String(adjustedPercentageBp)
    });
  }

  return rules.map((rule) => (rule.id === lastRule.id ? { ...rule, percentageBp: adjustedPercentageBp } : rule));
}

function assertPersistedAllocationsComplete(transaction: OfficeWriteTransactionRow, allocations: readonly OfficePersistedAllocationInput[]): void {
  const incomingShape = allocations.map((allocation) => ({
    departmentId: allocation.departmentId,
    percentageBp: allocation.percentageBp,
    amountMinor: allocation.amountMinor,
    roleSlug: allocation.roleSlug
  }));
  const completeness = describeAllocationCompleteness(transaction.amountMinor, incomingShape);
  if (!completeness.complete) {
    raiseOfficeAllocationError("allocations_incomplete", "Allocations must reconcile to the transaction before replacement.", {
      transactionId: transaction.id,
      percentageBpTotal: String(completeness.percentageBpTotal),
      amountMinorTotal: completeness.amountMinorTotal.toString(),
      amountMinor: transaction.amountMinor.toString()
    });
  }
}

function buildProjectDepartmentInserts(
  transaction: OfficeWriteTransactionRow,
  existingProjectDepartments: readonly OfficeWriteProjectDepartmentRow[],
  allocations: readonly OfficePersistedAllocationInput[]
): readonly OfficeProjectDepartmentInsert[] {
  if (transaction.projectId === null) {
    return [];
  }

  const existing = new Set(
    existingProjectDepartments
      .filter((link) => link.projectId === transaction.projectId)
      .map((link) => `${link.projectId}:${link.departmentId}`)
  );
  const inserts = new Map<string, OfficeProjectDepartmentInsert>();
  for (const allocation of allocations) {
    const key = `${transaction.projectId}:${allocation.departmentId}`;
    if (!existing.has(key)) {
      inserts.set(key, {
        projectId: transaction.projectId,
        departmentId: allocation.departmentId
      });
    }
  }

  return [...inserts.values()];
}

function findTransaction(transactions: readonly OfficeWriteTransactionRow[], transactionId: string): OfficeWriteTransactionRow {
  const transaction = transactions.find((row) => row.id === transactionId);
  if (transaction === undefined) {
    raiseOfficeAllocationError("transaction_not_found", "Transaction was not found for allocation replacement.", {
      transactionId
    });
  }

  return transaction;
}

function assertTransactionWritable(transaction: OfficeWriteTransactionRow): void {
  if (transaction.status === "validated" || transaction.status === "cancelled") {
    raiseOfficeAllocationError("transaction_read_only", "Validated or cancelled transactions cannot have allocations replaced.", {
      transactionId: transaction.id,
      status: transaction.status
    });
  }
}

function assertIncomingAllocation(allocation: OfficeIncomingAllocation): void {
  if (!Number.isSafeInteger(allocation.percentageBp) || allocation.percentageBp <= 0 || allocation.percentageBp > BASIS_POINTS_PER_WHOLE) {
    raiseOfficeAllocationError("allocation_invalid", "Allocation percentage must be an integer from 1 to 10000 basis points.", {
      departmentId: allocation.departmentId,
      percentageBp: String(allocation.percentageBp)
    });
  }

  if (allocation.amountMinor <= 0n) {
    raiseOfficeAllocationError("allocation_invalid", "Allocation amount must be positive.", {
      departmentId: allocation.departmentId,
      amountMinor: allocation.amountMinor.toString()
    });
  }
}

function assertDepartmentActive(departments: readonly OfficeWriteDepartmentRow[], departmentId: string): void {
  const department = departments.find((row) => row.id === departmentId);
  if (department === undefined || !department.isActive) {
    raiseOfficeAllocationError("department_invalid", "Allocation department must exist and be active.", {
      departmentId
    });
  }
}

function assertRoleAllowed(knownRoleSlugs: readonly string[], roleSlug: string | null): void {
  if (roleSlug === null || roleSlug === "") {
    return;
  }

  if (!knownRoleSlugs.includes(roleSlug)) {
    raiseOfficeAllocationError("role_invalid", "Allocation role is not allowed.", {
      roleSlug
    });
  }
}

function toPersistedAllocation(transactionId: string, allocation: OfficeIncomingAllocation): OfficePersistedAllocationInput {
  return {
    transactionId,
    departmentId: allocation.departmentId,
    percentageBp: allocation.percentageBp,
    amountMinor: allocation.amountMinor,
    roleSlug: allocation.roleSlug ?? ""
  };
}

function failure(reason: OfficeValidationFailureReason, context: Readonly<Record<string, string>>): OfficeTransactionValidationResult {
  return {
    ok: false,
    reason,
    context
  };
}

function requiresFx(transaction: OfficeWriteTransactionRow): boolean {
  return transaction.originalCurrency !== null && transaction.originalCurrency !== "" && transaction.originalCurrency !== "MUR";
}

function hasMatchingFx(transaction: OfficeWriteTransactionRow, exchangeRates: readonly OfficeWriteExchangeRateRow[]): boolean {
  if (!requiresFx(transaction)) {
    return true;
  }

  if (transaction.originalCurrency === null || transaction.originalAmountMinor === null || transaction.exchangeRateE10 === null) {
    return false;
  }

  const transactionDate = transaction.transactionDate.slice(0, 10);
  return exchangeRates.some(
    (rate) =>
      rate.fromCurrency === transaction.originalCurrency &&
      rate.toCurrency === "MUR" &&
      rate.rateE10 === transaction.exchangeRateE10 &&
      rate.effectiveDate === transactionDate
  );
}

function raiseOfficeAllocationError(
  code: OfficeAllocationErrorCode,
  message: string,
  context: Readonly<Record<string, string>>
): never {
  throw createOfficeAllocationError(code, message, context);
}

function absoluteBpDelta(value: number): number {
  return value < 0 ? -value : value;
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}
