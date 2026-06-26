import type { OfficeBankAccount, OfficeBankImportBatch, OfficeBankReconciliationMatch, OfficeBankStatementLine, OfficeCashflowProjectionRow } from "@ehq/db";
import { eofMoney, format as formatScaledUnits, roundRatioHalfUp } from "@ehq/domain-finance";
import {
  type OfficePnlDataset,
  type OfficePnlFilters,
  type OfficePnlMonthlyRow,
  type OfficePnlDepartmentRow,
  type OfficeGlobalPnlResponse,
  readGlobalPnl,
  readMonthlyPnl,
  readPnlByDepartment
} from "./pl.js";

export interface OfficeAnalyticsDataset extends OfficePnlDataset {
  readonly bankAccounts: readonly OfficeBankAccountRow[];
  readonly bankImportBatches: readonly OfficeBankImportBatchRow[];
  readonly bankStatementLines: readonly OfficeBankStatementLineRow[];
  readonly bankReconciliationMatches: readonly OfficeBankReconciliationMatchRow[];
  readonly cashflowProjectionRows: readonly OfficeCashflowProjectionRowInput[];
}

export type OfficeBankAccountRow = Pick<
  OfficeBankAccount,
  | "id"
  | "workspaceId"
  | "bankName"
  | "accountLabel"
  | "accountReferenceHash"
  | "currency"
  | "currentBalanceMinor"
  | "currentBalanceMurMinor"
  | "isActive"
  | "balanceAsOf"
>;
export type OfficeBankImportBatchRow = Pick<
  OfficeBankImportBatch,
  | "id"
  | "workspaceId"
  | "source"
  | "fileName"
  | "checksum"
  | "accountId"
  | "periodStart"
  | "periodEnd"
  | "openingBalanceMinor"
  | "closingBalanceMinor"
  | "currency"
  | "acceptedRowCount"
  | "rejectedRowCount"
  | "duplicateRowCount"
  | "idempotencyFingerprint"
  | "status"
  | "importedAt"
  | "metadata"
>;
export type OfficeBankStatementLineRow = Pick<
  OfficeBankStatementLine,
  | "id"
  | "importBatchId"
  | "accountId"
  | "occurredOn"
  | "valueOn"
  | "description"
  | "reference"
  | "direction"
  | "amountMinor"
  | "balanceMinor"
  | "currency"
  | "amountMurMinor"
  | "balanceMurMinor"
  | "isDuplicateCandidate"
  | "reconciliationStatus"
  | "matchedTransactionId"
  | "rawData"
>;
export type OfficeBankReconciliationMatchRow = Pick<
  OfficeBankReconciliationMatch,
  "id" | "bankStatementLineId" | "transactionId" | "confidenceBp" | "status" | "approvedByUserId" | "approvedAt"
>;
export type OfficeCashflowProjectionRowInput = Pick<
  OfficeCashflowProjectionRow,
  "id" | "workspaceId" | "accountId" | "periodMonth" | "expectedInflowMinor" | "expectedOutflowMinor" | "expectedClosingBalanceMinor" | "currency"
>;

export interface OfficeBankQualityResult {
  readonly period: string;
  readonly matchedRateBp: number;
  readonly unmatchedLineCount: number;
  readonly duplicateCandidateCount: number;
  readonly missingReferenceCount: number;
  readonly staleImportCount: number;
  readonly lastImportAt: string | null;
}

export interface OfficeCashRunwayResult {
  readonly period: string;
  readonly cashBalanceMur: string;
  readonly averageMonthlyBurnMur: string;
  readonly runwayMonths: string | null;
  readonly monthsUsed: readonly string[];
}

export interface OfficeCashflowBucketResult {
  readonly period: string;
  readonly inflowMur: string;
  readonly outflowMur: string;
  readonly closingMur: string;
}

export interface OfficeDashboardFullResult {
  readonly period: string;
  readonly pnl: OfficeGlobalPnlResponse;
  readonly byDepartment: readonly OfficePnlDepartmentRow[];
  readonly monthly: readonly OfficePnlMonthlyRow[];
  readonly bankQuality: OfficeBankQualityResult;
  readonly cashRunway: OfficeCashRunwayResult;
  readonly cashflow: readonly OfficeCashflowBucketResult[];
}

interface CashflowAccumulator {
  inflowMinor: bigint;
  outflowMinor: bigint;
  closingMinor: bigint;
}

export function readOfficeDashboardFull(
  dataset: OfficeAnalyticsDataset,
  period: string,
  filters: OfficePnlFilters,
  runwayWindowMonths: readonly string[]
): OfficeDashboardFullResult {
  const monthly = readMonthlyPnl(dataset, filters);
  return {
    period,
    pnl: readGlobalPnl(dataset, filters),
    byDepartment: readPnlByDepartment(dataset, filters),
    monthly,
    bankQuality: readOfficeBankQuality(dataset, period),
    cashRunway: readOfficeCashRunway(dataset, period, monthly, runwayWindowMonths),
    cashflow: readOfficeCashflowProjection(dataset, filters.dateFrom, filters.dateTo, null)
  };
}

export function readOfficeBankQuality(dataset: OfficeAnalyticsDataset, period: string): OfficeBankQualityResult {
  const lines = dataset.bankStatementLines.filter((line) => line.occurredOn.startsWith(period));
  const matchedLineIds = new Set<string>(
    dataset.bankReconciliationMatches.filter((match) => match.status === "matched").map((match) => match.bankStatementLineId)
  );
  const matchedCount = lines.filter((line) => line.reconciliationStatus === "matched" || matchedLineIds.has(line.id)).length;
  const totalCount = lines.length;
  const matchedRateBp = totalCount === 0 ? 0 : toBasisPointValue(roundRatioHalfUp(BigInt(matchedCount) * 10000n, BigInt(totalCount)));
  const periodImports = dataset.bankImportBatches.filter((batch) => batch.status === "confirmed" && batchIntersectsPeriod(batch, period));

  return {
    period,
    matchedRateBp,
    unmatchedLineCount: lines.filter((line) => line.reconciliationStatus === "unmatched" && !matchedLineIds.has(line.id)).length,
    duplicateCandidateCount: lines.filter((line) => line.isDuplicateCandidate).length,
    missingReferenceCount: lines.filter((line) => line.reference === null || line.reference.trim() === "").length,
    staleImportCount: dataset.bankImportBatches.filter((batch) => batch.status === "confirmed" && isStaleImport(batch, period)).length,
    lastImportAt: latestTimestamp(periodImports.map((batch) => batch.importedAt))
  };
}

export function readOfficeCashRunway(
  dataset: OfficeAnalyticsDataset,
  period: string,
  monthlyRows: readonly OfficePnlMonthlyRow[],
  runwayWindowMonths: readonly string[]
): OfficeCashRunwayResult {
  const cashBalanceUnits = sumCurrentCashMur(dataset.bankAccounts);
  const selectedRows = runwayWindowMonths.map((month) => requireMonthlyRow(monthlyRows, month));
  const burnUnits = selectedRows.map((row) => monthlyBurnUnits(row));
  const totalBurnUnits = burnUnits.reduce((sum: bigint, value: bigint) => eofMoney.add(sum, value), 0n);
  const averageBurnUnits = selectedRows.length === 0 ? 0n : roundRatioHalfUp(totalBurnUnits, BigInt(selectedRows.length));
  const runwayMonths = averageBurnUnits === 0n ? null : formatRatio(roundRatioHalfUp(cashBalanceUnits * 100n, averageBurnUnits), 2);

  return {
    period,
    cashBalanceMur: eofMoney.format(cashBalanceUnits),
    averageMonthlyBurnMur: eofMoney.format(averageBurnUnits),
    runwayMonths,
    monthsUsed: selectedRows.map((row) => row.month)
  };
}

export function readOfficeCashflowProjection(
  dataset: OfficeAnalyticsDataset,
  dateFrom: string | null,
  dateTo: string | null,
  accountId: string | null
): readonly OfficeCashflowBucketResult[] {
  const groups = new Map<string, CashflowAccumulator>();
  for (const row of dataset.cashflowProjectionRows) {
    if (accountId !== null && row.accountId !== accountId) {
      continue;
    }

    if (!isMonthInRange(row.periodMonth, dateFrom, dateTo)) {
      continue;
    }

    if (row.currency !== "MUR") {
      throw new Error(`Office cashflow projection row ${row.id} is not MUR.`);
    }

    const current = groups.get(row.periodMonth) ?? { inflowMinor: 0n, outflowMinor: 0n, closingMinor: 0n };
    current.inflowMinor = eofMoney.add(current.inflowMinor, row.expectedInflowMinor);
    current.outflowMinor = eofMoney.add(current.outflowMinor, row.expectedOutflowMinor);
    current.closingMinor = eofMoney.add(current.closingMinor, row.expectedClosingBalanceMinor);
    groups.set(row.periodMonth, current);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, accumulator]) => ({
      period,
      inflowMur: eofMoney.format(accumulator.inflowMinor),
      outflowMur: eofMoney.format(accumulator.outflowMinor),
      closingMur: eofMoney.format(accumulator.closingMinor)
    }));
}

function sumCurrentCashMur(accounts: readonly OfficeBankAccountRow[]): bigint {
  let total = 0n;
  for (const account of accounts) {
    if (!account.isActive) {
      continue;
    }

    total = eofMoney.add(total, accountBalanceMurUnits(account));
  }

  return total;
}

function accountBalanceMurUnits(account: OfficeBankAccountRow): bigint {
  if (account.currency === "MUR") {
    return account.currentBalanceMinor;
  }

  if (account.currentBalanceMurMinor === null) {
    throw new Error(`Office bank account ${account.id} needs an audited MUR balance for runway analytics.`);
  }

  return account.currentBalanceMurMinor;
}

function requireMonthlyRow(rows: readonly OfficePnlMonthlyRow[], month: string): OfficePnlMonthlyRow {
  const row = rows.find((candidate) => candidate.month === month);
  if (row === undefined) {
    throw new Error(`Office monthly P&L row not found for runway month ${month}.`);
  }

  return row;
}

function monthlyBurnUnits(row: OfficePnlMonthlyRow): bigint {
  const incomeUnits = eofMoney.parse(row.income);
  const expenseUnits = eofMoney.parse(row.expense);
  const netBurnUnits = eofMoney.sub(expenseUnits, incomeUnits);
  return netBurnUnits > 0n ? netBurnUnits : 0n;
}

function batchIntersectsPeriod(batch: OfficeBankImportBatchRow, period: string): boolean {
  if (batch.periodStart === null || batch.periodEnd === null) {
    return batch.importedAt !== null && batch.importedAt.startsWith(period);
  }

  return batch.periodStart <= `${period}-31` && batch.periodEnd >= `${period}-01`;
}

function isStaleImport(batch: OfficeBankImportBatchRow, period: string): boolean {
  if (batch.periodEnd === null) {
    return false;
  }

  return batch.periodEnd < `${period}-01`;
}

function latestTimestamp(values: readonly (string | null)[]): string | null {
  const timestamps = values.filter((value): value is string => value !== null).sort((left, right) => right.localeCompare(left));
  return timestamps[0] ?? null;
}

function isMonthInRange(month: string, dateFrom: string | null, dateTo: string | null): boolean {
  if (dateFrom !== null && month < dateFrom.slice(0, 7)) {
    return false;
  }

  return !(dateTo !== null && month > dateTo.slice(0, 7));
}

function formatRatio(units: bigint, scale: number): string {
  return formatScaledUnits(units, scale);
}

function toBasisPointValue(value: bigint): number {
  if (value < 0n || value > 10000n) {
    throw new Error(`Basis-point result is out of range: ${value.toString()}`);
  }

  return parseInt(value.toString(), 10);
}
