import { eofMoney, erhMoney } from "@ehq/domain-finance";
import {
  type OfficeAnalyticsDataset,
  type OfficeBankImportBatchRow,
  type OfficeBankReconciliationMatchRow,
  type OfficeBankStatementLineRow,
  type OfficeCashflowProjectionRowInput
} from "./analytics.js";
import {
  type OfficeCategoryRow,
  type OfficeDepartmentRow,
  type OfficeDivisionRow,
  type OfficeFinancialAllocationRow,
  type OfficePartnerRow,
  type OfficeProjectBudgetLineRow,
  type OfficeProjectRow,
  type OfficeTransactionRow,
  readGlobalPnl
} from "./pl.js";

export interface OfficeB2ExpectedCounts {
  readonly transactions: number;
  readonly financialAllocations: number;
  readonly categories: number;
  readonly departments: number;
  readonly partners: number;
  readonly projects: number;
  readonly bankAccounts: number;
  readonly bankRawTransactions: number;
  readonly bankReconciliations: number;
}

export interface OfficeB2ExpectedQuality {
  readonly inconsistentCategories: number;
  readonly emptyCurrencyRows: number;
  readonly allocationSumMismatch: number;
  readonly orphanForeignKeys: number;
  readonly ignoredDivisionNameDrift: number;
}

export interface OfficeB2TransactionStatusCounts {
  readonly validated: number;
  readonly draft: number;
  readonly cancelled: number;
}

export interface OfficeB2ParityTarget {
  readonly validatedTransactionCount: number;
  readonly incomeMinor: bigint;
  readonly expenseMinor: bigint;
}

export interface OfficeB2Contract {
  readonly sourceDatabaseName: string;
  readonly tablePrefix: string;
  readonly expectedCounts: OfficeB2ExpectedCounts;
  readonly expectedTransactionStatusCounts: OfficeB2TransactionStatusCounts;
  readonly expectedQuality: OfficeB2ExpectedQuality;
  readonly parity: OfficeB2ParityTarget;
}

export interface LegacyOfficeDump {
  readonly departments: readonly LegacyOfficeDepartmentRow[];
  readonly categories: readonly LegacyOfficeCategoryRow[];
  readonly partners: readonly LegacyOfficePartnerRow[];
  readonly projects: readonly LegacyOfficeProjectRow[];
  readonly bankAccounts: readonly LegacyOfficeBankAccountRow[];
  readonly transactions: readonly LegacyOfficeTransactionRow[];
  readonly financialAllocations: readonly LegacyOfficeFinancialAllocationRow[];
  readonly bankRawTransactions: readonly LegacyOfficeBankRawTransactionRow[];
  readonly bankReconciliations: readonly LegacyOfficeBankReconciliationRow[];
}

export interface LegacyOfficeDepartmentRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string | null;
  readonly parentId: string | null;
  readonly type: string | null;
  readonly color: string | null;
  readonly isActive: LegacyBoolean;
  readonly createdAt: string | null;
}

export interface LegacyOfficeCategoryRow {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly departmentId: string | null;
  readonly divisionId: string | null;
  readonly isActive: LegacyBoolean;
}

export interface LegacyOfficePartnerRow {
  readonly id: string;
  readonly name: string;
  readonly type: string | null;
  readonly isActive: LegacyBoolean;
}

export interface LegacyOfficeProjectRow {
  readonly id: string;
  readonly name: string;
  readonly status: string | null;
  readonly state: string | null;
  readonly isActive: LegacyBoolean;
}

export interface LegacyOfficeBankAccountRow {
  readonly id: string;
  readonly name: string;
  readonly accountNumber: string | null;
  readonly bankName: string | null;
  readonly currency: string;
  readonly isActive: LegacyBoolean;
  readonly institution: string | null;
}

export interface LegacyOfficeTransactionRow {
  readonly id: string;
  readonly transactionDate: string;
  readonly type: string;
  readonly status: string;
  readonly isActive: LegacyBoolean;
  readonly description: string | null;
  readonly categoryId: string | null;
  readonly partnerId: string | null;
  readonly projectId: string | null;
  readonly amountMur: string;
  readonly originalAmount: string | null;
  readonly originalCurrency: string | null;
  readonly exchangeRate: string | null;
}

export interface LegacyOfficeFinancialAllocationRow {
  readonly id: string;
  readonly transactionId: string;
  readonly departmentId: string;
  readonly divisionName: string | null;
  readonly amountMur: string;
  readonly percentageBp: string | number | null;
  readonly roleSlug: string | null;
}

export interface LegacyOfficeBankRawTransactionRow {
  readonly id: string;
  readonly importId: string;
  readonly accountId: string;
  readonly externalId: string | null;
  readonly transactionDate: string;
  readonly description: string | null;
  readonly direction: string;
  readonly amount: string;
  readonly balance: string | null;
  readonly status: string;
  readonly rawPayload: string | null;
  readonly createdAt: string;
  readonly dedupeHash: string | null;
}

export interface LegacyOfficeBankReconciliationRow {
  readonly id: string;
  readonly transactionId: string;
  readonly bankRawTransactionId: string;
  readonly amountLinked: string;
  readonly status: string;
  readonly validatedByUserId: string | null;
  readonly validatedAt: string | null;
  readonly createdAt: string;
}

export type LegacyBoolean = boolean | 0 | 1 | "0" | "1";

export interface OfficeB2TransformResult {
  readonly dataset: OfficeAnalyticsDataset;
  readonly parityReport: OfficeB2ParityReport;
  readonly ignoredDivisionNameDriftCount: number;
  readonly notes: readonly string[];
}

export interface OfficeB2ParityReport {
  readonly transactionStatusCounts: OfficeB2TransactionStatusCounts;
  readonly rawValidatedTransactionCount: number;
  readonly rawIncomeMinor: bigint;
  readonly rawExpenseMinor: bigint;
  readonly engineIncomeMinor: bigint;
  readonly engineExpenseMinor: bigint;
  readonly projectPartnerOrgWideDivergence: "expected_wp_bug_m1";
}

type OfficeDepartmentType = OfficeDepartmentRow["type"];
type OfficePartnerType = OfficePartnerRow["type"];
type OfficeProjectStatus = OfficeProjectRow["status"];
type OfficeTransactionType = OfficeTransactionRow["type"];
type OfficeTransactionStatus = OfficeTransactionRow["status"];

interface ResolvedLegacyDimensions {
  readonly topLevelDepartmentIds: ReadonlySet<string>;
  readonly divisionRowsById: ReadonlyMap<string, LegacyOfficeDepartmentRow>;
}

export const officeB2LiveContract: OfficeB2Contract = {
  sourceDatabaseName: "u384688932_HZ0LD",
  tablePrefix: "wp_",
  expectedCounts: {
    transactions: 3107,
    financialAllocations: 2832,
    categories: 551,
    departments: 93,
    partners: 247,
    projects: 12,
    bankAccounts: 5,
    bankRawTransactions: 3093,
    bankReconciliations: 1568
  },
  expectedTransactionStatusCounts: {
    validated: 2396,
    draft: 705,
    cancelled: 6
  },
  expectedQuality: {
    inconsistentCategories: 0,
    emptyCurrencyRows: 0,
    allocationSumMismatch: 0,
    orphanForeignKeys: 0,
    ignoredDivisionNameDrift: 1760
  },
  parity: {
    validatedTransactionCount: 2396,
    incomeMinor: 2_214_542_460n,
    expenseMinor: 1_362_642_716n
  }
};

export function assertOfficeB2IngestionGuard(dump: LegacyOfficeDump, contract: OfficeB2Contract): void {
  const actual = sourceCounts(dump);
  assertCountsMatch(actual, contract.expectedCounts);
  const actualStatusCounts = countOfficeB2TransactionStatuses(dump.transactions, "Office B2 source");
  assertStatusCountsMatch(actualStatusCounts, contract.expectedTransactionStatusCounts);
}

export function transformOfficeLegacyDump(dump: LegacyOfficeDump, contract: OfficeB2Contract): OfficeB2TransformResult {
  assertOfficeB2IngestionGuard(dump, contract);
  const dimensions = resolveLegacyDimensions(dump.departments);
  const dataset: OfficeAnalyticsDataset = {
    departments: transformDepartments(dump.departments),
    divisions: transformDivisions(dump.departments),
    categories: transformCategories(dump.categories, dimensions),
    partners: transformPartners(dump.partners),
    projects: transformProjects(dump.projects),
    projectBudgetLines: [],
    transactions: transformTransactions(dump.transactions),
    financialAllocations: transformFinancialAllocations(dump.financialAllocations),
    bankAccounts: transformBankAccounts(dump.bankAccounts, dump.bankRawTransactions),
    bankImportBatches: transformBankImportBatches(dump.bankRawTransactions),
    bankStatementLines: transformBankStatementLines(dump.bankRawTransactions, dump.bankReconciliations),
    bankReconciliationMatches: transformBankReconciliationMatches(dump.bankReconciliations),
    cashflowProjectionRows: transformCashflowProjectionRows(),
    exchangeRates: []
  };
  const ignoredDivisionNameDriftCount = countDivisionNameDrift(dump, dimensions);
  const parityReport = createParityReport(dataset, contract.parity);
  assertQualityContract(dump, dimensions, contract.expectedQuality, ignoredDivisionNameDriftCount);

  return {
    dataset,
    parityReport,
    ignoredDivisionNameDriftCount,
    notes: [
      "financial_allocations.division_name is ignored by design; category.division_id is the only division source.",
      "Project/partner P&L without department filters intentionally diverges from legacy WP BUG-M1 and returns actual ledger totals."
    ]
  };
}

function sourceCounts(dump: LegacyOfficeDump): OfficeB2ExpectedCounts {
  return {
    transactions: dump.transactions.length,
    financialAllocations: dump.financialAllocations.length,
    categories: dump.categories.length,
    departments: dump.departments.length,
    partners: dump.partners.length,
    projects: dump.projects.length,
    bankAccounts: dump.bankAccounts.length,
    bankRawTransactions: dump.bankRawTransactions.length,
    bankReconciliations: dump.bankReconciliations.length
  };
}

function assertCountsMatch(actual: OfficeB2ExpectedCounts, expected: OfficeB2ExpectedCounts): void {
  for (const key of Object.keys(expected) as readonly (keyof OfficeB2ExpectedCounts)[]) {
    if (actual[key] !== expected[key]) {
      throw new Error(`Office B2 ingestion guard failed for ${key}: expected ${String(expected[key])}, got ${String(actual[key])}.`);
    }
  }
}

function resolveLegacyDimensions(departments: readonly LegacyOfficeDepartmentRow[]): ResolvedLegacyDimensions {
  const topLevelDepartmentIds = new Set<string>();
  const divisionRowsById = new Map<string, LegacyOfficeDepartmentRow>();
  for (const department of departments) {
    if (department.parentId === null || department.parentId.trim().length === 0) {
      topLevelDepartmentIds.add(department.id);
    } else {
      divisionRowsById.set(department.id, department);
    }
  }

  return {
    topLevelDepartmentIds,
    divisionRowsById
  };
}

function transformDepartments(rows: readonly LegacyOfficeDepartmentRow[]): readonly OfficeDepartmentRow[] {
  return rows
    .filter((row) => row.parentId === null || row.parentId.trim().length === 0)
    .map((row) => ({
      id: row.id,
      name: row.name,
      type: normalizeDepartmentType(row.type),
      color: row.color,
      isActive: toBoolean(row.isActive)
    }));
}

function transformDivisions(rows: readonly LegacyOfficeDepartmentRow[]): readonly OfficeDivisionRow[] {
  return rows
    .filter((row) => row.parentId !== null && row.parentId.trim().length > 0)
    .map((row) => ({
      id: row.id,
      departmentId: requireText(row.parentId, "division.parentId", row.id),
      name: row.name,
      isActive: toBoolean(row.isActive)
    }));
}

function transformCategories(rows: readonly LegacyOfficeCategoryRow[], dimensions: ResolvedLegacyDimensions): readonly OfficeCategoryRow[] {
  return rows.map((row) => {
    assertCategoryDimension(row, dimensions);
    return {
      id: row.id,
      name: row.name,
      type: normalizeFinancialType(row.type, "category.type", row.id),
      divisionId: row.divisionId,
      isActive: toBoolean(row.isActive)
    };
  });
}

function transformPartners(rows: readonly LegacyOfficePartnerRow[]): readonly OfficePartnerRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: normalizePartnerType(row.type),
    isActive: toBoolean(row.isActive)
  }));
}

function transformProjects(rows: readonly LegacyOfficeProjectRow[]): readonly OfficeProjectRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: normalizeProjectStatus(row.status),
    state: row.state ?? row.status ?? "active",
    isActive: toBoolean(row.isActive)
  }));
}

function transformTransactions(rows: readonly LegacyOfficeTransactionRow[]): readonly OfficeTransactionRow[] {
  return rows.map((row) => ({
    id: row.id,
    transactionDate: row.transactionDate,
    type: normalizeFinancialType(row.type, "transaction.type", row.id),
    status: normalizeTransactionStatus(row.status),
    isActive: toBoolean(row.isActive),
    description: row.description,
    categoryId: row.categoryId,
    partnerId: row.partnerId,
    projectId: row.projectId,
    accountId: null,
    amountMinor: eofMoney.parse(row.amountMur),
    originalCurrency: normalizeOriginalCurrency(row.originalCurrency),
    exchangeRateE10: row.exchangeRate === null ? null : erhMoney.parse(row.exchangeRate)
  }));
}

function transformFinancialAllocations(rows: readonly LegacyOfficeFinancialAllocationRow[]): readonly OfficeFinancialAllocationRow[] {
  return rows.map((row) => ({
    id: row.id,
    transactionId: row.transactionId,
    departmentId: row.departmentId,
    amountMinor: eofMoney.parse(row.amountMur)
  }));
}

function transformBankAccounts(
  rows: readonly LegacyOfficeBankAccountRow[],
  rawTransactions: readonly LegacyOfficeBankRawTransactionRow[]
): readonly OfficeAnalyticsDataset["bankAccounts"][number][] {
  const latestRawByAccountId = latestRawTransactionByAccountId(rawTransactions);

  return rows.map((row) => {
    const latestRaw = latestRawByAccountId.get(row.id) ?? null;
    const accountReference = row.accountNumber === null || row.accountNumber.trim().length === 0 ? row.id : row.accountNumber.trim();
    const currency = normalizeBankCurrency(row.currency);
    const currentBalanceMinor = latestRaw?.balance === null || latestRaw === null ? 0n : eofMoney.parse(latestRaw.balance);

    return {
      id: row.id,
      workspaceId: "eeee-mu",
      bankName: firstNonEmptyText([row.bankName, row.institution, row.name], "Bank"),
      accountLabel: row.name,
      accountReferenceHash: `legacy-office-bank-account:${row.id}:${accountReference}`,
      currency,
      currentBalanceMinor,
      currentBalanceMurMinor: currency === "MUR" ? currentBalanceMinor : null,
      isActive: toBoolean(row.isActive),
      balanceAsOf: latestRaw === null ? null : normalizeTimestamp(latestRaw.transactionDate)
    };
  });
}

function transformBankImportBatches(rows: readonly LegacyOfficeBankRawTransactionRow[]): readonly OfficeBankImportBatchRow[] {
  const rowsByImportId = groupBankRawRowsByImportId(rows);

  return [...rowsByImportId.entries()]
    .sort(([left], [right]) => compareIntegerText(left, right))
    .map(([importId, importRows]) => {
      const accountId = singleValue(importRows.map((row) => row.accountId), `bank import ${importId} account_id`);
      const dates = importRows.map((row) => normalizeDate(row.transactionDate)).sort();
      const latestCreatedAt = latestTimestampText(importRows.map((row) => row.createdAt));
      const duplicateCount = importRows.filter((row) => row.dedupeHash !== null && row.dedupeHash.trim().length > 0).length;

      return {
        id: importId,
        workspaceId: "eeee-mu",
        source: "csv",
        fileName: `legacy-bank-import-${importId}.csv`,
        checksum: `legacy-office-bank-import:${importId}`,
        accountId,
        periodStart: dates[0] ?? null,
        periodEnd: dates[dates.length - 1] ?? null,
        openingBalanceMinor: null,
        closingBalanceMinor: latestBalanceMinor(importRows),
        currency: "MUR",
        acceptedRowCount: importRows.length,
        rejectedRowCount: 0,
        duplicateRowCount: duplicateCount,
        idempotencyFingerprint: `legacy-office-bank-import:${importId}`,
        status: "confirmed",
        importedAt: latestCreatedAt,
        metadata: {
          legacyImportId: importId,
          rawRowCount: importRows.length
        }
      };
    });
}

function transformBankStatementLines(
  rows: readonly LegacyOfficeBankRawTransactionRow[],
  reconciliations: readonly LegacyOfficeBankReconciliationRow[]
): readonly OfficeBankStatementLineRow[] {
  const matchedTransactionIdByRawId = matchedTransactionIdByBankRawTransactionId(reconciliations);

  return rows.map((row) => ({
    id: row.id,
    importBatchId: row.importId,
    accountId: row.accountId,
    occurredOn: normalizeDate(row.transactionDate),
    valueOn: null,
    description: firstNonEmptyText([row.description], "(no description)"),
    reference: row.externalId,
    direction: normalizeBankDirection(row.direction),
    amountMinor: eofMoney.parse(row.amount),
    balanceMinor: row.balance === null ? null : eofMoney.parse(row.balance),
    currency: "MUR",
    amountMurMinor: eofMoney.parse(row.amount),
    balanceMurMinor: row.balance === null ? null : eofMoney.parse(row.balance),
    isDuplicateCandidate: row.dedupeHash !== null && row.dedupeHash.trim().length > 0,
    reconciliationStatus: normalizeBankReconciliationStatus(row.status),
    matchedTransactionId: matchedTransactionIdByRawId.get(row.id) ?? null,
    rawData: {
      legacyRawPayload: row.rawPayload,
      legacyStatus: row.status,
      legacyCreatedAt: row.createdAt
    }
  }));
}

function transformBankReconciliationMatches(rows: readonly LegacyOfficeBankReconciliationRow[]): readonly OfficeBankReconciliationMatchRow[] {
  return dedupeBankReconciliationRows(rows).map((row) => ({
    id: row.id,
    bankStatementLineId: row.bankRawTransactionId,
    transactionId: row.transactionId,
    confidenceBp: row.status === "validated" ? 10000 : 5000,
    status: normalizeBankReconciliationStatus(row.status),
    approvedByUserId: row.validatedByUserId,
    approvedAt: row.validatedAt === null ? null : normalizeTimestamp(row.validatedAt)
  }));
}

function transformCashflowProjectionRows(): readonly OfficeCashflowProjectionRowInput[] {
  return [];
}

function latestRawTransactionByAccountId(rows: readonly LegacyOfficeBankRawTransactionRow[]): ReadonlyMap<string, LegacyOfficeBankRawTransactionRow> {
  const latestByAccountId = new Map<string, LegacyOfficeBankRawTransactionRow>();
  for (const row of rows) {
    const current = latestByAccountId.get(row.accountId) ?? null;
    if (current === null || normalizeTimestamp(row.transactionDate) > normalizeTimestamp(current.transactionDate)) {
      latestByAccountId.set(row.accountId, row);
    }
  }

  return latestByAccountId;
}

function groupBankRawRowsByImportId(rows: readonly LegacyOfficeBankRawTransactionRow[]): ReadonlyMap<string, readonly LegacyOfficeBankRawTransactionRow[]> {
  const mutableRowsByImportId = new Map<string, LegacyOfficeBankRawTransactionRow[]>();
  for (const row of rows) {
    const rowsForImport = mutableRowsByImportId.get(row.importId) ?? [];
    rowsForImport.push(row);
    mutableRowsByImportId.set(row.importId, rowsForImport);
  }

  return new Map([...mutableRowsByImportId.entries()].map(([importId, importRows]) => [importId, [...importRows]]));
}

function matchedTransactionIdByBankRawTransactionId(rows: readonly LegacyOfficeBankReconciliationRow[]): ReadonlyMap<string, string> {
  const matchedByRawId = new Map<string, string>();
  for (const row of rows) {
    if (normalizeBankReconciliationStatus(row.status) === "matched") {
      matchedByRawId.set(row.bankRawTransactionId, row.transactionId);
    }
  }

  return matchedByRawId;
}

function dedupeBankReconciliationRows(rows: readonly LegacyOfficeBankReconciliationRow[]): readonly LegacyOfficeBankReconciliationRow[] {
  const rowByLinkKey = new Map<string, LegacyOfficeBankReconciliationRow>();
  for (const row of rows) {
    const key = `${row.bankRawTransactionId}:${row.transactionId}`;
    const current = rowByLinkKey.get(key) ?? null;
    if (current === null || bankReconciliationRank(row) > bankReconciliationRank(current)) {
      rowByLinkKey.set(key, row);
    }
  }

  return [...rowByLinkKey.values()];
}

function bankReconciliationRank(row: LegacyOfficeBankReconciliationRow): number {
  if (normalizeBankReconciliationStatus(row.status) === "matched") {
    return 2;
  }

  if (normalizeBankReconciliationStatus(row.status) === "suggested") {
    return 1;
  }

  return 0;
}

function latestBalanceMinor(rows: readonly LegacyOfficeBankRawTransactionRow[]): bigint | null {
  const rowsWithBalance = rows.filter((row) => row.balance !== null);
  if (rowsWithBalance.length === 0) {
    return null;
  }

  const latest = rowsWithBalance.reduce((currentLatest, row) =>
    normalizeTimestamp(row.transactionDate) > normalizeTimestamp(currentLatest.transactionDate) ? row : currentLatest
  );

  return latest.balance === null ? null : eofMoney.parse(latest.balance);
}

function firstNonEmptyText(values: readonly (string | null)[], fallback: string): string {
  for (const value of values) {
    if (value !== null && value.trim().length > 0) {
      return value.trim();
    }
  }

  return fallback;
}

function singleValue(values: readonly string[], context: string): string {
  const uniqueValues = new Set(values);
  if (uniqueValues.size !== 1) {
    throw new Error(`Expected one ${context}; got ${String(uniqueValues.size)}.`);
  }

  const [value] = uniqueValues;
  if (value === undefined) {
    throw new Error(`Expected one ${context}; got none.`);
  }

  return value;
}

function normalizeDate(value: string): string {
  return value.slice(0, 10);
}

function normalizeTimestamp(value: string): string {
  return value.includes("T") ? value : `${value.replace(" ", "T")}.000Z`;
}

function latestTimestampText(values: readonly string[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return values.map(normalizeTimestamp).sort().at(-1) ?? null;
}

function compareIntegerText(left: string, right: string): number {
  return Number(BigInt(left) - BigInt(right));
}

function normalizeBankCurrency(value: string): "MUR" | "EUR" | "USD" | "GBP" {
  if (value === "MUR" || value === "EUR" || value === "USD" || value === "GBP") {
    return value;
  }

  throw new Error(`Unsupported bank currency: ${value}.`);
}

function normalizeBankDirection(value: string): "credit" | "debit" {
  if (value === "credit" || value === "debit") {
    return value;
  }

  throw new Error(`Unsupported bank direction: ${value}.`);
}

function normalizeBankReconciliationStatus(value: string): "unmatched" | "suggested" | "matched" | "rejected" {
  if (value === "matched" || value === "validated") {
    return "matched";
  }

  if (value === "pending" || value === "partially_matched" || value === "suggested") {
    return "suggested";
  }

  if (value === "unmatched") {
    return "unmatched";
  }

  if (value === "rejected") {
    return "rejected";
  }

  throw new Error(`Unsupported bank reconciliation status: ${value}.`);
}

function assertCategoryDimension(row: LegacyOfficeCategoryRow, dimensions: ResolvedLegacyDimensions): void {
  if (!toBoolean(row.isActive)) {
    return;
  }

  const divisionId = requireText(row.divisionId, "category.divisionId", row.id);
  const departmentId = requireText(row.departmentId, "category.departmentId", row.id);
  const division = dimensions.divisionRowsById.get(divisionId);
  if (division === undefined) {
    throw new Error(`Office B2 category ${row.id} references missing division ${divisionId}.`);
  }

  if (division.parentId !== departmentId) {
    throw new Error(`Office B2 category ${row.id} has inconsistent department ${departmentId} for division ${divisionId}.`);
  }

  if (!dimensions.topLevelDepartmentIds.has(departmentId)) {
    throw new Error(`Office B2 category ${row.id} references missing top-level department ${departmentId}.`);
  }
}

function assertQualityContract(
  dump: LegacyOfficeDump,
  dimensions: ResolvedLegacyDimensions,
  expected: OfficeB2ExpectedQuality,
  ignoredDivisionNameDriftCount: number
): void {
  const actualInconsistentCategories = countInconsistentCategories(dump.categories, dimensions);
  const actualEmptyCurrencyRows = dump.transactions.filter((row) => row.originalCurrency === "").length;
  const actualAllocationMismatch = countAllocationSumMismatches(dump);
  const actualOrphanForeignKeys = countOrphanForeignKeys(dump);
  assertQualityValue("inconsistentCategories", actualInconsistentCategories, expected.inconsistentCategories);
  assertQualityValue("emptyCurrencyRows", actualEmptyCurrencyRows, expected.emptyCurrencyRows);
  assertQualityValue("allocationSumMismatch", actualAllocationMismatch, expected.allocationSumMismatch);
  assertQualityValue("orphanForeignKeys", actualOrphanForeignKeys, expected.orphanForeignKeys);
  assertQualityValue("ignoredDivisionNameDrift", ignoredDivisionNameDriftCount, expected.ignoredDivisionNameDrift);
}

function assertQualityValue(label: string, actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(`Office B2 quality guard failed for ${label}: expected ${String(expected)}, got ${String(actual)}.`);
  }
}

function countInconsistentCategories(rows: readonly LegacyOfficeCategoryRow[], dimensions: ResolvedLegacyDimensions): number {
  return rows.filter((row) => {
    if (!toBoolean(row.isActive)) {
      return false;
    }

    if (row.departmentId === null || row.divisionId === null) {
      return true;
    }

    const division = dimensions.divisionRowsById.get(row.divisionId);
    return division === undefined || division.parentId === null || division.parentId !== row.departmentId;
  }).length;
}

function countAllocationSumMismatches(dump: LegacyOfficeDump): number {
  const allocationSums = new Map<string, bigint>();
  for (const allocation of dump.financialAllocations) {
    const previous = allocationSums.get(allocation.transactionId) ?? 0n;
    allocationSums.set(allocation.transactionId, eofMoney.add(previous, eofMoney.parse(allocation.amountMur)));
  }

  return dump.transactions.filter((transaction) => {
    if (transaction.status !== "validated" || !toBoolean(transaction.isActive)) {
      return false;
    }

    const allocationSum = allocationSums.get(transaction.id);
    if (allocationSum === undefined) {
      return false;
    }

    return abs(eofMoney.parse(transaction.amountMur) - allocationSum) > 1n;
  }).length;
}

function countOrphanForeignKeys(dump: LegacyOfficeDump): number {
  const departmentIds = new Set<string>(dump.departments.map((row) => row.id));
  const categoryIds = new Set<string>(dump.categories.map((row) => row.id));
  const partnerIds = new Set<string>(dump.partners.map((row) => row.id));
  const projectIds = new Set<string>(dump.projects.map((row) => row.id));
  const transactionIds = new Set<string>(dump.transactions.map((row) => row.id));
  let count = 0;
  for (const category of dump.categories) {
    if (category.departmentId !== null && !departmentIds.has(category.departmentId)) {
      count += 1;
    }

    if (category.divisionId !== null && !departmentIds.has(category.divisionId)) {
      count += 1;
    }
  }

  for (const transaction of dump.transactions) {
    if (transaction.categoryId !== null && !categoryIds.has(transaction.categoryId)) {
      count += 1;
    }

    if (transaction.partnerId !== null && !partnerIds.has(transaction.partnerId)) {
      count += 1;
    }

    if (transaction.projectId !== null && !projectIds.has(transaction.projectId)) {
      count += 1;
    }
  }

  for (const allocation of dump.financialAllocations) {
    if (!departmentIds.has(allocation.departmentId)) {
      count += 1;
    }

    if (!transactionIds.has(allocation.transactionId)) {
      count += 1;
    }
  }

  return count;
}

function countDivisionNameDrift(dump: LegacyOfficeDump, dimensions: ResolvedLegacyDimensions): number {
  const categoriesById = new Map<string, LegacyOfficeCategoryRow>(dump.categories.map((category) => [category.id, category]));
  const transactionsById = new Map<string, LegacyOfficeTransactionRow>(dump.transactions.map((transaction) => [transaction.id, transaction]));
  let count = 0;
  for (const allocation of dump.financialAllocations) {
    if (allocation.divisionName === null || allocation.divisionName === "") {
      continue;
    }

    const transaction = transactionsById.get(allocation.transactionId);
    const category = transaction?.categoryId === null || transaction === undefined ? undefined : categoriesById.get(transaction.categoryId);
    const division = category?.divisionId === null || category === undefined ? undefined : dimensions.divisionRowsById.get(category.divisionId);
    if (allocation.divisionName !== (division?.name ?? "")) {
      count += 1;
    }
  }

  return count;
}

function createParityReport(dataset: OfficeAnalyticsDataset, target: OfficeB2ParityTarget): OfficeB2ParityReport {
  const transactionStatusCounts = countOfficeB2TransactionStatuses(dataset.transactions, "Office B2 clean target");
  const raw = rawValidatedParity(dataset.transactions);
  const engine = readGlobalPnl(dataset, { dateFrom: null, dateTo: null, departmentId: null });
  const engineIncomeMinor = eofMoney.parse(engine.income);
  const engineExpenseMinor = eofMoney.parse(engine.expense);
  assertParityValue("validatedTransactionCount", raw.validatedTransactionCount, target.validatedTransactionCount);
  assertParityValue("rawIncomeMinor", raw.incomeMinor, target.incomeMinor);
  assertParityValue("rawExpenseMinor", raw.expenseMinor, target.expenseMinor);
  assertParityValue("engineIncomeMinor", engineIncomeMinor, target.incomeMinor);
  assertParityValue("engineExpenseMinor", engineExpenseMinor, target.expenseMinor);
  return {
    transactionStatusCounts,
    rawValidatedTransactionCount: raw.validatedTransactionCount,
    rawIncomeMinor: raw.incomeMinor,
    rawExpenseMinor: raw.expenseMinor,
    engineIncomeMinor,
    engineExpenseMinor,
    projectPartnerOrgWideDivergence: "expected_wp_bug_m1"
  };
}

function rawValidatedParity(rows: readonly OfficeTransactionRow[]): OfficeB2ParityTarget {
  let validatedTransactionCount = 0;
  let incomeMinor = 0n;
  let expenseMinor = 0n;
  for (const row of rows) {
    if (row.status !== "validated" || !row.isActive) {
      continue;
    }

    validatedTransactionCount += 1;
    if (row.type === "income") {
      incomeMinor = eofMoney.add(incomeMinor, row.amountMinor);
    } else {
      expenseMinor = eofMoney.add(expenseMinor, row.amountMinor);
    }
  }

  return {
    validatedTransactionCount,
    incomeMinor,
    expenseMinor
  };
}

function assertParityValue(label: string, actual: bigint | number, expected: bigint | number): void {
  if (actual !== expected) {
    throw new Error(`Office B2 parity failed for ${label}: expected ${String(expected)}, got ${String(actual)}.`);
  }
}

export function countOfficeB2TransactionStatuses(rows: readonly { readonly status: string }[], context: string): OfficeB2TransactionStatusCounts {
  let validated = 0;
  let draft = 0;
  let cancelled = 0;

  for (const row of rows) {
    if (row.status === "validated") {
      validated += 1;
      continue;
    }

    if (row.status === "draft") {
      draft += 1;
      continue;
    }

    if (row.status === "cancelled") {
      cancelled += 1;
      continue;
    }

    throw new Error(`${context} transaction status is invalid: ${row.status}.`);
  }

  return {
    validated,
    draft,
    cancelled
  };
}

function assertStatusCountsMatch(actual: OfficeB2TransactionStatusCounts, expected: OfficeB2TransactionStatusCounts): void {
  assertStatusCountValue("validated", actual.validated, expected.validated);
  assertStatusCountValue("draft", actual.draft, expected.draft);
  assertStatusCountValue("cancelled", actual.cancelled, expected.cancelled);
}

function assertStatusCountValue(label: keyof OfficeB2TransactionStatusCounts, actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(`Office B2 transaction status guard failed for ${label}: expected ${String(expected)}, got ${String(actual)}.`);
  }
}

function normalizeFinancialType(value: string, field: string, rowId: string): OfficeTransactionType {
  if (value === "income" || value === "expense") {
    return value;
  }

  throw new Error(`Office B2 ${field} is invalid for ${rowId}: ${value}.`);
}

function normalizeDepartmentType(value: string | null): OfficeDepartmentType {
  if (value === "income" || value === "expense" || value === "mixed") {
    return value;
  }

  return "mixed";
}

function normalizePartnerType(value: string | null): OfficePartnerType {
  if (value === "client" || value === "supplier" || value === "both") {
    return value;
  }

  return "client";
}

function normalizeProjectStatus(value: string | null): OfficeProjectStatus {
  if (value === "draft" || value === "active" || value === "paused" || value === "completed" || value === "cancelled" || value === "archived") {
    return value;
  }

  return "active";
}

function normalizeTransactionStatus(value: string): OfficeTransactionStatus {
  if (value === "validated" || value === "draft" || value === "cancelled") {
    return value;
  }

  throw new Error(`Office B2 transaction status is invalid: ${value}.`);
}

function normalizeOriginalCurrency(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return value;
  }

  if (!/^[A-Z]{3}$/.test(value)) {
    throw new Error(`Office B2 original currency is invalid: ${value}.`);
  }

  return value;
}

function toBoolean(value: LegacyBoolean): boolean {
  return value === true || value === 1 || value === "1";
}

function requireText(value: string | null, field: string, rowId: string): string {
  if (value === null || value.trim().length === 0) {
    throw new Error(`Office B2 ${field} is required for ${rowId}.`);
  }

  return value;
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}
