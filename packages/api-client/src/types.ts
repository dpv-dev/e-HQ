export type LegacyNamespace = "eof/v1" | "erh/v1" | "cc/v1";
export type HttpMethod = "DELETE" | "GET" | "POST" | "PATCH";
export type IsoDateString = string;
export type IsoDateTimeString = string;
export type IsoMonthString = string;
export type StatementPeriodString = string;
export type DecimalString = string;
export type MoneyMicroString = string;
export type CurrencyCode = string;
export type CursorString = string;
export type EntityId = string;
export type IdempotencyKey = string;
export type LockToken = string;
export type BasisPoints = number;
export type OfficeCategoryType = "income" | "expense";

export interface AuthTokenProvider {
  readonly getAccessToken: () => Promise<string | null>;
}

export interface FetchLike {
  (input: RequestInfo | URL, init: RequestInit): Promise<Response>;
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxRetryAfterMs: number;
  readonly retryableStatuses: readonly number[];
  readonly retryMethods: readonly HttpMethod[];
}

export interface ApiClientConfig {
  readonly baseUrl: string;
  readonly fetch: FetchLike;
  readonly auth: AuthTokenProvider;
  readonly retryPolicy: RetryPolicy;
  readonly readCacheTtlMs?: number;
}

export interface WriteRequestOptions {
  readonly idempotencyKey: IdempotencyKey;
}

export interface PageQuery {
  readonly cursor: CursorString | null;
  readonly limit: number;
}

export interface PageResult<TItem> {
  readonly items: readonly TItem[];
  readonly nextCursor: CursorString | null;
}

export interface PeriodQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString;
  // Optional explicit date range from the Period control. When both are set they
  // drive the server-side dateFrom/dateTo filters; otherwise the month is used.
  readonly dateFrom?: IsoDateString | null;
  readonly dateTo?: IsoDateString | null;
}

export interface DateRangeQuery {
  readonly workspaceId: EntityId;
  readonly from: IsoDateString;
  readonly to: IsoDateString;
}

export interface ApiMutationReceipt {
  readonly id: EntityId;
  readonly status: "accepted" | "queued" | "completed";
  readonly auditEventId: EntityId | null;
}

export interface CommandCenterWorkspaceQuery {
  readonly workspaceId: EntityId;
}

export type CommandCenterNotificationTone = "success" | "warning" | "error" | "info";

export interface CommandCenterNotification {
  readonly id: EntityId;
  readonly title: string;
  readonly detail: string;
  readonly tone: CommandCenterNotificationTone;
  readonly workspaceId: EntityId;
  readonly createdAt: IsoDateTimeString;
  readonly actionLabel: string | null;
  readonly actionHref: string | null;
}

export interface CommandCenterNotificationsResponse {
  readonly workspaceId: EntityId;
  readonly unreadCount: number;
  readonly generatedAt: IsoDateTimeString;
  readonly items: readonly CommandCenterNotification[];
}

export type CommandCenterReadinessTone = "success" | "warning" | "error" | "info";

export interface CommandCenterReadinessItem {
  readonly id: EntityId;
  readonly label: string;
  readonly detail: string;
  readonly tone: CommandCenterReadinessTone;
}

export type CommandCenterIntegrationStatus = "connected" | "idle" | "attention";

export interface CommandCenterOverviewIntegration {
  readonly id: EntityId;
  readonly connector: string;
  readonly kind: string;
  readonly scope: string;
  readonly status: CommandCenterIntegrationStatus;
  readonly action: string;
}

export type CommandCenterSettingTone = "active" | "success" | "warning" | "info";

export interface CommandCenterOverviewSetting {
  readonly id: EntityId;
  readonly key: string;
  readonly value: string;
  readonly status: string;
  readonly tone: CommandCenterSettingTone;
}

export interface CommandCenterOverviewResponse {
  readonly workspaceId: EntityId;
  readonly generatedAt: IsoDateTimeString;
  readonly readiness: readonly CommandCenterReadinessItem[];
  readonly integrations: readonly CommandCenterOverviewIntegration[];
  readonly settings: readonly CommandCenterOverviewSetting[];
}

export interface CommandCenterSettingUpdateRequest {
  readonly workspaceId: EntityId;
  readonly key: string;
  readonly value: Readonly<Record<string, unknown>>;
  readonly status: string;
}

export interface CommandCenterIntegrationToggleRequest {
  readonly workspaceId: EntityId;
  readonly integrationId: EntityId;
  readonly enabled: boolean;
  readonly status: string;
}

export interface CommandCenterUserPermissionUpdateRequest {
  readonly workspaceId: EntityId;
  readonly userId: EntityId;
  readonly email: string;
  readonly role: string;
  readonly permissions: Readonly<Record<string, unknown>>;
}

export interface CommandCenterSettingRow {
  readonly key: string;
  readonly value: Readonly<Record<string, unknown>>;
  readonly status: string;
  readonly updatedAt: IsoDateTimeString;
}

export interface CommandCenterIntegrationState {
  readonly integrationId: EntityId;
  readonly enabled: boolean;
  readonly status: string;
  readonly updatedAt: IsoDateTimeString;
}

export interface CommandCenterUserPermission {
  readonly userId: EntityId;
  readonly email: string;
  readonly role: string;
  readonly permissions: Readonly<Record<string, unknown>>;
  readonly updatedAt: IsoDateTimeString;
}

export interface ApiRunReceipt {
  readonly runId: EntityId;
  readonly status: "queued" | "running" | "completed" | "failed";
  readonly lockKey: string;
  readonly auditEventId: EntityId | null;
}

export interface AuditLogEntry {
  readonly id: EntityId;
  readonly occurredAt: IsoDateTimeString;
  readonly actorId: EntityId;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: EntityId;
  readonly entityReference: string;
  readonly idempotencyKey: IdempotencyKey | null;
  readonly context: Readonly<Record<string, string>>;
}

export interface AuditLogQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly from: IsoDateString | null;
  readonly to: IsoDateString | null;
  readonly actorId: EntityId | null;
  readonly entityType: string | null;
}

export interface OfficeDashboardQuery extends PeriodQuery {}

export interface OfficeDashboardAnalyticsQuery extends PeriodQuery {}

export interface OfficeDashboardAnalyticsRunway {
  readonly period: IsoMonthString;
  readonly cashBalanceMicro: MoneyMicroString;
  readonly averageMonthlyBurnMicro: MoneyMicroString;
  readonly runwayMonths: DecimalString | null;
  readonly monthsUsed: readonly IsoMonthString[];
  readonly excludedForeignAccounts: readonly OfficeDashboardRunwayExcludedAccount[];
}

export interface OfficeDashboardRunwayExcludedAccount {
  readonly accountId: EntityId;
  readonly bankName: string;
  readonly accountLabel: string;
  readonly currency: CurrencyCode;
  readonly balanceMicro: MoneyMicroString;
}

export interface OfficeDashboardExpenseCategoryKpi {
  readonly categoryId: EntityId;
  readonly label: string;
  readonly expenseMicro: MoneyMicroString;
  readonly shareBp: BasisPoints;
}

export interface OfficeDashboardProjectProfitabilityKpi {
  readonly projectId: EntityId;
  readonly projectLabel: string;
  readonly incomeMicro: MoneyMicroString;
  readonly expenseMicro: MoneyMicroString;
  readonly netMicro: MoneyMicroString;
  readonly marginBp: BasisPoints | null;
}

export interface OfficeDashboardReconciliationAccountKpi {
  readonly accountId: EntityId;
  readonly accountLabel: string;
  readonly bankName: string;
  readonly currency: CurrencyCode;
  readonly lineCount: number;
  readonly unmatchedLineCount: number;
  readonly matchedRateBp: BasisPoints;
  readonly oldestUnmatchedDays: number | null;
}

export interface OfficeDashboardDepartmentExpenseTrendKpi {
  readonly departmentId: EntityId;
  readonly departmentLabel: string;
  readonly monthlyExpenseMicro: readonly MoneyMicroString[];
  readonly latestMonthExpenseMicro: MoneyMicroString;
}

export interface OfficeDashboardAnalyticsResponse {
  readonly period: IsoMonthString;
  readonly dateFrom: IsoDateString;
  readonly dateTo: IsoDateString;
  readonly generatedAt: IsoDateTimeString;
  readonly runway: OfficeDashboardAnalyticsRunway;
  readonly topExpenseCategories: readonly OfficeDashboardExpenseCategoryKpi[];
  readonly projectProfitability: readonly OfficeDashboardProjectProfitabilityKpi[];
  readonly reconciliationByAccount: readonly OfficeDashboardReconciliationAccountKpi[];
  readonly oldestUnmatchedDays: number | null;
  readonly expenseTrendMonths: readonly IsoMonthString[];
  readonly expenseTrendByDepartment: readonly OfficeDashboardDepartmentExpenseTrendKpi[];
}

export interface OfficeRecentImport {
  readonly id: EntityId;
  readonly source: "sbi" | "mcb" | "csv" | "cashflow" | "pdf";
  readonly fileName: string;
  readonly importedAt: IsoDateTimeString;
  readonly periodLabel: string;
  readonly acceptedRowCount: number;
  readonly rejectedRowCount: number;
  readonly duplicateRowCount: number;
  readonly status: "previewed" | "confirmed" | "failed";
}

// Same indicators computed over the window immediately preceding the requested
// one (previous calendar year/month for aligned ranges, day-length shift otherwise).
// Null when the requested range has no computable predecessor.
export interface OfficeDashboardPreviousPeriod {
  readonly dateFrom: IsoDateString;
  readonly dateTo: IsoDateString;
  readonly cashBalanceMicro: MoneyMicroString;
  readonly receivablesMicro: MoneyMicroString;
  readonly payablesMicro: MoneyMicroString;
  readonly unreconciledTransactionCount: number;
}

export interface OfficeDashboardResponse {
  readonly period: IsoMonthString;
  readonly cashBalanceMicro: MoneyMicroString;
  readonly receivablesMicro: MoneyMicroString;
  readonly payablesMicro: MoneyMicroString;
  readonly unreconciledTransactionCount: number;
  readonly lastAuditEventId: EntityId | null;
  readonly recentImports?: readonly OfficeRecentImport[];
  readonly previous?: OfficeDashboardPreviousPeriod | null;
}

export interface OfficeWriteStatusResponse {
  readonly writesEnabled: boolean;
}

// One-round-trip bundle for the Office console's initial/period-scoped load; the server
// fans out internally to the individual endpoints, so every field matches its standalone
// endpoint's response shape exactly.
export interface OfficeScreenQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString;
  readonly dateFrom: IsoDateString;
  readonly dateTo: IsoDateString;
}

export interface OfficeWorkbenchSnapshotCurrencyTotal {
  readonly currency: CurrencyCode;
  readonly amountMicro: MoneyMicroString;
}

export interface OfficeWorkbenchSnapshotResponse {
  readonly transactionCount: number;
  readonly reconciliationCount: number;
  readonly reconciledTransactionCount: number;
  readonly unreconciledTransactionCount: number;
  readonly reconciledByCurrency: readonly OfficeWorkbenchSnapshotCurrencyTotal[];
}

export interface OfficeScreenResponse {
  readonly status: OfficeWriteStatusResponse;
  readonly dashboard: OfficeDashboardResponse;
  readonly globalPnl: OfficeGlobalPnl;
  readonly divisionPnl: PageResult<OfficeDivisionPnl>;
  readonly planComptable: readonly OfficePlanComptableNode[];
  readonly transactions: PageResult<OfficeTransaction>;
  readonly pendingTransactions: PageResult<OfficeTransaction>;
  readonly reconciliations: PageResult<OfficeReconciliationCandidate>;
  readonly cashflow: readonly CashflowBucket[];
  readonly auditLog: PageResult<AuditLogEntry>;
  readonly bankAccounts: PageResult<OfficeBankAccountSummary>;
  readonly workbenchSnapshot: OfficeWorkbenchSnapshotResponse;
}

export interface OfficePnlProjectionQuery extends PeriodQuery {
  readonly departmentId: EntityId | null;
}

export interface OfficePnlProjectionRow {
  readonly id: EntityId;
  readonly departmentId: EntityId;
  readonly departmentLabel: string;
  readonly revenueMicro: MoneyMicroString;
  readonly expenseMicro: MoneyMicroString;
  readonly netMicro: MoneyMicroString;
  readonly revenueBarLevel: number;
  readonly expenseBarLevel: number;
  readonly netBarLevel: number;
  readonly netTone: "positive" | "negative";
  readonly validatedProjectionId: EntityId;
  readonly validatedAt: IsoDateTimeString;
}

export interface OfficePnlLine {
  readonly id: EntityId;
  readonly label: string;
  readonly incomeMicro: MoneyMicroString;
  readonly expenseMicro: MoneyMicroString;
  readonly netMicro: MoneyMicroString;
}

export interface OfficeGlobalPnlQuery extends PeriodQuery {}

export interface OfficeCategoryPnlQuery extends PeriodQuery, PageQuery {
  readonly departmentId: EntityId | null;
}

export interface OfficeGlobalPnl {
  readonly scope: "global";
  readonly completeness: "complete";
  readonly period: IsoMonthString;
  readonly incomeMicro: MoneyMicroString;
  readonly expenseMicro: MoneyMicroString;
  readonly netMicro: MoneyMicroString;
  readonly validatedProjectionId: EntityId;
  readonly projectionRows: readonly OfficePnlProjectionRow[];
  readonly lines: readonly OfficePnlLine[];
}

export interface OfficeDivisionPnlQuery extends PeriodQuery, PageQuery {}

export interface OfficeDivisionPnl {
  readonly id: EntityId;
  readonly label: string;
  readonly incomeMicro: MoneyMicroString;
  readonly expenseMicro: MoneyMicroString;
  readonly netMicro: MoneyMicroString;
}

export interface OfficeDepartmentPnlQuery extends PeriodQuery {}

export interface OfficeDepartmentPnl {
  readonly scope: "department";
  readonly completeness: "complete";
  readonly departmentId: EntityId;
  readonly departmentLabel: string;
  readonly period: IsoMonthString;
  readonly incomeMicro: MoneyMicroString;
  readonly expenseMicro: MoneyMicroString;
  readonly netMicro: MoneyMicroString;
  readonly validatedProjectionId: EntityId;
  readonly projectionRows: readonly OfficePnlProjectionRow[];
  readonly lines: readonly OfficePnlLine[];
}

export interface OfficeTransactionsQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly dateFrom?: IsoDateString | null;
  readonly dateTo?: IsoDateString | null;
  readonly accountId: EntityId | null;
  readonly departmentId: EntityId | null;
  readonly divisionId: EntityId | null;
  readonly categoryId: EntityId | null;
  readonly projectId: EntityId | null;
  readonly type: OfficeCategoryType | null;
  readonly status: OfficeTransactionStatus | null;
}

export type OfficeTransactionStatus = "pending" | "draft" | "posted" | "reconciled" | "voided";

export interface OfficeTransactionBase {
  readonly id: EntityId;
  readonly occurredOn: IsoDateString;
  readonly accountId: EntityId | null;
  readonly partnerId: EntityId | null;
  readonly partnerLabel: string | null;
  readonly projectId: EntityId | null;
  readonly projectLabel: string | null;
  readonly description: string;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly vatApplicable: boolean;
  readonly vatRateBp: BasisPoints | null;
  readonly vatAmountMicro: MoneyMicroString | null;
  readonly sourceAuditEventId: EntityId | null;
}

export interface OfficeUnvalidatedTransaction extends OfficeTransactionBase {
  readonly status: "pending" | "draft";
  readonly departmentId: EntityId | null;
  readonly departmentLabel: string | null;
  readonly divisionId: EntityId | null;
  readonly divisionLabel: string | null;
  readonly categoryId: EntityId | null;
  readonly categoryLabel: string | null;
  readonly type: OfficeCategoryType | null;
}

export interface OfficeValidatedTransaction extends OfficeTransactionBase {
  readonly status: "posted" | "reconciled" | "voided";
  readonly departmentId: EntityId | null;
  readonly departmentLabel: string | null;
  readonly divisionId: EntityId | null;
  readonly divisionLabel: string | null;
  readonly categoryId: EntityId;
  readonly categoryLabel: string;
  readonly type: OfficeCategoryType;
}

export type OfficeTransaction = OfficeUnvalidatedTransaction | OfficeValidatedTransaction;

export interface OfficeTransactionWriteRequest {
  readonly workspaceId: EntityId;
  readonly occurredOn: IsoDateString;
  readonly accountId: EntityId;
  readonly categoryId: EntityId | null;
  readonly projectId: EntityId | null;
  readonly description: string;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  // VAT is configured on the source transaction. The API calculates and stores
  // the gross-inclusive VAT amount with the shared integer finance primitive.
  readonly vatApplicable?: boolean | undefined;
  readonly vatRateBp?: BasisPoints | null | undefined;
  // Income/expense is the transaction's own attribute; the category only files it
  // under division/department and never rewrites the type. Omitted on update the
  // stored type is preserved.
  readonly type?: "income" | "expense" | null | undefined;
}

export interface OfficePlanComptableQuery {
  readonly workspaceId: EntityId;
  readonly includeInactive: boolean;
}

export interface OfficePlanComptableNodesQuery extends OfficePlanComptableQuery, PageQuery {}

export interface OfficePlanComptableBaseNode {
  readonly id: EntityId;
  readonly code: string;
  readonly label: string;
  readonly active: boolean;
}

export interface OfficePlanComptableDepartmentNode extends OfficePlanComptableBaseNode {
  readonly kind: "department";
  readonly parentId: null;
}

export interface OfficePlanComptableDivisionNode extends OfficePlanComptableBaseNode {
  readonly kind: "division";
  readonly parentId: EntityId;
  readonly departmentId: EntityId;
  readonly departmentLabel: string;
}

export interface OfficePlanComptableCategoryNode extends OfficePlanComptableBaseNode {
  readonly kind: "category";
  readonly parentId: EntityId;
  readonly departmentId: EntityId;
  readonly departmentLabel: string;
  readonly divisionId: EntityId;
  readonly divisionLabel: string;
  readonly type: OfficeCategoryType;
}

export type OfficePlanComptableNode =
  | OfficePlanComptableDepartmentNode
  | OfficePlanComptableDivisionNode
  | OfficePlanComptableCategoryNode;

export interface OfficePlanComptableWriteRequest {
  readonly workspaceId: EntityId;
  readonly parentId: EntityId | null;
  readonly kind: "department" | "division" | "category";
  readonly code: string;
  readonly label: string;
  readonly active: boolean;
  readonly type: OfficeCategoryType | null;
}

export interface OfficePlanComptableDeleteRequest {
  readonly workspaceId: EntityId;
}

export interface BankImportPreviewRequest {
  readonly workspaceId: EntityId;
  readonly accountId?: EntityId;
  readonly source: "sbi" | "mcb" | "csv" | "cashflow" | "pdf";
  readonly fileName: string;
  readonly checksum: string;
  readonly rows: readonly Readonly<Record<string, string>>[];
}

export interface BankImportPreviewResponse {
  readonly previewId: EntityId;
  readonly accountId: EntityId | null;
  readonly source: "sbi" | "mcb" | "csv" | "cashflow" | "pdf";
  readonly detectedFormat: string;
  readonly accountReference: string | null;
  readonly periodLabel: string;
  readonly currencyCodes: readonly CurrencyCode[];
  readonly openingBalanceMicro: MoneyMicroString | null;
  readonly closingBalanceMicro: MoneyMicroString | null;
  readonly idempotencyFingerprint: string;
  readonly acceptedRowCount: number;
  readonly rejectedRowCount: number;
  readonly duplicateRowCount: number;
  readonly parsingNotes: readonly string[];
  readonly warnings: readonly string[];
  readonly rejectionReasons: readonly OfficeImportRejectionReason[];
  readonly rowResults: readonly OfficeBankPreviewRowResult[];
}

// Aggregated per-row rejection cause (e.g. "account_not_found") with how many rows hit it,
// so the import UI can tell the user why rows were dropped instead of failing silently.
export interface OfficeImportRejectionReason {
  readonly reason: string;
  readonly count: number;
}

// Per-row outcome of a bank-import preview, including duplicates excluded from confirm.
// `id` matches the confirm acceptedRowIds/rejectedRowIds partition.
export interface OfficeBankPreviewRowResult {
  readonly id: EntityId;
  readonly rowNumber: number;
  readonly status: "accepted" | "duplicate" | "rejected";
  readonly issues: readonly string[];
}

export interface BankImportConfirmRequest {
  readonly workspaceId: EntityId;
  readonly previewId: EntityId;
  readonly accountId?: EntityId;
  readonly acceptedRowIds: readonly EntityId[];
  readonly rejectedRowIds: readonly EntityId[];
}

export interface BankImportConfirmResponse extends ApiMutationReceipt {
  readonly importedTransactionCount: number;
  readonly rejectedRowCount: number;
  readonly duplicateRowCount: number;
}

export interface OfficeLedgerBulkRow {
  readonly legacyId?: number;
  readonly externalId?: number;
  readonly occurredOn: IsoDateString;
  readonly type: OfficeCategoryType;
  readonly amount: DecimalString;
  readonly currency: CurrencyCode;
  readonly description: string;
  readonly departmentId?: EntityId | null;
  readonly divisionId?: EntityId | null;
  readonly categoryId?: EntityId | null;
  readonly departmentName?: string | null;
  readonly divisionName?: string | null;
  readonly categoryName?: string | null;
  readonly partnerName?: string | null;
  readonly accountCode?: string | null;
  readonly accountLabel?: string | null;
  readonly projectId?: EntityId | null;
}

export interface OfficeLedgerBulkRequest {
  readonly workspaceId: EntityId;
  readonly rows: readonly OfficeLedgerBulkRow[];
}

export interface OfficeLedgerBulkRejectionReason {
  readonly reason: string;
  readonly count: number;
}

export interface OfficeLedgerBulkRowResult {
  readonly legacyId: number;
  readonly rowNumber: number;
  readonly status: "accepted" | "rejected";
  readonly willValidate: boolean;
  readonly categoryId: EntityId | null;
  readonly issues: readonly string[];
}

export interface OfficeLedgerBulkPreviewResponse {
  readonly acceptedRowCount: number;
  readonly rejectedRowCount: number;
  readonly validatedRowCount: number;
  readonly draftRowCount: number;
  readonly rejectionReasons: readonly OfficeLedgerBulkRejectionReason[];
  readonly rows: readonly OfficeLedgerBulkRowResult[];
}

export interface OfficeLedgerBulkConfirmResponse extends ApiMutationReceipt {
  readonly upsertedRowCount: number;
}

export interface OfficeReconciliationsQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly accountId: EntityId | null;
  readonly period: IsoMonthString | null;
  readonly dateFrom?: IsoDateString | null;
  readonly dateTo?: IsoDateString | null;
  readonly minConfidenceBp?: BasisPoints | null;
  readonly classifiedOnly?: boolean;
  readonly status: "unmatched" | "suggested" | "matched" | "rejected" | "ignored" | null;
}

export interface OfficeReconciliationCandidate {
  readonly id: EntityId;
  readonly transactionId: EntityId;
  readonly statementLineId: EntityId;
  readonly occurredOn: IsoDateString;
  readonly bankDescription: string;
  readonly ledgerDescription: string;
  readonly amountMicro: MoneyMicroString;
  readonly confidenceBp: BasisPoints;
  readonly departmentId: EntityId | null;
  readonly departmentLabel: string | null;
  readonly divisionId: EntityId | null;
  readonly divisionLabel: string | null;
  readonly categoryId: EntityId | null;
  readonly categoryLabel: string | null;
  readonly projectId: EntityId | null;
  readonly projectLabel: string | null;
  readonly status: "unmatched" | "suggested" | "matched" | "rejected" | "ignored";
}

export interface OfficeReconciliationApproveRequest {
  readonly workspaceId: EntityId;
  readonly reconciliationIds: readonly EntityId[];
  readonly approvedAt: IsoDateTimeString;
}

export interface OfficeReconciliationApproveSuggestedRequest {
  readonly workspaceId: EntityId;
  readonly approvedAt: IsoDateTimeString;
  readonly accountId?: EntityId | null;
  readonly dateFrom?: IsoDateString | null;
  readonly dateTo?: IsoDateString | null;
  readonly minConfidenceBp?: BasisPoints;
  readonly limit?: number;
}

export interface OfficeReconciliationApproveSuggestedResponse extends ApiMutationReceipt {
  readonly processedCount: number;
  readonly candidateCount: number;
  readonly minConfidenceBp: BasisPoints;
  readonly limit: number;
}

export interface OfficeReconciliationOperationsQuery {
  readonly workspaceId: EntityId;
  readonly accountId: EntityId | null;
  readonly period: IsoMonthString | null;
  readonly dateFrom?: IsoDateString | null;
  readonly dateTo?: IsoDateString | null;
}

export interface OfficeReconciliationOperationsResponse {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly dateFrom: IsoDateString | null;
  readonly dateTo: IsoDateString | null;
  readonly generatedAt: IsoDateTimeString;
  readonly totalCount: number;
  readonly unmatchedCount: number;
  readonly suggestedCount: number;
  readonly matchedCount: number;
  readonly rejectedCount: number;
  readonly ignoredCount: number;
  readonly autoApprovableCount: number;
  readonly staleSuggestedCount: number;
  readonly oldestUnmatchedDays: number | null;
  readonly matchedRateBp: BasisPoints;
}

// Manually match one bank statement line to a chosen ledger transaction.
export interface OfficeReconciliationMatchRequest {
  readonly workspaceId: EntityId;
  readonly statementLineId: EntityId;
  readonly transactionId: EntityId;
  readonly matchedAt: IsoDateTimeString;
}

// Undo a match, or reject/ignore a candidate — both addressed by the bank line.
export interface OfficeReconciliationLineRequest {
  readonly workspaceId: EntityId;
  readonly statementLineId: EntityId;
}

export interface OfficeBankRawLineReassignRequest {
  readonly workspaceId: EntityId;
  readonly statementLineId: EntityId;
  readonly accountId: EntityId;
}

// Create a ledger transaction directly from an unmatched bank line, then match it.
export interface OfficeReconciliationCreateTransactionRequest {
  readonly workspaceId: EntityId;
  readonly statementLineId: EntityId;
  readonly categoryId: EntityId;
  readonly projectId: EntityId | null;
  readonly matchedAt: IsoDateTimeString;
}

export interface CashflowQuery extends DateRangeQuery {
  readonly accountId: EntityId | null;
}

export interface CashflowBucket {
  readonly period: IsoMonthString;
  readonly inflowMicro: MoneyMicroString;
  readonly outflowMicro: MoneyMicroString;
  readonly closingMicro: MoneyMicroString;
  readonly inflowLevel: number;
  readonly outflowLevel: number;
}

export interface OfficeCashflowWorkbenchQuery extends CashflowQuery {}

export interface OfficeCashflowWorkbenchBucket {
  readonly period: IsoMonthString;
  readonly actualInflowMicro: MoneyMicroString;
  readonly actualOutflowMicro: MoneyMicroString;
  readonly forecastInflowMicro: MoneyMicroString;
  readonly forecastOutflowMicro: MoneyMicroString;
  readonly varianceMicro: MoneyMicroString;
  readonly forecastClosingMicro: MoneyMicroString;
  readonly actualInflowLevel: number;
  readonly actualOutflowLevel: number;
  readonly forecastInflowLevel: number;
  readonly forecastOutflowLevel: number;
}

export type OfficeCashflowManualEntryStatus = "planned" | "confirmed" | "cancelled";

export interface OfficeCashflowManualEntry {
  readonly id: EntityId;
  readonly accountId: EntityId | null;
  readonly partnerId: EntityId | null;
  readonly projectId: EntityId | null;
  readonly entryDate: IsoDateString;
  readonly direction: "inflow" | "outflow";
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly label: string;
  readonly notes: string | null;
  readonly status: OfficeCashflowManualEntryStatus;
  readonly createdAt: IsoDateTimeString;
}

export interface OfficeCashflowWorkbenchResponse {
  readonly buckets: readonly OfficeCashflowWorkbenchBucket[];
  readonly manualEntries: readonly OfficeCashflowManualEntry[];
  readonly importBatches: readonly OfficeCashflowImportBatch[];
}

export interface OfficeCashflowImportBatch {
  readonly id: EntityId;
  readonly fileName: string;
  readonly rowCount: number;
  readonly status: "confirmed" | "void";
  readonly importedAt: IsoDateTimeString | null;
  readonly reversible: boolean;
}

export interface OfficeCashflowManualEntryWriteRequest {
  readonly workspaceId: EntityId;
  readonly accountId: EntityId | null;
  readonly partnerId: EntityId | null;
  readonly projectId: EntityId | null;
  readonly entryDate: IsoDateString;
  readonly direction: "inflow" | "outflow";
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly label: string;
  readonly notes: string | null;
  readonly status: Exclude<OfficeCashflowManualEntryStatus, "cancelled">;
}

export interface OfficeCashflowManualEntryCancelRequest {
  readonly workspaceId: EntityId;
  readonly reason: string | null;
}

export type OfficeAdvanceKind = "staff" | "freelancer" | "artist" | "supplier" | "contractor" | "other";
export type OfficeAdvanceStatus =
  | "planned"
  | "open"
  | "paid"
  | "partially_applied"
  | "settled"
  | "recouped"
  | "refunded"
  | "waived"
  | "written_off";

export interface OfficeAdvanceRow {
  readonly id: EntityId;
  readonly kind: OfficeAdvanceKind;
  readonly counterpartyId: EntityId | null;
  readonly counterpartyLabel: string;
  readonly contextId: EntityId | null;
  readonly contextLabel: string | null;
  readonly label: string;
  readonly plannedOn: IsoDateString;
  readonly paidOn: IsoDateString | null;
  readonly originalAmountMicro: MoneyMicroString;
  readonly appliedAmountMicro: MoneyMicroString;
  readonly outstandingAmountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly status: OfficeAdvanceStatus;
  readonly source: "distribution_contract" | "office_managed";
}

export interface OfficeAdvancesWorkbenchQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly kind: OfficeAdvanceKind | null;
  readonly status: OfficeAdvanceStatus | null;
}

export interface OfficeAdvancesWorkbenchResponse extends PageResult<OfficeAdvanceRow> {
  readonly totalOutstandingMicro: MoneyMicroString;
  readonly managedOutstandingMicro: MoneyMicroString;
  readonly distributionOutstandingMicro: MoneyMicroString;
  readonly plannedManagedMicro: MoneyMicroString;
}

export interface OfficeAdvanceWriteRequest {
  readonly workspaceId: EntityId;
  readonly beneficiaryType: OfficeAdvanceKind;
  readonly beneficiaryName: string;
  readonly partnerId: EntityId | null;
  readonly projectId: EntityId | null;
  readonly transactionId: EntityId | null;
  readonly label: string;
  readonly plannedPaymentOn: IsoDateString;
  readonly paidOn: IsoDateString | null;
  readonly originalAmountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly status: "planned" | "paid";
  readonly notes: string | null;
}

export interface OfficeAdvanceApplicationRequest {
  readonly workspaceId: EntityId;
  readonly appliedOn: IsoDateString;
  readonly amountMicro: MoneyMicroString;
  readonly kind: "invoice" | "expense" | "refund" | "write_off";
  readonly reference: string | null;
  readonly notes: string | null;
}

export interface OfficeAdvanceMarkPaidRequest {
  readonly workspaceId: EntityId;
  readonly paidOn: IsoDateString;
  readonly transactionId: EntityId | null;
}

export type OfficePartnerFacet = "client" | "supplier";

export interface OfficePartnersQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString;
  readonly dateFrom?: IsoDateString | null;
  readonly dateTo?: IsoDateString | null;
  readonly facet: OfficePartnerFacet;
}

export interface OfficePartnerRecordQuery {
  readonly workspaceId: EntityId;
}

export interface OfficePartnerSideActivity {
  readonly periodTotalMicro: MoneyMicroString;
  readonly openBalanceMicro: MoneyMicroString;
  readonly transactionCount: number;
  readonly lastActivityOn: IsoDateString | null;
}

export interface OfficePartnerActivity {
  readonly income: OfficePartnerSideActivity;
  readonly expense: OfficePartnerSideActivity;
  readonly netMicro: MoneyMicroString;
}

export interface OfficePartnerListItem {
  readonly id: EntityId;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly taxId: string | null;
  readonly status: "active" | "inactive";
  readonly activity: OfficePartnerActivity;
  readonly distributionPayeeLink: OfficePartnerPayeeLink | null;
}

export interface OfficePartnerRecord {
  readonly id: EntityId;
  readonly name: string;
  readonly status: "active" | "inactive";
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly taxId: string | null;
  readonly notes: string | null;
}

export interface OfficePartnerDetailQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString;
  readonly dateFrom?: IsoDateString | null;
  readonly dateTo?: IsoDateString | null;
}

export interface OfficePartnerPnl extends OfficePartnerListItem {
  readonly completeness: "partial";
  readonly period: IsoMonthString;
}

export interface OfficePartnerDetail extends OfficePartnerListItem {
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly taxId: string | null;
  readonly notes: string | null;
  readonly classificationSuggestions: readonly OfficePartnerClassificationSuggestion[];
}

export interface OfficePartnerWriteRequest {
  readonly workspaceId: EntityId;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly taxId: string | null;
  readonly notes: string | null;
  readonly active: boolean;
}

export interface OfficePartnerClassificationSuggestion {
  readonly id: EntityId;
  readonly categoryId: EntityId;
  readonly categoryLabel: string;
  readonly type: OfficeCategoryType;
  readonly confidenceBp: BasisPoints;
}

export interface OfficePartnerPayeeLink {
  readonly partnerId: EntityId;
  readonly partnerName: string;
  readonly payeeId: EntityId | null;
  readonly payeeName: string | null;
  readonly resolution: "stored_link" | "stored_payee_missing" | "name_exact" | "name_fuzzy" | "ambiguous_exact" | "ambiguous_fuzzy" | "unmatched";
  readonly status: "active" | "inactive" | null;
  readonly source: string;
  readonly confidence: DecimalString | null;
}

export interface OfficePartnerPayeeLinkRequest {
  readonly workspaceId: EntityId;
  readonly payeeId: EntityId | null;
}

export interface OfficeProjectsQuery extends PageQuery, PeriodQuery {
  readonly workspaceId: EntityId;
  readonly status: "active" | "archived" | null;
}

export type OfficeProjectWriteStatus = "draft" | "active" | "paused" | "completed" | "cancelled" | "archived";

export interface OfficeProjectWriteRequest {
  readonly workspaceId: EntityId;
  readonly name: string;
  readonly status: OfficeProjectWriteStatus;
  readonly description: string | null;
  readonly active: boolean;
}

export interface OfficeProjectSummary {
  readonly id: EntityId;
  readonly code: string;
  readonly label: string;
  readonly status: "active" | "archived";
  readonly writeStatus: OfficeProjectWriteStatus;
  readonly description: string | null;
  readonly active: boolean;
  readonly ownerLabel: string;
  readonly periodIncomeMicro: MoneyMicroString;
  readonly periodExpenseMicro: MoneyMicroString;
  readonly netMicro: MoneyMicroString;
  readonly openViolationCount: number;
  readonly lastActivityOn: IsoDateString | null;
}

export interface OfficeProjectCoherenceViolationsQuery extends PageQuery {
  readonly workspaceId: EntityId;
}

export interface OfficeProjectCoherenceViolation {
  readonly id: EntityId;
  readonly projectId: EntityId;
  readonly severity: "warning" | "error";
  readonly rule: string;
  readonly message: string;
  readonly exactFixPath: "transactions" | "chart-of-accounts" | "partners" | "projects";
  readonly relatedEntityId: EntityId | null;
}

export interface OfficeProjectPnlQuery extends PeriodQuery {}

export interface OfficeProjectPnlLine {
  readonly id: EntityId;
  readonly label: string;
  readonly categoryLabel: string;
  readonly type: OfficeCategoryType;
  readonly transactionCount: number;
  readonly amountMicro: MoneyMicroString;
}

export interface OfficeProjectPnl {
  readonly completeness: "partial";
  readonly projectId: EntityId;
  readonly projectLabel: string;
  readonly period: IsoMonthString;
  readonly incomeMicro: MoneyMicroString;
  readonly expenseMicro: MoneyMicroString;
  readonly netMicro: MoneyMicroString;
  readonly receivableMicro: MoneyMicroString;
  readonly payableMicro: MoneyMicroString;
  readonly transactionCount: number;
  readonly validatedProjectionId: EntityId;
  readonly lines: readonly OfficeProjectPnlLine[];
}

export interface OfficeIntegrityCheckQuery {
  readonly workspaceId: EntityId;
}

export interface OfficeIntegrityCheck {
  readonly id: EntityId;
  readonly label: string;
  readonly status: "pass" | "warning" | "fail";
  readonly detail: string;
  readonly exactFixPath: "transactions" | "imports" | "reconciliation" | "partners" | "projects";
}

export interface OfficeIntegrityCheckAllResponse {
  readonly checkedAt: IsoDateTimeString;
  readonly status: "pass" | "warning" | "fail";
  readonly passCount: number;
  readonly warningCount: number;
  readonly failCount: number;
  readonly checks: readonly OfficeIntegrityCheck[];
}

export interface OfficeBankQualityQuery extends PeriodQuery {}

export interface OfficeBankQualityResponse {
  readonly period: IsoMonthString;
  readonly totalLineCount: number;
  readonly matchedLineCount: number;
  readonly matchedRateBp: BasisPoints;
  readonly unmatchedLineCount: number;
  readonly duplicateCandidateCount: number;
  readonly missingReferenceCount: number;
  readonly staleImportCount: number;
  readonly lastImportAt: IsoDateTimeString | null;
}

export interface OfficeBankAccountsQuery extends PageQuery {
  readonly workspaceId: EntityId;
}

export interface OfficeCashflowImportRequest {
  readonly workspaceId: EntityId;
  readonly fileName?: string;
  readonly checksum?: string;
  readonly rows: readonly Readonly<Record<string, string>>[];
}

export interface OfficeCashflowPreviewRow {
  readonly rowNumber: number;
  readonly periodMonth: string | null;
  readonly inflow: string | null;
  readonly outflow: string | null;
  readonly closingBalance: string | null;
  readonly currency: string | null;
  readonly issues: readonly string[];
}

export interface OfficeCashflowPreviewResponse {
  readonly acceptedRowCount: number;
  readonly rejectedRowCount: number;
  readonly rows: readonly OfficeCashflowPreviewRow[];
}

export interface OfficeBankAccountWriteRequest {
  readonly workspaceId: EntityId;
  readonly bankName: string;
  readonly accountLabel: string;
  readonly currency: CurrencyCode;
  readonly active: boolean;
}

export interface OfficeBankAccountDeleteRequest {
  readonly workspaceId: EntityId;
}

export interface OfficeBankAccountSummary {
  readonly id: EntityId;
  readonly workspaceId: EntityId;
  readonly bankName: string;
  readonly accountLabel: string;
  readonly currency: CurrencyCode;
  readonly currentBalanceMicro: MoneyMicroString;
  readonly currentBalanceMurMicro: MoneyMicroString | null;
  readonly isActive: boolean;
  readonly balanceAsOf: IsoDateString | null;
  readonly importedLineCount: number;
  readonly linkedRecordCount: number;
  readonly canDelete: boolean;
}

export interface OfficeSettingsResponse {
  readonly workspaceId: EntityId;
  readonly referenceCurrency: CurrencyCode;
  readonly defaultImportAccountId: EntityId | null;
  readonly updatedAt: IsoDateTimeString | null;
}

export interface OfficeSettingsUpdateRequest {
  readonly workspaceId: EntityId;
  readonly defaultImportAccountId: EntityId | null;
}

export interface OfficeBankRawLinesQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly accountId: EntityId | null;
  readonly dateFrom?: IsoDateString | null;
  readonly dateTo?: IsoDateString | null;
}

export interface OfficeBankRawLine {
  readonly id: EntityId;
  readonly workspaceId: EntityId;
  readonly importBatchId: EntityId;
  readonly accountId: EntityId;
  readonly occurredOn: IsoDateString;
  readonly transactionDate: IsoDateString;
  readonly description: string;
  readonly direction: "credit" | "debit";
  readonly reference: string;
  readonly amountMicro: MoneyMicroString;
  readonly amountMurMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly isDuplicateCandidate: boolean;
  readonly status: "unmatched" | "suggested" | "matched" | "rejected" | "ignored";
  readonly reconciliationStatus: "unmatched" | "suggested" | "matched" | "rejected" | "ignored";
  readonly matchedTransactionId: EntityId | null;
}

export interface OfficeVatQuery extends PeriodQuery {}

export interface OfficeVatRow {
  readonly id: EntityId;
  readonly label: string;
  readonly baseMicro: MoneyMicroString;
  readonly rateBp: BasisPoints;
  readonly vatMicro: MoneyMicroString;
}

export interface OfficeVatReport {
  readonly period: IsoMonthString;
  readonly hasVatSource: boolean;
  readonly outputVatMicro: MoneyMicroString;
  readonly inputVatMicro: MoneyMicroString;
  readonly netVatMicro: MoneyMicroString;
  readonly rows: readonly OfficeVatRow[];
}

export interface DistributionDashboardQuery extends PeriodQuery {}

export interface DistributionDashboardCurrencyTotal {
  readonly currency: CurrencyCode;
  readonly amountMicro: MoneyMicroString;
}

export type DistributionDashboardReadinessStatus = "clear" | "review" | "fix";

export interface DistributionDashboardReadinessItem {
  readonly id: string;
  readonly label: string;
  readonly status: DistributionDashboardReadinessStatus;
  readonly count: number;
  readonly detail: string;
  readonly actionPage: "mapping" | "catalog" | "contracts" | "allocations" | "suspense" | "payments";
}

export interface DistributionDashboardDiagnostic {
  readonly id: string;
  readonly label: string;
  readonly status: "ok" | "idle" | "attention";
  readonly detail: string;
  readonly lastUpdated: IsoDateTimeString | null;
}

export interface DistributionDashboardTopRoyalty {
  readonly id: string;
  readonly label: string;
  readonly secondaryLabel: string;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
}

export interface DistributionDashboardResponse {
  readonly period: IsoMonthString;
  readonly grossRoyaltyMicro: MoneyMicroString;
  readonly recoupedMicro: MoneyMicroString;
  readonly netPayableMicro: MoneyMicroString;
  readonly suspenseCount: number;
  readonly openStatementCount: number;
  readonly lastAuditEventId: EntityId | null;
  readonly importedRevenue: readonly DistributionDashboardCurrencyTotal[];
  readonly paidRoyalties: readonly DistributionDashboardCurrencyTotal[];
  readonly openRecoupments: readonly DistributionDashboardCurrencyTotal[];
  readonly fxRateCount: number;
  readonly contractCoverage: {
    readonly covered: number;
    readonly total: number;
  };
  readonly readiness: readonly DistributionDashboardReadinessItem[];
  readonly diagnostics: readonly DistributionDashboardDiagnostic[];
  readonly topArtists: readonly DistributionDashboardTopRoyalty[];
  readonly topTracks: readonly DistributionDashboardTopRoyalty[];
  readonly topStores: readonly DistributionDashboardTopRoyalty[];
}

export interface DistributionScreenQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString;
  readonly dateFrom: IsoDateString;
  readonly dateTo: IsoDateString;
  readonly importSource: "kontor" | "routenote" | null;
  readonly importStatus: "uploaded" | "mapped" | "validated" | "failed" | "voided" | null;
  readonly mappingStatus: "unmapped" | "suggested" | "mapped" | null;
  readonly suspenseStatus: "open" | "resolved" | null;
  readonly paymentStatus: "draft" | "paid" | "voided" | null;
  readonly revenueGroupBy: "payee" | "track" | "currency" | "store" | "period";
}

export interface DistributionScreenResponse {
  readonly status: {
    readonly writesEnabled: boolean;
  };
  readonly dashboard: DistributionDashboardResponse;
  readonly importBatches: PageResult<DistributionImportBatch>;
  readonly mappingRows: PageResult<DistributionMappingRow>;
  readonly payees: PageResult<PayeeSummary>;
  readonly releases: PageResult<ReleaseSummary>;
  readonly tracks: PageResult<TrackSummary>;
  readonly contracts: PageResult<DistributionContract>;
  readonly expenses: PageResult<DistributionContractExpense>;
  readonly allocations: PageResult<AllocationRunSummary>;
  readonly suspense: PageResult<SuspenseItem>;
  readonly statements: PageResult<StatementSummary>;
  readonly payments: PageResult<PaymentSummary>;
  readonly revenue: PageResult<DistributionRevenueRow>;
  readonly reconciliation: DistributionReconciliationResponse;
  readonly aliases: PageResult<DistributionAlias>;
  readonly duplicates: PageResult<DistributionDuplicate>;
  readonly auditLog: PageResult<AuditLogEntry>;
  readonly settings: DistributionSettingsResponse;
}

export interface DistributionImportBatchesQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly source: "kontor" | "routenote" | null;
  readonly status: "uploaded" | "mapped" | "validated" | "failed" | "voided" | null;
}

export interface DistributionImportBatch {
  readonly id: EntityId;
  readonly source: "kontor" | "routenote";
  readonly fileName: string;
  readonly period: StatementPeriodString;
  readonly statementReference: string;
  readonly accountReference: string;
  readonly rowCount: number;
  readonly normalizedRowCount: number;
  readonly unmatchedRowCount: number;
  readonly issueCount: number;
  readonly skippedRowCount: number;
  readonly currency: CurrencyCode;
  readonly grossMicro: MoneyMicroString;
  readonly payableColumn: string;
  readonly joinKeySummary: string;
  readonly status: "uploaded" | "mapped" | "validated" | "failed" | "voided";
  readonly nextAction: "review_mapping" | "apply_rules" | "validate" | "retry";
  readonly importedAt: IsoDateTimeString;
}

export interface DistributionImportPreviewRequest {
  readonly workspaceId: EntityId;
  readonly source: "kontor" | "routenote";
  readonly fileName: string;
  readonly checksum: string;
  readonly rows: readonly Readonly<Record<string, string>>[];
}

export interface DistributionImportPreviewRowResult {
  readonly id: EntityId;
  readonly rowNumber: number;
  readonly status: "accepted" | "rejected";
  readonly issues: readonly string[];
}

export interface DistributionImportPreviewResponse {
  readonly previewId: EntityId;
  readonly source: "kontor" | "routenote";
  readonly statementReference: string;
  readonly accountReference: string;
  readonly acceptedRowCount: number;
  readonly rejectedRowCount: number;
  readonly unmappedRowCount: number;
  readonly payableMicro: MoneyMicroString;
  readonly currencyCodes: readonly CurrencyCode[];
  readonly joinKeys: readonly string[];
  readonly idempotencyFingerprint: string;
  readonly warnings: readonly string[];
  readonly rowResults: readonly DistributionImportPreviewRowResult[];
}

export interface DistributionImportConfirmRequest {
  readonly workspaceId: EntityId;
  readonly previewId: EntityId;
  readonly acceptedRowIds: readonly EntityId[];
  readonly rejectedRowIds: readonly EntityId[];
}

export interface DistributionImportConfirmResponse extends ApiMutationReceipt {
  readonly importedRoyaltyEventCount: number;
}

export interface DistributionMappingRowsQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly batchId: EntityId | null;
  readonly status: "unmapped" | "suggested" | "mapped" | null;
  readonly search: string | null;
}

export interface DistributionMappingRow {
  readonly id: EntityId;
  readonly batchId: EntityId;
  readonly sourceTitle: string;
  readonly sourceArtist: string;
  readonly sourceLabel: string;
  readonly sourceStore: string;
  readonly sourceIsrc: string | null;
  readonly sourceUpc: string | null;
  readonly grossMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly suggestedTrackId: EntityId | null;
  readonly suggestedTrackTitle: string | null;
  readonly confidenceBp: BasisPoints;
  readonly status: "unmapped" | "suggested" | "mapped";
  readonly exactFixPath: "catalog" | "mapping_rules" | "manual_track";
}

export interface DistributionMappingApplyRulesRequest {
  readonly workspaceId: EntityId;
  readonly batchId: EntityId;
  readonly rowIds: readonly EntityId[];
}

export type DistributionCatalogArtistSource = "catalog_import" | "catalog_contributors" | "import_only";
export type DistributionCatalogReviewFilter = "needs_review" | "artist_mismatch" | "no_contributors";
export type DistributionCatalogReviewReason = DistributionCatalogReviewFilter | null;

export interface DistributionCatalogWorkbenchQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly search: string | null;
  readonly artistSource: DistributionCatalogArtistSource;
  readonly isrc: string | null;
  readonly role: string | null;
  readonly review: DistributionCatalogReviewFilter | null;
  readonly label: string | null;
  readonly releaseFrom: IsoDateString | null;
  readonly releaseTo: IsoDateString | null;
  readonly status: "draft" | "released" | "archived" | null;
}

export interface DistributionCatalogContributor {
  readonly name: string;
  readonly role: string;
}

export interface DistributionCatalogArtistPromoteRequest {
  readonly workspaceId: EntityId;
  readonly contributorName: string;
  readonly reason: string;
}

export interface DistributionCatalogContributorPayeeLinkRequest {
  readonly workspaceId: EntityId;
  readonly defaultCurrency: CurrencyCode;
}

export interface DistributionCatalogTrackRow {
  readonly id: EntityId;
  readonly title: string;
  readonly versionTitle: string | null;
  readonly artistImport: string | null;
  readonly catalogArtist: string;
  readonly isrc: string | null;
  readonly upc: string | null;
  readonly releaseId: EntityId | null;
  readonly releaseTitle: string | null;
  readonly releaseDate: IsoDateString | null;
  readonly label: string | null;
  readonly status: "draft" | "released" | "archived";
  readonly contributors: readonly DistributionCatalogContributor[];
  readonly contributorSource: "imported" | "override";
  /** High-confidence candidate from one imported main artist; never auto-applied. */
  readonly suggestedCatalogArtist: string | null;
  readonly reviewReason: DistributionCatalogReviewReason;
}

export interface DistributionCatalogFacetOption {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

export interface DistributionCatalogReleaseOption {
  readonly id: EntityId;
  readonly title: string;
  readonly artistName: string;
}

export interface DistributionCatalogSummary {
  readonly trackCount: number;
  readonly needsReviewCount: number;
  readonly artistMismatchCount: number;
  readonly noContributorCount: number;
}

export interface DistributionCatalogWorkbenchResponse extends PageResult<DistributionCatalogTrackRow> {
  readonly facets: {
    readonly labels: readonly DistributionCatalogFacetOption[];
    readonly roles: readonly DistributionCatalogFacetOption[];
    readonly releases: readonly DistributionCatalogReleaseOption[];
  };
  readonly summary: DistributionCatalogSummary;
}

export interface DistributionCatalogContributorOverrideRequest {
  readonly workspaceId: EntityId;
  readonly contributors: readonly DistributionCatalogContributor[];
  readonly reason: string;
}

export type DistributionContractTrackStatus = "active" | "no_split" | "ambiguous";
export type DistributionContractWorkflowFilter = "all_splits" | "needs_attention" | "ready" | "with_expenses";

export interface DistributionContractWorkbenchQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly search: string | null;
  readonly status: DistributionContractTrackStatus | null;
  readonly workflow: DistributionContractWorkflowFilter | null;
}

export interface DistributionContractSplit {
  readonly payeeId: EntityId;
  readonly payeeName: string;
  readonly percentage: DecimalString;
  readonly role: string;
}

export interface DistributionContractCurrencyTotal {
  readonly currency: CurrencyCode;
  readonly amountMicro: MoneyMicroString;
}

export interface DistributionContractTrackRow {
  readonly trackId: EntityId;
  readonly title: string;
  readonly versionTitle: string | null;
  readonly releaseTitle: string | null;
  readonly artistImport: string | null;
  readonly catalogArtist: string;
  readonly isrc: string | null;
  readonly label: string | null;
  readonly status: DistributionContractTrackStatus;
  readonly contractId: EntityId | null;
  readonly contractIds: readonly EntityId[];
  readonly contractTitle: string | null;
  readonly splitSource: "override" | "track" | "release" | null;
  readonly splits: readonly DistributionContractSplit[];
  readonly splitTotalPercentage: DecimalString;
  readonly expenseCount: number;
  readonly openExpenseTotals: readonly DistributionContractCurrencyTotal[];
}

export interface DistributionContractWorkbenchSummary {
  readonly activeTrackOnlyCount: number;
  readonly activeEffectiveCount: number;
  readonly expiredContractCount: number;
  readonly draftContractCount: number;
  readonly directTrackRuleCount: number;
  readonly noEffectiveSplitCount: number;
  readonly ambiguousCount: number;
  readonly unallocatedRowCount: number;
  readonly openRecoupmentTotals: readonly DistributionContractCurrencyTotal[];
}

export interface DistributionContractWorkbenchResponse extends PageResult<DistributionContractTrackRow> {
  readonly summary: DistributionContractWorkbenchSummary;
}

export interface DistributionContractTrackRuleInput {
  readonly payeeId: EntityId;
  readonly percentage: DecimalString;
}

export interface DistributionContractTrackRuleOverrideRequest {
  readonly workspaceId: EntityId;
  readonly trackIds: readonly EntityId[];
  readonly rules: readonly DistributionContractTrackRuleInput[];
  readonly reason: string;
  readonly effectiveFrom: IsoDateString;
  readonly effectiveTo: IsoDateString | null;
  readonly currency: CurrencyCode;
}

export interface DistributionContractsQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly payeeId: EntityId | null;
  readonly status: "draft" | "active" | "paused" | "ended" | null;
}

export interface DistributionContract {
  readonly id: EntityId;
  readonly payeeId: EntityId;
  readonly title: string;
  readonly status: "draft" | "active" | "paused" | "ended";
  readonly effectiveFrom: IsoDateString;
  readonly effectiveTo: IsoDateString | null;
  readonly splitBp: BasisPoints;
  readonly openExpenseMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
}

export interface DistributionContractExpenseQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly contractId: EntityId;
  readonly status: "open" | "recouped" | "waived" | null;
}

export interface DistributionContractExpense {
  readonly id: EntityId;
  readonly contractId: EntityId;
  readonly payeeId: EntityId | null;
  readonly incurredOn: IsoDateString;
  readonly category: DistributionContractExpenseCategory;
  readonly label: string;
  readonly originalAmountMicro: MoneyMicroString;
  readonly openAmountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly recoverable: boolean;
  readonly status: "open" | "recouped" | "waived";
}

export type DistributionContractExpenseCategory =
  | "advance"
  | "recoupment"
  | "studio"
  | "marketing"
  | "distribution"
  | "other";

export interface DistributionContractUpsertRequest {
  readonly workspaceId: EntityId;
  readonly id: EntityId | null;
  readonly payeeId: EntityId | null;
  readonly title: string;
  readonly status: "draft" | "active" | "paused" | "ended";
  readonly effectiveFrom: IsoDateString;
  readonly effectiveTo: IsoDateString | null;
  readonly splitBp: BasisPoints;
  readonly currency: CurrencyCode;
}

export interface ContractRoyaltyRuleInput {
  readonly payeeId: EntityId;
  readonly percentage: DecimalString;
  readonly scopeType: string | null;
  readonly scopeId: EntityId | null;
  readonly effectiveFrom: IsoDateString | null;
  readonly effectiveTo: IsoDateString | null;
}

// Replaces the full royalty rule set of a contract: the server archives the
// previous rules and inserts this list, which must total exactly 100 percent.
export interface ContractRoyaltyRulesUpdateRequest {
  readonly workspaceId: EntityId;
  readonly rules: readonly ContractRoyaltyRuleInput[];
}

export interface DistributionContractExpenseRecordRequest {
  readonly workspaceId: EntityId;
  readonly contractId: EntityId;
  readonly payeeId: EntityId | null;
  readonly incurredOn: IsoDateString;
  readonly category: DistributionContractExpenseCategory;
  readonly label: string;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly recoverable: boolean;
}

export interface PayeesQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly status: "active" | "inactive" | null;
}

export interface PayeeSummary {
  readonly id: EntityId;
  readonly displayName: string;
  readonly email: string | null;
  readonly status: "active" | "inactive";
  readonly defaultCurrency: CurrencyCode;
}

export interface DistributionPayeeUpsertRequest {
  readonly workspaceId: EntityId;
  readonly id: EntityId | null;
  readonly displayName: string;
  readonly email: string | null;
  readonly status: "active" | "inactive";
  readonly defaultCurrency: CurrencyCode;
}

export interface DistributionPayeePartnerLink {
  readonly payeeId: EntityId;
  readonly payeeName: string;
  readonly officePartnerId: EntityId | null;
  readonly officePartnerName: string | null;
  readonly linked: boolean;
  readonly confidence: DecimalString | null;
  readonly status: "active" | "inactive" | null;
}

export interface DistributionPayeePartnerLinkRequest {
  readonly workspaceId: EntityId;
  readonly officePartnerId: EntityId;
}

export interface DistributionPayeePartnerLinkQuery {
  readonly workspaceId: EntityId;
}

export interface ReleasesQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly status: "draft" | "released" | "archived" | null;
}

export interface ReleaseSummary {
  readonly id: EntityId;
  readonly title: string;
  readonly artistName: string;
  readonly upc: string | null;
  readonly status: "draft" | "released" | "archived";
  readonly releaseDate: IsoDateString | null;
  readonly trackCount: number;
}

export interface DistributionReleaseUpsertRequest {
  readonly workspaceId: EntityId;
  readonly id: EntityId | null;
  readonly title: string;
  readonly artistName: string;
  readonly labelName: string | null;
  readonly upc: string | null;
  readonly status: "draft" | "released" | "archived";
  readonly releaseDate: IsoDateString | null;
}

export interface TracksQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly releaseId: EntityId | null;
  readonly status: "draft" | "released" | "archived" | null;
}

export interface TrackSummary {
  readonly id: EntityId;
  readonly releaseId: EntityId | null;
  readonly title: string;
  readonly artistName: string;
  readonly isrc: string | null;
  readonly status: "draft" | "released" | "archived";
  readonly splitStatus: "balanced" | "needs_review";
  readonly contributorCount: number;
}

export interface DistributionTrackUpsertRequest {
  readonly workspaceId: EntityId;
  readonly id: EntityId | null;
  readonly releaseId: EntityId | null;
  readonly title: string;
  readonly artistName: string;
  readonly isrc: string | null;
  readonly status: "draft" | "released" | "archived";
}

export interface AllocationRunQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly status: "queued" | "running" | "completed" | "failed" | null;
}

export interface DistributionAllocationWorkbenchQuery {
  readonly workspaceId: EntityId;
  readonly search: string | null;
  readonly dateFrom: IsoDateString | null;
  readonly dateTo: IsoDateString | null;
  readonly batchCursor: CursorString | null;
  readonly bankCursor: CursorString | null;
  readonly limit: number;
}

export interface DistributionAllocationWorkbenchSummary {
  readonly readyRowCount: number;
  readonly openSuspenseCount: number;
  readonly missingContractCount: number;
  readonly matchedUnallocatedCount: number;
  readonly allocationLinkIssueCount: number;
}

export interface DistributionAllocationSuspenseReason {
  readonly reason: string;
  readonly openRowCount: number;
}

export interface DistributionAllocationBatchCurrencyTotal {
  readonly currency: CurrencyCode;
  readonly openAmountMicro: MoneyMicroString;
  readonly allocatedAmountMicro: MoneyMicroString;
}

export interface DistributionAllocationBatchRow {
  readonly id: EntityId;
  readonly reference: string;
  readonly fileName: string;
  readonly source: string;
  readonly status: string;
  readonly period: IsoMonthString;
  readonly importedAt: IsoDateTimeString | null;
  readonly totalRowCount: number;
  readonly matchedRowCount: number;
  readonly pendingRowCount: number;
  readonly allocatedRowCount: number;
  readonly suspenseRowCount: number;
  readonly currencyTotals: readonly DistributionAllocationBatchCurrencyTotal[];
}

export interface DistributionAllocationRunCurrencyTotal {
  readonly currency: CurrencyCode;
  readonly grossMicro: MoneyMicroString;
  readonly recoupmentMicro: MoneyMicroString;
  readonly netMicro: MoneyMicroString;
}

export interface DistributionAllocationRecentBatch {
  readonly runId: EntityId;
  readonly batchId: EntityId | null;
  readonly batchReference: string;
  readonly period: IsoMonthString;
  readonly status: "queued" | "running" | "completed" | "failed";
  readonly rowCount: number;
  readonly linkIssueCount: number;
  readonly totals: readonly DistributionAllocationRunCurrencyTotal[];
  readonly startedAt: IsoDateTimeString | null;
  readonly completedAt: IsoDateTimeString | null;
}

export interface DistributionAllocationUnallocatedCurrencyTotal {
  readonly currency: CurrencyCode;
  readonly amountMicro: MoneyMicroString;
}

export interface DistributionAllocationUnallocatedTrack {
  readonly trackId: EntityId;
  readonly releaseId: EntityId | null;
  readonly releaseTitle: string | null;
  readonly trackTitle: string;
  readonly isrc: string | null;
  readonly rowCount: number;
  readonly batchCount: number;
  readonly currencyTotals: readonly DistributionAllocationUnallocatedCurrencyTotal[];
  readonly firstSeenAt: IsoDateTimeString;
  readonly lastSeenAt: IsoDateTimeString;
}

export interface DistributionAllocationWorkbenchResponse {
  readonly summary: DistributionAllocationWorkbenchSummary;
  readonly suspenseReasons: readonly DistributionAllocationSuspenseReason[];
  readonly recentBatches: readonly DistributionAllocationRecentBatch[];
  readonly batches: PageResult<DistributionAllocationBatchRow>;
  readonly unallocatedBank: PageResult<DistributionAllocationUnallocatedTrack>;
}

export type DistributionAllocationStatus = "preview" | "calculated" | "statemented" | "posted" | "void" | "error";

export interface DistributionAllocationQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly runId: EntityId | null;
  readonly payeeId: EntityId | null;
  readonly status: DistributionAllocationStatus | null;
}

export interface DistributionAllocationRow {
  readonly id: EntityId;
  readonly earningId: EntityId;
  readonly calculationRunId: EntityId;
  readonly payeeId: EntityId;
  readonly payeeName: string;
  readonly contractId: EntityId | null;
  readonly trackId: EntityId | null;
  readonly trackTitle: string | null;
  readonly grossAmount: MoneyMicroString;
  readonly grossShare: MoneyMicroString;
  readonly recoupmentApplied: MoneyMicroString;
  readonly netPayable: MoneyMicroString;
  readonly splitPercentage: DecimalString;
  readonly currency: CurrencyCode;
  readonly status: DistributionAllocationStatus;
}

export interface DistributionAllocationTotal {
  readonly currency: CurrencyCode;
  readonly grossShare: MoneyMicroString;
  readonly recoupmentApplied: MoneyMicroString;
  readonly netPayable: MoneyMicroString;
}

export interface AllocationRunSummary {
  readonly id: EntityId;
  readonly runReference: string;
  readonly period: IsoMonthString;
  readonly status: "queued" | "running" | "completed" | "failed";
  readonly lockKey: string;
  readonly startedAt: IsoDateTimeString | null;
  readonly completedAt: IsoDateTimeString | null;
  readonly totalInputMicro: MoneyMicroString;
  readonly totalAllocatedMicro: MoneyMicroString;
  readonly currencyTotals: readonly DistributionAllocationRunCurrencyTotal[];
}

export interface AllocationRunPreviewRequest {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString;
  readonly lockKey: string;
  readonly batchId: EntityId | null;
}

export interface AllocationRunStartRequest {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString;
  readonly lockKey: string;
  readonly cadence: "manual" | "scheduled";
  readonly batchId: EntityId | null;
}

export interface DistributionAllocationRetryMissingContractsRequest {
  readonly workspaceId: EntityId;
  readonly trackId: EntityId;
}

export interface DistributionAllocationRetryReceipt extends ApiMutationReceipt {
  readonly resetRowCount: number;
}

export interface AllocationRunUnpostRequest {
  readonly workspaceId: EntityId;
  readonly reason: string;
  readonly lockToken: LockToken;
}

export interface SuspenseQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly status: "open" | "resolved" | null;
  readonly dateFrom?: IsoDateString | null;
  readonly dateTo?: IsoDateString | null;
}

export type DistributionSuspenseFixPath = "contracts" | "mapping" | "imports" | "catalog" | "settings" | "suspense";
export type DistributionSuspenseResolutionMode = "retry" | "map" | "manual_review";

export interface DistributionSuspenseWorkbenchQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly search: string | null;
  readonly batchReference: string | null;
  readonly reasonCode: string | null;
  readonly status: "open" | "resolved" | null;
  readonly dateFrom: IsoDateString | null;
  readonly dateTo: IsoDateString | null;
}

export interface DistributionSuspenseCurrencyTotal {
  readonly currency: CurrencyCode;
  readonly amountMicro: MoneyMicroString;
}

export interface DistributionSuspenseReasonGroup {
  readonly reasonCode: string;
  readonly title: string;
  readonly description: string;
  readonly fixPath: DistributionSuspenseFixPath;
  readonly actionLabel: string;
  readonly resolutionMode: DistributionSuspenseResolutionMode;
  readonly rowCount: number;
  readonly totals: readonly DistributionSuspenseCurrencyTotal[];
}

export interface DistributionSuspenseWorkbenchRow {
  readonly id: EntityId;
  readonly earningId: EntityId | null;
  readonly batchId: EntityId | null;
  readonly batchReference: string;
  readonly reasonCode: string;
  readonly reasonTitle: string;
  readonly reasonDescription: string;
  readonly fixPath: DistributionSuspenseFixPath;
  readonly actionLabel: string;
  readonly resolutionMode: DistributionSuspenseResolutionMode;
  readonly trackId: EntityId | null;
  readonly trackTitle: string | null;
  readonly artistName: string | null;
  readonly isrc: string | null;
  readonly upc: string | null;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly splitPercentage: string | null;
  readonly status: "open" | "resolved";
  readonly createdAt: IsoDateTimeString;
  readonly resolvedAt: IsoDateTimeString | null;
}

export interface DistributionSuspenseWorkbenchSummary {
  readonly filteredRowCount: number;
  readonly reasonTypeCount: number;
  readonly totals: readonly DistributionSuspenseCurrencyTotal[];
}

export interface DistributionSuspenseWorkbenchResponse {
  readonly summary: DistributionSuspenseWorkbenchSummary;
  readonly reasonGroups: readonly DistributionSuspenseReasonGroup[];
  readonly items: PageResult<DistributionSuspenseWorkbenchRow>;
}

export interface SuspenseItem {
  readonly id: EntityId;
  readonly period: IsoMonthString;
  readonly sourceReference: string;
  readonly reason: "missing_split" | "unmapped_track" | "import_retry" | "contract_hold";
  readonly exactFixPath: DistributionSuspenseFixPath;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly status: "open" | "resolved";
}

export interface SuspenseResolveRequest {
  readonly workspaceId: EntityId;
  readonly suspenseId: EntityId;
  readonly resolution: "map_to_release" | "map_to_track" | "retry_row" | "mark_resolved" | "hold";
  readonly targetId: EntityId | null;
  readonly note: string;
}

export interface StatementsQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly payeeId: EntityId | null;
  readonly status: "draft" | "posted" | "paid" | "void" | null;
}

export interface StatementSummary {
  readonly id: EntityId;
  readonly period: IsoMonthString;
  readonly period_start: IsoDateString;
  readonly period_end: IsoDateString;
  readonly payeeId: EntityId;
  readonly payeeName: string;
  readonly status: "draft" | "posted" | "paid" | "void";
  readonly grossMicro: MoneyMicroString;
  readonly recoupedMicro: MoneyMicroString;
  readonly paidMicro: MoneyMicroString;
  readonly netPayableMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
}

export interface StatementGenerateRequest {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString;
  readonly payeeIds: readonly EntityId[];
  readonly lockKey: string;
}

export interface StatementVoidRequest {
  readonly workspaceId: EntityId;
  readonly reason: string;
}

export interface StatementPrintQuery {
  readonly workspaceId: EntityId;
  readonly statementId: EntityId;
}

// Printable payload of a single statement: header plus per-track lines,
// exposed as domain amounts (10-decimal money strings) for A4 rendering.
export interface StatementPrintStatement {
  readonly id: EntityId;
  readonly periodStart: IsoDateString;
  readonly periodEnd: IsoDateString;
  readonly payeeId: EntityId;
  readonly payeeName: string;
  readonly currency: CurrencyCode;
  readonly grossTotal: MoneyMicroString;
  readonly recoupmentTotal: MoneyMicroString;
  readonly netPayable: MoneyMicroString;
  readonly amountDue: MoneyMicroString;
  readonly status: "draft" | "generated" | "locked" | "sent" | "paid" | "void";
  readonly version: number;
}

export interface StatementPrintLine {
  readonly id: EntityId;
  readonly trackId: EntityId | null;
  readonly grossShare: MoneyMicroString;
  readonly recoupmentApplied: MoneyMicroString;
  readonly netPayable: MoneyMicroString;
  readonly quantity: DecimalString;
  readonly currency: CurrencyCode;
}

export interface StatementPrintResponse {
  readonly statement: StatementPrintStatement;
  readonly lines: readonly StatementPrintLine[];
}

export interface PaymentsQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly payeeId: EntityId | null;
  readonly status: "draft" | "paid" | "voided" | null;
  readonly dateFrom?: IsoDateString | null;
  readonly dateTo?: IsoDateString | null;
}

export interface PaymentSummary {
  readonly id: EntityId;
  readonly statementId: EntityId | null;
  readonly linkedStatementIds: readonly EntityId[];
  readonly payeeId: EntityId;
  readonly payeeName: string;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly exchangeRate: DecimalString | null;
  readonly method: DistributionPaymentMethod;
  readonly status: "draft" | "paid" | "voided";
  readonly paidAt: IsoDateTimeString | null;
  readonly reference: string | null;
  readonly notes: string | null;
}

export type DistributionPaymentMethod = "bank_transfer" | "paypal" | "cash" | "cheque" | "crypto" | "other";

export interface PaymentRecordRequest {
  readonly workspaceId: EntityId;
  readonly statementId: EntityId | null;
  readonly payeeId: EntityId;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly exchangeRate: DecimalString | null;
  readonly method: DistributionPaymentMethod;
  readonly status: "draft" | "paid";
  readonly paidAt: IsoDateTimeString | null;
  readonly reference: string | null;
  readonly notes: string | null;
}

export interface PaymentUpdateRequest {
  readonly workspaceId: EntityId;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly exchangeRate: DecimalString | null;
  readonly method: DistributionPaymentMethod;
  readonly status: "draft" | "paid";
  readonly paidAt: IsoDateTimeString | null;
  readonly reference: string | null;
  readonly notes: string | null;
}

export interface PaymentReconcileRequest {
  readonly workspaceId: EntityId;
  readonly statementId: EntityId;
  readonly amountAppliedMicro: MoneyMicroString;
  readonly reconciledAt: IsoDateTimeString;
}

export interface PaymentVoidRequest {
  readonly workspaceId: EntityId;
  readonly reason: string;
}

export interface DistributionFxRatesQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly fromCurrency?: CurrencyCode | null;
  readonly toCurrency?: CurrencyCode | null;
  readonly effectiveDate?: IsoDateString | null;
}

export interface DistributionFxRate {
  readonly fromCurrency: CurrencyCode;
  readonly toCurrency: CurrencyCode;
  readonly effectiveDate: IsoDateString;
  readonly rate: DecimalString;
}

export interface DistributionFxRatesSaveRequest {
  readonly workspaceId: EntityId;
  readonly rates: readonly DistributionFxRate[];
}

export interface DistributionRevenueQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly payeeId: EntityId | null;
  readonly store: string | null;
  readonly currency: CurrencyCode | null;
  readonly groupBy: "payee" | "track" | "currency" | "store" | "period";
  readonly dateFrom?: IsoDateString | null;
  readonly dateTo?: IsoDateString | null;
}

export interface DistributionRevenueRow {
  readonly id: EntityId;
  readonly label: string;
  readonly grossMicro: MoneyMicroString;
  readonly netMicro: MoneyMicroString;
  readonly payableMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly barLevel: number;
}

export interface DistributionWorkspaceQuery {
  readonly workspaceId: EntityId;
}

export interface DistributionWorkspacePageQuery extends PageQuery {
  readonly workspaceId: EntityId;
}

export interface DistributionReconciliationKpi {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone: "info" | "warning" | "success" | "error" | "muted" | "active";
}

export interface DistributionReconciliationStatementGap {
  readonly id: EntityId;
  readonly statementReference: string;
  readonly payee: string;
  readonly periodStart: IsoDateString;
  readonly periodEnd: IsoDateString;
  readonly currency: CurrencyCode;
  readonly netPayableMicro: MoneyMicroString;
}

export interface DistributionReconciliationExpenseGap {
  readonly id: EntityId;
  readonly expenseReference: string;
  readonly contract: string;
  readonly description: string;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly status: string;
}

export interface DistributionReconciliationMatchedUnallocated {
  readonly id: EntityId;
  readonly sourceReference: string;
  readonly batch: string;
  readonly track: string;
  readonly currency: CurrencyCode;
  readonly grossMicro: MoneyMicroString;
  readonly status: string;
}

export interface DistributionReconciliationPayeeBalance {
  readonly payee: string;
  readonly currency: CurrencyCode;
  readonly rows: number;
  readonly firstId: EntityId | null;
  readonly lastId: EntityId | null;
  readonly firstReference: string | null;
  readonly lastReference: string | null;
  readonly latestClosingMicro: MoneyMicroString;
}

export interface DistributionReconciliationAction {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly maintenance: boolean;
}

export interface DistributionReconciliationActionRequest {
  readonly workspaceId: EntityId;
  readonly reason: string | null;
}

export interface DistributionReconciliationResponse {
  readonly kpis: readonly DistributionReconciliationKpi[];
  readonly statementsWithoutPaymentLinks: readonly DistributionReconciliationStatementGap[];
  readonly expenseTermsMissingPayee: readonly DistributionReconciliationExpenseGap[];
  readonly matchedUnallocatedSamples: readonly DistributionReconciliationMatchedUnallocated[];
  readonly payeeBalancesSummary: readonly DistributionReconciliationPayeeBalance[];
  readonly actions: readonly DistributionReconciliationAction[];
}

export type DistributionAliasTargetType = "artist" | "payee" | "label" | "release" | "track" | "unassigned";

export interface DistributionAlias {
  readonly id: EntityId;
  readonly aliasText: string;
  readonly target: string;
  readonly targetType: DistributionAliasTargetType;
  readonly targetId: EntityId | null;
}

export interface DistributionAliasUpsertRequest {
  readonly workspaceId: EntityId;
  readonly aliasText: string;
  readonly targetType: DistributionAliasTargetType;
  readonly targetId: EntityId | null;
}

export interface DistributionDuplicate {
  readonly id: EntityId;
  readonly label: string;
  readonly kind: string;
  readonly count: number;
  readonly sampleIds: readonly EntityId[];
  readonly sampleLabels: readonly string[];
  /** Same-ISRC rows are revenue aggregation, never merge candidates. */
  readonly resolutionAllowed: boolean;
}

export interface DistributionDuplicateResolveRequest {
  readonly workspaceId: EntityId;
  readonly keepEarningId: EntityId | null;
  readonly reason: string | null;
}

export interface DistributionSettingsResponse {
  readonly workspaceId: EntityId;
  readonly namespace: string;
  readonly reads: string;
  readonly payeeCount: number;
  readonly contractCount: number;
  readonly currencies: readonly CurrencyCode[];
  readonly fxRateCount: number;
  readonly mutationsEnabled: boolean;
}
