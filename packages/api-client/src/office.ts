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
  CashflowQuery,
  EntityId,
  OfficeBankQualityQuery,
  OfficeBankQualityResponse,
  OfficeDashboardQuery,
  OfficeDashboardResponse,
  OfficeDepartmentPnl,
  OfficeDepartmentPnlQuery,
  OfficeGlobalPnl,
  OfficeGlobalPnlQuery,
  OfficeIntegrityCheckAllResponse,
  OfficeIntegrityCheckQuery,
  OfficePartnerClassificationSuggestion,
  OfficePartnerDetail,
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
  OfficePlanComptableQuery,
  OfficePlanComptableWriteRequest,
  OfficePnlProjectionQuery,
  OfficePnlProjectionRow,
  OfficeProjectCoherenceViolation,
  OfficeProjectCoherenceViolationsQuery,
  OfficeProjectPnl,
  OfficeProjectPnlQuery,
  OfficeProjectsQuery,
  OfficeProjectSummary,
  OfficeReconciliationApproveRequest,
  OfficeReconciliationCandidate,
  OfficeReconciliationsQuery,
  OfficeTransaction,
  OfficeTransactionsQuery,
  OfficeTransactionWriteRequest,
  PageResult,
  WriteRequestOptions
} from "./types.js";

export interface OfficeApiClient {
  readonly getDashboard: (query: OfficeDashboardQuery) => Promise<OfficeDashboardResponse>;
  readonly getGlobalPnl: (query: OfficeGlobalPnlQuery) => Promise<OfficeGlobalPnl>;
  readonly getDepartmentPnl: (departmentId: EntityId, query: OfficeDepartmentPnlQuery) => Promise<OfficeDepartmentPnl>;
  readonly getPnlProjection: (query: OfficePnlProjectionQuery) => Promise<readonly OfficePnlProjectionRow[]>;
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
  readonly getPlanComptable: (query: OfficePlanComptableQuery) => Promise<readonly OfficePlanComptableNode[]>;
  readonly createPlanComptableNode: (
    request: OfficePlanComptableWriteRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly updatePlanComptableNode: (
    nodeId: EntityId,
    request: OfficePlanComptableWriteRequest,
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
  readonly listReconciliations: (
    query: OfficeReconciliationsQuery
  ) => Promise<PageResult<OfficeReconciliationCandidate>>;
  readonly approveReconciliations: (
    request: OfficeReconciliationApproveRequest,
    options: WriteRequestOptions
  ) => Promise<ApiMutationReceipt>;
  readonly getCashflow: (query: CashflowQuery) => Promise<readonly CashflowBucket[]>;
  readonly listAuditLog: (query: AuditLogQuery) => Promise<PageResult<AuditLogEntry>>;
  readonly listPartners: (query: OfficePartnersQuery) => Promise<PageResult<OfficePartnerListItem>>;
  readonly getPartnerRecord: (partnerId: EntityId, query: OfficePartnerRecordQuery) => Promise<OfficePartnerRecord>;
  readonly getPartnerPnl: (partnerId: EntityId, query: OfficePartnerDetailQuery) => Promise<OfficePartnerPnl>;
  readonly listPartnerClassificationSuggestions: (
    partnerId: EntityId,
    query: OfficePartnerRecordQuery
  ) => Promise<readonly OfficePartnerClassificationSuggestion[]>;
  readonly getPartner: (partnerId: EntityId, query: OfficePartnerDetailQuery) => Promise<OfficePartnerDetail>;
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
  readonly listProjectCoherenceViolations: (
    projectId: EntityId,
    query: OfficeProjectCoherenceViolationsQuery
  ) => Promise<PageResult<OfficeProjectCoherenceViolation>>;
  readonly getProjectPnl: (projectId: EntityId, query: OfficeProjectPnlQuery) => Promise<OfficeProjectPnl>;
  readonly checkIntegrity: (query: OfficeIntegrityCheckQuery) => Promise<OfficeIntegrityCheckAllResponse>;
  readonly getBankQuality: (query: OfficeBankQualityQuery) => Promise<OfficeBankQualityResponse>;
}

export function createOfficeApiClient(config: ApiClientConfig): OfficeApiClient {
  const transport = createRestTransport(config, "eof/v1");

  return {
    getDashboard: (query: OfficeDashboardQuery): Promise<OfficeDashboardResponse> =>
      transport.get<OfficeDashboardResponse>("dashboard", {
        workspaceId: query.workspaceId,
        period: query.period
      }),
    getGlobalPnl: (query: OfficeGlobalPnlQuery): Promise<OfficeGlobalPnl> =>
      transport.get<OfficeGlobalPnl>("pl/global", {
        workspaceId: query.workspaceId,
        period: query.period
      }),
    getDepartmentPnl: (departmentId: EntityId, query: OfficeDepartmentPnlQuery): Promise<OfficeDepartmentPnl> =>
      transport.get<OfficeDepartmentPnl>(`pl/department/${encodePathSegment(departmentId)}`, {
        workspaceId: query.workspaceId,
        period: query.period
      }),
    getPnlProjection: async (query: OfficePnlProjectionQuery): Promise<readonly OfficePnlProjectionRow[]> => {
      if (query.departmentId === null) {
        const globalPnl = await transport.get<OfficeGlobalPnl>("pl/global", {
          workspaceId: query.workspaceId,
          period: query.period
        });

        return globalPnl.projectionRows;
      }

      const departmentPnl = await transport.get<OfficeDepartmentPnl>(
        `pl/department/${encodePathSegment(query.departmentId)}`,
        {
          workspaceId: query.workspaceId,
          period: query.period
        }
      );

      return departmentPnl.projectionRows;
    },
    listTransactions: (query: OfficeTransactionsQuery): Promise<PageResult<OfficeTransaction>> =>
      transport.get<PageResult<OfficeTransaction>>("transactions", {
        workspaceId: query.workspaceId,
        period: query.period,
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
    getPlanComptable: (query: OfficePlanComptableQuery): Promise<readonly OfficePlanComptableNode[]> =>
      transport.get<readonly OfficePlanComptableNode[]>("plan-comptable", {
        workspaceId: query.workspaceId,
        includeInactive: query.includeInactive
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
    listReconciliations: (
      query: OfficeReconciliationsQuery
    ): Promise<PageResult<OfficeReconciliationCandidate>> =>
      transport.get<PageResult<OfficeReconciliationCandidate>>("reconciliations", {
        workspaceId: query.workspaceId,
        accountId: query.accountId,
        period: query.period,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
    approveReconciliations: (
      request: OfficeReconciliationApproveRequest,
      options: WriteRequestOptions
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>("reconciliations/approve", request, options.idempotencyKey),
    getCashflow: (query: CashflowQuery): Promise<readonly CashflowBucket[]> =>
      transport.get<readonly CashflowBucket[]>("cashflow", {
        workspaceId: query.workspaceId,
        from: query.from,
        to: query.to,
        accountId: query.accountId
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
    listPartners: (query: OfficePartnersQuery): Promise<PageResult<OfficePartnerListItem>> =>
      transport.get<PageResult<OfficePartnerListItem>>("partners", {
        workspaceId: query.workspaceId,
        period: query.period,
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
        period: query.period
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
    getPartner: (partnerId: EntityId, query: OfficePartnerDetailQuery): Promise<OfficePartnerDetail> =>
      transport.get<OfficePartnerDetail>(`pl/partner/${encodePathSegment(partnerId)}`, {
        workspaceId: query.workspaceId,
        period: query.period
      }),
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
        status: query.status,
        cursor: query.cursor,
        limit: query.limit
      }),
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
        period: query.period
      }),
    checkIntegrity: (query: OfficeIntegrityCheckQuery): Promise<OfficeIntegrityCheckAllResponse> =>
      transport.get<OfficeIntegrityCheckAllResponse>("integrity/check-all", {
        workspaceId: query.workspaceId
      }),
    getBankQuality: (query: OfficeBankQualityQuery): Promise<OfficeBankQualityResponse> =>
      transport.get<OfficeBankQualityResponse>("analytics/bank-quality", {
        workspaceId: query.workspaceId,
        period: query.period
      })
  };
}
