import { createRestTransport, encodePathSegment } from "./transport.js";
import type {
  ApiClientConfig,
  ApiMutationReceipt,
  AuditLogEntry,
  AuditLogQuery,
  BankImportConfirmRequest,
  BankImportConfirmResponse,
  BankImportPreviewRequest,
  BankImportPreviewResponse,
  CashflowBucket,
  OfficeCashflowImportRequest,
  OfficeCashflowPreviewResponse,
  CashflowQuery,
  OfficeAdvancesWorkbenchQuery,
  OfficeAdvancesWorkbenchResponse,
  OfficeCashflowManualEntryCancelRequest,
  OfficeCashflowManualEntryWriteRequest,
  OfficeCashflowWorkbenchQuery,
  OfficeCashflowWorkbenchResponse,
  OfficeAdvanceApplicationRequest,
  OfficeAdvanceMarkPaidRequest,
  OfficeAdvanceWriteRequest,
  EntityId,
  OfficeBankAccountsQuery,
  OfficeBankAccountDeleteRequest,
  OfficeBankAccountSummary,
  OfficeBankAccountWriteRequest,
  OfficeSettingsResponse,
  OfficeSettingsUpdateRequest,
  OfficeBankQualityQuery,
  OfficeBankQualityResponse,
  OfficeBankRawLine,
  OfficeBankRawLinesQuery,
  OfficeDashboardAnalyticsQuery,
  OfficeDashboardAnalyticsResponse,
  OfficeDashboardQuery,
  OfficeDashboardResponse,
  OfficeDepartmentPnl,
  OfficeDepartmentPnlQuery,
  OfficeDivisionPnl,
  OfficeDivisionPnlQuery,
  OfficeCategoryPnlQuery,
  OfficeGlobalPnl,
  OfficeGlobalPnlQuery,
  OfficeIntegrityCheckAllResponse,
  OfficeIntegrityCheckQuery,
  OfficePartnerClassificationSuggestion,
  OfficePartnerDetailQuery,
  OfficePartnerListItem,
  OfficePartnerPayeeLink,
  OfficePartnerPayeeLinkRequest,
  OfficePartnerPnl,
  OfficePartnerRecord,
  OfficePartnerRecordQuery,
  OfficePartnersQuery,
  OfficePartnerWriteRequest,
  OfficePlanComptableNode,
  OfficePlanComptableDeleteRequest,
  OfficePlanComptableNodesQuery,
  OfficePlanComptableQuery,
  OfficePlanComptableWriteRequest,
  OfficePnlLine,
  OfficeProjectCoherenceViolation,
  OfficeProjectCoherenceViolationsQuery,
  OfficeProjectPnl,
  OfficeProjectPnlQuery,
  OfficeProjectsQuery,
  OfficeBankRawLineReassignRequest,
  OfficeProjectSummary,
  OfficeProjectWriteRequest,
  OfficeReconciliationApproveRequest,
  OfficeReconciliationApproveSuggestedRequest,
  OfficeReconciliationApproveSuggestedResponse,
  OfficeReconciliationMatchRequest,
  OfficeReconciliationLineRequest,
  OfficeReconciliationCreateTransactionRequest,
  OfficeReconciliationCandidate,
  OfficeReconciliationOperationsQuery,
  OfficeReconciliationOperationsResponse,
  OfficeReconciliationsQuery,
  OfficeScreenQuery,
  OfficeScreenResponse,
  OfficeWorkbenchSnapshotResponse,
  OfficeTransaction,
  OfficeTransactionsQuery,
  OfficeTransactionWriteRequest,
  OfficeVatQuery,
  OfficeVatReport,
  PageResult,
  WriteRequestOptions
} from "./types.js";

export interface OfficeApiClient {
  readonly getStatus: (query: { readonly workspaceId: EntityId }) => Promise<{ readonly writesEnabled: boolean }>;
  readonly getScreen: (query: OfficeScreenQuery) => Promise<OfficeScreenResponse>;
  readonly getWorkbenchSnapshot: (query: OfficeScreenQuery) => Promise<OfficeWorkbenchSnapshotResponse>;
  readonly getDashboard: (query: OfficeDashboardQuery) => Promise<OfficeDashboardResponse>;
  readonly getDashboardAnalytics: (query: OfficeDashboardAnalyticsQuery) => Promise<OfficeDashboardAnalyticsResponse>;
  readonly getGlobalPnl: (query: OfficeGlobalPnlQuery) => Promise<OfficeGlobalPnl>;
  readonly getDepartmentPnl: (departmentId: EntityId, query: OfficeDepartmentPnlQuery) => Promise<OfficeDepartmentPnl>;
  readonly getDivisionPnl: (query: OfficeDivisionPnlQuery) => Promise<PageResult<OfficeDivisionPnl>>;
  readonly getCategoryPnl: (query: OfficeCategoryPnlQuery) => Promise<PageResult<OfficePnlLine>>;
  readonly listTransactions: (query: OfficeTransactionsQuery) => Promise<PageResult<OfficeTransaction>>;
  readonly createTransaction: (
    request: OfficeTransactionWriteRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly updateTransaction: (
    transactionId: EntityId,
    request: OfficeTransactionWriteRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly cancelTransaction: (
    transactionId: EntityId,
    request: { readonly workspaceId: EntityId },
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly validateTransaction: (
    transactionId: EntityId,
    request: { readonly workspaceId: EntityId },
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly getPlanComptable: (query: OfficePlanComptableQuery) => Promise<readonly OfficePlanComptableNode[]>;
  readonly listPlanComptableNodes: (query: OfficePlanComptableNodesQuery) => Promise<PageResult<OfficePlanComptableNode>>;
  readonly createPlanComptableNode: (
    request: OfficePlanComptableWriteRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly updatePlanComptableNode: (
    nodeId: EntityId,
    request: OfficePlanComptableWriteRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly deletePlanComptableNode: (
    nodeId: EntityId,
    request: OfficePlanComptableDeleteRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly previewBankImport: (
    request: BankImportPreviewRequest,
    options: WriteRequestOptions
  ) => Promise<BankImportPreviewResponse>;
  readonly confirmBankImport: (
    request: BankImportConfirmRequest,
    options: WriteRequestOptions
  ) => Promise<BankImportConfirmResponse>;
  readonly reverseBankImportBatch: (
    batchId: EntityId,
    request: { readonly workspaceId: EntityId },
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly deleteBankImportBatch: (
    batchId: EntityId,
    request: { readonly workspaceId: EntityId },
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly resetFinancialData: (
    request: { readonly workspaceId: EntityId; readonly confirmationPhrase: string },
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listReconciliations: (
    query: OfficeReconciliationsQuery
  ) => Promise<PageResult<OfficeReconciliationCandidate>>;
  readonly approveReconciliations: (
    request: OfficeReconciliationApproveRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly approveSuggestedReconciliations: (
    request: OfficeReconciliationApproveSuggestedRequest,
    options: WriteRequestOptions
  ) => Promise<OfficeReconciliationApproveSuggestedResponse>;
  readonly getReconciliationOperations: (
    query: OfficeReconciliationOperationsQuery
  ) => Promise<OfficeReconciliationOperationsResponse>;
  readonly matchReconciliation: (
    request: OfficeReconciliationMatchRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly unmatchReconciliation: (
    request: OfficeReconciliationLineRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly rejectReconciliation: (
    request: OfficeReconciliationLineRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly createTransactionFromBankLine: (
    request: OfficeReconciliationCreateTransactionRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly ignoreBankRawLine: (
    request: OfficeReconciliationLineRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly reassignBankRawLineAccount: (
    request: OfficeBankRawLineReassignRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly getCashflow: (query: CashflowQuery) => Promise<readonly CashflowBucket[]>;
  readonly getSettings: (workspaceId: EntityId) => Promise<OfficeSettingsResponse>;
  readonly updateSettings: (request: OfficeSettingsUpdateRequest, options: WriteRequestOptions) => Promise<ApiMutationReceipt>;
  readonly getCashflowWorkbench: (query: OfficeCashflowWorkbenchQuery) => Promise<OfficeCashflowWorkbenchResponse>;
  readonly createCashflowManualEntry: (
    request: OfficeCashflowManualEntryWriteRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly cancelCashflowManualEntry: (
    entryId: EntityId,
    request: OfficeCashflowManualEntryCancelRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly previewCashflowImport: (request: OfficeCashflowImportRequest, options: WriteRequestOptions) => Promise<OfficeCashflowPreviewResponse>;
  readonly confirmCashflowImport: (request: OfficeCashflowImportRequest, options: WriteRequestOptions) => Promise<ApiMutationReceipt>;
  readonly reverseCashflowImport: (batchId: EntityId, workspaceId: EntityId, options: WriteRequestOptions) => Promise<ApiMutationReceipt>;
  readonly getAdvancesWorkbench: (query: OfficeAdvancesWorkbenchQuery) => Promise<OfficeAdvancesWorkbenchResponse>;
  readonly createAdvance: (
    request: OfficeAdvanceWriteRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly applyAdvance: (
    advanceId: EntityId,
    request: OfficeAdvanceApplicationRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly markAdvancePaid: (
    advanceId: EntityId,
    request: OfficeAdvanceMarkPaidRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listAuditLog: (query: AuditLogQuery) => Promise<PageResult<AuditLogEntry>>;
  readonly listPartners: (query: OfficePartnersQuery) => Promise<PageResult<OfficePartnerListItem>>;
  readonly getPartnerRecord: (partnerId: EntityId, query: OfficePartnerRecordQuery) => Promise<OfficePartnerRecord>;
  readonly getPartnerPnl: (partnerId: EntityId, query: OfficePartnerDetailQuery) => Promise<OfficePartnerPnl>;
  readonly listPartnerClassificationSuggestions: (
    partnerId: EntityId,
    query: OfficePartnerRecordQuery
  ) => Promise<readonly OfficePartnerClassificationSuggestion[]>;
  readonly createPartner: (
    request: OfficePartnerWriteRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly updatePartner: (
    partnerId: EntityId,
    request: OfficePartnerWriteRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly getPartnerPayeeLink: (partnerId: EntityId, query: OfficePartnerDetailQuery) => Promise<OfficePartnerPayeeLink>;
  readonly linkPartnerPayee: (
    partnerId: EntityId,
    request: OfficePartnerPayeeLinkRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly unlinkPartnerPayee: (
    partnerId: EntityId,
    request: OfficePartnerPayeeLinkRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly listProjects: (query: OfficeProjectsQuery) => Promise<PageResult<OfficeProjectSummary>>;
  readonly createProject: (request: OfficeProjectWriteRequest, options: WriteRequestOptions) => Promise<ApiMutationReceipt>;
  readonly updateProject: (projectId: EntityId, request: OfficeProjectWriteRequest, options: WriteRequestOptions) => Promise<ApiMutationReceipt>;
  readonly listProjectCoherenceViolations: (
    projectId: EntityId,
    query: OfficeProjectCoherenceViolationsQuery
  ) => Promise<PageResult<OfficeProjectCoherenceViolation>>;
  readonly getProjectPnl: (projectId: EntityId, query: OfficeProjectPnlQuery) => Promise<OfficeProjectPnl>;
  readonly checkIntegrity: (query: OfficeIntegrityCheckQuery) => Promise<OfficeIntegrityCheckAllResponse>;
  readonly getBankQuality: (query: OfficeBankQualityQuery) => Promise<OfficeBankQualityResponse>;
  readonly listBankAccounts: (query: OfficeBankAccountsQuery) => Promise<PageResult<OfficeBankAccountSummary>>;
  readonly createBankAccount: (request: OfficeBankAccountWriteRequest, options: WriteRequestOptions) => Promise<ApiMutationReceipt>;
  readonly updateBankAccount: (accountId: EntityId, request: OfficeBankAccountWriteRequest, options: WriteRequestOptions) => Promise<ApiMutationReceipt>;
  readonly deleteBankAccount: (accountId: EntityId, request: OfficeBankAccountDeleteRequest, options: WriteRequestOptions) => Promise<ApiMutationReceipt>;
  readonly listBankRawLines: (query: OfficeBankRawLinesQuery) => Promise<PageResult<OfficeBankRawLine>>;
  readonly getVatReport: (query: OfficeVatQuery) => Promise<OfficeVatReport>;
}

export function createOfficeApiClient(config: ApiClientConfig): OfficeApiClient {
  const transport = createRestTransport(config, "eof/v1");

  return {
    getStatus: (query: { readonly workspaceId: EntityId }): Promise<{ readonly writesEnabled: boolean }> =>
      transport.get<{ readonly writesEnabled: boolean }>("status", { workspaceId: query.workspaceId }),
    getScreen: (query: OfficeScreenQuery): Promise<OfficeScreenResponse> =>
      transport.get<OfficeScreenResponse>("screen/office", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo
      }),
    getWorkbenchSnapshot: (query: OfficeScreenQuery): Promise<OfficeWorkbenchSnapshotResponse> =>
      transport.get<OfficeWorkbenchSnapshotResponse>("workbench/snapshot", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo
      }),
    getDashboard: (query: OfficeDashboardQuery): Promise<OfficeDashboardResponse> =>
      transport.get<OfficeDashboardResponse>("dashboard", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null
      }),
    getDashboardAnalytics: (query: OfficeDashboardAnalyticsQuery): Promise<OfficeDashboardAnalyticsResponse> =>
      transport.get<OfficeDashboardAnalyticsResponse>("analytics/dashboard", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null
      }),
    getGlobalPnl: (query: OfficeGlobalPnlQuery): Promise<OfficeGlobalPnl> =>
      transport.get<OfficeGlobalPnl>("pl/global", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null
      }),
    getDepartmentPnl: (departmentId: EntityId, query: OfficeDepartmentPnlQuery): Promise<OfficeDepartmentPnl> =>
      transport.get<OfficeDepartmentPnl>(`pl/department/${encodePathSegment(departmentId)}`, {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null
      }),
    getDivisionPnl: (query: OfficeDivisionPnlQuery): Promise<PageResult<OfficeDivisionPnl>> =>
      transport.get<PageResult<OfficeDivisionPnl>>("pl/division", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        cursor: query.cursor,
        limit: query.limit
      }),
    getCategoryPnl: (query: OfficeCategoryPnlQuery): Promise<PageResult<OfficePnlLine>> =>
      transport.get<PageResult<OfficePnlLine>>("pl/category", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        departmentId: query.departmentId,
        cursor: query.cursor,
        limit: query.limit
      }),
    listTransactions: (query: OfficeTransactionsQuery): Promise<PageResult<OfficeTransaction>> =>
      transport.get<PageResult<OfficeTransaction>>("transactions", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        accountId: query.accountId,
        departmentId: query.departmentId,
        divisionId: query.divisionId,
        categoryId: query.categoryId,
        projectId: query.projectId,
        type: query.type,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    createTransaction: (
      request: OfficeTransactionWriteRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("transactions", request, options.idempotencyKey),
    updateTransaction: (
      transactionId: EntityId,
      request: OfficeTransactionWriteRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.patch<ApiMutationReceipt>(
        `transactions/${encodePathSegment(transactionId)}`,
        request,
        options.idempotencyKey
      ),
    cancelTransaction: (
      transactionId: EntityId,
      request: { readonly workspaceId: EntityId },
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.patch<ApiMutationReceipt>(
        `transactions/${encodePathSegment(transactionId)}/cancel`,
        request,
        options.idempotencyKey
      ),
    validateTransaction: (
      transactionId: EntityId,
      request: { readonly workspaceId: EntityId },
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.patch<ApiMutationReceipt>(
        `transactions/${encodePathSegment(transactionId)}/validate`,
        request,
        options.idempotencyKey
      ),
    getPlanComptable: (query: OfficePlanComptableQuery): Promise<readonly OfficePlanComptableNode[]> =>
      transport.get<readonly OfficePlanComptableNode[]>("plan-comptable", {
        workspaceId: query.workspaceId,
        includeInactive: query.includeInactive
      }),
    listPlanComptableNodes: (query: OfficePlanComptableNodesQuery): Promise<PageResult<OfficePlanComptableNode>> =>
      transport.get<PageResult<OfficePlanComptableNode>>("plan-comptable/nodes", {
        workspaceId: query.workspaceId,
        includeInactive: query.includeInactive,
        cursor: query.cursor,
        limit: query.limit
      }),
    createPlanComptableNode: (
      request: OfficePlanComptableWriteRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("plan-comptable", request, options.idempotencyKey),
    updatePlanComptableNode: (
      nodeId: EntityId,
      request: OfficePlanComptableWriteRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.patch<ApiMutationReceipt>(
        `plan-comptable/${encodePathSegment(nodeId)}`,
        request,
        options.idempotencyKey
      ),
    deletePlanComptableNode: (
      nodeId: EntityId,
      request: OfficePlanComptableDeleteRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.delete<ApiMutationReceipt>(
        `plan-comptable/${encodePathSegment(nodeId)}`,
        request,
        options.idempotencyKey
      ),
    previewBankImport: (
      request: BankImportPreviewRequest,
      options: WriteRequestOptions
    ): Promise<BankImportPreviewResponse> =>
      transport.post<BankImportPreviewResponse>("bank-import/preview", request, options.idempotencyKey),
    confirmBankImport: (
      request: BankImportConfirmRequest,
      options: WriteRequestOptions
    ): Promise<BankImportConfirmResponse> =>
      transport.post<BankImportConfirmResponse>("bank-import/confirm", request, options.idempotencyKey),
    reverseBankImportBatch: (
      batchId: EntityId,
      request: { readonly workspaceId: EntityId },
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `bank-import/batches/${encodePathSegment(batchId)}/reverse`,
        request,
        options.idempotencyKey
      ),
    deleteBankImportBatch: (
      batchId: EntityId,
      request: { readonly workspaceId: EntityId },
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `bank-import/batches/${encodePathSegment(batchId)}/delete`,
        request,
        options.idempotencyKey
      ),
    resetFinancialData: (
      request: { readonly workspaceId: EntityId; readonly confirmationPhrase: string },
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("office/reset-financial-data", request, options.idempotencyKey),
    listReconciliations: (
      query: OfficeReconciliationsQuery
    ): Promise<PageResult<OfficeReconciliationCandidate>> =>
      transport.get<PageResult<OfficeReconciliationCandidate>>("reconciliations", {
        workspaceId: query.workspaceId,
        accountId: query.accountId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        minConfidenceBp: query.minConfidenceBp ?? null,
        classifiedOnly: query.classifiedOnly ?? false,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    approveReconciliations: (
      request: OfficeReconciliationApproveRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("reconciliations/approve", request, options.idempotencyKey),
    approveSuggestedReconciliations: (
      request: OfficeReconciliationApproveSuggestedRequest,
      options: WriteRequestOptions
    ): Promise<OfficeReconciliationApproveSuggestedResponse> =>
      transport.post<OfficeReconciliationApproveSuggestedResponse>(
        "reconciliations/approve-suggested",
        request,
        options.idempotencyKey
      ),
    getReconciliationOperations: (
      query: OfficeReconciliationOperationsQuery
    ): Promise<OfficeReconciliationOperationsResponse> =>
      transport.get<OfficeReconciliationOperationsResponse>("reconciliations/operations", {
        workspaceId: query.workspaceId,
        accountId: query.accountId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null
      }),
    matchReconciliation: (
      request: OfficeReconciliationMatchRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("reconciliations/match", request, options.idempotencyKey),
    unmatchReconciliation: (
      request: OfficeReconciliationLineRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("reconciliations/unmatch", request, options.idempotencyKey),
    rejectReconciliation: (
      request: OfficeReconciliationLineRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("reconciliations/reject", request, options.idempotencyKey),
    createTransactionFromBankLine: (
      request: OfficeReconciliationCreateTransactionRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("reconciliations/create-transaction", request, options.idempotencyKey),
    ignoreBankRawLine: (
      request: OfficeReconciliationLineRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("reconciliations/ignore", request, options.idempotencyKey),
    reassignBankRawLineAccount: (
      request: OfficeBankRawLineReassignRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("bank/raw/reassign-account", request, options.idempotencyKey),
    getCashflow: (query: CashflowQuery): Promise<readonly CashflowBucket[]> =>
      transport.get<readonly CashflowBucket[]>("cashflow", {
        workspaceId: query.workspaceId,
        from: query.from,
        to: query.to,
        accountId: query.accountId
      }),
    getSettings: (workspaceId: EntityId): Promise<OfficeSettingsResponse> =>
      transport.get<OfficeSettingsResponse>("settings", { workspaceId }),
    updateSettings: (request: OfficeSettingsUpdateRequest, options: WriteRequestOptions): Promise<ApiMutationReceipt> =>
      transport.patch<ApiMutationReceipt>("settings", request, options.idempotencyKey),
    getCashflowWorkbench: (query: OfficeCashflowWorkbenchQuery): Promise<OfficeCashflowWorkbenchResponse> =>
      transport.get<OfficeCashflowWorkbenchResponse>("cashflow/workbench", {
        workspaceId: query.workspaceId,
        from: query.from,
        to: query.to,
        accountId: query.accountId
      }),
    createCashflowManualEntry: (
      request: OfficeCashflowManualEntryWriteRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("cashflow/manual-entries", request, options.idempotencyKey),
    cancelCashflowManualEntry: (
      entryId: EntityId,
      request: OfficeCashflowManualEntryCancelRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `cashflow/manual-entries/${encodePathSegment(entryId)}/cancel`,
        request,
        options.idempotencyKey
      ),
    previewCashflowImport: (request: OfficeCashflowImportRequest, options: WriteRequestOptions): Promise<OfficeCashflowPreviewResponse> =>
      transport.post<OfficeCashflowPreviewResponse>("cashflow/preview", request, options.idempotencyKey),
    confirmCashflowImport: (request: OfficeCashflowImportRequest, options: WriteRequestOptions): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("cashflow/confirm", request, options.idempotencyKey),
    reverseCashflowImport: (batchId: EntityId, workspaceId: EntityId, options: WriteRequestOptions): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `cashflow/imports/${encodePathSegment(batchId)}/reverse`,
        { workspaceId },
        options.idempotencyKey
      ),
    getAdvancesWorkbench: (query: OfficeAdvancesWorkbenchQuery): Promise<OfficeAdvancesWorkbenchResponse> =>
      transport.get<OfficeAdvancesWorkbenchResponse>("advances/workbench", {
        workspaceId: query.workspaceId,
        kind: query.kind,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    createAdvance: (
      request: OfficeAdvanceWriteRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("advances", request, options.idempotencyKey),
    applyAdvance: (
      advanceId: EntityId,
      request: OfficeAdvanceApplicationRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `advances/${encodePathSegment(advanceId)}/applications`,
        request,
        options.idempotencyKey
      ),
    markAdvancePaid: (
      advanceId: EntityId,
      request: OfficeAdvanceMarkPaidRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `advances/${encodePathSegment(advanceId)}/mark-paid`,
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
    listPartners: (query: OfficePartnersQuery): Promise<PageResult<OfficePartnerListItem>> =>
      transport.get<PageResult<OfficePartnerListItem>>("partners", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        facet: query.facet,
        cursor: query.cursor,
        limit: query.limit
      }),
    getPartnerRecord: (partnerId: EntityId, query: OfficePartnerRecordQuery): Promise<OfficePartnerRecord> =>
      transport.get<OfficePartnerRecord>(`partners/${encodePathSegment(partnerId)}`, {
        workspaceId: query.workspaceId
      }),
    getPartnerPnl: (partnerId: EntityId, query: OfficePartnerDetailQuery): Promise<OfficePartnerPnl> =>
      transport.get<OfficePartnerPnl>(`pl/partner/${encodePathSegment(partnerId)}`, {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null
      }),
    listPartnerClassificationSuggestions: (
      partnerId: EntityId,
      query: OfficePartnerRecordQuery
    ): Promise<readonly OfficePartnerClassificationSuggestion[]> =>
      transport.get<readonly OfficePartnerClassificationSuggestion[]>(
        `classification/suggestions/${encodePathSegment(partnerId)}`,
        {
          workspaceId: query.workspaceId
        }
      ),
    createPartner: (
      request: OfficePartnerWriteRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("partners", request, options.idempotencyKey),
    updatePartner: (
      partnerId: EntityId,
      request: OfficePartnerWriteRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.patch<ApiMutationReceipt>(`partners/${encodePathSegment(partnerId)}`, request, options.idempotencyKey),
    getPartnerPayeeLink: (partnerId: EntityId, query: OfficePartnerDetailQuery): Promise<OfficePartnerPayeeLink> =>
      transport.get<OfficePartnerPayeeLink>(`partners/${encodePathSegment(partnerId)}/payee-link`, {
        workspaceId: query.workspaceId,
        period: query.period
      }),
    linkPartnerPayee: (
      partnerId: EntityId,
      request: OfficePartnerPayeeLinkRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `partners/${encodePathSegment(partnerId)}/payee-link`,
        request,
        options.idempotencyKey
      ),
    unlinkPartnerPayee: (
      partnerId: EntityId,
      request: OfficePartnerPayeeLinkRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.patch<ApiMutationReceipt>(
        `partners/${encodePathSegment(partnerId)}/payee-link`,
        request,
        options.idempotencyKey
      ),
    listProjects: (query: OfficeProjectsQuery): Promise<PageResult<OfficeProjectSummary>> =>
      transport.get<PageResult<OfficeProjectSummary>>("projects", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    createProject: (request: OfficeProjectWriteRequest, options: WriteRequestOptions): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("projects", request, options.idempotencyKey),
    updateProject: (projectId: EntityId, request: OfficeProjectWriteRequest, options: WriteRequestOptions): Promise<ApiMutationReceipt> =>
      transport.patch<ApiMutationReceipt>(`projects/${encodePathSegment(projectId)}`, request, options.idempotencyKey),
    listProjectCoherenceViolations: (
      projectId: EntityId,
      query: OfficeProjectCoherenceViolationsQuery
    ): Promise<PageResult<OfficeProjectCoherenceViolation>> =>
      transport.get<PageResult<OfficeProjectCoherenceViolation>>(
        `projects/${encodePathSegment(projectId)}/coherence-violations`,
        {
          workspaceId: query.workspaceId,
          cursor: query.cursor,
          limit: query.limit
        }
      ),
    getProjectPnl: (projectId: EntityId, query: OfficeProjectPnlQuery): Promise<OfficeProjectPnl> =>
      transport.get<OfficeProjectPnl>(`pl/project/${encodePathSegment(projectId)}`, {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null
      }),
    checkIntegrity: (query: OfficeIntegrityCheckQuery): Promise<OfficeIntegrityCheckAllResponse> =>
      transport.get<OfficeIntegrityCheckAllResponse>("integrity/check-all", {
        workspaceId: query.workspaceId
      }),
    getBankQuality: (query: OfficeBankQualityQuery): Promise<OfficeBankQualityResponse> =>
      transport.get<OfficeBankQualityResponse>("analytics/bank-quality", {
        workspaceId: query.workspaceId,
        period: query.period,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null
      }),
    listBankAccounts: (query: OfficeBankAccountsQuery): Promise<PageResult<OfficeBankAccountSummary>> =>
      transport.get<PageResult<OfficeBankAccountSummary>>("bank/accounts", {
        workspaceId: query.workspaceId,
        cursor: query.cursor,
        limit: query.limit
      }),
    createBankAccount: (request: OfficeBankAccountWriteRequest, options: WriteRequestOptions): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("bank/accounts", request, options.idempotencyKey),
    updateBankAccount: (accountId: EntityId, request: OfficeBankAccountWriteRequest, options: WriteRequestOptions): Promise<ApiMutationReceipt> =>
      transport.patch<ApiMutationReceipt>(`bank/accounts/${encodePathSegment(accountId)}`, request, options.idempotencyKey),
    deleteBankAccount: (accountId: EntityId, request: OfficeBankAccountDeleteRequest, options: WriteRequestOptions): Promise<ApiMutationReceipt> =>
      transport.delete<ApiMutationReceipt>(`bank/accounts/${encodePathSegment(accountId)}`, request, options.idempotencyKey),
    listBankRawLines: (query: OfficeBankRawLinesQuery): Promise<PageResult<OfficeBankRawLine>> =>
      transport.get<PageResult<OfficeBankRawLine>>("bank/raw", {
        workspaceId: query.workspaceId,
        period: query.period,
        accountId: query.accountId,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        cursor: query.cursor,
        limit: query.limit
      }),
    getVatReport: (query: OfficeVatQuery): Promise<OfficeVatReport> =>
      transport.get<OfficeVatReport>("vat", {
        workspaceId: query.workspaceId,
        period: query.period
      })
  };
}
