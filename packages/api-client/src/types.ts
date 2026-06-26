export type LegacyNamespace = "eof/v1" | "erh/v1";
export type HttpMethod = "GET" | "POST" | "PATCH";
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

export interface OfficeDashboardResponse {
  readonly period: IsoMonthString;
  readonly cashBalanceMicro: MoneyMicroString;
  readonly receivablesMicro: MoneyMicroString;
  readonly payablesMicro: MoneyMicroString;
  readonly unreconciledTransactionCount: number;
  readonly lastAuditEventId: EntityId | null;
  readonly recentImports?: readonly OfficeRecentImport[];
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

export interface OfficeDivisionPnlQuery extends PeriodQuery {}

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
  readonly accountId: EntityId;
  readonly projectId: EntityId | null;
  readonly projectLabel: string | null;
  readonly description: string;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
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
}

export interface OfficePlanComptableQuery {
  readonly workspaceId: EntityId;
  readonly includeInactive: boolean;
}

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

export interface BankImportPreviewRequest {
  readonly workspaceId: EntityId;
  readonly source: "sbi" | "mcb" | "csv" | "cashflow" | "pdf";
  readonly fileName: string;
  readonly checksum: string;
  readonly rows: readonly Readonly<Record<string, string>>[];
}

export interface BankImportPreviewResponse {
  readonly previewId: EntityId;
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
}

export interface BankImportConfirmRequest {
  readonly workspaceId: EntityId;
  readonly previewId: EntityId;
  readonly acceptedRowIds: readonly EntityId[];
  readonly rejectedRowIds: readonly EntityId[];
}

export interface BankImportConfirmResponse extends ApiMutationReceipt {
  readonly importedTransactionCount: number;
}

export interface OfficeReconciliationsQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly accountId: EntityId | null;
  readonly period: IsoMonthString | null;
  readonly status: "unmatched" | "suggested" | "matched" | null;
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
  readonly status: "unmatched" | "suggested" | "matched";
}

export interface OfficeReconciliationApproveRequest {
  readonly workspaceId: EntityId;
  readonly reconciliationIds: readonly EntityId[];
  readonly approvedAt: IsoDateTimeString;
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

export type OfficePartnerFacet = "client" | "supplier";

export interface OfficePartnersQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString;
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

export interface OfficeProjectsQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly status: "active" | "archived" | null;
}

export interface OfficeProjectSummary {
  readonly id: EntityId;
  readonly code: string;
  readonly label: string;
  readonly status: "active" | "archived";
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
  readonly matchedRateBp: BasisPoints;
  readonly unmatchedLineCount: number;
  readonly duplicateCandidateCount: number;
  readonly missingReferenceCount: number;
  readonly staleImportCount: number;
  readonly lastImportAt: IsoDateTimeString | null;
}

export interface OfficeBankAccountsQuery {
  readonly workspaceId: EntityId;
  readonly limit: number;
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
}

export interface OfficeBankRawLinesQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly accountId: EntityId | null;
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
  readonly status: "unmatched" | "suggested" | "matched" | "rejected";
  readonly reconciliationStatus: "unmatched" | "suggested" | "matched" | "rejected";
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

export interface DistributionDashboardResponse {
  readonly period: IsoMonthString;
  readonly grossRoyaltyMicro: MoneyMicroString;
  readonly recoupedMicro: MoneyMicroString;
  readonly netPayableMicro: MoneyMicroString;
  readonly suspenseCount: number;
  readonly openStatementCount: number;
  readonly lastAuditEventId: EntityId | null;
}

export interface DistributionImportBatchesQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly source: "kontor" | "routenote" | null;
  readonly status: "uploaded" | "mapped" | "validated" | "failed" | null;
}

export interface DistributionImportBatch {
  readonly id: EntityId;
  readonly source: "kontor" | "routenote";
  readonly fileName: string;
  readonly period: StatementPeriodString;
  readonly statementReference: string;
  readonly accountReference: string;
  readonly rowCount: number;
  readonly unmatchedRowCount: number;
  readonly currency: CurrencyCode;
  readonly grossMicro: MoneyMicroString;
  readonly payableColumn: string;
  readonly joinKeySummary: string;
  readonly status: "uploaded" | "mapped" | "validated" | "failed";
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
}

export interface DistributionMappingRow {
  readonly id: EntityId;
  readonly batchId: EntityId;
  readonly sourceTitle: string;
  readonly sourceArtist: string;
  readonly sourceStore: string;
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
  readonly payeeId: EntityId;
  readonly incurredOn: IsoDateString;
  readonly label: string;
  readonly originalAmountMicro: MoneyMicroString;
  readonly openAmountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly status: "open" | "recouped" | "waived";
}

export interface DistributionContractExpenseRecordRequest {
  readonly workspaceId: EntityId;
  readonly contractId: EntityId;
  readonly payeeId: EntityId;
  readonly incurredOn: IsoDateString;
  readonly label: string;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
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

export interface AllocationRunQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly status: "queued" | "running" | "completed" | "failed" | null;
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
}

export interface AllocationRunPreviewRequest {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString;
  readonly lockKey: string;
}

export interface AllocationRunStartRequest {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString;
  readonly lockKey: string;
  readonly cadence: "manual" | "scheduled";
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
}

export interface SuspenseItem {
  readonly id: EntityId;
  readonly period: IsoMonthString;
  readonly sourceReference: string;
  readonly reason: "missing_split" | "unmapped_track" | "import_retry" | "contract_hold";
  readonly exactFixPath: "contracts" | "mapping" | "imports" | "catalog";
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly status: "open" | "resolved";
}

export interface SuspenseResolveRequest {
  readonly workspaceId: EntityId;
  readonly suspenseId: EntityId;
  readonly resolution: "map_to_release" | "map_to_track" | "hold";
  readonly targetId: EntityId | null;
  readonly note: string;
}

export interface StatementsQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly payeeId: EntityId | null;
  readonly status: "draft" | "posted" | "paid" | null;
}

export interface StatementSummary {
  readonly id: EntityId;
  readonly period: IsoMonthString;
  readonly period_start: IsoDateString;
  readonly period_end: IsoDateString;
  readonly payeeId: EntityId;
  readonly payeeName: string;
  readonly status: "draft" | "posted" | "paid";
  readonly grossMicro: MoneyMicroString;
  readonly recoupedMicro: MoneyMicroString;
  readonly expenseMicro: MoneyMicroString;
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

export interface PaymentsQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly payeeId: EntityId | null;
  readonly status: "draft" | "queued" | "paid" | "voided" | null;
}

export interface PaymentSummary {
  readonly id: EntityId;
  readonly statementId: EntityId;
  readonly payeeId: EntityId;
  readonly payeeName: string;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly status: "draft" | "queued" | "paid" | "voided";
  readonly paidAt: IsoDateTimeString | null;
  readonly reference: string | null;
}

export interface PaymentRecordRequest {
  readonly workspaceId: EntityId;
  readonly statementId: EntityId;
  readonly payeeId: EntityId;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly paidAt: IsoDateTimeString;
  readonly reference: string;
}

export interface PaymentUpdateRequest {
  readonly workspaceId: EntityId;
  readonly amountMicro: MoneyMicroString;
  readonly currency: CurrencyCode;
  readonly reference: string;
}

export interface PaymentReconcileRequest {
  readonly workspaceId: EntityId;
  readonly bankTransactionId: EntityId;
  readonly reconciledAt: IsoDateTimeString;
}

export interface DistributionRevenueQuery extends PageQuery {
  readonly workspaceId: EntityId;
  readonly period: IsoMonthString | null;
  readonly payeeId: EntityId | null;
  readonly store: string | null;
  readonly currency: CurrencyCode | null;
  readonly groupBy: "payee" | "track" | "currency" | "store" | "period";
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

export interface DistributionReconciliationResponse {
  readonly kpis: readonly DistributionReconciliationKpi[];
  readonly statementsWithoutPaymentLinks: readonly DistributionReconciliationStatementGap[];
  readonly expenseTermsMissingPayee: readonly DistributionReconciliationExpenseGap[];
  readonly matchedUnallocatedSamples: readonly DistributionReconciliationMatchedUnallocated[];
  readonly payeeBalancesSummary: readonly DistributionReconciliationPayeeBalance[];
  readonly actions: readonly DistributionReconciliationAction[];
}

export interface DistributionAlias {
  readonly id: EntityId;
  readonly aliasText: string;
  readonly target: string;
  readonly targetType: "artist" | "payee" | "label" | "release" | "track" | "unassigned";
}

export interface DistributionDuplicate {
  readonly id: EntityId;
  readonly label: string;
  readonly kind: string;
  readonly count: number;
  readonly sampleIds: readonly EntityId[];
  readonly sampleLabels: readonly string[];
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
