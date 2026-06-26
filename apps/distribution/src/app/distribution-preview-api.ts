import {
  createApiClient,
  standardApiRetryPolicy,
  type AllocationRunPreviewRequest,
  type AllocationRunStartRequest,
  type AllocationRunSummary,
  type AllocationRunUnpostRequest,
  type ApiMutationReceipt,
  type ApiRunReceipt,
  type DistributionContract,
  type DistributionContractExpense,
  type DistributionDashboardResponse,
  type DistributionImportBatch,
  type DistributionImportConfirmRequest,
  type DistributionImportConfirmResponse,
  type DistributionImportPreviewRequest,
  type DistributionImportPreviewResponse,
  type DistributionMappingApplyRulesRequest,
  type DistributionMappingRow,
  type DistributionRevenueRow,
  type EhqApiClient,
  type FetchLike,
  type IdempotencyKey,
  type PageResult,
  type PayeeSummary,
  type PaymentRecordRequest,
  type PaymentReconcileRequest,
  type PaymentSummary,
  type PaymentUpdateRequest,
  type ReleaseSummary,
  type StatementGenerateRequest,
  type StatementSummary,
  type SuspenseItem,
  type SuspenseResolveRequest,
  type TrackSummary
} from "@ehq/api-client";

const workspaceId = "eeee-mu";
const period = "2026-05";

const dashboard: DistributionDashboardResponse = {
  period,
  grossRoyaltyMicro: "612000000000",
  recoupedMicro: "36000000000",
  netPayableMicro: "412000000000",
  suspenseCount: 42,
  openStatementCount: 5,
  lastAuditEventId: "audit_distribution_preview_099"
};

const payees: readonly PayeeSummary[] = [
  { id: "payee_alma", displayName: "Alma Kreol", email: "alma@example.mu", status: "active", defaultCurrency: "MUR" },
  { id: "payee_avneesh", displayName: "Avneesh", email: "avneesh@example.mu", status: "active", defaultCurrency: "MUR" },
  { id: "payee_babani", displayName: "Babani estate", email: null, status: "active", defaultCurrency: "MUR" },
  { id: "payee_kaya", displayName: "Kaya estate", email: null, status: "inactive", defaultCurrency: "MUR" }
];

const importBatches: readonly DistributionImportBatch[] = [
  {
    id: "batch_kontor_2026q01",
    source: "kontor",
    fileName: "1180_04_2026Q01_AB4C_738853_001.CSV",
    period: "2026Q01",
    statementReference: "1A02610196",
    accountReference: "738853-001",
    rowCount: 13385,
    unmatchedRowCount: 3,
    currency: "EUR",
    grossMicro: "2707631063",
    payableColumn: "Royalty Amount Customer",
    joinKeySummary: "ISRC + EAN/UPC; Art.No. fallback",
    status: "mapped",
    nextAction: "validate",
    importedAt: "2026-06-02T09:00:00.000Z"
  },
  {
    id: "batch_routenote_2026_01",
    source: "routenote",
    fileName: "RNSales_Jan2026_eeeemusic.xlsx",
    period: "2026-01",
    statementReference: "hash:RNSales_Jan2026_eeeemusic",
    accountReference: "eeee-music",
    rowCount: 3640,
    unmatchedRowCount: 14,
    currency: "USD",
    grossMicro: "920410040",
    payableColumn: "Earnings($)",
    joinKeySummary: "ISRC + UPC/EAN; Channel ID empty",
    status: "uploaded",
    nextAction: "review_mapping",
    importedAt: "2026-06-02T11:15:00.000Z"
  },
  {
    id: "batch_kontor_2025q04",
    source: "kontor",
    fileName: "kontor_2026_04.csv",
    period: "2025Q04",
    statementReference: "legacy-preview",
    accountReference: "738853-001",
    rowCount: 7910,
    unmatchedRowCount: 0,
    currency: "EUR",
    grossMicro: "244000000000",
    payableColumn: "Royalty Amount Customer",
    joinKeySummary: "ISRC + EAN/UPC",
    status: "validated",
    nextAction: "apply_rules",
    importedAt: "2026-05-03T10:00:00.000Z"
  }
];

const mappingRows: readonly DistributionMappingRow[] = [
  {
    id: "map_alma",
    batchId: "batch_routenote_2026_01",
    sourceTitle: "Alma (radio edit)",
    sourceArtist: "Alma Kreol",
    sourceStore: "RouteNote",
    suggestedTrackId: "track_alma",
    suggestedTrackTitle: "Alma",
    confidenceBp: 9600,
    status: "suggested",
    exactFixPath: "mapping_rules"
  },
  {
    id: "map_redlight",
    batchId: "batch_routenote_2026_01",
    sourceTitle: "Redlight",
    sourceArtist: "Babani",
    sourceStore: "RouteNote",
    suggestedTrackId: "track_redlight",
    suggestedTrackTitle: "Redlight",
    confidenceBp: 8800,
    status: "suggested",
    exactFixPath: "catalog"
  },
  {
    id: "map_unknown",
    batchId: "batch_kontor_2026q01",
    sourceTitle: "Untitled 03",
    sourceArtist: "Various",
    sourceStore: "Kontor",
    suggestedTrackId: null,
    suggestedTrackTitle: null,
    confidenceBp: 3100,
    status: "unmapped",
    exactFixPath: "manual_track"
  }
];

const releases: readonly ReleaseSummary[] = [
  { id: "release_alma", title: "Alma", artistName: "Alma Kreol", upc: "406170000001", status: "released", releaseDate: "2026-02-14", trackCount: 3 },
  { id: "release_redlight", title: "Redlight", artistName: "Babani", upc: "406170000014", status: "released", releaseDate: "2026-03-20", trackCount: 1 },
  { id: "release_sega", title: "Séga 2024", artistName: "V/A", upc: null, status: "draft", releaseDate: null, trackCount: 12 }
];

const tracks: readonly TrackSummary[] = [
  { id: "track_alma", releaseId: "release_alma", title: "Alma", artistName: "Alma Kreol", isrc: "MU-A01-26-001", status: "released", splitStatus: "balanced", contributorCount: 3 },
  { id: "track_redlight", releaseId: "release_redlight", title: "Redlight", artistName: "Babani", isrc: "MU-B02-26-014", status: "released", splitStatus: "needs_review", contributorCount: 0 },
  { id: "track_sega", releaseId: "release_sega", title: "Séga 2024", artistName: "V/A", isrc: "MU-Z01-26-007", status: "draft", splitStatus: "balanced", contributorCount: 5 }
];

const contracts: readonly DistributionContract[] = [
  { id: "contract_alma", payeeId: "payee_alma", title: "Alma master split", status: "active", effectiveFrom: "2026-01-01", effectiveTo: null, splitBp: 7000, openExpenseMicro: "36000000000", currency: "MUR" },
  { id: "contract_avneesh", payeeId: "payee_avneesh", title: "Avneesh featured artist", status: "active", effectiveFrom: "2026-01-01", effectiveTo: null, splitBp: 3000, openExpenseMicro: "12000000000", currency: "MUR" },
  { id: "contract_babani", payeeId: "payee_babani", title: "Babani estate catalog", status: "paused", effectiveFrom: "2025-09-01", effectiveTo: null, splitBp: 9200, openExpenseMicro: "58000000000", currency: "MUR" }
];

const expenses: readonly DistributionContractExpense[] = [
  { id: "expense_alma_video", contractId: "contract_alma", payeeId: "payee_alma", incurredOn: "2026-04-02", label: "Video shoot", originalAmountMicro: "36000000000", openAmountMicro: "12000000000", currency: "MUR", status: "open" },
  { id: "expense_babani_studio", contractId: "contract_babani", payeeId: "payee_babani", incurredOn: "2026-03-10", label: "Studio advance", originalAmountMicro: "58000000000", openAmountMicro: "58000000000", currency: "MUR", status: "open" },
  { id: "expense_avneesh_mix", contractId: "contract_avneesh", payeeId: "payee_avneesh", incurredOn: "2026-02-18", label: "Mixing", originalAmountMicro: "12000000000", openAmountMicro: "0", currency: "MUR", status: "recouped" }
];

const allocationRuns: readonly AllocationRunSummary[] = [
  { id: "run_may_preview", period, status: "queued", lockKey: "distribution:allocations:2026-05", startedAt: null, completedAt: null, totalInputMicro: "612000000000", totalAllocatedMicro: "0" },
  { id: "run_apr_posted", period: "2026-04", status: "completed", lockKey: "distribution:allocations:2026-04", startedAt: "2026-05-04T08:00:00.000Z", completedAt: "2026-05-04T08:18:00.000Z", totalInputMicro: "544000000000", totalAllocatedMicro: "544000000000" }
];

const suspenseItems: readonly SuspenseItem[] = [
  { id: "susp_missing_split", period, sourceReference: "RouteNote · Redlight", reason: "missing_split", exactFixPath: "contracts", amountMicro: "58000000000", currency: "MUR", status: "open" },
  { id: "susp_unmapped", period, sourceReference: "Kontor · Untitled 03", reason: "unmapped_track", exactFixPath: "mapping", amountMicro: "3200000000", currency: "EUR", status: "open" },
  { id: "susp_retry", period, sourceReference: "Kontor · retry file", reason: "import_retry", exactFixPath: "imports", amountMicro: "0", currency: "EUR", status: "open" },
  { id: "susp_hold", period: "2026-04", sourceReference: "Babani estate hold", reason: "contract_hold", exactFixPath: "catalog", amountMicro: "21000000000", currency: "MUR", status: "resolved" }
];

const statements: readonly StatementSummary[] = [
  { id: "stmt_alma", period, payeeId: "payee_alma", payeeName: "Alma Kreol", status: "posted", grossMicro: "184000000000", recoupedMicro: "36000000000", expenseMicro: "12000000000", paidMicro: "0", netPayableMicro: "136000000000", currency: "MUR" },
  { id: "stmt_avneesh", period, payeeId: "payee_avneesh", payeeName: "Avneesh", status: "draft", grossMicro: "96000000000", recoupedMicro: "0", expenseMicro: "12000000000", paidMicro: "0", netPayableMicro: "84000000000", currency: "MUR" },
  { id: "stmt_babani", period, payeeId: "payee_babani", payeeName: "Babani estate", status: "paid", grossMicro: "132000000000", recoupedMicro: "58000000000", expenseMicro: "0", paidMicro: "74000000000", netPayableMicro: "74000000000", currency: "MUR" }
];

const payments: readonly PaymentSummary[] = [
  { id: "pay_alma", statementId: "stmt_alma", payeeId: "payee_alma", payeeName: "Alma Kreol", amountMicro: "136000000000", currency: "MUR", status: "queued", paidAt: null, reference: "MU-PAY-0142" },
  { id: "pay_avneesh", statementId: "stmt_avneesh", payeeId: "payee_avneesh", payeeName: "Avneesh", amountMicro: "84000000000", currency: "MUR", status: "draft", paidAt: null, reference: null },
  { id: "pay_babani", statementId: "stmt_babani", payeeId: "payee_babani", payeeName: "Babani estate", amountMicro: "74000000000", currency: "MUR", status: "paid", paidAt: "2026-06-04T10:30:00.000Z", reference: "MU-PAY-0130" }
];

const revenueRows: readonly DistributionRevenueRow[] = [
  { id: "rev_kontor_2026q01", label: "Kontor · 2026Q01", grossMicro: "2707631063", netMicro: "2707631063", payableMicro: "2707631063", currency: "EUR", barLevel: 100 },
  { id: "rev_routenote_2026_01", label: "RouteNote · Jan 2026", grossMicro: "920410040", netMicro: "920410040", payableMicro: "920410040", currency: "USD", barLevel: 34 },
  { id: "rev_label_bad", label: "BAD · RouteNote", grossMicro: "701884200", netMicro: "701884200", payableMicro: "701884200", currency: "USD", barLevel: 26 },
  { id: "rev_label_babani", label: "BABANI · Kontor", grossMicro: "643688247", netMicro: "643688247", payableMicro: "643688247", currency: "EUR", barLevel: 24 }
];

export function createDistributionPreviewClient(): EhqApiClient {
  return createApiClient({
    baseUrl: "https://preview.ehq.local",
    fetch: createDistributionPreviewFetch(),
    auth: {
      getAccessToken: async (): Promise<string | null> => "distribution-preview-token"
    },
    retryPolicy: standardApiRetryPolicy
  });
}

function createDistributionPreviewFetch(): FetchLike {
  return async (input: RequestInfo | URL, init: RequestInit): Promise<Response> => {
    const url = new URL(getRequestUrl(input));
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);

    if (headers.get("Authorization") !== "Bearer distribution-preview-token") {
      return createJsonResponse(createErrorPayload("preview_auth_missing", "Preview auth token missing.", url), 401);
    }

    if (!url.pathname.includes("/erh/v1/")) {
      return createJsonResponse(createErrorPayload("preview_namespace_missing", "Only erh/v1 preview routes exist.", url), 404);
    }

    return routeDistributionRequest(url, method, headers, init.body);
  };
}

function routeDistributionRequest(url: URL, method: string, headers: Headers, body: BodyInit | null | undefined): Response {
  if (method === "GET" && url.pathname.endsWith("/erh/v1/dashboard")) {
    return createJsonResponse(dashboard, 200);
  }

  if (method === "GET" && url.pathname.endsWith("/erh/v1/imports/batches")) {
    return createJsonResponse(createPageResult(filterImportBatches(url)), 200);
  }

  if (method === "POST" && url.pathname.endsWith("/erh/v1/imports/preview")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    const request = parseJsonBody<DistributionImportPreviewRequest>(body, url);
    return createJsonResponse(createImportPreviewResponse(request, idempotencyKey), 200);
  }

  if (method === "POST" && url.pathname.endsWith("/erh/v1/imports/confirm")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    const request = parseJsonBody<DistributionImportConfirmRequest>(body, url);
    return createJsonResponse(createImportConfirmResponse(request, idempotencyKey), 200);
  }

  if (method === "GET" && url.pathname.endsWith("/erh/v1/mapping/rows")) {
    return createJsonResponse(createPageResult(filterMappingRows(url)), 200);
  }

  if (method === "POST" && url.pathname.endsWith("/erh/v1/mapping/apply-rules")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    parseJsonBody<DistributionMappingApplyRulesRequest>(body, url);
    return createJsonResponse(createMutationReceipt("mapping_rules_preview", idempotencyKey), 202);
  }

  if (method === "GET" && url.pathname.endsWith("/erh/v1/payees")) {
    return createJsonResponse(createPageResult(payees), 200);
  }

  if (method === "GET" && url.pathname.endsWith("/erh/v1/releases")) {
    return createJsonResponse(createPageResult(releases), 200);
  }

  if (method === "GET" && url.pathname.endsWith("/erh/v1/tracks")) {
    return createJsonResponse(createPageResult(filterTracks(url)), 200);
  }

  if (method === "GET" && url.pathname.endsWith("/erh/v1/contracts")) {
    return createJsonResponse(createPageResult(contracts), 200);
  }

  if (method === "GET" && url.pathname.includes("/erh/v1/contracts/") && url.pathname.endsWith("/expenses")) {
    return createJsonResponse(createPageResult(filterExpenses(url)), 200);
  }

  if (method === "POST" && url.pathname.includes("/erh/v1/contracts/") && url.pathname.endsWith("/expenses")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    return createJsonResponse(createMutationReceipt("expense_preview", idempotencyKey), 202);
  }

  if (method === "GET" && url.pathname.endsWith("/erh/v1/allocations/runs")) {
    return createJsonResponse(createPageResult(allocationRuns), 200);
  }

  if (method === "GET" && url.pathname.includes("/erh/v1/allocations/runs/")) {
    return createJsonResponse(allocationRuns[0], 200);
  }

  if (method === "POST" && url.pathname.endsWith("/erh/v1/allocations/runs/preview")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    const request = parseJsonBody<AllocationRunPreviewRequest>(body, url);
    return createJsonResponse(createRunReceipt("preview", request.lockKey, idempotencyKey), 202);
  }

  if (method === "POST" && url.pathname.endsWith("/erh/v1/allocations/runs")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    const request = parseJsonBody<AllocationRunStartRequest>(body, url);
    return createJsonResponse(createRunReceipt(request.cadence, request.lockKey, idempotencyKey), 202);
  }

  if (method === "POST" && url.pathname.includes("/erh/v1/allocations/runs/") && url.pathname.endsWith("/unpost")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    const request = parseJsonBody<AllocationRunUnpostRequest>(body, url);
    return createJsonResponse(createRunReceipt(request.lockToken, "distribution:allocations:unpost", idempotencyKey), 202);
  }

  if (method === "GET" && url.pathname.endsWith("/erh/v1/suspense")) {
    return createJsonResponse(createPageResult(filterSuspense(url)), 200);
  }

  if (method === "POST" && url.pathname.includes("/erh/v1/suspense/") && url.pathname.endsWith("/resolve")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    parseJsonBody<SuspenseResolveRequest>(body, url);
    return createJsonResponse(createMutationReceipt("suspense_resolved_preview", idempotencyKey), 202);
  }

  if (method === "GET" && url.pathname.endsWith("/erh/v1/statements")) {
    return createJsonResponse(createPageResult(statements), 200);
  }

  if (method === "POST" && url.pathname.endsWith("/erh/v1/statements/generate")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    const request = parseJsonBody<StatementGenerateRequest>(body, url);
    return createJsonResponse(createRunReceipt("statements", request.lockKey, idempotencyKey), 202);
  }

  if (method === "GET" && url.pathname.endsWith("/erh/v1/payments")) {
    return createJsonResponse(createPageResult(payments), 200);
  }

  if (method === "POST" && url.pathname.endsWith("/erh/v1/payments")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    parseJsonBody<PaymentRecordRequest>(body, url);
    return createJsonResponse(createMutationReceipt("payment_recorded_preview", idempotencyKey), 202);
  }

  if (method === "PATCH" && url.pathname.includes("/erh/v1/payments/")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    parseJsonBody<PaymentUpdateRequest>(body, url);
    return createJsonResponse(createMutationReceipt("payment_updated_preview", idempotencyKey), 202);
  }

  if (method === "POST" && url.pathname.includes("/erh/v1/payments/") && url.pathname.endsWith("/reconcile")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    parseJsonBody<PaymentReconcileRequest>(body, url);
    return createJsonResponse(createMutationReceipt("payment_reconciled_preview", idempotencyKey), 202);
  }

  if (method === "GET" && url.pathname.endsWith("/erh/v1/revenue")) {
    return createJsonResponse(createPageResult(revenueRows), 200);
  }

  return createJsonResponse(createErrorPayload("preview_route_missing", "Preview route is not implemented.", url), 404);
}

function filterImportBatches(url: URL): readonly DistributionImportBatch[] {
  const source = getNullableQueryValue(url, "source");
  const status = getNullableQueryValue(url, "status");

  return importBatches.filter((batch: DistributionImportBatch): boolean => {
    const sourceMatches = source === null || batch.source === source;
    const statusMatches = status === null || batch.status === status;

    return sourceMatches && statusMatches;
  });
}

function filterMappingRows(url: URL): readonly DistributionMappingRow[] {
  const batchId = getNullableQueryValue(url, "batchId");
  const status = getNullableQueryValue(url, "status");

  return mappingRows.filter((row: DistributionMappingRow): boolean => {
    const batchMatches = batchId === null || row.batchId === batchId;
    const statusMatches = status === null || row.status === status;

    return batchMatches && statusMatches;
  });
}

function filterTracks(url: URL): readonly TrackSummary[] {
  const releaseId = getNullableQueryValue(url, "releaseId");

  if (releaseId === null) {
    return tracks;
  }

  return tracks.filter((track: TrackSummary): boolean => track.releaseId === releaseId);
}

function filterExpenses(url: URL): readonly DistributionContractExpense[] {
  const pathParts = url.pathname.split("/");
  const contractIndex = pathParts.findIndex((part: string): boolean => part === "contracts");
  const contractId = pathParts[contractIndex + 1] ?? "";

  return expenses.filter((expense: DistributionContractExpense): boolean => expense.contractId === contractId);
}

function filterSuspense(url: URL): readonly SuspenseItem[] {
  const status = getNullableQueryValue(url, "status");

  if (status === null) {
    return suspenseItems;
  }

  return suspenseItems.filter((item: SuspenseItem): boolean => item.status === status);
}

function createImportPreviewResponse(
  request: DistributionImportPreviewRequest,
  idempotencyKey: IdempotencyKey
): DistributionImportPreviewResponse {
  if (request.source === "kontor") {
    return {
      previewId: `preview_${request.source}_${idempotencyKey}`,
      source: request.source,
      statementReference: "1A02610196",
      accountReference: "738853-001",
      acceptedRowCount: 13385,
      rejectedRowCount: 0,
      unmappedRowCount: 3,
      payableMicro: "2707631063",
      currencyCodes: ["EUR"],
      joinKeys: ["ISRC", "EAN/UPC", "Art.No."],
      idempotencyFingerprint: "kontor:1A02610196:738853-001",
      warnings: ["Kontor statement period 2026Q01 contains sales periods 202510 to 202602."]
    };
  }

  return {
    previewId: `preview_${request.source}_${idempotencyKey}`,
    source: request.source,
    statementReference: "hash:RNSales_Jan2026_eeeemusic",
    accountReference: "eeee-music",
    acceptedRowCount: 3640,
    rejectedRowCount: 1,
    unmappedRowCount: 14,
    payableMicro: "920410040",
    currencyCodes: ["USD"],
    joinKeys: ["ISRC", "UPC/EAN"],
    idempotencyFingerprint: "routenote:hash:RNSales_Jan2026_eeeemusic:2026-01",
    warnings: ["1 RouteNote total/footer row skipped.", "14 RouteNote rows need mapping review."]
  };
}

function createImportConfirmResponse(
  request: DistributionImportConfirmRequest,
  idempotencyKey: IdempotencyKey
): DistributionImportConfirmResponse {
  return {
    ...createMutationReceipt(request.previewId, idempotencyKey),
    importedRoyaltyEventCount: request.previewId.includes("routenote") ? 3640 : 13385
  };
}

function createRunReceipt(mode: string, lockKey: string, idempotencyKey: IdempotencyKey): ApiRunReceipt {
  return {
    runId: `run_${mode}_${idempotencyKey}`,
    status: "queued",
    lockKey,
    auditEventId: `audit_${idempotencyKey}`
  };
}

function createMutationReceipt(entityId: string, idempotencyKey: IdempotencyKey): ApiMutationReceipt {
  return {
    id: entityId,
    status: "accepted",
    auditEventId: `audit_${idempotencyKey}`
  };
}

function createPageResult<TItem>(items: readonly TItem[]): PageResult<TItem> {
  return {
    items,
    nextCursor: null
  };
}

function requireIdempotencyKey(headers: Headers, url: URL): IdempotencyKey {
  const idempotencyKey = headers.get("Idempotency-Key");

  if (idempotencyKey === null || idempotencyKey.trim().length === 0) {
    throw new Error(`Idempotency-Key missing for preview route: ${url.pathname}`);
  }

  return idempotencyKey;
}

function parseJsonBody<TBody>(body: BodyInit | null | undefined, url: URL): TBody {
  if (typeof body !== "string") {
    throw new Error(`Preview request body must be JSON text: ${url.pathname}`);
  }

  return JSON.parse(body) as TBody;
}

function getNullableQueryValue(url: URL, key: string): string | null {
  const value = url.searchParams.get(key);

  if (value === null || value.length === 0) {
    return null;
  }

  return value;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) {
    return input.href;
  }

  if (typeof input === "string") {
    return input;
  }

  return input.url;
}

function createJsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "distribution-preview-api"
    }
  });
}

function createErrorPayload(code: string, message: string, url: URL): Readonly<Record<string, string | readonly string[]>> {
  return {
    code,
    message,
    context: [`path=${url.pathname}`]
  };
}

export { workspaceId as distributionPreviewWorkspaceId, period as distributionPreviewPeriod };
