import { randomUUID } from "crypto";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getAuthRoleProfile, type WorkspaceAppId } from "@ehq/auth";
import {
  calculateVat,
  convertMoney,
  createBasisPoints,
  createCurrencyCode,
  createMoneyAmount,
  createMoneyMicroUnits,
  eofMoney,
  erhMoney,
  format as formatScaledUnits,
  parse as parseScaledUnits,
  roundRatioHalfUp,
  reconcileTransaction,
  summarizeLedger,
  type LedgerTransaction
} from "@ehq/domain-finance";
import {
  buildAllocationPlan,
  computeStatementBalance,
  computeStatementGroupTotals,
  buildStatementPlan,
  buildVoidPlan,
  countOpenStatements,
  countOpenSuspense,
  readAllocationList,
  readAllocationTotals,
  readStatementSummaries,
  readSuspense,
  type CostTermStatusUpdate,
  type DistributionAllocationReadRow,
  type DistributionAllocationOutcome,
  type DistributionCalculationRunRow,
  type DistributionCostTermInput,
  type DistributionCostState,
  type DistributionEarningAllocationRow,
  type DistributionEarningInput,
  type DistributionFxRateInput,
  type DistributionReadDataset,
  type DistributionRoyaltyRuleInput,
  type DistributionSuspenseItemInsert,
  type DistributionStatementReadRow,
  type DistributionSuspenseReadRow,
  type EarningAllocationInsert,
  type ExpenseApplicationInsert,
  type PayeeBalanceInsertPlan,
  type PayeeBalanceLedgerInput,
  type StatementAllocationInput,
  type StatementBalanceResult,
  type StatementGroupTotal,
  type StatementPaymentLinkInput
} from "@ehq/domain-distribution";
import {
  readDepartmentPnl,
  readGlobalPnl,
  readOfficeBankQuality,
  readOfficeCashflowProjection,
  readOfficeDashboardFull,
  readMonthlyPnl,
  readPnlByDivision,
  readPartnerPnl,
  readPnlByCategory,
  readPnlByDepartment,
  readProjectPnl,
  type OfficeBankAccountRow,
  type OfficeBankQualityResult,
  type OfficeWriteExchangeRateRow,
  type OfficeAnalyticsDataset,
  type OfficeBankStatementLineRow,
  type OfficeBankImportBatchRow,
  type OfficeCategoryRow,
  type OfficeDepartmentRow,
  type OfficePnlDivisionRow,
  type OfficeDivisionRow,
  type OfficePartnerRow,
  type OfficePnlCategoryRow,
  type OfficePnlDepartmentRow,
  type OfficePnlFilters,
  type OfficePnlMonthlyRow,
  type OfficeProjectRow,
  type OfficeTransactionRow
} from "@ehq/domain-office";
import type {
  AllocationRunPreviewRequest,
  AllocationRunStartRequest,
  AllocationRunSummary,
  AllocationRunUnpostRequest,
  ApiMutationReceipt,
  ApiRunReceipt,
  AuditLogEntry,
  BankImportParsePreviewRequest,
  BankImportParsePreviewResponse,
  BankImportConfirmRequest,
  BankImportConfirmResponse,
  BankImportPreviewRequest,
  BankImportPreviewResponse,
  OfficeImportRejectionReason,
  OfficeBankPreviewRowResult,
  CashflowBucket,
  CommandCenterOverviewIntegration,
  CommandCenterOverviewResponse,
  CommandCenterOverviewSetting,
  CommandCenterNotification,
  CommandCenterNotificationsResponse,
  CommandCenterReadinessItem,
  CurrencyCode,
  DistributionContract,
  DistributionContractExpense,
  DistributionDashboardResponse,
  DistributionImportBatch,
  DistributionImportConfirmRequest,
  DistributionImportConfirmResponse,
  DistributionImportPreviewRequest,
  DistributionImportPreviewResponse,
  DistributionAlias,
  DistributionDuplicate,
  DistributionMappingApplyRulesRequest,
  DistributionMappingRow,
  DistributionReconciliationAction,
  DistributionReconciliationExpenseGap,
  DistributionReconciliationKpi,
  DistributionReconciliationMatchedUnallocated,
  DistributionReconciliationPayeeBalance,
  DistributionReconciliationResponse,
  DistributionScreenResponse,
  DistributionReconciliationStatementGap,
  DistributionRevenueRow,
  DistributionSettingsResponse,
  OfficeBankQualityResponse,
  OfficeDashboardAnalyticsResponse,
  OfficeDashboardDepartmentExpenseTrendKpi,
  OfficeDashboardExpenseCategoryKpi,
  OfficeDashboardPreviousPeriod,
  OfficeDashboardProjectProfitabilityKpi,
  OfficeDashboardReconciliationAccountKpi,
  OfficeDashboardRunwayExcludedAccount,
  OfficeDashboardResponse,
  OfficeDepartmentPnl,
  OfficeGlobalPnl,
  OfficeIntegrityCheck,
  OfficeIntegrityCheckAllResponse,
  OfficePartnerActivity,
  OfficePartnerDetail,
  OfficePartnerFacet,
  OfficePartnerListItem,
  OfficePartnerPayeeLink,
  OfficePartnerPayeeLinkRequest,
  OfficePartnerPnl,
  OfficePartnerWriteRequest,
  OfficePlanComptableDeleteRequest,
  OfficePlanComptableWriteRequest,
  OfficePartnerSideActivity,
  OfficePlanComptableNode,
  OfficePnlLine,
  OfficePnlProjectionRow,
  OfficeProjectPnl,
  OfficeBankRawLineReassignRequest,
  OfficeProjectPnlLine,
  OfficeProjectSummary,
  OfficeReconciliationCandidate,
  OfficeReconciliationApproveRequest,
  OfficeReconciliationMatchRequest,
  OfficeReconciliationLineRequest,
  OfficeReconciliationCreateTransactionRequest,
  OfficeTransaction,
  OfficeTransactionStatus,
  OfficeTransactionWriteRequest,
  PageResult,
  PayeeSummary,
  PaymentRecordRequest,
  PaymentReconcileRequest,
  PaymentSummary,
  PaymentUpdateRequest,
  PaymentVoidRequest,
  ReleaseSummary,
  StatementGenerateRequest,
  StatementSummary,
  DistributionContractExpenseRecordRequest,
  SuspenseResolveRequest,
  SuspenseItem,
  TrackSummary
} from "@ehq/api-client";
import {
  createSupabaseAuthMiddleware,
  type ApiAuthBindings,
  type AuthenticatedApiUser,
  type SupabaseJwtVerifier
} from "./auth.js";
import { parseOfficeBankImportText } from "./office-bank-parser.js";
import { createSupabaseRouter } from "./supabase-server.js";
import { createFixtureStore, type ApiDistributionRoyaltyRuleInput, type ApiFixtureStore } from "./fixtures.js";
import {
  appendAuditEvent,
  acquireAdvisoryLock,
  createMemoryPersistenceRuntime,
  findOfficeBankImportBatchByFingerprint,
  getDistributionImportPreviewInTransaction,
  getOfficeBankImportPreviewInTransaction,
  hashRequestBody,
  isApiPersistenceHttpError,
  markDistributionImportBatchVoid,
  markOfficeBankImportBatchVoid,
  persistDistributionAllocationRun,
  persistDistributionFxRates,
  persistDistributionImportConfirmation,
  persistDistributionPaymentReconcile,
  persistDistributionPaymentRecord,
  persistDistributionPaymentUpdate,
  persistDistributionPaymentVoid,
  persistDistributionRoyaltyRules,
  persistDistributionStatements,
  persistDistributionStatementVoid,
  persistIdentityLink,
  persistOfficeBankImportConfirmation,
  isBotApiUser,
  requirePermissionForWorkspace,
  runIdempotentMutation,
  type ApiImportPreviewRow,
  type ApiMutationResponse,
  type ApiPersistenceRuntime,
  type ApiWriteTransaction,
  type DistributionImportPreviewRecord,
  type JsonRecord,
  type OfficeBankImportPreviewRecord,
  type OfficeBankStatementLineInsert,
  type PersistDistributionAllocationRunInput,
  type PersistDistributionFxRatesInput,
  type PersistDistributionPaymentReconcileInput,
  type PersistDistributionPaymentRecordInput,
  type PersistDistributionPaymentUpdateInput,
  type PersistDistributionPaymentVoidInput,
  type PersistDistributionRoyaltyRulesInput,
  type PersistDistributionStatementVoidInput,
  type PersistIdentityLinkInput,
  type PersistedDistributionRoyaltyRule,
  type PersistedEarningAllocationInsert,
  type StatementPersistPlan
} from "./persistence.js";

export type LegacyRestNamespace = "eof/v1" | "erh/v1";
export type LegacySurfaceOwner = "office" | "distribution";
export type LegacyAccessMode = "read-only";
export type LegacyDomainModelName =
  | "Expense"
  | "DepartmentDivisionCategory"
  | "LedgerTransaction";

export interface LegacyRestSurface {
  readonly namespace: LegacyRestNamespace;
  readonly owner: LegacySurfaceOwner;
  readonly accessMode: LegacyAccessMode;
}

export interface LegacyAdapterMapping {
  readonly legacyAlias: string;
  readonly physicalTables: readonly string[];
  readonly domainModel: LegacyDomainModelName;
  readonly owner: LegacySurfaceOwner;
}

export interface ApiServiceDependencies {
  readonly fixtures: ApiFixtureStore;
  readonly persistence: ApiPersistenceRuntime;
  readonly health: (() => Promise<unknown>) | null;
  readonly nowIso: () => string;
  readonly auth: SupabaseJwtVerifier;
}

interface PageWindow {
  readonly cursor: string | null;
  readonly offset: number;
  readonly limit: number;
}

interface ApiErrorPayload {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly context: readonly string[];
  };
}

interface PartnerActivityUnits {
  readonly incomeUnits: bigint;
  readonly expenseUnits: bigint;
  readonly incomeCount: number;
  readonly expenseCount: number;
  readonly incomeLastActivityOn: string | null;
  readonly expenseLastActivityOn: string | null;
}

interface DistributionImportConfirmMutationResponse extends DistributionImportConfirmResponse, ApiMutationResponse {
  readonly rawRowCount: number;
  readonly normalizedRowCount: number;
  readonly issueCount: number;
}

interface DistributionImportReverseMutationResponse extends ApiMutationReceipt, ApiMutationResponse {}

interface OfficeBankImportConfirmMutationResponse extends BankImportConfirmResponse, ApiMutationResponse {
  readonly rejectedRowCount: number;
}

interface OfficeBankImportReverseMutationResponse extends ApiMutationReceipt, ApiMutationResponse {}

interface AllocationRunPlanResponse extends ApiRunReceipt {
  readonly allocationCount: number;
  readonly expenseApplicationCount: number;
  readonly costTermUpdateCount: number;
  readonly suspenseCount: number;
  readonly allocations: readonly EarningAllocationInsert[];
  readonly expenseApplications: readonly ExpenseApplicationInsert[];
  readonly costTermStatusUpdates: readonly CostTermStatusUpdate[];
  readonly suspenseItems: readonly DistributionSuspenseItemInsert[];
}

interface AllocationRunMutationResponse extends AllocationRunPlanResponse, ApiMutationResponse {}

interface StatementGenerateMutationResponse extends ApiRunReceipt, ApiMutationResponse {
  readonly statementCount: number;
  readonly lineCount: number;
  readonly balanceLedgerRowCount: number;
  readonly statements: readonly {
    readonly id: string;
    readonly payeeId: string;
    readonly period: string;
    readonly currency: string;
    readonly amountDue: string;
    readonly closingBalance: string;
  }[];
}

interface StatementVoidMutationResponse extends ApiMutationReceipt, ApiMutationResponse {
  readonly reversalLedgerRowCount: number;
  readonly reversal: PayeeBalanceInsertPlan;
}

interface PaymentMutationResponse extends ApiMutationReceipt, ApiMutationResponse {
  readonly paymentId: string;
  readonly statementId: string;
  readonly amountMicro: string;
  readonly currency: string;
  readonly paymentStatus: "recorded" | "edited" | "reconciled" | "voided";
  readonly statementBalance: StatementBalanceResult;
  readonly groupTotals: readonly StatementGroupTotal[];
}

interface OfficeBankAccountDeleteCounts {
  readonly accountCount: number;
  readonly statementLineCount: number;
  readonly reconciliationMatchCount: number;
  readonly importBatchCount: number;
  readonly cashflowProjectionCount: number;
}

interface OfficeBankImportDeleteCounts {
  readonly batchCount: number;
  readonly statementLineCount: number;
  readonly reconciliationMatchCount: number;
}

interface OfficePlanComptableDeleteCounts {
  readonly nodeCount: number;
  readonly childDivisionCount: number;
  readonly childCategoryCount: number;
  readonly transactionCount: number;
  readonly projectBudgetLineCount: number;
  readonly financialAllocationCount: number;
  readonly projectDepartmentCount: number;
}

interface OfficeFinancialResetCounts {
  readonly transactionCount: number;
  readonly statementLineCount: number;
  readonly reconciliationMatchCount: number;
  readonly importBatchCount: number;
  readonly bankAccountCount: number;
}

interface ContractRoyaltyRuleRequest {
  readonly payeeId: string;
  readonly percentage: string;
  readonly scopeType: string | null;
  readonly scopeId: string | null;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
}

interface ContractRoyaltyRulesUpdateRequest {
  readonly workspaceId: string;
  readonly rules: readonly ContractRoyaltyRuleRequest[];
}

interface ContractRoyaltyRulesMutationResponse extends ApiMutationReceipt, ApiMutationResponse {
  readonly contractId: string;
  readonly ruleCount: number;
  readonly totalPercentage: string;
  readonly rules: readonly ApiDistributionRoyaltyRuleInput[];
}

interface FxRateSaveRequest {
  readonly fromCurrency: string;
  readonly toCurrency: string;
  readonly effectiveDate: string;
  readonly rate: string;
}

interface FxRatesSaveRequest {
  readonly workspaceId: string;
  readonly rates: readonly FxRateSaveRequest[];
}

interface FxRatesSaveMutationResponse extends ApiMutationReceipt, ApiMutationResponse {
  readonly rateCount: number;
  readonly rates: readonly DistributionFxRateInput[];
}

interface DistributionPayeePartnerLinkRequest {
  readonly workspaceId: string;
  readonly officePartnerId: string;
}

interface DistributionPayeePartnerLinkResponse {
  readonly payeeId: string;
  readonly payeeName: string;
  readonly officePartnerId: string | null;
  readonly officePartnerName: string | null;
  readonly linked: boolean;
  readonly confidence: string | null;
  readonly status: "active" | "inactive" | null;
}

interface IdentityLinkMutationResponse extends ApiMutationReceipt, ApiMutationResponse {
  readonly officePartnerId: string;
  readonly payeeId: string;
  readonly officeLink: OfficePartnerPayeeLink;
  readonly distributionLink: DistributionPayeePartnerLinkResponse;
}

interface AllocationExecutionPlan {
  readonly runId: string;
  readonly period: string;
  readonly lockKey: string;
  readonly pendingEarnings: readonly DistributionReadDataset["normalizedEarnings"][number][];
  readonly allocations: readonly EarningAllocationInsert[];
  readonly expenseApplications: readonly ExpenseApplicationInsert[];
  readonly costTermStatusUpdates: readonly CostTermStatusUpdate[];
  readonly suspenseItems: readonly DistributionSuspenseItemInsert[];
  readonly batchId: string | null;
}

interface StatementGenerateExecutionPlan {
  readonly runId: string;
  readonly period: string;
  readonly lockKey: string;
  readonly statementPlans: readonly StatementPersistPlan[];
}

interface ParsedOfficeBankPreviewRow {
  readonly row: ApiImportPreviewRow;
  readonly line: OfficeBankStatementLineInsert | null;
  readonly issues: readonly string[];
}

interface OfficeReconciliationSuggestion {
  readonly statementLineId: string;
  readonly transactionId: string;
  readonly confidenceBp: number;
}

interface OfficeReconciliationSuggestionScore {
  readonly confidenceBp: number;
  readonly dayDistance: number;
  readonly sharedTokenCount: number;
  readonly referenceMatched: boolean;
}

interface OfficeReconciliationSuggestionCandidate extends OfficeReconciliationSuggestionScore {
  readonly transaction: OfficeTransactionRow;
}

interface OfficeReconciliationApproveSuggestedResponse extends ApiMutationReceipt, ApiMutationResponse {
  readonly processedCount: number;
  readonly candidateCount: number;
  readonly minConfidenceBp: number;
  readonly limit: number;
}

interface OfficeReconciliationOperationsResponse {
  readonly workspaceId: string;
  readonly period: string | null;
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
  readonly generatedAt: string;
  readonly totalCount: number;
  readonly unmatchedCount: number;
  readonly suggestedCount: number;
  readonly matchedCount: number;
  readonly rejectedCount: number;
  readonly ignoredCount: number;
  readonly autoApprovableCount: number;
  readonly staleSuggestedCount: number;
  readonly oldestUnmatchedDays: number | null;
  readonly matchedRateBp: number;
}

interface OfficeDateRange {
  readonly start: string | null;
  readonly end: string | null;
  readonly label: string;
}

interface OfficeBankFixturePatch {
  readonly batchId: string;
  readonly workspaceId: string;
  readonly source: "sbi" | "mcb" | "csv" | "cashflow" | "pdf";
  readonly fileName: string;
  readonly checksum: string;
  readonly accountId: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly currency: string | null;
  readonly acceptedRowCount: number;
  readonly rejectedRowCount: number;
  readonly duplicateRowCount: number;
  readonly idempotencyFingerprint: string;
  readonly status: "confirmed" | "failed" | "void";
  readonly importedAt: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly lines: readonly OfficeBankStatementLineInsert[];
}

interface OfficeAuditFixturePatch {
  readonly id: string;
  readonly actorId: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly occurredAt: string;
}

interface DistributionPaymentFixturePatch {
  readonly payment: DistributionReadDataset["payments"][number];
  readonly link: DistributionReadDataset["statementPaymentLinks"][number];
}

interface PaymentBalanceProjection {
  readonly statementBalance: StatementBalanceResult;
  readonly groupTotals: readonly StatementGroupTotal[];
}

type Mutable<TValue> = {
  -readonly [TKey in keyof TValue]: TValue[TKey];
};

type ApiContext = Context<ApiAuthBindings>;

const DEFAULT_WORKSPACE_ID = "eeee-mu";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T/u;
const currencyCodePattern = /^[A-Z]{3}$/u;
const moneyStringPattern = /^-?\d+(?:\.\d+)?$/u;

const nullableStringSchema = z.string().min(1).nullable();
const optionalNullableStringSchema = z.preprocess(
  (value: unknown): unknown => value === undefined || value === "" ? null : value,
  z.string().min(1).nullable()
);
const workspaceBodySchema = z.object({ workspaceId: z.string().min(1) });
// Defense in depth beyond the administrator-role gate: the literal phrase must be typed
// by a human, so this can't be triggered by a script that merely holds an admin token.
const OFFICE_FINANCIAL_RESET_PHRASE = "DELETE ALL OFFICE DATA";
const officeFinancialResetSchema = workspaceBodySchema.extend({
  confirmationPhrase: z.literal(OFFICE_FINANCIAL_RESET_PHRASE)
});
type OfficeFinancialResetRequest = z.infer<typeof officeFinancialResetSchema>;
const jsonRecordSchema = z.record(z.string(), z.unknown());
const commandCenterSettingUpdateSchema = workspaceBodySchema.extend({
  key: z.string().min(1),
  value: jsonRecordSchema,
  status: z.string().min(1)
});
const commandCenterIntegrationToggleSchema = workspaceBodySchema.extend({
  integrationId: z.string().min(1),
  enabled: z.boolean(),
  status: z.string().min(1)
});
const commandCenterUserPermissionUpdateSchema = workspaceBodySchema.extend({
  userId: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  permissions: jsonRecordSchema
});
const officeTransactionWriteSchema = workspaceBodySchema.extend({
  occurredOn: z.string().regex(isoDatePattern),
  accountId: z.string().min(1),
  categoryId: nullableStringSchema,
  projectId: nullableStringSchema,
  description: z.string().min(1),
  amountMicro: z.string().regex(moneyStringPattern),
  currency: z.string().regex(currencyCodePattern),
  // Income/expense is the transaction's own attribute; the category only files it
  // under division/department. Optional for backward compatibility: absent on
  // create defaults to "expense" (never category-derived), absent on update
  // preserves the stored type.
  type: z.enum(["income", "expense"]).nullable().optional()
});
const officePlanComptableWriteSchema = workspaceBodySchema.extend({
  parentId: nullableStringSchema,
  kind: z.enum(["department", "division", "category"]),
  code: z.string().min(1),
  label: z.string().min(1),
  active: z.boolean(),
  type: z.enum(["income", "expense"]).nullable()
});
const officeReconciliationApproveSchema = workspaceBodySchema.extend({
  reconciliationIds: z.array(z.string().min(1)).min(1),
  approvedAt: z.string().regex(isoDateTimePattern)
});
const officeReconciliationApproveSuggestedSchema = workspaceBodySchema.extend({
  approvedAt: z.string().regex(isoDateTimePattern),
  minConfidenceBp: z.number().int().min(0).max(10_000).optional(),
  limit: z.number().int().min(1).max(1_000).optional()
});
type OfficeReconciliationApproveSuggestedRequest = z.infer<typeof officeReconciliationApproveSuggestedSchema>;
const officeReconciliationMatchSchema = workspaceBodySchema.extend({
  statementLineId: z.string().min(1),
  transactionId: z.string().min(1),
  matchedAt: z.string().regex(isoDateTimePattern)
});
const officeReconciliationLineSchema = workspaceBodySchema.extend({
  statementLineId: z.string().min(1)
});
const officeBankRawLineReassignSchema = workspaceBodySchema.extend({
  statementLineId: z.string().min(1),
  accountId: z.string().min(1)
});
const officeReconciliationCreateTransactionSchema = workspaceBodySchema.extend({
  statementLineId: z.string().min(1),
  categoryId: nullableStringSchema,
  projectId: nullableStringSchema,
  matchedAt: z.string().regex(isoDateTimePattern)
});
const officePartnerWriteSchema = workspaceBodySchema.extend({
  name: z.string().min(1),
  email: nullableStringSchema,
  phone: nullableStringSchema,
  address: nullableStringSchema,
  taxId: nullableStringSchema,
  notes: nullableStringSchema,
  active: z.boolean()
});
const officeBankAccountWriteSchema = workspaceBodySchema.extend({
  bankName: z.string().min(1),
  accountLabel: z.string().min(1),
  currency: z.string().regex(currencyCodePattern),
  active: z.boolean()
});
type OfficeBankAccountWriteRequest = z.infer<typeof officeBankAccountWriteSchema>;
type OfficeBankAccountDeleteRequest = WorkspaceBodyRequest;
type OfficeBankImportDeleteRequest = WorkspaceBodyRequest;
const officeProjectWriteSchema = workspaceBodySchema.extend({
  name: z.string().min(1),
  status: z.enum(["draft", "active", "paused", "completed", "cancelled", "archived"]),
  description: nullableStringSchema,
  active: z.boolean()
});
type OfficeProjectWriteRequest = z.infer<typeof officeProjectWriteSchema>;
const officeCashflowImportSchema = workspaceBodySchema.extend({
  rows: z.array(z.record(z.string()))
});
type OfficeCashflowImportRequest = z.infer<typeof officeCashflowImportSchema>;
interface ParsedCashflowRow {
  readonly periodMonth: string;
  readonly inflowMinor: bigint;
  readonly outflowMinor: bigint;
  readonly closingBalanceMinor: bigint;
  readonly currency: string;
}
// Bulk push of an already-classified ledger (Sophie): each row carries the legacy WordPress
// tx_id (idempotency key = legacyId) plus the classification by NAME (department/division/category),
// resolved server-side to the new plan comptable UUIDs. Rows whose names do not resolve are rejected.
const officeLedgerBulkRowSchema = z.object({
  legacyId: z.coerce.number().int().optional(),
  externalId: z.coerce.number().int().optional(),
  occurredOn: z.string().regex(isoDatePattern),
  type: z.enum(["income", "expense"]),
  amount: z.string().regex(moneyStringPattern),
  currency: z.string().regex(currencyCodePattern),
  description: z.string().min(1),
  departmentId: optionalNullableStringSchema,
  divisionId: optionalNullableStringSchema,
  categoryId: optionalNullableStringSchema,
  departmentName: optionalNullableStringSchema,
  divisionName: optionalNullableStringSchema,
  categoryName: optionalNullableStringSchema,
  partnerName: optionalNullableStringSchema,
  accountCode: optionalNullableStringSchema,
  accountLabel: optionalNullableStringSchema,
  projectId: optionalNullableStringSchema
}).transform((row, issueContext) => {
  const legacyId = row.legacyId ?? row.externalId;
  if (legacyId === undefined) {
    issueContext.addIssue({
      code: z.ZodIssueCode.custom,
      message: "legacyId or externalId is required"
    });
    return { ...row, legacyId: 0 };
  }

  return { ...row, legacyId };
});
const officeLedgerBulkSchema = workspaceBodySchema.extend({
  rows: z.array(officeLedgerBulkRowSchema).min(1)
});
type OfficeLedgerBulkRequest = z.infer<typeof officeLedgerBulkSchema>;
type OfficeLedgerBulkRow = z.infer<typeof officeLedgerBulkRowSchema>;
interface ResolvedLedgerRow {
  readonly legacyId: number;
  readonly rowNumber: number;
  readonly occurredOn: string;
  readonly type: "income" | "expense";
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly description: string;
  readonly categoryId: string | null;
  readonly partnerId: string | null;
  readonly projectId: string | null;
  readonly accountCode: string | null;
  readonly accountLabel: string | null;
  readonly status: "validated" | "draft";
  readonly issues: readonly string[];
}
const officePartnerPayeeUnlinkSchema = workspaceBodySchema.extend({
  payeeId: z.null()
});
const distributionMappingApplyRulesSchema = workspaceBodySchema.extend({
  batchId: z.string().min(1),
  rowIds: z.array(z.string().min(1)).min(1)
});
const distributionContractExpenseRecordSchema = workspaceBodySchema.extend({
  contractId: z.string().min(1),
  payeeId: z.string().min(1),
  incurredOn: z.string().regex(isoDatePattern),
  label: z.string().min(1),
  amountMicro: z.string().regex(moneyStringPattern),
  currency: z.string().regex(currencyCodePattern)
});
const distributionContractUpsertSchema = workspaceBodySchema.extend({
  id: nullableStringSchema,
  payeeId: nullableStringSchema,
  title: z.string().min(1),
  status: z.enum(["draft", "active", "paused", "ended"]),
  effectiveFrom: z.string().regex(isoDatePattern),
  effectiveTo: z.string().regex(isoDatePattern).nullable(),
  splitBp: z.number().int().min(0).max(10_000),
  currency: z.string().regex(currencyCodePattern)
});
const distributionContractExpenseUpdateSchema = distributionContractExpenseRecordSchema.extend({
  status: z.enum(["open", "recouped", "waived"])
});
const distributionPayeeUpsertSchema = workspaceBodySchema.extend({
  id: nullableStringSchema,
  displayName: z.string().min(1),
  email: nullableStringSchema,
  status: z.enum(["active", "inactive"]),
  defaultCurrency: z.string().regex(currencyCodePattern)
});
const distributionReleaseUpsertSchema = workspaceBodySchema.extend({
  id: nullableStringSchema,
  title: z.string().min(1),
  artistName: z.string().min(1),
  upc: nullableStringSchema,
  status: z.enum(["draft", "released", "archived"]),
  releaseDate: z.string().regex(isoDatePattern).nullable()
});
const distributionTrackUpsertSchema = workspaceBodySchema.extend({
  id: nullableStringSchema,
  releaseId: nullableStringSchema,
  title: z.string().min(1),
  artistName: z.string().min(1),
  isrc: nullableStringSchema,
  status: z.enum(["draft", "released", "archived"])
});
const allocationRunUnpostSchema = workspaceBodySchema.extend({
  reason: z.string().min(1),
  lockToken: z.string().min(1)
});
const suspenseResolveSchema = workspaceBodySchema.extend({
  suspenseId: z.string().min(1),
  resolution: z.enum(["map_to_release", "map_to_track", "hold"]),
  targetId: nullableStringSchema,
  note: z.string().min(1)
});

type DistributionContractUpsertRequest = z.infer<typeof distributionContractUpsertSchema>;
type DistributionContractExpenseUpdateRequest = z.infer<typeof distributionContractExpenseUpdateSchema>;
type DistributionPayeeUpsertRequest = z.infer<typeof distributionPayeeUpsertSchema>;
type DistributionReleaseUpsertRequest = z.infer<typeof distributionReleaseUpsertSchema>;
type DistributionTrackUpsertRequest = z.infer<typeof distributionTrackUpsertSchema>;
type CommandCenterSettingUpdateRequest = z.infer<typeof commandCenterSettingUpdateSchema>;
type CommandCenterIntegrationToggleRequest = z.infer<typeof commandCenterIntegrationToggleSchema>;
type CommandCenterUserPermissionUpdateRequest = z.infer<typeof commandCenterUserPermissionUpdateSchema>;
type WorkspaceBodyRequest = z.infer<typeof workspaceBodySchema>;

export const legacyRestSurfaces: readonly LegacyRestSurface[] = [
  {
    namespace: "eof/v1",
    owner: "office",
    accessMode: "read-only"
  },
  {
    namespace: "erh/v1",
    owner: "distribution",
    accessMode: "read-only"
  }
];

export const legacyAdapterMappings: readonly LegacyAdapterMapping[] = [
  {
    legacyAlias: "cost_terms",
    physicalTables: ["wp_erh_contract_cost_terms"],
    domainModel: "Expense",
    owner: "distribution"
  },
  {
    legacyAlias: "categories",
    physicalTables: ["wp_eof_departments", "wp_eof_categories"],
    domainModel: "DepartmentDivisionCategory",
    owner: "office"
  },
  {
    legacyAlias: "transactions",
    physicalTables: ["wp_eof_transactions"],
    domainModel: "LedgerTransaction",
    owner: "office"
  }
];

class ApiRouteError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 422 | 500;
  readonly code: string;
  readonly context: readonly string[];

  constructor(status: 400 | 403 | 404 | 409 | 422 | 500, code: string, message: string, context: readonly string[]) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
    this.code = code;
    this.context = context;
  }
}

// Server-side workspace authorization. The route family fixes the workspace DOMAIN
// (eof -> office, erh -> distribution, cc -> command-center); after authentication, a
// non-bot caller must have that domain in their role's allowedWorkspaces or the request is
// rejected 403. This is the real barrier — the UI gate is never trusted as the only check.
// Bots keep their own finer-grained route/permission scoping inside the handlers, so they
// are intentionally not re-gated here (preserving their existing denial reasons).
function createWorkspaceDomainGuard(
  authMiddleware: MiddlewareHandler<ApiAuthBindings>,
  domain: WorkspaceAppId
): MiddlewareHandler<ApiAuthBindings> {
  return async (context: Context<ApiAuthBindings>, next): Promise<Response | void> => {
    if (context.req.method === "OPTIONS") {
      await next();
      return;
    }
    // Authenticate first. The auth middleware swallows any error thrown by its `next`
    // into a 401, so the authorization check must run AFTER it returns — not inside it.
    let authenticated = false;
    const authResponse = await authMiddleware(context, async (): Promise<void> => {
      authenticated = true;
    });
    if (!authenticated) {
      return authResponse;
    }
    const authUser = context.get("authUser");
    if (!isBotApiUser(authUser) && !getAuthRoleProfile(authUser.role).allowedWorkspaces.includes(domain)) {
      throw new ApiRouteError(
        403,
        "workspace_access_denied",
        `The ${authUser.role} role is not authorized for the ${domain} workspace.`,
        [`role=${authUser.role}`, `domain=${domain}`, `path=${context.req.path}`]
      );
    }
    await next();
    return undefined;
  };
}

export function createApiService(dependencies: ApiServiceDependencies): Hono<ApiAuthBindings> {
  const app = new Hono<ApiAuthBindings>();

  // Request timing: one structured stdout line per business request, so slow endpoints are
  // measurable from the host logs (method, path, status, durationMs). OPTIONS preflights
  // are skipped — they carry no business cost worth logging.
  app.use("*", async (context, next): Promise<void> => {
    if (context.req.method === "OPTIONS") {
      await next();
      return;
    }
    const startedAtMs = Date.now();
    await next();
    console.log(JSON.stringify({
      level: "info",
      msg: "http_request",
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
      durationMs: Date.now() - startedAtMs
    }));
  });

  app.use(
    "*",
    cors({
      origin: [
        "https://app.eeee.mu",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
      ],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"]
    })
  );

  app.onError((error: Error, context) => {
    if (error instanceof ApiRouteError) {
      return context.json(createErrorPayload(error.code, error.message, error.context), error.status);
    }

    if (isApiPersistenceHttpError(error)) {
      return context.json(createErrorPayload(error.code, error.message, error.context), error.status);
    }

    return context.json(
      createErrorPayload("api_internal_error", "The API route failed while handling the request.", [
        `errorName=${error.name}`,
        `message=${error.message}`
      ]),
      500
    );
  });

  app.notFound((context) =>
    context.json(
      createErrorPayload("route_not_found", "The requested eHQ API route does not exist.", [
        `method=${context.req.method}`,
        `path=${context.req.path}`
      ]),
      404
    )
  );

  app.get("/healthz", async (context) => {
    const database = dependencies.health === null ? { status: "ok", database: "fixture" } : await dependencies.health();
    return context.json({
      status: "ok",
      generatedAt: dependencies.nowIso(),
      database
    });
  });

  const authMiddleware = createSupabaseAuthMiddleware(dependencies.auth);
  app.get("/auth/me", authMiddleware, (context) => {
    const authUser = context.get("authUser");
    return context.json({
      userId: authUser.userId,
      email: authUser.email,
      role: authUser.role,
      workspaceId: authUser.workspaceId
    });
  });
  app.use("/eof/v1/*", createWorkspaceDomainGuard(authMiddleware, "office"));
  app.use("/erh/v1/*", createWorkspaceDomainGuard(authMiddleware, "distribution"));
  app.use("/cc/v1/*", createWorkspaceDomainGuard(authMiddleware, "command-center"));

  registerOfficeRoutes(app, dependencies);
  registerDistributionRoutes(app, dependencies);
  registerCommandCenterRoutes(app, dependencies);

  // Official @supabase/server integration (RLS-scoped + admin clients), isolated
  // under /supabase so it does not affect the existing eof/erh/cc auth surfaces.
  app.route("/supabase", createSupabaseRouter());

  return app;
}

export function createFixtureApiService(): Hono<ApiAuthBindings> {
  return createApiService({
    fixtures: createFixtureStore(),
    persistence: createMemoryPersistenceRuntime({ WRITES_ENABLED: "false" }),
    health: null,
    nowIso: (): string => "2026-06-21T00:00:00.000Z",
    auth: createFixtureAuthVerifier()
  });
}

function createFixtureAuthVerifier(): SupabaseJwtVerifier {
  return {
    verify: async (token: string): Promise<AuthenticatedApiUser> => {
      if (token !== "fixture-valid-token") {
        throw new Error("Fixture API auth token is invalid. Expected token=fixture-valid-token.");
      }

      return {
        userId: "user_fixture",
        email: "fixture@eeee.mu",
        role: "administrator",
        workspaceId: "eeee-mu"
      };
    }
  };
}

function registerOfficeRoutes(app: Hono<ApiAuthBindings>, dependencies: ApiServiceDependencies): void {
  app.get("/eof/v1/dashboard", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    const workspaceId = resolveWorkspaceId(context);
    const filters = rangeFiltersFromContext(context, period, null);
    const monthlyRows = readMonthlyPnl(dependencies.fixtures.office, filters);
    const runwayWindowMonths = filterRunwayWindowMonths(monthlyRows, ["2026-02"]);
    const dashboard = readOfficeDashboardFull(dependencies.fixtures.office, period, filters, runwayWindowMonths);
    const recentImports = dependencies.fixtures.office.bankImportBatches.filter((batch) => batch.workspaceId === workspaceId);
    const response: OfficeDashboardResponse = {
      period,
      cashBalanceMicro: dashboard.cashRunway.cashBalanceMur,
      receivablesMicro: dashboard.pnl.income,
      payablesMicro: dashboard.pnl.expense,
      unreconciledTransactionCount: dashboard.bankQuality.unmatchedLineCount,
      previous: readOfficeDashboardPrevious(dependencies, filters),
      lastAuditEventId: dependencies.fixtures.officeAuditLog[0]?.id ?? null,
      recentImports: recentImports.map((batch) => ({
        id: batch.id,
        source: batch.source,
        fileName: `${batch.source}-${batch.id}.csv`,
        importedAt: batch.importedAt ?? dependencies.nowIso(),
        periodLabel: formatPeriodLabel(batch.periodStart, batch.periodEnd),
        acceptedRowCount: batch.acceptedRowCount,
        rejectedRowCount: batch.rejectedRowCount,
        duplicateRowCount: batch.duplicateRowCount,
        status: batch.status === "void" ? "failed" : batch.status
      }))
    };

    return context.json(response);
  });

  app.get("/eof/v1/analytics/dashboard", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    const workspaceId = resolveWorkspaceId(context);
    const filters = rangeFiltersFromContext(context, period, null);
    return context.json(readOfficeDashboardAnalytics(dependencies, workspaceId, period, filters));
  });

  app.get("/eof/v1/pl/global", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const response = toOfficeGlobalPnl(dependencies.fixtures.office, period, rangeFiltersFromContext(context, period, null));
    return context.json(response);
  });

  app.get("/eof/v1/pl/department/:departmentId", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const departmentId = context.req.param("departmentId");
    const response = toOfficeDepartmentPnl(dependencies.fixtures.office, departmentId, period, rangeFiltersFromContext(context, period, departmentId));
    return context.json(response);
  });

  app.get("/eof/v1/pl/division", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const divisions = readPnlByDivision(dependencies.fixtures.office, rangeFiltersFromContext(context, period, null)).map(toApiDivisionPnl);
    return context.json(pageItems(context, divisions));
  });

  app.get("/eof/v1/pl/category", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const departmentId = nullableQuery(context, "departmentId");
    const filters = rangeFiltersFromContext(context, period, departmentId);
    return context.json(pageItems(context, toOfficeCategoryPnlLines(dependencies.fixtures.office, filters)));
  });

  app.get("/eof/v1/transactions", (context) => {
    resolveWorkspaceId(context);
    const transactions = dependencies.fixtures.office.transactions
      .map((transaction) => toOfficeTransaction(dependencies.fixtures.office, transaction))
      .filter((transaction) => matchesOfficeTransactionQuery(context, transaction));
    return context.json(pageItems(context, transactions));
  });

  app.post("/eof/v1/transactions", async (context) => {
    return officeTransactionCreateResponse(context, dependencies);
  });

  app.patch("/eof/v1/transactions/:transactionId", async (context) => {
    return officeTransactionUpdateResponse(context, dependencies);
  });

  app.patch("/eof/v1/transactions/:transactionId/validate", async (context) => {
    return officeTransactionValidateResponse(context, dependencies);
  });

  app.patch("/eof/v1/transactions/:transactionId/cancel", async (context) => {
    return officeTransactionCancelResponse(context, dependencies);
  });

  app.get("/eof/v1/plan-comptable", (context) => {
    resolveWorkspaceId(context);
    const includeInactive = queryBoolean(context, "includeInactive", "include_inactive");
    return context.json(toPlanComptableNodes(dependencies.fixtures.office, includeInactive));
  });

  app.get("/eof/v1/plan-comptable/nodes", (context) => {
    resolveWorkspaceId(context);
    const includeInactive = queryBoolean(context, "includeInactive", "include_inactive");
    const nodes = toPlanComptableNodes(dependencies.fixtures.office, includeInactive);
    return context.json(pageItems(context, nodes));
  });

  app.post("/eof/v1/plan-comptable", async (context) => {
    return officePlanComptableCreateResponse(context, dependencies);
  });

  app.patch("/eof/v1/plan-comptable/:nodeId", async (context) => {
    return officePlanComptableUpdateResponse(context, dependencies);
  });

  app.delete("/eof/v1/plan-comptable/:nodeId", async (context) => {
    return officePlanComptableDeleteResponse(context, dependencies);
  });

  app.post("/eof/v1/bank-import/preview", async (context) => {
    return officeBankImportPreviewResponse(context, dependencies);
  });

  app.post("/eof/v1/bank-import/parse-preview", async (context) => {
    return officeBankImportParsePreviewResponse(context, dependencies);
  });

  app.post("/eof/v1/bank-import/confirm", async (context) => {
    return officeBankImportConfirmResponse(context, dependencies);
  });

  app.post("/eof/v1/bank-import/batches/:batchId/reverse", async (context) => {
    return officeBankImportReverseResponse(context, dependencies);
  });

  app.post("/eof/v1/bank-import/batches/:batchId/delete", async (context) => {
    return officeBankImportDeleteResponse(context, dependencies);
  });

  app.post("/eof/v1/office/reset-financial-data", async (context) => {
    return officeFinancialResetResponse(context, dependencies);
  });

  app.get("/eof/v1/reconciliations", (context) => {
    const workspaceId = resolveWorkspaceId(context);
    return context.json(pageItems(context, toReconciliationCandidates(dependencies.fixtures.office).filter((candidate) => {
      return isReconciliationCandidateInWorkspace(dependencies.fixtures.office, candidate, workspaceId)
        && matchesReconciliationQuery(context, candidate);
    })));
  });

  app.get("/eof/v1/reconciliations/operations", (context) => {
    const workspaceId = resolveWorkspaceId(context);
    const period = nullableQuery(context, "period");
    const dateFrom = nullableQuery(context, "dateFrom");
    const dateTo = nullableQuery(context, "dateTo");
    const accountId = nullableQuery(context, "accountId");
    return context.json(
      readOfficeReconciliationOperations(
        dependencies.fixtures.office,
        workspaceId,
        accountId,
        period,
        dateFrom,
        dateTo,
        dependencies.nowIso()
      )
    );
  });

  app.post("/eof/v1/reconciliations/approve", async (context) => {
    return officeReconciliationApproveResponse(context, dependencies);
  });

  app.post("/eof/v1/reconciliations/approve-suggested", async (context) => {
    return officeReconciliationApproveSuggestedResponse(context, dependencies);
  });

  app.post("/eof/v1/reconciliations/match", async (context) => {
    return officeReconciliationMatchResponse(context, dependencies);
  });

  app.post("/eof/v1/reconciliations/unmatch", async (context) => {
    return officeReconciliationUnmatchResponse(context, dependencies);
  });

  app.post("/eof/v1/reconciliations/reject", async (context) => {
    return officeReconciliationRejectResponse(context, dependencies);
  });

  app.post("/eof/v1/reconciliations/ignore", async (context) => {
    return officeReconciliationIgnoreResponse(context, dependencies);
  });

  app.post("/eof/v1/reconciliations/create-transaction", async (context) => {
    return officeReconciliationCreateTransactionResponse(context, dependencies);
  });

  app.get("/eof/v1/cashflow", (context) => {
    const from = requireCompatQuery(context, ["from", "fromDate"], "from");
    const to = requireCompatQuery(context, ["to", "toDate"], "to");
    resolveWorkspaceId(context);
    const accountId = nullableQuery(context, "accountId");
    const buckets = readOfficeCashflowProjection(dependencies.fixtures.office, from, to, accountId);
    return context.json(toCashflowBuckets(buckets));
  });

  app.post("/eof/v1/cashflow/preview", async (context) => {
    return officeCashflowPreviewResponse(context);
  });

  app.post("/eof/v1/cashflow/confirm", async (context) => {
    return officeCashflowConfirmResponse(context, dependencies);
  });

  app.post("/eof/v1/transactions/bulk-preview", async (context) => {
    return officeLedgerBulkPreviewResponse(context, dependencies);
  });

  app.post("/eof/v1/transactions/bulk-confirm", async (context) => {
    return officeLedgerBulkConfirmResponse(context, dependencies);
  });

  // Backward-compatible aliases: keep both route families pointing to the same
  // handlers so existing callers can migrate without behavior drift.
  app.post("/eof/v1/transactions/bulk-upsert/preview", async (context) => {
    return officeLedgerBulkPreviewResponse(context, dependencies);
  });

  app.post("/eof/v1/transactions/bulk-upsert/confirm", async (context) => {
    return officeLedgerBulkConfirmResponse(context, dependencies);
  });

  // Office-scoped write-gate read: the office role is (correctly) 403 on cc/v1 since the domain-authz
  // fix, so the Office UI must read writesEnabled from here — not from cc/v1/status.
  app.get("/eof/v1/status", (context) => {
    resolveWorkspaceId(context);
    return context.json({ writesEnabled: dependencies.persistence.writesEnabled });
  });

  // Screen bundle: one round trip for the Office console's initial/period-scoped load.
  // The browser previously fired ~11 parallel requests, each paying the client→server
  // network RTT; this endpoint fans out INTERNALLY to the existing routes (full reuse of
  // their auth, filtering, and shaping logic — zero duplicated business logic) and returns
  // the keyed results in a single response. Reads are in-memory, so the fan-out is ~free.
  app.get("/eof/v1/screen/office", async (context) => {
    const workspaceId = resolveWorkspaceId(context);
    const period = requireCompatQuery(context, ["period", "month"], "period");
    const dateFrom = requireCompatQuery(context, ["dateFrom", "from"], "dateFrom");
    const dateTo = requireCompatQuery(context, ["dateTo", "to"], "dateTo");
    const base = `workspaceId=${encodeURIComponent(workspaceId)}`;
    const range = `dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;
    const scoped = `${base}&period=${encodeURIComponent(period)}&${range}`;
    const subRequests: Readonly<Record<string, string>> = {
      status: `/eof/v1/status?${base}`,
      dashboard: `/eof/v1/dashboard?${scoped}`,
      globalPnl: `/eof/v1/pl/global?${scoped}`,
      divisionPnl: `/eof/v1/pl/division?${scoped}&limit=100`,
      planComptable: `/eof/v1/plan-comptable?${base}&includeInactive=true`,
      transactions: `/eof/v1/transactions?${scoped}&limit=100`,
      pendingTransactions: `/eof/v1/transactions?${scoped}&status=pending&limit=100`,
      reconciliations: `/eof/v1/reconciliations?${scoped}&status=unmatched&limit=100`,
      cashflow: `/eof/v1/cashflow?${base}&from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}`,
      auditLog: `/eof/v1/audit-log?${base}&from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}&limit=100`,
      bankAccounts: `/eof/v1/bank/accounts?${base}&limit=100`
    };
    const headers: Readonly<Record<string, string>> = {
      Authorization: context.req.header("Authorization") ?? ""
    };
    const entries = await Promise.all(
      Object.entries(subRequests).map(async ([key, path]): Promise<readonly [string, unknown]> => {
        const response = await app.request(path, { headers });
        if (!response.ok) {
          throw new ApiRouteError(500, "screen_subrequest_failed", "A screen bundle sub-request failed.", [
            `key=${key}`,
            `path=${path}`,
            `status=${String(response.status)}`
          ]);
        }
        return [key, await response.json()] as const;
      })
    );
    return context.json(Object.fromEntries(entries));
  });

  app.get("/eof/v1/audit-log", (context) => {
    resolveWorkspaceId(context);
    return context.json(pageItems(context, dependencies.fixtures.officeAuditLog.filter((entry) => matchesAuditQuery(context, entry))));
  });

  app.get("/eof/v1/partners", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    const facet = requirePartnerFacet(context);
    resolveWorkspaceId(context);
    const filters = rangeFiltersFromContext(context, period, null);
    const partners = dependencies.fixtures.office.partners
      .map((partner) => toPartnerListItem(dependencies.fixtures, partner, filters))
      .filter((partner) => hasFacetActivity(partner, facet));
    return context.json(pageItems(context, partners));
  });

  app.get("/eof/v1/partners/:partnerId", (context) => {
    resolveWorkspaceId(context);
    const partner = requirePartner(dependencies.fixtures.office, context.req.param("partnerId"));
    return context.json({
      id: partner.id,
      name: partner.name,
      status: partner.isActive ? "active" : "inactive",
      email: null,
      phone: null,
      address: null,
      taxId: null,
      notes: null
    });
  });

  app.get("/eof/v1/pl/partner/:partnerId", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const partner = requirePartner(dependencies.fixtures.office, context.req.param("partnerId"));
    const response = toPartnerDetail(dependencies.fixtures, partner, period, rangeFiltersFromContext(context, period, null));
    return context.json(response);
  });

  app.get("/eof/v1/classification/suggestions/:partnerId", (context) => {
    resolveWorkspaceId(context);
    return context.json(dependencies.fixtures.officeClassificationSuggestions[context.req.param("partnerId")] ?? []);
  });

  app.get("/eof/v1/partners/:partnerId/payee-link", (context) => {
    resolveWorkspaceId(context);
    const partner = requirePartner(dependencies.fixtures.office, context.req.param("partnerId"));
    return context.json(toPartnerPayeeLink(dependencies.fixtures, partner));
  });

  app.post("/eof/v1/partners", async (context) => {
    return officePartnerCreateResponse(context, dependencies);
  });

  app.patch("/eof/v1/partners/:partnerId", async (context) => {
    return officePartnerUpdateResponse(context, dependencies);
  });

  app.post("/eof/v1/partners/:partnerId/payee-link", async (context) => {
    return officePartnerPayeeLinkResponse(context, dependencies);
  });

  app.patch("/eof/v1/partners/:partnerId/payee-link", async (context) => {
    return officePartnerPayeeUnlinkResponse(context, dependencies);
  });

  app.get("/eof/v1/bank/accounts", (context) => {
    const workspaceId = resolveWorkspaceId(context);
    const latestLineByAccount = latestBankLineByAccount(dependencies.fixtures.office.bankStatementLines);
    const derivedSnapshotByAccount = derivedBankSnapshotByAccount(dependencies.fixtures.office.bankStatementLines);
    const accounts = dependencies.fixtures.office.bankAccounts
      .filter((account) => account.workspaceId === workspaceId)
      .map((account) =>
        toApiBankAccountSummary(
          resolveBankAccountSnapshot(account, latestLineByAccount.get(account.id), derivedSnapshotByAccount.get(account.id))
        )
      );
    const page = pageItems(context, accounts);
    return context.json(page);
  });

  app.post("/eof/v1/bank/accounts", async (context) => {
    return officeBankAccountCreateResponse(context, dependencies);
  });

  app.patch("/eof/v1/bank/accounts/:accountId", async (context) => {
    return officeBankAccountUpdateResponse(context, dependencies);
  });

  app.delete("/eof/v1/bank/accounts/:accountId", async (context) => {
    return officeBankAccountDeleteResponse(context, dependencies);
  });

  app.get("/eof/v1/bank/raw", (context) => {
    const workspaceId = resolveWorkspaceId(context);
    const period = optionalCompatQuery(context, ["period", "month"]);
    const dateFrom = optionalCompatQuery(context, ["dateFrom", "date_from", "from", "fromDate", "from_date"]);
    const dateTo = optionalCompatQuery(context, ["dateTo", "date_to", "to", "toDate", "to_date"]);
    const accountId = optionalCompatQuery(context, ["accountId", "account_id"]);
    // Derive workspaceId from the account (always loaded, always has workspace_id)
    // rather than from the batch (can be missing if a batch failed to commit or was
    // voided). Using the batch caused lines to silently disappear between reads.
    const accountWorkspaceMap = new Map<string, string>(
      dependencies.fixtures.office.bankAccounts.map((acc) => [acc.id, acc.workspaceId])
    );
    const lines = dependencies.fixtures.office.bankStatementLines
      .filter((line) => (accountWorkspaceMap.get(line.accountId) ?? "unknown") === workspaceId)
      .map((line) => toApiBankRawLine(line, new Map([[line.importBatchId, workspaceId]])))
      .filter((line) => {
        if (isIsoDate(dateFrom) && isIsoDate(dateTo)) {
          return !(line.occurredOn < dateFrom || line.occurredOn > dateTo);
        }

        return period === null || line.occurredOn.startsWith(period);
      })
      .filter((line) => accountId === null || line.accountId === accountId);
    return context.json(pageItems(context, lines));
  });

  app.post("/eof/v1/bank/raw/reassign-account", async (context) => {
    return officeBankRawLineReassignResponse(context, dependencies);
  });

  app.get("/eof/v1/projects", (context) => {
    resolveWorkspaceId(context);
    const period = optionalCompatQuery(context, ["period", "month"]);
    const dateFrom = optionalCompatQuery(context, ["dateFrom", "date_from", "from", "fromDate", "from_date"]);
    const dateTo = optionalCompatQuery(context, ["dateTo", "date_to", "to", "toDate", "to_date"]);
    const filters =
      period === null && !(isIsoDate(dateFrom) && isIsoDate(dateTo))
        ? { dateFrom: null, dateTo: null, departmentId: null }
        : rangeFiltersFromContext(context, period ?? dependencies.nowIso().slice(0, 7), null);
    const status = nullableQuery(context, "status");
    const projects = dependencies.fixtures.office.projects
      .map((project) => toProjectSummary(dependencies.fixtures.office, project, filters))
      .filter((project) => status === null || project.status === status);
    return context.json(pageItems(context, projects));
  });

  app.post("/eof/v1/projects", async (context) => {
    return officeProjectCreateResponse(context, dependencies);
  });

  app.patch("/eof/v1/projects/:projectId", async (context) => {
    return officeProjectUpdateResponse(context, dependencies);
  });

  app.get("/eof/v1/projects/:projectId/coherence-violations", (context) => {
    resolveWorkspaceId(context);
    const violations = dependencies.fixtures.officeProjectViolations[context.req.param("projectId")] ?? [];
    return context.json(pageItems(context, violations));
  });

  app.get("/eof/v1/pl/project/:projectId", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    return context.json(toProjectPnl(dependencies.fixtures.office, context.req.param("projectId"), period, rangeFiltersFromContext(context, period, null)));
  });

  app.get("/eof/v1/integrity/check-all", (context) => {
    resolveWorkspaceId(context);
    return context.json(toOfficeIntegrity(dependencies.fixtures.office, dependencies.nowIso()));
  });

  app.get("/eof/v1/analytics/bank-quality", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const filters = rangeFiltersFromContext(context, period, null);
    const result = readOfficeBankQualityForFilters(dependencies.fixtures.office, period, filters);
    const response: OfficeBankQualityResponse = {
      period: result.period,
      matchedRateBp: result.matchedRateBp,
      unmatchedLineCount: result.unmatchedLineCount,
      duplicateCandidateCount: result.duplicateCandidateCount,
      missingReferenceCount: result.missingReferenceCount,
      staleImportCount: result.staleImportCount,
      lastImportAt: result.lastImportAt
    };
    return context.json(response);
  });

  app.get("/eof/v1/vat", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    return context.json(toOfficeVatReport(dependencies.fixtures.office, period));
  });
}

function filterRunwayWindowMonths(
  monthlyRows: readonly OfficePnlMonthlyRow[],
  runwayWindowMonths: readonly string[]
): readonly string[] {
  const availableMonths = new Set<string>(monthlyRows.map((row) => row.month));
  return runwayWindowMonths.filter((month) => availableMonths.has(month));
}

function registerDistributionRoutes(app: Hono<ApiAuthBindings>, dependencies: ApiServiceDependencies): void {
  app.get("/erh/v1/screen", (context) => {
    const period = requireQuery(context, "period");
    requireQuery(context, "workspaceId");
    const source = nullableQuery(context, "importSource");
    const importStatus = nullableQuery(context, "importStatus");
    const mappingStatus = nullableQuery(context, "mappingStatus") ?? "unmapped";
    const suspenseStatus = nullableQuery(context, "suspenseStatus") ?? "open";
    const paymentStatus = nullableQuery(context, "paymentStatus");
    const revenueGroupBy = nullableQuery(context, "revenueGroupBy") ?? "store";

    const importBatches = dependencies.fixtures.distribution.importBatches
      .map((batch) => toDistributionImportBatch(dependencies.fixtures.distribution, batch.id))
      .filter((batch) => source === null || batch.source === source)
      .filter((batch) => importStatus === null || batch.status === importStatus);
    const mappingRows = dependencies.fixtures.distributionMappingRows.filter(
      (row) => mappingStatus === null || row.status === mappingStatus
    );
    const payees: readonly PayeeSummary[] = dependencies.fixtures.distribution.payees.map((payee) => ({
      id: payee.id,
      displayName: payee.name,
      email: null,
      status: payee.isActive ? "active" : "inactive",
      defaultCurrency: payee.preferredCurrency
    }));
    const releases = toReleaseSummaries(dependencies.fixtures.distribution);
    const tracks: readonly TrackSummary[] = dependencies.fixtures.distribution.tracks.map((track) => ({
      id: track.id,
      releaseId: track.releaseId,
      title: track.title,
      artistName: "Kaya",
      isrc: track.isrc,
      status: "released",
      splitStatus: "balanced",
      contributorCount: 1
    }));
    const contracts = dependencies.fixtures.distributionContracts;
    const firstContract = contracts[0];
    const expenses = dependencies.fixtures.distributionContractExpenses.filter(
      (expense) => expense.contractId === (firstContract?.id ?? "contract_alma")
    );
    const allocations = dependencies.fixtures.distribution.calculationRuns.map((run) =>
      toAllocationRunSummary(dependencies.fixtures.distribution, run)
    );
    const suspense = readSuspense(dependencies.fixtures.distribution, {
      status: toDomainSuspenseStatus(suspenseStatus),
      reasonCode: null
    }).rows.map((row) => toApiSuspenseItem(row, period));
    const statements = readStatementSummaries(dependencies.fixtures.distribution, {
      period: null,
      payeeId: null,
      status: null
    }).rows.map(toApiStatementSummary);
    const payments = toPaymentSummaries(dependencies.fixtures.distribution).filter(
      (payment) => paymentStatus === null || payment.status === paymentStatus
    );
    const response: DistributionScreenResponse = {
      status: { writesEnabled: dependencies.persistence.writesEnabled },
      dashboard: toDistributionDashboard(dependencies.fixtures.distribution, period),
      importBatches: pageItems(context, importBatches),
      mappingRows: pageItems(context, mappingRows),
      payees: {
        items: payees,
        nextCursor: null
      },
      releases: pageItems(context, releases),
      tracks: pageItems(context, tracks),
      contracts: pageItems(context, contracts),
      expenses: pageItems(context, expenses),
      allocations: pageItems(context, allocations),
      suspense: pageItems(context, suspense),
      statements: pageItems(context, statements),
      payments: pageItems(context, payments),
      revenue: pageItems(context, toRevenueRows(dependencies.fixtures.distribution, revenueGroupBy)),
      reconciliation: toDistributionReconciliation(dependencies.fixtures),
      aliases: pageItems(context, toDistributionAliases(dependencies.fixtures)),
      duplicates: pageItems(context, toDistributionDuplicates(dependencies.fixtures)),
      auditLog: pageItems(context, toDistributionAuditLog(dependencies.fixtures)),
      settings: toDistributionSettings(context, dependencies.fixtures, dependencies.persistence.writesEnabled)
    };
    return context.json(response);
  });

  app.get("/erh/v1/dashboard", (context) => {
    const period = requireQuery(context, "period");
    requireQuery(context, "workspaceId");
    return context.json(toDistributionDashboard(dependencies.fixtures.distribution, period));
  });

  app.get("/erh/v1/imports/batches", (context) => {
    requireQuery(context, "workspaceId");
    const source = nullableQuery(context, "source");
    const status = nullableQuery(context, "status");
    const batches = dependencies.fixtures.distribution.importBatches
      .map((batch) => toDistributionImportBatch(dependencies.fixtures.distribution, batch.id))
      .filter((batch) => source === null || batch.source === source)
      .filter((batch) => status === null || batch.status === status);
    return context.json(pageItems(context, batches));
  });

  app.post("/erh/v1/imports/preview", async (context) => {
    return distributionImportPreviewResponse(context, dependencies);
  });

  app.post("/erh/v1/imports/confirm", async (context) => {
    return distributionImportConfirmResponse(context, dependencies);
  });

  app.post("/erh/v1/imports/batches/:batchId/reverse", async (context) => {
    return distributionImportReverseResponse(context, dependencies);
  });

  app.get("/erh/v1/mapping/rows", (context) => {
    requireQuery(context, "workspaceId");
    const batchId = nullableQuery(context, "batchId");
    const status = nullableQuery(context, "status");
    const rows = dependencies.fixtures.distributionMappingRows
      .filter((row) => batchId === null || row.batchId === batchId)
      .filter((row) => status === null || row.status === status);
    return context.json(pageItems(context, rows));
  });

  app.post("/erh/v1/mapping/apply-rules", async (context) => {
    return distributionMappingApplyRulesResponse(context, dependencies);
  });

  app.get("/erh/v1/contracts", (context) => {
    requireQuery(context, "workspaceId");
    const payeeId = nullableQuery(context, "payeeId");
    const status = nullableQuery(context, "status");
    const contracts = dependencies.fixtures.distributionContracts
      .filter((contract) => payeeId === null || contract.payeeId === payeeId)
      .filter((contract) => status === null || contract.status === status);
    return context.json(pageItems(context, contracts));
  });

  app.post("/erh/v1/contracts", async (context) => {
    return distributionContractUpsertResponse(context, dependencies);
  });

  app.get("/erh/v1/contracts/:contractId", (context) => {
    requireQuery(context, "workspaceId");
    const contractId = context.req.param("contractId");
    const contract = dependencies.fixtures.distributionContracts.find((candidate) => candidate.id === contractId);
    if (contract === undefined) {
      throw new ApiRouteError(404, "distribution_contract_not_found", "Distribution contract was not found.", [
        `contractId=${contractId}`
      ]);
    }

    const expenses = dependencies.fixtures.distributionContractExpenses.filter((expense) => expense.contractId === contractId);
    return context.json({
      contract,
      expenses: pageItems(context, expenses)
    });
  });

  app.get("/erh/v1/contracts/:contractId/expenses", (context) => {
    requireQuery(context, "workspaceId");
    const status = nullableQuery(context, "status");
    const contractId = context.req.param("contractId");
    const expenses = dependencies.fixtures.distributionContractExpenses
      .filter((expense) => expense.contractId === contractId)
      .filter((expense) => status === null || expense.status === status);
    return context.json(pageItems(context, expenses));
  });

  app.post("/erh/v1/contracts/:contractId/expenses", async (context) => {
    return distributionContractExpenseCreateResponse(context, dependencies);
  });

  app.patch("/erh/v1/contracts/:contractId/expenses/:expenseId", async (context) => {
    return distributionContractExpenseUpdateResponse(context, dependencies);
  });

  app.post("/erh/v1/contracts/:contractId/rules", async (context) => {
    return distributionContractRulesUpdateResponse(context, dependencies);
  });

  app.get("/erh/v1/payees", (context) => {
    requireQuery(context, "workspaceId");
    const status = nullableQuery(context, "status");
    const payees = dependencies.fixtures.distribution.payees
      .map((payee) => ({
        id: payee.id,
        displayName: payee.name,
        email: null,
        status: payee.isActive ? "active" : "inactive",
        defaultCurrency: payee.preferredCurrency
      }))
      .filter((payee) => status === null || payee.status === status);
    return context.json(pageItems(context, payees));
  });

  app.get("/erh/v1/payees/:payeeId", (context) => {
    requireQuery(context, "workspaceId");
    const payeeId = context.req.param("payeeId");
    const payee = dependencies.fixtures.distribution.payees.find((candidate) => candidate.id === payeeId);
    if (payee === undefined) {
      throw new ApiRouteError(404, "distribution_payee_not_found", "Distribution payee was not found.", [`payeeId=${payeeId}`]);
    }

    return context.json({
      id: payee.id,
      displayName: payee.name,
      email: null,
      status: payee.isActive ? "active" : "inactive",
      defaultCurrency: payee.preferredCurrency
    });
  });

  app.post("/erh/v1/payees", async (context) => {
    return distributionPayeeUpsertResponse(context, dependencies);
  });

  app.get("/erh/v1/releases", (context) => {
    requireQuery(context, "workspaceId");
    const releases = toReleaseSummaries(dependencies.fixtures.distribution);
    return context.json(pageItems(context, releases));
  });

  app.post("/erh/v1/releases", async (context) => {
    return distributionReleaseUpsertResponse(context, dependencies);
  });

  app.get("/erh/v1/tracks", (context) => {
    requireQuery(context, "workspaceId");
    const releaseId = nullableQuery(context, "releaseId");
    const tracks = dependencies.fixtures.distribution.tracks
      .filter((track) => releaseId === null || track.releaseId === releaseId)
      .map((track) => ({
        id: track.id,
        releaseId: track.releaseId,
        title: track.title,
        artistName: "Kaya",
        isrc: track.isrc,
        status: "released",
        splitStatus: "balanced",
        contributorCount: 1
      }));
    return context.json(pageItems(context, tracks));
  });

  app.post("/erh/v1/tracks", async (context) => {
    return distributionTrackUpsertResponse(context, dependencies);
  });

  app.get("/erh/v1/ping", (_context) => {
    return _context.json({ ok: true });
  });

  app.get("/erh/v1/allocations", (context) => {
    resolveWorkspaceId(context);
    const calculationRunId = nullableQuery(context, "runId");
    const payeeId = nullableQuery(context, "payeeId");
    const status = toAllocationStatusFilter(nullableQuery(context, "status"));
    const allocations = readAllocationList(dependencies.fixtures.distribution, {
      calculationRunId,
      payeeId,
      status
    });
    return context.json(pageItems(context, allocations.rows));
  });

  app.get("/erh/v1/allocations-by-currency", (context) => {
    resolveWorkspaceId(context);
    const payeeId = nullableQuery(context, "payeeId");
    const status = toAllocationStatusFilter(nullableQuery(context, "status"));
    const allocations = readAllocationList(dependencies.fixtures.distribution, {
      calculationRunId: null,
      payeeId,
      status
    });
    return context.json(pageItems(context, allocations.totals));
  });

  app.get("/erh/v1/allocations/runs", (context) => {
    requireQuery(context, "workspaceId");
    const status = nullableQuery(context, "status");
    const runs = dependencies.fixtures.distribution.calculationRuns
      .map((run) => toAllocationRunSummary(dependencies.fixtures.distribution, run))
      .filter((run) => status === null || run.status === status);
    return context.json(pageItems(context, runs));
  });

  app.post("/erh/v1/allocations/runs/preview", async (context) => {
    return distributionAllocationPreviewResponse(context, dependencies);
  });

  app.post("/erh/v1/allocations/runs", async (context) => {
    return distributionAllocationRunResponse(context, dependencies);
  });

  app.post("/erh/v1/allocations/runs/:runId/unpost", async (context) => {
    return distributionAllocationUnpostResponse(context, dependencies);
  });

  app.get("/erh/v1/suspense", (context) => {
    requireQuery(context, "workspaceId");
    const period = nullableQuery(context, "period");
    const status = nullableQuery(context, "status");
    const suspense = readSuspense(dependencies.fixtures.distribution, {
      status: toDomainSuspenseStatus(status),
      reasonCode: null
    }).rows.map((row) => toApiSuspenseItem(row, period));
    return context.json(pageItems(context, suspense));
  });

  app.post("/erh/v1/suspense/:suspenseId/resolve", async (context) => {
    return distributionSuspenseResolveResponse(context, dependencies);
  });

  app.get("/erh/v1/statements", (context) => {
    requireQuery(context, "workspaceId");
    const period = nullableQuery(context, "period");
    const payeeId = nullableQuery(context, "payeeId");
    const status = nullableQuery(context, "status");
    const statements = readStatementSummaries(dependencies.fixtures.distribution, {
      period,
      payeeId,
      status: null
    }).rows.map(toApiStatementSummary).filter((statement) => status === null || statement.status === status);
    return context.json(pageItems(context, statements));
  });

  app.get("/erh/v1/statements/:statementId/print", (context) => {
    requireQuery(context, "workspaceId");
    const statementId = context.req.param("statementId");
    const statement = dependencies.fixtures.distribution.statements.find((candidate) => candidate.id === statementId);
    if (statement === undefined) {
      throw new ApiRouteError(404, "distribution_statement_not_found", "Distribution statement was not found.", [
        `statementId=${statementId}`
      ]);
    }

    const payee = dependencies.fixtures.distribution.payees.find((candidate) => candidate.id === statement.payeeId);
    const lines = dependencies.fixtures.distribution.statementLines.filter((line) => line.statementId === statement.id);
    return context.json({
      statement: {
        id: statement.id,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        payeeId: statement.payeeId,
        payeeName: payee?.name ?? statement.payeeId,
        currency: statement.currency,
        grossTotal: statement.grossTotal,
        recoupmentTotal: statement.recoupmentTotal,
        netPayable: statement.netPayable,
        amountDue: statement.amountDue,
        status: statement.status,
        version: statement.version
      },
      lines: lines.map((line) => ({
        id: line.id,
        trackId: line.trackId,
        grossShare: line.grossShare,
        recoupmentApplied: line.recoupmentApplied,
        netPayable: line.netPayable,
        quantity: line.quantity,
        currency: line.currency
      }))
    });
  });

  app.post("/erh/v1/statements/generate", async (context) => {
    return distributionStatementGenerateResponse(context, dependencies);
  });

  app.post("/erh/v1/statements/:statementId/void", async (context) => {
    return distributionStatementVoidResponse(context, dependencies);
  });

  app.get("/erh/v1/payments", (context) => {
    requireQuery(context, "workspaceId");
    const payeeId = nullableQuery(context, "payeeId");
    const status = nullableQuery(context, "status");
    const payments = toPaymentSummaries(dependencies.fixtures.distribution)
      .filter((payment) => payeeId === null || payment.payeeId === payeeId)
      .filter((payment) => status === null || payment.status === status);
    return context.json(pageItems(context, payments));
  });

  app.post("/erh/v1/payments", async (context) => {
    return distributionPaymentRecordResponse(context, dependencies);
  });

  app.patch("/erh/v1/payments/:paymentId", async (context) => {
    return distributionPaymentUpdateResponse(context, dependencies);
  });

  app.post("/erh/v1/payments/:paymentId/reconcile", async (context) => {
    return distributionPaymentReconcileResponse(context, dependencies);
  });

  app.post("/erh/v1/payments/:paymentId/void", async (context) => {
    return distributionPaymentVoidResponse(context, dependencies);
  });

  app.get("/erh/v1/revenue", (context) => {
    requireQuery(context, "workspaceId");
    const groupBy = nullableQuery(context, "groupBy") ?? "payee";
    const rows = toRevenueRows(dependencies.fixtures.distribution, groupBy);
    return context.json(pageItems(context, rows));
  });

  app.get("/erh/v1/fx-rates", (context) => {
    resolveWorkspaceId(context);
    const fromCurrency = nullableQuery(context, "fromCurrency");
    const toCurrency = nullableQuery(context, "toCurrency");
    const effectiveDate = nullableQuery(context, "effectiveDate");
    const rates = dependencies.fixtures.distributionFxRates
      .filter((rate) => fromCurrency === null || rate.fromCurrency === fromCurrency)
      .filter((rate) => toCurrency === null || rate.toCurrency === toCurrency)
      .filter((rate) => effectiveDate === null || rate.effectiveDate === effectiveDate);
    return context.json(pageItems(context, rates));
  });

  app.post("/erh/v1/fx-rates", async (context) => {
    return distributionFxRatesSaveResponse(context, dependencies);
  });

  app.get("/erh/v1/payees/:payeeId/partner-link", (context) => {
    resolveWorkspaceId(context);
    const payeeId = context.req.param("payeeId");
    const payee = requireDistributionPayee(dependencies.fixtures.distribution, payeeId);
    return context.json(toDistributionPayeePartnerLink(dependencies.fixtures, payee));
  });

  app.post("/erh/v1/payees/:payeeId/partner-link", async (context) => {
    return distributionPayeePartnerLinkResponse(context, dependencies);
  });

  app.get("/erh/v1/financial-reconciliation", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(toDistributionReconciliation(dependencies.fixtures));
  });

  app.get("/erh/v1/aliases", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(pageItems(context, toDistributionAliases(dependencies.fixtures)));
  });

  app.get("/erh/v1/duplicates", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(pageItems(context, toDistributionDuplicates(dependencies.fixtures)));
  });

  app.get("/erh/v1/audit-log", (context) => {
    requireQuery(context, "workspaceId");
    return context.json(pageItems(context, toDistributionAuditLog(dependencies.fixtures)));
  });

  // Distribution-scoped write-gate read (same reason as eof/v1/status: the distribution role is
  // 403 on cc/v1 since the domain-authz fix, so it must not read writesEnabled from cc/v1/status).
  app.get("/erh/v1/status", (context) => {
    requireQuery(context, "workspaceId");
    return context.json({ writesEnabled: dependencies.persistence.writesEnabled });
  });

  app.get("/erh/v1/settings", (context) => {
    requireQuery(context, "workspaceId");
    assertNonBotRouteAccess(context, "distribution_settings_read");
    return context.json(toDistributionSettings(context, dependencies.fixtures, dependencies.persistence.writesEnabled));
  });
}

function registerCommandCenterRoutes(app: Hono<ApiAuthBindings>, dependencies: ApiServiceDependencies): void {
  app.get("/cc/v1/overview", async (context) => {
    const workspaceId = resolveWorkspaceId(context);
    assertNonBotRouteAccess(context, "command_center_overview_read");
    return context.json(
      await toCommandCenterOverview(
        context,
        dependencies.fixtures,
        dependencies.persistence,
        workspaceId,
        dependencies.persistence.writesEnabled,
        dependencies.nowIso()
      )
    );
  });

  app.get("/cc/v1/status", (context) => {
    resolveWorkspaceId(context);
    assertNonBotRouteAccess(context, "command_center_status_read");
    return context.json({
      writesEnabled: dependencies.persistence.writesEnabled
    });
  });

  app.get("/cc/v1/notifications", (context) => {
    const workspaceId = resolveWorkspaceId(context);
    assertNonBotRouteAccess(context, "command_center_notifications_read");
    return context.json(
      toCommandCenterNotifications(
        context,
        dependencies.fixtures,
        workspaceId,
        dependencies.persistence.writesEnabled,
        dependencies.nowIso()
      )
    );
  });

  app.post("/cc/v1/settings", async (context) => {
    return commandCenterSettingUpdateResponse(context, dependencies);
  });

  app.post("/cc/v1/integrations/:integrationId/toggle", async (context) => {
    return commandCenterIntegrationToggleResponse(context, dependencies);
  });

  app.post("/cc/v1/users/:userId/permissions", async (context) => {
    return commandCenterUserPermissionUpdateResponse(context, dependencies);
  });
}

function createErrorPayload(code: string, message: string, context: readonly string[]): ApiErrorPayload {
  return {
    error: {
      code,
      message,
      context
    }
  };
}

function requireQuery(context: ApiContext, key: string): string {
  const value = context.req.query(key);
  if (value === undefined || value.trim().length === 0) {
    throw new ApiRouteError(400, "query_required", "A required query parameter is missing.", [
      `path=${context.req.path}`,
      `key=${key}`
    ]);
  }

  return value;
}

function assertNonBotRouteAccess(context: ApiContext, action: string): void {
  const authUser = context.get("authUser");
  if (!isBotApiUser(authUser)) {
    return;
  }

  throw new ApiRouteError(403, "bot_route_denied", "Bot roles cannot access settings, maintenance, or unrestricted administrative routes.", [
    `action=${action}`,
    `path=${context.req.path}`,
    `actorRole=${authUser.role}`,
    `actorUserId=${authUser.userId}`
  ]);
}

function requirePathParam(context: ApiContext, key: string): string {
  const value = context.req.param(key);
  if (value === undefined || value.trim().length === 0) {
    throw new ApiRouteError(400, "path_param_required", "A required path parameter is missing.", [
      `path=${context.req.path}`,
      `key=${key}`
    ]);
  }

  return value;
}

function assertPathBodyMatch(context: ApiContext, key: string, pathValue: string, bodyValue: string): void {
  if (pathValue === bodyValue) {
    return;
  }

  throw new ApiRouteError(400, "path_body_mismatch", "Path parameter and request body value must match.", [
    `path=${context.req.path}`,
    `key=${key}`,
    `pathValue=${pathValue}`,
    `bodyValue=${bodyValue}`
  ]);
}

function nullableQuery(context: ApiContext, key: string): string | null {
  const value = context.req.query(key);
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  return value;
}

function queryBoolean(context: ApiContext, key: string, legacyKey?: string): boolean {
  const aliases = legacyKey === undefined ? [key] : [key, legacyKey];
  const value = optionalCompatQuery(context, aliases);
  if (value === null) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "off" || normalized === "no") {
    return false;
  }

  throw new ApiRouteError(400, "query_boolean_invalid", "Boolean query parameter is invalid.", [
    `path=${context.req.path}`,
    `key=${key}`,
    `value=${value}`
  ]);
}

function requireCompatQuery(context: ApiContext, keys: readonly string[], keyForError: string): string {
  const resolved = optionalCompatQuery(context, keys);
  if (resolved === null) {
    throw new ApiRouteError(400, "query_required", "A required query parameter is missing.", [
      `path=${context.req.path}`,
      `key=${keyForError}`,
      `aliases=${keys.join(",")}`
    ]);
  }

  return resolved;
}

function optionalCompatQuery(context: ApiContext, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = context.req.query(key);
    if (value !== undefined && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function resolveWorkspaceId(context: ApiContext): string {
  const workspaceId = optionalCompatQuery(context, ["workspaceId", "workspace_id"]);
  if (workspaceId === null || workspaceId === "office") {
    return DEFAULT_WORKSPACE_ID;
  }

  return workspaceId;
}

function requireIdempotencyKey(context: ApiContext): string {
  const value = context.req.header("Idempotency-Key");
  if (value === undefined || value.trim().length === 0) {
    throw new ApiRouteError(400, "idempotency_key_required", "Write routes require a non-empty Idempotency-Key header.", [
      `method=${context.req.method}`,
      `path=${context.req.path}`
    ]);
  }

  return value;
}

async function readJsonBody<TBody>(context: ApiContext): Promise<TBody> {
  try {
    return await context.req.json<TBody>();
  } catch (error: unknown) {
    throw new ApiRouteError(400, "json_body_invalid", "Request body must be valid JSON.", [
      `path=${context.req.path}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
}

async function readZodBody<TBody>(context: ApiContext, schema: z.ZodType<TBody>): Promise<TBody> {
  const body = await readJsonBody<unknown>(context);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiRouteError(400, "body_schema_invalid", "Request body failed validation.", [
      `path=${context.req.path}`,
      `issues=${parsed.error.issues.map((issue: z.ZodIssue): string => `${issue.path.join(".")}:${issue.message}`).join("; ")}`
    ]);
  }

  return parsed.data;
}

async function officeTransactionCreateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeTransactionWriteRequest>(context, officeTransactionWriteSchema);
  const amountMinor = normalizeEofAmountField(context, request.amountMicro, "amountMicro");
  const transactionId = randomUUID();
  const transactionType = request.type ?? "expense";
  const transactionStatus: OfficeTransactionRow["status"] = request.categoryId === null ? "draft" : "validated";
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_transaction_create",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await persistOfficeTransactionUpsert(tx, {
        id: transactionId,
        request,
        amountMinor,
        transactionType,
        transactionStatus,
        actorUserId: actor.userId,
        isUpdate: false
      });
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_transaction_create",
        targetType: "office_transaction",
        targetId: transactionId,
        before: {},
        after: {
          transactionId,
          request,
          transactionType,
          transactionStatus,
          amountMinor: amountMinor.toString()
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeTransactionFixture(dependencies.fixtures, transactionFromOfficeRequest(transactionId, request, amountMinor, transactionType, transactionStatus));
      return mutationReceipt(transactionId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeTransactionUpdateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const transactionId = requirePathParam(context, "transactionId");
  const request = await readZodBody<OfficeTransactionWriteRequest>(context, officeTransactionWriteSchema);
  const before = requireOfficeTransaction(dependencies.fixtures.office, transactionId);
  const amountMinor = normalizeEofAmountField(context, request.amountMicro, "amountMicro");
  // Classification must never flip income/expense: keep the stored type unless
  // the caller explicitly asks to change it.
  const transactionType = request.type ?? before.type;
  const transactionStatus: OfficeTransactionRow["status"] = request.categoryId === null ? "draft" : "validated";
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_transaction_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:transaction:${transactionId}`);
      await persistOfficeTransactionUpsert(tx, {
        id: transactionId,
        request,
        amountMinor,
        transactionType,
        transactionStatus,
        actorUserId: actor.userId,
        isUpdate: true
      });
      const after = transactionFromOfficeRequest(transactionId, request, amountMinor, transactionType, transactionStatus);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_transaction_update",
        targetType: "office_transaction",
        targetId: transactionId,
        before: { transaction: officeTransactionAuditSnapshot(before) },
        after: { transaction: officeTransactionAuditSnapshot(after) },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeTransactionFixture(dependencies.fixtures, after);
      return mutationReceipt(transactionId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeTransactionValidateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const transactionId = requirePathParam(context, "transactionId");
  const request = await readZodBody<WorkspaceBodyRequest>(context, workspaceBodySchema);
  const before = requireOfficeTransaction(dependencies.fixtures.office, transactionId);
  if (before.categoryId === null) {
    throw new ApiRouteError(422, "office_transaction_category_required", "A transaction must be classified before validation.", [
      `transactionId=${transactionId}`
    ]);
  }

  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_transaction_validate",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:transaction:${transactionId}`);
      await persistOfficeTransactionValidation(tx, transactionId, actor.userId);
      const after: OfficeTransactionRow = {
        ...before,
        status: "validated"
      };
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_transaction_validate",
        targetType: "office_transaction",
        targetId: transactionId,
        before: { transaction: officeTransactionAuditSnapshot(before) },
        after: { transaction: officeTransactionAuditSnapshot(after) },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeTransactionFixture(dependencies.fixtures, after);
      return mutationReceipt(transactionId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

// Soft-delete: an erroneous transaction is moved to "cancelled" (kept for audit, excluded
// from every P&L/stat since those count only "validated") rather than hard-deleted.
async function officeTransactionCancelResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const transactionId = requirePathParam(context, "transactionId");
  const request = await readZodBody<WorkspaceBodyRequest>(context, workspaceBodySchema);
  const before = requireOfficeTransaction(dependencies.fixtures.office, transactionId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_transaction_cancel",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:transaction:${transactionId}`);
      await persistOfficeTransactionCancellation(tx, transactionId);
      const after: OfficeTransactionRow = {
        ...before,
        status: "cancelled"
      };
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_transaction_cancel",
        targetType: "office_transaction",
        targetId: transactionId,
        before: { transaction: officeTransactionAuditSnapshot(before) },
        after: { transaction: officeTransactionAuditSnapshot(after) },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeTransactionFixture(dependencies.fixtures, after);
      return mutationReceipt(transactionId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officePlanComptableCreateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficePlanComptableWriteRequest>(context, officePlanComptableWriteSchema);
  assertPlanComptableRequest(context, dependencies.fixtures.office, request);
  const nodeId = randomUUID();
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_plan_comptable_create",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await persistOfficePlanComptableCreate(tx, nodeId, request);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_plan_comptable_create",
        targetType: "office_chart_node",
        targetId: nodeId,
        before: {},
        after: { nodeId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficePlanComptableFixture(dependencies.fixtures, nodeId, request);
      return mutationReceipt(nodeId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officePlanComptableUpdateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const nodeId = requirePathParam(context, "nodeId");
  const request = await readZodBody<OfficePlanComptableWriteRequest>(context, officePlanComptableWriteSchema);
  const before = requirePlanComptableNode(dependencies.fixtures.office, nodeId);
  assertPlanComptableRequest(context, dependencies.fixtures.office, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_plan_comptable_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:plan-comptable:${nodeId}`);
      await persistOfficePlanComptableUpdate(tx, nodeId, request);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_plan_comptable_update",
        targetType: "office_chart_node",
        targetId: nodeId,
        before: { node: before },
        after: { nodeId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficePlanComptableFixture(dependencies.fixtures, nodeId, request);
      return mutationReceipt(nodeId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officePlanComptableDeleteResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const nodeId = requirePathParam(context, "nodeId");
  const request = await readZodBody<OfficePlanComptableDeleteRequest>(context, workspaceBodySchema);
  const before = requirePlanComptableNode(dependencies.fixtures.office, nodeId);
  const fixtureCounts = countOfficePlanComptableFixtureDependencies(dependencies.fixtures.office, nodeId, before.kind);
  assertPlanComptableDeleteAllowed(context, before, fixtureCounts);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_plan_comptable_delete",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:plan-comptable:${nodeId}`);
      const deletedCounts = await persistOfficePlanComptableDelete(tx, nodeId, before.kind);
      if (tx.kind !== "memory" && deletedCounts.nodeCount !== 1) {
        if (hasPlanComptableDeleteDependencies(before.kind, deletedCounts)) {
          throw planComptableDeleteBlockedError(context, before, deletedCounts);
        }

        throw new ApiRouteError(404, "office_plan_node_not_found", "Office chart node was not found.", [`nodeId=${nodeId}`]);
      }

      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_plan_comptable_delete",
        targetType: "office_chart_node",
        targetId: nodeId,
        before: { node: before, counts: fixtureCounts },
        after: { nodeId, kind: before.kind, deletedCounts },
        idempotencyKey: resolvedIdempotencyKey
      });
      deleteOfficePlanComptableFixture(dependencies.fixtures, nodeId, before.kind);
      return mutationReceipt(nodeId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeReconciliationApproveResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeReconciliationApproveRequest>(context, officeReconciliationApproveSchema);
  const candidates = request.reconciliationIds.map((id) => requireReconciliationCandidate(dependencies.fixtures.office, id));
  const primaryReconciliationId = request.reconciliationIds[0];
  if (primaryReconciliationId === undefined) {
    throw new ApiRouteError(400, "body_field_required", "At least one reconciliation id is required.", [`path=${context.req.path}`]);
  }
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_reconciliation_approve",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:reconciliation:${request.reconciliationIds.join(":")}`);
      await persistOfficeReconciliationApproval(tx, request, actor.userId, candidates);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_reconciliation_approve",
        targetType: "office_reconciliation_match",
        targetId: primaryReconciliationId,
        before: { candidates },
        after: { status: "matched", reconciliationIds: request.reconciliationIds, approvedAt: request.approvedAt },
        idempotencyKey: resolvedIdempotencyKey
      });
      approveReconciliationFixture(dependencies.fixtures, candidates, request.approvedAt, actor.userId);
      return mutationReceipt(primaryReconciliationId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeReconciliationApproveSuggestedResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeReconciliationApproveSuggestedRequest>(context, officeReconciliationApproveSuggestedSchema);
  const minConfidenceBp = request.minConfidenceBp ?? 9500;
  const limit = request.limit ?? 200;
  const nowIso = dependencies.nowIso();
  const allCandidates = toReconciliationCandidates(dependencies.fixtures.office)
    .filter((candidate) => candidate.status === "suggested" && candidate.confidenceBp >= minConfidenceBp)
    .sort((left, right) => right.confidenceBp - left.confidenceBp || left.id.localeCompare(right.id));
  const candidates = allCandidates.slice(0, limit);
  const reconciliationIds = candidates.map((candidate) => candidate.id);

  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<OfficeReconciliationApproveSuggestedResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_reconciliation_approve",
    route: context.req.path,
    idempotencyKey,
    requestBody: {
      workspaceId: request.workspaceId,
      approvedAt: request.approvedAt,
      reconciliationIds,
      minConfidenceBp,
      limit
    },
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<OfficeReconciliationApproveSuggestedResponse> => {
      if (reconciliationIds.length > 0) {
        await acquireAdvisoryLock(tx, `office:reconciliation:${reconciliationIds.join(":")}`);
        await persistOfficeReconciliationApproval(
          tx,
          {
            workspaceId: request.workspaceId,
            reconciliationIds,
            approvedAt: request.approvedAt
          },
          actor.userId,
          candidates
        );
      }

      const auditTargetId = reconciliationIds[0] ?? `auto-suggested:${request.workspaceId}`;
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_reconciliation_approve",
        targetType: "office_reconciliation_match",
        targetId: auditTargetId,
        before: { candidateCount: allCandidates.length },
        after: {
          mode: "approve_suggested",
          status: "matched",
          processedCount: reconciliationIds.length,
          minConfidenceBp,
          limit,
          approvedAt: request.approvedAt
        },
        idempotencyKey: resolvedIdempotencyKey
      });

      if (reconciliationIds.length > 0) {
        approveReconciliationFixture(dependencies.fixtures, candidates, request.approvedAt, actor.userId);
      }

      return {
        id: auditTargetId,
        status: "completed",
        auditEventId,
        processedCount: reconciliationIds.length,
        candidateCount: allCandidates.length,
        minConfidenceBp,
        limit
      };
    }
  });

  return context.json(result.body, result.status);
}

function requireOfficeBankLine(dataset: OfficeAnalyticsDataset, statementLineId: string): OfficeBankStatementLineRow {
  const line = dataset.bankStatementLines.find((candidate) => candidate.id === statementLineId);
  if (line === undefined) {
    throw new ApiRouteError(404, "office_bank_line_not_found", "Office bank statement line was not found.", [
      `statementLineId=${statementLineId}`
    ]);
  }

  return line;
}

// Ledger transactions store a POSITIVE magnitude; the `type` (income/expense) carries the sign
// for P&L. So a bank line's amount maps to a positive amount + a direction-derived type.
function bankLineAmountText(line: OfficeBankStatementLineRow): string {
  return eofMoney.format(line.amountMurMinor ?? line.amountMinor);
}

function assertOfficeReconciliationKernelMatch(
  context: ApiContext,
  line: OfficeBankStatementLineRow,
  transaction: OfficeTransactionRow
): void {
  const candidateAmount = officeReconciliationLineMoney(line);
  const expectedAmount = officeReconciliationTransactionMoney(transaction);

  try {
    void reconcileTransaction({
      transactionId: transaction.id,
      expectedAmount,
      candidates: [
        {
          id: line.id,
          amount: candidateAmount,
          transactionDate: line.occurredOn
        }
      ]
    });
  } catch (error: unknown) {
    throw new ApiRouteError(409, "office_reconciliation_amount_mismatch", "Bank line amount does not match the selected transaction.", [
      `path=${context.req.path}`,
      `statementLineId=${line.id}`,
      `transactionId=${transaction.id}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
}

function assertOfficeReconciliationKernelCreate(
  context: ApiContext,
  line: OfficeBankStatementLineRow,
  transactionId: string,
  amountMinor: bigint,
  currency: string
): void {
  const candidateAmount = officeReconciliationLineMoney(line);
  const expectedAmount = createFinanceMoneyAmount(context, amountMinor, currency);

  try {
    void reconcileTransaction({
      transactionId,
      expectedAmount,
      candidates: [
        {
          id: line.id,
          amount: candidateAmount,
          transactionDate: line.occurredOn
        }
      ]
    });
  } catch (error: unknown) {
    throw new ApiRouteError(409, "office_reconciliation_amount_mismatch", "Created transaction amount does not match the selected bank line.", [
      `path=${context.req.path}`,
      `statementLineId=${line.id}`,
      `transactionId=${transactionId}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
}

function officeReconciliationLineMoney(line: OfficeBankStatementLineRow) {
  const currency = line.amountMurMinor === null ? line.currency : "MUR";
  const amountMinor = line.amountMurMinor ?? line.amountMinor;
  return createMoneyAmount(createMoneyMicroUnits(absBigInt(amountMinor)), createCurrencyCode(currency));
}

function officeReconciliationTransactionMoney(transaction: OfficeTransactionRow) {
  const originalCurrency = transaction.originalCurrency?.trim().toUpperCase() ?? null;
  const currency = originalCurrency === null || originalCurrency.length === 0 || originalCurrency === "MUR" || transaction.exchangeRateE10 !== null ? "MUR" : originalCurrency;
  return createMoneyAmount(createMoneyMicroUnits(absBigInt(transaction.amountMinor)), createCurrencyCode(currency));
}

function createFinanceMoneyAmount(context: ApiContext, amountMinor: bigint, currency: string) {
  try {
    return createMoneyAmount(createMoneyMicroUnits(absBigInt(amountMinor)), createCurrencyCode(currency));
  } catch (error: unknown) {
    throw new ApiRouteError(400, "currency_invalid", "Currency must be a valid ISO-4217 code.", [
      `path=${context.req.path}`,
      `currency=${currency}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
}

async function officeReconciliationMatchResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeReconciliationMatchRequest>(context, officeReconciliationMatchSchema);
  const line = requireOfficeBankLine(dependencies.fixtures.office, request.statementLineId);
  const transaction = requireOfficeTransaction(dependencies.fixtures.office, request.transactionId);
  assertOfficeReconciliationKernelMatch(context, line, transaction);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_reconciliation_match",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:reconciliation:${request.statementLineId}`);
      await persistOfficeReconciliationMatch(tx, request.statementLineId, request.transactionId, request.matchedAt, actor.userId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_reconciliation_match",
        targetType: "office_reconciliation_match",
        targetId: request.statementLineId,
        before: {},
        after: { statementLineId: request.statementLineId, transactionId: request.transactionId, matchedAt: request.matchedAt },
        idempotencyKey: resolvedIdempotencyKey
      });
      matchReconciliationFixture(dependencies.fixtures, request.statementLineId, request.transactionId, request.matchedAt, actor.userId);
      return mutationReceipt(request.statementLineId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeReconciliationUnmatchResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeReconciliationLineRequest>(context, officeReconciliationLineSchema);
  const line = requireOfficeBankLine(dependencies.fixtures.office, request.statementLineId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_reconciliation_unmatch",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:reconciliation:${request.statementLineId}`);
      await persistOfficeReconciliationUnmatch(tx, request.statementLineId, line.matchedTransactionId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_reconciliation_unmatch",
        targetType: "office_reconciliation_match",
        targetId: request.statementLineId,
        before: { matchedTransactionId: line.matchedTransactionId },
        after: { status: "unmatched" },
        idempotencyKey: resolvedIdempotencyKey
      });
      unmatchReconciliationFixture(dependencies.fixtures, request.statementLineId);
      return mutationReceipt(request.statementLineId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeReconciliationRejectResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeReconciliationLineRequest>(context, officeReconciliationLineSchema);
  requireOfficeBankLine(dependencies.fixtures.office, request.statementLineId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_reconciliation_reject",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:reconciliation:${request.statementLineId}`);
      await persistOfficeReconciliationReject(tx, request.statementLineId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_reconciliation_reject",
        targetType: "office_reconciliation_match",
        targetId: request.statementLineId,
        before: {},
        after: { status: "rejected" },
        idempotencyKey: resolvedIdempotencyKey
      });
      rejectReconciliationFixture(dependencies.fixtures, request.statementLineId);
      return mutationReceipt(request.statementLineId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeReconciliationIgnoreResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeReconciliationLineRequest>(context, officeReconciliationLineSchema);
  requireOfficeBankLine(dependencies.fixtures.office, request.statementLineId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_reconciliation_ignore",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:reconciliation:${request.statementLineId}`);
      await persistOfficeReconciliationIgnore(tx, request.statementLineId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_reconciliation_ignore",
        targetType: "office_reconciliation_match",
        targetId: request.statementLineId,
        before: {},
        after: { status: "ignored" },
        idempotencyKey: resolvedIdempotencyKey
      });
      ignoreReconciliationFixture(dependencies.fixtures, request.statementLineId);
      return mutationReceipt(request.statementLineId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeBankRawLineReassignResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeBankRawLineReassignRequest>(context, officeBankRawLineReassignSchema);
  const line = requireOfficeBankLine(dependencies.fixtures.office, request.statementLineId);
  // Look up target account by ID only — workspace access is already validated
  // upstream by requirePermissionForWorkspace. Filtering by workspaceId here
  // causes false 404s when the stored workspace_id differs from the request
  // string (e.g. 'office' vs 'eeee-mu' from different import paths).
  const targetAccount = dependencies.fixtures.office.bankAccounts.find(
    (account: OfficeBankAccountRow): boolean => account.id === request.accountId
  );
  if (targetAccount === undefined) {
    throw new ApiRouteError(404, "office_bank_account_not_found", "Target bank account was not found.", [
      `path=${context.req.path}`,
      `accountId=${request.accountId}`
    ]);
  }

  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_bank_raw_reassign_account",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:bank-line:${request.statementLineId}`);
      await persistOfficeBankRawLineReassign(tx, request.statementLineId, request.accountId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_bank_raw_reassign_account",
        targetType: "office_bank_statement_line",
        targetId: request.statementLineId,
        before: { accountId: line.accountId },
        after: { accountId: request.accountId },
        idempotencyKey: resolvedIdempotencyKey
      });
      reassignBankRawLineFixture(dependencies.fixtures, request.statementLineId, request.accountId);
      return mutationReceipt(request.statementLineId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeReconciliationCreateTransactionResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeReconciliationCreateTransactionRequest>(context, officeReconciliationCreateTransactionSchema);
  const line = requireOfficeBankLine(dependencies.fixtures.office, request.statementLineId);
  const transactionId = randomUUID();
  // Reconciliation compares against MUR whenever a bank line already carries a
  // converted MUR amount; persist the created transaction in that same currency
  // to avoid mixed "MUR amount + EUR currency" records.
  const reconciliationCurrency = line.amountMurMinor === null ? line.currency : "MUR";
  const writeRequest: OfficeTransactionWriteRequest = {
    workspaceId: request.workspaceId,
    occurredOn: line.occurredOn,
    accountId: line.accountId,
    categoryId: request.categoryId,
    projectId: request.projectId,
    description: line.description ?? line.reference ?? "Ligne bancaire",
    amountMicro: bankLineAmountText(line),
    currency: reconciliationCurrency
  };
  const amountMinor = normalizeEofAmountField(context, writeRequest.amountMicro, "amountMicro");
  // The bank direction is the source of truth for income/expense (credit = money
  // in, debit = money out); the category only files the transaction and never
  // rewrites the type.
  const transactionType: OfficeTransactionRow["type"] = line.direction === "credit" ? "income" : "expense";
  const transactionStatus: OfficeTransactionRow["status"] = request.categoryId === null ? "draft" : "validated";
  assertOfficeReconciliationKernelCreate(context, line, transactionId, amountMinor, reconciliationCurrency);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_reconciliation_create_transaction",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:reconciliation:${request.statementLineId}`);
      await persistOfficeTransactionUpsert(tx, {
        id: transactionId,
        request: writeRequest,
        amountMinor,
        transactionType,
        transactionStatus,
        actorUserId: actor.userId,
        isUpdate: false
      });
      await persistOfficeReconciliationMatch(tx, request.statementLineId, transactionId, request.matchedAt, actor.userId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_reconciliation_create_transaction",
        targetType: "office_transaction",
        targetId: transactionId,
        before: {},
        after: { transactionId, statementLineId: request.statementLineId, request: writeRequest, amountMinor: amountMinor.toString() },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeTransactionFixture(dependencies.fixtures, transactionFromOfficeRequest(transactionId, writeRequest, amountMinor, transactionType, transactionStatus));
      matchReconciliationFixture(dependencies.fixtures, request.statementLineId, transactionId, request.matchedAt, actor.userId);
      return mutationReceipt(transactionId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

// One active match per line: stale matches to other transactions are rejected before the new one
// is recorded; the line and transaction are flipped to matched/reconciled.
async function persistOfficeReconciliationMatch(
  tx: ApiWriteTransaction,
  statementLineId: string,
  transactionId: string,
  matchedAt: string,
  actorUserId: string
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update office_bank_reconciliation_matches
    set status = 'rejected', updated_at = now()
    where bank_statement_line_id = ${statementLineId} and transaction_id <> ${transactionId}
  `);
  await tx.executor.execute(sql`
    insert into office_bank_reconciliation_matches (
      id, bank_statement_line_id, transaction_id, confidence_bp, status, approved_by_user_id, approved_at
    )
    values (${randomUUID()}, ${statementLineId}, ${transactionId}, 10000, 'matched', ${actorUserId}, ${matchedAt})
    on conflict (bank_statement_line_id, transaction_id) do update
    set status = 'matched', confidence_bp = 10000, approved_by_user_id = excluded.approved_by_user_id, approved_at = excluded.approved_at, updated_at = now()
  `);
  await tx.executor.execute(sql`
    update office_bank_statement_lines
    set reconciliation_status = 'matched', matched_transaction_id = ${transactionId}
    where id = ${statementLineId}
  `);
  await tx.executor.execute(sql`
    update transactions set is_fully_reconciled = true, updated_at = now() where id = ${transactionId}
  `);
}

async function persistOfficeReconciliationUnmatch(
  tx: ApiWriteTransaction,
  statementLineId: string,
  matchedTransactionId: string | null
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update office_bank_reconciliation_matches set status = 'rejected', updated_at = now() where bank_statement_line_id = ${statementLineId}
  `);
  await tx.executor.execute(sql`
    update office_bank_statement_lines set reconciliation_status = 'unmatched', matched_transaction_id = null where id = ${statementLineId}
  `);
  if (matchedTransactionId !== null) {
    await tx.executor.execute(sql`
      update transactions set is_fully_reconciled = false, updated_at = now() where id = ${matchedTransactionId}
    `);
  }
}

async function persistOfficeReconciliationReject(tx: ApiWriteTransaction, statementLineId: string): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update office_bank_reconciliation_matches set status = 'rejected', updated_at = now() where bank_statement_line_id = ${statementLineId}
  `);
  await tx.executor.execute(sql`
    update office_bank_statement_lines set reconciliation_status = 'rejected', matched_transaction_id = null where id = ${statementLineId}
  `);
}

// Ignore is for lines that are intentionally never converted into a transaction (internal
// transfers, test rows, non-financial memos) — distinct from "rejected", which means a specific
// match attempt was wrong but the line may still need a transaction later.
async function persistOfficeReconciliationIgnore(tx: ApiWriteTransaction, statementLineId: string): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update office_bank_reconciliation_matches set status = 'rejected', updated_at = now() where bank_statement_line_id = ${statementLineId}
  `);
  await tx.executor.execute(sql`
    update office_bank_statement_lines set reconciliation_status = 'ignored', matched_transaction_id = null where id = ${statementLineId}
  `);
}

async function persistOfficeReconciliationSuggestions(
  tx: ApiWriteTransaction,
  suggestions: readonly OfficeReconciliationSuggestion[]
): Promise<void> {
  if (tx.kind === "memory" || suggestions.length === 0) {
    return;
  }

  for (const suggestion of suggestions) {
    await tx.executor.execute(sql`
      update office_bank_reconciliation_matches
      set status = 'rejected', updated_at = now()
      where bank_statement_line_id = ${suggestion.statementLineId}
        and transaction_id <> ${suggestion.transactionId}
        and status = 'suggested'
    `);

    await tx.executor.execute(sql`
      insert into office_bank_reconciliation_matches (
        id,
        bank_statement_line_id,
        transaction_id,
        confidence_bp,
        status,
        approved_by_user_id,
        approved_at
      )
      values (
        ${randomUUID()},
        ${suggestion.statementLineId},
        ${suggestion.transactionId},
        ${suggestion.confidenceBp},
        'suggested',
        null,
        null
      )
      on conflict (bank_statement_line_id, transaction_id) do update
      set
        confidence_bp = excluded.confidence_bp,
        status = 'suggested',
        approved_by_user_id = null,
        approved_at = null,
        updated_at = now()
    `);

    await tx.executor.execute(sql`
      update office_bank_statement_lines
      set reconciliation_status = 'suggested', matched_transaction_id = null
      where id = ${suggestion.statementLineId} and reconciliation_status = 'unmatched'
    `);
  }
}

async function persistOfficeBankRawLineReassign(tx: ApiWriteTransaction, statementLineId: string, accountId: string): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update office_bank_statement_lines set account_id = ${accountId} where id = ${statementLineId}
  `);
}

function matchReconciliationFixture(
  fixtures: ApiFixtureStore,
  statementLineId: string,
  transactionId: string,
  matchedAt: string,
  actorUserId: string
): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  mutableOffice.bankStatementLines = fixtures.office.bankStatementLines.map((line) =>
    line.id === statementLineId ? { ...line, reconciliationStatus: "matched", matchedTransactionId: transactionId } : line
  );
  mutableOffice.bankReconciliationMatches = [
    ...fixtures.office.bankReconciliationMatches.filter((match) => match.bankStatementLineId !== statementLineId),
    {
      id: randomUUID(),
      bankStatementLineId: statementLineId,
      transactionId,
      confidenceBp: 10000,
      status: "matched" as const,
      approvedByUserId: actorUserId,
      approvedAt: matchedAt
    }
  ];
}

function unmatchReconciliationFixture(fixtures: ApiFixtureStore, statementLineId: string): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  mutableOffice.bankStatementLines = fixtures.office.bankStatementLines.map((line) =>
    line.id === statementLineId ? { ...line, reconciliationStatus: "unmatched", matchedTransactionId: null } : line
  );
  mutableOffice.bankReconciliationMatches = fixtures.office.bankReconciliationMatches.filter(
    (match) => match.bankStatementLineId !== statementLineId
  );
}

function rejectReconciliationFixture(fixtures: ApiFixtureStore, statementLineId: string): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  mutableOffice.bankStatementLines = fixtures.office.bankStatementLines.map((line) =>
    line.id === statementLineId ? { ...line, reconciliationStatus: "rejected", matchedTransactionId: null } : line
  );
  mutableOffice.bankReconciliationMatches = fixtures.office.bankReconciliationMatches.filter(
    (match) => match.bankStatementLineId !== statementLineId
  );
}

function ignoreReconciliationFixture(fixtures: ApiFixtureStore, statementLineId: string): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  mutableOffice.bankStatementLines = fixtures.office.bankStatementLines.map((line) =>
    line.id === statementLineId ? { ...line, reconciliationStatus: "ignored", matchedTransactionId: null } : line
  );
  mutableOffice.bankReconciliationMatches = fixtures.office.bankReconciliationMatches.filter(
    (match) => match.bankStatementLineId !== statementLineId
  );
}

function reassignBankRawLineFixture(fixtures: ApiFixtureStore, statementLineId: string, accountId: string): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  mutableOffice.bankStatementLines = fixtures.office.bankStatementLines.map((line) =>
    line.id === statementLineId ? { ...line, accountId } : line
  );
}

async function officePartnerCreateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficePartnerWriteRequest>(context, officePartnerWriteSchema);
  const partnerId = randomUUID();
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_partner_create",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await persistOfficePartnerUpsert(tx, partnerId, request, false);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_partner_create",
        targetType: "office_partner",
        targetId: partnerId,
        before: {},
        after: { partnerId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficePartnerFixture(dependencies.fixtures, partnerId, request);
      return mutationReceipt(partnerId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officePartnerUpdateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const partnerId = requirePathParam(context, "partnerId");
  const request = await readZodBody<OfficePartnerWriteRequest>(context, officePartnerWriteSchema);
  const before = requirePartner(dependencies.fixtures.office, partnerId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_partner_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:partner:${partnerId}`);
      await persistOfficePartnerUpsert(tx, partnerId, request, true);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_partner_update",
        targetType: "office_partner",
        targetId: partnerId,
        before: { partner: before },
        after: { partnerId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficePartnerFixture(dependencies.fixtures, partnerId, request);
      return mutationReceipt(partnerId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeBankAccountCreateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeBankAccountWriteRequest>(context, officeBankAccountWriteSchema);
  const accountId = randomUUID();
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_bank_account_create",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await persistOfficeBankAccountUpsert(tx, accountId, request, false);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_bank_account_create",
        targetType: "office_bank_account",
        targetId: accountId,
        before: {},
        after: { accountId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeBankAccountFixture(dependencies.fixtures, accountId, request);
      return mutationReceipt(accountId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeBankAccountUpdateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const accountId = requirePathParam(context, "accountId");
  const request = await readZodBody<OfficeBankAccountWriteRequest>(context, officeBankAccountWriteSchema);
  const before = dependencies.fixtures.office.bankAccounts.find((account: OfficeBankAccountRow): boolean => account.id === accountId);
  if (before === undefined) {
    throw new ApiRouteError(404, "office_bank_account_not_found", "Office bank account was not found.", [`accountId=${accountId}`]);
  }
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_bank_account_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:bank-account:${accountId}`);
      await persistOfficeBankAccountUpsert(tx, accountId, request, true);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_bank_account_update",
        targetType: "office_bank_account",
        targetId: accountId,
        before: { account: officeBankAccountAuditSnapshot(before) },
        after: { accountId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeBankAccountFixture(dependencies.fixtures, accountId, request);
      return mutationReceipt(accountId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeBankAccountDeleteResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const accountId = requirePathParam(context, "accountId");
  const request = await readZodBody<OfficeBankAccountDeleteRequest>(context, workspaceBodySchema);
  const before = dependencies.fixtures.office.bankAccounts.find(
    (account: OfficeBankAccountRow): boolean => account.id === accountId && account.workspaceId === request.workspaceId
  );
  if (before === undefined) {
    throw new ApiRouteError(404, "office_bank_account_not_found", "Office bank account was not found.", [
      `accountId=${accountId}`,
      `workspaceId=${request.workspaceId}`
    ]);
  }

  const fixtureCounts = countOfficeBankAccountFixtureDependencies(dependencies.fixtures, accountId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_bank_account_delete",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:bank-account:${accountId}`);
      const deletedCounts = await persistOfficeBankAccountDelete(tx, accountId, request);
      if (tx.kind !== "memory" && deletedCounts.accountCount !== 1) {
        throw new ApiRouteError(404, "office_bank_account_not_found", "Office bank account was not found.", [
          `accountId=${accountId}`,
          `workspaceId=${request.workspaceId}`
        ]);
      }
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_bank_account_delete",
        targetType: "office_bank_account",
        targetId: accountId,
        before: { account: officeBankAccountAuditSnapshot(before), counts: fixtureCounts },
        after: { accountId, deletedCounts },
        idempotencyKey: resolvedIdempotencyKey
      });
      deleteOfficeBankAccountFixture(dependencies.fixtures, accountId);
      return mutationReceipt(accountId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function persistOfficeBankAccountUpsert(tx: ApiWriteTransaction, accountId: string, request: OfficeBankAccountWriteRequest, isUpdate: boolean): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  if (isUpdate) {
    await tx.executor.execute(sql`
      update office_bank_accounts
      set
        bank_name = ${request.bankName.trim()},
        account_label = ${request.accountLabel.trim()},
        currency = ${request.currency.toUpperCase()},
        is_active = ${request.active}
      where id = ${accountId}
    `);
    return;
  }

  await tx.executor.execute(sql`
    insert into office_bank_accounts (id, workspace_id, bank_name, account_label, account_reference_hash, currency, current_balance_minor, current_balance_mur_minor, is_active)
    values (${accountId}, ${request.workspaceId}, ${request.bankName.trim()}, ${request.accountLabel.trim()}, ${`manual-${accountId}`}, ${request.currency.toUpperCase()}, 0, 0, ${request.active})
  `);
}

async function persistOfficeBankAccountDelete(
  tx: ApiWriteTransaction,
  accountId: string,
  request: OfficeBankAccountDeleteRequest
): Promise<OfficeBankAccountDeleteCounts> {
  if (tx.kind === "memory") {
    return {
      accountCount: 1,
      statementLineCount: 0,
      reconciliationMatchCount: 0,
      importBatchCount: 0,
      cashflowProjectionCount: 0
    };
  }

  const rows = queryRowsFromResult(await tx.executor.execute(sql`
    with scoped_account as (
      select id
      from office_bank_accounts
      where id = ${accountId}
        and workspace_id = ${request.workspaceId}
    ),
    scoped_lines as (
      select line.id
      from office_bank_statement_lines line
      join scoped_account account on account.id = line.account_id
    ),
    deleted_matches as (
      delete from office_bank_reconciliation_matches match
      using scoped_lines line
      where match.bank_statement_line_id = line.id
      returning match.id
    ),
    deleted_lines as (
      delete from office_bank_statement_lines line
      using scoped_account account
      where line.account_id = account.id
      returning line.id
    ),
    deleted_cashflow as (
      delete from office_cashflow_projection_rows row
      using scoped_account account
      where row.account_id = account.id
      returning row.id
    ),
    deleted_batches as (
      delete from office_bank_import_batches batch
      using scoped_account account
      where batch.account_id = account.id
      returning batch.id
    ),
    deleted_account as (
      delete from office_bank_accounts account
      using scoped_account scoped
      where account.id = scoped.id
      returning account.id
    )
    select
      (select count(*) from deleted_account)::int as account_count,
      (select count(*) from deleted_lines)::int as statement_line_count,
      (select count(*) from deleted_matches)::int as reconciliation_match_count,
      (select count(*) from deleted_batches)::int as import_batch_count,
      (select count(*) from deleted_cashflow)::int as cashflow_projection_count
  `));
  const row = rows[0];
  return {
    accountCount: integerQueryField(row, "account_count"),
    statementLineCount: integerQueryField(row, "statement_line_count"),
    reconciliationMatchCount: integerQueryField(row, "reconciliation_match_count"),
    importBatchCount: integerQueryField(row, "import_batch_count"),
    cashflowProjectionCount: integerQueryField(row, "cashflow_projection_count")
  };
}

function upsertOfficeBankAccountFixture(fixtures: ApiFixtureStore, accountId: string, request: OfficeBankAccountWriteRequest): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  const existing = fixtures.office.bankAccounts.find((account: OfficeBankAccountRow): boolean => account.id === accountId);
  const account: OfficeBankAccountRow = {
    id: accountId,
    workspaceId: request.workspaceId,
    bankName: request.bankName.trim(),
    accountLabel: request.accountLabel.trim(),
    accountReferenceHash: existing?.accountReferenceHash ?? `manual-${accountId}`,
    currency: request.currency.toUpperCase() as CurrencyCode,
    currentBalanceMinor: existing?.currentBalanceMinor ?? 0n,
    currentBalanceMurMinor: existing?.currentBalanceMurMinor ?? null,
    isActive: request.active,
    balanceAsOf: existing?.balanceAsOf ?? null
  };
  mutableOffice.bankAccounts = upsertById(fixtures.office.bankAccounts, account);
}

function countOfficeBankAccountFixtureDependencies(fixtures: ApiFixtureStore, accountId: string): OfficeBankAccountDeleteCounts {
  const statementLineIds = new Set<string>(
    fixtures.office.bankStatementLines
      .filter((line: OfficeBankStatementLineRow): boolean => line.accountId === accountId)
      .map((line: OfficeBankStatementLineRow): string => line.id)
  );

  return {
    accountCount: fixtures.office.bankAccounts.some((account: OfficeBankAccountRow): boolean => account.id === accountId) ? 1 : 0,
    statementLineCount: statementLineIds.size,
    reconciliationMatchCount: fixtures.office.bankReconciliationMatches.filter((match): boolean =>
      statementLineIds.has(match.bankStatementLineId)
    ).length,
    importBatchCount: fixtures.office.bankImportBatches.filter((batch: OfficeBankImportBatchRow): boolean => batch.accountId === accountId).length,
    cashflowProjectionCount: fixtures.office.cashflowProjectionRows.filter((row): boolean => row.accountId === accountId).length
  };
}

function deleteOfficeBankAccountFixture(fixtures: ApiFixtureStore, accountId: string): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  const statementLineIds = new Set<string>(
    fixtures.office.bankStatementLines
      .filter((line: OfficeBankStatementLineRow): boolean => line.accountId === accountId)
      .map((line: OfficeBankStatementLineRow): string => line.id)
  );

  mutableOffice.bankReconciliationMatches = fixtures.office.bankReconciliationMatches.filter(
    (match): boolean => !statementLineIds.has(match.bankStatementLineId)
  );
  mutableOffice.bankStatementLines = fixtures.office.bankStatementLines.filter(
    (line: OfficeBankStatementLineRow): boolean => line.accountId !== accountId
  );
  mutableOffice.cashflowProjectionRows = fixtures.office.cashflowProjectionRows.filter((row): boolean => row.accountId !== accountId);
  mutableOffice.bankImportBatches = fixtures.office.bankImportBatches.filter(
    (batch: OfficeBankImportBatchRow): boolean => batch.accountId !== accountId
  );
  mutableOffice.bankAccounts = fixtures.office.bankAccounts.filter((account: OfficeBankAccountRow): boolean => account.id !== accountId);
}

async function persistOfficeBankImportDelete(
  tx: ApiWriteTransaction,
  batchId: string,
  request: OfficeBankImportDeleteRequest
): Promise<OfficeBankImportDeleteCounts> {
  if (tx.kind === "memory") {
    return { batchCount: 1, statementLineCount: 0, reconciliationMatchCount: 0 };
  }

  const rows = queryRowsFromResult(await tx.executor.execute(sql`
    with scoped_batch as (
      select id
      from office_bank_import_batches
      where id = ${batchId}
        and workspace_id = ${request.workspaceId}
    ),
    scoped_lines as (
      select line.id
      from office_bank_statement_lines line
      join scoped_batch batch on batch.id = line.import_batch_id
    ),
    deleted_matches as (
      delete from office_bank_reconciliation_matches match
      using scoped_lines line
      where match.bank_statement_line_id = line.id
      returning match.id
    ),
    deleted_lines as (
      delete from office_bank_statement_lines line
      using scoped_batch batch
      where line.import_batch_id = batch.id
      returning line.id
    ),
    deleted_batch as (
      delete from office_bank_import_batches batch
      using scoped_batch scoped
      where batch.id = scoped.id
      returning batch.id
    )
    select
      (select count(*) from deleted_batch)::int as batch_count,
      (select count(*) from deleted_lines)::int as statement_line_count,
      (select count(*) from deleted_matches)::int as reconciliation_match_count
  `));
  const row = rows[0];
  return {
    batchCount: integerQueryField(row, "batch_count"),
    statementLineCount: integerQueryField(row, "statement_line_count"),
    reconciliationMatchCount: integerQueryField(row, "reconciliation_match_count")
  };
}

function countOfficeBankImportFixtureDependencies(fixtures: ApiFixtureStore, batchId: string): OfficeBankImportDeleteCounts {
  const statementLineIds = new Set<string>(
    fixtures.office.bankStatementLines
      .filter((line: OfficeBankStatementLineRow): boolean => line.importBatchId === batchId)
      .map((line: OfficeBankStatementLineRow): string => line.id)
  );

  return {
    batchCount: fixtures.office.bankImportBatches.some((batch: OfficeBankImportBatchRow): boolean => batch.id === batchId) ? 1 : 0,
    statementLineCount: statementLineIds.size,
    reconciliationMatchCount: fixtures.office.bankReconciliationMatches.filter((match): boolean =>
      statementLineIds.has(match.bankStatementLineId)
    ).length
  };
}

function deleteOfficeBankImportBatchFixture(fixtures: ApiFixtureStore, batchId: string): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  const statementLineIds = new Set<string>(
    fixtures.office.bankStatementLines
      .filter((line: OfficeBankStatementLineRow): boolean => line.importBatchId === batchId)
      .map((line: OfficeBankStatementLineRow): string => line.id)
  );

  mutableOffice.bankReconciliationMatches = fixtures.office.bankReconciliationMatches.filter(
    (match): boolean => !statementLineIds.has(match.bankStatementLineId)
  );
  mutableOffice.bankStatementLines = fixtures.office.bankStatementLines.filter(
    (line: OfficeBankStatementLineRow): boolean => line.importBatchId !== batchId
  );
  mutableOffice.bankImportBatches = fixtures.office.bankImportBatches.filter(
    (batch: OfficeBankImportBatchRow): boolean => batch.id !== batchId
  );
}

async function officeProjectCreateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeProjectWriteRequest>(context, officeProjectWriteSchema);
  const projectId = randomUUID();
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_project_create",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await persistOfficeProjectUpsert(tx, projectId, request, false);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_project_create",
        targetType: "office_project",
        targetId: projectId,
        before: {},
        after: { projectId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeProjectFixture(dependencies.fixtures, projectId, request);
      return mutationReceipt(projectId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function officeProjectUpdateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const projectId = requirePathParam(context, "projectId");
  const request = await readZodBody<OfficeProjectWriteRequest>(context, officeProjectWriteSchema);
  const before = requireProject(dependencies.fixtures.office, projectId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_project_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:project:${projectId}`);
      await persistOfficeProjectUpsert(tx, projectId, request, true);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_project_update",
        targetType: "office_project",
        targetId: projectId,
        before: { project: before },
        after: { projectId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeProjectFixture(dependencies.fixtures, projectId, request);
      return mutationReceipt(projectId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function persistOfficeProjectUpsert(tx: ApiWriteTransaction, projectId: string, request: OfficeProjectWriteRequest, isUpdate: boolean): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  if (isUpdate) {
    await tx.executor.execute(sql`
      update projects
      set
        name = ${request.name.trim()},
        status = ${request.status}::project_status,
        description = ${request.description},
        is_active = ${request.active}
      where id = ${projectId}
    `);
    return;
  }

  await tx.executor.execute(sql`
    insert into projects (id, name, status, state, description, is_active)
    values (${projectId}, ${request.name.trim()}, ${request.status}::project_status, ${request.status}, ${request.description}, ${request.active})
  `);
}

function upsertOfficeProjectFixture(fixtures: ApiFixtureStore, projectId: string, request: OfficeProjectWriteRequest): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  const project: OfficeProjectRow = {
    id: projectId,
    name: request.name.trim(),
    description: request.description,
    status: request.status,
    state: request.status,
    isActive: request.active
  };
  mutableOffice.projects = upsertById(fixtures.office.projects, project);
}

// Accept "YYYY-MM", "YYYY-M", or "MM/YYYY" / "M/YYYY" → canonical "YYYY-MM".
function normalizeCashflowMonth(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/u.test(trimmed)) {
    return trimmed;
  }
  const iso = /^(\d{4})-(\d{1,2})\b/u.exec(trimmed);
  if (iso !== null && iso[1] !== undefined && iso[2] !== undefined) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}`;
  }
  const slash = /^(\d{1,2})[/\-](\d{4})$/u.exec(trimmed);
  if (slash !== null && slash[1] !== undefined && slash[2] !== undefined) {
    return `${slash[2]}-${slash[1].padStart(2, "0")}`;
  }
  return null;
}

function parseCashflowImportRow(record: Readonly<Record<string, string>>): { readonly parsed: ParsedCashflowRow | null; readonly issues: readonly string[] } {
  const periodRaw = rowValue(record, ["periodMonth", "period_month", "period", "month", "Month", "PERIOD", "Mois"]);
  const periodMonth = periodRaw !== null ? normalizeCashflowMonth(periodRaw) : null;
  const currency = normalizedCurrency(rowValue(record, ["currency", "currency_code", "Currency", "CURRENCY"])) ?? "MUR";
  const inflow = moneyValue(record, ["inflow", "Inflow", "expectedInflow", "expected_inflow", "inflowMinor", "entrees"]);
  const outflow = moneyValue(record, ["outflow", "Outflow", "expectedOutflow", "expected_outflow", "outflowMinor", "sorties"]);
  const closing = moneyValue(record, ["closingBalance", "closing_balance", "ClosingBalance", "balance", "Balance", "solde"]);
  const issues = [
    ...(periodMonth === null ? ["period_missing_or_invalid"] : []),
    ...(inflow === null && outflow === null && closing === null ? ["amounts_missing"] : [])
  ];
  if (issues.length > 0 || periodMonth === null) {
    return { parsed: null, issues };
  }
  return {
    parsed: {
      periodMonth,
      inflowMinor: inflow ?? 0n,
      outflowMinor: outflow ?? 0n,
      closingBalanceMinor: closing ?? 0n,
      currency
    },
    issues: []
  };
}

async function officeCashflowPreviewResponse(context: ApiContext): Promise<Response> {
  const request = await readZodBody<OfficeCashflowImportRequest>(context, officeCashflowImportSchema);
  resolveWorkspaceId(context);
  const rows = request.rows.map((record: Readonly<Record<string, string>>, index: number) => {
    const { parsed, issues } = parseCashflowImportRow(record);
    return {
      rowNumber: index + 1,
      periodMonth: parsed?.periodMonth ?? null,
      inflow: parsed !== null ? eofMoney.format(parsed.inflowMinor) : null,
      outflow: parsed !== null ? eofMoney.format(parsed.outflowMinor) : null,
      closingBalance: parsed !== null ? eofMoney.format(parsed.closingBalanceMinor) : null,
      currency: parsed?.currency ?? null,
      issues
    };
  });
  const acceptedRowCount = rows.filter((row): boolean => row.issues.length === 0).length;
  return context.json({
    acceptedRowCount,
    rejectedRowCount: rows.length - acceptedRowCount,
    rows
  });
}

async function officeCashflowConfirmResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeCashflowImportRequest>(context, officeCashflowImportSchema);
  const workspaceId = resolveWorkspaceId(context);
  const parsed = request.rows
    .map((record: Readonly<Record<string, string>>): ParsedCashflowRow | null => parseCashflowImportRow(record).parsed)
    .filter((row: ParsedCashflowRow | null): row is ParsedCashflowRow => row !== null);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const batchId = randomUUID();
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_cashflow_import_confirm",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await persistOfficeCashflowRows(tx, workspaceId, parsed);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_cashflow_import_confirm",
        targetType: "office_cashflow_import",
        targetId: batchId,
        before: {},
        after: { workspaceId, rowCount: parsed.length },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeCashflowFixture(dependencies.fixtures, workspaceId, parsed, dependencies.nowIso());
      return mutationReceipt(batchId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function persistOfficeCashflowRows(tx: ApiWriteTransaction, workspaceId: string, rows: readonly ParsedCashflowRow[]): Promise<void> {
  if (tx.kind === "memory" || rows.length === 0) {
    return;
  }
  const periods = [...new Set(rows.map((row: ParsedCashflowRow): string => row.periodMonth))];
  for (const period of periods) {
    await tx.executor.execute(sql`delete from office_cashflow_projection_rows where workspace_id = ${workspaceId} and period_month = ${period}`);
  }
  for (const row of rows) {
    await tx.executor.execute(sql`
      insert into office_cashflow_projection_rows (id, workspace_id, period_month, expected_inflow_minor, expected_outflow_minor, expected_closing_balance_minor, currency)
      values (${randomUUID()}, ${workspaceId}, ${row.periodMonth}, ${row.inflowMinor.toString()}, ${row.outflowMinor.toString()}, ${row.closingBalanceMinor.toString()}, ${row.currency})
    `);
  }
}

function upsertOfficeCashflowFixture(fixtures: ApiFixtureStore, workspaceId: string, rows: readonly ParsedCashflowRow[], nowIso: string): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  const periods = new Set(rows.map((row: ParsedCashflowRow): string => row.periodMonth));
  const kept = fixtures.office.cashflowProjectionRows.filter(
    (row): boolean => !(row.workspaceId === workspaceId && periods.has(row.periodMonth))
  );
  const added: OfficeAnalyticsDataset["cashflowProjectionRows"][number][] = rows.map((row: ParsedCashflowRow) => ({
    id: randomUUID(),
    workspaceId,
    accountId: null,
    periodMonth: row.periodMonth,
    expectedInflowMinor: row.inflowMinor,
    expectedOutflowMinor: row.outflowMinor,
    expectedClosingBalanceMinor: row.closingBalanceMinor,
    currency: row.currency as CurrencyCode,
    createdAt: nowIso
  }));
  mutableOffice.cashflowProjectionRows = [...kept, ...added];
}

function safeEofParse(value: string): bigint | null {
  try {
    return eofMoney.parse(value);
  } catch {
    return null;
  }
}

interface LedgerCategoryResolutionInput {
  readonly categoryId: string | null;
  readonly accountCode: string | null;
  readonly accountLabel: string | null;
  readonly categoryName: string | null;
  readonly divisionId: string | null;
  readonly divisionName: string | null;
  readonly departmentId: string | null;
  readonly departmentName: string | null;
}

type LedgerCategoryResolution =
  | { readonly category: OfficeCategoryRow }
  | { readonly issue: string };

// Resolve a category by UUID first, then statutory account code/label, then the
// department -> division -> category name path. Department/division values only constrain the match.
function resolveLedgerCategory(dataset: OfficeAnalyticsDataset, input: LedgerCategoryResolutionInput): LedgerCategoryResolution {
  if (input.categoryId !== null) {
    const category = dataset.categories.find((candidate): boolean => candidate.id === input.categoryId);
    if (category === undefined) {
      return { issue: "category_not_found" };
    }

    const dimensionIssue = validateLedgerCategoryDimensions(dataset, category, input);
    return dimensionIssue === null ? { category } : { issue: dimensionIssue };
  }

  const statutoryMatch = resolveLedgerCategoryByStatutoryAccount(dataset, input);
  if ("category" in statutoryMatch) {
    const dimensionIssue = validateLedgerCategoryDimensions(dataset, statutoryMatch.category, input);
    return dimensionIssue === null ? statutoryMatch : { issue: dimensionIssue };
  }

  if (input.categoryName === null || input.categoryName.trim().length === 0) {
    return { issue: "category_not_provided" };
  }

  const categoryName = input.categoryName;
  const namedMatches = dataset.categories.filter((category): boolean => textEquals(category.name, categoryName));
  const constrainedMatches = namedMatches.filter((category): boolean =>
    validateLedgerCategoryDimensions(dataset, category, input) === null
  );

  if (constrainedMatches.length === 1) {
    const category = constrainedMatches[0];
    if (category === undefined) {
      throw new Error("Ledger category resolution narrowed to one match, but no category was present.");
    }

    return { category };
  }

  if (constrainedMatches.length > 1) {
    return { issue: "category_ambiguous" };
  }

  return namedMatches.length > 0 ? { issue: "category_dimension_mismatch" } : { issue: "category_not_found" };
}

function resolveLedgerCategoryByStatutoryAccount(
  dataset: OfficeAnalyticsDataset,
  input: LedgerCategoryResolutionInput
): LedgerCategoryResolution {
  const accountCode = input.accountCode?.trim() ?? "";
  const accountLabel = input.accountLabel?.trim() ?? "";
  if (accountCode.length === 0 && accountLabel.length === 0) {
    return { issue: "category_not_provided" };
  }

  const matches = dataset.categories.filter((category): boolean =>
    (accountCode.length > 0 && category.accountCode !== undefined && category.accountCode !== null && category.accountCode.trim() === accountCode) ||
    (accountLabel.length > 0 && category.accountLabel !== undefined && category.accountLabel !== null && textEquals(category.accountLabel, accountLabel))
  );

  if (matches.length === 1) {
    const category = matches[0];
    if (category === undefined) {
      throw new Error("Ledger account-code resolution narrowed to one match, but no category was present.");
    }

    return { category };
  }

  if (matches.length > 1) {
    return { issue: "category_ambiguous" };
  }

  return { issue: "category_not_provided" };
}

function validateLedgerCategoryDimensions(
  dataset: OfficeAnalyticsDataset,
  category: OfficeCategoryRow,
  input: LedgerCategoryResolutionInput
): string | null {
  const division = category.divisionId === null
    ? undefined
    : dataset.divisions.find((candidate): boolean => candidate.id === category.divisionId);
  const department = division === undefined
    ? undefined
    : dataset.departments.find((candidate): boolean => candidate.id === division.departmentId);

  if (input.divisionId !== null && division?.id !== input.divisionId) {
    return "category_dimension_mismatch";
  }

  if (input.departmentId !== null && department?.id !== input.departmentId) {
    return "category_dimension_mismatch";
  }

  if (!matchesOptionalText(division?.name ?? null, input.divisionName)) {
    return "category_dimension_mismatch";
  }

  if (!matchesOptionalText(department?.name ?? null, input.departmentName)) {
    return "category_dimension_mismatch";
  }

  return null;
}

function matchesOptionalText(candidate: string | null, value: string | null): boolean {
  return value === null || value.trim().length === 0 || (candidate !== null && textEquals(candidate, value));
}

function textEquals(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

// Turn one bulk row into a resolved ledger transaction (or an issue list). Classification is optional:
// a row with no category becomes a draft; a row whose stated category cannot be resolved is rejected.
function resolveLedgerBulkRow(row: OfficeLedgerBulkRow, rowNumber: number, dataset: OfficeAnalyticsDataset): ResolvedLedgerRow {
  const issues: string[] = [];
  const amountMinor = safeEofParse(row.amount);
  if (amountMinor === null || amountMinor <= 0n) {
    issues.push("amount_missing_or_invalid");
  }
  if (row.currency.trim().toUpperCase() !== "MUR") {
    issues.push("currency_not_mur");
  }

  let categoryId: string | null = null;
  // The row states income/expense itself; the resolved category only files the
  // transaction under division/department and never rewrites the type.
  const resolvedType: "income" | "expense" = row.type;
  if (
    row.categoryId !== null ||
    row.accountCode !== null ||
    row.accountLabel !== null ||
    (row.categoryName !== null && row.categoryName.trim().length > 0)
  ) {
    const resolution = resolveLedgerCategory(dataset, {
      categoryId: row.categoryId,
      accountCode: row.accountCode,
      accountLabel: row.accountLabel,
      categoryName: row.categoryName,
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      departmentId: row.departmentId,
      departmentName: row.departmentName
    });
    if ("issue" in resolution) {
      issues.push(resolution.issue);
    } else {
      categoryId = resolution.category.id;
    }
  }

  const partnerName = row.partnerName;
  const partnerId = partnerName !== null && partnerName.trim().length > 0
    ? (dataset.partners.find((partner): boolean => partner.name.trim().toLowerCase() === partnerName.trim().toLowerCase())?.id ?? null)
    : null;

  return {
    legacyId: row.legacyId,
    rowNumber,
    occurredOn: row.occurredOn,
    type: resolvedType,
    amountMinor: amountMinor ?? 0n,
    currency: row.currency.trim().toUpperCase(),
    description: row.description.trim(),
    categoryId,
    partnerId,
    projectId: row.projectId,
    accountCode: row.accountCode,
    accountLabel: row.accountLabel,
    status: categoryId !== null ? "validated" : "draft",
    issues
  };
}

async function officeLedgerBulkPreviewResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeLedgerBulkRequest>(context, officeLedgerBulkSchema as z.ZodType<OfficeLedgerBulkRequest>);
  resolveWorkspaceId(context);
  const resolved = request.rows.map((row: OfficeLedgerBulkRow, index: number): ResolvedLedgerRow =>
    resolveLedgerBulkRow(row, index + 1, dependencies.fixtures.office)
  );
  const accepted = resolved.filter((row: ResolvedLedgerRow): boolean => row.issues.length === 0);
  const rejectionCounts = new Map<string, number>();
  for (const row of resolved) {
    for (const issue of row.issues) {
      rejectionCounts.set(issue, (rejectionCounts.get(issue) ?? 0) + 1);
    }
  }
  return context.json({
    acceptedRowCount: accepted.length,
    rejectedRowCount: resolved.length - accepted.length,
    validatedRowCount: accepted.filter((row: ResolvedLedgerRow): boolean => row.status === "validated").length,
    draftRowCount: accepted.filter((row: ResolvedLedgerRow): boolean => row.status === "draft").length,
    rejectionReasons: [...rejectionCounts.entries()]
      .map(([reason, count]: readonly [string, number]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count),
    rows: resolved.map((row: ResolvedLedgerRow) => ({
      legacyId: row.legacyId,
      rowNumber: row.rowNumber,
      status: row.issues.length === 0 ? "accepted" : "rejected",
      willValidate: row.issues.length === 0 && row.status === "validated",
      categoryId: row.categoryId,
      issues: row.issues
    }))
  });
}

async function officeLedgerBulkConfirmResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeLedgerBulkRequest>(context, officeLedgerBulkSchema as z.ZodType<OfficeLedgerBulkRequest>);
  resolveWorkspaceId(context);
  const accepted = request.rows
    .map((row: OfficeLedgerBulkRow, index: number): ResolvedLedgerRow => resolveLedgerBulkRow(row, index + 1, dependencies.fixtures.office))
    .filter((row: ResolvedLedgerRow): boolean => row.issues.length === 0);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const batchId = randomUUID();
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse & { readonly upsertedRowCount: number }>({
    runtime: dependencies.persistence,
    actor,
    action: "office_ledger_bulk_confirm",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string) => {
      await persistOfficeLedgerBulk(tx, accepted, actor.userId, request.workspaceId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_ledger_bulk_confirm",
        targetType: "office_ledger_bulk",
        targetId: batchId,
        before: {},
        after: {
          upsertedRowCount: accepted.length,
          validatedRowCount: accepted.filter((row: ResolvedLedgerRow): boolean => row.status === "validated").length
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertOfficeLedgerBulkFixture(dependencies.fixtures, accepted, request.workspaceId);
      return { ...mutationReceipt(batchId, auditEventId), upsertedRowCount: accepted.length };
    }
  });
  return context.json(result.body, result.status);
}

// Idempotent by legacy tx_id: `on conflict (legacy_id)` updates in place, so re-pushing a batch
// never duplicates. Also back-fills each resolved category's Mauritian statutory account code.
async function persistOfficeLedgerBulk(tx: ApiWriteTransaction, rows: readonly ResolvedLedgerRow[], actorUserId: string, workspaceId: string): Promise<void> {
  if (tx.kind === "memory" || rows.length === 0) {
    return;
  }
  for (const row of rows) {
    const occurredAt = `${row.occurredOn}T00:00:00.000Z`;
    const approvedBy = row.status === "validated" ? actorUserId : null;
    const approvedAt = row.status === "validated" ? new Date().toISOString() : null;
    const amount = row.amountMinor.toString();
    await tx.executor.execute(sql`
      insert into transactions (
        id, legacy_id, workspace_id, transaction_date, type, status, is_active, description,
        category_id, partner_id, project_id, account_id, amount_minor, original_amount_minor, original_currency,
        total_amount_minor, source, created_by_user_id, approved_by_user_id, approved_at
      )
      values (
        ${randomUUID()}, ${row.legacyId}, ${workspaceId}, ${occurredAt}, ${row.type}, ${row.status}, true, ${row.description},
        ${row.categoryId}, ${row.partnerId}, ${row.projectId}, null, ${amount}, ${amount}, ${row.currency === "MUR" ? null : row.currency},
        ${amount}, 'ledger_import', ${actorUserId}, ${approvedBy}, ${approvedAt}
      )
      on conflict (legacy_id) do update set
        transaction_date = excluded.transaction_date,
        type = excluded.type,
        status = excluded.status,
        description = excluded.description,
        category_id = excluded.category_id,
        partner_id = excluded.partner_id,
        project_id = excluded.project_id,
        amount_minor = excluded.amount_minor,
        original_amount_minor = excluded.original_amount_minor,
        total_amount_minor = excluded.total_amount_minor,
        source = excluded.source,
        approved_by_user_id = excluded.approved_by_user_id,
        approved_at = excluded.approved_at,
        updated_at = now()
    `);
    if (row.categoryId !== null && row.accountCode !== null) {
      await tx.executor.execute(sql`
        update categories set account_code = ${row.accountCode}, account_label = ${row.accountLabel}
        where id = ${row.categoryId} and account_code is null
      `);
    }
  }
}

function upsertOfficeLedgerBulkFixture(fixtures: ApiFixtureStore, rows: readonly ResolvedLedgerRow[], workspaceId: string): void {
  if (rows.length === 0) {
    return;
  }
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  const added = rows.map((row: ResolvedLedgerRow): OfficeTransactionRow => ({
    id: randomUUID(),
    workspaceId,
    transactionDate: `${row.occurredOn}T00:00:00.000Z`,
    type: row.type,
    status: row.status,
    isActive: true,
    description: row.description,
    categoryId: row.categoryId,
    partnerId: row.partnerId,
    projectId: row.projectId,
    accountId: null,
    amountMinor: row.amountMinor,
    originalCurrency: row.currency === "MUR" ? null : (row.currency as CurrencyCode),
    exchangeRateE10: null
  }));
  mutableOffice.transactions = [...fixtures.office.transactions, ...added];
}

async function officePartnerPayeeUnlinkResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const partnerId = requirePathParam(context, "partnerId");
  const request = await readZodBody<OfficePartnerPayeeLinkRequest>(context, officePartnerPayeeUnlinkSchema);
  const before = toPartnerPayeeLink(dependencies.fixtures, requirePartner(dependencies.fixtures.office, partnerId));
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_partner_payee_unlink",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `identity-link:office:${partnerId}`);
      await persistOfficePartnerPayeeUnlink(tx, partnerId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_partner_payee_unlink",
        targetType: "identity_link",
        targetId: partnerId,
        before: { link: before },
        after: { partnerId, payeeId: null, status: "inactive" },
        idempotencyKey: resolvedIdempotencyKey
      });
      unlinkOfficePartnerPayeeFixture(dependencies.fixtures, partnerId);
      return mutationReceipt(partnerId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionMappingApplyRulesResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<DistributionMappingApplyRulesRequest>(context, distributionMappingApplyRulesSchema);
  const rows = request.rowIds.map((rowId) => requireDistributionMappingRow(dependencies.fixtures, rowId));
  // P7b: verify every requested row belongs to the stated batch — reject mismatched
  // rowIds that could silently apply rules across different import batches.
  const mismatch = rows.find((row) => row.batchId !== request.batchId);
  if (mismatch !== undefined) {
    throw new ApiRouteError(400, "mapping_row_batch_mismatch",
      "One or more mapping rows do not belong to the requested batch.",
      [`batchId=${request.batchId}`, `rowId=${mismatch.id}`, `rowBatchId=${mismatch.batchId}`]);
  }
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_mapping_apply_rules",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `distribution:mapping:${request.batchId}`);
      await persistDistributionMappingApplyRules(tx, rows);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_mapping_apply_rules",
        targetType: "distribution_mapping_batch",
        targetId: request.batchId,
        before: { rows },
        after: { rowIds: request.rowIds, status: "mapped" },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionMappingFixture(dependencies.fixtures, request.rowIds);
      return mutationReceipt(request.batchId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionContractExpenseCreateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const contractId = requirePathParam(context, "contractId");
  const request = await readZodBody<DistributionContractExpenseRecordRequest>(context, distributionContractExpenseRecordSchema);
  if (request.contractId !== contractId) {
    throw new ApiRouteError(400, "body_path_mismatch", "Contract expense body must match the route contract id.", [
      `pathContractId=${contractId}`,
      `bodyContractId=${request.contractId}`
    ]);
  }
  requireDistributionContract(dependencies, contractId);
  requireDistributionPayee(dependencies.fixtures.distribution, request.payeeId);
  const amount = normalizeErhAmountField(context, request.amountMicro, "amountMicro");
  const expenseId = randomUUID();
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_contract_expense_create",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `distribution:contract:${contractId}:expenses`);
      await persistDistributionContractExpenseCreate(tx, expenseId, { ...request, amountMicro: amount });
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_contract_expense_create",
        targetType: "contract_cost_term",
        targetId: expenseId,
        before: {},
        after: { expenseId, request: { ...request, amountMicro: amount } },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendDistributionContractExpenseFixture(dependencies.fixtures, expenseId, { ...request, amountMicro: amount });
      return mutationReceipt(expenseId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionContractUpsertResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<DistributionContractUpsertRequest>(context, distributionContractUpsertSchema);
  const contractId = request.id ?? randomUUID();
  const before = dependencies.fixtures.distributionContracts.find((contract) => contract.id === contractId) ?? null;
  if (request.payeeId !== null) {
    requireDistributionPayee(dependencies.fixtures.distribution, request.payeeId);
  }

  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_contract_upsert",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `distribution:contract:${contractId}`);
      await persistDistributionContractUpsert(tx, contractId, request);
      const after = distributionContractFromUpsertRequest(contractId, request, before);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_contract_upsert",
        targetType: "contract",
        targetId: contractId,
        before: { contract: before },
        after: { contract: after },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertDistributionContractFixture(dependencies.fixtures, after);
      return mutationReceipt(contractId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionContractExpenseUpdateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const contractId = requirePathParam(context, "contractId");
  const expenseId = requirePathParam(context, "expenseId");
  const request = await readZodBody<DistributionContractExpenseUpdateRequest>(context, distributionContractExpenseUpdateSchema);
  if (request.contractId !== contractId) {
    throw new ApiRouteError(400, "body_path_mismatch", "Contract expense body must match the route contract id.", [
      `pathContractId=${contractId}`,
      `bodyContractId=${request.contractId}`
    ]);
  }
  requireDistributionContract(dependencies, contractId);
  requireDistributionPayee(dependencies.fixtures.distribution, request.payeeId);
  const before = requireDistributionContractExpense(dependencies.fixtures, expenseId);
  const amount = normalizeErhAmountField(context, request.amountMicro, "amountMicro");
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_contract_expense_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `distribution:contract:${contractId}:expenses`);
      await persistDistributionContractExpenseUpdate(tx, expenseId, { ...request, amountMicro: amount });
      const after = distributionContractExpenseFromUpdateRequest(expenseId, { ...request, amountMicro: amount });
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_contract_expense_update",
        targetType: "contract_cost_term",
        targetId: expenseId,
        before: { expense: before },
        after: { expense: after },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertDistributionContractExpenseFixture(dependencies.fixtures, after);
      return mutationReceipt(expenseId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionPayeeUpsertResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<DistributionPayeeUpsertRequest>(context, distributionPayeeUpsertSchema);
  const payeeId = request.id ?? randomUUID();
  const before = dependencies.fixtures.distribution.payees.find((payee) => payee.id === payeeId) ?? null;
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_payee_upsert",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `distribution:payee:${payeeId}`);
      await persistDistributionPayeeUpsert(tx, payeeId, request);
      const after = distributionPayeeFromUpsertRequest(payeeId, request);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_payee_upsert",
        targetType: "payee",
        targetId: payeeId,
        before: { payee: before },
        after: { payee: after },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertDistributionPayeeFixture(dependencies.fixtures, after);
      return mutationReceipt(payeeId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionReleaseUpsertResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<DistributionReleaseUpsertRequest>(context, distributionReleaseUpsertSchema);
  const releaseId = request.id ?? randomUUID();
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_release_upsert",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `distribution:release:${releaseId}`);
      await persistDistributionReleaseUpsert(tx, releaseId, request);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_release_upsert",
        targetType: "release",
        targetId: releaseId,
        before: {},
        after: { releaseId, request },
        idempotencyKey: resolvedIdempotencyKey
      });
      return mutationReceipt(releaseId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionTrackUpsertResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<DistributionTrackUpsertRequest>(context, distributionTrackUpsertSchema);
  const trackId = request.id ?? randomUUID();
  const before = dependencies.fixtures.distribution.tracks.find((track) => track.id === trackId) ?? null;
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_track_upsert",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `distribution:track:${trackId}`);
      await persistDistributionTrackUpsert(tx, trackId, request);
      const after = distributionTrackFromUpsertRequest(trackId, request);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_track_upsert",
        targetType: "track",
        targetId: trackId,
        before: { track: before },
        after: { track: after },
        idempotencyKey: resolvedIdempotencyKey
      });
      upsertDistributionTrackFixture(dependencies.fixtures, after);
      return mutationReceipt(trackId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionAllocationUnpostResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const runId = requirePathParam(context, "runId");
  const request = await readZodBody<AllocationRunUnpostRequest>(context, allocationRunUnpostSchema);
  const run = requireDistributionAllocationRun(dependencies.fixtures.distribution, runId);
  const allocations = dependencies.fixtures.distribution.earningAllocations.filter((allocation) => allocation.calculationRunId === runId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiRunReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_allocations_unpost",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiRunReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `distribution:allocation:${runId}`);
      await persistDistributionAllocationUnpost(tx, runId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_allocations_unpost",
        targetType: "calculation_run",
        targetId: runId,
        before: { run, allocationCount: allocations.length },
        after: { status: "excluded", reason: request.reason, lockToken: request.lockToken },
        idempotencyKey: resolvedIdempotencyKey
      });
      unpostDistributionAllocationFixture(dependencies.fixtures, runId);
      return {
        runId,
        status: "completed",
        lockKey: `distribution:allocation:${runId}`,
        auditEventId
      };
    }
  });
  return context.json(result.body, result.status);
}

async function distributionSuspenseResolveResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const suspenseId = requirePathParam(context, "suspenseId");
  const request = await readZodBody<SuspenseResolveRequest>(context, suspenseResolveSchema);
  if (request.suspenseId !== suspenseId) {
    throw new ApiRouteError(400, "body_path_mismatch", "Suspense body must match the route suspense id.", [
      `pathSuspenseId=${suspenseId}`,
      `bodySuspenseId=${request.suspenseId}`
    ]);
  }
  const suspense = requireDistributionSuspenseItem(dependencies.fixtures.distribution, suspenseId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_suspense_resolve",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `distribution:suspense:${suspenseId}`);
      await persistDistributionSuspenseResolve(tx, suspenseId, dependencies.nowIso());
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_suspense_resolve",
        targetType: "suspense_item",
        targetId: suspenseId,
        before: { suspense },
        after: { resolution: request.resolution, targetId: request.targetId, note: request.note },
        idempotencyKey: resolvedIdempotencyKey
      });
      resolveDistributionSuspenseFixture(dependencies.fixtures, suspenseId, dependencies.nowIso());
      return mutationReceipt(suspenseId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function commandCenterSettingUpdateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<CommandCenterSettingUpdateRequest>(context, commandCenterSettingUpdateSchema);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const targetId = `${request.workspaceId}:setting:${request.key}`;
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "command_center_settings_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `command-center:settings:${request.workspaceId}:${request.key}`);
      await persistCommandCenterSettingUpdate(tx, request, actor.userId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "command_center_settings_update",
        targetType: "command_center_setting",
        targetId,
        before: {},
        after: {
          workspaceId: request.workspaceId,
          key: request.key,
          value: request.value,
          status: request.status
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      return mutationReceipt(targetId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function commandCenterIntegrationToggleResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const integrationId = requirePathParam(context, "integrationId");
  const request = await readZodBody<CommandCenterIntegrationToggleRequest>(context, commandCenterIntegrationToggleSchema);
  assertPathBodyMatch(context, "integrationId", integrationId, request.integrationId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const targetId = `${request.workspaceId}:integration:${request.integrationId}`;
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "command_center_integration_toggle",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `command-center:integration:${request.workspaceId}:${request.integrationId}`);
      await persistCommandCenterIntegrationToggle(tx, request, actor.userId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "command_center_integration_toggle",
        targetType: "command_center_integration",
        targetId,
        before: {},
        after: {
          workspaceId: request.workspaceId,
          integrationId: request.integrationId,
          enabled: request.enabled,
          status: request.status
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      return mutationReceipt(targetId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function commandCenterUserPermissionUpdateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const userId = requirePathParam(context, "userId");
  const request = await readZodBody<CommandCenterUserPermissionUpdateRequest>(context, commandCenterUserPermissionUpdateSchema);
  assertPathBodyMatch(context, "userId", userId, request.userId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const targetId = `${request.workspaceId}:user:${request.userId}`;
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "command_center_user_permission_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `command-center:user:${request.workspaceId}:${request.userId}`);
      await persistCommandCenterUserPermissionUpdate(tx, request, actor.userId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "command_center_user_permission_update",
        targetType: "command_center_user_permission",
        targetId,
        before: {},
        after: {
          workspaceId: request.workspaceId,
          userId: request.userId,
          email: request.email,
          role: request.role,
          permissions: request.permissions
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      return mutationReceipt(targetId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

function mutationReceipt(id: string, auditEventId: string): ApiMutationReceipt & ApiMutationResponse {
  return {
    id,
    status: "completed",
    auditEventId
  };
}

function queryRowsFromResult(result: unknown): readonly JsonRecord[] {
  if (typeof result === "object" && result !== null && Array.isArray((result as { readonly rows?: unknown }).rows)) {
    return (result as { readonly rows: readonly JsonRecord[] }).rows;
  }

  if (Array.isArray(result)) {
    return result.filter((row: unknown): row is JsonRecord => typeof row === "object" && row !== null);
  }

  return [];
}

function integerQueryField(row: JsonRecord | undefined, key: string): number {
  if (row === undefined) {
    return 0;
  }

  const value = row[key];
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    return Number.parseInt(value, 10);
  }

  return 0;
}

async function persistCommandCenterSettingUpdate(
  tx: ApiWriteTransaction,
  request: CommandCenterSettingUpdateRequest,
  actorUserId: string
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into command_center_settings (
      workspace_id,
      key,
      value_json,
      status,
      updated_by_user_id,
      updated_at
    )
    values (
      ${request.workspaceId},
      ${request.key},
      ${JSON.stringify(request.value)}::jsonb,
      ${request.status},
      ${actorUserId},
      now()
    )
    on conflict (workspace_id, key) do update
    set
      value_json = excluded.value_json,
      status = excluded.status,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now()
  `);
}

async function persistCommandCenterIntegrationToggle(
  tx: ApiWriteTransaction,
  request: CommandCenterIntegrationToggleRequest,
  actorUserId: string
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into command_center_integration_states (
      workspace_id,
      integration_id,
      enabled,
      status,
      updated_by_user_id,
      updated_at
    )
    values (
      ${request.workspaceId},
      ${request.integrationId},
      ${request.enabled},
      ${request.status},
      ${actorUserId},
      now()
    )
    on conflict (workspace_id, integration_id) do update
    set
      enabled = excluded.enabled,
      status = excluded.status,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now()
  `);
}

async function persistCommandCenterUserPermissionUpdate(
  tx: ApiWriteTransaction,
  request: CommandCenterUserPermissionUpdateRequest,
  actorUserId: string
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into command_center_user_permissions (
      workspace_id,
      user_id,
      email,
      role,
      permissions_json,
      updated_by_user_id,
      updated_at
    )
    values (
      ${request.workspaceId},
      ${request.userId},
      ${request.email},
      ${request.role},
      ${JSON.stringify(request.permissions)}::jsonb,
      ${actorUserId},
      now()
    )
    on conflict (workspace_id, user_id) do update
    set
      email = excluded.email,
      role = excluded.role,
      permissions_json = excluded.permissions_json,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = now()
  `);
}

function normalizeEofAmountField(context: ApiContext, value: string, field: string): bigint {
  try {
    return eofMoney.parse(value);
  } catch (error: unknown) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a valid scale-2 office money string.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
}

function requireOfficeTransaction(dataset: OfficeAnalyticsDataset, transactionId: string): OfficeTransactionRow {
  const transaction = dataset.transactions.find((candidate) => candidate.id === transactionId);
  if (transaction === undefined) {
    throw new ApiRouteError(404, "office_transaction_not_found", "Office transaction was not found.", [`transactionId=${transactionId}`]);
  }

  return transaction;
}

function transactionFromOfficeRequest(
  id: string,
  request: OfficeTransactionWriteRequest,
  amountMinor: bigint,
  transactionType: OfficeTransactionRow["type"],
  transactionStatus: OfficeTransactionRow["status"]
): OfficeTransactionRow {
  return {
    id,
    workspaceId: request.workspaceId,
    transactionDate: `${request.occurredOn}T00:00:00.000Z`,
    type: transactionType,
    status: transactionStatus,
    isActive: true,
    description: request.description.trim(),
    categoryId: request.categoryId,
    partnerId: null,
    projectId: request.projectId,
    accountId: request.accountId,
    amountMinor,
    originalCurrency: request.currency === "MUR" ? null : request.currency,
    exchangeRateE10: null
  };
}

function officeTransactionAuditSnapshot(transaction: OfficeTransactionRow): Readonly<Record<string, unknown>> {
  return {
    id: transaction.id,
    transactionDate: transaction.transactionDate,
    type: transaction.type,
    status: transaction.status,
    isActive: transaction.isActive,
    description: transaction.description,
    categoryId: transaction.categoryId,
    partnerId: transaction.partnerId,
    projectId: transaction.projectId,
    accountId: transaction.accountId,
    amountMinor: transaction.amountMinor.toString(),
    originalCurrency: transaction.originalCurrency,
    exchangeRateE10: transaction.exchangeRateE10 === null ? null : transaction.exchangeRateE10.toString()
  };
}

function officeBankAccountAuditSnapshot(account: OfficeBankAccountRow): Readonly<Record<string, unknown>> {
  return {
    id: account.id,
    workspaceId: account.workspaceId,
    bankName: account.bankName,
    accountLabel: account.accountLabel,
    accountReferenceHash: account.accountReferenceHash,
    currency: account.currency,
    currentBalanceMinor: account.currentBalanceMinor.toString(),
    currentBalanceMurMinor: account.currentBalanceMurMinor === null ? null : account.currentBalanceMurMinor.toString(),
    isActive: account.isActive,
    balanceAsOf: account.balanceAsOf
  };
}

function upsertOfficeTransactionFixture(fixtures: ApiFixtureStore, transaction: OfficeTransactionRow): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  const exists = fixtures.office.transactions.some((candidate) => candidate.id === transaction.id);
  mutableOffice.transactions = exists
    ? fixtures.office.transactions.map((candidate) => candidate.id === transaction.id ? transaction : candidate)
    : [transaction, ...fixtures.office.transactions];
}

async function persistOfficeTransactionUpsert(
  tx: ApiWriteTransaction,
  input: {
    readonly id: string;
    readonly request: OfficeTransactionWriteRequest;
    readonly amountMinor: bigint;
    readonly transactionType: OfficeTransactionRow["type"];
    readonly transactionStatus: OfficeTransactionRow["status"];
    readonly actorUserId: string;
    readonly isUpdate: boolean;
  }
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  const occurredAt = `${input.request.occurredOn}T00:00:00.000Z`;
  if (input.isUpdate) {
    await tx.executor.execute(sql`
      update transactions
      set
        transaction_date = ${occurredAt},
        type = ${input.transactionType},
        status = ${input.transactionStatus},
        description = ${input.request.description.trim()},
        category_id = ${input.request.categoryId},
        project_id = ${input.request.projectId},
        account_id = ${input.request.accountId},
        amount_minor = ${input.amountMinor.toString()},
        original_amount_minor = ${input.amountMinor.toString()},
        original_currency = ${input.request.currency === "MUR" ? null : input.request.currency},
        approved_by_user_id = ${input.transactionStatus === "validated" ? input.actorUserId : null},
        approved_at = ${input.transactionStatus === "validated" ? new Date().toISOString() : null},
        updated_at = now()
      where id = ${input.id}
    `);
    return;
  }

  await tx.executor.execute(sql`
    insert into transactions (
      id,
      workspace_id,
      transaction_date,
      type,
      status,
      is_active,
      description,
      category_id,
      project_id,
      account_id,
      amount_minor,
      original_amount_minor,
      original_currency,
      source,
      created_by_user_id,
      approved_by_user_id,
      approved_at
    )
    values (
      ${input.id},
      ${input.request.workspaceId},
      ${occurredAt},
      ${input.transactionType},
      ${input.transactionStatus},
      true,
      ${input.request.description.trim()},
      ${input.request.categoryId},
      ${input.request.projectId},
      ${input.request.accountId},
      ${input.amountMinor.toString()},
      ${input.amountMinor.toString()},
      ${input.request.currency === "MUR" ? null : input.request.currency},
      'manual',
      ${input.actorUserId},
      ${input.transactionStatus === "validated" ? input.actorUserId : null},
      ${input.transactionStatus === "validated" ? new Date().toISOString() : null}
    )
  `);
}

async function persistOfficeTransactionValidation(
  tx: ApiWriteTransaction,
  transactionId: string,
  actorUserId: string
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update transactions
    set
      status = 'validated',
      approved_by_user_id = ${actorUserId},
      approved_at = now(),
      updated_at = now()
    where id = ${transactionId}
  `);
}

async function persistOfficeTransactionCancellation(tx: ApiWriteTransaction, transactionId: string): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update transactions
    set
      status = 'cancelled',
      updated_at = now()
    where id = ${transactionId}
  `);
}

function assertPlanComptableRequest(context: ApiContext, dataset: OfficeAnalyticsDataset, request: OfficePlanComptableWriteRequest): void {
  if (request.kind === "department") {
    if (request.parentId !== null) {
      throw new ApiRouteError(400, "body_field_invalid", "Department nodes cannot have a parentId.", [`path=${context.req.path}`, "field=parentId"]);
    }
    return;
  }

  if (request.parentId === null) {
    throw new ApiRouteError(400, "body_field_required", "Division and category nodes require a parentId.", [`path=${context.req.path}`, "field=parentId"]);
  }

  if (request.kind === "division") {
    requireDepartment(dataset, request.parentId);
    return;
  }

  requireDivision(dataset, request.parentId);
  if (request.type === null) {
    throw new ApiRouteError(400, "body_field_required", "Category nodes require an income or expense type.", [`path=${context.req.path}`, "field=type"]);
  }
}

function requireDivision(dataset: OfficeAnalyticsDataset, divisionId: string): OfficeDivisionRow {
  const division = idMapOf(dataset.divisions).get(divisionId);
  if (division === undefined) {
    throw new ApiRouteError(404, "division_not_found", "Office division was not found.", [`divisionId=${divisionId}`]);
  }

  return division;
}

function requirePlanComptableNode(dataset: OfficeAnalyticsDataset, nodeId: string): OfficePlanComptableNode {
  const node = toPlanComptableNodes(dataset, true).find((candidate) => candidate.id === nodeId);
  if (node === undefined) {
    throw new ApiRouteError(404, "office_plan_node_not_found", "Office chart node was not found.", [`nodeId=${nodeId}`]);
  }

  return node;
}

function assertPlanComptableDeleteAllowed(
  context: ApiContext,
  node: OfficePlanComptableNode,
  counts: OfficePlanComptableDeleteCounts
): void {
  if (!hasPlanComptableDeleteDependencies(node.kind, counts)) {
    return;
  }

  throw planComptableDeleteBlockedError(context, node, counts);
}

function hasPlanComptableDeleteDependencies(
  kind: OfficePlanComptableNode["kind"],
  counts: OfficePlanComptableDeleteCounts
): boolean {
  if (kind === "department") {
    return counts.childDivisionCount > 0 || counts.financialAllocationCount > 0 || counts.projectDepartmentCount > 0;
  }

  if (kind === "division") {
    return counts.childCategoryCount > 0;
  }

  return counts.transactionCount > 0 || counts.projectBudgetLineCount > 0;
}

function planComptableDeleteBlockedError(
  context: ApiContext,
  node: OfficePlanComptableNode,
  counts: OfficePlanComptableDeleteCounts
): ApiRouteError {
  const contextLines: string[] = [`path=${context.req.path}`, `nodeId=${node.id}`, `kind=${node.kind}`];

  if (node.kind === "department") {
    contextLines.push(
      `childDivisionCount=${String(counts.childDivisionCount)}`,
      `financialAllocationCount=${String(counts.financialAllocationCount)}`,
      `projectDepartmentCount=${String(counts.projectDepartmentCount)}`
    );
    return new ApiRouteError(
      409,
      "office_plan_node_has_dependencies",
      "Department cannot be deleted while divisions, project links, or allocations still exist.",
      contextLines
    );
  }

  if (node.kind === "division") {
    contextLines.push(`childCategoryCount=${String(counts.childCategoryCount)}`);
    return new ApiRouteError(
      409,
      "office_plan_node_has_dependencies",
      "Division cannot be deleted while categories still exist.",
      contextLines
    );
  }

  contextLines.push(
    `transactionCount=${String(counts.transactionCount)}`,
    `projectBudgetLineCount=${String(counts.projectBudgetLineCount)}`
  );
  return new ApiRouteError(
    409,
    "office_plan_node_has_dependencies",
    "Category cannot be deleted while transactions or project budget lines still reference it.",
    contextLines
  );
}

function countOfficePlanComptableFixtureDependencies(
  dataset: OfficeAnalyticsDataset,
  nodeId: string,
  kind: OfficePlanComptableNode["kind"]
): OfficePlanComptableDeleteCounts {
  const nodeCount = kind === "department"
    ? dataset.departments.some((department: OfficeDepartmentRow): boolean => department.id === nodeId) ? 1 : 0
    : kind === "division"
      ? dataset.divisions.some((division: OfficeDivisionRow): boolean => division.id === nodeId) ? 1 : 0
      : dataset.categories.some((category: OfficeCategoryRow): boolean => category.id === nodeId) ? 1 : 0;

  if (kind === "department") {
    return {
      nodeCount,
      childDivisionCount: dataset.divisions.filter((division: OfficeDivisionRow): boolean => division.departmentId === nodeId).length,
      childCategoryCount: 0,
      transactionCount: 0,
      projectBudgetLineCount: 0,
      financialAllocationCount: dataset.financialAllocations.filter(
        (allocation): boolean => allocation.departmentId === nodeId
      ).length,
      projectDepartmentCount: 0
    };
  }

  if (kind === "division") {
    return {
      nodeCount,
      childDivisionCount: 0,
      childCategoryCount: dataset.categories.filter((category: OfficeCategoryRow): boolean => category.divisionId === nodeId).length,
      transactionCount: 0,
      projectBudgetLineCount: 0,
      financialAllocationCount: 0,
      projectDepartmentCount: 0
    };
  }

  return {
    nodeCount,
    childDivisionCount: 0,
    childCategoryCount: 0,
    transactionCount: dataset.transactions.filter((transaction: OfficeTransactionRow): boolean => transaction.categoryId === nodeId).length,
    projectBudgetLineCount: dataset.projectBudgetLines.filter((line): boolean => line.categoryId === nodeId).length,
    financialAllocationCount: 0,
    projectDepartmentCount: 0
  };
}

async function persistOfficePlanComptableCreate(tx: ApiWriteTransaction, nodeId: string, request: OfficePlanComptableWriteRequest): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  const slug = slugify(request.code, request.label);
  if (request.kind === "department") {
    await tx.executor.execute(sql`
      insert into departments (id, name, slug, type, is_active)
      values (${nodeId}, ${request.label.trim()}, ${slug}, ${request.type ?? "mixed"}, ${request.active})
    `);
    return;
  }

  if (request.kind === "division") {
    await tx.executor.execute(sql`
      insert into divisions (id, department_id, name, slug, is_active)
      values (${nodeId}, ${request.parentId}, ${request.label.trim()}, ${slug}, ${request.active})
    `);
    return;
  }

  await tx.executor.execute(sql`
    insert into categories (id, name, type, division_id, is_active)
    values (${nodeId}, ${request.label.trim()}, ${request.type}, ${request.parentId}, ${request.active})
  `);
}

async function persistOfficePlanComptableUpdate(tx: ApiWriteTransaction, nodeId: string, request: OfficePlanComptableWriteRequest): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  const slug = slugify(request.code, request.label);
  if (request.kind === "department") {
    await tx.executor.execute(sql`
      update departments
      set name = ${request.label.trim()}, slug = ${slug}, type = ${request.type ?? "mixed"}, is_active = ${request.active}
      where id = ${nodeId}
    `);
    return;
  }

  if (request.kind === "division") {
    await tx.executor.execute(sql`
      update divisions
      set department_id = ${request.parentId}, name = ${request.label.trim()}, slug = ${slug}, is_active = ${request.active}
      where id = ${nodeId}
    `);
    return;
  }

  await tx.executor.execute(sql`
    update categories
    set name = ${request.label.trim()}, type = ${request.type}, division_id = ${request.parentId}, is_active = ${request.active}
    where id = ${nodeId}
  `);
}

async function persistOfficePlanComptableDelete(
  tx: ApiWriteTransaction,
  nodeId: string,
  kind: OfficePlanComptableNode["kind"]
): Promise<OfficePlanComptableDeleteCounts> {
  if (tx.kind === "memory") {
    return {
      nodeCount: 1,
      childDivisionCount: 0,
      childCategoryCount: 0,
      transactionCount: 0,
      projectBudgetLineCount: 0,
      financialAllocationCount: 0,
      projectDepartmentCount: 0
    };
  }

  if (kind === "department") {
    const rows = queryRowsFromResult(await tx.executor.execute(sql`
      with dependency_counts as (
        select
          (select count(*) from divisions where department_id = ${nodeId})::int as child_division_count,
          0::int as child_category_count,
          0::int as transaction_count,
          0::int as project_budget_line_count,
          (select count(*) from financial_allocations where department_id = ${nodeId})::int as financial_allocation_count,
          (select count(*) from project_departments where department_id = ${nodeId})::int as project_department_count
      ),
      deleted_node as (
        delete from departments
        where id = ${nodeId}
          and (select child_division_count from dependency_counts) = 0
          and (select financial_allocation_count from dependency_counts) = 0
          and (select project_department_count from dependency_counts) = 0
        returning id
      )
      select
        (select count(*) from deleted_node)::int as node_count,
        dependency_counts.child_division_count,
        dependency_counts.child_category_count,
        dependency_counts.transaction_count,
        dependency_counts.project_budget_line_count,
        dependency_counts.financial_allocation_count,
        dependency_counts.project_department_count
      from dependency_counts
    `));
    return readOfficePlanComptableDeleteCounts(rows[0]);
  }

  if (kind === "division") {
    const rows = queryRowsFromResult(await tx.executor.execute(sql`
      with dependency_counts as (
        select
          0::int as child_division_count,
          (select count(*) from categories where division_id = ${nodeId})::int as child_category_count,
          0::int as transaction_count,
          0::int as project_budget_line_count,
          0::int as financial_allocation_count,
          0::int as project_department_count
      ),
      deleted_node as (
        delete from divisions
        where id = ${nodeId}
          and (select child_category_count from dependency_counts) = 0
        returning id
      )
      select
        (select count(*) from deleted_node)::int as node_count,
        dependency_counts.child_division_count,
        dependency_counts.child_category_count,
        dependency_counts.transaction_count,
        dependency_counts.project_budget_line_count,
        dependency_counts.financial_allocation_count,
        dependency_counts.project_department_count
      from dependency_counts
    `));
    return readOfficePlanComptableDeleteCounts(rows[0]);
  }

  const rows = queryRowsFromResult(await tx.executor.execute(sql`
    with dependency_counts as (
      select
        0::int as child_division_count,
        0::int as child_category_count,
        (select count(*) from transactions where category_id = ${nodeId})::int as transaction_count,
        (select count(*) from project_budget_lines where category_id = ${nodeId})::int as project_budget_line_count,
        0::int as financial_allocation_count,
        0::int as project_department_count
    ),
    deleted_node as (
      delete from categories
      where id = ${nodeId}
        and (select transaction_count from dependency_counts) = 0
        and (select project_budget_line_count from dependency_counts) = 0
      returning id
    )
    select
      (select count(*) from deleted_node)::int as node_count,
      dependency_counts.child_division_count,
      dependency_counts.child_category_count,
      dependency_counts.transaction_count,
      dependency_counts.project_budget_line_count,
      dependency_counts.financial_allocation_count,
      dependency_counts.project_department_count
    from dependency_counts
  `));
  return readOfficePlanComptableDeleteCounts(rows[0]);
}

function readOfficePlanComptableDeleteCounts(row: JsonRecord | undefined): OfficePlanComptableDeleteCounts {
  return {
    nodeCount: integerQueryField(row, "node_count"),
    childDivisionCount: integerQueryField(row, "child_division_count"),
    childCategoryCount: integerQueryField(row, "child_category_count"),
    transactionCount: integerQueryField(row, "transaction_count"),
    projectBudgetLineCount: integerQueryField(row, "project_budget_line_count"),
    financialAllocationCount: integerQueryField(row, "financial_allocation_count"),
    projectDepartmentCount: integerQueryField(row, "project_department_count")
  };
}

function upsertOfficePlanComptableFixture(fixtures: ApiFixtureStore, nodeId: string, request: OfficePlanComptableWriteRequest): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  if (request.kind === "department") {
    const department: OfficeDepartmentRow = { id: nodeId, name: request.label.trim(), type: request.type ?? "mixed", color: null, isActive: request.active };
    mutableOffice.departments = upsertById(fixtures.office.departments, department);
    return;
  }

  if (request.kind === "division") {
    const division: OfficeDivisionRow = { id: nodeId, departmentId: request.parentId ?? "", name: request.label.trim(), isActive: request.active };
    mutableOffice.divisions = upsertById(fixtures.office.divisions, division);
    return;
  }

  const category: OfficeCategoryRow = { id: nodeId, divisionId: request.parentId, name: request.label.trim(), type: request.type ?? "expense", isActive: request.active };
  mutableOffice.categories = upsertById(fixtures.office.categories, category);
}

function deleteOfficePlanComptableFixture(
  fixtures: ApiFixtureStore,
  nodeId: string,
  kind: OfficePlanComptableNode["kind"]
): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  if (kind === "department") {
    mutableOffice.departments = fixtures.office.departments.filter((department: OfficeDepartmentRow): boolean => department.id !== nodeId);
    return;
  }

  if (kind === "division") {
    mutableOffice.divisions = fixtures.office.divisions.filter((division: OfficeDivisionRow): boolean => division.id !== nodeId);
    return;
  }

  mutableOffice.categories = fixtures.office.categories.filter((category: OfficeCategoryRow): boolean => category.id !== nodeId);
}

function slugify(code: string, label: string): string {
  return `${code}-${label}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function requireReconciliationCandidate(dataset: OfficeAnalyticsDataset, reconciliationId: string): OfficeReconciliationCandidate {
  const candidate = toReconciliationCandidates(dataset).find((item) => item.id === reconciliationId);
  if (candidate === undefined) {
    throw new ApiRouteError(404, "office_reconciliation_not_found", "Office reconciliation candidate was not found.", [
      `reconciliationId=${reconciliationId}`
    ]);
  }

  return candidate;
}

async function persistOfficeReconciliationApproval(
  tx: ApiWriteTransaction,
  request: OfficeReconciliationApproveRequest,
  actorUserId: string,
  candidates: readonly OfficeReconciliationCandidate[]
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  for (const candidate of candidates) {
    if (candidate.id.startsWith("recon_")) {
      await tx.executor.execute(sql`
        insert into office_bank_reconciliation_matches (
          id,
          bank_statement_line_id,
          transaction_id,
          confidence_bp,
          status,
          approved_by_user_id,
          approved_at
        )
        values (
          ${randomUUID()},
          ${candidate.statementLineId},
          ${candidate.transactionId},
          ${candidate.confidenceBp},
          'matched',
          ${actorUserId},
          ${request.approvedAt}
        )
        on conflict (bank_statement_line_id, transaction_id) do update
        set status = 'matched', approved_by_user_id = excluded.approved_by_user_id, approved_at = excluded.approved_at, updated_at = now()
      `);
    } else {
      await tx.executor.execute(sql`
        update office_bank_reconciliation_matches
        set status = 'matched', approved_by_user_id = ${actorUserId}, approved_at = ${request.approvedAt}, updated_at = now()
        where id = ${candidate.id}
      `);
    }

    await tx.executor.execute(sql`
      update office_bank_statement_lines
      set reconciliation_status = 'matched', matched_transaction_id = ${candidate.transactionId}
      where id = ${candidate.statementLineId}
    `);
    await tx.executor.execute(sql`
      update transactions
      set status = 'validated', is_fully_reconciled = true, approved_by_user_id = ${actorUserId}, approved_at = ${request.approvedAt}, updated_at = now()
      where id = ${candidate.transactionId}
    `);
  }
}

function approveReconciliationFixture(
  fixtures: ApiFixtureStore,
  candidates: readonly OfficeReconciliationCandidate[],
  approvedAt: string,
  actorUserId: string
): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  mutableOffice.bankStatementLines = fixtures.office.bankStatementLines.map((line) => {
    const candidate = candidates.find((item) => item.statementLineId === line.id);
    if (candidate === undefined) {
      return line;
    }

    return { ...line, reconciliationStatus: "matched", matchedTransactionId: candidate.transactionId };
  });
  mutableOffice.transactions = fixtures.office.transactions.map((transaction) =>
    candidates.some((candidate) => candidate.transactionId === transaction.id)
      ? { ...transaction, status: "validated" }
      : transaction
  );
  mutableOffice.bankReconciliationMatches = [
    ...fixtures.office.bankReconciliationMatches.filter((match) => !candidates.some((candidate) => candidate.id === match.id)),
    ...candidates.map((candidate) => ({
      id: candidate.id.startsWith("recon_") ? randomUUID() : candidate.id,
      bankStatementLineId: candidate.statementLineId,
      transactionId: candidate.transactionId,
      confidenceBp: candidate.confidenceBp,
      status: "matched" as const,
      approvedByUserId: actorUserId,
      approvedAt
    }))
  ];
}

async function persistOfficePartnerUpsert(tx: ApiWriteTransaction, partnerId: string, request: OfficePartnerWriteRequest, isUpdate: boolean): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  if (isUpdate) {
    await tx.executor.execute(sql`
      update partners
      set
        name = ${request.name.trim()},
        email = ${request.email},
        phone = ${request.phone},
        address = ${request.address},
        tax_id = ${request.taxId},
        notes = ${request.notes},
        is_active = ${request.active}
      where id = ${partnerId}
    `);
    return;
  }

  await tx.executor.execute(sql`
    insert into partners (id, name, type, email, phone, address, tax_id, notes, is_active)
    values (${partnerId}, ${request.name.trim()}, 'both', ${request.email}, ${request.phone}, ${request.address}, ${request.taxId}, ${request.notes}, ${request.active})
  `);
}

function upsertOfficePartnerFixture(fixtures: ApiFixtureStore, partnerId: string, request: OfficePartnerWriteRequest): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  const existing = fixtures.office.partners.find((partner) => partner.id === partnerId);
  const partner: OfficePartnerRow = {
    id: partnerId,
    name: request.name.trim(),
    type: existing?.type ?? "both",
    isActive: request.active
  };
  mutableOffice.partners = upsertById(fixtures.office.partners, partner);
}

async function persistOfficePartnerPayeeUnlink(tx: ApiWriteTransaction, partnerId: string): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update identity_link
    set status = 'archived', updated_at = now()
    where office_partner_id = ${partnerId}
      and status <> 'archived'
  `);
}

function unlinkOfficePartnerPayeeFixture(fixtures: ApiFixtureStore, partnerId: string): void {
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  const entries = Object.entries(fixtures.officePartnerPayeeLinks).filter(([id]) => id !== partnerId);
  mutableFixtures.officePartnerPayeeLinks = Object.fromEntries(entries);
}

function requireDistributionMappingRow(fixtures: ApiFixtureStore, rowId: string): DistributionMappingRow {
  const row = fixtures.distributionMappingRows.find((candidate) => candidate.id === rowId);
  if (row === undefined) {
    throw new ApiRouteError(404, "distribution_mapping_row_not_found", "Distribution mapping row was not found.", [`rowId=${rowId}`]);
  }

  if (row.suggestedTrackId === null) {
    throw new ApiRouteError(422, "distribution_mapping_target_missing", "Mapping row cannot be applied without a suggested track.", [`rowId=${rowId}`]);
  }

  return row;
}

async function persistDistributionMappingApplyRules(tx: ApiWriteTransaction, rows: readonly DistributionMappingRow[]): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  for (const row of rows) {
    await tx.executor.execute(sql`
      update normalized_earnings
      set mapping_status = 'matched', calculation_status = 'pending', updated_at = now()
      where id = ${row.id}
    `);
    await tx.executor.execute(sql`
      with updated as (
        update earning_track_matches
        set confidence = ${(row.confidenceBp / 100).toFixed(6)}, status = 'matched'
        where earning_id = ${row.id} and track_id = ${row.suggestedTrackId}
        returning id
      )
      insert into earning_track_matches (id, earning_id, track_id, confidence, status)
      select ${randomUUID()}, ${row.id}, ${row.suggestedTrackId}, ${(row.confidenceBp / 100).toFixed(6)}, 'matched'
      where not exists (select 1 from updated)
    `);
  }
}

function applyDistributionMappingFixture(fixtures: ApiFixtureStore, rowIds: readonly string[]): void {
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  mutableFixtures.distributionMappingRows = fixtures.distributionMappingRows.map((row) =>
    rowIds.includes(row.id) ? { ...row, status: "mapped" } : row
  );
  const mutableDistribution = fixtures.distribution as Mutable<DistributionReadDataset>;
  mutableDistribution.normalizedEarnings = fixtures.distribution.normalizedEarnings.map((earning) =>
    rowIds.includes(earning.id) ? { ...earning, mappingStatus: "matched", calculationStatus: "pending" } : earning
  );
}

async function persistDistributionContractExpenseCreate(
  tx: ApiWriteTransaction,
  expenseId: string,
  request: DistributionContractExpenseRecordRequest
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into contract_cost_terms (
      id,
      contract_id,
      payee_id,
      amount,
      currency,
      recoupable,
      recovery_method,
      status,
      scope_type,
      scope_id
    )
    values (
      ${expenseId},
      ${request.contractId},
      ${request.payeeId},
      ${request.amountMicro},
      ${request.currency},
      true,
      'statement_recoupment',
      'open',
      'operator_expense',
      ${request.incurredOn}
    )
  `);
}

function appendDistributionContractExpenseFixture(
  fixtures: ApiFixtureStore,
  expenseId: string,
  request: DistributionContractExpenseRecordRequest
): void {
  const expense: DistributionContractExpense = {
    id: expenseId,
    contractId: request.contractId,
    payeeId: request.payeeId,
    incurredOn: request.incurredOn,
    label: request.label.trim(),
    originalAmountMicro: request.amountMicro,
    openAmountMicro: request.amountMicro,
    currency: request.currency,
    status: "open"
  };
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  mutableFixtures.distributionContractExpenses = [expense, ...fixtures.distributionContractExpenses];
  mutableFixtures.distributionCostTerms = [
    {
      id: expenseId,
      contractId: request.contractId,
      payeeId: request.payeeId,
      amount: request.amountMicro,
      currency: request.currency,
      recoupable: true,
      status: "open",
      expenseDate: request.incurredOn
    },
    ...fixtures.distributionCostTerms
  ];
}

async function persistDistributionContractUpsert(
  tx: ApiWriteTransaction,
  contractId: string,
  request: DistributionContractUpsertRequest
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into contracts (
      id,
      title,
      status,
      effective_from,
      effective_to,
      metadata
    )
    values (
      ${contractId},
      ${request.title.trim()},
      ${apiContractStatusToDb(request.status)},
      ${request.effectiveFrom},
      ${request.effectiveTo},
      ${JSON.stringify({
        workspaceId: request.workspaceId,
        requestedPayeeId: request.payeeId,
        requestedSplitBp: request.splitBp,
        requestedCurrency: request.currency
      })}::jsonb
    )
    on conflict (id) do update
    set
      title = excluded.title,
      status = excluded.status,
      effective_from = excluded.effective_from,
      effective_to = excluded.effective_to,
      metadata = contracts.metadata || excluded.metadata,
      updated_at = now()
  `);
}

function distributionContractFromUpsertRequest(
  contractId: string,
  request: DistributionContractUpsertRequest,
  before: DistributionContract | null
): DistributionContract {
  return {
    id: contractId,
    payeeId: request.payeeId ?? before?.payeeId ?? "unassigned",
    title: request.title.trim(),
    status: request.status,
    effectiveFrom: request.effectiveFrom,
    effectiveTo: request.effectiveTo,
    splitBp: request.splitBp,
    openExpenseMicro: before?.openExpenseMicro ?? "0.0000000000",
    currency: request.currency
  };
}

function upsertDistributionContractFixture(fixtures: ApiFixtureStore, contract: DistributionContract): void {
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  mutableFixtures.distributionContracts = upsertById(fixtures.distributionContracts, contract);
}

async function persistDistributionContractExpenseUpdate(
  tx: ApiWriteTransaction,
  expenseId: string,
  request: DistributionContractExpenseUpdateRequest
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update contract_cost_terms
    set
      payee_id = ${request.payeeId},
      amount = ${request.amountMicro},
      currency = ${request.currency},
      status = ${apiExpenseStatusToDb(request.status)},
      scope_id = ${request.incurredOn},
      updated_at = now()
    where id = ${expenseId}
  `);
}

function distributionContractExpenseFromUpdateRequest(
  expenseId: string,
  request: DistributionContractExpenseUpdateRequest
): DistributionContractExpense {
  return {
    id: expenseId,
    contractId: request.contractId,
    payeeId: request.payeeId,
    incurredOn: request.incurredOn,
    label: request.label.trim(),
    originalAmountMicro: request.amountMicro,
    openAmountMicro: request.status === "open" ? request.amountMicro : "0.0000000000",
    currency: request.currency,
    status: request.status
  };
}

function requireDistributionContractExpense(fixtures: ApiFixtureStore, expenseId: string): DistributionContractExpense {
  const expense = fixtures.distributionContractExpenses.find((candidate) => candidate.id === expenseId);
  if (expense === undefined) {
    throw new ApiRouteError(404, "distribution_contract_expense_not_found", "Distribution contract expense was not found.", [
      `expenseId=${expenseId}`
    ]);
  }

  return expense;
}

function upsertDistributionContractExpenseFixture(fixtures: ApiFixtureStore, expense: DistributionContractExpense): void {
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  mutableFixtures.distributionContractExpenses = upsertById(fixtures.distributionContractExpenses, expense);
  mutableFixtures.distributionCostTerms = upsertById(fixtures.distributionCostTerms, {
    id: expense.id,
    contractId: expense.contractId,
    payeeId: expense.payeeId,
    amount: expense.originalAmountMicro,
    currency: expense.currency,
    recoupable: true,
    status: apiExpenseStatusToCostTermStatus(expense.status),
    expenseDate: expense.incurredOn
  });
}

async function persistDistributionPayeeUpsert(
  tx: ApiWriteTransaction,
  payeeId: string,
  request: DistributionPayeeUpsertRequest
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into payees (
      id,
      name,
      preferred_currency,
      is_active
    )
    values (
      ${payeeId},
      ${request.displayName.trim()},
      ${request.defaultCurrency},
      ${request.status === "active"}
    )
    on conflict (id) do update
    set
      name = excluded.name,
      preferred_currency = excluded.preferred_currency,
      is_active = excluded.is_active,
      updated_at = now()
  `);
}

function distributionPayeeFromUpsertRequest(
  payeeId: string,
  request: DistributionPayeeUpsertRequest
): DistributionReadDataset["payees"][number] {
  return {
    id: payeeId,
    name: request.displayName.trim(),
    preferredCurrency: request.defaultCurrency as CurrencyCode,
    isActive: request.status === "active"
  };
}

function upsertDistributionPayeeFixture(fixtures: ApiFixtureStore, payee: DistributionReadDataset["payees"][number]): void {
  const mutableDistribution = fixtures.distribution as Mutable<DistributionReadDataset>;
  mutableDistribution.payees = upsertById(fixtures.distribution.payees, payee);
}

async function persistDistributionReleaseUpsert(
  tx: ApiWriteTransaction,
  releaseId: string,
  request: DistributionReleaseUpsertRequest
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into releases (
      id,
      title,
      upc,
      label_name,
      release_date
    )
    values (
      ${releaseId},
      ${request.title.trim()},
      ${request.upc},
      ${request.artistName.trim()},
      ${request.releaseDate}
    )
    on conflict (id) do update
    set
      title = excluded.title,
      upc = excluded.upc,
      label_name = excluded.label_name,
      release_date = excluded.release_date,
      updated_at = now()
  `);
}

async function persistDistributionTrackUpsert(
  tx: ApiWriteTransaction,
  trackId: string,
  request: DistributionTrackUpsertRequest
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into tracks (
      id,
      title,
      isrc,
      release_id
    )
    values (
      ${trackId},
      ${request.title.trim()},
      ${request.isrc},
      ${request.releaseId}
    )
    on conflict (id) do update
    set
      title = excluded.title,
      isrc = excluded.isrc,
      release_id = excluded.release_id,
      updated_at = now()
  `);
}

function distributionTrackFromUpsertRequest(
  trackId: string,
  request: DistributionTrackUpsertRequest
): DistributionReadDataset["tracks"][number] {
  return {
    id: trackId,
    title: request.title.trim(),
    isrc: request.isrc,
    releaseId: request.releaseId
  };
}

function upsertDistributionTrackFixture(fixtures: ApiFixtureStore, track: DistributionReadDataset["tracks"][number]): void {
  const mutableDistribution = fixtures.distribution as Mutable<DistributionReadDataset>;
  mutableDistribution.tracks = upsertById(fixtures.distribution.tracks, track);
}

function apiContractStatusToDb(status: DistributionContract["status"]): string {
  if (status === "ended") {
    return "expired";
  }

  return status;
}

function apiExpenseStatusToDb(status: DistributionContractExpense["status"]): string {
  if (status === "recouped") {
    return "recovered";
  }

  if (status === "waived") {
    return "non_recoverable";
  }

  return "open";
}

function apiExpenseStatusToCostTermStatus(status: DistributionContractExpense["status"]): DistributionCostTermInput["status"] {
  if (status === "recouped") {
    return "recovered";
  }

  if (status === "waived") {
    return "non_recoverable";
  }

  return "open";
}

function requireDistributionAllocationRun(dataset: DistributionReadDataset, runId: string): DistributionCalculationRunRow {
  const run = dataset.calculationRuns.find((candidate) => candidate.id === runId);
  if (run === undefined) {
    throw new ApiRouteError(404, "allocation_run_not_found", "Distribution allocation run was not found.", [`runId=${runId}`]);
  }

  return run;
}

async function persistDistributionAllocationUnpost(tx: ApiWriteTransaction, runId: string): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update calculation_runs
    set status = 'excluded', finished_at = now()
    where id = ${runId}
  `);
  await tx.executor.execute(sql`
    update earning_allocations
    set status = 'void'
    where calculation_run_id = ${runId}
  `);
  // P3a: return earnings to 'pending' so future runs can pick them up again.
  await tx.executor.execute(sql`
    update normalized_earnings
    set calculation_status = 'pending'
    where id in (
      select earning_id from earning_allocations where calculation_run_id = ${runId}
    )
  `);
  // P3b: delete the expense_applications this run created, then reset any
  // cost_terms whose entire applied balance is now gone back to 'open'.
  await tx.executor.execute(sql`
    with deleted_apps as (
      delete from expense_applications
      where calculation_run_id = ${runId}
      returning cost_term_id
    )
    update contract_cost_terms
    set status = 'open'
    where id in (select cost_term_id from deleted_apps)
      and status in ('recovered', 'satisfied', 'partially_recovered')
      and not exists (
        select 1 from expense_applications
        where cost_term_id = contract_cost_terms.id
      )
  `);
}

function unpostDistributionAllocationFixture(fixtures: ApiFixtureStore, runId: string): void {
  const mutableDistribution = fixtures.distribution as Mutable<DistributionReadDataset>;
  mutableDistribution.calculationRuns = fixtures.distribution.calculationRuns.map((run) =>
    run.id === runId ? { ...run, status: "excluded", finishedAt: run.finishedAt ?? new Date().toISOString() } : run
  );
  // P3a: collect affected earningIds before voiding allocations so we can reset their status.
  const allocatedEarningIds = new Set<string>(
    fixtures.distribution.earningAllocations
      .filter((alloc) => alloc.calculationRunId === runId)
      .map((alloc) => alloc.earningId)
  );
  mutableDistribution.earningAllocations = fixtures.distribution.earningAllocations.map((allocation) =>
    allocation.calculationRunId === runId ? { ...allocation, status: "void" } : allocation
  );
  // P3a: reset calculationStatus back to 'pending' for all affected earnings.
  mutableDistribution.normalizedEarnings = fixtures.distribution.normalizedEarnings.map((earning) =>
    allocatedEarningIds.has(earning.id) ? { ...earning, calculationStatus: "pending" } : earning
  );
  // P3b: remove expense_applications from this run and reset cost_terms that
  // no longer have any remaining applications.
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  const removedTermIds = new Set<string>(
    fixtures.distributionExpenseApplications
      .filter((app) => app.calculationRunId === runId)
      .map((app) => app.costTermId)
  );
  mutableFixtures.distributionExpenseApplications = fixtures.distributionExpenseApplications.filter(
    (app) => app.calculationRunId !== runId
  );
  // Reset cost_terms that have no remaining expense_applications back to 'open'.
  const remainingTermIds = new Set<string>(
    mutableFixtures.distributionExpenseApplications.map((app) => app.costTermId)
  );
  mutableFixtures.distributionCostTerms = fixtures.distributionCostTerms.map((term) =>
    removedTermIds.has(term.id) && !remainingTermIds.has(term.id) && (term.status === "recovered" || term.status === "satisfied" || term.status === "partially_recovered")
      ? { ...term, status: "open" }
      : term
  );
}

function requireDistributionSuspenseItem(dataset: DistributionReadDataset, suspenseId: string): DistributionReadDataset["suspenseItems"][number] {
  const suspense = dataset.suspenseItems.find((candidate) => candidate.id === suspenseId);
  if (suspense === undefined) {
    throw new ApiRouteError(404, "distribution_suspense_not_found", "Distribution suspense item was not found.", [`suspenseId=${suspenseId}`]);
  }

  return suspense;
}

async function persistDistributionSuspenseResolve(tx: ApiWriteTransaction, suspenseId: string, resolvedAt: string): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update suspense_items
    set resolved = true, resolved_at = ${resolvedAt}
    where id = ${suspenseId}
  `);
}

function resolveDistributionSuspenseFixture(fixtures: ApiFixtureStore, suspenseId: string, resolvedAt: string): void {
  const mutableDistribution = fixtures.distribution as Mutable<DistributionReadDataset>;
  mutableDistribution.suspenseItems = fixtures.distribution.suspenseItems.map((suspense) =>
    suspense.id === suspenseId ? { ...suspense, resolved: true, resolvedAt } : suspense
  );
}

function upsertById<TItem extends { readonly id: string }>(items: readonly TItem[], item: TItem): readonly TItem[] {
  const exists = items.some((candidate) => candidate.id === item.id);
  if (!exists) {
    return [item, ...items];
  }

  return items.map((candidate) => candidate.id === item.id ? item : candidate);
}

async function distributionAllocationPreviewResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readJsonBody<AllocationRunPreviewRequest>(context);
  assertAllocationRunPreviewRequest(context, request);
  requirePermissionForWorkspace(context.get("authUser"), "distribution_allocations_preview", request.workspaceId);
  const runId = previewIdFor("allocation-run", `${request.period}:${request.lockKey}`);
  const plan = buildAllocationExecutionPlan(dependencies, request.period, request.lockKey, runId);
  return context.json(toAllocationRunPlanResponse(plan, null));
}

async function distributionAllocationRunResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readJsonBody<AllocationRunStartRequest>(context);
  assertAllocationRunStartRequest(context, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<AllocationRunMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_allocations_run",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<AllocationRunMutationResponse> => {
      await acquireAdvisoryLock(tx, request.lockKey);
      const runId = randomUUID();
      const plan = buildAllocationExecutionPlan(dependencies, request.period, request.lockKey, runId);
      const persistedAllocations = plan.allocations.map((allocation): PersistedEarningAllocationInsert => ({
        id: randomUUID(),
        ...allocation
      }));
      const startedAtIso = dependencies.nowIso();
      const finishedAtIso = dependencies.nowIso();
      const persistInput: PersistDistributionAllocationRunInput = {
        runId,
        batchId: plan.batchId,
        startedAtIso,
        finishedAtIso,
        allocations: persistedAllocations,
        expenseApplications: plan.expenseApplications,
        costTermStatusUpdates: plan.costTermStatusUpdates,
        suspenseItems: plan.suspenseItems,
        metadata: {
          workspaceId: request.workspaceId,
          period: request.period,
          lockKey: request.lockKey,
          cadence: request.cadence,
          earningCount: plan.pendingEarnings.length,
          allocationCount: plan.allocations.length,
          suspenseCount: plan.suspenseItems.length
        }
      };
      await persistDistributionAllocationRun(tx, persistInput);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_allocations_run",
        targetType: "calculation_run",
        targetId: runId,
        before: {},
        after: {
          period: request.period,
          lockKey: request.lockKey,
          earningCount: plan.pendingEarnings.length,
          allocationCount: plan.allocations.length,
          expenseApplicationCount: plan.expenseApplications.length,
          costTermUpdateCount: plan.costTermStatusUpdates.length,
          suspenseCount: plan.suspenseItems.length
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendAllocationRunFixture(dependencies.fixtures, persistInput);
      return toAllocationRunPlanResponse(plan, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionStatementGenerateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readJsonBody<StatementGenerateRequest>(context);
  assertStatementGenerateRequest(context, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<StatementGenerateMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_statement_generate",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<StatementGenerateMutationResponse> => {
      await acquireAdvisoryLock(tx, request.lockKey);
      const runId = randomUUID();
      const plan = buildStatementGenerateExecutionPlan(dependencies, request, runId);
      for (const statementPlan of plan.statementPlans) {
        await acquireAdvisoryLock(tx, statementLockKey(statementPlan.statement.payeeId, statementPlan.statement.periodStart, statementPlan.statement.currency));
      }

      await persistDistributionStatements(tx, {
        statements: plan.statementPlans
      });
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_statement_generate",
        targetType: "statement_generation_run",
        targetId: runId,
        before: {},
        after: {
          workspaceId: request.workspaceId,
          period: request.period,
          payeeIds: request.payeeIds,
          statementCount: plan.statementPlans.length,
          lineCount: statementLineCount(plan.statementPlans),
          balanceLedgerRowCount: plan.statementPlans.length
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendStatementGenerateFixture(dependencies.fixtures, plan, dependencies.nowIso());
      return toStatementGenerateResponse(plan, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionStatementVoidResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const body = await readOptionalJsonBody(context);
  const idempotencyKey = requireIdempotencyKey(context);
  const statementId = requirePathParam(context, "statementId");
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<StatementVoidMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_statement_void",
    route: context.req.path,
    idempotencyKey,
    requestBody: body,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<StatementVoidMutationResponse> => {
      const statement = requireStatementForVoid(dependencies, statementId);
      const ledgerRow = requireStatementLedgerRow(dependencies, statementId);
      // P4a: use the same lock key as payment mutations so void and payment
      // operations on the same statement are fully serialized.
      await acquireAdvisoryLock(tx, `distribution:payment:statement:${statementId}`);
      const voidPlan = buildVoidPlan({ id: statement.id, status: statement.status }, ledgerRow);
      const persistInput: PersistDistributionStatementVoidInput = {
        statementId,
        status: voidPlan.statementStatusUpdate.status,
        reversalLedgerRow: voidPlan.reversalLedgerRow
      };
      await persistDistributionStatementVoid(tx, persistInput);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_statement_void",
        targetType: "statement",
        targetId: statementId,
        before: {
          status: statement.status,
          ledgerRow
        },
        after: {
          status: "void",
          reversalLedgerRow: voidPlan.reversalLedgerRow
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendStatementVoidFixture(dependencies.fixtures, persistInput, dependencies.nowIso());
      return {
        id: statementId,
        status: "completed",
        auditEventId,
        reversalLedgerRowCount: 1,
        reversal: voidPlan.reversalLedgerRow
      };
    }
  });
  return context.json(result.body, result.status);
}

async function distributionPaymentRecordResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readJsonBody<PaymentRecordRequest>(context);
  assertPaymentRecordRequest(context, request);
  const amount = normalizeErhAmountField(context, request.amountMicro, "amountMicro");
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<PaymentMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_payment_record",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<PaymentMutationResponse> => {
      // Serialize against every other payment mutation on this statement: balances are
      // computed by summing all of a statement's payments, so two concurrent writes
      // (even on different payments) must not interleave their read-compute-write.
      await acquireAdvisoryLock(tx, `distribution:payment:statement:${request.statementId}`);
      const statement = requireDistributionStatement(dependencies.fixtures.distribution, request.statementId);
      // P4b: reject payments against a void statement.
      if (statement.status === "void") {
        throw new ApiRouteError(409, "statement_void", "Cannot record a payment against a void statement.", [`statementId=${request.statementId}`]);
      }
      assertPaymentMatchesStatement(context, request.payeeId, request.currency, statement);
      const paymentId = randomUUID();
      const statementPaymentLinkId = randomUUID();
      const persistInput: PersistDistributionPaymentRecordInput = {
        paymentId,
        statementPaymentLinkId,
        statementId: request.statementId,
        payeeId: request.payeeId,
        amount,
        currency: request.currency,
        paidAt: request.paidAt,
        reference: request.reference.trim()
      };
      await persistDistributionPaymentRecord(tx, persistInput);
      const patch = paymentRecordFixturePatch(persistInput);
      const projected = distributionDatasetWithPaymentPatch(dependencies.fixtures.distribution, patch);
      const balances = computePaymentBalances(projected, request.statementId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_payment_record",
        targetType: "payment",
        targetId: paymentId,
        before: {},
        after: {
          payment: patch.payment,
          statementPaymentLink: patch.link,
          statementBalance: balances.statementBalance,
          groupTotals: balances.groupTotals,
          note: "Payment record only; no external money movement is triggered."
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionPaymentPatchFixture(dependencies.fixtures, patch);
      return paymentMutationResponse(paymentId, request.statementId, amount, request.currency, "recorded", balances, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionPaymentUpdateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const paymentId = requirePathParam(context, "paymentId");
  const request = await readJsonBody<PaymentUpdateRequest>(context);
  assertPaymentUpdateRequest(context, request);
  const amount = normalizeErhAmountField(context, request.amountMicro, "amountMicro");
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<PaymentMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_payment_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<PaymentMutationResponse> => {
      const payment = requireDistributionPayment(dependencies.fixtures.distribution, paymentId);
      const link = requireDistributionPaymentLink(dependencies.fixtures.distribution, paymentId);
      // Serialize against every other payment mutation on this statement (see record's lock comment).
      await acquireAdvisoryLock(tx, `distribution:payment:statement:${link.statementId}`);
      const statement = requireDistributionStatement(dependencies.fixtures.distribution, link.statementId);
      assertPaymentIsMutable(context, payment);
      // P4b: reject updates against a void statement.
      if (statement.status === "void") {
        throw new ApiRouteError(409, "statement_void", "Cannot update a payment against a void statement.", [`statementId=${link.statementId}`]);
      }
      assertPaymentMatchesStatement(context, payment.payeeId, request.currency, statement);
      const persistInput: PersistDistributionPaymentUpdateInput = {
        paymentId,
        amount,
        currency: request.currency,
        reference: request.reference.trim()
      };
      await persistDistributionPaymentUpdate(tx, persistInput);
      const patch = paymentUpdateFixturePatch(payment, link, persistInput);
      const projected = distributionDatasetWithPaymentPatch(dependencies.fixtures.distribution, patch);
      const balances = computePaymentBalances(projected, link.statementId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_payment_update",
        targetType: "payment",
        targetId: paymentId,
        before: {
          payment,
          statementPaymentLink: link,
          statementBalance: computePaymentBalances(dependencies.fixtures.distribution, link.statementId).statementBalance
        },
        after: {
          payment: patch.payment,
          statementPaymentLink: patch.link,
          statementBalance: balances.statementBalance,
          groupTotals: balances.groupTotals,
          note: "Payment record update only; no external money movement is triggered."
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionPaymentPatchFixture(dependencies.fixtures, patch);
      return paymentMutationResponse(paymentId, link.statementId, amount, request.currency, "edited", balances, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionPaymentReconcileResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const paymentId = requirePathParam(context, "paymentId");
  const request = await readJsonBody<PaymentReconcileRequest>(context);
  assertPaymentReconcileRequest(context, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<PaymentMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_payment_reconcile",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<PaymentMutationResponse> => {
      const payment = requireDistributionPayment(dependencies.fixtures.distribution, paymentId);
      const link = requireDistributionPaymentLink(dependencies.fixtures.distribution, paymentId);
      // Serialize against every other payment mutation on this statement (see record's lock comment).
      await acquireAdvisoryLock(tx, `distribution:payment:statement:${link.statementId}`);
      const statement = requireDistributionStatement(dependencies.fixtures.distribution, link.statementId);
      assertPaymentIsMutable(context, payment);
      // P4b: reject reconciliation against a void statement.
      if (statement.status === "void") {
        throw new ApiRouteError(409, "statement_void", "Cannot reconcile a payment against a void statement.", [`statementId=${link.statementId}`]);
      }
      assertPaymentMatchesStatement(context, payment.payeeId, payment.currency, statement);
      const persistInput: PersistDistributionPaymentReconcileInput = {
        paymentId,
        statementPaymentLinkId: link.id,
        statementId: link.statementId,
        amountApplied: payment.amount,
        bankTransactionId: request.bankTransactionId,
        reconciledAt: request.reconciledAt
      };
      await persistDistributionPaymentReconcile(tx, persistInput);
      const patch = paymentReconcileFixturePatch(payment, link, persistInput);
      const projected = distributionDatasetWithPaymentPatch(dependencies.fixtures.distribution, patch);
      const balances = computePaymentBalances(projected, link.statementId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_payment_reconcile",
        targetType: "payment",
        targetId: paymentId,
        before: {
          payment,
          statementPaymentLink: link,
          statementBalance: computePaymentBalances(dependencies.fixtures.distribution, link.statementId).statementBalance
        },
        after: {
          payment: patch.payment,
          statementPaymentLink: patch.link,
          bankTransactionId: request.bankTransactionId,
          reconciledAt: request.reconciledAt,
          statementBalance: balances.statementBalance,
          groupTotals: balances.groupTotals,
          note: "Payment reconciliation only; no external money movement is triggered."
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionPaymentPatchFixture(dependencies.fixtures, patch);
      return paymentMutationResponse(paymentId, link.statementId, payment.amount, payment.currency, "reconciled", balances, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionPaymentVoidResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const paymentId = requirePathParam(context, "paymentId");
  const request = await readJsonBody<PaymentVoidRequest>(context);
  assertPaymentVoidRequest(context, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<PaymentMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_payment_void",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<PaymentMutationResponse> => {
      const payment = requireDistributionPayment(dependencies.fixtures.distribution, paymentId);
      const link = requireDistributionPaymentLink(dependencies.fixtures.distribution, paymentId);
      assertPaymentIsMutable(context, payment);
      // Statement-scoped, not payment-scoped: a per-payment lock wouldn't block a concurrent
      // record/update/reconcile on a DIFFERENT payment of the same statement (see record's lock comment).
      await acquireAdvisoryLock(tx, `distribution:payment:statement:${link.statementId}`);
      const persistInput: PersistDistributionPaymentVoidInput = { paymentId };
      await persistDistributionPaymentVoid(tx, persistInput);
      const patch = paymentVoidFixturePatch(payment, link);
      const projected = distributionDatasetWithPaymentPatch(dependencies.fixtures.distribution, patch);
      const balances = computePaymentBalances(projected, link.statementId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_payment_void",
        targetType: "payment",
        targetId: paymentId,
        before: {
          payment,
          statementPaymentLink: link,
          statementBalance: computePaymentBalances(dependencies.fixtures.distribution, link.statementId).statementBalance
        },
        after: {
          payment: patch.payment,
          reason: request.reason,
          statementBalance: balances.statementBalance,
          groupTotals: balances.groupTotals,
          note: "Payment void only; no external money movement is triggered."
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionPaymentPatchFixture(dependencies.fixtures, patch);
      return paymentMutationResponse(paymentId, link.statementId, payment.amount, payment.currency, "voided", balances, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function distributionContractRulesUpdateResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const contractId = requirePathParam(context, "contractId");
  const request = await readJsonBody<ContractRoyaltyRulesUpdateRequest>(context);
  assertContractRoyaltyRulesUpdateRequest(context, request);
  requireDistributionContract(dependencies, contractId);
  const persistedRules = persistedRoyaltyRulesFromRequest(contractId, request.rules);
  const totalPercentage = assertRoyaltySplitTotalsOneHundred(context, persistedRules);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ContractRoyaltyRulesMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_contract_rules_update",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ContractRoyaltyRulesMutationResponse> => {
      const beforeRules = dependencies.fixtures.distributionRoyaltyRules.filter((rule) => rule.contractId === contractId);
      const persistInput: PersistDistributionRoyaltyRulesInput = {
        contractId,
        rules: persistedRules
      };
      await persistDistributionRoyaltyRules(tx, persistInput);
      const afterRules = apiRoyaltyRulesFromPersistedRules(persistedRules);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_contract_rules_update",
        targetType: "contract",
        targetId: contractId,
        before: {
          royaltyRules: beforeRules
        },
        after: {
          royaltyRules: afterRules,
          totalPercentage
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionRoyaltyRulesFixture(dependencies.fixtures, contractId, afterRules);
      return {
        id: contractId,
        status: "completed",
        auditEventId,
        contractId,
        ruleCount: afterRules.length,
        totalPercentage,
        rules: afterRules
      };
    }
  });
  return context.json(result.body, result.status);
}

async function distributionFxRatesSaveResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readJsonBody<FxRatesSaveRequest>(context);
  assertFxRatesSaveRequest(context, request);
  const rates = fxRatesFromRequest(request.rates);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<FxRatesSaveMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_fx_rates_save",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<FxRatesSaveMutationResponse> => {
      const beforeRates = distributionFxRateMatches(dependencies.fixtures.distributionFxRates, rates);
      const persistInput: PersistDistributionFxRatesInput = {
        rates
      };
      await persistDistributionFxRates(tx, persistInput);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_fx_rates_save",
        targetType: "fx_rates",
        targetId: fxRatesAuditTargetId(rates),
        before: {
          rates: beforeRates
        },
        after: {
          rates
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      applyDistributionFxRatesFixture(dependencies.fixtures, rates);
      return {
        id: fxRatesAuditTargetId(rates),
        status: "completed",
        auditEventId,
        rateCount: rates.length,
        rates
      };
    }
  });
  return context.json(result.body, result.status);
}

async function officePartnerPayeeLinkResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const partnerId = requirePathParam(context, "partnerId");
  const request = await readJsonBody<OfficePartnerPayeeLinkRequest>(context);
  assertOfficePartnerPayeeLinkRequest(context, request);
  const partner = requirePartner(dependencies.fixtures.office, partnerId);
  const payeeId = requireLinkedPayeeId(context, request.payeeId);
  const payee = requireDistributionPayee(dependencies.fixtures.distribution, payeeId);
  return identityLinkResponse(context, dependencies, {
    action: "office_partner_payee_link",
    route: context.req.path,
    partner,
    payee,
    requestBody: request
  });
}

async function distributionPayeePartnerLinkResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const payeeId = requirePathParam(context, "payeeId");
  const request = await readJsonBody<DistributionPayeePartnerLinkRequest>(context);
  assertDistributionPayeePartnerLinkRequest(context, request);
  const payee = requireDistributionPayee(dependencies.fixtures.distribution, payeeId);
  const partner = requirePartner(dependencies.fixtures.office, request.officePartnerId);
  return identityLinkResponse(context, dependencies, {
    action: "distribution_identity_link",
    route: context.req.path,
    partner,
    payee,
    requestBody: request
  });
}

async function identityLinkResponse(
  context: ApiContext,
  dependencies: ApiServiceDependencies,
  input: {
    readonly action: "office_partner_payee_link" | "distribution_identity_link";
    readonly route: string;
    readonly partner: OfficePartnerRow;
    readonly payee: DistributionReadDataset["payees"][number];
    readonly requestBody: unknown;
  }
): Promise<Response> {
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<IdentityLinkMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: input.action,
    route: input.route,
    idempotencyKey,
    requestBody: input.requestBody,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<IdentityLinkMutationResponse> => {
      // P7a: serialize concurrent identity-link writes for the same payee/partner pair
      // so two simultaneous requests cannot both pass the before-snapshot read and
      // write duplicate rows.
      await acquireAdvisoryLock(tx, `distribution:identity-link:${input.payee.id}:${input.partner.id}`);
      const beforeOfficeLink = toPartnerPayeeLink(dependencies.fixtures, input.partner);
      const beforeDistributionLink = toDistributionPayeePartnerLink(dependencies.fixtures, input.payee);
      const persistInput: PersistIdentityLinkInput = {
        id: randomUUID(),
        payeeId: input.payee.id,
        officePartnerId: input.partner.id,
        confidence: "100.000000",
        status: "linked"
      };
      await persistIdentityLink(tx, persistInput);
      const officeLink = identityOfficeLink(input.partner, input.payee, persistInput.confidence);
      applyIdentityLinkFixture(dependencies.fixtures, officeLink);
      const distributionLink = toDistributionPayeePartnerLink(dependencies.fixtures, input.payee);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: input.action,
        targetType: "identity_link",
        targetId: identityLinkTargetId(input.partner.id, input.payee.id),
        before: {
          officeLink: beforeOfficeLink,
          distributionLink: beforeDistributionLink
        },
        after: {
          officeLink,
          distributionLink
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      return {
        id: identityLinkTargetId(input.partner.id, input.payee.id),
        status: "completed",
        auditEventId,
        officePartnerId: input.partner.id,
        payeeId: input.payee.id,
        officeLink,
        distributionLink
      };
    }
  });
  return context.json(result.body, result.status);
}

async function distributionImportPreviewResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readJsonBody<DistributionImportPreviewRequest>(context);
  assertDistributionImportPreviewRequest(context, request);
  requirePermissionForWorkspace(context.get("authUser"), "distribution_import_preview", request.workspaceId);
  const previewRows = previewRowsFromRecords(request.rows);
  const idempotencyFingerprint = `${request.source}:${request.checksum}:${hashRequestBody(request.rows)}`;
  const previewId = previewIdFor("distribution", idempotencyFingerprint);
  const preview: DistributionImportPreviewRecord = {
    previewId,
    workspaceId: request.workspaceId,
    source: request.source,
    fileName: request.fileName,
    checksum: request.checksum,
    idempotencyFingerprint,
    rows: previewRows,
    createdAtIso: dependencies.nowIso()
  };
  await dependencies.persistence.storeDistributionImportPreview(preview);
  // Keep only currencies explicitly present in the imported file rows.
  // Do not infer a source-based fallback (Kontor=EUR / RouteNote=USD).
  const currencyCodes = currencyCodesFromRows(request.rows, null);
  const response: DistributionImportPreviewResponse = {
    previewId,
    source: request.source,
    statementReference: `preview:${request.checksum}`,
    accountReference: request.source,
    acceptedRowCount: previewRows.length,
    rejectedRowCount: 0,
    unmappedRowCount: previewRows.length,
    payableMicro: erhMoney.format(0n),
    currencyCodes,
    joinKeys: joinKeysFromRows(request.rows),
    idempotencyFingerprint,
    warnings: [
      "Distribution runtime parsers are not enabled in services/api yet; confirm will persist raw rows and import issues without fabricating normalized earnings."
    ]
  };
  return context.json(response);
}

async function distributionImportConfirmResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readJsonBody<DistributionImportConfirmRequest>(context);
  assertDistributionImportConfirmRequest(context, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<DistributionImportConfirmMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_import_confirm",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<DistributionImportConfirmMutationResponse> => {
      const preview = await requireDistributionPreviewInWrite(context, dependencies, tx, request.previewId, request.workspaceId);
      // P7c: light dedup guard — if a non-failed batch with the same fileName+source
      // already exists for this workspace, reject with 409 instead of writing a
      // duplicate. The idempotency key protects same-key retries; this catches
      // re-uploads of the same file with a fresh idempotency key.
      const existingBatch = dependencies.fixtures.distribution.importBatches.find(
        (batch) => batch.fileName === preview.fileName &&
                   batch.source === preview.source &&
                   batch.status !== "failed" && batch.status !== "void"
      );
      if (existingBatch !== null && existingBatch !== undefined) {
        throw new ApiRouteError(409, "distribution_import_duplicate",
          "A non-failed batch with the same file name and source already exists. Delete or void the existing batch before re-importing.",
          [`existingBatchId=${existingBatch.id}`, `fileName=${preview.fileName}`, `source=${preview.source}`]);
      }
      const batchId = randomUUID();
      const importedAtIso = dependencies.nowIso();
      await persistDistributionImportConfirmation(tx, {
        batchId,
        source: preview.source,
        fileName: preview.fileName,
        status: "failed",
        importedAtIso,
        rows: preview.rows,
        acceptedRowIds: request.acceptedRowIds,
        rejectedRowIds: request.rejectedRowIds,
        metadata: {
          workspaceId: request.workspaceId,
          previewId: request.previewId,
          checksum: preview.checksum,
          acceptedRowIds: request.acceptedRowIds,
          rejectedRowIds: request.rejectedRowIds,
          normalizedRowCount: 0,
          parserStatus: "runtime_parser_missing"
        }
      });
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_import_confirm",
        targetType: "import_batch",
        targetId: batchId,
        before: {},
        after: {
          previewId: request.previewId,
          rawRowCount: preview.rows.length,
          normalizedRowCount: 0,
          issueCount: preview.rows.length,
          status: "failed"
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendDistributionImportFixture(dependencies.fixtures, {
        id: batchId,
        source: preview.source,
        fileName: preview.fileName,
        status: "failed",
        importedAt: importedAtIso
      });
      return {
        id: batchId,
        status: "completed",
        auditEventId,
        importedRoyaltyEventCount: 0,
        rawRowCount: preview.rows.length,
        normalizedRowCount: 0,
        issueCount: preview.rows.length
      };
    }
  });
  return context.json(result.body, result.status);
}

async function distributionImportReverseResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const body = await readOptionalJsonBody(context);
  const idempotencyKey = requireIdempotencyKey(context);
  const batchId = requirePathParam(context, "batchId");
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<DistributionImportReverseMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "distribution_import_reverse",
    route: context.req.path,
    idempotencyKey,
    requestBody: body,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<DistributionImportReverseMutationResponse> => {
      const statusChange = await markDistributionImportBatchVoid(tx, batchId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "distribution_import_reverse",
        targetType: "import_batch",
        targetId: batchId,
        before: { status: statusChange.previousStatus },
        after: { status: statusChange.nextStatus },
        idempotencyKey: resolvedIdempotencyKey
      });
      markDistributionImportFixtureVoid(dependencies.fixtures, batchId);
      return {
        id: batchId,
        status: "completed",
        auditEventId
      };
    }
  });
  return context.json(result.body, result.status);
}

async function officeBankImportParsePreviewResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readJsonBody<BankImportParsePreviewRequest>(context);
  assertOfficeBankImportParsePreviewRequest(context, request);
  requirePermissionForWorkspace(context.get("authUser"), "office_bank_import_preview", request.workspaceId);

  const parsed = parseOfficeBankImportText({
    text: request.contentText,
    fileName: request.fileName,
    sourceHint: request.sourceHint
  });

  if (parsed.rows.length === 0) {
    throw new ApiRouteError(
      422,
      "bank_import_parse_empty",
      "No readable transaction row was detected in this file.",
      [`path=${context.req.path}`, `fileName=${request.fileName}`]
    );
  }

  const response: BankImportParsePreviewResponse = {
    source: parsed.source,
    currency: parsed.currency,
    parsedRowCount: parsed.parsedRowCount,
    rows: parsed.rows,
    parsingNotes: parsed.parsingNotes
  };
  return context.json(response);
}

async function officeBankImportPreviewResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readJsonBody<BankImportPreviewRequest>(context);
  assertOfficeBankImportPreviewRequest(context, request);
  requirePermissionForWorkspace(context.get("authUser"), "office_bank_import_preview", request.workspaceId);
  const previewRows = previewRowsFromRecords(request.rows);
  const allParsedRows = previewRows
    .map((row: ApiImportPreviewRow): ParsedOfficeBankPreviewRow => parseOfficeBankPreviewRow(row, request.workspaceId, dependencies.fixtures.office.bankAccounts, dependencies.fixtures.office.exchangeRates));
  const parsedRows = allParsedRows
    .filter((row: ParsedOfficeBankPreviewRow): row is ParsedOfficeBankPreviewRow & { readonly line: OfficeBankStatementLineInsert } => row.line !== null);
  const idempotencyFingerprint = `${request.source}:${request.checksum}:${hashRequestBody(request.rows)}`;
  const previewId = previewIdFor("office-bank", idempotencyFingerprint);
  const preview: OfficeBankImportPreviewRecord = {
    previewId,
    workspaceId: request.workspaceId,
    source: request.source,
    fileName: request.fileName,
    checksum: request.checksum,
    idempotencyFingerprint,
    rows: previewRows,
    createdAtIso: dependencies.nowIso()
  };
  await dependencies.persistence.storeOfficeBankImportPreview(preview);
  const dateRange = officeDateRange(parsedRows.map((row) => row.line.occurredOn));
  const response: BankImportPreviewResponse = {
    previewId,
    source: request.source,
    detectedFormat: `${request.source}_structured_json`,
    accountReference: parsedRows[0]?.line.accountId ?? null,
    periodLabel: dateRange.label,
    currencyCodes: parsedRows.length === 0 ? currencyCodesFromRows(request.rows, "MUR") : uniqueStrings(parsedRows.map((row) => row.line.currency)),
    openingBalanceMicro: null,
    closingBalanceMicro: null,
    idempotencyFingerprint,
    acceptedRowCount: parsedRows.length,
    rejectedRowCount: previewRows.length - parsedRows.length,
    duplicateRowCount: 0,
    parsingNotes: [
      "Preview accepts structured JSON rows only; raw PDF/XLS parsing is not implemented in services/api."
    ],
    warnings: [
      ...(parsedRows.length === previewRows.length
        ? []
        : ["Some rows could not be converted into bank statement lines and will remain in batch metadata instead of being fabricated."]),
      ...bankImportAccountMismatchWarnings(request.rows, dependencies.fixtures.office.bankAccounts)
    ],
    rejectionReasons: aggregateRejectionReasons(allParsedRows),
    rowResults: allParsedRows.map(previewRowResult)
  };
  return context.json(response);
}

function bankImportAccountMismatchWarnings(
  rows: readonly Readonly<Record<string, string>>[],
  accounts: readonly OfficeBankAccountRow[]
): readonly string[] {
  if (rows.length === 0) {
    return [];
  }

  const firstRow = rows[0];
  if (firstRow === undefined) {
    return [];
  }

  const selectedAccountId = rowValue(firstRow, ["accountId", "account_id"]);
  if (selectedAccountId === null) {
    return [];
  }

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  if (selectedAccount === undefined) {
    return [];
  }

  const detection = detectBankProfileFromRows(rows);
  if (detection.detectedBank === "unknown") {
    return detection.confidence === "low"
      ? ["Could not confidently detect bank profile from file content. Verify selected account before confirm."]
      : [];
  }

  const selectedBank = normalizeBankName(selectedAccount.bankName);
  if (selectedBank === "unknown" || selectedBank === detection.detectedBank) {
    return [];
  }

  return [
    `Bank profile mismatch: file looks like ${detection.detectedBank.toUpperCase()} (${detection.confidence} confidence) but selected account is ${selectedAccount.bankName} · ${selectedAccount.accountLabel}. Confirm only if intentional.`
  ];
}

function normalizeBankName(value: string): "sbi" | "mcb" | "unknown" {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("state bank") || normalized === "sbi") {
    return "sbi";
  }
  if (normalized.includes("commercial bank") || normalized === "mcb") {
    return "mcb";
  }
  return "unknown";
}

function detectBankProfileFromRows(rows: readonly Readonly<Record<string, string>>[]): {
  readonly detectedBank: "sbi" | "mcb" | "unknown";
  readonly confidence: "low" | "medium" | "high";
} {
  const text = rows
    .flatMap((row) => Object.values(row))
    .join("\n")
    .toLowerCase();

  let sbiSignals = 0;
  let mcbSignals = 0;

  if (/\bparticulars\b/u.test(text)) {
    sbiSignals += 1;
  }
  if (/\binstrument\s*id\b/u.test(text)) {
    sbiSignals += 1;
  }
  if (/\bgeneral\s+details\b/u.test(text) || /\bbalance\s+details\b/u.test(text)) {
    sbiSignals += 1;
  }
  if (/\bsb103\b/u.test(text) || /\bsbi\s*\(mauritius\)\b/u.test(text)) {
    sbiSignals += 2;
  }
  if (/\bremittance\s*id\b/u.test(text) || /\beft\s+bo\b/u.test(text) || /\bin\.\s*clg\b/u.test(text)) {
    sbiSignals += 1;
  }

  if (/\btrans\s*date\b/u.test(text) && /\bvalue\s*date\b/u.test(text)) {
    mcbSignals += 1;
  }
  if (/\btransaction\s*details\b/u.test(text)) {
    mcbSignals += 1;
  }
  if (/\bcurrent\s+account\s+statement\b/u.test(text) || /\bdespatch\s+code\b/u.test(text)) {
    mcbSignals += 1;
  }
  if (/\bmauritius\s+commercial\s+bank\b/u.test(text) || /\bmcblmumu\b/u.test(text) || /\bwww\.mcb\.mu\b/u.test(text)) {
    mcbSignals += 2;
  }
  if (/\b[a-z]{2}\d{2}mcbl[a-z0-9]{6,}\b/u.test(text)) {
    mcbSignals += 2;
  }

  if (mcbSignals >= sbiSignals + 2 && mcbSignals >= 3) {
    return { detectedBank: "mcb", confidence: mcbSignals >= 5 ? "high" : "medium" };
  }
  if (sbiSignals >= mcbSignals + 2 && sbiSignals >= 3) {
    return { detectedBank: "sbi", confidence: sbiSignals >= 5 ? "high" : "medium" };
  }

  return { detectedBank: "unknown", confidence: "low" };
}

async function officeBankImportConfirmResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readJsonBody<BankImportConfirmRequest>(context);
  assertOfficeBankImportConfirmRequest(context, request);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<OfficeBankImportConfirmMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_bank_import_confirm",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<OfficeBankImportConfirmMutationResponse> => {
      const preview = await requireOfficeBankPreviewInWrite(context, dependencies, tx, request.previewId, request.workspaceId);
      // Two concurrent confirms of the same file (different idempotency keys) must not both
      // pass the fingerprint check before either inserts: serialize on the fingerprint so the
      // second request sees the first request's batch and returns a clean 409, not a raw
      // unique-constraint database error.
      await acquireAdvisoryLock(tx, `office:bank-import:fingerprint:${request.workspaceId}:${preview.idempotencyFingerprint}`);
      const existingBatch = await findOfficeBankImportBatchByFingerprint(tx, request.workspaceId, preview.idempotencyFingerprint);
      if (existingBatch !== null) {
        if (existingBatch.status !== "confirmed") {
          throw new ApiRouteError(409, "bank_import_fingerprint_conflict", "Bank import already exists with a non-confirmed status.", [
            `path=${context.req.path}`,
            `previewId=${request.previewId}`,
            `batchId=${existingBatch.id}`,
            `status=${existingBatch.status}`
          ]);
        }

        const auditEventId = await appendAuditEvent(tx, {
          actor,
          action: "office_bank_import_confirm",
          targetType: "office_bank_import_batch",
          targetId: existingBatch.id,
          before: {},
          after: {
            previewId: request.previewId,
            duplicateConfirm: true,
            importedStatementLineCount: existingBatch.acceptedRowCount,
            rejectedRowCount: existingBatch.rejectedRowCount,
            duplicateRowCount: existingBatch.duplicateRowCount,
            status: existingBatch.status
          },
          idempotencyKey: resolvedIdempotencyKey
        });
        appendOfficeAuditFixture(dependencies.fixtures, {
          id: auditEventId,
          actorId: actor.userId,
          action: "office_bank_import_confirm",
          entityType: "office_bank_import_batch",
          entityId: existingBatch.id,
          occurredAt: dependencies.nowIso()
        });
        return {
          id: existingBatch.id,
          status: "completed",
          auditEventId,
          importedTransactionCount: existingBatch.acceptedRowCount,
          rejectedRowCount: existingBatch.rejectedRowCount
        };
      }

      const acceptedRowIds = new Set<string>(request.acceptedRowIds);
      const parsedRows = preview.rows
        .filter((row: ApiImportPreviewRow): boolean => acceptedRowIds.has(row.id))
        .map((row: ApiImportPreviewRow): ParsedOfficeBankPreviewRow => parseOfficeBankPreviewRow(row, request.workspaceId, dependencies.fixtures.office.bankAccounts, dependencies.fixtures.office.exchangeRates));
      const lines = parsedRows
        .map((row: ParsedOfficeBankPreviewRow): OfficeBankStatementLineInsert | null => row.line)
        .filter((line: OfficeBankStatementLineInsert | null): line is OfficeBankStatementLineInsert => line !== null);
      const suggestions = buildOfficeReconciliationSuggestions(dependencies.fixtures.office, request.workspaceId, lines);
      const batchId = randomUUID();
      const importedAtIso = dependencies.nowIso();
      const dateRange = officeDateRange(lines.map((line) => line.occurredOn));
      const batchStatus = lines.length === 0 ? "failed" : "confirmed";
      await persistOfficeBankImportConfirmation(tx, {
        batchId,
        workspaceId: request.workspaceId,
        source: preview.source,
        fileName: preview.fileName,
        checksum: preview.checksum,
        accountId: lines[0]?.accountId ?? null,
        periodStart: dateRange.start,
        periodEnd: dateRange.end,
        currency: lines[0]?.currency ?? null,
        acceptedRowCount: lines.length,
        rejectedRowCount: preview.rows.length - lines.length,
        duplicateRowCount: 0,
        idempotencyFingerprint: preview.idempotencyFingerprint,
        status: batchStatus,
        importedAtIso,
        metadata: {
          previewId: request.previewId,
          acceptedRowIds: request.acceptedRowIds,
          rejectedRowIds: request.rejectedRowIds,
          rowIssues: parsedRows.flatMap((row) => row.issues.map((issue) => ({ rowId: row.row.id, issue }))),
          rawRows: preview.rows
        },
        lines
      });
      await persistOfficeReconciliationSuggestions(tx, suggestions);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_bank_import_confirm",
        targetType: "office_bank_import_batch",
        targetId: batchId,
        before: {},
        after: {
          previewId: request.previewId,
          importedStatementLineCount: lines.length,
          rejectedRowCount: preview.rows.length - lines.length,
          suggestedMatchCount: suggestions.length,
          status: batchStatus
        },
        idempotencyKey: resolvedIdempotencyKey
      });
      appendOfficeBankImportFixture(dependencies.fixtures, {
        batchId,
        workspaceId: request.workspaceId,
        source: preview.source,
        fileName: preview.fileName,
        checksum: preview.checksum,
        accountId: lines[0]?.accountId ?? null,
        periodStart: dateRange.start,
        periodEnd: dateRange.end,
        currency: lines[0]?.currency ?? null,
        acceptedRowCount: lines.length,
        rejectedRowCount: preview.rows.length - lines.length,
        duplicateRowCount: 0,
        idempotencyFingerprint: preview.idempotencyFingerprint,
        status: batchStatus,
        importedAt: importedAtIso,
        metadata: {
          previewId: request.previewId,
          acceptedRowIds: request.acceptedRowIds,
          rejectedRowIds: request.rejectedRowIds
        },
        lines
      });
      applyOfficeReconciliationSuggestionsFixture(dependencies.fixtures, suggestions);
      appendOfficeAuditFixture(dependencies.fixtures, {
        id: auditEventId,
        actorId: actor.userId,
        action: "office_bank_import_confirm",
        entityType: "office_bank_import_batch",
        entityId: batchId,
        occurredAt: importedAtIso
      });
      return {
        id: batchId,
        status: "completed",
        auditEventId,
        importedTransactionCount: lines.length,
        rejectedRowCount: preview.rows.length - lines.length
      };
    }
  });
  return context.json(result.body, result.status);
}

// Administrator-only, irreversible: hard-deletes an import batch's own bank statement
// lines and reconciliation matches (and the batch row itself). Deliberately mirrors
// office_bank_account_delete's scope: any transaction created from or matched to these
// lines is left untouched (only the join/line rows disappear), so a validated ledger
// entry is never silently destroyed — the admin cancels those separately if unwanted.
async function officeBankImportDeleteResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const batchId = requirePathParam(context, "batchId");
  const request = await readZodBody<OfficeBankImportDeleteRequest>(context, workspaceBodySchema);
  const before = dependencies.fixtures.office.bankImportBatches.find(
    (batch: OfficeBankImportBatchRow): boolean => batch.id === batchId && batch.workspaceId === request.workspaceId
  );
  if (before === undefined) {
    throw new ApiRouteError(404, "office_bank_import_batch_not_found", "Office bank import batch was not found.", [
      `batchId=${batchId}`,
      `workspaceId=${request.workspaceId}`
    ]);
  }

  const fixtureCounts = countOfficeBankImportFixtureDependencies(dependencies.fixtures, batchId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_bank_import_delete",
    route: context.req.path,
    idempotencyKey,
    requestBody: request,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:bank-import:${batchId}`);
      const deletedCounts = await persistOfficeBankImportDelete(tx, batchId, request);
      if (tx.kind !== "memory" && deletedCounts.batchCount !== 1) {
        throw new ApiRouteError(404, "office_bank_import_batch_not_found", "Office bank import batch was not found.", [
          `batchId=${batchId}`,
          `workspaceId=${request.workspaceId}`
        ]);
      }
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_bank_import_delete",
        targetType: "office_bank_import_batch",
        targetId: batchId,
        before: { batch: before, counts: fixtureCounts },
        after: { batchId, deletedCounts },
        idempotencyKey: resolvedIdempotencyKey
      });
      deleteOfficeBankImportBatchFixture(dependencies.fixtures, batchId);
      return mutationReceipt(batchId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

// Administrator-only, irreversible: wipes every Office transaction (validated included —
// unlike the single-batch delete above, this one is explicitly allowed to erase posted
// ledger history) plus every bank account/import batch/statement line/reconciliation
// match for this workspace. Never touches the chart of accounts (departments, divisions,
// categories), projects, or partners — those are structural setup, not transactional
// history, and were not named in the reset's scope. Distribution tables are untouched.
async function officeFinancialResetResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const request = await readZodBody<OfficeFinancialResetRequest>(context, officeFinancialResetSchema);
  const fixtureCounts = countOfficeFinancialResetFixtureDependencies(dependencies.fixtures, request.workspaceId);
  const idempotencyKey = requireIdempotencyKey(context);
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<ApiMutationReceipt & ApiMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_financial_reset",
    route: context.req.path,
    idempotencyKey,
    requestBody: { workspaceId: request.workspaceId },
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<ApiMutationReceipt & ApiMutationResponse> => {
      await acquireAdvisoryLock(tx, `office:financial-reset:${request.workspaceId}`);
      const deletedCounts = await persistOfficeFinancialReset(tx, request.workspaceId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_financial_reset",
        targetType: "office_workspace",
        targetId: request.workspaceId,
        before: { counts: fixtureCounts },
        after: { workspaceId: request.workspaceId, deletedCounts },
        idempotencyKey: resolvedIdempotencyKey
      });
      resetOfficeFinancialFixtures(dependencies.fixtures, request.workspaceId);
      return mutationReceipt(request.workspaceId, auditEventId);
    }
  });
  return context.json(result.body, result.status);
}

async function persistOfficeFinancialReset(tx: ApiWriteTransaction, workspaceId: string): Promise<OfficeFinancialResetCounts> {
  if (tx.kind === "memory") {
    return { transactionCount: 0, statementLineCount: 0, reconciliationMatchCount: 0, importBatchCount: 0, bankAccountCount: 0 };
  }

  const rows = queryRowsFromResult(await tx.executor.execute(sql`
    with scoped_batches as (
      select id from office_bank_import_batches where workspace_id = ${workspaceId}
    ),
    scoped_accounts as (
      select id from office_bank_accounts where workspace_id = ${workspaceId}
    ),
    scoped_lines as (
      select line.id
      from office_bank_statement_lines line
      where line.import_batch_id in (select id from scoped_batches)
         or line.account_id in (select id from scoped_accounts)
    ),
    deleted_matches as (
      delete from office_bank_reconciliation_matches match
      using scoped_lines line
      where match.bank_statement_line_id = line.id
      returning match.id
    ),
    deleted_transactions as (
      delete from transactions
      where workspace_id = ${workspaceId}
      returning id
    ),
    deleted_lines as (
      delete from office_bank_statement_lines line
      using scoped_lines scoped
      where line.id = scoped.id
      returning line.id
    ),
    deleted_batches as (
      delete from office_bank_import_batches batch
      using scoped_batches scoped
      where batch.id = scoped.id
      returning batch.id
    ),
    deleted_accounts as (
      delete from office_bank_accounts account
      using scoped_accounts scoped
      where account.id = scoped.id
      returning account.id
    )
    select
      (select count(*) from deleted_transactions)::int as transaction_count,
      (select count(*) from deleted_lines)::int as statement_line_count,
      (select count(*) from deleted_matches)::int as reconciliation_match_count,
      (select count(*) from deleted_batches)::int as import_batch_count,
      (select count(*) from deleted_accounts)::int as bank_account_count
  `));
  const row = rows[0];
  return {
    transactionCount: integerQueryField(row, "transaction_count"),
    statementLineCount: integerQueryField(row, "statement_line_count"),
    reconciliationMatchCount: integerQueryField(row, "reconciliation_match_count"),
    importBatchCount: integerQueryField(row, "import_batch_count"),
    bankAccountCount: integerQueryField(row, "bank_account_count")
  };
}

function countOfficeFinancialResetFixtureDependencies(fixtures: ApiFixtureStore, workspaceId: string): OfficeFinancialResetCounts {
  const scopedBatchIds = new Set<string>(
    fixtures.office.bankImportBatches
      .filter((batch: OfficeBankImportBatchRow): boolean => batch.workspaceId === workspaceId)
      .map((batch: OfficeBankImportBatchRow): string => batch.id)
  );
  const scopedAccountIds = new Set<string>(
    fixtures.office.bankAccounts
      .filter((account: OfficeBankAccountRow): boolean => account.workspaceId === workspaceId)
      .map((account: OfficeBankAccountRow): string => account.id)
  );
  const scopedLineIds = new Set<string>(
    fixtures.office.bankStatementLines
      .filter((line: OfficeBankStatementLineRow): boolean => scopedBatchIds.has(line.importBatchId) || scopedAccountIds.has(line.accountId))
      .map((line: OfficeBankStatementLineRow): string => line.id)
  );

  return {
    transactionCount: fixtures.office.transactions.filter((transaction: OfficeTransactionRow): boolean => transaction.workspaceId === workspaceId).length,
    statementLineCount: scopedLineIds.size,
    reconciliationMatchCount: fixtures.office.bankReconciliationMatches.filter((match): boolean => scopedLineIds.has(match.bankStatementLineId)).length,
    importBatchCount: scopedBatchIds.size,
    bankAccountCount: scopedAccountIds.size
  };
}

function resetOfficeFinancialFixtures(fixtures: ApiFixtureStore, workspaceId: string): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  const scopedBatchIds = new Set<string>(
    fixtures.office.bankImportBatches
      .filter((batch: OfficeBankImportBatchRow): boolean => batch.workspaceId === workspaceId)
      .map((batch: OfficeBankImportBatchRow): string => batch.id)
  );
  const scopedAccountIds = new Set<string>(
    fixtures.office.bankAccounts
      .filter((account: OfficeBankAccountRow): boolean => account.workspaceId === workspaceId)
      .map((account: OfficeBankAccountRow): string => account.id)
  );
  const scopedLineIds = new Set<string>(
    fixtures.office.bankStatementLines
      .filter((line: OfficeBankStatementLineRow): boolean => scopedBatchIds.has(line.importBatchId) || scopedAccountIds.has(line.accountId))
      .map((line: OfficeBankStatementLineRow): string => line.id)
  );

  mutableOffice.bankReconciliationMatches = fixtures.office.bankReconciliationMatches.filter(
    (match): boolean => !scopedLineIds.has(match.bankStatementLineId)
  );
  mutableOffice.transactions = fixtures.office.transactions.filter(
    (transaction: OfficeTransactionRow): boolean => transaction.workspaceId !== workspaceId
  );
  mutableOffice.bankStatementLines = fixtures.office.bankStatementLines.filter(
    (line: OfficeBankStatementLineRow): boolean => !scopedLineIds.has(line.id)
  );
  mutableOffice.bankImportBatches = fixtures.office.bankImportBatches.filter(
    (batch: OfficeBankImportBatchRow): boolean => !scopedBatchIds.has(batch.id)
  );
  mutableOffice.bankAccounts = fixtures.office.bankAccounts.filter(
    (account: OfficeBankAccountRow): boolean => !scopedAccountIds.has(account.id)
  );
}

async function officeBankImportReverseResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  const body = await readOptionalJsonBody(context);
  const idempotencyKey = requireIdempotencyKey(context);
  const batchId = requirePathParam(context, "batchId");
  const actor = context.get("authUser");
  const result = await runIdempotentMutation<OfficeBankImportReverseMutationResponse>({
    runtime: dependencies.persistence,
    actor,
    action: "office_bank_import_reverse",
    route: context.req.path,
    idempotencyKey,
    requestBody: body,
    write: async (tx: ApiWriteTransaction, resolvedIdempotencyKey: string): Promise<OfficeBankImportReverseMutationResponse> => {
      const statusChange = await markOfficeBankImportBatchVoid(tx, batchId);
      const auditEventId = await appendAuditEvent(tx, {
        actor,
        action: "office_bank_import_reverse",
        targetType: "office_bank_import_batch",
        targetId: batchId,
        before: { status: statusChange.previousStatus },
        after: { status: statusChange.nextStatus },
        idempotencyKey: resolvedIdempotencyKey
      });
      markOfficeBankImportFixtureVoid(dependencies.fixtures, batchId);
      appendOfficeAuditFixture(dependencies.fixtures, {
        id: auditEventId,
        actorId: actor.userId,
        action: "office_bank_import_reverse",
        entityType: "office_bank_import_batch",
        entityId: batchId,
        occurredAt: dependencies.nowIso()
      });
      return {
        id: batchId,
        status: "completed",
        auditEventId
      };
    }
  });
  return context.json(result.body, result.status);
}

function assertDistributionImportPreviewRequest(context: ApiContext, request: DistributionImportPreviewRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.fileName, "fileName");
  assertStringField(context, request.checksum, "checksum");
  if (request.source !== "kontor" && request.source !== "routenote") {
    throw new ApiRouteError(400, "body_value_invalid", "Distribution import source is invalid.", [`path=${context.req.path}`, `source=${String(request.source)}`]);
  }

  assertStringRecordRows(context, request.rows, "rows");
}

function assertDistributionImportConfirmRequest(context: ApiContext, request: DistributionImportConfirmRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.previewId, "previewId");
  assertStringArray(context, request.acceptedRowIds, "acceptedRowIds");
  assertStringArray(context, request.rejectedRowIds, "rejectedRowIds");
}

function assertAllocationRunPreviewRequest(context: ApiContext, request: AllocationRunPreviewRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertPeriodField(context, request.period, "period");
  assertStringField(context, request.lockKey, "lockKey");
}

function assertAllocationRunStartRequest(context: ApiContext, request: AllocationRunStartRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertPeriodField(context, request.period, "period");
  assertStringField(context, request.lockKey, "lockKey");
  if (request.cadence !== "manual" && request.cadence !== "scheduled") {
    throw new ApiRouteError(400, "body_field_invalid", "Allocation cadence is invalid.", [`path=${context.req.path}`, `cadence=${String(request.cadence)}`]);
  }
}

function assertStatementGenerateRequest(context: ApiContext, request: StatementGenerateRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertPeriodField(context, request.period, "period");
  assertStringArray(context, request.payeeIds, "payeeIds");
  assertStringField(context, request.lockKey, "lockKey");
}

function assertPaymentRecordRequest(context: ApiContext, request: PaymentRecordRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.statementId, "statementId");
  assertStringField(context, request.payeeId, "payeeId");
  assertPositiveErhAmountField(context, request.amountMicro, "amountMicro");
  assertCurrencyField(context, request.currency, "currency");
  assertIsoDateTimeField(context, request.paidAt, "paidAt");
  assertStringField(context, request.reference, "reference");
}

function assertPaymentUpdateRequest(context: ApiContext, request: PaymentUpdateRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertPositiveErhAmountField(context, request.amountMicro, "amountMicro");
  assertCurrencyField(context, request.currency, "currency");
  assertStringField(context, request.reference, "reference");
}

function assertPaymentReconcileRequest(context: ApiContext, request: PaymentReconcileRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.bankTransactionId, "bankTransactionId");
  assertIsoDateTimeField(context, request.reconciledAt, "reconciledAt");
}

function assertPaymentVoidRequest(context: ApiContext, request: PaymentVoidRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.reason, "reason");
}

function assertContractRoyaltyRulesUpdateRequest(context: ApiContext, request: ContractRoyaltyRulesUpdateRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  if (!Array.isArray(request.rules) || request.rules.length === 0) {
    throw new ApiRouteError(400, "body_field_invalid", "Royalty rules must be a non-empty array.", [`path=${context.req.path}`, "field=rules"]);
  }

  for (const [index, rule] of request.rules.entries()) {
    assertStringField(context, rule.payeeId, `rules.${String(index)}.payeeId`);
    assertScale6PercentageField(context, rule.percentage, `rules.${String(index)}.percentage`);
    assertNullableStringField(context, rule.scopeType, `rules.${String(index)}.scopeType`);
    assertNullableStringField(context, rule.scopeId, `rules.${String(index)}.scopeId`);
    assertNullableIsoDateField(context, rule.effectiveFrom, `rules.${String(index)}.effectiveFrom`);
    assertNullableIsoDateField(context, rule.effectiveTo, `rules.${String(index)}.effectiveTo`);
  }
}

function assertFxRatesSaveRequest(context: ApiContext, request: FxRatesSaveRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  if (!Array.isArray(request.rates) || request.rates.length === 0) {
    throw new ApiRouteError(400, "body_field_invalid", "FX rates must be a non-empty array.", [`path=${context.req.path}`, "field=rates"]);
  }

  for (const [index, rate] of request.rates.entries()) {
    assertCurrencyField(context, rate.fromCurrency, `rates.${String(index)}.fromCurrency`);
    assertCurrencyField(context, rate.toCurrency, `rates.${String(index)}.toCurrency`);
    assertIsoDateField(context, rate.effectiveDate, `rates.${String(index)}.effectiveDate`);
    assertPositiveScale10Field(context, rate.rate, `rates.${String(index)}.rate`);
  }
}

function assertOfficePartnerPayeeLinkRequest(context: ApiContext, request: OfficePartnerPayeeLinkRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  if (request.payeeId === null) {
    throw new ApiRouteError(400, "body_field_required", "Linking a partner requires a payeeId; use unlink for null payees.", [
      `path=${context.req.path}`,
      "field=payeeId"
    ]);
  }

  assertStringField(context, request.payeeId, "payeeId");
}

function assertDistributionPayeePartnerLinkRequest(context: ApiContext, request: DistributionPayeePartnerLinkRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.officePartnerId, "officePartnerId");
}

function requireLinkedPayeeId(context: ApiContext, payeeId: string | null): string {
  if (payeeId === null) {
    throw new ApiRouteError(400, "body_field_required", "Linking a partner requires a payeeId; use unlink for null payees.", [
      `path=${context.req.path}`,
      "field=payeeId"
    ]);
  }

  return payeeId;
}

function assertPeriodField(context: ApiContext, value: unknown, field: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/u.test(value)) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be an ISO month string.", [`path=${context.req.path}`, `field=${field}`]);
  }
}

function assertPositiveErhAmountField(context: ApiContext, value: unknown, field: string): void {
  if (typeof value !== "string") {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a distribution money string.", [`path=${context.req.path}`, `field=${field}`]);
  }

  let units: bigint;
  try {
    units = erhMoney.parse(value);
  } catch (error: unknown) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a valid scale-10 distribution money string.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }

  if (units <= 0n) {
    throw new ApiRouteError(400, "body_field_invalid", "A payment amount must be positive.", [`path=${context.req.path}`, `field=${field}`]);
  }
}

function normalizeErhAmountField(context: ApiContext, value: string, field: string): string {
  assertPositiveErhAmountField(context, value, field);
  return erhMoney.format(erhMoney.parse(value));
}

function assertCurrencyField(context: ApiContext, value: unknown, field: string): void {
  if (typeof value !== "string" || !/^[A-Z]{3}$/u.test(value)) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a three-letter uppercase currency code.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `value=${String(value)}`
    ]);
  }
}

function assertScale6PercentageField(context: ApiContext, value: unknown, field: string): void {
  if (typeof value !== "string") {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a scale-6 percentage string.", [`path=${context.req.path}`, `field=${field}`]);
  }

  const units = parseScaleField(context, value, field, 6);
  const oneHundredUnits = 100_000000n;
  if (units < 0n || units > oneHundredUnits) {
    throw new ApiRouteError(400, "body_field_invalid", "A royalty percentage must be between 0.000000 and 100.000000.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `value=${value}`
    ]);
  }
}

function assertPositiveScale10Field(context: ApiContext, value: unknown, field: string): void {
  if (typeof value !== "string") {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a scale-10 decimal string.", [`path=${context.req.path}`, `field=${field}`]);
  }

  const units = parseScaleField(context, value, field, 10);
  if (units <= 0n) {
    throw new ApiRouteError(400, "body_field_invalid", "A decimal value must be positive.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `value=${value}`
    ]);
  }
}

function parseScaleField(context: ApiContext, value: string, field: string, scale: number): bigint {
  const regex = new RegExp(`^-?\\d+(?:\\.\\d{1,${String(scale)}})?$`, "u");
  if (!regex.test(value)) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field has too many decimal places for its scale.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `scale=${String(scale)}`,
      `value=${value}`
    ]);
  }

  try {
    return parseScaledUnits(value, scale, "TRUNCATE");
  } catch (error: unknown) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be a valid decimal string.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
}

function assertIsoDateTimeField(context: ApiContext, value: unknown, field: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/u.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be an ISO date-time string.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `value=${String(value)}`
    ]);
  }
}

function assertIsoDateField(context: ApiContext, value: unknown, field: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be an ISO date string.", [
      `path=${context.req.path}`,
      `field=${field}`,
      `value=${String(value)}`
    ]);
  }
}

function assertNullableIsoDateField(context: ApiContext, value: unknown, field: string): void {
  if (value === null) {
    return;
  }

  assertIsoDateField(context, value, field);
}

function assertNullableStringField(context: ApiContext, value: unknown, field: string): void {
  if (value === null) {
    return;
  }

  assertStringField(context, value, field);
}

function assertOfficeBankImportParsePreviewRequest(context: ApiContext, request: BankImportParsePreviewRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.fileName, "fileName");
  assertStringField(context, request.contentText, "contentText");
  if (
    request.sourceHint !== null &&
    request.sourceHint !== "sbi" &&
    request.sourceHint !== "mcb" &&
    request.sourceHint !== "csv" &&
    request.sourceHint !== "pdf"
  ) {
    throw new ApiRouteError(
      400,
      "body_value_invalid",
      "Office bank parse-preview source hint is invalid.",
      [`path=${context.req.path}`, `sourceHint=${String(request.sourceHint)}`]
    );
  }
}

function assertOfficeBankImportPreviewRequest(context: ApiContext, request: BankImportPreviewRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.fileName, "fileName");
  assertStringField(context, request.checksum, "checksum");
  if (request.source !== "sbi" && request.source !== "mcb" && request.source !== "csv" && request.source !== "cashflow" && request.source !== "pdf") {
    throw new ApiRouteError(400, "body_value_invalid", "Office bank import source is invalid.", [`path=${context.req.path}`, `source=${String(request.source)}`]);
  }

  assertStringRecordRows(context, request.rows, "rows");
}

function assertOfficeBankImportConfirmRequest(context: ApiContext, request: BankImportConfirmRequest): void {
  assertStringField(context, request.workspaceId, "workspaceId");
  assertStringField(context, request.previewId, "previewId");
  assertStringArray(context, request.acceptedRowIds, "acceptedRowIds");
  assertStringArray(context, request.rejectedRowIds, "rejectedRowIds");
}

function assertStringField(context: ApiContext, value: unknown, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiRouteError(400, "body_field_required", "A required string body field is missing.", [`path=${context.req.path}`, `field=${field}`]);
  }
}

function assertStringArray(context: ApiContext, value: unknown, field: string): void {
  if (!Array.isArray(value) || value.some((item: unknown): boolean => typeof item !== "string" || item.trim().length === 0)) {
    throw new ApiRouteError(400, "body_field_invalid", "A body field must be an array of non-empty strings.", [`path=${context.req.path}`, `field=${field}`]);
  }
}

function assertStringRecordRows(context: ApiContext, value: unknown, field: string): void {
  if (!Array.isArray(value)) {
    throw new ApiRouteError(400, "body_field_invalid", "Import rows must be an array of string records.", [`path=${context.req.path}`, `field=${field}`]);
  }

  for (const [index, row] of value.entries()) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      throw new ApiRouteError(400, "body_field_invalid", "Import rows must be objects.", [`path=${context.req.path}`, `field=${field}`, `rowIndex=${String(index)}`]);
    }

    for (const [key, cell] of Object.entries(row as Readonly<Record<string, unknown>>)) {
      if (typeof cell !== "string") {
        throw new ApiRouteError(400, "body_field_invalid", "Import row cells must be strings.", [`path=${context.req.path}`, `field=${field}`, `rowIndex=${String(index)}`, `column=${key}`]);
      }
    }
  }
}

function previewRowsFromRecords(rows: readonly Readonly<Record<string, string>>[]): readonly ApiImportPreviewRow[] {
  return rows.map((row: Readonly<Record<string, string>>, index: number): ApiImportPreviewRow => ({
    id: `row_${String(index + 1)}`,
    rowNumber: index + 1,
    rawData: row
  }));
}

function buildAllocationExecutionPlan(
  dependencies: ApiServiceDependencies,
  period: string,
  lockKey: string,
  runId: string
): AllocationExecutionPlan {
  const pendingEarnings = dependencies.fixtures.distribution.normalizedEarnings
    .filter((earning) => earning.mappingStatus === "matched")
    .filter((earning) => earning.calculationStatus === "pending")
    .filter((earning) => earningMatchesPeriod(dependencies.fixtures.distribution, earning, period));
  const allocations: EarningAllocationInsert[] = [];
  const expenseApplications: ExpenseApplicationInsert[] = [];
  const costTermUpdates = new Map<string, CostTermStatusUpdate>();
  const suspenseItems: DistributionSuspenseItemInsert[] = [];

  for (const earning of pendingEarnings) {
    const outcome = buildAllocationPlan(
      toDistributionEarningInput(dependencies.fixtures.distribution, earning, runId, period),
      royaltyRulesForEarning(dependencies, earning, period),
      costStateForAllocation(dependencies)
    );
    if (isAllocationSuspense(outcome)) {
      suspenseItems.push(outcome.suspense);
      continue;
    }

    allocations.push(...outcome.allocations);
    expenseApplications.push(...outcome.expenseApplications);
    for (const update of outcome.costTermStatusUpdates) {
      costTermUpdates.set(update.id, update);
    }
  }

  return {
    runId,
    period,
    lockKey,
    pendingEarnings,
    allocations,
    expenseApplications,
    costTermStatusUpdates: [...costTermUpdates.values()],
    suspenseItems,
    batchId: singleBatchId(pendingEarnings)
  };
}

function toAllocationRunPlanResponse(plan: AllocationExecutionPlan, auditEventId: string | null): AllocationRunMutationResponse {
  return {
    runId: plan.runId,
    status: "completed",
    lockKey: plan.lockKey,
    auditEventId,
    allocationCount: plan.allocations.length,
    expenseApplicationCount: plan.expenseApplications.length,
    costTermUpdateCount: plan.costTermStatusUpdates.length,
    suspenseCount: plan.suspenseItems.length,
    allocations: plan.allocations,
    expenseApplications: plan.expenseApplications,
    costTermStatusUpdates: plan.costTermStatusUpdates,
    suspenseItems: plan.suspenseItems
  };
}

function isAllocationSuspense(outcome: DistributionAllocationOutcome): outcome is { readonly suspense: DistributionSuspenseItemInsert } {
  return "suspense" in outcome;
}

function toDistributionEarningInput(
  dataset: DistributionReadDataset,
  earning: DistributionReadDataset["normalizedEarnings"][number],
  runId: string,
  period: string
): DistributionEarningInput {
  const periodWindow = periodWindowForMonth(period);
  const track = trackForEarning(dataset, earning);
  return {
    id: earning.id,
    calculationRunId: runId,
    trackId: track?.id ?? null,
    grossAmount: earning.grossAmount,
    currency: earning.currency,
    saleDate: periodWindow.end,
    periodStart: periodWindow.start,
    periodEnd: periodWindow.end,
    today: periodWindow.end
  };
}

function royaltyRulesForEarning(
  dependencies: ApiServiceDependencies,
  earning: DistributionReadDataset["normalizedEarnings"][number],
  period: string
): readonly DistributionRoyaltyRuleInput[] {
  const track = trackForEarning(dependencies.fixtures.distribution, earning);
  const periodWindow = periodWindowForMonth(period);
  return dependencies.fixtures.distributionRoyaltyRules
    .filter((rule) => rule.status === "active")
    .filter((rule) => rule.effectiveFrom === null || rule.effectiveFrom <= periodWindow.end)
    .filter((rule) => rule.effectiveTo === null || rule.effectiveTo >= periodWindow.start)
    .filter((rule) => royaltyRuleScopeMatches(rule.scopeType, rule.scopeId, earning, track))
    .map((rule) => ({
      contractId: rule.contractId,
      royaltyRuleId: rule.royaltyRuleId,
      payeeId: rule.payeeId,
      artistId: rule.artistId,
      role: rule.role,
      percentage: rule.percentage
    }));
}

function royaltyRuleScopeMatches(
  scopeType: string | null,
  scopeId: string | null,
  earning: DistributionReadDataset["normalizedEarnings"][number],
  track: DistributionReadDataset["tracks"][number] | null
): boolean {
  if (scopeType === null || scopeId === null) {
    return true;
  }

  if (scopeType === "track") {
    return track?.id === scopeId;
  }

  if (scopeType === "isrc") {
    return earning.isrc === scopeId;
  }

  if (scopeType === "upc" || scopeType === "ean") {
    return earning.upc === scopeId;
  }

  return true;
}

function costStateForAllocation(dependencies: ApiServiceDependencies): DistributionCostState {
  return {
    costTerms: dependencies.fixtures.distributionCostTerms,
    expenseApplications: dependencies.fixtures.distributionExpenseApplications,
    fxRates: dependencies.fixtures.distributionFxRates
  };
}

function earningMatchesPeriod(
  dataset: DistributionReadDataset,
  earning: DistributionReadDataset["normalizedEarnings"][number],
  period: string
): boolean {
  const batch = dataset.importBatches.find((candidate) => candidate.id === earning.batchId);
  if (batch === undefined || batch.importedAt === null) {
    return false;
  }

  return batch.importedAt.startsWith(period);
}

function trackForEarning(
  dataset: DistributionReadDataset,
  earning: DistributionReadDataset["normalizedEarnings"][number]
): DistributionReadDataset["tracks"][number] | null {
  if (earning.isrc !== null) {
    const isrcMatch = dataset.tracks.find((track) => track.isrc === earning.isrc);
    if (isrcMatch !== undefined) {
      return isrcMatch;
    }
  }

  return null;
}

function singleBatchId(earnings: readonly DistributionReadDataset["normalizedEarnings"][number][]): string | null {
  const batchIds = uniqueStrings(earnings.map((earning) => earning.batchId));
  return batchIds.length === 1 ? batchIds[0] ?? null : null;
}

function periodWindowForMonth(period: string): { readonly start: string; readonly end: string } {
  const [yearText, monthText] = period.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${period}-01`,
    end: `${period}-${String(endDay).padStart(2, "0")}`
  };
}

function buildStatementGenerateExecutionPlan(
  dependencies: ApiServiceDependencies,
  request: StatementGenerateRequest,
  runId: string
): StatementGenerateExecutionPlan {
  const period = periodWindowForMonth(request.period);
  const allocationInputs = statementAllocationInputs(dependencies.fixtures.distribution, request.payeeIds);
  const payeeIds = request.payeeIds.length === 0 ? uniqueStrings(allocationInputs.map((allocation) => allocation.payeeId)) : request.payeeIds;
  const statementKeys = uniqueStatementKeys(allocationInputs.filter((allocation) => payeeIds.includes(allocation.payeeId)));
  const statementPlans = statementKeys.map((key): StatementPersistPlan => {
    assertNoLiveStatementForKey(dependencies, key.payeeId, period.start, period.end, key.currency);
    const payee = requireDistributionPayee(dependencies.fixtures.distribution, key.payeeId);
    const lastClosing = lastPayeeClosing(dependencies.fixtures.distributionPayeeBalances, key.payeeId, key.currency);
    const statementPlan = buildStatementPlan({ id: payee.id }, period, key.currency, allocationInputs, lastClosing, 1);
    const statementId = randomUUID();
    return {
      statementId,
      statement: statementPlan.statement,
      lines: statementPlan.lines,
      balanceLedgerRow: {
        ...statementPlan.balanceLedgerRow,
        statementId
      }
    };
  });

  return {
    runId,
    period: request.period,
    lockKey: request.lockKey,
    statementPlans
  };
}

function toStatementGenerateResponse(plan: StatementGenerateExecutionPlan, auditEventId: string): StatementGenerateMutationResponse {
  return {
    runId: plan.runId,
    status: "completed",
    lockKey: plan.lockKey,
    auditEventId,
    statementCount: plan.statementPlans.length,
    lineCount: statementLineCount(plan.statementPlans),
    balanceLedgerRowCount: plan.statementPlans.length,
    statements: plan.statementPlans.map((statementPlan) => ({
      id: statementPlan.statementId,
      payeeId: statementPlan.statement.payeeId,
      period: statementPlan.statement.periodStart.slice(0, 7),
      currency: statementPlan.statement.currency,
      amountDue: statementPlan.statement.amountDue,
      closingBalance: statementPlan.balanceLedgerRow.closingBalance
    }))
  };
}

function statementAllocationInputs(
  dataset: DistributionReadDataset,
  payeeIds: readonly string[]
): readonly StatementAllocationInput[] {
  const payeeFilter = new Set<string>(payeeIds);
  return dataset.earningAllocations
    .filter((allocation) => allocation.status === "calculated" || allocation.status === "posted")
    .filter((allocation) => payeeFilter.size === 0 || payeeFilter.has(allocation.payeeId))
    .map((allocation): StatementAllocationInput => {
      const earning = dataset.normalizedEarnings.find((candidate) => candidate.id === allocation.earningId);
      return {
        id: allocation.id,
        payeeId: allocation.payeeId,
        trackId: allocation.trackId,
        currency: allocation.currency,
        grossShare: allocation.grossShare,
        recoupmentApplied: allocation.recoupmentApplied,
        netPayable: allocation.netPayable,
        quantity: earning?.quantity ?? "0.000000"
      };
    });
}

function uniqueStatementKeys(allocations: readonly StatementAllocationInput[]): readonly { readonly payeeId: string; readonly currency: string }[] {
  const keys = new Map<string, { readonly payeeId: string; readonly currency: string }>();
  for (const allocation of allocations) {
    keys.set(`${allocation.payeeId}:${allocation.currency}`, {
      payeeId: allocation.payeeId,
      currency: allocation.currency
    });
  }

  return [...keys.values()].sort((left, right) => `${left.payeeId}:${left.currency}`.localeCompare(`${right.payeeId}:${right.currency}`));
}

function assertNoLiveStatementForKey(
  dependencies: ApiServiceDependencies,
  payeeId: string,
  periodStart: string,
  periodEnd: string,
  currency: string
): void {
  const existing = dependencies.fixtures.distribution.statements.find(
    (statement) =>
      statement.payeeId === payeeId &&
      statement.periodStart === periodStart &&
      statement.periodEnd === periodEnd &&
      statement.currency === currency &&
      statement.status !== "void"
  );
  if (existing !== undefined) {
    throw new ApiRouteError(409, "statement_generation_conflict", "A live statement already exists for this payee, period, and currency.", [
      `statementId=${existing.id}`,
      `payeeId=${payeeId}`,
      `periodStart=${periodStart}`,
      `periodEnd=${periodEnd}`,
      `currency=${currency}`
    ]);
  }
}

function requireDistributionPayee(dataset: DistributionReadDataset, payeeId: string): DistributionReadDataset["payees"][number] {
  const payee = dataset.payees.find((candidate) => candidate.id === payeeId);
  if (payee === undefined) {
    throw new ApiRouteError(404, "distribution_payee_not_found", "Distribution payee was not found.", [`payeeId=${payeeId}`]);
  }

  return payee;
}

function lastPayeeClosing(rows: readonly PayeeBalanceLedgerInput[], payeeId: string, currency: string): string {
  const latest = [...rows]
    .filter((row) => row.payeeId === payeeId && row.currency === currency)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  return latest?.closingBalance ?? "0.0000000000";
}

function statementLineCount(plans: readonly StatementPersistPlan[]): number {
  return plans.reduce((sum: number, plan) => sum + plan.lines.length, 0);
}

function statementLockKey(payeeId: string, periodStart: string, currency: string): string {
  return `distribution:statement:${payeeId}:${periodStart.slice(0, 7)}:${currency}`;
}

function previewIdFor(scope: string, fingerprint: string): string {
  return `preview_${scope}_${hashRequestBody({ fingerprint }).slice(0, 16)}`;
}

function currencyCodesFromRows(rows: readonly Readonly<Record<string, string>>[], fallback: string | null): readonly CurrencyCode[] {
  const codes = uniqueStrings(
    rows
      .map((row: Readonly<Record<string, string>>): string | null => normalizedCurrency(rowValue(row, ["currency", "currency_code", "Currency", "CURRENCY"])))
      .filter((currency: string | null): currency is string => currency !== null)
  );
  if (codes.length > 0) {
    return codes;
  }

  return fallback === null ? [] : [fallback];
}

function normalizedCurrency(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/u.test(normalized) ? normalized : null;
}

function joinKeysFromRows(rows: readonly Readonly<Record<string, string>>[]): readonly string[] {
  const normalizedKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      normalizedKeys.add(normalizeColumnKey(key));
    }
  }

  const keys: string[] = [];
  if (normalizedKeys.has("isrc")) {
    keys.push("ISRC");
  }

  if (normalizedKeys.has("upc") || normalizedKeys.has("ean")) {
    keys.push("UPC/EAN");
  }

  if (normalizedKeys.has("title")) {
    keys.push("title");
  }

  if (normalizedKeys.has("artist")) {
    keys.push("artist");
  }

  return keys.length === 0 ? ["raw_row"] : keys;
}

// Roll up per-row rejection issues into {reason, count}, most frequent first, so the
// import UI can explain why rows were dropped (e.g. account_not_found) instead of just a count.
function aggregateRejectionReasons(rows: readonly ParsedOfficeBankPreviewRow[]): readonly OfficeImportRejectionReason[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const issue of row.issues) {
      counts.set(issue, (counts.get(issue) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]: readonly [string, number]): OfficeImportRejectionReason => ({ reason, count }))
    .sort((left: OfficeImportRejectionReason, right: OfficeImportRejectionReason): number => right.count - left.count);
}

// Per-row accepted/rejected outcome for the preview table. The id matches confirm's acceptedRowIds.
function previewRowResult(parsed: ParsedOfficeBankPreviewRow): OfficeBankPreviewRowResult {
  return {
    id: parsed.row.id,
    rowNumber: parsed.row.rowNumber,
    status: parsed.line !== null ? "accepted" : "rejected",
    issues: parsed.issues
  };
}

function parseOfficeBankPreviewRow(
  row: ApiImportPreviewRow,
  workspaceId: string,
  accounts: readonly OfficeBankAccountRow[],
  exchangeRates: readonly OfficeWriteExchangeRateRow[]
): ParsedOfficeBankPreviewRow {
  const currency = normalizedCurrency(rowValue(row.rawData, ["currency", "currency_code", "Currency", "CURRENCY"])) ?? "MUR";
  const account = accountForRow(row.rawData, workspaceId, currency, accounts);
  const occurredOn = isoDateValue(row.rawData, ["occurredOn", "occurred_on", "transactionDate", "transaction_date", "date", "DATE", "Date", "paid_on", "paidOn"]);
  const description = rowValue(row.rawData, ["description", "label", "particulars", "details", "narrative", "memo"]);
  const amount = amountForBankRow(row.rawData);
  // Foreign-currency lines without an explicit MUR amount are converted via the office FX
  // table (exchange_rates) at the transaction date, so they consolidate into the MUR books.
  const amountMurMinor =
    amount === null
      ? null
      : amount.amountMurMinor !== null
        ? amount.amountMurMinor
        : occurredOn !== null
          ? convertMinorToMurViaFinanceKernel(amount.amountMinor, amount.currency, occurredOn, exchangeRates)
          : null;
  const issues = [
    ...(account === null ? ["account_not_found"] : []),
    ...(occurredOn === null ? ["occurred_on_missing"] : []),
    ...(description === null ? ["description_missing"] : []),
    ...(amount === null ? ["amount_missing_or_invalid"] : []),
    ...(amount !== null && amountMurMinor === null ? ["amount_mur_missing_for_foreign_currency"] : [])
  ];

  if (issues.length > 0 || account === null || occurredOn === null || description === null || amount === null || amountMurMinor === null) {
    return {
      row,
      line: null,
      issues
    };
  }

  return {
    row,
    line: {
      id: randomUUID(),
      accountId: account.id,
      occurredOn,
      valueOn: isoDateValue(row.rawData, ["valueOn", "value_on", "valueDate", "value_date"]),
      description,
      reference: rowValue(row.rawData, ["reference", "ref", "transactionId", "transaction_id", "invoice_ref"]),
      direction: amount.direction,
      amountMinor: amount.amountMinor,
      balanceMinor: moneyValue(row.rawData, ["balance", "balanceMinor", "closingBalance", "closing_balance"]),
      currency: amount.currency,
      amountMurMinor,
      balanceMurMinor: moneyValue(row.rawData, ["balanceMur", "balance_mur", "balanceMurMinor", "balance_mur_minor"]),
      isDuplicateCandidate: false,
      rawData: row.rawData
    },
    issues: []
  };
}

function buildOfficeReconciliationSuggestions(
  dataset: OfficeAnalyticsDataset,
  workspaceId: string,
  lines: readonly OfficeBankStatementLineInsert[]
): readonly OfficeReconciliationSuggestion[] {
  if (lines.length === 0) {
    return [];
  }

  const transactionPool = dataset.transactions.filter(
    (transaction) =>
      transaction.workspaceId === workspaceId &&
      transaction.isActive &&
      transaction.status !== "cancelled" &&
      isSuggestibleOfficeTransactionStatus(transaction.status)
  );
  const alreadyMatchedTransactionIds = new Set<string>([
    ...dataset.bankStatementLines
      .filter((line) => line.reconciliationStatus === "matched" && line.matchedTransactionId !== null)
      .map((line) => line.matchedTransactionId as string),
    ...dataset.bankReconciliationMatches
      .filter((match) => match.status === "matched")
      .map((match) => match.transactionId)
  ]);

  const usedTransactionIds = new Set<string>();
  const suggestions: OfficeReconciliationSuggestion[] = [];

  for (const line of lines) {
    if (line.isDuplicateCandidate) {
      continue;
    }

    const expectedType: OfficeTransactionRow["type"] = line.direction === "debit" ? "expense" : "income";
    const rankedCandidates = transactionPool
      .filter(
        (transaction) =>
          transaction.type === expectedType &&
          absBigInt(transaction.amountMinor) === line.amountMurMinor &&
          !alreadyMatchedTransactionIds.has(transaction.id) &&
          !usedTransactionIds.has(transaction.id)
      )
      .map((transaction): OfficeReconciliationSuggestionCandidate => {
        const score = reconciliationSuggestionScore(line, transaction);
        return {
          transaction,
          confidenceBp: score.confidenceBp,
          dayDistance: score.dayDistance,
          sharedTokenCount: score.sharedTokenCount,
          referenceMatched: score.referenceMatched
        };
      })
      .filter(
        (candidate) =>
          candidate.confidenceBp >= 7800 &&
          hasReconciliationSuggestionEvidence(candidate)
      )
      .sort(compareReconciliationSuggestionCandidates);

    const best = rankedCandidates[0];
    if (best === undefined) {
      continue;
    }

    if (!isReconciliationSuggestionUnambiguous(best, rankedCandidates[1])) {
      continue;
    }

    usedTransactionIds.add(best.transaction.id);
    suggestions.push({
      statementLineId: line.id,
      transactionId: best.transaction.id,
      confidenceBp: best.confidenceBp
    });
  }

  return suggestions;
}

function isSuggestibleOfficeTransactionStatus(status: OfficeTransactionRow["status"]): boolean {
  return status === "draft" || status === "validated";
}

function compareReconciliationSuggestionCandidates(
  left: OfficeReconciliationSuggestionCandidate,
  right: OfficeReconciliationSuggestionCandidate
): number {
  if (right.confidenceBp !== left.confidenceBp) {
    return right.confidenceBp - left.confidenceBp;
  }

  if (left.dayDistance !== right.dayDistance) {
    return left.dayDistance - right.dayDistance;
  }

  if (right.sharedTokenCount !== left.sharedTokenCount) {
    return right.sharedTokenCount - left.sharedTokenCount;
  }

  return left.transaction.id.localeCompare(right.transaction.id);
}

function hasReconciliationSuggestionEvidence(candidate: OfficeReconciliationSuggestionCandidate): boolean {
  if (candidate.referenceMatched) {
    return true;
  }

  if (candidate.sharedTokenCount > 0) {
    return true;
  }

  return candidate.dayDistance <= 1;
}

function isReconciliationSuggestionUnambiguous(
  best: OfficeReconciliationSuggestionCandidate,
  second: OfficeReconciliationSuggestionCandidate | undefined
): boolean {
  if (second === undefined) {
    return true;
  }

  const confidenceGap = best.confidenceBp - second.confidenceBp;
  if (confidenceGap >= 500) {
    return true;
  }

  if (best.referenceMatched && confidenceGap >= 200) {
    return true;
  }

  if (best.dayDistance === 0 && confidenceGap >= 300 && best.sharedTokenCount > second.sharedTokenCount) {
    return true;
  }

  return false;
}

function reconciliationSuggestionScore(
  line: OfficeBankStatementLineInsert,
  transaction: OfficeTransactionRow
): OfficeReconciliationSuggestionScore {
  const lineDate = line.occurredOn;
  const transactionDate = transaction.transactionDate.slice(0, 10);
  const occurredOnDistance = absoluteIsoDayDistance(lineDate, transactionDate);
  const valueOnDistance = line.valueOn === null ? Number.MAX_SAFE_INTEGER : absoluteIsoDayDistance(line.valueOn, transactionDate);
  const dayDistance = Math.min(occurredOnDistance, valueOnDistance);
  if (dayDistance > 10) {
    return {
      confidenceBp: 0,
      dayDistance,
      sharedTokenCount: 0,
      referenceMatched: false
    };
  }

  let confidence = 6200;
  if (dayDistance === 0) {
    confidence += 2600;
  } else if (dayDistance <= 1) {
    confidence += 2200;
  } else if (dayDistance <= 3) {
    confidence += 1500;
  } else if (dayDistance <= 5) {
    confidence += 900;
  } else if (dayDistance <= 7) {
    confidence += 500;
  } else {
    confidence += 200;
  }

  const lineText = normalizedSuggestionText(`${line.description} ${line.reference ?? ""}`);
  const transactionText = normalizedSuggestionText(transaction.description ?? "");
  const lineReference = normalizedSuggestionReference(line.reference);
  const transactionCompactText = compactSuggestionText(transaction.description ?? "");
  const referenceMatched = lineReference !== null && transactionCompactText.includes(lineReference);
  const sharedTokenCount = lineText.length > 0 && transactionText.length > 0
    ? sharedSuggestionTokenCount(lineText, transactionText)
    : 0;

  if (transaction.accountId !== null && transaction.accountId === line.accountId) {
    confidence += 350;
  } else if (transaction.accountId !== null && transaction.accountId !== line.accountId) {
    confidence -= 300;
  }

  if (lineText.length > 0 && transactionText.length > 0) {
    confidence += Math.min(1400, sharedTokenCount * 250);

    if (
      (transactionText.length >= 6 && lineText.includes(transactionText)) ||
      (lineText.length >= 6 && transactionText.includes(lineText))
    ) {
      confidence += 700;
    }
  }

  if (referenceMatched) {
    confidence += 1100;
  }

  if (!referenceMatched && sharedTokenCount === 0 && dayDistance > 1) {
    confidence -= 900;
  }

  if (transaction.status === "draft") {
    confidence += 150;
  }

  return {
    confidenceBp: Math.max(0, Math.min(9999, confidence)),
    dayDistance,
    sharedTokenCount,
    referenceMatched
  };
}

function normalizedSuggestionReference(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const compact = compactSuggestionText(value);
  if (compact.length < 4) {
    return null;
  }

  return compact;
}

function compactSuggestionText(value: string): string {
  return normalizedSuggestionText(value).replace(/\s+/gu, "");
}

function normalizedSuggestionText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ");
}

function sharedSuggestionTokenCount(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter((token) => token.length >= 3));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length >= 3));
  let count = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      count += 1;
    }
  }
  return count;
}

function absoluteIsoDayDistance(leftDate: string, rightDate: string): number {
  const left = Date.parse(`${leftDate}T00:00:00Z`);
  const right = Date.parse(`${rightDate}T00:00:00Z`);
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.floor(Math.abs(left - right) / 86_400_000);
}

function accountForRow(
  row: Readonly<Record<string, string>>,
  workspaceId: string,
  currency: string,
  accounts: readonly OfficeBankAccountRow[]
): OfficeBankAccountRow | null {
  const accountId = rowValue(row, ["accountId", "account_id"]);
  if (accountId !== null) {
    // Look up by ID only — workspace access is validated upstream by resolveWorkspaceId.
    // Filtering by workspaceId here caused the same false-null as reassign-account:
    // accounts with a mismatched stored workspace_id fell through to the currency
    // fallback and landed on the wrong bank.
    return accounts.find((account: OfficeBankAccountRow): boolean => account.id === accountId) ?? null;
  }

  return accounts.find((account: OfficeBankAccountRow): boolean => account.workspaceId === workspaceId && account.currency === currency && account.isActive) ?? null;
}

function amountForBankRow(row: Readonly<Record<string, string>>): {
  readonly amountMinor: bigint;
  readonly amountMurMinor: bigint | null;
  readonly currency: string;
  readonly direction: "credit" | "debit";
} | null {
  const currency = normalizedCurrency(rowValue(row, ["currency", "currency_code", "Currency", "CURRENCY"])) ?? "MUR";
  const credit = moneyValue(row, ["credit", "Credit", "amountCredit", "amount_credit"]);
  const debit = moneyValue(row, ["debit", "Debit", "amountDebit", "amount_debit"]);

  // Direction for statement ingestion is authoritative from debit/credit columns
  // only. Generic amount/signed fallbacks are intentionally rejected.
  if (credit !== null && debit !== null) {
    return null;
  }

  if (credit !== null) {
    return {
      amountMinor: absBigInt(credit),
      amountMurMinor: currency === "MUR" ? absBigInt(credit) : moneyValue(row, ["amountMur", "amount_mur", "amountMurMinor", "amount_mur_minor"]),
      currency,
      direction: "credit"
    };
  }

  if (debit !== null) {
    return {
      amountMinor: absBigInt(debit),
      amountMurMinor: currency === "MUR" ? absBigInt(debit) : moneyValue(row, ["amountMur", "amount_mur", "amountMurMinor", "amount_mur_minor"]),
      currency,
      direction: "debit"
    };
  }

  return null;
}

function convertMinorToMurViaFinanceKernel(
  amountMinor: bigint,
  fromCurrency: string,
  occurredOn: string,
  exchangeRates: readonly OfficeWriteExchangeRateRow[]
): bigint | null {
  if (fromCurrency === "MUR") {
    return amountMinor;
  }

  const rate = pickMurExchangeRateForPreview(fromCurrency, occurredOn, exchangeRates);
  if (rate === null) {
    return null;
  }

  try {
    const converted = convertMoney(
      createMoneyAmount(createMoneyMicroUnits(absBigInt(amountMinor)), createCurrencyCode(fromCurrency)),
      createCurrencyCode("MUR"),
      {
        fromCurrency: createCurrencyCode(rate.fromCurrency),
        toCurrency: createCurrencyCode(rate.toCurrency),
        rateDecimal: decimalFromE10(rate.rateE10),
        effectiveDate: rate.effectiveDate,
        source: "office.exchange_rates"
      }
    );

    return converted.amountMicro;
  } catch (_error: unknown) {
    return null;
  }
}

function pickMurExchangeRateForPreview(
  fromCurrency: string,
  occurredOn: string,
  exchangeRates: readonly OfficeWriteExchangeRateRow[]
): OfficeWriteExchangeRateRow | null {
  const candidates = exchangeRates.filter(
    (rate: OfficeWriteExchangeRateRow): boolean => rate.fromCurrency === fromCurrency && rate.toCurrency === "MUR"
  );
  if (candidates.length === 0) {
    return null;
  }

  const onOrBefore = candidates.filter((rate: OfficeWriteExchangeRateRow): boolean => rate.effectiveDate <= occurredOn);
  const pool = onOrBefore.length > 0 ? onOrBefore : candidates;
  return pool.reduce(
    (best: OfficeWriteExchangeRateRow | null, rate: OfficeWriteExchangeRateRow): OfficeWriteExchangeRateRow =>
      best === null || rate.effectiveDate > best.effectiveDate ? rate : best,
    null as OfficeWriteExchangeRateRow | null
  );
}

function decimalFromE10(rateE10: bigint): string {
  const sign = rateE10 < 0n ? "-" : "";
  const digits = absBigInt(rateE10).toString().padStart(11, "0");
  const integer = digits.slice(0, -10);
  const fraction = digits.slice(-10);
  return `${sign}${integer}.${fraction}`;
}

function directionValue(row: Readonly<Record<string, string>>): "credit" | "debit" | null {
  const value = rowValue(row, ["direction", "type", "debitCredit", "debit_credit"]);
  if (value === null) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "credit" || normalized === "cr" || normalized === "income") {
    return "credit";
  }

  if (normalized === "debit" || normalized === "dr" || normalized === "expense") {
    return "debit";
  }

  return null;
}

function moneyValue(row: Readonly<Record<string, string>>, aliases: readonly string[]): bigint | null {
  const value = rowValue(row, aliases);
  if (value === null) {
    return null;
  }

  try {
    return eofMoney.parse(cleanMoneyText(value));
  } catch (_error: unknown) {
    return null;
  }
}

function signedMoneyValue(row: Readonly<Record<string, string>>, aliases: readonly string[]): bigint | null {
  return moneyValue(row, aliases);
}

function cleanMoneyText(value: string): string {
  const original = value.trim();
  if (original.length === 0) {
    return "";
  }

  let sign = "";
  let trimmed = original;
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    sign = "-";
    trimmed = trimmed.slice(1, -1).trim();
  }

  if (trimmed.startsWith("+")) {
    trimmed = trimmed.slice(1).trim();
  } else if (trimmed.startsWith("-")) {
    sign = "-";
    trimmed = trimmed.slice(1).trim();
  }

  const compacted = trimmed
    .replaceAll(/\u00a0/g, "")
    .replaceAll(" ", "")
    .replace(/[^0-9.,]/gu, "");

  if (compacted.length === 0) {
    return "";
  }

  const lastComma = compacted.lastIndexOf(",");
  const lastDot = compacted.lastIndexOf(".");

  if (lastComma === -1 && lastDot === -1) {
    return `${sign}${compacted}`;
  }

  if (lastComma === -1) {
    return `${sign}${compacted.replace(/,/gu, "")}`;
  }

  if (lastDot === -1) {
    const decimalPart = compacted.slice(lastComma + 1);
    const integerWithGroup = compacted.slice(0, lastComma);
    const integerGroups = integerWithGroup.split(",");

    if (
      decimalPart.length > 0 &&
      decimalPart.length <= 2 &&
      integerGroups.every((group: string, groupIndex: number): boolean => (groupIndex === 0 ? group.length >= 1 && group.length <= 3 : group.length === 3))
    ) {
      return `${sign}${integerWithGroup.replace(/,/gu, "")}.${decimalPart}`;
    }

    return `${sign}${compacted.replace(/,/gu, "")}`;
  }

  if (lastComma > lastDot) {
    return `${sign}${compacted.slice(0, lastComma).replace(/,/gu, "")}.${compacted.slice(lastComma + 1)}`;
  }

  return `${sign}${compacted.replace(/,/gu, "")}`;
}

function isoDateValue(row: Readonly<Record<string, string>>, aliases: readonly string[]): string | null {
  const value = rowValue(row, aliases);
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
    return trimmed;
  }

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u.exec(trimmed);
  if (slashMatch !== null) {
    const rawDay = slashMatch[1];
    const rawMonth = slashMatch[2];
    const rawYear = slashMatch[3];
    if (rawDay === undefined || rawMonth === undefined || rawYear === undefined) {
      return null;
    }

    const day = rawDay.padStart(2, "0");
    const month = rawMonth.padStart(2, "0");
    return `${rawYear}-${month}-${day}`;
  }

  return null;
}

function rowValue(row: Readonly<Record<string, string>>, aliases: readonly string[]): string | null {
  const normalizedAliases = new Set<string>(aliases.map((alias: string): string => normalizeColumnKey(alias)));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeColumnKey(key)) && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function normalizeColumnKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "");
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set<string>(values)];
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function officeDateRange(dates: readonly string[]): OfficeDateRange {
  if (dates.length === 0) {
    return {
      start: null,
      end: null,
      label: "undetected"
    };
  }

  const sorted = [...dates].sort();
  const start = sorted[0] ?? null;
  const end = sorted[sorted.length - 1] ?? null;
  if (start === null || end === null) {
    return {
      start: null,
      end: null,
      label: "undetected"
    };
  }

  return {
    start,
    end,
    label: start === end ? start : `${start} to ${end}`
  };
}

async function requireDistributionPreview(
  context: ApiContext,
  dependencies: ApiServiceDependencies,
  previewId: string,
  workspaceId: string
): Promise<DistributionImportPreviewRecord> {
  const preview = await dependencies.persistence.getDistributionImportPreview(previewId);
  return requireDistributionPreviewRecord(context, preview, previewId, workspaceId);
}

async function requireDistributionPreviewInWrite(
  context: ApiContext,
  dependencies: ApiServiceDependencies,
  tx: ApiWriteTransaction,
  previewId: string,
  workspaceId: string
): Promise<DistributionImportPreviewRecord> {
  if (tx.kind === "memory") {
    return requireDistributionPreview(context, dependencies, previewId, workspaceId);
  }

  const preview = await getDistributionImportPreviewInTransaction(tx, previewId);
  return requireDistributionPreviewRecord(context, preview, previewId, workspaceId);
}

function requireDistributionPreviewRecord(
  context: ApiContext,
  preview: DistributionImportPreviewRecord | null,
  previewId: string,
  workspaceId: string
): DistributionImportPreviewRecord {
  if (preview === null) {
    throw new ApiRouteError(400, "import_preview_missing", "Import preview was not found or has expired; run preview again before confirm.", [
      `path=${context.req.path}`,
      `previewId=${previewId}`
    ]);
  }

  if (preview.workspaceId !== workspaceId) {
    throw new ApiRouteError(400, "import_preview_workspace_mismatch", "Import preview belongs to a different workspace.", [
      `path=${context.req.path}`,
      `previewId=${previewId}`,
      `workspaceId=${workspaceId}`,
      `previewWorkspaceId=${preview.workspaceId}`
    ]);
  }

  return preview;
}

async function requireOfficeBankPreview(
  context: ApiContext,
  dependencies: ApiServiceDependencies,
  previewId: string,
  workspaceId: string
): Promise<OfficeBankImportPreviewRecord> {
  const preview = await dependencies.persistence.getOfficeBankImportPreview(previewId);
  return requireOfficeBankPreviewRecord(context, preview, previewId, workspaceId);
}

async function requireOfficeBankPreviewInWrite(
  context: ApiContext,
  dependencies: ApiServiceDependencies,
  tx: ApiWriteTransaction,
  previewId: string,
  workspaceId: string
): Promise<OfficeBankImportPreviewRecord> {
  if (tx.kind === "memory") {
    return requireOfficeBankPreview(context, dependencies, previewId, workspaceId);
  }

  const preview = await getOfficeBankImportPreviewInTransaction(tx, previewId);
  return requireOfficeBankPreviewRecord(context, preview, previewId, workspaceId);
}

function requireOfficeBankPreviewRecord(
  context: ApiContext,
  preview: OfficeBankImportPreviewRecord | null,
  previewId: string,
  workspaceId: string
): OfficeBankImportPreviewRecord {
  if (preview === null) {
    throw new ApiRouteError(400, "bank_import_preview_missing", "Bank import preview was not found or has expired; run preview again before confirm.", [
      `path=${context.req.path}`,
      `previewId=${previewId}`
    ]);
  }

  if (preview.workspaceId !== workspaceId) {
    throw new ApiRouteError(400, "bank_import_preview_workspace_mismatch", "Bank import preview belongs to a different workspace.", [
      `path=${context.req.path}`,
      `previewId=${previewId}`,
      `workspaceId=${workspaceId}`,
      `previewWorkspaceId=${preview.workspaceId}`
    ]);
  }

  return preview;
}

function appendDistributionImportFixture(
  fixtures: ApiFixtureStore,
  batch: DistributionReadDataset["importBatches"][number]
): void {
  const mutableDistribution = fixtures.distribution as Mutable<DistributionReadDataset>;
  mutableDistribution.importBatches = [...fixtures.distribution.importBatches, batch];
}

function appendAllocationRunFixture(fixtures: ApiFixtureStore, input: PersistDistributionAllocationRunInput): void {
  const mutableDistribution = fixtures.distribution as Mutable<DistributionReadDataset>;
  const createdAt = input.finishedAtIso;
  mutableDistribution.calculationRuns = [
    ...fixtures.distribution.calculationRuns,
    {
      id: input.runId,
      batchId: input.batchId,
      status: "calculated",
      startedAt: input.startedAtIso,
      finishedAt: input.finishedAtIso,
      createdAt
    }
  ];
  mutableDistribution.earningAllocations = [
    ...fixtures.distribution.earningAllocations,
    ...input.allocations.map((allocation: PersistedEarningAllocationInsert): DistributionReadDataset["earningAllocations"][number] => ({
      id: allocation.id,
      earningId: allocation.earningId,
      calculationRunId: input.runId,
      payeeId: allocation.payeeId,
      contractId: allocation.contractId,
      trackId: allocation.trackId,
      grossAmount: allocation.grossAmount,
      grossShare: allocation.grossShare,
      recoupmentApplied: allocation.recoupmentApplied,
      netPayable: allocation.netPayable,
      splitPercentage: allocation.splitPercentage,
      currency: allocation.currency,
      status: "calculated",
      createdAt
    }))
  ];
  mutableDistribution.suspenseItems = [
    ...fixtures.distribution.suspenseItems,
    ...input.suspenseItems.map((suspense: DistributionSuspenseItemInsert, index: number): DistributionReadDataset["suspenseItems"][number] => ({
      id: `suspense_${input.runId}_${String(index + 1)}`,
      earningId: suspense.earningId,
      amount: suspense.amount,
      currency: suspense.currency,
      reasonCode: suspense.reasonCode,
      resolved: false,
      resolvedAt: null,
      createdAt
    }))
  ];
  mutableDistribution.normalizedEarnings = fixtures.distribution.normalizedEarnings.map((earning) => {
    if (!input.allocations.some((allocation) => allocation.earningId === earning.id) && !input.suspenseItems.some((suspense) => suspense.earningId === earning.id)) {
      return earning;
    }

    return {
      ...earning,
      calculationStatus: input.allocations.some((allocation) => allocation.earningId === earning.id) ? "calculated" : "suspense"
    };
  });
  appendDistributionAllocationStateFixture(fixtures, input);
}

function appendStatementGenerateFixture(fixtures: ApiFixtureStore, plan: StatementGenerateExecutionPlan, createdAt: string): void {
  const mutableDistribution = fixtures.distribution as Mutable<DistributionReadDataset>;
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  mutableDistribution.statements = [
    ...fixtures.distribution.statements,
    ...plan.statementPlans.map((statementPlan): DistributionReadDataset["statements"][number] => ({
      id: statementPlan.statementId,
      payeeId: statementPlan.statement.payeeId,
      calculationRunId: null,
      periodStart: statementPlan.statement.periodStart,
      periodEnd: statementPlan.statement.periodEnd,
      currency: statementPlan.statement.currency,
      grossTotal: statementPlan.statement.grossTotal,
      recoupmentTotal: statementPlan.statement.recoupmentTotal,
      netPayable: statementPlan.statement.netPayable,
      amountDue: statementPlan.statement.amountDue,
      version: statementPlan.statement.version,
      status: statementPlan.statement.status,
      createdAt
    }))
  ];
  mutableDistribution.statementLines = [
    ...fixtures.distribution.statementLines,
    ...plan.statementPlans.flatMap((statementPlan): readonly DistributionReadDataset["statementLines"][number][] =>
      statementPlan.lines.map((line, index) => ({
        id: `statement_line_${statementPlan.statementId}_${String(index + 1)}`,
        statementId: statementPlan.statementId,
        earningAllocationId: line.earningAllocationId,
        trackId: line.trackId,
        grossShare: line.grossShare,
        recoupmentApplied: line.recoupmentApplied,
        netPayable: line.netPayable,
        quantity: line.quantity,
        currency: line.currency
      }))
    )
  ];
  mutableFixtures.distributionPayeeBalances = [
    ...fixtures.distributionPayeeBalances,
    ...plan.statementPlans.map((statementPlan): PayeeBalanceLedgerInput => ({
      id: `balance_${statementPlan.statementId}`,
      payeeId: statementPlan.balanceLedgerRow.payeeId,
      statementId: statementPlan.statementId,
      currency: statementPlan.balanceLedgerRow.currency,
      openingBalance: statementPlan.balanceLedgerRow.openingBalance,
      periodNet: statementPlan.balanceLedgerRow.periodNet,
      closingBalance: statementPlan.balanceLedgerRow.closingBalance,
      movementType: statementPlan.balanceLedgerRow.movementType,
      createdAt
    }))
  ];
}

function appendStatementVoidFixture(fixtures: ApiFixtureStore, input: PersistDistributionStatementVoidInput, createdAt: string): void {
  const mutableDistribution = fixtures.distribution as Mutable<DistributionReadDataset>;
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  mutableDistribution.statements = fixtures.distribution.statements.map((statement) =>
    statement.id === input.statementId ? { ...statement, status: input.status } : statement
  );
  mutableFixtures.distributionPayeeBalances = [
    ...fixtures.distributionPayeeBalances,
    {
      id: `balance_void_${input.statementId}_${String(fixtures.distributionPayeeBalances.length + 1)}`,
      payeeId: input.reversalLedgerRow.payeeId,
      statementId: input.statementId,
      currency: input.reversalLedgerRow.currency,
      openingBalance: input.reversalLedgerRow.openingBalance,
      periodNet: input.reversalLedgerRow.periodNet,
      closingBalance: input.reversalLedgerRow.closingBalance,
      movementType: input.reversalLedgerRow.movementType,
      createdAt
    }
  ];
}

function paymentRecordFixturePatch(input: PersistDistributionPaymentRecordInput): DistributionPaymentFixturePatch {
  return {
    payment: {
      id: input.paymentId,
      payeeId: input.payeeId,
      amount: input.amount,
      currency: input.currency,
      status: "recorded",
      paidAt: input.paidAt,
      reference: input.reference
    },
    link: {
      id: input.statementPaymentLinkId,
      statementId: input.statementId,
      paymentId: input.paymentId,
      amountApplied: input.amount
    }
  };
}

function paymentUpdateFixturePatch(
  payment: DistributionReadDataset["payments"][number],
  link: DistributionReadDataset["statementPaymentLinks"][number],
  input: PersistDistributionPaymentUpdateInput
): DistributionPaymentFixturePatch {
  return {
    payment: {
      ...payment,
      amount: input.amount,
      currency: input.currency,
      status: "edited",
      reference: input.reference
    },
    link: {
      ...link,
      amountApplied: input.amount
    }
  };
}

function paymentReconcileFixturePatch(
  payment: DistributionReadDataset["payments"][number],
  link: DistributionReadDataset["statementPaymentLinks"][number],
  input: PersistDistributionPaymentReconcileInput
): DistributionPaymentFixturePatch {
  return {
    payment: {
      ...payment,
      status: "reconciled"
    },
    link: {
      ...link,
      id: input.statementPaymentLinkId,
      statementId: input.statementId,
      amountApplied: input.amountApplied
    }
  };
}

function paymentVoidFixturePatch(
  payment: DistributionReadDataset["payments"][number],
  link: DistributionReadDataset["statementPaymentLinks"][number]
): DistributionPaymentFixturePatch {
  // The link is kept untouched: balance projections zero out applied amounts
  // for void payments, so the statement balance recomputes without deletion.
  return {
    payment: {
      ...payment,
      status: "void"
    },
    link
  };
}

function applyDistributionPaymentPatchFixture(fixtures: ApiFixtureStore, patch: DistributionPaymentFixturePatch): void {
  const mutableDistribution = fixtures.distribution as Mutable<DistributionReadDataset>;
  mutableDistribution.payments = upsertPayment(fixtures.distribution.payments, patch.payment);
  mutableDistribution.statementPaymentLinks = upsertStatementPaymentLink(fixtures.distribution.statementPaymentLinks, patch.link);
}

function distributionDatasetWithPaymentPatch(dataset: DistributionReadDataset, patch: DistributionPaymentFixturePatch): DistributionReadDataset {
  return {
    ...dataset,
    payments: upsertPayment(dataset.payments, patch.payment),
    statementPaymentLinks: upsertStatementPaymentLink(dataset.statementPaymentLinks, patch.link)
  };
}

function upsertPayment(
  payments: readonly DistributionReadDataset["payments"][number][],
  payment: DistributionReadDataset["payments"][number]
): readonly DistributionReadDataset["payments"][number][] {
  const existing = payments.some((candidate) => candidate.id === payment.id);
  if (!existing) {
    return [...payments, payment];
  }

  return payments.map((candidate) => (candidate.id === payment.id ? payment : candidate));
}

function upsertStatementPaymentLink(
  links: readonly DistributionReadDataset["statementPaymentLinks"][number][],
  link: DistributionReadDataset["statementPaymentLinks"][number]
): readonly DistributionReadDataset["statementPaymentLinks"][number][] {
  const existing = links.some((candidate) => candidate.statementId === link.statementId && candidate.paymentId === link.paymentId);
  if (!existing) {
    return [...links, link];
  }

  return links.map((candidate) => (candidate.statementId === link.statementId && candidate.paymentId === link.paymentId ? link : candidate));
}

function computePaymentBalances(dataset: DistributionReadDataset, statementId: string): PaymentBalanceProjection {
  const statement = requireDistributionStatement(dataset, statementId);
  const paymentLinks = statementPaymentBalanceInputs(dataset);
  const statements = dataset.statements.map((row): StatementPaymentStatementInput => ({
    id: row.id,
    currency: row.currency,
    amountDue: row.amountDue
  }));
  return {
    statementBalance: computeStatementBalance(
      {
        id: statement.id,
        currency: statement.currency,
        amountDue: statement.amountDue
      },
      paymentLinks
    ),
    groupTotals: computeStatementGroupTotals(statements, paymentLinks)
  };
}

type StatementPaymentStatementInput = Parameters<typeof computeStatementGroupTotals>[0][number];

function statementPaymentBalanceInputs(dataset: DistributionReadDataset): readonly StatementPaymentLinkInput[] {
  const paymentsById = new Map<string, DistributionReadDataset["payments"][number]>(
    dataset.payments.map((payment): readonly [string, DistributionReadDataset["payments"][number]] => [payment.id, payment])
  );
  return dataset.statementPaymentLinks.map((link): StatementPaymentLinkInput => {
    const payment = paymentsById.get(link.paymentId);
    if (payment === undefined) {
      throw new ApiRouteError(500, "distribution_payment_missing", "Statement payment link references a missing payment.", [
        `paymentId=${link.paymentId}`,
        `statementId=${link.statementId}`
      ]);
    }

    return {
      statementId: link.statementId,
      amountApplied: payment.status === "void" ? "0.0000000000" : link.amountApplied,
      currency: payment.currency
    };
  });
}

function paymentMutationResponse(
  paymentId: string,
  statementId: string,
  amount: string,
  currency: string,
  paymentStatus: "recorded" | "edited" | "reconciled" | "voided",
  balances: PaymentBalanceProjection,
  auditEventId: string
): PaymentMutationResponse {
  return {
    id: paymentId,
    status: "completed",
    auditEventId,
    paymentId,
    statementId,
    amountMicro: amount,
    currency,
    paymentStatus,
    statementBalance: balances.statementBalance,
    groupTotals: balances.groupTotals
  };
}

function persistedRoyaltyRulesFromRequest(
  contractId: string,
  rules: readonly ContractRoyaltyRuleRequest[]
): readonly PersistedDistributionRoyaltyRule[] {
  return rules.map((rule, index): PersistedDistributionRoyaltyRule => ({
    id: randomUUID(),
    contractId,
    payeeId: rule.payeeId,
    percentage: normalizeScaleDecimal(rule.percentage, 6),
    scopeType: rule.scopeType,
    scopeId: rule.scopeId,
    priority: rules.length - index,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    status: "active"
  }));
}

function assertRoyaltySplitTotalsOneHundred(
  context: ApiContext,
  rules: readonly PersistedDistributionRoyaltyRule[]
): string {
  const totalUnits = rules.reduce((sum: bigint, rule: PersistedDistributionRoyaltyRule): bigint => sum + parseScaledUnits(rule.percentage, 6, "TRUNCATE"), 0n);
  const expectedUnits = 100_000000n;
  if (totalUnits !== expectedUnits) {
    throw new ApiRouteError(422, "royalty_split_total_invalid", "Royalty split must equal exactly 100.000000.", [
      `path=${context.req.path}`,
      `expected=100.000000`,
      `actual=${formatScaledUnits(totalUnits, 6)}`
    ]);
  }

  return formatScaledUnits(totalUnits, 6);
}

function apiRoyaltyRulesFromPersistedRules(
  rules: readonly PersistedDistributionRoyaltyRule[]
): readonly ApiDistributionRoyaltyRuleInput[] {
  return rules.map((rule): ApiDistributionRoyaltyRuleInput => ({
    contractId: rule.contractId,
    royaltyRuleId: rule.id,
    payeeId: rule.payeeId,
    artistId: rule.scopeType === "artist" && rule.scopeId !== null ? rule.scopeId : rule.payeeId,
    role: rule.scopeType ?? "artist",
    percentage: rule.percentage,
    scopeType: rule.scopeType,
    scopeId: rule.scopeId,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    status: rule.status
  }));
}

function applyDistributionRoyaltyRulesFixture(
  fixtures: ApiFixtureStore,
  contractId: string,
  rules: readonly ApiDistributionRoyaltyRuleInput[]
): void {
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  mutableFixtures.distributionRoyaltyRules = [
    ...fixtures.distributionRoyaltyRules.filter((rule) => rule.contractId !== contractId),
    ...rules
  ];
}

function fxRatesFromRequest(rates: readonly FxRateSaveRequest[]): readonly DistributionFxRateInput[] {
  return rates.map((rate): DistributionFxRateInput => ({
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    effectiveDate: rate.effectiveDate,
    rate: normalizeScaleDecimal(rate.rate, 10)
  }));
}

function normalizeScaleDecimal(value: string, scale: number): string {
  return formatScaledUnits(parseScaledUnits(value, scale, "TRUNCATE"), scale);
}

function distributionFxRateMatches(
  existingRates: readonly DistributionFxRateInput[],
  newRates: readonly DistributionFxRateInput[]
): readonly DistributionFxRateInput[] {
  return existingRates.filter((existing) =>
    newRates.some((rate) =>
      existing.fromCurrency === rate.fromCurrency &&
      existing.toCurrency === rate.toCurrency &&
      existing.effectiveDate === rate.effectiveDate
    )
  );
}

function applyDistributionFxRatesFixture(fixtures: ApiFixtureStore, rates: readonly DistributionFxRateInput[]): void {
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  mutableFixtures.distributionFxRates = rates.reduce(
    (current: readonly DistributionFxRateInput[], rate: DistributionFxRateInput): readonly DistributionFxRateInput[] => upsertDistributionFxRate(current, rate),
    fixtures.distributionFxRates
  );
}

function upsertDistributionFxRate(
  rates: readonly DistributionFxRateInput[],
  rate: DistributionFxRateInput
): readonly DistributionFxRateInput[] {
  const existing = rates.some((candidate) =>
    candidate.fromCurrency === rate.fromCurrency &&
    candidate.toCurrency === rate.toCurrency &&
    candidate.effectiveDate === rate.effectiveDate
  );
  if (!existing) {
    return [...rates, rate];
  }

  return rates.map((candidate) =>
    candidate.fromCurrency === rate.fromCurrency &&
    candidate.toCurrency === rate.toCurrency &&
    candidate.effectiveDate === rate.effectiveDate
      ? rate
      : candidate
  );
}

function fxRatesAuditTargetId(rates: readonly DistributionFxRateInput[]): string {
  return rates.map((rate) => `${rate.fromCurrency}-${rate.toCurrency}-${rate.effectiveDate}`).sort().join(",");
}

function identityOfficeLink(
  partner: OfficePartnerRow,
  payee: DistributionReadDataset["payees"][number],
  confidence: string
): OfficePartnerPayeeLink {
  return {
    partnerId: partner.id,
    partnerName: partner.name,
    payeeId: payee.id,
    payeeName: payee.name,
    resolution: "stored_link",
    status: payee.isActive ? "active" : "inactive",
    source: "identity_link",
    confidence
  };
}

function applyIdentityLinkFixture(fixtures: ApiFixtureStore, link: OfficePartnerPayeeLink): void {
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  const retained = Object.fromEntries(
    Object.entries(fixtures.officePartnerPayeeLinks).filter(([partnerId, candidate]) =>
      partnerId !== link.partnerId && candidate.payeeId !== link.payeeId
    )
  ) as Readonly<Record<string, OfficePartnerPayeeLink>>;
  mutableFixtures.officePartnerPayeeLinks = {
    ...retained,
    [link.partnerId]: link
  };
}

function toDistributionPayeePartnerLink(
  fixtures: ApiFixtureStore,
  payee: DistributionReadDataset["payees"][number]
): DistributionPayeePartnerLinkResponse {
  const link = Object.values(fixtures.officePartnerPayeeLinks).find((candidate) => candidate.payeeId === payee.id && candidate.status === "active");
  return {
    payeeId: payee.id,
    payeeName: payee.name,
    officePartnerId: link?.partnerId ?? null,
    officePartnerName: link?.partnerName ?? null,
    linked: link !== undefined,
    confidence: link?.confidence ?? null,
    status: link?.status ?? null
  };
}

function identityLinkTargetId(officePartnerId: string, payeeId: string): string {
  return `${officePartnerId}:${payeeId}`;
}

function requireDistributionContract(
  dependencies: ApiServiceDependencies,
  contractId: string
): DistributionContract {
  const contract = dependencies.fixtures.distributionContracts.find((candidate) => candidate.id === contractId);
  if (contract === undefined) {
    throw new ApiRouteError(404, "distribution_contract_not_found", "Distribution contract was not found.", [`contractId=${contractId}`]);
  }

  return contract;
}

function requireDistributionStatement(
  dataset: DistributionReadDataset,
  statementId: string
): DistributionReadDataset["statements"][number] {
  const statement = dataset.statements.find((candidate) => candidate.id === statementId);
  if (statement === undefined) {
    throw new ApiRouteError(404, "distribution_statement_not_found", "Distribution statement was not found.", [`statementId=${statementId}`]);
  }

  return statement;
}

function requireDistributionPayment(
  dataset: DistributionReadDataset,
  paymentId: string
): DistributionReadDataset["payments"][number] {
  const payment = dataset.payments.find((candidate) => candidate.id === paymentId);
  if (payment === undefined) {
    throw new ApiRouteError(404, "distribution_payment_not_found", "Distribution payment was not found.", [`paymentId=${paymentId}`]);
  }

  return payment;
}

function requireDistributionPaymentLink(
  dataset: DistributionReadDataset,
  paymentId: string
): DistributionReadDataset["statementPaymentLinks"][number] {
  const link = dataset.statementPaymentLinks.find((candidate) => candidate.paymentId === paymentId);
  if (link === undefined) {
    throw new ApiRouteError(404, "distribution_payment_link_not_found", "Distribution payment is not linked to a statement.", [`paymentId=${paymentId}`]);
  }

  return link;
}

function assertPaymentMatchesStatement(
  context: ApiContext,
  payeeId: string,
  currency: string,
  statement: DistributionReadDataset["statements"][number]
): void {
  if (statement.payeeId !== payeeId) {
    throw new ApiRouteError(409, "distribution_payment_payee_mismatch", "Payment payee does not match the statement payee.", [
      `path=${context.req.path}`,
      `paymentPayeeId=${payeeId}`,
      `statementPayeeId=${statement.payeeId}`,
      `statementId=${statement.id}`
    ]);
  }

  if (statement.currency !== currency) {
    throw new ApiRouteError(409, "distribution_payment_currency_mismatch", "Payment currency does not match the statement currency.", [
      `path=${context.req.path}`,
      `paymentCurrency=${currency}`,
      `statementCurrency=${statement.currency}`,
      `statementId=${statement.id}`
    ]);
  }
}

function assertPaymentIsMutable(context: ApiContext, payment: DistributionReadDataset["payments"][number]): void {
  if (payment.status === "void") {
    throw new ApiRouteError(409, "distribution_payment_void", "Void payments cannot be updated or reconciled.", [
      `path=${context.req.path}`,
      `paymentId=${payment.id}`
    ]);
  }
}

function requireStatementForVoid(
  dependencies: ApiServiceDependencies,
  statementId: string
): DistributionReadDataset["statements"][number] {
  const statement = dependencies.fixtures.distribution.statements.find((candidate) => candidate.id === statementId);
  if (statement === undefined) {
    throw new ApiRouteError(404, "distribution_statement_not_found", "Distribution statement was not found.", [`statementId=${statementId}`]);
  }

  if (statement.status === "void") {
    throw new ApiRouteError(409, "distribution_statement_already_void", "Distribution statement is already void.", [`statementId=${statementId}`]);
  }

  return statement;
}

function requireStatementLedgerRow(dependencies: ApiServiceDependencies, statementId: string): PayeeBalanceLedgerInput {
  const ledgerRow = [...dependencies.fixtures.distributionPayeeBalances]
    .filter((row) => row.statementId === statementId && row.movementType === "statement")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  if (ledgerRow === undefined) {
    throw new ApiRouteError(404, "distribution_statement_ledger_not_found", "Distribution statement ledger row was not found.", [`statementId=${statementId}`]);
  }

  return ledgerRow;
}

function appendDistributionAllocationStateFixture(fixtures: ApiFixtureStore, input: PersistDistributionAllocationRunInput): void {
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  mutableFixtures.distributionExpenseApplications = [
    ...fixtures.distributionExpenseApplications,
    ...input.expenseApplications.map((application) => ({
      costTermId: application.costTermId,
      amountApplied: application.amountApplied,
      currency: application.currency,
      calculationRunId: application.calculationRunId
    }))
  ];
  mutableFixtures.distributionCostTerms = fixtures.distributionCostTerms.map((term) => {
    const update = input.costTermStatusUpdates.find((candidate) => candidate.id === term.id);
    return update === undefined ? term : { ...term, status: update.status };
  });
}

function markDistributionImportFixtureVoid(fixtures: ApiFixtureStore, batchId: string): void {
  const mutableDistribution = fixtures.distribution as Mutable<DistributionReadDataset>;
  mutableDistribution.importBatches = fixtures.distribution.importBatches.map((batch) => batch.id === batchId ? { ...batch, status: "void" } : batch);
}

function appendOfficeBankImportFixture(fixtures: ApiFixtureStore, patch: OfficeBankFixturePatch): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  mutableOffice.bankImportBatches = [
    ...fixtures.office.bankImportBatches,
    {
      id: patch.batchId,
      workspaceId: patch.workspaceId,
      source: patch.source,
      fileName: patch.fileName,
      checksum: patch.checksum,
      accountId: patch.accountId,
      periodStart: patch.periodStart,
      periodEnd: patch.periodEnd,
      openingBalanceMinor: null,
      closingBalanceMinor: null,
      currency: patch.currency,
      acceptedRowCount: patch.acceptedRowCount,
      rejectedRowCount: patch.rejectedRowCount,
      duplicateRowCount: patch.duplicateRowCount,
      idempotencyFingerprint: patch.idempotencyFingerprint,
      status: patch.status,
      importedAt: patch.importedAt,
      metadata: patch.metadata
    }
  ];
  mutableOffice.bankStatementLines = [
    ...fixtures.office.bankStatementLines,
    ...patch.lines.map((line: OfficeBankStatementLineInsert): OfficeBankStatementLineRow => ({
      id: line.id,
      importBatchId: patch.batchId,
      accountId: line.accountId,
      occurredOn: line.occurredOn,
      valueOn: line.valueOn,
      description: line.description,
      reference: line.reference,
      direction: line.direction,
      amountMinor: line.amountMinor,
      balanceMinor: line.balanceMinor,
      currency: line.currency,
      amountMurMinor: line.amountMurMinor,
      balanceMurMinor: line.balanceMurMinor,
      isDuplicateCandidate: line.isDuplicateCandidate,
      reconciliationStatus: "unmatched",
      matchedTransactionId: null,
      rawData: line.rawData
    }))
  ];
}

function applyOfficeReconciliationSuggestionsFixture(
  fixtures: ApiFixtureStore,
  suggestions: readonly OfficeReconciliationSuggestion[]
): void {
  if (suggestions.length === 0) {
    return;
  }

  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  const suggestionsByLineId = new Map<string, OfficeReconciliationSuggestion>(
    suggestions.map((suggestion) => [suggestion.statementLineId, suggestion])
  );

  mutableOffice.bankStatementLines = fixtures.office.bankStatementLines.map((line) => {
    const suggestion = suggestionsByLineId.get(line.id);
    if (suggestion === undefined || line.reconciliationStatus !== "unmatched") {
      return line;
    }

    return {
      ...line,
      reconciliationStatus: "suggested",
      matchedTransactionId: null
    };
  });

  const suggestionKeys = new Set(suggestions.map((suggestion) => `${suggestion.statementLineId}:${suggestion.transactionId}`));
  mutableOffice.bankReconciliationMatches = [
    ...fixtures.office.bankReconciliationMatches.filter(
      (match) => !suggestionKeys.has(`${match.bankStatementLineId}:${match.transactionId}`)
    ),
    ...suggestions.map((suggestion) => ({
      id: randomUUID(),
      bankStatementLineId: suggestion.statementLineId,
      transactionId: suggestion.transactionId,
      confidenceBp: suggestion.confidenceBp,
      status: "suggested" as const,
      approvedByUserId: null,
      approvedAt: null
    }))
  ];
}

function markOfficeBankImportFixtureVoid(fixtures: ApiFixtureStore, batchId: string): void {
  const mutableOffice = fixtures.office as Mutable<OfficeAnalyticsDataset>;
  mutableOffice.bankImportBatches = fixtures.office.bankImportBatches.map((batch) => batch.id === batchId ? { ...batch, status: "void" } : batch);
}

function appendOfficeAuditFixture(fixtures: ApiFixtureStore, patch: OfficeAuditFixturePatch): void {
  const mutableFixtures = fixtures as Mutable<ApiFixtureStore>;
  mutableFixtures.officeAuditLog = [
    {
      id: patch.id,
      occurredAt: patch.occurredAt,
      actorId: patch.actorId,
      action: patch.action,
      entityType: patch.entityType,
      entityId: patch.entityId,
      entityReference: auditEntityReference(fixtures, patch.entityType, patch.entityId),
      idempotencyKey: null,
      context: {}
    },
    ...fixtures.officeAuditLog
  ];
}

function auditEntityReference(fixtures: ApiFixtureStore, entityType: string, entityId: string): string {
  if (entityType === "office_bank_import_batch") {
    return fixtures.office.bankImportBatches.find((batch) => batch.id === entityId)?.fileName ?? entityId;
  }

  if (entityType === "office_transaction") {
    return fixtures.office.transactions.find((transaction) => transaction.id === entityId)?.description ?? entityId;
  }

  if (entityType === "office_partner") {
    return fixtures.office.partners.find((partner) => partner.id === entityId)?.name ?? entityId;
  }

  if (entityType === "distribution_statement") {
    const statement = fixtures.distribution.statements.find((candidate) => candidate.id === entityId);
    if (statement !== undefined) {
      const payee = fixtures.distribution.payees.find((candidate) => candidate.id === statement.payeeId);
      return `${payee?.name ?? statement.payeeId} · ${statement.periodStart} → ${statement.periodEnd}`;
    }
  }

  if (entityType === "distribution_payment") {
    return fixtures.distribution.payments.find((payment) => payment.id === entityId)?.reference ?? entityId;
  }

  return entityId;
}

async function readOptionalJsonBody(context: ApiContext): Promise<JsonRecord> {
  const text = await readRequestText(context);
  if (text.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as JsonRecord;
    }
  } catch (error: unknown) {
    throw new ApiRouteError(400, "json_body_invalid", "Request body must be valid JSON.", [
      `path=${context.req.path}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }

  throw new ApiRouteError(400, "json_body_invalid", "Request body must be a JSON object.", [`path=${context.req.path}`]);
}

async function readRequestText(context: ApiContext): Promise<string> {
  try {
    return await context.req.text();
  } catch (error: unknown) {
    throw new ApiRouteError(400, "body_read_failed", "Request body could not be read.", [
      `path=${context.req.path}`,
      `error=${error instanceof Error ? error.message : "unknown"}`
    ]);
  }
}

function pageItems<TItem>(context: ApiContext, items: readonly TItem[]): PageResult<TItem> {
  const page = pageWindow(context);
  const pageItems = items.slice(page.offset, page.offset + page.limit);
  const nextOffset = page.offset + pageItems.length;
  const nextCursor = nextOffset < items.length ? String(nextOffset) : null;
  return {
    items: pageItems,
    nextCursor
  };
}

function pageWindow(context: ApiContext): PageWindow {
  const cursorText = optionalCompatQuery(context, ["cursor", "offset", "page"]);
  const limitText = optionalCompatQuery(context, ["limit", "size", "pageSize"]);
  const parsedOffset = cursorText === null ? 0 : parsePositiveInteger(cursorText, "cursor");
  const parsedLimit = limitText === null ? 50 : parsePositiveInteger(limitText, "limit");
  const limit = parsedLimit > 100 ? 100 : parsedLimit;
  return {
    cursor: cursorText,
    offset: parsedOffset,
    limit
  };
}

function parsePositiveInteger(value: string, label: string): number {
  if (!/^[0-9]+$/.test(value)) {
    throw new ApiRouteError(400, "query_integer_invalid", "Pagination query parameters must be non-negative integers.", [
      `${label}=${value}`
    ]);
  }

  const parsed = parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new ApiRouteError(400, "query_integer_invalid", "Pagination query parameter is outside the safe integer range.", [
      `${label}=${value}`
    ]);
  }

  return parsed;
}

function toApiDivisionPnl(row: OfficePnlDivisionRow): { readonly id: string; readonly label: string; readonly incomeMicro: string; readonly expenseMicro: string; readonly netMicro: string } {
  return {
    id: row.division_id,
    label: `${row.department_name} · ${row.division_name}`,
    incomeMicro: row.income,
    expenseMicro: row.expense,
    netMicro: row.profit
  };
}

function toOfficeVatReport(
  dataset: OfficeAnalyticsDataset,
  period: string
): {
  readonly period: string;
  readonly hasVatSource: boolean;
  readonly outputVatMicro: string;
  readonly inputVatMicro: string;
  readonly netVatMicro: string;
  readonly rows: readonly {
    readonly id: string;
    readonly label: string;
    readonly baseMicro: string;
    readonly rateBp: number;
    readonly vatMicro: string;
  }[];
} {
  const scopedTransactions = dataset.transactions.filter(
    (transaction: OfficeTransactionRow): boolean =>
      transaction.transactionDate.slice(0, 7) === period && transaction.status === "validated" && transaction.isActive
  );

  let outputVatMinor = 0n;
  let inputVatMinor = 0n;
  let hasVatSource = false;
  const rows: {
    readonly id: string;
    readonly label: string;
    readonly baseMicro: string;
    readonly rateBp: number;
    readonly vatMicro: string;
  }[] = [];

  for (const transaction of scopedTransactions) {
    const vatMeta = readOfficeTransactionVatMeta(transaction);
    if (!vatMeta.hasSource) {
      continue;
    }

    hasVatSource = true;
    if (!vatMeta.isApplicable) {
      continue;
    }

    const grossMinor = absBigInt(transaction.amountMinor);
    const rateBp = vatMeta.rateBp;
    const breakdown =
      rateBp > 0
        ? calculateVat(
            createMoneyAmount(createMoneyMicroUnits(grossMinor), createCurrencyCode("MUR")),
            createBasisPoints(rateBp)
          )
        : null;
    const vatMinor = vatMeta.vatAmountMinor ?? breakdown?.vatAmount.amountMicro ?? 0n;
    const baseMinor = breakdown?.netAmount.amountMicro ?? (grossMinor > vatMinor ? grossMinor - vatMinor : 0n);

    if (transaction.type === "income") {
      outputVatMinor += vatMinor;
    } else {
      inputVatMinor += vatMinor;
    }

    rows.push({
      id: transaction.id,
      label: transaction.description?.trim() || `Transaction ${transaction.id}`,
      baseMicro: eofMoney.format(baseMinor),
      rateBp,
      vatMicro: eofMoney.format(vatMinor)
    });
  }

  return {
    period,
    hasVatSource,
    outputVatMicro: eofMoney.format(outputVatMinor),
    inputVatMicro: eofMoney.format(inputVatMinor),
    netVatMicro: eofMoney.format(outputVatMinor - inputVatMinor),
    rows
  };
}

function readOfficeTransactionVatMeta(transaction: OfficeTransactionRow): {
  readonly hasSource: boolean;
  readonly isApplicable: boolean;
  readonly rateBp: number;
  readonly vatAmountMinor: bigint | null;
} {
  const value = transaction as OfficeTransactionRow & {
    readonly vatApplicable?: boolean;
    readonly vatRateBp?: number | null;
    readonly vatAmountMinor?: bigint | null;
  };

  const hasVatApplicable = typeof value.vatApplicable === "boolean";
  const hasVatRate = typeof value.vatRateBp === "number" || value.vatRateBp === null;
  const hasVatAmount = typeof value.vatAmountMinor === "bigint" || value.vatAmountMinor === null;
  const hasSource = hasVatApplicable || hasVatRate || hasVatAmount;

  const normalizedRate =
    typeof value.vatRateBp === "number" && Number.isInteger(value.vatRateBp) && value.vatRateBp >= 0 && value.vatRateBp <= 10000
      ? value.vatRateBp
      : 0;
  const normalizedVatAmount = typeof value.vatAmountMinor === "bigint" ? absBigInt(value.vatAmountMinor) : null;
  const isApplicable =
    value.vatApplicable === true || (typeof value.vatAmountMinor === "bigint" && absBigInt(value.vatAmountMinor) > 0n) || normalizedRate > 0;

  return {
    hasSource,
    isApplicable,
    rateBp: normalizedRate,
    vatAmountMinor: normalizedVatAmount
  };
}

function toApiBankAccountSummary(account: OfficeBankAccountRow): {
  readonly id: string;
  readonly workspaceId: string;
  readonly bankName: string;
  readonly accountLabel: string;
  readonly currency: string;
  readonly currentBalanceMicro: string;
  readonly currentBalanceMurMicro: string | null;
  readonly isActive: boolean;
  readonly balanceAsOf: string | null;
} {
  return {
    id: account.id,
    workspaceId: account.workspaceId,
    bankName: account.bankName,
    accountLabel: account.accountLabel,
    currency: account.currency,
    currentBalanceMicro: eofMoney.format(account.currentBalanceMinor),
    currentBalanceMurMicro: account.currentBalanceMurMinor === null ? null : eofMoney.format(account.currentBalanceMurMinor),
    isActive: account.isActive,
    balanceAsOf: account.balanceAsOf
  };
}

function latestBankLineByAccount(
  lines: readonly OfficeBankStatementLineRow[]
): ReadonlyMap<string, OfficeBankStatementLineRow> {
  const latest = new Map<string, OfficeBankStatementLineRow>();
  for (const line of lines) {
    if (line.balanceMinor === null && line.balanceMurMinor === null) {
      continue;
    }
    const current = latest.get(line.accountId);
    if (current === undefined || line.occurredOn > current.occurredOn || (line.occurredOn === current.occurredOn && line.id > current.id)) {
      latest.set(line.accountId, line);
    }
  }
  return latest;
}

interface DerivedBankSnapshot {
  readonly currentBalanceMinor: bigint;
  readonly currentBalanceMurMinor: bigint | null;
  readonly balanceAsOf: string;
}

function derivedBankSnapshotByAccount(
  lines: readonly OfficeBankStatementLineRow[]
): ReadonlyMap<string, DerivedBankSnapshot> {
  const aggregations = new Map<string, {
    currentBalanceMinor: bigint;
    currentBalanceMurMinor: bigint;
    hasMurBalance: boolean;
    balanceAsOf: string;
    latestLineId: string;
  }>();

  for (const line of lines) {
    const existing = aggregations.get(line.accountId);
    const sign = line.direction === "credit" ? 1n : -1n;
    const next = existing ?? {
      currentBalanceMinor: 0n,
      currentBalanceMurMinor: 0n,
      hasMurBalance: false,
      balanceAsOf: line.occurredOn,
      latestLineId: line.id
    };

    next.currentBalanceMinor += sign * line.amountMinor;
    if (line.amountMurMinor !== null) {
      next.currentBalanceMurMinor += sign * line.amountMurMinor;
      next.hasMurBalance = true;
    }
    if (line.occurredOn > next.balanceAsOf || (line.occurredOn === next.balanceAsOf && line.id > next.latestLineId)) {
      next.balanceAsOf = line.occurredOn;
      next.latestLineId = line.id;
    }
    aggregations.set(line.accountId, next);
  }

  const result = new Map<string, DerivedBankSnapshot>();
  for (const [accountId, value] of aggregations.entries()) {
    result.set(accountId, {
      currentBalanceMinor: value.currentBalanceMinor,
      currentBalanceMurMinor: value.hasMurBalance ? value.currentBalanceMurMinor : null,
      balanceAsOf: value.balanceAsOf
    });
  }
  return result;
}

function resolveBankAccountSnapshot(
  account: OfficeBankAccountRow,
  latestLine: OfficeBankStatementLineRow | undefined,
  derivedSnapshot: DerivedBankSnapshot | undefined
): OfficeBankAccountRow {
  // Some imported production accounts have never had current_balance*/balance_as_of
  // backfilled in office_bank_accounts even though statement lines exist. For those,
  // surface the latest line balance so the Bank table reflects connected data.
  if (account.balanceAsOf !== null || latestLine === undefined) {
    if (account.balanceAsOf !== null || derivedSnapshot === undefined) {
      return account;
    }

    return {
      ...account,
      currentBalanceMinor: derivedSnapshot.currentBalanceMinor,
      currentBalanceMurMinor: derivedSnapshot.currentBalanceMurMinor,
      balanceAsOf: derivedSnapshot.balanceAsOf
    };
  }

  if (latestLine.balanceMinor === null && latestLine.balanceMurMinor === null) {
    if (derivedSnapshot === undefined) {
      return account;
    }
    return {
      ...account,
      currentBalanceMinor: derivedSnapshot.currentBalanceMinor,
      currentBalanceMurMinor: derivedSnapshot.currentBalanceMurMinor,
      balanceAsOf: derivedSnapshot.balanceAsOf
    };
  }

  return {
    ...account,
    currentBalanceMinor: latestLine.balanceMinor ?? account.currentBalanceMinor,
    currentBalanceMurMinor: latestLine.balanceMurMinor ?? account.currentBalanceMurMinor,
    balanceAsOf: latestLine.occurredOn
  };
}

function toApiBankRawLine(
  line: OfficeBankStatementLineRow,
  batchWorkspaceLookup: ReadonlyMap<string, string>
): {
  readonly id: string;
  readonly workspaceId: string;
  readonly importBatchId: string;
  readonly accountId: string;
  readonly occurredOn: string;
  readonly transactionDate: string;
  readonly description: string;
  readonly direction: OfficeBankStatementLineRow["direction"];
  readonly reference: string;
  readonly amountMicro: string;
  readonly amountMurMicro: string;
  readonly currency: string;
  readonly isDuplicateCandidate: boolean;
  readonly status: OfficeBankStatementLineRow["reconciliationStatus"];
  readonly reconciliationStatus: OfficeBankStatementLineRow["reconciliationStatus"];
  readonly matchedTransactionId: string | null;
} {
  return {
    id: line.id,
    workspaceId: batchWorkspaceLookup.get(line.importBatchId) ?? "unknown-workspace",
    importBatchId: line.importBatchId,
    accountId: line.accountId,
    occurredOn: line.occurredOn,
    transactionDate: line.occurredOn,
    description: line.description,
    direction: line.direction,
    reference: line.reference ?? "",
    amountMicro: eofMoney.format(line.amountMinor),
    amountMurMicro: eofMoney.format(line.amountMurMinor),
    currency: line.currency,
    isDuplicateCandidate: line.isDuplicateCandidate,
    status: line.reconciliationStatus,
    reconciliationStatus: line.reconciliationStatus,
    matchedTransactionId: line.matchedTransactionId
  };
}

function toAllocationStatusFilter(status: string | null): DistributionEarningAllocationRow["status"] | null {
  if (status === null) {
    return null;
  }

  if (
    status === "preview" ||
    status === "calculated" ||
    status === "statemented" ||
    status === "posted" ||
    status === "void" ||
    status === "error"
  ) {
    return status;
  }

  throw new ApiRouteError(400, "query_value_invalid", "Allocation status is invalid.", [
    `status=${status}`
  ]);
}

function filtersForPeriod(period: string, departmentId: string | null): OfficePnlFilters {
  return {
    dateFrom: `${period}-01`,
    dateTo: `${period}-31`,
    departmentId
  };
}

function isIsoDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

// True when an ISO date/timestamp falls within the filters' inclusive range.
function dateInFilters(dateLike: string, filters: OfficePnlFilters): boolean {
  const day = dateLike.slice(0, 10);
  if (filters.dateFrom !== null && day < filters.dateFrom) {
    return false;
  }
  return !(filters.dateTo !== null && day > filters.dateTo);
}

// Resolve the P&L date filters from the request: an explicit dateFrom/dateTo range
// (sent by the Period control) takes precedence; otherwise fall back to the month.
function rangeFiltersFromContext(context: ApiContext, period: string, departmentId: string | null): OfficePnlFilters {
  const dateFrom = optionalCompatQuery(context, ["dateFrom", "date_from"]);
  const dateTo = optionalCompatQuery(context, ["dateTo", "date_to"]);
  if (isIsoDate(dateFrom) && isIsoDate(dateTo)) {
    return { dateFrom, dateTo, departmentId };
  }
  return filtersForPeriod(period, departmentId);
}

// Window immediately preceding [dateFrom, dateTo]: calendar-aligned years and
// months map to the previous year/month (matching the "-31" open-month
// convention of filtersForPeriod), anything else shifts back by its own length
// in days. Null when either bound is missing.
function previousRangeFilters(filters: OfficePnlFilters): OfficePnlFilters | null {
  const { dateFrom, dateTo, departmentId } = filters;
  if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    return null;
  }

  // Wide custom windows (for example the "All" period spanning many years)
  // produce misleading "previous" comparisons. Keep dashboard comparison only
  // for short/regular windows where the adjacent range is meaningful.
  const fromMs = Date.parse(`${dateFrom}T00:00:00Z`);
  const toMs = Date.parse(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs < fromMs) {
    return null;
  }
  const dayMs = 86_400_000;
  const lengthDays = Math.round((toMs - fromMs) / dayMs) + 1;
  if (lengthDays > 370) {
    return null;
  }

  const yearMatch = /^(\d{4})-01-01$/u.exec(dateFrom);
  if (yearMatch !== null && dateTo === `${yearMatch[1]}-12-31`) {
    const previousYear = String(Number(yearMatch[1]) - 1).padStart(4, "0");
    return { dateFrom: `${previousYear}-01-01`, dateTo: `${previousYear}-12-31`, departmentId };
  }

  const month = dateFrom.slice(0, 7);
  if (dateFrom === `${month}-01` && (dateTo === `${month}-31` || dateTo === lastDayOfMonth(month))) {
    return filtersForPeriod(previousMonth(month), departmentId);
  }

  return {
    dateFrom: isoDayFromMs(fromMs - lengthDays * dayMs),
    dateTo: isoDayFromMs(fromMs - dayMs),
    departmentId
  };
}

function readOfficeDashboardPrevious(
  dependencies: ApiServiceDependencies,
  filters: OfficePnlFilters
): OfficeDashboardPreviousPeriod | null {
  const previousFilters = previousRangeFilters(filters);
  if (previousFilters === null || !isIsoDate(previousFilters.dateFrom) || !isIsoDate(previousFilters.dateTo)) {
    return null;
  }

  const previousPeriod = previousFilters.dateTo.slice(0, 7);
  const monthlyRows = readMonthlyPnl(dependencies.fixtures.office, previousFilters);
  const runwayWindowMonths = filterRunwayWindowMonths(monthlyRows, ["2026-02"]);
  const dashboard = readOfficeDashboardFull(dependencies.fixtures.office, previousPeriod, previousFilters, runwayWindowMonths);
  return {
    dateFrom: previousFilters.dateFrom,
    dateTo: previousFilters.dateTo,
    cashBalanceMicro: dashboard.cashRunway.cashBalanceMur,
    receivablesMicro: dashboard.pnl.income,
    payablesMicro: dashboard.pnl.expense,
    unreconciledTransactionCount: dashboard.bankQuality.unmatchedLineCount
  };
}

function readOfficeDashboardAnalytics(
  dependencies: ApiServiceDependencies,
  workspaceId: string,
  period: string,
  filters: OfficePnlFilters
): OfficeDashboardAnalyticsResponse {
  const dataset = dependencies.fixtures.office;
  const monthlyRows = readMonthlyPnl(dataset, filters);
  const runwayWindowMonths = selectRunwayWindowMonths(monthlyRows);
  const runway = readDashboardRunwayV1(dataset, period, monthlyRows, runwayWindowMonths);
  const topExpenseCategories = topExpenseCategoriesKpis(dataset, filters);
  const projectProfitability = projectProfitabilityKpis(dataset, filters);
  const reconciliationByAccount = reconciliationByAccountKpis(dataset, workspaceId, filters, dependencies.nowIso());
  const expenseTrendMonths = rollingMonthsEndingAt((filters.dateTo ?? `${period}-31`).slice(0, 7), 6);
  const expenseTrendByDepartment = departmentExpenseTrendKpis(dataset, filters, expenseTrendMonths);

  return {
    period,
    dateFrom: filters.dateFrom ?? `${period}-01`,
    dateTo: filters.dateTo ?? `${period}-31`,
    generatedAt: dependencies.nowIso(),
    runway,
    topExpenseCategories,
    projectProfitability,
    reconciliationByAccount,
    oldestUnmatchedDays: oldestUnmatchedDayInAccounts(reconciliationByAccount),
    expenseTrendMonths,
    expenseTrendByDepartment
  };
}

function readDashboardRunwayV1(
  dataset: OfficeAnalyticsDataset,
  period: string,
  monthlyRows: readonly OfficePnlMonthlyRow[],
  runwayWindowMonths: readonly string[]
): OfficeDashboardAnalyticsResponse["runway"] {
  const selectedRows = runwayWindowMonths.map((month) => requireRunwayMonthlyRow(monthlyRows, month));
  const totalBurnUnits = selectedRows
    .map((row) => runwayMonthlyBurnUnits(row))
    .reduce((sum: bigint, value: bigint) => eofMoney.add(sum, value), 0n);
  const averageBurnUnits = selectedRows.length === 0 ? 0n : roundRatioHalfUp(totalBurnUnits, BigInt(selectedRows.length));

  let cashBalanceUnits = 0n;
  const excludedForeignAccounts: OfficeDashboardRunwayExcludedAccount[] = [];
  for (const account of dataset.bankAccounts) {
    if (!account.isActive) {
      continue;
    }

    if (account.currency === "MUR") {
      cashBalanceUnits = eofMoney.add(cashBalanceUnits, account.currentBalanceMinor);
      continue;
    }

    excludedForeignAccounts.push({
      accountId: account.id,
      bankName: account.bankName,
      accountLabel: account.accountLabel,
      currency: account.currency,
      balanceMicro: eofMoney.format(account.currentBalanceMinor)
    });
  }

  excludedForeignAccounts.sort((left, right) => {
    const bankOrder = left.bankName.localeCompare(right.bankName);
    if (bankOrder !== 0) {
      return bankOrder;
    }
    return left.accountLabel.localeCompare(right.accountLabel);
  });

  return {
    period,
    cashBalanceMicro: eofMoney.format(cashBalanceUnits),
    averageMonthlyBurnMicro: eofMoney.format(averageBurnUnits),
    runwayMonths: averageBurnUnits === 0n ? null : formatScaledUnits(roundRatioHalfUp(cashBalanceUnits * 100n, averageBurnUnits), 2),
    monthsUsed: selectedRows.map((row) => row.month),
    excludedForeignAccounts
  };
}

function requireRunwayMonthlyRow(rows: readonly OfficePnlMonthlyRow[], month: string): OfficePnlMonthlyRow {
  const row = rows.find((candidate) => candidate.month === month);
  if (row === undefined) {
    throw new Error(`Office monthly P&L row not found for runway month ${month}.`);
  }

  return row;
}

function runwayMonthlyBurnUnits(row: OfficePnlMonthlyRow): bigint {
  const incomeUnits = eofMoney.parse(row.income);
  const expenseUnits = eofMoney.parse(row.expense);
  const netBurnUnits = eofMoney.sub(expenseUnits, incomeUnits);
  return netBurnUnits > 0n ? netBurnUnits : 0n;
}

function selectRunwayWindowMonths(monthlyRows: readonly OfficePnlMonthlyRow[]): readonly string[] {
  const months = [...new Set<string>(monthlyRows.map((row) => row.month))].sort((left, right) => left.localeCompare(right));
  if (months.length <= 3) {
    return months;
  }

  return months.slice(months.length - 3);
}

function topExpenseCategoriesKpis(
  dataset: OfficeAnalyticsDataset,
  filters: OfficePnlFilters
): readonly OfficeDashboardExpenseCategoryKpi[] {
  const rows = readPnlByCategory(dataset, filters)
    .map((row) => ({
      categoryId: row.category_id,
      label: `${row.department_name} · ${row.division_name} · ${row.category_name}`,
      expenseUnits: eofMoney.parse(row.expense)
    }))
    .filter((row) => row.expenseUnits > 0n)
    .sort((left, right) => (right.expenseUnits === left.expenseUnits ? 0 : right.expenseUnits > left.expenseUnits ? 1 : -1));

  let totalExpenseUnits = 0n;
  for (const row of rows) {
    totalExpenseUnits = eofMoney.add(totalExpenseUnits, row.expenseUnits);
  }

  return rows.slice(0, 6).map((row): OfficeDashboardExpenseCategoryKpi => ({
    categoryId: row.categoryId,
    label: row.label,
    expenseMicro: eofMoney.format(row.expenseUnits),
    shareBp: totalExpenseUnits === 0n ? 0 : roundRatioBp(row.expenseUnits, totalExpenseUnits)
  }));
}

function projectProfitabilityKpis(
  dataset: OfficeAnalyticsDataset,
  filters: OfficePnlFilters
): readonly OfficeDashboardProjectProfitabilityKpi[] {
  return dataset.projects
    .map((project) => toProjectSummary(dataset, project, filters))
    .sort((left, right) => {
      const leftNet = eofMoney.parse(left.netMicro);
      const rightNet = eofMoney.parse(right.netMicro);
      if (rightNet === leftNet) {
        return 0;
      }
      return rightNet > leftNet ? 1 : -1;
    })
    .slice(0, 6)
    .map((project): OfficeDashboardProjectProfitabilityKpi => {
      const incomeUnits = eofMoney.parse(project.periodIncomeMicro);
      const netUnits = eofMoney.parse(project.netMicro);
      return {
        projectId: project.id,
        projectLabel: project.label,
        incomeMicro: project.periodIncomeMicro,
        expenseMicro: project.periodExpenseMicro,
        netMicro: project.netMicro,
        marginBp: incomeUnits === 0n ? null : roundSignedRatioBp(netUnits, incomeUnits)
      };
    });
}

function reconciliationByAccountKpis(
  dataset: OfficeAnalyticsDataset,
  workspaceId: string,
  filters: OfficePnlFilters,
  nowIsoText: string
): readonly OfficeDashboardReconciliationAccountKpi[] {
  const matchedLineIds = new Set<string>(
    dataset.bankReconciliationMatches.filter((match) => match.status === "matched").map((match) => match.bankStatementLineId)
  );
  const today = nowIsoText.slice(0, 10);

  return dataset.bankAccounts
    .filter((account) => account.workspaceId === workspaceId)
    .map((account): OfficeDashboardReconciliationAccountKpi => {
      const lines = dataset.bankStatementLines.filter((line) => line.accountId === account.id && dateInFilters(line.occurredOn, filters));
      const matchedCount = lines.filter((line) => line.reconciliationStatus === "matched" || matchedLineIds.has(line.id)).length;
      const unmatchedLines = lines.filter((line) => line.reconciliationStatus === "unmatched" && !matchedLineIds.has(line.id));
      const oldestUnmatched = unmatchedLines
        .map((line) => line.occurredOn.slice(0, 10))
        .sort((left, right) => left.localeCompare(right))[0] ?? null;

      return {
        accountId: account.id,
        accountLabel: account.accountLabel,
        bankName: account.bankName,
        currency: account.currency,
        lineCount: lines.length,
        unmatchedLineCount: unmatchedLines.length,
        matchedRateBp: lines.length === 0 ? 0 : roundRatioBp(BigInt(matchedCount), BigInt(lines.length)),
        oldestUnmatchedDays: oldestUnmatched === null ? null : daysSinceIsoDate(oldestUnmatched, today)
      };
    })
    .sort((left, right) => {
      if (right.unmatchedLineCount !== left.unmatchedLineCount) {
        return right.unmatchedLineCount - left.unmatchedLineCount;
      }
      const rightOldest = right.oldestUnmatchedDays ?? -1;
      const leftOldest = left.oldestUnmatchedDays ?? -1;
      return rightOldest - leftOldest;
    });
}

function oldestUnmatchedDayInAccounts(rows: readonly OfficeDashboardReconciliationAccountKpi[]): number | null {
  let oldest: number | null = null;
  for (const row of rows) {
    if (row.oldestUnmatchedDays === null) {
      continue;
    }
    if (oldest === null || row.oldestUnmatchedDays > oldest) {
      oldest = row.oldestUnmatchedDays;
    }
  }
  return oldest;
}

function rollingMonthsEndingAt(anchorMonth: string, count: number): readonly string[] {
  if (count <= 0) {
    return [];
  }

  const months: string[] = [anchorMonth];
  while (months.length < count) {
    months.unshift(previousMonth(months[0] ?? anchorMonth));
  }
  return months;
}

function departmentExpenseTrendKpis(
  dataset: OfficeAnalyticsDataset,
  filters: OfficePnlFilters,
  months: readonly string[]
): readonly OfficeDashboardDepartmentExpenseTrendKpi[] {
  if (months.length === 0) {
    return [];
  }

  const monthIndexes = new Map<string, number>(months.map((month, index) => [month, index]));
  const trends = new Map<string, { readonly departmentLabel: string; readonly series: bigint[] }>();

  for (const transaction of dataset.transactions) {
    if (
      !transaction.isActive ||
      transaction.status !== "validated" ||
      transaction.type !== "expense" ||
      transaction.categoryId === null ||
      !isOfficeFxValidForLedger(transaction) ||
      !isOfficeTransactionInRange(transaction, filters)
    ) {
      continue;
    }

    const month = transaction.transactionDate.slice(0, 7);
    const monthIndex = monthIndexes.get(month);
    if (monthIndex === undefined) {
      continue;
    }

    const path = resolveCategoryPath(dataset, transaction.categoryId);
    if (path.department === null) {
      continue;
    }

    const existing = trends.get(path.department.id);
    const series = existing?.series ?? months.map(() => 0n);
    series[monthIndex] = eofMoney.add(series[monthIndex] ?? 0n, absBigInt(transaction.amountMinor));
    trends.set(path.department.id, {
      departmentLabel: path.department.name,
      series
    });
  }

  return [...trends.entries()]
    .map(([departmentId, row]) => ({
      departmentId,
      departmentLabel: row.departmentLabel,
      monthlyExpenseMicro: row.series.map((value) => eofMoney.format(value)),
      latestMonthExpenseMicro: eofMoney.format(row.series[row.series.length - 1] ?? 0n),
      latestMonthUnits: row.series[row.series.length - 1] ?? 0n,
      totalUnits: row.series.reduce((sum, value) => eofMoney.add(sum, value), 0n)
    }))
    .sort((left, right) => {
      if (right.latestMonthUnits !== left.latestMonthUnits) {
        return right.latestMonthUnits > left.latestMonthUnits ? 1 : -1;
      }
      if (right.totalUnits !== left.totalUnits) {
        return right.totalUnits > left.totalUnits ? 1 : -1;
      }
      return left.departmentLabel.localeCompare(right.departmentLabel);
    })
    .slice(0, 4)
    .map((row): OfficeDashboardDepartmentExpenseTrendKpi => ({
      departmentId: row.departmentId,
      departmentLabel: row.departmentLabel,
      monthlyExpenseMicro: row.monthlyExpenseMicro,
      latestMonthExpenseMicro: row.latestMonthExpenseMicro
    }));
}

function daysSinceIsoDate(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
    return 0;
  }

  return Math.floor((to - from) / 86_400_000);
}

function roundRatioBp(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) {
    return 0;
  }

  return Number((numerator * 10_000n + denominator / 2n) / denominator);
}

function roundSignedRatioBp(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) {
    return 0;
  }

  const negative = (numerator < 0n) !== (denominator < 0n);
  const absoluteNumerator = absBigInt(numerator);
  const absoluteDenominator = absBigInt(denominator);
  const magnitude = Number((absoluteNumerator * 10_000n + absoluteDenominator / 2n) / absoluteDenominator);
  return negative ? -magnitude : magnitude;
}

function previousMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  const previousYear = monthIndex === 1 ? year - 1 : year;
  const previousIndex = monthIndex === 1 ? 12 : monthIndex - 1;
  return `${String(previousYear).padStart(4, "0")}-${String(previousIndex).padStart(2, "0")}`;
}

function lastDayOfMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

function isoDayFromMs(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function toOfficeGlobalPnl(dataset: OfficeAnalyticsDataset, period: string, filters: OfficePnlFilters): OfficeGlobalPnl {
  const fallbackPnl = readGlobalPnl(dataset, filters);
  const ledgerTransactions = toOfficeLedgerTransactions(dataset, filters);
  const ledgerSummary =
    ledgerTransactions.length === 0
      ? null
      : summarizeLedger(ledgerTransactions, {
          startsOn: filters.dateFrom ?? `${period}-01`,
          endsOn: filters.dateTo ?? lastDayOfMonth(period)
        });

  const incomeMicro = ledgerSummary === null ? fallbackPnl.income : eofMoney.format(ledgerSummary.income.amountMicro);
  const expenseMicro = ledgerSummary === null ? fallbackPnl.expense : eofMoney.format(ledgerSummary.expense.amountMicro);
  const netMicro = ledgerSummary === null ? fallbackPnl.profit : eofMoney.format(ledgerSummary.profit.amountMicro);

  const projectionRows = readProjectionRowsForGlobalPnl(dataset, filters);

  return {
    scope: "global",
    completeness: "complete",
    period,
    incomeMicro,
    expenseMicro,
    netMicro,
    validatedProjectionId: `projection_global_${period}`,
    projectionRows: toProjectionRows(projectionRows, period),
    lines: toOfficeCategoryPnlLines(dataset, filters)
  };
}

function readProjectionRowsForGlobalPnl(dataset: OfficeAnalyticsDataset, filters: OfficePnlFilters): readonly OfficePnlDepartmentRow[] {
  const allocatedRows = readPnlByDepartment(dataset, filters);
  if (allocatedRows.length > 0 || filters.departmentId !== null) {
    return allocatedRows;
  }

  const divisions = readPnlByDivision(dataset, filters);
  if (divisions.length === 0) {
    return allocatedRows;
  }

  const departmentsById = new Map<string, OfficeDepartmentRow>(dataset.departments.map((department) => [department.id, department]));
  const grouped = new Map<string, { readonly departmentName: string; readonly departmentType: OfficeDepartmentRow["type"]; incomeUnits: bigint; expenseUnits: bigint; txCount: number }>();

  for (const row of divisions) {
    const departmentType = departmentsById.get(row.department_id)?.type ?? "mixed";
    const current = grouped.get(row.department_id);
    if (current === undefined) {
      grouped.set(row.department_id, {
        departmentName: row.department_name,
        departmentType,
        incomeUnits: eofMoney.parse(row.income),
        expenseUnits: eofMoney.parse(row.expense),
        txCount: row.tx_count
      });
      continue;
    }

    current.incomeUnits = eofMoney.add(current.incomeUnits, eofMoney.parse(row.income));
    current.expenseUnits = eofMoney.add(current.expenseUnits, eofMoney.parse(row.expense));
    current.txCount += row.tx_count;
  }

  return [...grouped.entries()].map(([departmentId, row]) => ({
    department_id: departmentId,
    department_name: row.departmentName,
    department_type: row.departmentType,
    income: eofMoney.format(row.incomeUnits),
    expense: eofMoney.format(row.expenseUnits),
    profit: eofMoney.format(row.incomeUnits - row.expenseUnits),
    tx_count: row.txCount
  }));
}

function toOfficeLedgerTransactions(dataset: OfficeAnalyticsDataset, filters: OfficePnlFilters): readonly LedgerTransaction[] {
  const categoriesById = new Map<string, OfficeCategoryRow>(dataset.categories.map((category) => [category.id, category]));
  const divisionsById = new Map<string, OfficeDivisionRow>(dataset.divisions.map((division) => [division.id, division]));

  return dataset.transactions
    .filter(
      (transaction: OfficeTransactionRow): boolean =>
        transaction.status === "validated" &&
        transaction.isActive &&
        isOfficeFxValidForLedger(transaction) &&
        isOfficeTransactionInRange(transaction, filters)
    )
    .map((transaction: OfficeTransactionRow): LedgerTransaction => {
      const category = transaction.categoryId === null ? undefined : categoriesById.get(transaction.categoryId);
      const divisionId = category?.divisionId ?? null;
      const departmentId = divisionId === null ? null : divisionsById.get(divisionId)?.departmentId ?? null;

      return {
        id: transaction.id,
        transactionDate: transaction.transactionDate.slice(0, 10),
        direction: transaction.type,
        amount: createMoneyAmount(createMoneyMicroUnits(absBigInt(transaction.amountMinor)), createCurrencyCode("MUR")),
        categoryId: transaction.categoryId,
        departmentId,
        divisionId,
        sourceSystem: "office"
      };
    });
}

function isOfficeFxValidForLedger(transaction: OfficeTransactionRow): boolean {
  if (transaction.originalCurrency === null || transaction.originalCurrency === "" || transaction.originalCurrency === "MUR") {
    return true;
  }

  return transaction.exchangeRateE10 !== null;
}

function isOfficeTransactionInRange(transaction: OfficeTransactionRow, filters: OfficePnlFilters): boolean {
  const date = transaction.transactionDate.slice(0, 10);
  if (filters.dateFrom !== null && date < filters.dateFrom) {
    return false;
  }

  return !(filters.dateTo !== null && date > filters.dateTo);
}

function toOfficeDepartmentPnl(dataset: OfficeAnalyticsDataset, departmentId: string, period: string, filters: OfficePnlFilters): OfficeDepartmentPnl {
  const pnl = readDepartmentPnl(dataset, departmentId, filters);
  return {
    scope: "department",
    completeness: "complete",
    departmentId,
    departmentLabel: pnl.department.name,
    period,
    incomeMicro: pnl.income,
    expenseMicro: pnl.expense,
    netMicro: pnl.profit,
    validatedProjectionId: `projection_department_${departmentId}_${period}`,
    projectionRows: toProjectionRows(
      [
        {
          department_id: departmentId,
          department_name: pnl.department.name,
          department_type: pnl.department.type,
          income: pnl.income,
          expense: pnl.expense,
          profit: pnl.profit,
          tx_count: pnl.tx_count
        }
      ],
      period
    ),
    lines: toOfficeCategoryPnlLines(dataset, filters)
  };
}

function toOfficeCategoryPnlLines(dataset: OfficeAnalyticsDataset, filters: OfficePnlFilters): readonly OfficePnlLine[] {
  const includeDepartmentInLabel = filters.departmentId === null;
  return readPnlByCategory(dataset, filters).map((row): OfficePnlLine => ({
    id: row.category_id,
    label: includeDepartmentInLabel
      ? `${row.department_name} · ${row.division_name} · ${row.category_name}`
      : `${row.division_name} · ${row.category_name}`,
    incomeMicro: row.income,
    expenseMicro: row.expense,
    netMicro: row.profit
  }));
}

function toProjectionRows(rows: readonly OfficePnlDepartmentRow[], period: string): readonly OfficePnlProjectionRow[] {
  const maxUnits = maxAbsoluteOfficeUnits(rows.flatMap((row) => [row.income, row.expense, row.profit]));
  return rows.map((row) => ({
    id: `projection_${period}_${row.department_id}`,
    departmentId: row.department_id,
    departmentLabel: row.department_name,
    revenueMicro: row.income,
    expenseMicro: row.expense,
    netMicro: row.profit,
    revenueBarLevel: toBarLevel(eofMoney.parse(row.income), maxUnits),
    expenseBarLevel: toBarLevel(eofMoney.parse(row.expense), maxUnits),
    netBarLevel: toBarLevel(eofMoney.parse(row.profit), maxUnits),
    netTone: eofMoney.parse(row.profit) >= 0n ? "positive" : "negative",
    validatedProjectionId: `projection_${period}_${row.department_id}`,
    validatedAt: `${period}-28T18:00:00.000Z`
  }));
}

function maxAbsoluteOfficeUnits(values: readonly string[]): bigint {
  let maxUnits = 0n;
  for (const value of values) {
    const units = abs(eofMoney.parse(value));
    if (units > maxUnits) {
      maxUnits = units;
    }
  }

  return maxUnits;
}

function toBarLevel(value: bigint, maxUnits: bigint): number {
  if (maxUnits === 0n) {
    return 0;
  }

  return parseInt(((abs(value) * 100n) / maxUnits).toString(), 10);
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function toOfficeTransaction(dataset: OfficeAnalyticsDataset, transaction: OfficeTransactionRow): OfficeTransaction {
  const status = transaction.status === "draft" && transaction.categoryId === null ? "pending" : toApiTransactionStatus(transaction.status);
  const categoryPath = transaction.categoryId === null ? null : resolveCategoryPath(dataset, transaction.categoryId);
  const base = {
    id: transaction.id,
    occurredOn: transaction.transactionDate.slice(0, 10),
    accountId: transaction.accountId,
    projectId: transaction.projectId,
    projectLabel: transaction.projectId === null ? null : requireProject(dataset, transaction.projectId).name,
    description: transaction.description ?? "",
    amountMicro: eofMoney.format(transaction.amountMinor),
    currency: transaction.originalCurrency ?? "MUR",
    sourceAuditEventId: null
  };

  if (status === "pending" || status === "draft") {
    return {
      ...base,
      status,
      departmentId: categoryPath?.department?.id ?? null,
      departmentLabel: categoryPath?.department?.name ?? null,
      divisionId: categoryPath?.division?.id ?? null,
      divisionLabel: categoryPath?.division?.name ?? null,
      categoryId: categoryPath?.category.id ?? null,
      categoryLabel: categoryPath?.category.name ?? null,
      // Income/expense belongs to the transaction; the category only files it.
      type: transaction.type
    };
  }

  if (categoryPath === null) {
    throw new ApiRouteError(500, "canonical_category_missing", "Validated transactions must carry a category.", [
      `transactionId=${transaction.id}`
    ]);
  }

  return {
    ...base,
    status,
    departmentId: categoryPath.department?.id ?? null,
    departmentLabel: categoryPath.department?.name ?? null,
    divisionId: categoryPath.division?.id ?? null,
    divisionLabel: categoryPath.division?.name ?? null,
    categoryId: categoryPath.category.id,
    categoryLabel: categoryPath.category.name,
    // Income/expense belongs to the transaction; the category only files it.
    type: transaction.type
  };
}

function toApiTransactionStatus(status: OfficeTransactionRow["status"]): OfficeTransactionStatus {
  if (status === "validated") {
    return "posted";
  }

  if (status === "cancelled") {
    return "voided";
  }

  return status;
}

// Per-array memoized id -> row maps. Keyed by array identity: every fixture mutation
// (see upsertById) replaces the array with a new reference, so a stale cache entry is
// never read back — it just becomes unreachable and gets rebuilt on next access. This
// turns the O(rows) .find() scans below into O(1) lookups without any invalidation logic.
const idMapCache = new WeakMap<readonly { readonly id: string }[], ReadonlyMap<string, { readonly id: string }>>();

function idMapOf<TItem extends { readonly id: string }>(items: readonly TItem[]): ReadonlyMap<string, TItem> {
  const cached = idMapCache.get(items);
  if (cached !== undefined) {
    return cached as ReadonlyMap<string, TItem>;
  }

  const map = new Map<string, TItem>(items.map((item) => [item.id, item]));
  idMapCache.set(items, map);
  return map;
}

function resolveCategoryPath(
  dataset: OfficeAnalyticsDataset,
  categoryId: string
): Readonly<{ readonly category: OfficeCategoryRow; readonly division: OfficeDivisionRow | null; readonly department: OfficeDepartmentRow | null }> {
  const category = idMapOf(dataset.categories).get(categoryId);
  if (category === undefined) {
    throw new ApiRouteError(500, "category_not_found", "Transaction category was not found in the chart of accounts.", [
      `categoryId=${categoryId}`
    ]);
  }

  if (category.divisionId === null) {
    return { category, division: null, department: null };
  }

  const division = idMapOf(dataset.divisions).get(category.divisionId);
  if (division === undefined) {
    throw new ApiRouteError(500, "division_not_found", "Category division was not found in the chart of accounts.", [
      `categoryId=${categoryId}`,
      `divisionId=${category.divisionId}`
    ]);
  }

  const department = idMapOf(dataset.departments).get(division.departmentId);
  if (department === undefined) {
    throw new ApiRouteError(500, "department_not_found", "Division department was not found in the chart of accounts.", [
      `divisionId=${division.id}`,
      `departmentId=${division.departmentId}`
    ]);
  }

  return { category, division, department };
}

function matchesOfficeTransactionQuery(context: ApiContext, transaction: OfficeTransaction): boolean {
  const period = nullableQuery(context, "period");
  const accountId = nullableQuery(context, "accountId");
  const departmentId = nullableQuery(context, "departmentId");
  const divisionId = nullableQuery(context, "divisionId");
  const categoryId = nullableQuery(context, "categoryId");
  const projectId = nullableQuery(context, "projectId");
  const type = nullableQuery(context, "type");
  const status = nullableQuery(context, "status");
  const dateFrom = optionalCompatQuery(context, ["dateFrom", "date_from", "from", "fromDate", "from_date"]);
  const dateTo = optionalCompatQuery(context, ["dateTo", "date_to", "to", "toDate", "to_date"]);
  if (isIsoDate(dateFrom) && isIsoDate(dateTo)) {
    if (transaction.occurredOn < dateFrom || transaction.occurredOn > dateTo) {
      return false;
    }
  } else if (period !== null && !transaction.occurredOn.startsWith(period)) {
    return false;
  }

  if (accountId !== null && transaction.accountId !== accountId) {
    return false;
  }

  if (departmentId !== null && transaction.departmentId !== departmentId) {
    return false;
  }

  if (divisionId !== null && transaction.divisionId !== divisionId) {
    return false;
  }

  if (categoryId !== null && transaction.categoryId !== categoryId) {
    return false;
  }

  if (projectId !== null && transaction.projectId !== projectId) {
    return false;
  }

  if (type !== null && transaction.type !== type) {
    return false;
  }

  return !(status !== null && transaction.status !== status);
}

function toPlanComptableNodes(dataset: OfficeAnalyticsDataset, includeInactive: boolean): readonly OfficePlanComptableNode[] {
  const departments: OfficePlanComptableNode[] = dataset.departments
    .filter((department) => includeInactive || department.isActive)
    .map((department) => ({
      kind: "department",
      id: department.id,
      code: department.id,
      label: department.name,
      active: department.isActive,
      parentId: null
    }));
  const divisions: OfficePlanComptableNode[] = dataset.divisions
    .filter((division) => includeInactive || division.isActive)
    .map((division) => ({
      kind: "division",
      id: division.id,
      code: division.id,
      label: division.name,
      active: division.isActive,
      parentId: division.departmentId,
      departmentId: division.departmentId,
      departmentLabel: requireDepartment(dataset, division.departmentId).name
    }));
  const categories: OfficePlanComptableNode[] = dataset.categories
    .filter((category) => includeInactive || category.isActive)
    .flatMap((category) => {
      const path = resolveCategoryPath(dataset, category.id);
      if (path.division === null || path.department === null) {
        return [];
      }

      return {
        kind: "category",
        id: category.id,
        code: category.id,
        label: category.name,
        active: category.isActive,
        parentId: path.division.id,
        departmentId: path.department.id,
        departmentLabel: path.department.name,
        divisionId: path.division.id,
        divisionLabel: path.division.name,
        type: category.type
      };
    });
  return [...departments, ...divisions, ...categories];
}

function toReconciliationCandidates(dataset: OfficeAnalyticsDataset): readonly OfficeReconciliationCandidate[] {
  return dataset.bankStatementLines.map((line) => {
    const match = dataset.bankReconciliationMatches.find((candidate) => candidate.bankStatementLineId === line.id);
    const transactionId = line.matchedTransactionId ?? match?.transactionId ?? "tx_uncategorized";
    const transaction = dataset.transactions.find((candidate) => candidate.id === transactionId);
    return {
      id: match?.id ?? `recon_${line.id}`,
      transactionId,
      statementLineId: line.id,
      occurredOn: line.occurredOn,
      // Show the bank's own narration first (the CSV description column); the
      // reference (cheque/ref number) and the internal id are fallbacks only.
      bankDescription: line.description ?? line.reference ?? line.id,
      ledgerDescription: transaction?.description ?? "Unmatched ledger line",
      // Statement lines store magnitude + direction; expose debits as negative
      // so clients render outflows with the right sign and tone.
      amountMicro: eofMoney.format(line.direction === "debit" ? -line.amountMurMinor : line.amountMurMinor),
      confidenceBp: match?.confidenceBp ?? (line.reconciliationStatus === "matched" ? 10000 : 0),
      status: toApiReconciliationStatus(line, match)
    };
  });
}

function toApiReconciliationStatus(
  line: OfficeBankStatementLineRow,
  match:
    | {
      readonly status: "unmatched" | "suggested" | "matched" | "rejected" | "ignored";
    }
    | undefined
): OfficeReconciliationCandidate["status"] {
  if (line.reconciliationStatus === "matched") {
    return "matched";
  }

  if (line.reconciliationStatus === "suggested") {
    return "suggested";
  }

  if (line.reconciliationStatus === "rejected") {
    return "rejected";
  }

  if (line.reconciliationStatus === "ignored") {
    return "ignored";
  }

  if (match?.status === "suggested") {
    return "suggested";
  }

  if (match?.status === "matched") {
    return "matched";
  }

  if (match?.status === "rejected") {
    return "rejected";
  }

  if (match?.status === "ignored") {
    return "ignored";
  }

  return "unmatched";
}

function matchesReconciliationQuery(context: ApiContext, candidate: OfficeReconciliationCandidate): boolean {
  const period = nullableQuery(context, "period");
  const status = nullableQuery(context, "status");
  const dateFrom = nullableQuery(context, "dateFrom");
  const dateTo = nullableQuery(context, "dateTo");
  if (isIsoDate(dateFrom) && isIsoDate(dateTo)) {
    if (candidate.occurredOn < dateFrom || candidate.occurredOn > dateTo) {
      return false;
    }
  } else if (period !== null && !candidate.occurredOn.startsWith(period)) {
    return false;
  }

  return !(status !== null && candidate.status !== status);
}

function isReconciliationCandidateInWorkspace(
  dataset: OfficeAnalyticsDataset,
  candidate: OfficeReconciliationCandidate,
  workspaceId: string
): boolean {
  const line = dataset.bankStatementLines.find((item) => item.id === candidate.statementLineId);
  if (line === undefined) {
    return false;
  }

  const account = dataset.bankAccounts.find((item) => item.id === line.accountId);
  if (account === undefined) {
    return false;
  }

  return account.workspaceId === workspaceId;
}

function readOfficeReconciliationOperations(
  dataset: OfficeAnalyticsDataset,
  workspaceId: string,
  accountId: string | null,
  period: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  nowIso: string
): OfficeReconciliationOperationsResponse {
  const candidates = toReconciliationCandidates(dataset).filter((candidate) => {
    if (!isReconciliationCandidateInWorkspace(dataset, candidate, workspaceId)) {
      return false;
    }

    if (accountId !== null) {
      const line = dataset.bankStatementLines.find((item) => item.id === candidate.statementLineId);
      if (line === undefined || line.accountId !== accountId) {
        return false;
      }
    }

    if (isIsoDate(dateFrom) && isIsoDate(dateTo)) {
      if (candidate.occurredOn < dateFrom || candidate.occurredOn > dateTo) {
        return false;
      }
    } else if (period !== null && !candidate.occurredOn.startsWith(period)) {
      return false;
    }

    return true;
  });

  const totalCount = candidates.length;
  const unmatchedCount = candidates.filter((candidate) => candidate.status === "unmatched").length;
  const suggestedCount = candidates.filter((candidate) => candidate.status === "suggested").length;
  const matchedCount = candidates.filter((candidate) => candidate.status === "matched").length;
  const rejectedCount = candidates.filter((candidate) => candidate.status === "rejected").length;
  const ignoredCount = candidates.filter((candidate) => candidate.status === "ignored").length;
  const autoApprovableCount = candidates.filter((candidate) => candidate.status === "suggested" && candidate.confidenceBp >= 9500).length;
  const staleSuggestedCount = candidates.filter((candidate) => {
    if (candidate.status !== "suggested") {
      return false;
    }
    return absoluteIsoDayDistance(candidate.occurredOn, nowIso.slice(0, 10)) > 7;
  }).length;
  const oldestUnmatchedDays = candidates
    .filter((candidate) => candidate.status === "unmatched")
    .map((candidate) => absoluteIsoDayDistance(candidate.occurredOn, nowIso.slice(0, 10)))
    .reduce<number | null>((max, value) => (max === null || value > max ? value : max), null);

  return {
    workspaceId,
    period,
    dateFrom,
    dateTo,
    generatedAt: nowIso,
    totalCount,
    unmatchedCount,
    suggestedCount,
    matchedCount,
    rejectedCount,
    ignoredCount,
    autoApprovableCount,
    staleSuggestedCount,
    oldestUnmatchedDays,
    matchedRateBp: totalCount === 0 ? 0 : Math.round((matchedCount * 10_000) / totalCount)
  };
}

function toCashflowBuckets(rows: readonly { readonly period: string; readonly inflowMur: string; readonly outflowMur: string; readonly closingMur: string }[]): readonly CashflowBucket[] {
  const maxUnits = maxAbsoluteOfficeUnits(rows.flatMap((row) => [row.inflowMur, row.outflowMur]));
  return rows.map((row) => ({
    period: row.period,
    inflowMicro: row.inflowMur,
    outflowMicro: row.outflowMur,
    closingMicro: row.closingMur,
    inflowLevel: toBarLevel(eofMoney.parse(row.inflowMur), maxUnits),
    outflowLevel: toBarLevel(eofMoney.parse(row.outflowMur), maxUnits)
  }));
}

function matchesAuditQuery(context: ApiContext, entry: AuditLogEntry): boolean {
  const entityType = nullableQuery(context, "entityType");
  const actorId = nullableQuery(context, "actorId");
  const from = nullableQuery(context, "from");
  const to = nullableQuery(context, "to");
  if (entityType !== null && entry.entityType !== entityType) {
    return false;
  }

  if (actorId !== null && entry.actorId !== actorId) {
    return false;
  }

  if (from !== null && entry.occurredAt.slice(0, 10) < from) {
    return false;
  }

  return !(to !== null && entry.occurredAt.slice(0, 10) > to);
}

function requirePartnerFacet(context: ApiContext): OfficePartnerFacet {
  const facet = requireQuery(context, "facet");
  if (facet !== "client" && facet !== "supplier") {
    throw new ApiRouteError(400, "partner_facet_invalid", "Partner facet must be client or supplier.", [`facet=${facet}`]);
  }

  return facet;
}

function toPartnerListItem(fixtures: ApiFixtureStore, partner: OfficePartnerRow, filters: OfficePnlFilters): OfficePartnerListItem {
  return {
    id: partner.id,
    name: partner.name,
    status: partner.isActive ? "active" : "inactive",
    activity: toPartnerActivity(fixtures.office, partner.id, filters),
    distributionPayeeLink: toPartnerPayeeLink(fixtures, partner)
  };
}

function toPartnerDetail(
  fixtures: ApiFixtureStore,
  partner: OfficePartnerRow,
  period: string,
  filters: OfficePnlFilters
): OfficePartnerDetail & Pick<OfficePartnerPnl, "completeness" | "period"> {
  readPartnerPnl(fixtures.office, partner.id, filters);
  return {
    ...toPartnerListItem(fixtures, partner, filters),
    completeness: "partial",
    period,
    email: null,
    phone: null,
    address: null,
    taxId: null,
    notes: null,
    classificationSuggestions: fixtures.officeClassificationSuggestions[partner.id] ?? []
  };
}

function toPartnerPayeeLink(fixtures: ApiFixtureStore, partner: OfficePartnerRow): OfficePartnerPayeeLink {
  return (
    fixtures.officePartnerPayeeLinks[partner.id] ?? {
      partnerId: partner.id,
      partnerName: partner.name,
      payeeId: null,
      payeeName: null,
      resolution: "unmatched",
      status: null,
      source: "fixture",
      confidence: null
    }
  );
}

function hasFacetActivity(partner: OfficePartnerListItem, facet: OfficePartnerFacet): boolean {
  const side = facet === "client" ? partner.activity.income : partner.activity.expense;
  return eofMoney.parse(side.periodTotalMicro) > 0n;
}

function toPartnerActivity(dataset: OfficeAnalyticsDataset, partnerId: string, filters: OfficePnlFilters): OfficePartnerActivity {
  const units = partnerActivityUnits(dataset, partnerId, filters);
  const income: OfficePartnerSideActivity = {
    periodTotalMicro: eofMoney.format(units.incomeUnits),
    openBalanceMicro: eofMoney.format(units.incomeUnits),
    transactionCount: units.incomeCount,
    lastActivityOn: units.incomeLastActivityOn
  };
  const expense: OfficePartnerSideActivity = {
    periodTotalMicro: eofMoney.format(units.expenseUnits),
    openBalanceMicro: eofMoney.format(units.expenseUnits),
    transactionCount: units.expenseCount,
    lastActivityOn: units.expenseLastActivityOn
  };
  return {
    income,
    expense,
    netMicro: eofMoney.format(units.incomeUnits - units.expenseUnits)
  };
}

function partnerActivityUnits(dataset: OfficeAnalyticsDataset, partnerId: string, filters: OfficePnlFilters): PartnerActivityUnits {
  let incomeUnits = 0n;
  let expenseUnits = 0n;
  let incomeCount = 0;
  let expenseCount = 0;
  let incomeLastActivityOn: string | null = null;
  let expenseLastActivityOn: string | null = null;
  for (const transaction of dataset.transactions) {
    if (transaction.partnerId !== partnerId || !dateInFilters(transaction.transactionDate, filters) || !transaction.isActive) {
      continue;
    }

    if (transaction.status !== "validated") {
      continue;
    }

    const occurredOn = transaction.transactionDate.slice(0, 10);
    if (transaction.type === "income") {
      incomeUnits = eofMoney.add(incomeUnits, transaction.amountMinor);
      incomeCount += 1;
      incomeLastActivityOn = latestDate(incomeLastActivityOn, occurredOn);
    } else {
      expenseUnits = eofMoney.add(expenseUnits, transaction.amountMinor);
      expenseCount += 1;
      expenseLastActivityOn = latestDate(expenseLastActivityOn, occurredOn);
    }
  }

  return {
    incomeUnits,
    expenseUnits,
    incomeCount,
    expenseCount,
    incomeLastActivityOn,
    expenseLastActivityOn
  };
}

function latestDate(left: string | null, right: string): string {
  if (left === null) {
    return right;
  }

  return left > right ? left : right;
}

function toProjectSummary(dataset: OfficeAnalyticsDataset, project: OfficeProjectRow, filters: OfficePnlFilters): OfficeProjectSummary {
  const pnl = readProjectPnl(dataset, project.id, filters);
  return {
    id: project.id,
    code: project.id,
    label: project.name,
    status: project.status === "archived" ? "archived" : "active",
    writeStatus: project.status,
    description: project.description,
    active: project.isActive,
    ownerLabel: "Office",
    periodIncomeMicro: pnl.income,
    periodExpenseMicro: pnl.expense,
    netMicro: pnl.profit,
    openViolationCount: 0,
    lastActivityOn: latestProjectActivityOn(dataset, project.id)
  };
}

function latestProjectActivityOn(dataset: OfficeAnalyticsDataset, projectId: string): string | null {
  let latest: string | null = null;
  for (const transaction of dataset.transactions) {
    if (transaction.projectId !== projectId) {
      continue;
    }

    latest = latestDate(latest, transaction.transactionDate.slice(0, 10));
  }

  return latest;
}

function readOfficeBankQualityForFilters(
  dataset: OfficeAnalyticsDataset,
  period: string,
  filters: OfficePnlFilters
): OfficeBankQualityResult {
  const lines = dataset.bankStatementLines.filter((line) => dateInFilters(line.occurredOn, filters));
  const matchedLineIds = new Set<string>(
    dataset.bankReconciliationMatches.filter((match) => match.status === "matched").map((match) => match.bankStatementLineId)
  );
  const matchedCount = lines.filter((line) => line.reconciliationStatus === "matched" || matchedLineIds.has(line.id)).length;
  const totalCount = lines.length;
  const matchedRateBp = totalCount === 0 ? 0 : Number((BigInt(matchedCount) * 10000n + BigInt(totalCount) / 2n) / BigInt(totalCount));
  const periodImports = dataset.bankImportBatches.filter(
    (batch) => batch.status === "confirmed" && bankImportBatchIntersectsFilters(batch, filters)
  );

  return {
    period,
    matchedRateBp,
    unmatchedLineCount: lines.filter((line) => line.reconciliationStatus === "unmatched" && !matchedLineIds.has(line.id)).length,
    duplicateCandidateCount: lines.filter((line) => line.isDuplicateCandidate).length,
    missingReferenceCount: lines.filter((line) => line.reference === null || line.reference.trim() === "").length,
    staleImportCount: dataset.bankImportBatches.filter((batch) => batch.status === "confirmed" && isBankImportStaleForFilters(batch, filters)).length,
    lastImportAt: latestTimestamp(periodImports.map((batch) => batch.importedAt))
  };
}

function bankImportBatchIntersectsFilters(batch: OfficeBankImportBatchRow, filters: OfficePnlFilters): boolean {
  if (batch.periodStart !== null && batch.periodEnd !== null) {
    const windowStart = filters.dateFrom ?? "0000-01-01";
    const windowEnd = filters.dateTo ?? "9999-12-31";
    return batch.periodStart <= windowEnd && batch.periodEnd >= windowStart;
  }

  if (batch.importedAt !== null) {
    return dateInFilters(batch.importedAt, filters);
  }

  return false;
}

function isBankImportStaleForFilters(batch: OfficeBankImportBatchRow, filters: OfficePnlFilters): boolean {
  if (batch.periodEnd === null || filters.dateFrom === null) {
    return false;
  }

  return batch.periodEnd < filters.dateFrom;
}

function latestTimestamp(values: readonly (string | null)[]): string | null {
  const timestamps = values.filter((value): value is string => value !== null).sort((left, right) => right.localeCompare(left));
  return timestamps[0] ?? null;
}

function toProjectPnl(dataset: OfficeAnalyticsDataset, projectId: string, period: string, filters: OfficePnlFilters): OfficeProjectPnl {
  const pnl = readProjectPnl(dataset, projectId, filters);
  const lines = projectPnlLines(dataset, projectId, filters);
  return {
    completeness: "partial",
    projectId,
    projectLabel: pnl.project.name,
    period,
    incomeMicro: pnl.income,
    expenseMicro: pnl.expense,
    netMicro: pnl.profit,
    receivableMicro: pnl.income,
    payableMicro: pnl.expense,
    transactionCount: pnl.tx_count,
    validatedProjectionId: `projection_project_${projectId}_${period}`,
    lines
  };
}

function projectPnlLines(dataset: OfficeAnalyticsDataset, projectId: string, filters: OfficePnlFilters): readonly OfficeProjectPnlLine[] {
  const categoryRows = new Map<string, { readonly category: OfficePnlCategoryRow; readonly transactionCount: number; readonly amountUnits: bigint }>();
  for (const transaction of dataset.transactions) {
    if (transaction.projectId !== projectId || !dateInFilters(transaction.transactionDate, filters) || transaction.categoryId === null) {
      continue;
    }

    const path = resolveCategoryPath(dataset, transaction.categoryId);
    if (path.division === null || path.department === null) {
      continue;
    }

    const previous = categoryRows.get(transaction.categoryId);
    const existingUnits = previous?.amountUnits ?? 0n;
    const existingCount = previous?.transactionCount ?? 0;
    categoryRows.set(transaction.categoryId, {
      category: {
        category_id: path.category.id,
        category_name: path.category.name,
        category_type: path.category.type,
        division_id: path.division.id,
        division_name: path.division.name,
        department_id: path.department.id,
        department_name: path.department.name,
        income: path.category.type === "income" ? eofMoney.format(transaction.amountMinor) : "0.00",
        expense: path.category.type === "expense" ? eofMoney.format(transaction.amountMinor) : "0.00",
        profit: path.category.type === "income" ? eofMoney.format(transaction.amountMinor) : eofMoney.format(-transaction.amountMinor),
        tx_count: 1
      },
      transactionCount: existingCount + 1,
      amountUnits: eofMoney.add(existingUnits, transaction.amountMinor)
    });
  }

  return [...categoryRows.entries()].map(([categoryId, row]) => ({
    id: categoryId,
    label: `${row.category.department_name} · ${row.category.division_name} · ${row.category.category_name}`,
    categoryLabel: row.category.category_name,
    type: row.category.category_type,
    transactionCount: row.transactionCount,
    amountMicro: eofMoney.format(row.amountUnits)
  }));
}

function toOfficeIntegrity(dataset: OfficeAnalyticsDataset, checkedAt: string): OfficeIntegrityCheckAllResponse {
  const bankQuality = readOfficeBankQuality(dataset, "2026-02");
  const checks: readonly OfficeIntegrityCheck[] = [
    {
      id: "integrity_bank_quality",
      label: "Bank matching quality",
      status: bankQuality.unmatchedLineCount === 0 ? "pass" : "warning",
      detail: `${String(bankQuality.unmatchedLineCount)} bank line(s) need review.`,
      exactFixPath: "reconciliation"
    },
    {
      id: "integrity_uncategorized",
      label: "Uncategorized transactions",
      status: dataset.transactions.some((transaction) => transaction.categoryId === null) ? "warning" : "pass",
      detail: "Pending lines must receive a category before validation.",
      exactFixPath: "transactions"
    }
  ];
  return {
    checkedAt,
    status: checks.some((check) => check.status === "fail") ? "fail" : checks.some((check) => check.status === "warning") ? "warning" : "pass",
    passCount: checks.filter((check) => check.status === "pass").length,
    warningCount: checks.filter((check) => check.status === "warning").length,
    failCount: checks.filter((check) => check.status === "fail").length,
    checks
  };
}

function requirePartner(dataset: OfficeAnalyticsDataset, partnerId: string): OfficePartnerRow {
  const partner = dataset.partners.find((candidate) => candidate.id === partnerId);
  if (partner === undefined) {
    throw new ApiRouteError(404, "partner_not_found", "Office partner fixture was not found.", [`partnerId=${partnerId}`]);
  }

  return partner;
}

function requireProject(dataset: OfficeAnalyticsDataset, projectId: string): OfficeProjectRow {
  const project = idMapOf(dataset.projects).get(projectId);
  if (project === undefined) {
    throw new ApiRouteError(404, "project_not_found", "Office project fixture was not found.", [`projectId=${projectId}`]);
  }

  return project;
}

function requireDepartment(dataset: OfficeAnalyticsDataset, departmentId: string): OfficeDepartmentRow {
  const department = idMapOf(dataset.departments).get(departmentId);
  if (department === undefined) {
    throw new ApiRouteError(404, "department_not_found", "Office department fixture was not found.", [`departmentId=${departmentId}`]);
  }

  return department;
}

function toDistributionDashboard(dataset: DistributionReadDataset, period: string): DistributionDashboardResponse {
  const totals = readAllocationTotals(dataset, { calculationRunId: null, payeeId: null, status: "posted" });
  const total = totals[0];
  return {
    period,
    grossRoyaltyMicro: total?.grossShare ?? "0.0000000000",
    recoupedMicro: total?.recoupmentApplied ?? "0.0000000000",
    netPayableMicro: total?.netPayable ?? "0.0000000000",
    suspenseCount: countOpenSuspense(dataset, { status: "open", reasonCode: null }),
    openStatementCount: countOpenStatements(dataset, period),
    lastAuditEventId: null
  };
}

function toDistributionImportBatch(dataset: DistributionReadDataset, batchId: string): DistributionImportBatch {
  const batch = dataset.importBatches.find((candidate) => candidate.id === batchId);
  if (batch === undefined) {
    throw new ApiRouteError(404, "distribution_import_batch_not_found", "Distribution import batch fixture was not found.", [
      `batchId=${batchId}`
    ]);
  }

  const rows = dataset.normalizedEarnings.filter((earning) => earning.batchId === batch.id);
  // P6a: sum only for the primary (first) currency — never add EUR + USD together.
  const primaryCurrency = rows[0]?.currency ?? "USD";
  const grossUnits = rows
    .filter((row) => row.currency === primaryCurrency)
    .reduce((sum: bigint, row) => erhMoney.add(sum, erhMoney.parse(row.grossAmount)), 0n);
  return {
    id: batch.id,
    source: batch.source === "routenote" ? "routenote" : "kontor",
    fileName: batch.fileName,
    period: "2026-04",
    statementReference: batch.id,
    accountReference: batch.source,
    rowCount: rows.length,
    unmatchedRowCount: rows.filter((row) => row.mappingStatus !== "matched").length,
    currency: primaryCurrency,
    grossMicro: erhMoney.format(grossUnits),
    payableColumn: "netPayable",
    joinKeySummary: "ISRC / UPC / title / artist",
    status: toApiImportStatus(batch.status),
    nextAction: rows.some((row) => row.mappingStatus !== "matched") ? "review_mapping" : "validate",
    importedAt: batch.importedAt ?? "2026-04-30T10:00:00.000Z"
  };
}

function toApiImportStatus(status: string): DistributionImportBatch["status"] {
  if (status === "void") {
    return "voided";
  }

  if (status === "completed") {
    return "validated";
  }

  if (status === "failed") {
    return "failed";
  }

  if (status === "processing") {
    return "mapped";
  }

  return "uploaded";
}

function toReleaseSummaries(dataset: DistributionReadDataset): readonly ReleaseSummary[] {
  const releaseIds = new Set<string>();
  for (const track of dataset.tracks) {
    if (track.releaseId !== null) {
      releaseIds.add(track.releaseId);
    }
  }

  return [...releaseIds].map((releaseId) => ({
    id: releaseId,
    title: "Seggae light",
    artistName: "Kaya",
    upc: "742000000001",
    status: "released",
    releaseDate: "2026-04-01",
    trackCount: dataset.tracks.filter((track) => track.releaseId === releaseId).length
  }));
}

function toAllocationRunSummary(dataset: DistributionReadDataset, run: DistributionCalculationRunRow): AllocationRunSummary {
  const allocations = readAllocationList(dataset, { calculationRunId: run.id, payeeId: null, status: null });
  const total = allocations.totals[0];
  const period = "2026-04";
  return {
    id: run.id,
    runReference: `${period} · distribution:allocation:${run.id}`,
    period,
    status: toApiRunStatus(run.status),
    lockKey: `distribution:allocation:${run.id}`,
    startedAt: run.startedAt,
    completedAt: run.finishedAt,
    totalInputMicro: total?.grossShare ?? "0.0000000000",
    totalAllocatedMicro: total?.netPayable ?? "0.0000000000"
  };
}

function toApiRunStatus(status: string): AllocationRunSummary["status"] {
  if (status === "calculated") {
    return "completed";
  }

  if (status === "error") {
    return "failed";
  }

  return "queued";
}

function toDomainSuspenseStatus(status: string | null): "open" | "resolved" | null {
  if (status === "open" || status === "resolved") {
    return status;
  }

  return null;
}

function toApiSuspenseItem(row: DistributionSuspenseReadRow, period: string | null): SuspenseItem {
  return {
    id: row.id,
    period: period ?? "2026-04",
    sourceReference: row.sourceReference,
    reason: toApiSuspenseReason(row.reasonCode),
    exactFixPath: row.exactFixPath,
    amountMicro: row.amount,
    currency: row.currency,
    status: row.status
  };
}

function toApiSuspenseReason(reasonCode: string): SuspenseItem["reason"] {
  if (reasonCode === "missing_split" || reasonCode === "import_retry" || reasonCode === "contract_hold") {
    return reasonCode;
  }

  return "unmapped_track";
}

function toApiStatementSummary(row: DistributionStatementReadRow): StatementSummary {
  return {
    id: row.id,
    period: row.periodStart.slice(0, 7),
    period_start: row.periodStart,
    period_end: row.periodEnd,
    payeeId: row.payeeId,
    payeeName: row.payeeName,
    status: toApiStatementStatus(row.status),
    grossMicro: row.grossTotal,
    recoupedMicro: row.recoupmentTotal,
    paidMicro: row.paymentsApplied,
    netPayableMicro: row.statementBalance,
    currency: row.currency
  };
}

function toApiStatementStatus(status: string): StatementSummary["status"] {
  if (status === "paid") {
    return "paid";
  }

  if (status === "draft") {
    return "draft";
  }

  return "posted";
}

function toPaymentSummaries(dataset: DistributionReadDataset): readonly PaymentSummary[] {
  return dataset.payments.map((payment) => {
    const payee = dataset.payees.find((candidate) => candidate.id === payment.payeeId);
    const link = dataset.statementPaymentLinks.find((candidate) => candidate.paymentId === payment.id);
    return {
      id: payment.id,
      statementId: link?.statementId ?? "statement_unlinked",
      payeeId: payment.payeeId,
      payeeName: payee?.name ?? payment.payeeId,
      amountMicro: payment.amount,
      currency: payment.currency,
      status: toApiPaymentStatus(payment.status),
      paidAt: payment.paidAt,
      reference: payment.reference
    };
  });
}

function toApiPaymentStatus(status: string): PaymentSummary["status"] {
  if (status === "void") {
    return "voided";
  }

  if (status === "reconciled") {
    return "paid";
  }

  return "draft";
}

function toRevenueRows(dataset: DistributionReadDataset, groupBy: string): readonly DistributionRevenueRow[] {
  const allocations = readAllocationList(dataset, { calculationRunId: null, payeeId: null, status: "posted" }).rows;
  const groups = new Map<string, { readonly label: string; readonly currency: CurrencyCode; readonly rows: DistributionAllocationReadRow[] }>();
  for (const allocation of allocations) {
    const group = revenueGroup(dataset, allocation, groupBy);
    const previous = groups.get(group.id);
    groups.set(group.id, {
      label: group.label,
      currency: allocation.currency,
      rows: [...(previous?.rows ?? []), allocation]
    });
  }

  const maxUnits = maxDistributionNetUnits([...groups.values()].map((group) => group.rows));
  return [...groups.entries()].map(([id, group]) => {
    const grossUnits = group.rows.reduce((sum: bigint, row) => erhMoney.add(sum, erhMoney.parse(row.grossShare)), 0n);
    const netUnits = group.rows.reduce((sum: bigint, row) => erhMoney.add(sum, erhMoney.parse(row.netPayable)), 0n);
    return {
      id,
      label: group.label,
      grossMicro: erhMoney.format(grossUnits),
      netMicro: erhMoney.format(netUnits),
      payableMicro: erhMoney.format(netUnits),
      currency: group.currency,
      barLevel: toDistributionBarLevel(netUnits, maxUnits)
    };
  });
}

function revenueGroup(
  dataset: DistributionReadDataset,
  allocation: DistributionAllocationReadRow,
  groupBy: string
): Readonly<{ readonly id: string; readonly label: string }> {
  if (groupBy === "track") {
    return {
      id: allocation.trackId ?? allocation.earningId,
      label: allocation.trackTitle ?? allocation.earningId
    };
  }

  if (groupBy === "currency") {
    return {
      id: allocation.currency,
      label: allocation.currency
    };
  }

  if (groupBy === "store") {
    const earning = dataset.normalizedEarnings.find((candidate) => candidate.id === allocation.earningId);
    return {
      id: earning?.dsp ?? "unknown_store",
      label: earning?.dsp ?? "Unknown store"
    };
  }

  if (groupBy === "period") {
    return {
      id: "2026-04",
      label: "2026-04"
    };
  }

  return {
    id: allocation.payeeId,
    label: allocation.payeeName
  };
}

function maxDistributionNetUnits(groups: readonly (readonly DistributionAllocationReadRow[])[]): bigint {
  let maxUnits = 0n;
  for (const rows of groups) {
    const total = rows.reduce((sum: bigint, row) => erhMoney.add(sum, erhMoney.parse(row.netPayable)), 0n);
    if (total > maxUnits) {
      maxUnits = total;
    }
  }

  return maxUnits;
}

function toDistributionBarLevel(value: bigint, maxUnits: bigint): number {
  if (maxUnits === 0n) {
    return 0;
  }

  return parseInt(((value * 100n) / maxUnits).toString(), 10);
}

const distributionReconciliationSampleLimit = 25;

function toDistributionReconciliation(store: ApiFixtureStore): DistributionReconciliationResponse {
  const dataset = store.distribution;
  const payeeName = (payeeId: string): string =>
    dataset.payees.find((candidate) => candidate.id === payeeId)?.name ?? payeeId;
  const contractTitle = (contractId: string): string =>
    store.distributionContracts.find((candidate) => candidate.id === contractId)?.title ?? contractId;

  const linkedPaymentIds = new Set(dataset.statementPaymentLinks.map((link) => link.paymentId));
  const unlinkedPayments = dataset.payments.filter((payment) => !linkedPaymentIds.has(payment.id));
  const missingPaymentDates = dataset.payments.filter((payment) => payment.paidAt === null);

  const linkedStatementIds = new Set(dataset.statementPaymentLinks.map((link) => link.statementId));
  const statementsWithoutLinks = dataset.statements.filter((statement) => !linkedStatementIds.has(statement.id));

  const allocatedEarningIds = new Set(dataset.earningAllocations.map((allocation) => allocation.earningId));
  const matchedUnallocated = dataset.normalizedEarnings.filter(
    (earning) => earning.mappingStatus === "matched" && !allocatedEarningIds.has(earning.id)
  );

  const expenseTermsMissingPayee = store.distributionCostTerms.filter((term) => term.payeeId === null);

  const balanceGroups = new Map<string, { readonly payeeId: string; readonly currency: string; ids: string[]; latest: string }>();
  for (const balance of store.distributionPayeeBalances) {
    const key = `${balance.payeeId}:${balance.currency}`;
    const existing = balanceGroups.get(key);
    if (existing === undefined) {
      balanceGroups.set(key, {
        payeeId: balance.payeeId,
        currency: balance.currency,
        ids: [balance.id],
        latest: balance.closingBalance
      });
    } else {
      existing.ids.push(balance.id);
      existing.latest = balance.closingBalance;
    }
  }

  const kpis: readonly DistributionReconciliationKpi[] = [
    { id: "payments_total", label: "Payments", value: String(dataset.payments.length), detail: `${String(unlinkedPayments.length)} unlinked`, tone: "info" },
    { id: "payments_unlinked", label: "Unlinked payments", value: String(unlinkedPayments.length), detail: "no statement link", tone: unlinkedPayments.length > 0 ? "warning" : "success" },
    { id: "strict_matches", label: "Strict payment matches", value: String(dataset.statementPaymentLinks.length), detail: "statement ↔ payment", tone: "info" },
    { id: "statement_plans", label: "Statement plans", value: String(linkedStatementIds.size), detail: "statements with a payment", tone: "info" },
    { id: "payment_only_plans", label: "Payment-only plans", value: String(unlinkedPayments.length), detail: "payment without statement", tone: unlinkedPayments.length > 0 ? "warning" : "success" },
    { id: "missing_payment_dates", label: "Missing payment dates", value: String(missingPaymentDates.length), detail: "paidAt is null", tone: missingPaymentDates.length > 0 ? "warning" : "success" },
    { id: "statements", label: "Statements", value: String(dataset.statements.length), detail: `${String(dataset.statementLines.length)} statement lines`, tone: "info" },
    { id: "payee_balances", label: "Payee balances", value: String(store.distributionPayeeBalances.length), detail: `${String(balanceGroups.size)} payee/currency rows`, tone: "info" },
    { id: "expense_applications", label: "Expense applications", value: String(store.distributionExpenseApplications.length), detail: "applied cost terms", tone: "info" },
    { id: "missing_expense_payees", label: "Missing expense payees", value: String(expenseTermsMissingPayee.length), detail: "cost terms with null payee", tone: expenseTermsMissingPayee.length > 0 ? "warning" : "success" },
    { id: "allocations", label: "Allocations", value: String(dataset.earningAllocations.length), detail: "earning allocations", tone: "info" },
    { id: "matched_unallocated", label: "Matched unallocated", value: String(matchedUnallocated.length), detail: "matched, no allocation", tone: matchedUnallocated.length > 0 ? "warning" : "success" }
  ];

  const statementsWithoutPaymentLinks: readonly DistributionReconciliationStatementGap[] = statementsWithoutLinks
    .slice(0, distributionReconciliationSampleLimit)
    .map((statement) => ({
      id: statement.id,
      statementReference: `${payeeName(statement.payeeId)} · ${statement.periodStart} → ${statement.periodEnd}`,
      payee: payeeName(statement.payeeId),
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      currency: statement.currency,
      netPayableMicro: statement.netPayable
    }));

  const expenseTermsMissingPayeeRows: readonly DistributionReconciliationExpenseGap[] = expenseTermsMissingPayee
    .slice(0, distributionReconciliationSampleLimit)
    .map((term) => ({
      id: term.id,
      expenseReference: `${contractTitle(term.contractId)} · ${term.currency} ${term.amount}`,
      contract: contractTitle(term.contractId),
      description: term.recoupable ? "recoupable cost term" : "non-recoupable cost term",
      amountMicro: term.amount,
      currency: term.currency,
      status: term.status
    }));

  const matchedUnallocatedSamples: readonly DistributionReconciliationMatchedUnallocated[] = matchedUnallocated
    .slice(0, distributionReconciliationSampleLimit)
    .map((earning) => ({
      id: earning.id,
      sourceReference: `${earning.batchId} · ${earning.rawTitle ?? earning.isrc ?? earning.upc ?? earning.id}`,
      batch: earning.batchId,
      track: earning.rawTitle ?? earning.id,
      currency: earning.currency,
      grossMicro: earning.grossAmount,
      status: earning.calculationStatus
    }));

  const payeeBalancesSummary: readonly DistributionReconciliationPayeeBalance[] = [...balanceGroups.values()]
    .slice(0, distributionReconciliationSampleLimit)
    .map((group) => ({
      payee: payeeName(group.payeeId),
      currency: group.currency,
      rows: group.ids.length,
      firstId: group.ids[0] ?? null,
      lastId: group.ids[group.ids.length - 1] ?? null,
      firstReference: balanceReference(group.payeeId, group.currency, group.ids[0] ?? null),
      lastReference: balanceReference(group.payeeId, group.currency, group.ids[group.ids.length - 1] ?? null),
      latestClosingMicro: group.latest
    }));

  const actions: readonly DistributionReconciliationAction[] = [
    { id: "link-statement-payment", label: "Link statement payment", description: "Records and links a payment to the first open statement gap.", maintenance: false },
    { id: "recompute-payee-balance", label: "Recompute payee balance", description: "Temporarily disabled until a dedicated recompute endpoint is implemented.", maintenance: true },
    { id: "assign-expense-payee", label: "Assign expense payee", description: "Creates a guarded contract expense with an explicit payee.", maintenance: false },
    { id: "allocate-matched-row", label: "Allocate matched row", description: "Runs the locked allocation engine for matched rows.", maintenance: false },
    { id: "void-statement", label: "Void statement", description: "Voids a statement and appends the reversal balance row.", maintenance: false },
    { id: "repair-identity-link", label: "Repair identity link", description: "One-off backfill; kept as flagged maintenance.", maintenance: true },
    { id: "refresh-derived-summary", label: "Refresh derived summary", description: "One-off derived summary rebuild; kept as flagged maintenance.", maintenance: true }
  ];

  return {
    kpis,
    statementsWithoutPaymentLinks,
    expenseTermsMissingPayee: expenseTermsMissingPayeeRows,
    matchedUnallocatedSamples,
    payeeBalancesSummary,
    actions
  };
}

function toDistributionAliases(store: ApiFixtureStore): readonly DistributionAlias[] {
  void store;
  // catalog_aliases is not surfaced through the read dataset, so this returns an empty,
  // typed result that drives the empty-state UI rather than fabricating alias data.
  return [];
}

function toDistributionDuplicates(store: ApiFixtureStore): readonly DistributionDuplicate[] {
  const dataset = store.distribution;
  const groups = new Map<string, { readonly title: string; ids: string[]; labels: string[] }>();
  for (const earning of dataset.normalizedEarnings) {
    if (earning.isrc === null) {
      continue;
    }

    const label = `${earning.rawTitle ?? earning.isrc} · ${earning.rawArtist ?? earning.dsp}`;
    const existing = groups.get(earning.isrc);
    if (existing === undefined) {
      groups.set(earning.isrc, { title: earning.rawTitle ?? earning.isrc, ids: [earning.id], labels: [label] });
    } else {
      existing.ids.push(earning.id);
      existing.labels.push(label);
    }
  }

  return [...groups.entries()]
    .filter(([, group]) => group.ids.length > 1)
    .map(([isrc, group]) => ({
      id: isrc,
      label: group.title,
      kind: "normalized_earning_isrc",
      count: group.ids.length,
      sampleIds: group.ids.slice(0, distributionReconciliationSampleLimit),
      sampleLabels: group.labels.slice(0, distributionReconciliationSampleLimit)
    }));
}

function toDistributionAuditLog(store: ApiFixtureStore): readonly AuditLogEntry[] {
  // Distribution has no dedicated audit-log fixture; reuse the shared audit data when present
  // and filter to distribution-scoped entries, otherwise return a typed empty list.
  return store.officeAuditLog.filter((entry) => entry.action.startsWith("distribution."));
}

function toDistributionSettings(context: ApiContext, store: ApiFixtureStore, writesEnabled: boolean): DistributionSettingsResponse {
  const workspaceId = requireQuery(context, "workspaceId");
  const dataset = store.distribution;
  const currencies = [...new Set(dataset.payees.map((payee) => payee.preferredCurrency))].sort();
  return {
    workspaceId,
    namespace: "erh/v1",
    reads: "live",
    payeeCount: dataset.payees.length,
    contractCount: store.distributionContracts.length,
    currencies,
    fxRateCount: store.distributionFxRates.length,
    mutationsEnabled: writesEnabled
  };
}

function toCommandCenterNotifications(
  context: ApiContext,
  store: ApiFixtureStore,
  workspaceId: string,
  writesEnabled: boolean,
  generatedAt: string
): CommandCenterNotificationsResponse {
  const actor = context.get("authUser");
  const officePendingCount = store.office.transactions.filter(
    (transaction): boolean => transaction.categoryId === null || transaction.status === "draft"
  ).length;
  const openSuspenseCount = store.distribution.suspenseItems.filter((item): boolean => !item.resolved).length;
  const pendingStatementCount = store.distribution.statements.filter((statement): boolean => statement.status !== "void").length;
  const items: readonly CommandCenterNotification[] = [
    {
      id: "write-gate",
      title: writesEnabled ? "Writes enabled" : "Writes disabled",
      detail: writesEnabled ? "Mutation buttons are guarded by permissions, idempotency, and audit." : "Set WRITES_ENABLED=true on the API runtime to activate mutation buttons.",
      tone: writesEnabled ? "success" : "warning",
      workspaceId,
      createdAt: generatedAt,
      actionLabel: "Command Center",
      actionHref: "/console/command-center/integrations"
    },
    {
      id: "office-pending",
      title: "Office pending queue",
      detail: `${String(officePendingCount)} transaction${officePendingCount === 1 ? "" : "s"} awaiting classification or validation.`,
      tone: officePendingCount === 0 ? "success" : "warning",
      workspaceId,
      createdAt: generatedAt,
      actionLabel: "Open Office",
      actionHref: "/console/office/pending"
    },
    {
      id: "distribution-suspense",
      title: "Distribution suspense",
      detail: `${String(openSuspenseCount)} open suspense item${openSuspenseCount === 1 ? "" : "s"} in the royalty pipeline.`,
      tone: openSuspenseCount === 0 ? "success" : "warning",
      workspaceId,
      createdAt: generatedAt,
      actionLabel: "Open suspense",
      actionHref: "/console/distribution/suspense"
    },
    {
      id: "distribution-statements",
      title: "Statement queue",
      detail: `${String(pendingStatementCount)} active statement${pendingStatementCount === 1 ? "" : "s"} available for payment workflows.`,
      tone: pendingStatementCount === 0 ? "info" : "success",
      workspaceId,
      createdAt: generatedAt,
      actionLabel: "Open statements",
      actionHref: "/console/distribution/statements"
    },
    {
      id: "session",
      title: "Session verified",
      detail: `${actor.email} · ${actor.role}`,
      tone: "success",
      workspaceId,
      createdAt: generatedAt,
      actionLabel: null,
      actionHref: null
    }
  ];
  return {
    workspaceId,
    unreadCount: items.filter((item): boolean => item.tone === "warning" || item.tone === "error").length,
    generatedAt,
    items
  };
}

async function toCommandCenterOverview(
  context: ApiContext,
  store: ApiFixtureStore,
  persistence: ApiPersistenceRuntime,
  workspaceId: string,
  writesEnabled: boolean,
  generatedAt: string
): Promise<CommandCenterOverviewResponse> {
  const actor = context.get("authUser");
  const officePendingCount = store.office.transactions.filter(
    (transaction): boolean => transaction.categoryId === null || transaction.status === "draft"
  ).length;
  const openSuspenseCount = store.distribution.suspenseItems.filter((item): boolean => !item.resolved).length;
  const pendingStatementCount = store.distribution.statements.filter((statement): boolean => statement.status !== "void").length;

  const readiness: readonly CommandCenterReadinessItem[] = [
    {
      id: "write-gate",
      label: "Write gate",
      detail: writesEnabled ? "Writes enabled with idempotency and audit." : "Writes disabled at runtime.",
      tone: writesEnabled ? "success" : "warning"
    },
    {
      id: "office-queue",
      label: "Office queue",
      detail: `${String(officePendingCount)} transaction${officePendingCount === 1 ? "" : "s"} pending classification or validation.`,
      tone: officePendingCount === 0 ? "success" : "warning"
    },
    {
      id: "distribution-suspense",
      label: "Distribution suspense",
      detail: `${String(openSuspenseCount)} suspense item${openSuspenseCount === 1 ? "" : "s"} open.`,
      tone: openSuspenseCount === 0 ? "success" : "warning"
    },
    {
      id: "distribution-statements",
      label: "Statement queue",
      detail: `${String(pendingStatementCount)} statement${pendingStatementCount === 1 ? "" : "s"} available for payment workflows.`,
      tone: pendingStatementCount === 0 ? "info" : "success"
    },
    {
      id: "session",
      label: "Session",
      detail: `${actor.email} · ${actor.role}`,
      tone: "success"
    }
  ];

  const persistedOverview = await readCommandCenterOverviewPersistence(persistence, workspaceId);
  const defaultIntegrations = commandCenterDefaultIntegrations();
  const integrations: readonly CommandCenterOverviewIntegration[] = defaultIntegrations.map(
    (integration): CommandCenterOverviewIntegration => {
      const persisted = persistedOverview.integrationsById.get(integration.id) ?? null;
      const enabled = persisted === null ? integration.status !== "idle" : persisted.enabled;
      const status =
        persisted === null
          ? integration.status
          : toCommandCenterIntegrationStatus(persisted.status, persisted.enabled);
      return {
        ...integration,
        status,
        action: enabled ? "Manage" : "Enable"
      };
    }
  );

  const defaultSettings = commandCenterDefaultSettings();
  const settingsFromDefaults: readonly CommandCenterOverviewSetting[] = defaultSettings.map(
    (setting): CommandCenterOverviewSetting => {
      const persisted = persistedOverview.settingsByKey.get(setting.id) ?? null;
      if (persisted === null) {
        return setting;
      }

      return {
        id: setting.id,
        key: setting.key,
        value: commandCenterSettingValueLabel(setting.id, persisted.valueJson, setting.value),
        status: persisted.status,
        tone: commandCenterSettingTone(persisted.status)
      };
    }
  );

  const extraPersistedSettings: readonly CommandCenterOverviewSetting[] = persistedOverview.settings
    .filter((setting): boolean => !defaultSettings.some((candidate): boolean => candidate.id === setting.key))
    .map(
      (setting): CommandCenterOverviewSetting => ({
        id: setting.key,
        key: setting.key,
        value: commandCenterSettingValueLabel(setting.key, setting.valueJson, "-") ,
        status: setting.status,
        tone: commandCenterSettingTone(setting.status)
      })
    );

  const settings: readonly CommandCenterOverviewSetting[] = [...settingsFromDefaults, ...extraPersistedSettings];

  return {
    workspaceId,
    generatedAt,
    readiness,
    integrations,
    settings
  };
}

interface CommandCenterPersistedIntegrationState {
  readonly integrationId: string;
  readonly enabled: boolean;
  readonly status: string;
}

interface CommandCenterPersistedSettingState {
  readonly key: string;
  readonly valueJson: JsonRecord;
  readonly status: string;
}

interface CommandCenterPersistedOverview {
  readonly integrations: readonly CommandCenterPersistedIntegrationState[];
  readonly settings: readonly CommandCenterPersistedSettingState[];
  readonly integrationsById: ReadonlyMap<string, CommandCenterPersistedIntegrationState>;
  readonly settingsByKey: ReadonlyMap<string, CommandCenterPersistedSettingState>;
}

function commandCenterDefaultIntegrations(): readonly CommandCenterOverviewIntegration[] {
  return [
    {
      id: "supabase-runtime",
      connector: "Supabase runtime",
      kind: "Auth · Postgres · Hono",
      scope: "All workspaces",
      status: "connected",
      action: "Manage"
    },
    {
      id: "mcp",
      connector: "Project MCP",
      kind: "Scoped tools",
      scope: "ehq-platform only",
      status: "connected",
      action: "Inspect"
    },
    {
      id: "mcb",
      connector: "MCB statements",
      kind: "Bank connector",
      scope: "Office imports",
      status: "connected",
      action: "Manage"
    },
    {
      id: "sbi",
      connector: "SBI statements",
      kind: "Bank connector",
      scope: "Office imports",
      status: "connected",
      action: "Manage"
    }
  ];
}

function commandCenterDefaultSettings(): readonly CommandCenterOverviewSetting[] {
  return [
    {
      id: "theme",
      key: "Theme",
      value: "Dark command center",
      status: "Locked",
      tone: "active"
    },
    {
      id: "permissions",
      key: "Permissions source",
      value: "@ehq/auth",
      status: "Shared",
      tone: "success"
    },
    {
      id: "navigation",
      key: "Navigation scope",
      value: "Command Center only",
      status: "Enforced",
      tone: "success"
    },
    {
      id: "release",
      key: "Release gate",
      value: "Manual approval",
      status: "Required",
      tone: "warning"
    }
  ];
}

async function readCommandCenterOverviewPersistence(
  persistence: ApiPersistenceRuntime,
  workspaceId: string
): Promise<CommandCenterPersistedOverview> {
  const persisted = await persistence.withTx(
    async (tx: ApiWriteTransaction): Promise<{
      readonly integrations: readonly CommandCenterPersistedIntegrationState[];
      readonly settings: readonly CommandCenterPersistedSettingState[];
    }> => {
      if (tx.kind === "memory") {
        return {
          integrations: [],
          settings: []
        };
      }

      const integrationRows = queryRowsFromResult(await tx.executor.execute(sql`
        select integration_id, enabled, status
        from command_center_integration_states
        where workspace_id = ${workspaceId}
      `));
      const settingRows = queryRowsFromResult(await tx.executor.execute(sql`
        select key, value_json, status
        from command_center_settings
        where workspace_id = ${workspaceId}
      `));

      return {
        integrations: integrationRows.map(
          (row): CommandCenterPersistedIntegrationState => ({
            integrationId: stringQueryField(row, "integration_id"),
            enabled: booleanQueryField(row, "enabled"),
            status: stringQueryField(row, "status")
          })
        ),
        settings: settingRows.map(
          (row): CommandCenterPersistedSettingState => ({
            key: stringQueryField(row, "key"),
            valueJson: jsonRecordQueryField(row, "value_json"),
            status: stringQueryField(row, "status")
          })
        )
      };
    }
  );

  return {
    integrations: persisted.integrations,
    settings: persisted.settings,
    integrationsById: new Map(
      persisted.integrations.map((integration): readonly [string, CommandCenterPersistedIntegrationState] => [integration.integrationId, integration])
    ),
    settingsByKey: new Map(
      persisted.settings.map((setting): readonly [string, CommandCenterPersistedSettingState] => [setting.key, setting])
    )
  };
}

function toCommandCenterIntegrationStatus(
  status: string,
  enabled: boolean
): CommandCenterOverviewIntegration["status"] {
  const normalized = status.trim().toLowerCase();
  if (normalized === "attention" || normalized === "error") {
    return "attention";
  }

  if (!enabled || normalized === "idle" || normalized === "disabled") {
    return "idle";
  }

  return "connected";
}

function commandCenterSettingValueLabel(key: string, valueJson: JsonRecord, fallback: string): string {
  const namedValue = valueJson["name"];
  if (typeof namedValue === "string" && namedValue.trim().length > 0) {
    return namedValue.trim();
  }

  const rawValue = valueJson["value"];
  if (typeof rawValue === "string" && rawValue.trim().length > 0) {
    return rawValue.trim();
  }

  const jsonPreview = JSON.stringify(valueJson);
  if (jsonPreview === undefined || jsonPreview === "{}") {
    return fallback;
  }

  if (jsonPreview.length <= 60) {
    return jsonPreview;
  }

  return `${jsonPreview.slice(0, 57)}...`;
}

function commandCenterSettingTone(status: string): CommandCenterOverviewSetting["tone"] {
  const normalized = status.trim().toLowerCase();
  if (normalized === "locked") {
    return "active";
  }

  if (normalized === "required" || normalized === "pending" || normalized === "review") {
    return "warning";
  }

  if (
    normalized === "shared" ||
    normalized === "enforced" ||
    normalized === "reviewed" ||
    normalized === "enabled" ||
    normalized === "active"
  ) {
    return "success";
  }

  return "info";
}

function stringQueryField(row: JsonRecord | undefined, key: string): string {
  if (row === undefined) {
    return "";
  }

  const value = row[key];
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function booleanQueryField(row: JsonRecord | undefined, key: string): boolean {
  if (row === undefined) {
    return false;
  }

  const value = row[key];
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "t" || normalized === "1" || normalized === "yes";
  }

  return false;
}

function jsonRecordQueryField(row: JsonRecord | undefined, key: string): JsonRecord {
  if (row === undefined) {
    return {};
  }

  const value = row[key];
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as JsonRecord;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function balanceReference(payeeId: string, currency: string, balanceId: string | null): string | null {
  void payeeId;
  if (balanceId === null) {
    return null;
  }

  return `${currency} balance row`;
}

function formatPeriodLabel(start: string | null, end: string | null): string {
  if (start === null && end === null) {
    return "Unscoped";
  }

  if (start === null) {
    return `Until ${end ?? "unknown"}`;
  }

  if (end === null) {
    return `From ${start}`;
  }

  return `${start} to ${end}`;
}
