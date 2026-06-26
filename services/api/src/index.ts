import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { eofMoney, erhMoney, format as formatScaledUnits, parse as parseScaledUnits } from "@ehq/domain-finance";
import {
  buildAllocationPlan,
  computeStatementBalance,
  computeStatementGroupTotals,
  buildStatementPlan,
  buildVoidPlan,
  readAllocationList,
  readEarningsPreview,
  readStatementSummaries,
  readSuspense,
  type CostTermStatusUpdate,
  type DistributionAllocationReadRow,
  type DistributionAllocationOutcome,
  type DistributionAllocationPlan,
  type DistributionCalculationRunRow,
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
  type StatementInsertPlan,
  type StatementLineInsertPlan,
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
  BankImportConfirmRequest,
  BankImportConfirmResponse,
  BankImportPreviewRequest,
  BankImportPreviewResponse,
  CashflowBucket,
  CurrencyCode,
  DistributionContract,
  DistributionContractExpense,
  DistributionDashboardResponse,
  DistributionImportBatch,
  DistributionImportConfirmRequest,
  DistributionImportConfirmResponse,
  DistributionImportPreviewRequest,
  DistributionImportPreviewResponse,
  DistributionMappingApplyRulesRequest,
  DistributionMappingRow,
  DistributionRevenueRow,
  EntityId,
  OfficeBankQualityResponse,
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
  OfficePartnerSideActivity,
  OfficePlanComptableNode,
  OfficePnlProjectionRow,
  OfficeProjectCoherenceViolation,
  OfficeProjectPnl,
  OfficeProjectPnlLine,
  OfficeProjectSummary,
  OfficeReconciliationCandidate,
  OfficeTransaction,
  OfficeTransactionStatus,
  PageResult,
  PaymentRecordRequest,
  PaymentReconcileRequest,
  PaymentSummary,
  PaymentUpdateRequest,
  ReleaseSummary,
  StatementGenerateRequest,
  StatementSummary,
  SuspenseItem,
  TrackSummary
} from "@ehq/api-client";
import {
  createSupabaseAuthMiddleware,
  type ApiAuthBindings,
  type AuthenticatedApiUser,
  type SupabaseJwtVerifier
} from "./auth.js";
import { createFixtureStore, type ApiDistributionRoyaltyRuleInput, type ApiFixtureStore } from "./fixtures.js";
import {
  appendAuditEvent,
  acquireAdvisoryLock,
  createMemoryPersistenceRuntime,
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
  persistDistributionRoyaltyRules,
  persistDistributionStatements,
  persistDistributionStatementVoid,
  persistIdentityLink,
  persistOfficeBankImportConfirmation,
  requirePermission,
  runDisabledMutation,
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
  readonly paymentStatus: "recorded" | "edited" | "reconciled";
  readonly statementBalance: StatementBalanceResult;
  readonly groupTotals: readonly StatementGroupTotal[];
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
  readonly status: 400 | 404 | 409 | 422 | 500;
  readonly code: string;
  readonly context: readonly string[];

  constructor(status: 400 | 404 | 409 | 422 | 500, code: string, message: string, context: readonly string[]) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
    this.code = code;
    this.context = context;
  }
}

export function createApiService(dependencies: ApiServiceDependencies): Hono<ApiAuthBindings> {
  const app = new Hono<ApiAuthBindings>();
  app.use(
    "*",
    cors({
      origin: [
        "https://app.eeee.mu",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
      ],
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
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
      role: authUser.role
    });
  });
  app.use("/eof/v1/*", async (context, next) => {
    if (context.req.method === "OPTIONS") {
      await next();
      return;
    }

    return authMiddleware(context, next);
  });
  app.use("/erh/v1/*", async (context, next) => {
    if (context.req.method === "OPTIONS") {
      await next();
      return;
    }

    return authMiddleware(context, next);
  });

  registerOfficeRoutes(app, dependencies);
  registerDistributionRoutes(app, dependencies);

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
        role: "administrator"
      };
    }
  };
}

function registerOfficeRoutes(app: Hono<ApiAuthBindings>, dependencies: ApiServiceDependencies): void {
  app.get("/eof/v1/dashboard", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    const workspaceId = resolveWorkspaceId(context);
    const filters = filtersForPeriod(period, null);
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

  app.get("/eof/v1/pl/global", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const response = toOfficeGlobalPnl(dependencies.fixtures.office, period);
    return context.json(response);
  });

  app.get("/eof/v1/pl/department/:departmentId", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const departmentId = context.req.param("departmentId");
    const response = toOfficeDepartmentPnl(dependencies.fixtures.office, departmentId, period);
    return context.json(response);
  });

  app.get("/eof/v1/pl/division", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const divisions = readPnlByDivision(dependencies.fixtures.office, filtersForPeriod(period, null)).map(toApiDivisionPnl);
    return context.json(pageItems(context, divisions));
  });

  app.get("/eof/v1/transactions", (context) => {
    resolveWorkspaceId(context);
    const transactions = dependencies.fixtures.office.transactions
      .map((transaction) => toOfficeTransaction(dependencies.fixtures.office, transaction))
      .filter((transaction) => matchesOfficeTransactionQuery(context, transaction));
    return context.json(pageItems(context, transactions));
  });

  app.post("/eof/v1/transactions", async (context) => {
    return disabledWriteResponse(context, dependencies, "office_transaction_create");
  });

  app.patch("/eof/v1/transactions/:transactionId", async (context) => {
    return disabledWriteResponse(context, dependencies, "office_transaction_update");
  });

  app.get("/eof/v1/plan-comptable", (context) => {
    resolveWorkspaceId(context);
    const includeInactive = queryBoolean(context, "includeInactive", "include_inactive");
    return context.json(toPlanComptableNodes(dependencies.fixtures.office, includeInactive));
  });

  app.post("/eof/v1/plan-comptable", async (context) => {
    return disabledWriteResponse(context, dependencies, "office_plan_comptable_create");
  });

  app.patch("/eof/v1/plan-comptable/:nodeId", async (context) => {
    return disabledWriteResponse(context, dependencies, "office_plan_comptable_update");
  });

  app.post("/eof/v1/bank-import/preview", async (context) => {
    return officeBankImportPreviewResponse(context, dependencies);
  });

  app.post("/eof/v1/bank-import/confirm", async (context) => {
    return officeBankImportConfirmResponse(context, dependencies);
  });

  app.post("/eof/v1/bank-import/batches/:batchId/reverse", async (context) => {
    return officeBankImportReverseResponse(context, dependencies);
  });

  app.get("/eof/v1/reconciliations", (context) => {
    resolveWorkspaceId(context);
    return context.json(pageItems(context, toReconciliationCandidates(dependencies.fixtures.office).filter((candidate) => matchesReconciliationQuery(context, candidate))));
  });

  app.post("/eof/v1/reconciliations/approve", async (context) => {
    return disabledWriteResponse(context, dependencies, "office_reconciliation_approve");
  });

  app.get("/eof/v1/cashflow", (context) => {
    const from = requireCompatQuery(context, ["from", "fromDate"], "from");
    const to = requireCompatQuery(context, ["to", "toDate"], "to");
    resolveWorkspaceId(context);
    const accountId = nullableQuery(context, "accountId");
    const buckets = readOfficeCashflowProjection(dependencies.fixtures.office, from, to, accountId);
    return context.json(toCashflowBuckets(buckets));
  });

  app.get("/eof/v1/audit-log", (context) => {
    resolveWorkspaceId(context);
    return context.json(pageItems(context, dependencies.fixtures.officeAuditLog.filter((entry) => matchesAuditQuery(context, entry))));
  });

  app.get("/eof/v1/partners", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    const facet = requirePartnerFacet(context);
    resolveWorkspaceId(context);
    const partners = dependencies.fixtures.office.partners
      .map((partner) => toPartnerListItem(dependencies.fixtures, partner, period))
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
    const response = toPartnerDetail(dependencies.fixtures, partner, period);
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
    return disabledWriteResponse(context, dependencies, "office_partner_create");
  });

  app.patch("/eof/v1/partners/:partnerId", async (context) => {
    return disabledWriteResponse(context, dependencies, "office_partner_update");
  });

  app.post("/eof/v1/partners/:partnerId/payee-link", async (context) => {
    return officePartnerPayeeLinkResponse(context, dependencies);
  });

  app.patch("/eof/v1/partners/:partnerId/payee-link", async (context) => {
    return disabledWriteResponse(context, dependencies, "office_partner_payee_unlink");
  });

  app.get("/eof/v1/bank/accounts", (context) => {
    const workspaceId = resolveWorkspaceId(context);
    const limit = requirePositiveInteger(context, optionalCompatQuery(context, ["limit"]), "limit");
    const accounts = dependencies.fixtures.office.bankAccounts
      .filter((account) => account.workspaceId === workspaceId)
      .map((account) => toApiBankAccountSummary(account));
    const page = pageItems(context, accounts);
    return context.json(page);
  });

  app.get("/eof/v1/bank/raw", (context) => {
    const workspaceId = resolveWorkspaceId(context);
    const period = optionalCompatQuery(context, ["period", "month"]);
    const accountId = optionalCompatQuery(context, ["accountId", "account_id"]);
    const batches = buildBatchWorkspaceLookup(dependencies.fixtures.office.bankImportBatches);
    const lines = dependencies.fixtures.office.bankStatementLines
      .map((line) => toApiBankRawLine(line, batches))
      .filter((line) => line.workspaceId === workspaceId)
      .filter((line) => period === null || line.occurredOn.startsWith(period))
      .filter((line) => accountId === null || line.accountId === accountId);
    return context.json(pageItems(context, lines));
  });

  app.get("/eof/v1/projects", (context) => {
    resolveWorkspaceId(context);
    const status = nullableQuery(context, "status");
    const projects = dependencies.fixtures.office.projects
      .map((project) => toProjectSummary(dependencies.fixtures.office, project, "2026-02"))
      .filter((project) => status === null || project.status === status);
    return context.json(pageItems(context, projects));
  });

  app.get("/eof/v1/projects/:projectId/coherence-violations", (context) => {
    resolveWorkspaceId(context);
    const violations = dependencies.fixtures.officeProjectViolations[context.req.param("projectId")] ?? [];
    return context.json(pageItems(context, violations));
  });

  app.get("/eof/v1/pl/project/:projectId", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    return context.json(toProjectPnl(dependencies.fixtures.office, context.req.param("projectId"), period));
  });

  app.get("/eof/v1/integrity/check-all", (context) => {
    resolveWorkspaceId(context);
    return context.json(toOfficeIntegrity(dependencies.fixtures.office, dependencies.nowIso()));
  });

  app.get("/eof/v1/analytics/bank-quality", (context) => {
    const period = requireCompatQuery(context, ["period", "month"], "period");
    resolveWorkspaceId(context);
    const result = readOfficeBankQuality(dependencies.fixtures.office, period);
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
}

function filterRunwayWindowMonths(
  monthlyRows: readonly OfficePnlMonthlyRow[],
  runwayWindowMonths: readonly string[]
): readonly string[] {
  const availableMonths = new Set<string>(monthlyRows.map((row) => row.month));
  return runwayWindowMonths.filter((month) => availableMonths.has(month));
}

function registerDistributionRoutes(app: Hono<ApiAuthBindings>, dependencies: ApiServiceDependencies): void {
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
    return disabledWriteResponse(context, dependencies, "distribution_mapping_apply_rules");
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
    return disabledWriteResponse(context, dependencies, "distribution_contract_expense_create");
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

  app.get("/erh/v1/releases", (context) => {
    requireQuery(context, "workspaceId");
    const releases = toReleaseSummaries(dependencies.fixtures.distribution);
    return context.json(pageItems(context, releases));
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

  app.get("/erh/v1/allocations/runs/:runId", (context) => {
    requireQuery(context, "workspaceId");
    const runId = context.req.param("runId");
    const run = dependencies.fixtures.distribution.calculationRuns.find((candidate) => candidate.id === runId);
    if (run === undefined) {
      throw new ApiRouteError(404, "allocation_run_not_found", "Allocation run fixture was not found.", [`runId=${runId}`]);
    }

    return context.json(toAllocationRunSummary(dependencies.fixtures.distribution, run));
  });

  app.post("/erh/v1/allocations/runs/preview", async (context) => {
    return distributionAllocationPreviewResponse(context, dependencies);
  });

  app.post("/erh/v1/allocations/runs", async (context) => {
    return distributionAllocationRunResponse(context, dependencies);
  });

  app.post("/erh/v1/allocations/runs/:runId/unpost", async (context) => {
    return disabledWriteResponse(context, dependencies, "distribution_allocations_unpost");
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
    return disabledWriteResponse(context, dependencies, "distribution_suspense_resolve");
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
  return optionalCompatQuery(context, ["workspaceId", "workspace_id"]) ?? DEFAULT_WORKSPACE_ID;
}

function requirePositiveInteger(context: ApiContext, value: string | null, key: string): number {
  if (value === null) {
    throw new ApiRouteError(400, "query_integer_invalid", "Query integer parameter is required.", [
      `path=${context.req.path}`,
      `key=${key}`
    ]);
  }

  return parsePositiveInteger(value, key);
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

async function distributionAllocationPreviewResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  requirePermission(context.get("authUser"), "distribution_allocations_preview");
  const request = await readJsonBody<AllocationRunPreviewRequest>(context);
  assertAllocationRunPreviewRequest(context, request);
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
      await acquireAdvisoryLock(tx, `distribution:statement:void:${statementId}`);
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
      const statement = requireDistributionStatement(dependencies.fixtures.distribution, request.statementId);
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
      const statement = requireDistributionStatement(dependencies.fixtures.distribution, link.statementId);
      assertPaymentIsMutable(context, payment);
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
      const statement = requireDistributionStatement(dependencies.fixtures.distribution, link.statementId);
      assertPaymentIsMutable(context, payment);
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
  requirePermission(context.get("authUser"), "distribution_import_preview");
  const request = await readJsonBody<DistributionImportPreviewRequest>(context);
  assertDistributionImportPreviewRequest(context, request);
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
  dependencies.persistence.storeDistributionImportPreview(preview);
  const currencyCodes = currencyCodesFromRows(request.rows, request.source === "kontor" ? "EUR" : "USD");
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
      const preview = requireDistributionPreview(context, dependencies, request.previewId, request.workspaceId);
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

async function officeBankImportPreviewResponse(context: ApiContext, dependencies: ApiServiceDependencies): Promise<Response> {
  requirePermission(context.get("authUser"), "office_bank_import_preview");
  const request = await readJsonBody<BankImportPreviewRequest>(context);
  assertOfficeBankImportPreviewRequest(context, request);
  const previewRows = previewRowsFromRecords(request.rows);
  const parsedRows = previewRows
    .map((row: ApiImportPreviewRow): ParsedOfficeBankPreviewRow => parseOfficeBankPreviewRow(row, request.workspaceId, dependencies.fixtures.office.bankAccounts))
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
  dependencies.persistence.storeOfficeBankImportPreview(preview);
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
    warnings: parsedRows.length === previewRows.length
      ? []
      : ["Some rows could not be converted into bank statement lines and will remain in batch metadata instead of being fabricated."]
  };
  return context.json(response);
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
      const preview = requireOfficeBankPreview(context, dependencies, request.previewId, request.workspaceId);
      const acceptedRowIds = new Set<string>(request.acceptedRowIds);
      const parsedRows = preview.rows
        .filter((row: ApiImportPreviewRow): boolean => acceptedRowIds.has(row.id))
        .map((row: ApiImportPreviewRow): ParsedOfficeBankPreviewRow => parseOfficeBankPreviewRow(row, request.workspaceId, dependencies.fixtures.office.bankAccounts));
      const lines = parsedRows
        .map((row: ParsedOfficeBankPreviewRow): OfficeBankStatementLineInsert | null => row.line)
        .filter((line: OfficeBankStatementLineInsert | null): line is OfficeBankStatementLineInsert => line !== null);
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
  if (batch?.importedAt === null || batch?.importedAt === undefined) {
    return true;
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

function currencyCodesFromRows(rows: readonly Readonly<Record<string, string>>[], fallback: string): readonly CurrencyCode[] {
  const codes = uniqueStrings(
    rows
      .map((row: Readonly<Record<string, string>>): string | null => normalizedCurrency(rowValue(row, ["currency", "currency_code", "Currency", "CURRENCY"])))
      .filter((currency: string | null): currency is string => currency !== null)
  );
  return codes.length === 0 ? [fallback] : codes;
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

function parseOfficeBankPreviewRow(
  row: ApiImportPreviewRow,
  workspaceId: string,
  accounts: readonly OfficeBankAccountRow[]
): ParsedOfficeBankPreviewRow {
  const currency = normalizedCurrency(rowValue(row.rawData, ["currency", "currency_code", "Currency", "CURRENCY"])) ?? "MUR";
  const account = accountForRow(row.rawData, workspaceId, currency, accounts);
  const occurredOn = isoDateValue(row.rawData, ["occurredOn", "occurred_on", "transactionDate", "transaction_date", "date", "DATE", "Date", "paid_on", "paidOn"]);
  const description = rowValue(row.rawData, ["description", "label", "particulars", "details", "narrative", "memo"]);
  const amount = amountForBankRow(row.rawData);
  const issues = [
    ...(account === null ? ["account_not_found"] : []),
    ...(occurredOn === null ? ["occurred_on_missing"] : []),
    ...(description === null ? ["description_missing"] : []),
    ...(amount === null ? ["amount_missing_or_invalid"] : []),
    ...(amount !== null && amount.currency !== "MUR" && amount.amountMurMinor === null ? ["amount_mur_missing_for_foreign_currency"] : [])
  ];

  if (issues.length > 0 || account === null || occurredOn === null || description === null || amount === null || amount.amountMurMinor === null) {
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
      amountMurMinor: amount.amountMurMinor,
      balanceMurMinor: moneyValue(row.rawData, ["balanceMur", "balance_mur", "balanceMurMinor", "balance_mur_minor"]),
      isDuplicateCandidate: false,
      rawData: row.rawData
    },
    issues: []
  };
}

function accountForRow(
  row: Readonly<Record<string, string>>,
  workspaceId: string,
  currency: string,
  accounts: readonly OfficeBankAccountRow[]
): OfficeBankAccountRow | null {
  const accountId = rowValue(row, ["accountId", "account_id"]);
  if (accountId !== null) {
    return accounts.find((account: OfficeBankAccountRow): boolean => account.id === accountId && account.workspaceId === workspaceId) ?? null;
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
  const amount = moneyValue(row, ["amount", "Amount", "amountMinor", "amount_minor", "amountMicro", "amount_micro", "amount_mur", "AMOUNT MUR"]);
  const signedAmount = signedMoneyValue(row, ["signedAmount", "signed_amount", "net", "Net"]);

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

  if (signedAmount !== null) {
    return {
      amountMinor: absBigInt(signedAmount),
      amountMurMinor: currency === "MUR" ? absBigInt(signedAmount) : moneyValue(row, ["amountMur", "amount_mur", "amountMurMinor", "amount_mur_minor"]),
      currency,
      direction: signedAmount < 0n ? "debit" : "credit"
    };
  }

  if (amount === null) {
    return null;
  }

  const direction = directionValue(row) ?? "credit";
  return {
    amountMinor: absBigInt(amount),
    amountMurMinor: currency === "MUR" ? absBigInt(amount) : moneyValue(row, ["amountMur", "amount_mur", "amountMurMinor", "amount_mur_minor"]),
    currency,
    direction
  };
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
  const trimmed = value.trim().replaceAll(",", "");
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return `-${trimmed.slice(1, -1)}`;
  }

  return trimmed;
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

function requireDistributionPreview(
  context: ApiContext,
  dependencies: ApiServiceDependencies,
  previewId: string,
  workspaceId: string
): DistributionImportPreviewRecord {
  const preview = dependencies.persistence.getDistributionImportPreview(previewId);
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

function requireOfficeBankPreview(
  context: ApiContext,
  dependencies: ApiServiceDependencies,
  previewId: string,
  workspaceId: string
): OfficeBankImportPreviewRecord {
  const preview = dependencies.persistence.getOfficeBankImportPreview(previewId);
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
  paymentStatus: "recorded" | "edited" | "reconciled",
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
      currency: application.currency
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
      idempotencyKey: null,
      context: {}
    },
    ...fixtures.officeAuditLog
  ];
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

function buildBatchWorkspaceLookup(
  batches: readonly OfficeBankImportBatchRow[]
): ReadonlyMap<string, string> {
  const lookup = new Map<string, string>();
  for (const batch of batches) {
    lookup.set(batch.id, batch.workspaceId);
  }

  return lookup;
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

async function disabledWriteResponse(context: ApiContext, dependencies: ApiServiceDependencies, action: string): Promise<Response> {
  const idempotencyKey = requireIdempotencyKey(context);
  const requestBody = await readRequestText(context);
  const result = await runDisabledMutation({
    runtime: dependencies.persistence,
    actor: context.get("authUser"),
    action,
    route: context.req.path,
    idempotencyKey,
    requestBody
  });
  return context.json(result.body, result.status);
}

function equalNames(left: string, right: string): boolean {
  const normalizedLeft = left.trim().toLowerCase();
  const normalizedRight = right.trim().toLowerCase();
  return normalizedLeft === normalizedRight;
}

function filtersForPeriod(period: string, departmentId: string | null): OfficePnlFilters {
  return {
    dateFrom: `${period}-01`,
    dateTo: `${period}-31`,
    departmentId
  };
}

function toOfficeGlobalPnl(dataset: OfficeAnalyticsDataset, period: string): OfficeGlobalPnl {
  const filters = filtersForPeriod(period, null);
  const pnl = readGlobalPnl(dataset, filters);
  return {
    scope: "global",
    completeness: "complete",
    period,
    incomeMicro: pnl.income,
    expenseMicro: pnl.expense,
    netMicro: pnl.profit,
    validatedProjectionId: `projection_global_${period}`,
    projectionRows: toProjectionRows(readPnlByDepartment(dataset, filters), period),
    lines: readPnlByCategory(dataset, filters).map((row) => ({
      id: row.category_id,
      label: `${row.department_name} · ${row.division_name} · ${row.category_name}`,
      incomeMicro: row.income,
      expenseMicro: row.expense,
      netMicro: row.profit
    }))
  };
}

function toOfficeDepartmentPnl(dataset: OfficeAnalyticsDataset, departmentId: string, period: string): OfficeDepartmentPnl {
  const filters = filtersForPeriod(period, departmentId);
  const pnl = readDepartmentPnl(dataset, departmentId, filters);
  const categoryRows = readPnlByCategory(dataset, filters).filter((row) => row.department_id === departmentId);
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
    lines: categoryRows.map((row) => ({
      id: row.category_id,
      label: `${row.division_name} · ${row.category_name}`,
      incomeMicro: row.income,
      expenseMicro: row.expense,
      netMicro: row.profit
    }))
  };
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
    accountId: "bank_mur",
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
      type: categoryPath?.category.type ?? null
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
    type: categoryPath.category.type
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

function resolveCategoryPath(
  dataset: OfficeAnalyticsDataset,
  categoryId: string
): Readonly<{ readonly category: OfficeCategoryRow; readonly division: OfficeDivisionRow | null; readonly department: OfficeDepartmentRow | null }> {
  const category = dataset.categories.find((candidate) => candidate.id === categoryId);
  if (category === undefined) {
    throw new ApiRouteError(500, "category_not_found", "Transaction category was not found in the chart of accounts.", [
      `categoryId=${categoryId}`
    ]);
  }

  if (category.divisionId === null) {
    return { category, division: null, department: null };
  }

  const division = dataset.divisions.find((candidate) => candidate.id === category.divisionId);
  if (division === undefined) {
    throw new ApiRouteError(500, "division_not_found", "Category division was not found in the chart of accounts.", [
      `categoryId=${categoryId}`,
      `divisionId=${category.divisionId}`
    ]);
  }

  const department = dataset.departments.find((candidate) => candidate.id === division.departmentId);
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
  const departmentId = nullableQuery(context, "departmentId");
  const divisionId = nullableQuery(context, "divisionId");
  const categoryId = nullableQuery(context, "categoryId");
  const projectId = nullableQuery(context, "projectId");
  const type = nullableQuery(context, "type");
  const status = nullableQuery(context, "status");
  if (period !== null && !transaction.occurredOn.startsWith(period)) {
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
      bankDescription: line.reference ?? line.id,
      ledgerDescription: transaction?.description ?? "Unmatched ledger line",
      amountMicro: eofMoney.format(line.amountMurMinor),
      confidenceBp: match?.confidenceBp ?? (line.reconciliationStatus === "matched" ? 10000 : 0),
      status: toApiReconciliationStatus(line)
    };
  });
}

function toApiReconciliationStatus(line: OfficeBankStatementLineRow): OfficeReconciliationCandidate["status"] {
  if (line.reconciliationStatus === "matched") {
    return "matched";
  }

  if (line.reconciliationStatus === "suggested") {
    return "suggested";
  }

  return "unmatched";
}

function matchesReconciliationQuery(context: ApiContext, candidate: OfficeReconciliationCandidate): boolean {
  const period = nullableQuery(context, "period");
  const status = nullableQuery(context, "status");
  if (period !== null && !candidate.occurredOn.startsWith(period)) {
    return false;
  }

  return !(status !== null && candidate.status !== status);
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

function toPartnerListItem(fixtures: ApiFixtureStore, partner: OfficePartnerRow, period: string): OfficePartnerListItem {
  return {
    id: partner.id,
    name: partner.name,
    status: partner.isActive ? "active" : "inactive",
    activity: toPartnerActivity(fixtures.office, partner.id, period),
    distributionPayeeLink: toPartnerPayeeLink(fixtures, partner)
  };
}

function toPartnerDetail(
  fixtures: ApiFixtureStore,
  partner: OfficePartnerRow,
  period: string
): OfficePartnerDetail & Pick<OfficePartnerPnl, "completeness" | "period"> {
  readPartnerPnl(fixtures.office, partner.id, filtersForPeriod(period, null));
  return {
    ...toPartnerListItem(fixtures, partner, period),
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

function toPartnerActivity(dataset: OfficeAnalyticsDataset, partnerId: string, period: string): OfficePartnerActivity {
  const units = partnerActivityUnits(dataset, partnerId, period);
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

function partnerActivityUnits(dataset: OfficeAnalyticsDataset, partnerId: string, period: string): PartnerActivityUnits {
  let incomeUnits = 0n;
  let expenseUnits = 0n;
  let incomeCount = 0;
  let expenseCount = 0;
  let incomeLastActivityOn: string | null = null;
  let expenseLastActivityOn: string | null = null;
  for (const transaction of dataset.transactions) {
    if (transaction.partnerId !== partnerId || !transaction.transactionDate.startsWith(period) || !transaction.isActive) {
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

function toProjectSummary(dataset: OfficeAnalyticsDataset, project: OfficeProjectRow, period: string): OfficeProjectSummary {
  const pnl = readProjectPnl(dataset, project.id, filtersForPeriod(period, null));
  return {
    id: project.id,
    code: project.id,
    label: project.name,
    status: project.status === "archived" ? "archived" : "active",
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

function toProjectPnl(dataset: OfficeAnalyticsDataset, projectId: string, period: string): OfficeProjectPnl {
  const pnl = readProjectPnl(dataset, projectId, filtersForPeriod(period, null));
  const lines = projectPnlLines(dataset, projectId, period);
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

function projectPnlLines(dataset: OfficeAnalyticsDataset, projectId: string, period: string): readonly OfficeProjectPnlLine[] {
  const categoryRows = new Map<string, { readonly category: OfficePnlCategoryRow; readonly transactionCount: number; readonly amountUnits: bigint }>();
  for (const transaction of dataset.transactions) {
    if (transaction.projectId !== projectId || !transaction.transactionDate.startsWith(period) || transaction.categoryId === null) {
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
  const project = dataset.projects.find((candidate) => candidate.id === projectId);
  if (project === undefined) {
    throw new ApiRouteError(404, "project_not_found", "Office project fixture was not found.", [`projectId=${projectId}`]);
  }

  return project;
}

function requireDepartment(dataset: OfficeAnalyticsDataset, departmentId: string): OfficeDepartmentRow {
  const department = dataset.departments.find((candidate) => candidate.id === departmentId);
  if (department === undefined) {
    throw new ApiRouteError(404, "department_not_found", "Office department fixture was not found.", [`departmentId=${departmentId}`]);
  }

  return department;
}

function toDistributionDashboard(dataset: DistributionReadDataset, period: string): DistributionDashboardResponse {
  const allocations = readAllocationList(dataset, { calculationRunId: null, payeeId: null, status: "posted" });
  const total = allocations.totals[0];
  const suspense = readSuspense(dataset, { status: "open", reasonCode: null });
  const statements = readStatementSummaries(dataset, { period, payeeId: null, status: null });
  return {
    period,
    grossRoyaltyMicro: total?.grossShare ?? "0.0000000000",
    recoupedMicro: total?.recoupmentApplied ?? "0.0000000000",
    netPayableMicro: total?.netPayable ?? "0.0000000000",
    suspenseCount: suspense.rows.length,
    openStatementCount: statements.rows.filter((statement) => statement.status !== "paid" && statement.status !== "void").length,
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
  const grossUnits = rows.reduce((sum: bigint, row) => erhMoney.add(sum, erhMoney.parse(row.grossAmount)), 0n);
  return {
    id: batch.id,
    source: batch.source === "routenote" ? "routenote" : "kontor",
    fileName: batch.fileName,
    period: "2026-04",
    statementReference: batch.id,
    accountReference: batch.source,
    rowCount: rows.length,
    unmatchedRowCount: rows.filter((row) => row.mappingStatus !== "matched").length,
    currency: rows[0]?.currency ?? "USD",
    grossMicro: erhMoney.format(grossUnits),
    payableColumn: "netPayable",
    joinKeySummary: "ISRC / UPC / title / artist",
    status: toApiImportStatus(batch.status),
    nextAction: rows.some((row) => row.mappingStatus !== "matched") ? "review_mapping" : "validate",
    importedAt: batch.importedAt ?? "2026-04-30T10:00:00.000Z"
  };
}

function toApiImportStatus(status: string): DistributionImportBatch["status"] {
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
  return {
    id: run.id,
    period: "2026-04",
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
    expenseMicro: row.recoupmentTotal,
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

function createMutationReceipt(entityId: string, idempotencyKey: string): ApiMutationReceipt {
  const sanitized = sanitizeId(idempotencyKey);
  return {
    id: entityId,
    status: "accepted",
    auditEventId: `audit_${sanitized}`
  };
}

function createRunReceipt(runId: string, status: ApiRunReceipt["status"], lockKey: string, idempotencyKey: string): ApiRunReceipt {
  return {
    runId,
    status,
    lockKey,
    auditEventId: `audit_${sanitizeId(idempotencyKey)}`
  };
}

function sanitizeId(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_:-]/g, "_");
  return sanitized.length === 0 ? "empty" : sanitized;
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
