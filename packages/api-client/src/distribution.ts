import { createRestTransport, encodePathSegment } from "./transport.js";
import type {
  DistributionAllocationQuery,
  DistributionAllocationRow,
  DistributionAllocationTotal,
  AllocationRunPreviewRequest,
  AllocationRunQuery,
  AllocationRunStartRequest,
  AllocationRunSummary,
  AllocationRunUnpostRequest,
  DistributionAllocationRetryMissingContractsRequest,
  DistributionAllocationRetryReceipt,
  DistributionAllocationWorkbenchQuery,
  DistributionAllocationWorkbenchResponse,
  ApiClientConfig,
  AuditLogEntry,
  AuditLogQuery,
  ApiMutationReceipt,
  ApiRunReceipt,
  ContractRoyaltyRulesUpdateRequest,
  DistributionContract,
  DistributionContractExpense,
  DistributionContractExpenseQuery,
  DistributionContractExpenseRecordRequest,
  DistributionContractsQuery,
  DistributionContractUpsertRequest,
  DistributionCatalogContributorOverrideRequest,
  DistributionCatalogWorkbenchQuery,
  DistributionCatalogWorkbenchResponse,
  DistributionContractTrackRuleOverrideRequest,
  DistributionContractWorkbenchQuery,
  DistributionContractWorkbenchResponse,
  DistributionDashboardQuery,
  DistributionDashboardResponse,
  DistributionFxRate,
  DistributionFxRatesQuery,
  DistributionFxRatesSaveRequest,
  DistributionImportBatchesQuery,
  DistributionImportBatch,
  DistributionImportConfirmRequest,
  DistributionImportConfirmResponse,
  DistributionImportPreviewRequest,
  DistributionImportPreviewResponse,
  DistributionMappingApplyRulesRequest,
  DistributionCatalogArtistPromoteRequest,
  DistributionCatalogContributorPayeeLinkRequest,
  DistributionMappingRow,
  DistributionMappingRowsQuery,
  DistributionAlias,
  DistributionAliasUpsertRequest,
  DistributionDuplicate,
  DistributionDuplicateResolveRequest,
  DistributionReconciliationActionRequest,
  DistributionReconciliationResponse,
  DistributionReleaseUpsertRequest,
  DistributionRevenueQuery,
  DistributionRevenueRow,
  DistributionScreenQuery,
  DistributionScreenResponse,
  DistributionSettingsResponse,
  DistributionPayeePartnerLink,
  DistributionPayeePartnerLinkQuery,
  DistributionPayeePartnerLinkRequest,
  DistributionPayeeUpsertRequest,
  DistributionTrackUpsertRequest,
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
  PaymentVoidRequest,
  ReleaseSummary,
  ReleasesQuery,
  StatementGenerateRequest,
  StatementPrintQuery,
  StatementPrintResponse,
  StatementVoidRequest,
  StatementSummary,
  StatementsQuery,
  DistributionSuspenseWorkbenchQuery,
  DistributionSuspenseWorkbenchResponse,
  SuspenseItem,
  SuspenseQuery,
  SuspenseResolveRequest,
  TrackSummary,
  TracksQuery,
  WriteRequestOptions
} from "./types.js";

export interface DistributionApiClient {
  readonly getStatus: (query: { readonly workspaceId: EntityId }) => Promise<{ readonly writesEnabled: boolean }>;
  readonly getScreen: (query: DistributionScreenQuery) => Promise<DistributionScreenResponse>;
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
  readonly reverseImportBatch: (
    batchId: EntityId,
    request: DistributionWorkspaceQuery,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listMappingRows: (query: DistributionMappingRowsQuery) => Promise<PageResult<DistributionMappingRow>>;
  readonly applyMappingRules: (
    request: DistributionMappingApplyRulesRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly getCatalogWorkbench: (
    query: DistributionCatalogWorkbenchQuery
  ) => Promise<DistributionCatalogWorkbenchResponse>;
  readonly saveCatalogContributors: (
    trackId: EntityId,
    request: DistributionCatalogContributorOverrideRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly promoteCatalogArtist: (
    trackId: EntityId,
    request: DistributionCatalogArtistPromoteRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly linkCatalogContributorPayee: (
    trackId: EntityId,
    contributorName: string,
    request: DistributionCatalogContributorPayeeLinkRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly getContractWorkbench: (
    query: DistributionContractWorkbenchQuery
  ) => Promise<DistributionContractWorkbenchResponse>;
  readonly saveContractTrackRules: (
    request: DistributionContractTrackRuleOverrideRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listContracts: (query: DistributionContractsQuery) => Promise<PageResult<DistributionContract>>;
  readonly createContract: (
    request: DistributionContractUpsertRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly updateContractRules: (
    contractId: EntityId,
    request: ContractRoyaltyRulesUpdateRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listContractExpenses: (
    query: DistributionContractExpenseQuery
  ) => Promise<PageResult<DistributionContractExpense>>;
  readonly recordContractExpense: (
    request: DistributionContractExpenseRecordRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listPayees: (query: PayeesQuery) => Promise<PageResult<PayeeSummary>>;
  readonly getPayee: (payeeId: EntityId, query: DistributionWorkspaceQuery) => Promise<PayeeSummary>;
  readonly createPayee: (
    request: DistributionPayeeUpsertRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly getPayeePartnerLink: (
    payeeId: EntityId,
    query: DistributionPayeePartnerLinkQuery
  ) => Promise<DistributionPayeePartnerLink>;
  readonly linkPayeePartner: (
    payeeId: EntityId,
    request: DistributionPayeePartnerLinkRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listReleases: (query: ReleasesQuery) => Promise<PageResult<ReleaseSummary>>;
  readonly createRelease: (
    request: DistributionReleaseUpsertRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listTracks: (query: TracksQuery) => Promise<PageResult<TrackSummary>>;
  readonly createTrack: (
    request: DistributionTrackUpsertRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listAllocationRuns: (query: AllocationRunQuery) => Promise<PageResult<AllocationRunSummary>>;
  readonly getAllocationWorkbench: (
    query: DistributionAllocationWorkbenchQuery
  ) => Promise<DistributionAllocationWorkbenchResponse>;
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
  readonly retryAllocationMissingContracts: (
    request: DistributionAllocationRetryMissingContractsRequest,
    options: WriteRequestOptions
  ) => Promise<DistributionAllocationRetryReceipt>;
  readonly listAllocations: (query: DistributionAllocationQuery) => Promise<PageResult<DistributionAllocationRow>>;
  readonly listAllocationsByCurrency: (
    query: DistributionAllocationQuery
  ) => Promise<PageResult<DistributionAllocationTotal>>;
  readonly listSuspense: (query: SuspenseQuery) => Promise<PageResult<SuspenseItem>>;
  readonly getSuspenseWorkbench: (
    query: DistributionSuspenseWorkbenchQuery
  ) => Promise<DistributionSuspenseWorkbenchResponse>;
  readonly resolveSuspense: (
    request: SuspenseResolveRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listStatements: (query: StatementsQuery) => Promise<PageResult<StatementSummary>>;
  readonly generateStatements: (
    request: StatementGenerateRequest,
    options: WriteRequestOptions
  ) => Promise<ApiRunReceipt>;
  readonly voidStatement: (
    statementId: EntityId,
    request: StatementVoidRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly printStatement: (query: StatementPrintQuery) => Promise<StatementPrintResponse>;
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
  readonly voidPayment: (
    paymentId: EntityId,
    request: PaymentVoidRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listFxRates: (query: DistributionFxRatesQuery) => Promise<PageResult<DistributionFxRate>>;
  readonly saveFxRates: (
    request: DistributionFxRatesSaveRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly getRevenue: (query: DistributionRevenueQuery) => Promise<PageResult<DistributionRevenueRow>>;
  readonly getFinancialReconciliation: (
    query: DistributionWorkspaceQuery
  ) => Promise<DistributionReconciliationResponse>;
  readonly listAliases: (query: DistributionWorkspacePageQuery) => Promise<PageResult<DistributionAlias>>;
  readonly createAlias: (
    request: DistributionAliasUpsertRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly updateAlias: (
    aliasId: EntityId,
    request: DistributionAliasUpsertRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listDuplicates: (query: DistributionWorkspacePageQuery) => Promise<PageResult<DistributionDuplicate>>;
  readonly resolveDuplicate: (
    duplicateId: EntityId,
    request: DistributionDuplicateResolveRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly runFinancialReconciliationAction: (
    actionId: string,
    request: DistributionReconciliationActionRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listAuditLog: (query: AuditLogQuery) => Promise<PageResult<AuditLogEntry>>;
  readonly getSettings: (query: DistributionWorkspaceQuery) => Promise<DistributionSettingsResponse>;
}

export function createDistributionApiClient(config: ApiClientConfig): DistributionApiClient {
  const transport = createRestTransport(config, "erh/v1");

  return {
    getStatus: (query: { readonly workspaceId: EntityId }): Promise<{ readonly writesEnabled: boolean }> =>
      transport.get<{ readonly writesEnabled: boolean }>("status", { workspaceId: query.workspaceId }),
    getScreen: (query: DistributionScreenQuery): Promise<DistributionScreenResponse> =>
      transport.get<DistributionScreenResponse>("screen", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        importSource: query.importSource,
        importStatus: query.importStatus,
        mappingStatus: query.mappingStatus,
        suspenseStatus: query.suspenseStatus,
        paymentStatus: query.paymentStatus,
        revenueGroupBy: query.revenueGroupBy
      }),
    getDashboard: (query: DistributionDashboardQuery): Promise<DistributionDashboardResponse> =>
      transport.get<DistributionDashboardResponse>("dashboard", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null
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
    reverseImportBatch: (
      batchId: EntityId,
      request: DistributionWorkspaceQuery,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `imports/batches/${encodePathSegment(batchId)}/reverse`,
        request,
        options.idempotencyKey
      ),
    listMappingRows: (query: DistributionMappingRowsQuery): Promise<PageResult<DistributionMappingRow>> =>
      transport.get<PageResult<DistributionMappingRow>>("mapping/rows", {
        workspaceId: query.workspaceId,
        batchId: query.batchId,
        status: query.status,
        search: query.search,
        cursor: query.cursor,
        limit: query.limit
      }),
    applyMappingRules: (
      request: DistributionMappingApplyRulesRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("mapping/apply-rules", request, options.idempotencyKey),
    getCatalogWorkbench: (
      query: DistributionCatalogWorkbenchQuery
    ): Promise<DistributionCatalogWorkbenchResponse> =>
      transport.get<DistributionCatalogWorkbenchResponse>("catalog/workbench", {
        workspaceId: query.workspaceId,
        search: query.search,
        artistSource: query.artistSource,
        isrc: query.isrc,
        role: query.role,
        review: query.review,
        label: query.label,
        releaseFrom: query.releaseFrom,
        releaseTo: query.releaseTo,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    saveCatalogContributors: (
      trackId: EntityId,
      request: DistributionCatalogContributorOverrideRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `catalog/tracks/${encodePathSegment(trackId)}/contributor-overrides`,
        request,
        options.idempotencyKey
      ),
    promoteCatalogArtist: (
      trackId: EntityId,
      request: DistributionCatalogArtistPromoteRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `catalog/tracks/${encodePathSegment(trackId)}/promote-artist`,
        request,
        options.idempotencyKey
      ),
    linkCatalogContributorPayee: (
      trackId: EntityId,
      contributorName: string,
      request: DistributionCatalogContributorPayeeLinkRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `catalog/tracks/${encodePathSegment(trackId)}/contributors/${encodePathSegment(contributorName)}/payee-link`,
        request,
        options.idempotencyKey
      ),
    getContractWorkbench: (
      query: DistributionContractWorkbenchQuery
    ): Promise<DistributionContractWorkbenchResponse> =>
      transport.get<DistributionContractWorkbenchResponse>("contracts/workbench", {
        workspaceId: query.workspaceId,
        search: query.search,
        status: query.status,
        workflow: query.workflow,
        cursor: query.cursor,
        limit: query.limit
      }),
    saveContractTrackRules: (
      request: DistributionContractTrackRuleOverrideRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("contracts/track-rule-overrides", request, options.idempotencyKey),
    listContracts: (query: DistributionContractsQuery): Promise<PageResult<DistributionContract>> =>
      transport.get<PageResult<DistributionContract>>("contracts", {
        workspaceId: query.workspaceId,
        payeeId: query.payeeId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    createContract: (
      request: DistributionContractUpsertRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("contracts", request, options.idempotencyKey),
    updateContractRules: (
      contractId: EntityId,
      request: ContractRoyaltyRulesUpdateRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `contracts/${encodePathSegment(contractId)}/rules`,
        request,
        options.idempotencyKey
      ),
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
    getPayee: (payeeId: EntityId, query: DistributionWorkspaceQuery): Promise<PayeeSummary> =>
      transport.get<PayeeSummary>(`payees/${encodePathSegment(payeeId)}`, {
        workspaceId: query.workspaceId
      }),
    createPayee: (
      request: DistributionPayeeUpsertRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("payees", request, options.idempotencyKey),
    getPayeePartnerLink: (
      payeeId: EntityId,
      query: DistributionPayeePartnerLinkQuery
    ): Promise<DistributionPayeePartnerLink> =>
      transport.get<DistributionPayeePartnerLink>(`payees/${encodePathSegment(payeeId)}/partner-link`, {
        workspaceId: query.workspaceId
      }),
    linkPayeePartner: (
      payeeId: EntityId,
      request: DistributionPayeePartnerLinkRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `payees/${encodePathSegment(payeeId)}/partner-link`,
        request,
        options.idempotencyKey
      ),
    listReleases: (query: ReleasesQuery): Promise<PageResult<ReleaseSummary>> =>
      transport.get<PageResult<ReleaseSummary>>("releases", {
        workspaceId: query.workspaceId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    createRelease: (
      request: DistributionReleaseUpsertRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("releases", request, options.idempotencyKey),
    listTracks: (query: TracksQuery): Promise<PageResult<TrackSummary>> =>
      transport.get<PageResult<TrackSummary>>("tracks", {
        workspaceId: query.workspaceId,
        releaseId: query.releaseId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    createTrack: (
      request: DistributionTrackUpsertRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("tracks", request, options.idempotencyKey),
    listAllocationRuns: (query: AllocationRunQuery): Promise<PageResult<AllocationRunSummary>> =>
      transport.get<PageResult<AllocationRunSummary>>("allocations/runs", {
        workspaceId: query.workspaceId,
        period: query.period,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    getAllocationWorkbench: (
      query: DistributionAllocationWorkbenchQuery
    ): Promise<DistributionAllocationWorkbenchResponse> =>
      transport.get<DistributionAllocationWorkbenchResponse>("allocations/workbench", {
        workspaceId: query.workspaceId,
        search: query.search,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        batchCursor: query.batchCursor,
        bankCursor: query.bankCursor,
        limit: query.limit
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
    retryAllocationMissingContracts: (
      request: DistributionAllocationRetryMissingContractsRequest,
      options: WriteRequestOptions
    ): Promise<DistributionAllocationRetryReceipt> =>
      transport.post<DistributionAllocationRetryReceipt>(
        "allocations/retry-missing-contracts",
        request,
        options.idempotencyKey
      ),
    listAllocations: (query: DistributionAllocationQuery): Promise<PageResult<DistributionAllocationRow>> =>
      transport.get<PageResult<DistributionAllocationRow>>("allocations", {
        workspaceId: query.workspaceId,
        runId: query.runId,
        payeeId: query.payeeId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    listAllocationsByCurrency: (
      query: DistributionAllocationQuery
    ): Promise<PageResult<DistributionAllocationTotal>> =>
      transport.get<PageResult<DistributionAllocationTotal>>("allocations-by-currency", {
        workspaceId: query.workspaceId,
        runId: query.runId,
        payeeId: query.payeeId,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    listSuspense: (query: SuspenseQuery): Promise<PageResult<SuspenseItem>> =>
      transport.get<PageResult<SuspenseItem>>("suspense", {
        workspaceId: query.workspaceId,
        period: query.period,
        status: query.status,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        cursor: query.cursor,
        limit: query.limit
      }),
    getSuspenseWorkbench: (
      query: DistributionSuspenseWorkbenchQuery
    ): Promise<DistributionSuspenseWorkbenchResponse> =>
      transport.get<DistributionSuspenseWorkbenchResponse>("suspense/workbench", {
        workspaceId: query.workspaceId,
        search: query.search,
        batchReference: query.batchReference,
        reasonCode: query.reasonCode,
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
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
    voidStatement: (
      statementId: EntityId,
      request: StatementVoidRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `statements/${encodePathSegment(statementId)}/void`,
        request,
        options.idempotencyKey
      ),
    printStatement: (query: StatementPrintQuery): Promise<StatementPrintResponse> =>
      transport.get<StatementPrintResponse>(`statements/${encodePathSegment(query.statementId)}/print`, {
        workspaceId: query.workspaceId
      }),
    listPayments: (query: PaymentsQuery): Promise<PageResult<PaymentSummary>> =>
      transport.get<PageResult<PaymentSummary>>("payments", {
        workspaceId: query.workspaceId,
        period: query.period,
        payeeId: query.payeeId,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
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
    voidPayment: (
      paymentId: EntityId,
      request: PaymentVoidRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `payments/${encodePathSegment(paymentId)}/void`,
        request,
        options.idempotencyKey
      ),
    listFxRates: (query: DistributionFxRatesQuery): Promise<PageResult<DistributionFxRate>> =>
      transport.get<PageResult<DistributionFxRate>>("fx-rates", {
        workspaceId: query.workspaceId,
        fromCurrency: query.fromCurrency ?? null,
        toCurrency: query.toCurrency ?? null,
        effectiveDate: query.effectiveDate ?? null,
        cursor: query.cursor,
        limit: query.limit
      }),
    saveFxRates: (
      request: DistributionFxRatesSaveRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("fx-rates", request, options.idempotencyKey),
    getRevenue: (query: DistributionRevenueQuery): Promise<PageResult<DistributionRevenueRow>> =>
      transport.get<PageResult<DistributionRevenueRow>>("revenue", {
        workspaceId: query.workspaceId,
        period: query.period,
        payeeId: query.payeeId,
        store: query.store,
        currency: query.currency,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
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
    createAlias: (
      request: DistributionAliasUpsertRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("aliases", request, options.idempotencyKey),
    updateAlias: (
      aliasId: EntityId,
      request: DistributionAliasUpsertRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.patch<ApiMutationReceipt>(
        `aliases/${encodePathSegment(aliasId)}`,
        request,
        options.idempotencyKey
      ),
    listDuplicates: (query: DistributionWorkspacePageQuery): Promise<PageResult<DistributionDuplicate>> =>
      transport.get<PageResult<DistributionDuplicate>>("duplicates", {
        workspaceId: query.workspaceId,
        cursor: query.cursor,
        limit: query.limit
      }),
    resolveDuplicate: (
      duplicateId: EntityId,
      request: DistributionDuplicateResolveRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `duplicates/${encodePathSegment(duplicateId)}/resolve`,
        request,
        options.idempotencyKey
      ),
    runFinancialReconciliationAction: (
      actionId: string,
      request: DistributionReconciliationActionRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `financial-reconciliation/actions/${encodePathSegment(actionId)}`,
        request,
        options.idempotencyKey
      ),
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
