import { createRestTransport, encodePathSegment } from "./transport.js";
import type {
  AllocationRunPreviewRequest,
  AllocationRunQuery,
  AllocationRunStartRequest,
  AllocationRunSummary,
  AllocationRunUnpostRequest,
  ApiClientConfig,
  AuditLogEntry,
  AuditLogQuery,
  ApiMutationReceipt,
  ApiRunReceipt,
  DistributionContract,
  DistributionContractExpense,
  DistributionContractExpenseQuery,
  DistributionContractExpenseRecordRequest,
  DistributionContractsQuery,
  DistributionDashboardQuery,
  DistributionDashboardResponse,
  DistributionImportBatchesQuery,
  DistributionImportBatch,
  DistributionImportConfirmRequest,
  DistributionImportConfirmResponse,
  DistributionImportPreviewRequest,
  DistributionImportPreviewResponse,
  DistributionMappingApplyRulesRequest,
  DistributionMappingRow,
  DistributionMappingRowsQuery,
  DistributionAlias,
  DistributionDuplicate,
  DistributionReconciliationResponse,
  DistributionRevenueQuery,
  DistributionRevenueRow,
  DistributionSettingsResponse,
  DistributionWorkspacePageQuery,
  DistributionWorkspaceQuery,
  EntityId,
  PageResult,
  PayeeSummary,
  PayeesQuery,
  PaymentRecordRequest,
  PaymentReconcileRequest,
  PaymentSummary,
  PaymentsQuery,
  PaymentUpdateRequest,
  ReleaseSummary,
  ReleasesQuery,
  StatementGenerateRequest,
  StatementSummary,
  StatementsQuery,
  SuspenseItem,
  SuspenseQuery,
  SuspenseResolveRequest,
  TrackSummary,
  TracksQuery,
  WriteRequestOptions
} from "./types.js";

export interface DistributionApiClient {
  readonly getDashboard: (query: DistributionDashboardQuery) => Promise<DistributionDashboardResponse>;
  readonly listImportBatches: (query: DistributionImportBatchesQuery) => Promise<PageResult<DistributionImportBatch>>;
  readonly previewImport: (
    request: DistributionImportPreviewRequest,
    options: WriteRequestOptions
  ) => Promise<DistributionImportPreviewResponse>;
  readonly confirmImport: (
    request: DistributionImportConfirmRequest,
    options: WriteRequestOptions
  ) => Promise<DistributionImportConfirmResponse>;
  readonly listMappingRows: (query: DistributionMappingRowsQuery) => Promise<PageResult<DistributionMappingRow>>;
  readonly applyMappingRules: (
    request: DistributionMappingApplyRulesRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listContracts: (query: DistributionContractsQuery) => Promise<PageResult<DistributionContract>>;
  readonly listContractExpenses: (
    query: DistributionContractExpenseQuery
  ) => Promise<PageResult<DistributionContractExpense>>;
  readonly recordContractExpense: (
    request: DistributionContractExpenseRecordRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listPayees: (query: PayeesQuery) => Promise<PageResult<PayeeSummary>>;
  readonly listReleases: (query: ReleasesQuery) => Promise<PageResult<ReleaseSummary>>;
  readonly listTracks: (query: TracksQuery) => Promise<PageResult<TrackSummary>>;
  readonly listAllocationRuns: (query: AllocationRunQuery) => Promise<PageResult<AllocationRunSummary>>;
  readonly getAllocationRun: (workspaceId: EntityId, runId: EntityId) => Promise<AllocationRunSummary>;
  readonly previewAllocationRun: (
    request: AllocationRunPreviewRequest,
    options: WriteRequestOptions
  ) => Promise<ApiRunReceipt>;
  readonly startCadencedAllocationRun: (
    request: AllocationRunStartRequest,
    options: WriteRequestOptions
  ) => Promise<ApiRunReceipt>;
  readonly requestAllocationUnpostRun: (
    runId: EntityId,
    request: AllocationRunUnpostRequest,
    options: WriteRequestOptions
  ) => Promise<ApiRunReceipt>;
  readonly listSuspense: (query: SuspenseQuery) => Promise<PageResult<SuspenseItem>>;
  readonly resolveSuspense: (
    request: SuspenseResolveRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listStatements: (query: StatementsQuery) => Promise<PageResult<StatementSummary>>;
  readonly generateStatements: (
    request: StatementGenerateRequest,
    options: WriteRequestOptions
  ) => Promise<ApiRunReceipt>;
  readonly listPayments: (query: PaymentsQuery) => Promise<PageResult<PaymentSummary>>;
  readonly recordPayment: (request: PaymentRecordRequest, options: WriteRequestOptions) => Promise<ApiMutationReceipt>;
  readonly updatePayment: (
    paymentId: EntityId,
    request: PaymentUpdateRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly reconcilePayment: (
    paymentId: EntityId,
    request: PaymentReconcileRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly getRevenue: (query: DistributionRevenueQuery) => Promise<PageResult<DistributionRevenueRow>>;
  readonly getFinancialReconciliation: (
    query: DistributionWorkspaceQuery
  ) => Promise<DistributionReconciliationResponse>;
  readonly listAliases: (query: DistributionWorkspacePageQuery) => Promise<PageResult<DistributionAlias>>;
  readonly listDuplicates: (query: DistributionWorkspacePageQuery) => Promise<PageResult<DistributionDuplicate>>;
  readonly listAuditLog: (query: AuditLogQuery) => Promise<PageResult<AuditLogEntry>>;
  readonly getSettings: (query: DistributionWorkspaceQuery) => Promise<DistributionSettingsResponse>;
}

export function createDistributionApiClient(config: ApiClientConfig): DistributionApiClient {
  const transport = createRestTransport(config, "erh/v1");

  return {
    getDashboard: (query: DistributionDashboardQuery): Promise<DistributionDashboardResponse> =>
      transport.get<DistributionDashboardResponse>("dashboard", {
        workspaceId: query.workspaceId,
        period: query.period
      }),
    listImportBatches: (query: DistributionImportBatchesQuery): Promise<PageResult<DistributionImportBatch>> =>
      transport.get<PageResult<DistributionImportBatch>>("imports/batches", {
        workspaceId: query.workspaceId,
        source: query.source,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    previewImport: (
      request: DistributionImportPreviewRequest,
      options: WriteRequestOptions
    ): Promise<DistributionImportPreviewResponse> =>
      transport.post<DistributionImportPreviewResponse>("imports/preview", request, options.idempotencyKey),
    confirmImport: (
      request: DistributionImportConfirmRequest,
      options: WriteRequestOptions
    ): Promise<DistributionImportConfirmResponse> =>
      transport.post<DistributionImportConfirmResponse>("imports/confirm", request, options.idempotencyKey),
    listMappingRows: (query: DistributionMappingRowsQuery): Promise<PageResult<DistributionMappingRow>> =>
      transport.get<PageResult<DistributionMappingRow>>("mapping/rows", {
        workspaceId: query.workspaceId,
        batchId: query.batchId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    applyMappingRules: (
      request: DistributionMappingApplyRulesRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("mapping/apply-rules", request, options.idempotencyKey),
    listContracts: (query: DistributionContractsQuery): Promise<PageResult<DistributionContract>> =>
      transport.get<PageResult<DistributionContract>>("contracts", {
        workspaceId: query.workspaceId,
        payeeId: query.payeeId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    listContractExpenses: (
      query: DistributionContractExpenseQuery
    ): Promise<PageResult<DistributionContractExpense>> =>
      transport.get<PageResult<DistributionContractExpense>>(
        `contracts/${encodePathSegment(query.contractId)}/expenses`,
        {
          workspaceId: query.workspaceId,
          status: query.status,
          cursor: query.cursor,
          limit: query.limit
        }
      ),
    recordContractExpense: (
      request: DistributionContractExpenseRecordRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `contracts/${encodePathSegment(request.contractId)}/expenses`,
        request,
        options.idempotencyKey
      ),
    listPayees: (query: PayeesQuery): Promise<PageResult<PayeeSummary>> =>
      transport.get<PageResult<PayeeSummary>>("payees", {
        workspaceId: query.workspaceId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    listReleases: (query: ReleasesQuery): Promise<PageResult<ReleaseSummary>> =>
      transport.get<PageResult<ReleaseSummary>>("releases", {
        workspaceId: query.workspaceId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    listTracks: (query: TracksQuery): Promise<PageResult<TrackSummary>> =>
      transport.get<PageResult<TrackSummary>>("tracks", {
        workspaceId: query.workspaceId,
        releaseId: query.releaseId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    listAllocationRuns: (query: AllocationRunQuery): Promise<PageResult<AllocationRunSummary>> =>
      transport.get<PageResult<AllocationRunSummary>>("allocations/runs", {
        workspaceId: query.workspaceId,
        period: query.period,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    getAllocationRun: (workspaceId: EntityId, runId: EntityId): Promise<AllocationRunSummary> =>
      transport.get<AllocationRunSummary>(`allocations/runs/${encodePathSegment(runId)}`, {
        workspaceId
      }),
    previewAllocationRun: (
      request: AllocationRunPreviewRequest,
      options: WriteRequestOptions
    ): Promise<ApiRunReceipt> =>
      transport.post<ApiRunReceipt>("allocations/runs/preview", request, options.idempotencyKey),
    startCadencedAllocationRun: (
      request: AllocationRunStartRequest,
      options: WriteRequestOptions
    ): Promise<ApiRunReceipt> =>
      transport.post<ApiRunReceipt>("allocations/runs", request, options.idempotencyKey),
    requestAllocationUnpostRun: (
      runId: EntityId,
      request: AllocationRunUnpostRequest,
      options: WriteRequestOptions
    ): Promise<ApiRunReceipt> =>
      transport.post<ApiRunReceipt>(
        `allocations/runs/${encodePathSegment(runId)}/unpost`,
        request,
        options.idempotencyKey
      ),
    listSuspense: (query: SuspenseQuery): Promise<PageResult<SuspenseItem>> =>
      transport.get<PageResult<SuspenseItem>>("suspense", {
        workspaceId: query.workspaceId,
        period: query.period,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    resolveSuspense: (request: SuspenseResolveRequest, options: WriteRequestOptions): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `suspense/${encodePathSegment(request.suspenseId)}/resolve`,
        request,
        options.idempotencyKey
      ),
    listStatements: (query: StatementsQuery): Promise<PageResult<StatementSummary>> =>
      transport.get<PageResult<StatementSummary>>("statements", {
        workspaceId: query.workspaceId,
        period: query.period,
        payeeId: query.payeeId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    generateStatements: (request: StatementGenerateRequest, options: WriteRequestOptions): Promise<ApiRunReceipt> =>
      transport.post<ApiRunReceipt>("statements/generate", request, options.idempotencyKey),
    listPayments: (query: PaymentsQuery): Promise<PageResult<PaymentSummary>> =>
      transport.get<PageResult<PaymentSummary>>("payments", {
        workspaceId: query.workspaceId,
        period: query.period,
        payeeId: query.payeeId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    recordPayment: (request: PaymentRecordRequest, options: WriteRequestOptions): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("payments", request, options.idempotencyKey),
    updatePayment: (
      paymentId: EntityId,
      request: PaymentUpdateRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.patch<ApiMutationReceipt>(
        `payments/${encodePathSegment(paymentId)}`,
        request,
        options.idempotencyKey
      ),
    reconcilePayment: (
      paymentId: EntityId,
      request: PaymentReconcileRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `payments/${encodePathSegment(paymentId)}/reconcile`,
        request,
        options.idempotencyKey
      ),
    getRevenue: (query: DistributionRevenueQuery): Promise<PageResult<DistributionRevenueRow>> =>
      transport.get<PageResult<DistributionRevenueRow>>("revenue", {
        workspaceId: query.workspaceId,
        period: query.period,
        payeeId: query.payeeId,
        store: query.store,
        currency: query.currency,
        groupBy: query.groupBy,
        cursor: query.cursor,
        limit: query.limit
      }),
    getFinancialReconciliation: (
      query: DistributionWorkspaceQuery
    ): Promise<DistributionReconciliationResponse> =>
      transport.get<DistributionReconciliationResponse>("financial-reconciliation", {
        workspaceId: query.workspaceId
      }),
    listAliases: (query: DistributionWorkspacePageQuery): Promise<PageResult<DistributionAlias>> =>
      transport.get<PageResult<DistributionAlias>>("aliases", {
        workspaceId: query.workspaceId,
        cursor: query.cursor,
        limit: query.limit
      }),
    listDuplicates: (query: DistributionWorkspacePageQuery): Promise<PageResult<DistributionDuplicate>> =>
      transport.get<PageResult<DistributionDuplicate>>("duplicates", {
        workspaceId: query.workspaceId,
        cursor: query.cursor,
        limit: query.limit
      }),
    listAuditLog: (query: AuditLogQuery): Promise<PageResult<AuditLogEntry>> =>
      transport.get<PageResult<AuditLogEntry>>("audit-log", {
        workspaceId: query.workspaceId,
        from: query.from,
        to: query.to,
        actorId: query.actorId,
        entityType: query.entityType,
        cursor: query.cursor,
        limit: query.limit
      }),
    getSettings: (query: DistributionWorkspaceQuery): Promise<DistributionSettingsResponse> =>
      transport.get<DistributionSettingsResponse>("settings", {
        workspaceId: query.workspaceId
      })
  };
}
