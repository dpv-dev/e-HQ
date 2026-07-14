import { eofMoney } from "@ehq/domain-finance";
import type { OfficeCashflowProjectionRowInput } from "./analytics.js";
import type { OfficeTransactionRow } from "./pl.js";

export type OfficeCashflowManualEntryDirection = "inflow" | "outflow";
export type OfficeCashflowManualEntryStatus = "planned" | "confirmed" | "cancelled";
export type OfficeAdvanceBeneficiaryType = "staff" | "freelancer" | "artist" | "supplier" | "contractor" | "other";
export type OfficeManagedAdvanceStatus =
  | "planned"
  | "paid"
  | "partially_applied"
  | "settled"
  | "refunded"
  | "waived"
  | "written_off";
export type OfficeAdvanceApplicationKind = "invoice" | "expense" | "refund" | "write_off";

export interface OfficeCashflowManualEntryRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly accountId: string | null;
  readonly partnerId: string | null;
  readonly projectId: string | null;
  readonly entryDate: string;
  readonly direction: OfficeCashflowManualEntryDirection;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly label: string;
  readonly notes: string | null;
  readonly status: OfficeCashflowManualEntryStatus;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OfficeManagedAdvanceRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly beneficiaryType: OfficeAdvanceBeneficiaryType;
  readonly beneficiaryName: string;
  readonly partnerId: string | null;
  readonly projectId: string | null;
  readonly bankStatementLineId: string | null;
  readonly transactionId: string | null;
  readonly label: string;
  readonly plannedPaymentOn: string;
  readonly paidOn: string | null;
  readonly originalAmountMinor: bigint;
  readonly currency: string;
  readonly status: OfficeManagedAdvanceStatus;
  readonly notes: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OfficeAdvanceApplicationRow {
  readonly id: string;
  readonly advanceId: string;
  readonly appliedOn: string;
  readonly amountMinor: bigint;
  readonly kind: OfficeAdvanceApplicationKind;
  readonly reference: string | null;
  readonly notes: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
}

export interface OfficeCashflowWorkbenchInput {
  readonly workspaceId: string;
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
  readonly accountId: string | null;
  readonly transactions: readonly OfficeTransactionRow[];
  readonly projectionRows: readonly OfficeCashflowProjectionRowInput[];
  readonly manualEntries: readonly OfficeCashflowManualEntryRow[];
  readonly advances: readonly OfficeManagedAdvanceRow[];
}

export interface OfficeCashflowWorkbenchBucketResult {
  readonly period: string;
  readonly actualInflowMinor: bigint;
  readonly actualOutflowMinor: bigint;
  readonly forecastInflowMinor: bigint;
  readonly forecastOutflowMinor: bigint;
  readonly varianceMinor: bigint;
  readonly forecastClosingMinor: bigint;
}

interface MutableCashflowBucket {
  actualInflowMinor: bigint;
  actualOutflowMinor: bigint;
  forecastInflowMinor: bigint;
  forecastOutflowMinor: bigint;
  baseClosingMinor: bigint;
  forecastAdjustmentMinor: bigint;
}

export interface OfficeAdvanceBalanceResult {
  readonly appliedMinor: bigint;
  readonly outstandingMinor: bigint;
  readonly status: OfficeManagedAdvanceStatus;
}

/** Builds one exact, integer cash-flow read model from actual and forecast sources. */
export function buildOfficeCashflowWorkbench(input: OfficeCashflowWorkbenchInput): readonly OfficeCashflowWorkbenchBucketResult[] {
  const buckets = new Map<string, MutableCashflowBucket>();
  const latestProjectionRows = latestProjectionRowsByAccountMonth(input);

  for (const row of latestProjectionRows.values()) {
    const bucket = requireBucket(buckets, row.periodMonth);
    bucket.forecastInflowMinor = eofMoney.add(bucket.forecastInflowMinor, row.expectedInflowMinor);
    bucket.forecastOutflowMinor = eofMoney.add(bucket.forecastOutflowMinor, row.expectedOutflowMinor);
    bucket.baseClosingMinor = eofMoney.add(bucket.baseClosingMinor, row.expectedClosingBalanceMinor);
  }

  for (const transaction of input.transactions) {
    if (
      transaction.workspaceId !== input.workspaceId ||
      !transaction.isActive ||
      transaction.status !== "validated" ||
      (input.accountId !== null && transaction.accountId !== input.accountId) ||
      !isDateInRange(transaction.transactionDate, input.dateFrom, input.dateTo)
    ) {
      continue;
    }
    const bucket = requireBucket(buckets, transaction.transactionDate.slice(0, 7));
    const amountMinor = absoluteMinor(transaction.amountMinor);
    if (transaction.type === "income") {
      bucket.actualInflowMinor = eofMoney.add(bucket.actualInflowMinor, amountMinor);
    } else {
      bucket.actualOutflowMinor = eofMoney.add(bucket.actualOutflowMinor, amountMinor);
    }
  }

  for (const entry of input.manualEntries) {
    if (
      entry.workspaceId !== input.workspaceId ||
      entry.status === "cancelled" ||
      entry.currency !== "MUR" ||
      (input.accountId !== null && entry.accountId !== input.accountId) ||
      !isDateInRange(entry.entryDate, input.dateFrom, input.dateTo)
    ) {
      continue;
    }
    const bucket = requireBucket(buckets, entry.entryDate.slice(0, 7));
    if (entry.direction === "inflow") {
      bucket.forecastInflowMinor = eofMoney.add(bucket.forecastInflowMinor, entry.amountMinor);
      bucket.forecastAdjustmentMinor = eofMoney.add(bucket.forecastAdjustmentMinor, entry.amountMinor);
    } else {
      bucket.forecastOutflowMinor = eofMoney.add(bucket.forecastOutflowMinor, entry.amountMinor);
      bucket.forecastAdjustmentMinor = eofMoney.add(bucket.forecastAdjustmentMinor, -entry.amountMinor);
    }
  }

  for (const advance of input.advances) {
    if (advance.workspaceId !== input.workspaceId || advance.currency !== "MUR" || input.accountId !== null) {
      continue;
    }
    if (advance.status === "planned" && isDateInRange(advance.plannedPaymentOn, input.dateFrom, input.dateTo)) {
      const bucket = requireBucket(buckets, advance.plannedPaymentOn.slice(0, 7));
      bucket.forecastOutflowMinor = eofMoney.add(bucket.forecastOutflowMinor, advance.originalAmountMinor);
      bucket.forecastAdjustmentMinor = eofMoney.add(bucket.forecastAdjustmentMinor, -advance.originalAmountMinor);
    } else if (isPaidAdvance(advance) && advance.transactionId === null && advance.paidOn !== null && isDateInRange(advance.paidOn, input.dateFrom, input.dateTo)) {
      const bucket = requireBucket(buckets, advance.paidOn.slice(0, 7));
      bucket.actualOutflowMinor = eofMoney.add(bucket.actualOutflowMinor, advance.originalAmountMinor);
    }
  }

  let cumulativeForecastAdjustmentMinor = 0n;
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, bucket]) => {
      const forecastNetMinor = eofMoney.add(bucket.forecastInflowMinor, -bucket.forecastOutflowMinor);
      cumulativeForecastAdjustmentMinor = eofMoney.add(cumulativeForecastAdjustmentMinor, bucket.forecastAdjustmentMinor);
      const actualNetMinor = eofMoney.add(bucket.actualInflowMinor, -bucket.actualOutflowMinor);
      return {
        period,
        actualInflowMinor: bucket.actualInflowMinor,
        actualOutflowMinor: bucket.actualOutflowMinor,
        forecastInflowMinor: bucket.forecastInflowMinor,
        forecastOutflowMinor: bucket.forecastOutflowMinor,
        varianceMinor: eofMoney.add(actualNetMinor, -forecastNetMinor),
        forecastClosingMinor: eofMoney.add(bucket.baseClosingMinor, cumulativeForecastAdjustmentMinor)
      };
    });
}

/** Applies append-only advance usage while preserving the exact outstanding invariant. */
export function calculateAdvanceBalance(
  advance: OfficeManagedAdvanceRow,
  applications: readonly OfficeAdvanceApplicationRow[],
  additionalApplicationMinor: bigint = 0n
): OfficeAdvanceBalanceResult {
  if (additionalApplicationMinor < 0n) {
    throw new Error("Advance application amount cannot be negative.");
  }
  const appliedMinor = applications
    .filter((application) => application.advanceId === advance.id)
    .reduce((sum, application) => eofMoney.add(sum, application.amountMinor), additionalApplicationMinor);
  if (appliedMinor > advance.originalAmountMinor) {
    throw new Error("Advance application exceeds the outstanding amount.");
  }
  const outstandingMinor = eofMoney.add(advance.originalAmountMinor, -appliedMinor);
  return {
    appliedMinor,
    outstandingMinor,
    status: outstandingMinor === 0n ? "settled" : appliedMinor > 0n ? "partially_applied" : advance.status
  };
}

function latestProjectionRowsByAccountMonth(input: OfficeCashflowWorkbenchInput): ReadonlyMap<string, OfficeCashflowProjectionRowInput> {
  const latest = new Map<string, OfficeCashflowProjectionRowInput>();
  for (const row of input.projectionRows) {
    if (
      row.workspaceId !== input.workspaceId ||
      row.currency !== "MUR" ||
      (input.accountId !== null && row.accountId !== input.accountId) ||
      !isDateInRange(`${row.periodMonth}-01`, input.dateFrom, input.dateTo)
    ) {
      continue;
    }
    const key = `${row.accountId ?? "none"}|${row.periodMonth}`;
    const current = latest.get(key);
    if (current === undefined || row.createdAt > current.createdAt) {
      latest.set(key, row);
    }
  }
  return latest;
}

function requireBucket(buckets: Map<string, MutableCashflowBucket>, period: string): MutableCashflowBucket {
  const existing = buckets.get(period);
  if (existing !== undefined) {
    return existing;
  }
  const created: MutableCashflowBucket = {
    actualInflowMinor: 0n,
    actualOutflowMinor: 0n,
    forecastInflowMinor: 0n,
    forecastOutflowMinor: 0n,
    baseClosingMinor: 0n,
    forecastAdjustmentMinor: 0n
  };
  buckets.set(period, created);
  return created;
}

function isPaidAdvance(advance: OfficeManagedAdvanceRow): boolean {
  return advance.status === "paid" || advance.status === "partially_applied" || advance.status === "settled";
}

function absoluteMinor(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function isDateInRange(value: string, dateFrom: string | null, dateTo: string | null): boolean {
  const date = value.slice(0, 10);
  return (dateFrom === null || date >= dateFrom.slice(0, 10)) && (dateTo === null || date <= dateTo.slice(0, 10));
}
