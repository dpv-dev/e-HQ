import type {
  CalculationRun,
  EarningAllocation,
  EarningTrackMatch,
  ImportBatch,
  NormalizedEarning,
  Payee,
  Payment,
  Release,
  Statement,
  StatementLine,
  StatementPaymentLink,
  SuspenseItem,
  Track
} from "@ehq/db";
import { erhMoney } from "@ehq/domain-finance";
import { computeStatementBalance } from "./statements.js";
import { distributionSuspenseReasonDefinition, type DistributionSuspenseFixPath } from "./suspense.js";

export interface DistributionReadDataset {
  readonly importBatches: readonly DistributionImportBatchRow[];
  readonly normalizedEarnings: readonly DistributionNormalizedEarningRow[];
  readonly calculationRuns: readonly DistributionCalculationRunRow[];
  readonly earningTrackMatches?: readonly DistributionEarningTrackMatchRow[];
  readonly earningAllocations: readonly DistributionEarningAllocationRow[];
  readonly suspenseItems: readonly DistributionSuspenseItemRow[];
  readonly statements: readonly DistributionStatementRow[];
  readonly statementLines: readonly DistributionStatementLineRow[];
  readonly statementPaymentLinks: readonly DistributionStatementPaymentLinkRow[];
  readonly payments: readonly DistributionPaymentRow[];
  readonly payees: readonly DistributionPayeeRow[];
  readonly releases: readonly DistributionReleaseRow[];
  readonly tracks: readonly DistributionTrackRow[];
}

export type DistributionImportBatchRow = Pick<ImportBatch, "id" | "source" | "fileName" | "status" | "importedAt">;
export type DistributionNormalizedEarningRow = Pick<
  NormalizedEarning,
  | "id"
  | "batchId"
  | "dsp"
  | "grossAmount"
  | "quantity"
  | "currency"
  | "isrc"
  | "upc"
  | "rawTitle"
  | "rawArtist"
  | "rawLabel"
  | "mappingStatus"
  | "calculationStatus"
>;
export type DistributionCalculationRunRow = Pick<CalculationRun, "id" | "batchId" | "status" | "startedAt" | "finishedAt" | "createdAt">;
export type DistributionEarningTrackMatchRow = Pick<EarningTrackMatch, "id" | "earningId" | "trackId" | "confidence" | "status" | "createdAt">;
export type DistributionEarningAllocationRow = Pick<
  EarningAllocation,
  | "id"
  | "earningId"
  | "calculationRunId"
  | "payeeId"
  | "contractId"
  | "trackId"
  | "grossAmount"
  | "grossShare"
  | "recoupmentApplied"
  | "netPayable"
  | "splitPercentage"
  | "currency"
  | "status"
  | "createdAt"
>;
export type DistributionSuspenseItemRow = Pick<SuspenseItem, "id" | "earningId" | "amount" | "currency" | "reasonCode" | "resolved" | "resolvedAt" | "createdAt">;
export type DistributionStatementRow = Pick<
  Statement,
  | "id"
  | "payeeId"
  | "calculationRunId"
  | "periodStart"
  | "periodEnd"
  | "currency"
  | "grossTotal"
  | "recoupmentTotal"
  | "netPayable"
  | "amountDue"
  | "version"
  | "status"
  | "createdAt"
>;
export type DistributionStatementLineRow = Pick<
  StatementLine,
  "id" | "statementId" | "earningAllocationId" | "trackId" | "grossShare" | "recoupmentApplied" | "netPayable" | "quantity" | "currency"
>;
export type DistributionStatementPaymentLinkRow = Pick<StatementPaymentLink, "id" | "statementId" | "paymentId" | "amountApplied">;
export type DistributionPaymentRow = Pick<
  Payment,
  "id" | "payeeId" | "amount" | "currency" | "exchangeRate" | "method" | "status" | "paidAt" | "reference" | "notes"
>;
export type DistributionPayeeRow = Pick<Payee, "id" | "name" | "email" | "preferredCurrency" | "isActive">;
export type DistributionReleaseRow = Pick<Release, "id" | "title" | "artistName" | "catalogStatus" | "upc" | "releaseDate">;
export type DistributionTrackRow = Pick<Track, "id" | "title" | "artistName" | "catalogStatus" | "isrc" | "releaseId">;

export interface DistributionEarningsPreviewFilters {
  readonly batchId: string | null;
  readonly mappingStatus: DistributionNormalizedEarningRow["mappingStatus"] | null;
  readonly calculationStatus: DistributionNormalizedEarningRow["calculationStatus"] | null;
}

export interface DistributionEarningsPreviewRow {
  readonly id: string;
  readonly batchId: string;
  readonly batchSource: string;
  readonly fileName: string;
  readonly dsp: string;
  readonly rawTitle: string | null;
  readonly rawArtist: string | null;
  readonly rawLabel: string | null;
  readonly isrc: string | null;
  readonly upc: string | null;
  readonly grossAmount: string;
  readonly quantity: string;
  readonly currency: string;
  readonly mappingStatus: DistributionNormalizedEarningRow["mappingStatus"];
  readonly calculationStatus: DistributionNormalizedEarningRow["calculationStatus"];
  readonly suspenseReason: string | null;
  readonly exactFixPath: DistributionSuspenseFixPath | null;
}

export interface DistributionAllocationReadFilters {
  readonly calculationRunId: string | null;
  readonly payeeId: string | null;
  readonly status: DistributionEarningAllocationRow["status"] | null;
}

export interface DistributionAllocationReadRow {
  readonly id: string;
  readonly earningId: string;
  readonly calculationRunId: string;
  readonly payeeId: string;
  readonly payeeName: string;
  readonly contractId: string | null;
  readonly trackId: string | null;
  readonly trackTitle: string | null;
  readonly grossAmount: string;
  readonly grossShare: string;
  readonly recoupmentApplied: string;
  readonly netPayable: string;
  readonly splitPercentage: string;
  readonly currency: string;
  readonly status: DistributionEarningAllocationRow["status"];
}

export interface DistributionAllocationReadTotal {
  readonly currency: string;
  readonly grossShare: string;
  readonly recoupmentApplied: string;
  readonly netPayable: string;
}

export interface DistributionAllocationReadResponse {
  readonly rows: readonly DistributionAllocationReadRow[];
  readonly totals: readonly DistributionAllocationReadTotal[];
}

export type DistributionSuspenseStatusFilter = "open" | "resolved" | null;
export interface DistributionSuspenseReadFilters {
  readonly status: DistributionSuspenseStatusFilter;
  readonly reasonCode: string | null;
}

export interface DistributionSuspenseReadRow {
  readonly id: string;
  readonly earningId: string | null;
  readonly sourceReference: string;
  readonly amount: string;
  readonly currency: string;
  readonly reasonCode: string;
  readonly exactFixPath: DistributionSuspenseFixPath;
  readonly status: "open" | "resolved";
  readonly createdAt: string;
}

export interface DistributionSuspenseGroup {
  readonly reasonCode: string;
  readonly exactFixPath: DistributionSuspenseFixPath;
  readonly count: number;
  readonly totals: readonly DistributionCurrencyTotal[];
}

export interface DistributionSuspenseReadResponse {
  readonly rows: readonly DistributionSuspenseReadRow[];
  readonly groups: readonly DistributionSuspenseGroup[];
}

export interface DistributionStatementReadFilters {
  readonly period: string | null;
  readonly payeeId: string | null;
  readonly status: DistributionStatementRow["status"] | null;
}

export interface DistributionStatementReadRow {
  readonly id: string;
  readonly payeeId: string;
  readonly payeeName: string;
  readonly calculationRunId: string | null;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: string;
  readonly grossTotal: string;
  readonly recoupmentTotal: string;
  readonly netPayable: string;
  readonly amountDue: string;
  readonly paymentsApplied: string;
  readonly statementBalance: string;
  readonly lineCount: number;
  readonly version: number;
  readonly status: DistributionStatementRow["status"];
}

export interface DistributionStatementReadResponse {
  readonly rows: readonly DistributionStatementReadRow[];
  readonly totals: readonly DistributionStatementReadTotal[];
}

export interface DistributionStatementReadTotal {
  readonly currency: string;
  readonly grossTotal: string;
  readonly recoupmentTotal: string;
  readonly netPayable: string;
  readonly amountDue: string;
  readonly statementBalance: string;
}

export interface DistributionCurrencyTotal {
  readonly currency: string;
  readonly amount: string;
}

interface DistributionResolvedDataset {
  readonly importBatchesById: ReadonlyMap<string, DistributionImportBatchRow>;
  readonly payeesById: ReadonlyMap<string, DistributionPayeeRow>;
  readonly paymentsById: ReadonlyMap<string, DistributionPaymentRow>;
  readonly tracksById: ReadonlyMap<string, DistributionTrackRow>;
  readonly earningsById: ReadonlyMap<string, DistributionNormalizedEarningRow>;
}

interface StatementTotalAccumulator {
  grossTotalUnits: bigint;
  recoupmentTotalUnits: bigint;
  netPayableUnits: bigint;
  amountDueUnits: bigint;
  statementBalanceUnits: bigint;
}

export function readEarningsPreview(dataset: DistributionReadDataset, filters: DistributionEarningsPreviewFilters): readonly DistributionEarningsPreviewRow[] {
  const resolved = resolveDataset(dataset);
  const suspenseByEarningId = firstSuspenseByEarningId(dataset.suspenseItems);
  return dataset.normalizedEarnings
    .filter((earning) => filters.batchId === null || earning.batchId === filters.batchId)
    .filter((earning) => filters.mappingStatus === null || earning.mappingStatus === filters.mappingStatus)
    .filter((earning) => filters.calculationStatus === null || earning.calculationStatus === filters.calculationStatus)
    .map((earning) => {
      const batch = requireImportBatch(resolved, earning.batchId);
      const suspense = suspenseByEarningId.get(earning.id);
      return {
        id: earning.id,
        batchId: earning.batchId,
        batchSource: batch.source,
        fileName: batch.fileName,
        dsp: earning.dsp,
        rawTitle: earning.rawTitle,
        rawArtist: earning.rawArtist,
        rawLabel: earning.rawLabel,
        isrc: earning.isrc,
        upc: earning.upc,
        grossAmount: formatErhAmount(parseErhAmount(earning.grossAmount)),
        quantity: earning.quantity,
        currency: earning.currency,
        mappingStatus: earning.mappingStatus,
        calculationStatus: earning.calculationStatus,
        suspenseReason: suspense?.reasonCode ?? null,
        exactFixPath: suspense === undefined ? null : fixPathForSuspenseReason(suspense.reasonCode)
      };
    });
}

export function readAllocationList(dataset: DistributionReadDataset, filters: DistributionAllocationReadFilters): DistributionAllocationReadResponse {
  const resolved = resolveDataset(dataset);
  const rows = dataset.earningAllocations
    .filter((allocation) => filters.calculationRunId === null || allocation.calculationRunId === filters.calculationRunId)
    .filter((allocation) => filters.payeeId === null || allocation.payeeId === filters.payeeId)
    .filter((allocation) => filters.status === null || allocation.status === filters.status)
    .map((allocation) => toAllocationReadRow(resolved, allocation));

  return {
    rows,
    totals: totalsByCurrency(
      rows.map((row) => ({
        currency: row.currency,
        amount: row.netPayable,
        grossShare: row.grossShare,
        recoupmentApplied: row.recoupmentApplied
      }))
    ).map((total) => ({
      currency: total.currency,
      grossShare: total.grossShare,
      recoupmentApplied: total.recoupmentApplied,
      netPayable: total.amount
    }))
  };
}

export function readSuspense(dataset: DistributionReadDataset, filters: DistributionSuspenseReadFilters): DistributionSuspenseReadResponse {
  const resolved = resolveDataset(dataset);
  const rows = dataset.suspenseItems
    .filter((item) => matchesSuspenseStatus(item, filters.status))
    .filter((item) => filters.reasonCode === null || item.reasonCode === filters.reasonCode)
    .map((item) => toSuspenseReadRow(resolved, item));

  return {
    rows,
    groups: groupSuspenseRows(rows)
  };
}

export function readStatementSummaries(dataset: DistributionReadDataset, filters: DistributionStatementReadFilters): DistributionStatementReadResponse {
  const resolved = resolveDataset(dataset);
  const rows = dataset.statements
    .filter((statement) => filters.period === null || statement.periodStart.startsWith(filters.period) || statement.periodEnd.startsWith(filters.period))
    .filter((statement) => filters.payeeId === null || statement.payeeId === filters.payeeId)
    .filter((statement) => filters.status === null || statement.status === filters.status)
    .map((statement) => toStatementReadRow(dataset, resolved, statement));

  return {
    rows,
    totals: statementTotalsByCurrency(rows)
  };
}

// Dashboard-only fast path: allocation totals without materializing every row or
// building the resolved-dataset lookup maps. Output matches readAllocationList().totals.
export function readAllocationTotals(
  dataset: DistributionReadDataset,
  filters: DistributionAllocationReadFilters
): DistributionAllocationReadResponse["totals"] {
  return totalsByCurrency(
    dataset.earningAllocations
      .filter((allocation) => filters.calculationRunId === null || allocation.calculationRunId === filters.calculationRunId)
      .filter((allocation) => filters.payeeId === null || allocation.payeeId === filters.payeeId)
      .filter((allocation) => filters.status === null || allocation.status === filters.status)
      .map((allocation) => ({
        currency: allocation.currency,
        amount: formatErhAmount(parseErhAmount(allocation.netPayable)),
        grossShare: formatErhAmount(parseErhAmount(allocation.grossShare)),
        recoupmentApplied: formatErhAmount(parseErhAmount(allocation.recoupmentApplied))
      }))
  ).map((total) => ({
    currency: total.currency,
    grossShare: total.grossShare,
    recoupmentApplied: total.recoupmentApplied,
    netPayable: total.amount
  }));
}

// Dashboard-only fast path: count of matching suspense items without materializing
// rows or building lookup maps. Matches readSuspense().rows.length.
export function countOpenSuspense(dataset: DistributionReadDataset, filters: DistributionSuspenseReadFilters): number {
  let count = 0;
  for (const item of dataset.suspenseItems) {
    if (!matchesSuspenseStatus(item, filters.status)) {
      continue;
    }
    if (filters.reasonCode !== null && item.reasonCode !== filters.reasonCode) {
      continue;
    }
    count += 1;
  }

  return count;
}

// Dashboard-only fast path: count of open statements (not paid/void) in a period.
// Matches readStatementSummaries().rows filtered to non-paid/non-void.
export function countOpenStatements(dataset: DistributionReadDataset, period: string | null): number {
  let count = 0;
  for (const statement of dataset.statements) {
    const matchesPeriod = period === null || statement.periodStart.startsWith(period) || statement.periodEnd.startsWith(period);
    if (!matchesPeriod) {
      continue;
    }
    if (statement.status === "paid" || statement.status === "void") {
      continue;
    }
    count += 1;
  }

  return count;
}

function resolveDataset(dataset: DistributionReadDataset): DistributionResolvedDataset {
  return {
    importBatchesById: new Map<string, DistributionImportBatchRow>(dataset.importBatches.map((batch) => [batch.id, batch])),
    payeesById: new Map<string, DistributionPayeeRow>(dataset.payees.map((payee) => [payee.id, payee])),
    paymentsById: new Map<string, DistributionPaymentRow>(dataset.payments.map((payment) => [payment.id, payment])),
    tracksById: new Map<string, DistributionTrackRow>(dataset.tracks.map((track) => [track.id, track])),
    earningsById: new Map<string, DistributionNormalizedEarningRow>(dataset.normalizedEarnings.map((earning) => [earning.id, earning]))
  };
}

function firstSuspenseByEarningId(items: readonly DistributionSuspenseItemRow[]): ReadonlyMap<string, DistributionSuspenseItemRow> {
  const byEarningId = new Map<string, DistributionSuspenseItemRow>();
  for (const item of items) {
    if (item.earningId === null || byEarningId.has(item.earningId)) {
      continue;
    }

    byEarningId.set(item.earningId, item);
  }

  return byEarningId;
}

function toAllocationReadRow(resolved: DistributionResolvedDataset, allocation: DistributionEarningAllocationRow): DistributionAllocationReadRow {
  const payee = requirePayee(resolved, allocation.payeeId);
  const track = allocation.trackId === null ? null : resolved.tracksById.get(allocation.trackId) ?? null;
  return {
    id: allocation.id,
    earningId: allocation.earningId,
    calculationRunId: allocation.calculationRunId,
    payeeId: allocation.payeeId,
    payeeName: payee.name,
    contractId: allocation.contractId,
    trackId: allocation.trackId,
    trackTitle: track?.title ?? null,
    grossAmount: formatErhAmount(parseErhAmount(allocation.grossAmount)),
    grossShare: formatErhAmount(parseErhAmount(allocation.grossShare)),
    recoupmentApplied: formatErhAmount(parseErhAmount(allocation.recoupmentApplied)),
    netPayable: formatErhAmount(parseErhAmount(allocation.netPayable)),
    splitPercentage: allocation.splitPercentage,
    currency: allocation.currency,
    status: allocation.status
  };
}

function toSuspenseReadRow(resolved: DistributionResolvedDataset, item: DistributionSuspenseItemRow): DistributionSuspenseReadRow {
  const earning = item.earningId === null ? null : resolved.earningsById.get(item.earningId) ?? null;
  return {
    id: item.id,
    earningId: item.earningId,
    sourceReference: earning?.isrc ?? earning?.upc ?? item.id,
    amount: formatErhAmount(parseErhAmount(item.amount)),
    currency: item.currency,
    reasonCode: item.reasonCode,
    exactFixPath: fixPathForSuspenseReason(item.reasonCode),
    status: item.resolved ? "resolved" : "open",
    createdAt: item.createdAt
  };
}

function toStatementReadRow(
  dataset: DistributionReadDataset,
  resolved: DistributionResolvedDataset,
  statement: DistributionStatementRow
): DistributionStatementReadRow {
  const payee = requirePayee(resolved, statement.payeeId);
  const paymentLinks = statementPaymentInputs(dataset, resolved, statement.id, statement.currency);
  const balance = computeStatementBalance(
    {
      id: statement.id,
      currency: statement.currency,
      amountDue: statement.amountDue
    },
    paymentLinks
  );

  return {
    id: statement.id,
    payeeId: statement.payeeId,
    payeeName: payee.name,
    calculationRunId: statement.calculationRunId,
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    currency: statement.currency,
    grossTotal: formatErhAmount(parseErhAmount(statement.grossTotal)),
    recoupmentTotal: formatErhAmount(parseErhAmount(statement.recoupmentTotal)),
    netPayable: formatErhAmount(parseErhAmount(statement.netPayable)),
    amountDue: balance.amountDue,
    paymentsApplied: balance.paymentsApplied,
    statementBalance: balance.statementBalance,
    lineCount: dataset.statementLines.filter((line) => line.statementId === statement.id).length,
    version: statement.version,
    status: statement.status
  };
}

function statementPaymentInputs(
  dataset: DistributionReadDataset,
  resolved: DistributionResolvedDataset,
  statementId: string,
  currency: string
): readonly { readonly statementId: string; readonly amountApplied: string; readonly currency: string }[] {
  return dataset.statementPaymentLinks
    .filter((link) => link.statementId === statementId)
    .map((link) => {
      const payment = requirePayment(resolved, link.paymentId);
      return {
        statementId,
        amountApplied: payment.status === "void" ? "0.0000000000" : link.amountApplied,
        currency: payment.currency
      };
    })
    .filter((link) => link.currency === currency);
}

function totalsByCurrency(
  rows: readonly {
    readonly currency: string;
    readonly amount: string;
    readonly grossShare: string;
    readonly recoupmentApplied: string;
  }[]
): readonly (DistributionCurrencyTotal & { readonly grossShare: string; readonly recoupmentApplied: string })[] {
  const totals = new Map<string, { amountUnits: bigint; grossShareUnits: bigint; recoupmentAppliedUnits: bigint }>();
  for (const row of rows) {
    const current = totals.get(row.currency) ?? { amountUnits: 0n, grossShareUnits: 0n, recoupmentAppliedUnits: 0n };
    current.amountUnits = erhMoney.add(current.amountUnits, parseErhAmount(row.amount));
    current.grossShareUnits = erhMoney.add(current.grossShareUnits, parseErhAmount(row.grossShare));
    current.recoupmentAppliedUnits = erhMoney.add(current.recoupmentAppliedUnits, parseErhAmount(row.recoupmentApplied));
    totals.set(row.currency, current);
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, total]) => ({
      currency,
      amount: formatErhAmount(total.amountUnits),
      grossShare: formatErhAmount(total.grossShareUnits),
      recoupmentApplied: formatErhAmount(total.recoupmentAppliedUnits)
    }));
}

function groupSuspenseRows(rows: readonly DistributionSuspenseReadRow[]): readonly DistributionSuspenseGroup[] {
  const groups = new Map<string, { count: number; exactFixPath: DistributionSuspenseFixPath; rows: DistributionSuspenseReadRow[] }>();
  for (const row of rows) {
    const current = groups.get(row.reasonCode) ?? { count: 0, exactFixPath: row.exactFixPath, rows: [] };
    current.count += 1;
    current.rows.push(row);
    groups.set(row.reasonCode, current);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reasonCode, group]) => ({
      reasonCode,
      exactFixPath: group.exactFixPath,
      count: group.count,
      totals: suspenseTotalsByCurrency(group.rows)
    }));
}

function suspenseTotalsByCurrency(rows: readonly DistributionSuspenseReadRow[]): readonly DistributionCurrencyTotal[] {
  const totals = new Map<string, bigint>();
  for (const row of rows) {
    const current = totals.get(row.currency) ?? 0n;
    totals.set(row.currency, erhMoney.add(current, parseErhAmount(row.amount)));
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amountUnits]) => ({
      currency,
      amount: formatErhAmount(amountUnits)
    }));
}

function statementTotalsByCurrency(rows: readonly DistributionStatementReadRow[]): readonly DistributionStatementReadTotal[] {
  const totals = new Map<string, StatementTotalAccumulator>();
  for (const row of rows) {
    const current =
      totals.get(row.currency) ??
      {
        grossTotalUnits: 0n,
        recoupmentTotalUnits: 0n,
        netPayableUnits: 0n,
        amountDueUnits: 0n,
        statementBalanceUnits: 0n
      };
    current.grossTotalUnits = erhMoney.add(current.grossTotalUnits, parseErhAmount(row.grossTotal));
    current.recoupmentTotalUnits = erhMoney.add(current.recoupmentTotalUnits, parseErhAmount(row.recoupmentTotal));
    current.netPayableUnits = erhMoney.add(current.netPayableUnits, parseErhAmount(row.netPayable));
    current.amountDueUnits = erhMoney.add(current.amountDueUnits, parseErhAmount(row.amountDue));
    current.statementBalanceUnits = erhMoney.add(current.statementBalanceUnits, parseErhAmount(row.statementBalance));
    totals.set(row.currency, current);
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, total]) => ({
      currency,
      grossTotal: formatErhAmount(total.grossTotalUnits),
      recoupmentTotal: formatErhAmount(total.recoupmentTotalUnits),
      netPayable: formatErhAmount(total.netPayableUnits),
      amountDue: formatErhAmount(total.amountDueUnits),
      statementBalance: formatErhAmount(total.statementBalanceUnits)
    }));
}

function matchesSuspenseStatus(item: DistributionSuspenseItemRow, status: DistributionSuspenseStatusFilter): boolean {
  if (status === null) {
    return true;
  }

  if (status === "resolved") {
    return item.resolved;
  }

  return !item.resolved;
}

function fixPathForSuspenseReason(reasonCode: string): DistributionSuspenseFixPath {
  return distributionSuspenseReasonDefinition(reasonCode).fixPath;
}

function requireImportBatch(resolved: DistributionResolvedDataset, batchId: string): DistributionImportBatchRow {
  const batch = resolved.importBatchesById.get(batchId);
  if (batch === undefined) {
    throw new Error(`Distribution import batch not found: ${batchId}`);
  }

  return batch;
}

function requirePayee(resolved: DistributionResolvedDataset, payeeId: string): DistributionPayeeRow {
  const payee = resolved.payeesById.get(payeeId);
  if (payee === undefined) {
    throw new Error(`Distribution payee not found: ${payeeId}`);
  }

  return payee;
}

function requirePayment(resolved: DistributionResolvedDataset, paymentId: string): DistributionPaymentRow {
  const payment = resolved.paymentsById.get(paymentId);
  if (payment === undefined) {
    throw new Error(`Distribution payment not found: ${paymentId}`);
  }

  return payment;
}

function parseErhAmount(value: string): bigint {
  return erhMoney.parse(value);
}

function formatErhAmount(value: bigint): string {
  return erhMoney.format(value);
}
