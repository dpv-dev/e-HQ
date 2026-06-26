<script lang="ts">
  import { onMount } from "svelte";
  import type { AuthSession } from "@ehq/auth";
  import {
    createErrorState,
    createIdleState,
    createLoadingState,
    createSuccessState,
    type ApiMutationReceipt,
    type ApiRequestState,
    type ApiRunReceipt,
    type AllocationRunSummary,
    type AuditLogEntry,
    type CurrencyCode,
    type DistributionAlias,
    type DistributionContract,
    type DistributionContractExpense,
    type DistributionDashboardResponse,
    type DistributionDuplicate,
    type DistributionImportBatch,
    type DistributionImportConfirmResponse,
    type DistributionImportPreviewRequest,
    type DistributionImportPreviewResponse,
    type DistributionMappingRow,
    type DistributionReconciliationResponse,
    type DistributionRevenueRow,
    type DistributionSettingsResponse,
    type PageResult,
    type PayeeSummary,
    type PaymentSummary,
    type ReleaseSummary,
    type StatementSummary,
    type SuspenseItem,
    type TrackSummary
  } from "@ehq/api-client";
  import { BarsChart, KPI, Loader, Table, Toolbar } from "@ehq/ui";
  import type { ChartPoint, SelectOption, TableColumn, TableRow, Tone, ToolbarFilter } from "@ehq/ui";
  import { createShellApiClient } from "../../app-shell-data.js";
  import { formatMoneyValue, moneyToneForValue } from "../../money-format.js";

  type DistributionPageId =
    | "dashboard"
    | "imports"
    | "mapping"
    | "catalog"
    | "contracts"
    | "allocations"
    | "suspense"
    | "statements"
    | "payments"
    | "revenue"
    | "financial-reconciliation"
    | "aliases"
    | "duplicates"
    | "audit-log"
    | "settings";
  type ImportSourceFilter = "all" | "kontor" | "routenote";
  type ImportSource = "kontor" | "routenote";
  type MappingStatusFilter = "all" | "unmapped" | "suggested" | "mapped";
  type SuspenseStatusFilter = "all" | "open" | "resolved";
  type PaymentStatusFilter = "all" | "draft" | "queued" | "paid" | "voided";
  type RevenueGroupBy = "payee" | "track" | "currency" | "store" | "period";
  type RequestStatus = "idle" | "loading" | "success" | "error";

  interface Props {
    readonly session: AuthSession;
    readonly onLogout: () => void;
  }

  interface DistributionNavItem {
    readonly id: DistributionPageId;
    readonly label: string;
    readonly title: string;
    readonly subtitle: string;
  }

  interface ImportUiState {
    readonly status: RequestStatus;
    readonly source: ImportSource;
    readonly fileName: string;
    readonly preview: DistributionImportPreviewResponse | null;
    readonly confirm: DistributionImportConfirmResponse | null;
    readonly message: string;
  }

  interface DistributionKpi {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly accent: boolean;
  }

  const { session, onLogout }: Props = $props();
  const client = createShellApiClient();
  const distributionWorkspaceId = "eeee-mu";
  const distributionPeriod = "2026-05";
  const allValue = "all";
  const allocationLockKey = `distribution:allocations:${distributionPeriod}`;
  const navItems: readonly DistributionNavItem[] = [
    { id: "dashboard", label: "Dashboard", title: "Dashboard", subtitle: "Royalty cockpit, blockers, and actions." },
    { id: "imports", label: "Imports", title: "Imports", subtitle: "Kontor and RouteNote exports, preview then confirm." },
    { id: "mapping", label: "Mapping", title: "Mapping", subtitle: "Review rows, automate safe matches, apply reusable rules." },
    { id: "catalog", label: "Catalog", title: "Catalog", subtitle: "Releases, tracks, contributors, and split health." },
    { id: "contracts", label: "Contracts", title: "Contracts", subtitle: "Splits, payees, expenses, and recoupments." },
    { id: "allocations", label: "Allocations", title: "Allocations", subtitle: "Preview/post/unpost through cadenced runs and server locks." },
    { id: "suspense", label: "Suspense", title: "Suspense", subtitle: "Grouped by reason with an exact fix path." },
    { id: "statements", label: "Statements", title: "Statements", subtitle: "Financial summary first, print-first A4 PDF." },
    { id: "payments", label: "Payments", title: "Payments", subtitle: "Record, edit, void, and reconcile payment records." },
    { id: "revenue", label: "Revenue", title: "Revenue", subtitle: "Financial view by payee, track, currency, store, or period." },
    { id: "financial-reconciliation", label: "Financial reconciliation", title: "Financial reconciliation", subtitle: "Read-only diagnostic of payments, statements, balances, and allocations." },
    { id: "aliases", label: "Aliases", title: "Aliases", subtitle: "Catalog aliases that route imported names to canonical entities." },
    { id: "duplicates", label: "Duplicates", title: "Duplicates", subtitle: "Potential duplicate records detected across the catalog." },
    { id: "audit-log", label: "Audit log", title: "Audit log", subtitle: "Distribution-scoped audit trail of recorded actions." },
    { id: "settings", label: "Settings", title: "Settings", subtitle: "Read-only workspace configuration for Distribution." }
  ];
  const importSourceOptions: readonly SelectOption[] = [
    { label: "Kontor", value: "kontor" },
    { label: "RouteNote", value: "routenote" }
  ];
  const importFilterOptions: readonly SelectOption[] = [
    { label: "All sources", value: allValue },
    { label: "Kontor", value: "kontor" },
    { label: "RouteNote", value: "routenote" }
  ];
  const mappingStatusOptions: readonly SelectOption[] = [
    { label: "All", value: allValue },
    { label: "Unmapped", value: "unmapped" },
    { label: "Suggested", value: "suggested" },
    { label: "Mapped", value: "mapped" }
  ];
  const suspenseStatusOptions: readonly SelectOption[] = [
    { label: "All", value: allValue },
    { label: "Open", value: "open" },
    { label: "Resolved", value: "resolved" }
  ];
  const paymentStatusOptions: readonly SelectOption[] = [
    { label: "All", value: allValue },
    { label: "Draft", value: "draft" },
    { label: "Queued", value: "queued" },
    { label: "Paid", value: "paid" },
    { label: "Voided", value: "voided" }
  ];
  const revenueGroupOptions: readonly SelectOption[] = [
    { label: "Store", value: "store" },
    { label: "Payee", value: "payee" },
    { label: "Track", value: "track" },
    { label: "Currency", value: "currency" },
    { label: "Period", value: "period" }
  ];
  const emptyAliases: PageResult<DistributionAlias> = { items: [], nextCursor: null };
  const emptyDuplicates: PageResult<DistributionDuplicate> = { items: [], nextCursor: null };
  const emptyAuditEntries: PageResult<AuditLogEntry> = { items: [], nextCursor: null };
  const readOnlySettings: DistributionSettingsResponse = {
    workspaceId: distributionWorkspaceId,
    namespace: "erh/v1",
    reads: "live",
    payeeCount: 0,
    contractCount: 0,
    currencies: [],
    fxRateCount: 0,
    mutationsEnabled: false
  };
  const reconciliationFallback: DistributionReconciliationResponse = {
    kpis: [
      { id: "statements-open", label: "Open statements", value: "3", detail: "sample diagnostic", tone: "info" },
      { id: "statements-unlinked", label: "Unlinked statements", value: "3", detail: "payment links pending", tone: "warning" },
      { id: "expense-terms", label: "Expense terms", value: "2", detail: "missing payee review", tone: "warning" },
      { id: "matched-unallocated", label: "Matched unallocated", value: "2", detail: "import rows", tone: "warning" },
      { id: "balances", label: "Payee balances", value: "3", detail: "append-only rows", tone: "info" },
      { id: "currencies", label: "Currencies", value: "2", detail: "EUR / USD", tone: "muted" },
      { id: "repair-actions", label: "Repair actions", value: "7", detail: "disabled", tone: "active" },
      { id: "writes", label: "Writes", value: "OFF", detail: "read-only front", tone: "success" },
      { id: "payments", label: "Payments", value: "0", detail: "no transfer path", tone: "muted" },
      { id: "audit", label: "Audit source", value: "pending", detail: "API source not live", tone: "muted" },
      { id: "locks", label: "Locks", value: "n/a", detail: "no mutation", tone: "muted" },
      { id: "status", label: "Status", value: "preview", detail: "diagnostic only", tone: "success" }
    ],
    statementsWithoutPaymentLinks: [
      { id: "stmt-joker-2025", payee: "JOKER KARTEL", periodStart: "2025-01-01", periodEnd: "2025-12-31", currency: "EUR", netPayableMicro: "0.0000000000" },
      { id: "stmt-stefano-2026", payee: "Stéfano Honoré", periodStart: "2026-01-01", periodEnd: "2026-05-31", currency: "EUR", netPayableMicro: "0.0000000000" },
      { id: "stmt-nono-2026", payee: "Nono", periodStart: "2026-01-01", periodEnd: "2026-05-31", currency: "USD", netPayableMicro: "0.0000000000" }
    ],
    expenseTermsMissingPayee: [
      { id: "expense-contract-review", contract: "Contract source review", description: "Source expense term has no linked payee in the preview diagnostic.", amountMicro: "0.0000000000", currency: "EUR", status: "review" },
      { id: "expense-payee-review", contract: "Payee bridge review", description: "Expense term awaits identity-link confirmation.", amountMicro: "0.0000000000", currency: "USD", status: "review" }
    ],
    matchedUnallocatedSamples: [
      { id: "matched-row-kontor", batch: "Kontor sample", track: "Matched row awaiting allocation run", currency: "EUR", grossMicro: "0.0000000000", status: "read-only" },
      { id: "matched-row-routenote", batch: "RouteNote sample", track: "Matched row awaiting allocation run", currency: "USD", grossMicro: "0.0000000000", status: "read-only" }
    ],
    payeeBalancesSummary: [
      { payee: "JOKER KARTEL", currency: "EUR", rows: 0, firstId: null, lastId: null, latestClosingMicro: "0.0000000000" },
      { payee: "Stéfano Honoré", currency: "EUR", rows: 0, firstId: null, lastId: null, latestClosingMicro: "0.0000000000" },
      { payee: "Nono", currency: "USD", rows: 0, firstId: null, lastId: null, latestClosingMicro: "0.0000000000" }
    ],
    actions: [
      { id: "link-statement-payment", label: "Link statement payment", description: "Would connect a recorded payment to an open statement after cutover.", maintenance: false },
      { id: "recompute-payee-balance", label: "Recompute payee balance", description: "Would append a balance recalculation row after cutover.", maintenance: false },
      { id: "assign-expense-payee", label: "Assign expense payee", description: "Would attach a contract expense term to a payee through the audited write path.", maintenance: false },
      { id: "allocate-matched-row", label: "Allocate matched row", description: "Would enqueue a locked allocation run for matched royalty rows.", maintenance: false },
      { id: "void-statement", label: "Void statement", description: "Would append reversal rows without deleting the original statement.", maintenance: true },
      { id: "repair-identity-link", label: "Repair identity link", description: "Would upsert the office partner and distribution payee bridge.", maintenance: true },
      { id: "refresh-derived-summary", label: "Refresh derived summary", description: "Would rebuild derived reconciliation summaries from canonical rows.", maintenance: true }
    ]
  };
  const dashboardColumns: readonly TableColumn[] = [
    { label: "Action", align: "left", sortable: true },
    { label: "Context", align: "left", sortable: true },
    { label: "Volume", align: "right", sortable: true },
    { label: "Fix path", align: "left", sortable: false }
  ];
  const importColumns: readonly TableColumn[] = [
    { label: "File", align: "left", sortable: true },
    { label: "Source", align: "left", sortable: true },
    { label: "Statement", align: "left", sortable: true },
    { label: "Rows", align: "right", sortable: true },
    { label: "Payable", align: "right", sortable: true },
    { label: "Unmatched", align: "right", sortable: true },
    { label: "Join keys", align: "left", sortable: false },
    { label: "Status", align: "left", sortable: true },
    { label: "Exact action", align: "left", sortable: false }
  ];
  const mappingColumns: readonly TableColumn[] = [
    { label: "Source title", align: "left", sortable: true },
    { label: "Artist", align: "left", sortable: true },
    { label: "Store", align: "left", sortable: true },
    { label: "Suggested match", align: "left", sortable: true },
    { label: "Confidence", align: "left", sortable: true },
    { label: "Fix path", align: "left", sortable: false }
  ];
  const catalogColumns: readonly TableColumn[] = [
    { label: "Title", align: "left", sortable: true },
    { label: "Artist", align: "left", sortable: true },
    { label: "ID", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Contributors", align: "right", sortable: true },
    { label: "Split", align: "left", sortable: true }
  ];
  const contractColumns: readonly TableColumn[] = [
    { label: "Contract", align: "left", sortable: true },
    { label: "Payee", align: "left", sortable: true },
    { label: "Split", align: "right", sortable: true },
    { label: "Open expenses", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const expenseColumns: readonly TableColumn[] = [
    { label: "Expense", align: "left", sortable: true },
    { label: "Date", align: "left", sortable: true },
    { label: "Original", align: "right", sortable: true },
    { label: "Open", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const allocationColumns: readonly TableColumn[] = [
    { label: "Run", align: "left", sortable: true },
    { label: "Period", align: "left", sortable: true },
    { label: "Lock", align: "left", sortable: false },
    { label: "Input", align: "right", sortable: true },
    { label: "Allocated", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const suspenseColumns: readonly TableColumn[] = [
    { label: "Reason", align: "left", sortable: true },
    { label: "Source", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Fix path", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const statementColumns: readonly TableColumn[] = [
    { label: "Payee", align: "left", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Recoup", align: "right", sortable: true },
    { label: "Expenses", align: "right", sortable: true },
    { label: "Paid", align: "right", sortable: true },
    { label: "Due", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const paymentColumns: readonly TableColumn[] = [
    { label: "Payee", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Reference", align: "left", sortable: true },
    { label: "Paid at", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const revenueColumns: readonly TableColumn[] = [
    { label: "Group", align: "left", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true },
    { label: "Payable", align: "right", sortable: true },
    { label: "Currency", align: "left", sortable: true }
  ];
  const reconStatementColumns: readonly TableColumn[] = [
    { label: "Statement", align: "left", sortable: true },
    { label: "Payee", align: "left", sortable: true },
    { label: "Period", align: "left", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Net payable", align: "right", sortable: true }
  ];
  const reconExpenseColumns: readonly TableColumn[] = [
    { label: "Cost term", align: "left", sortable: true },
    { label: "Contract", align: "left", sortable: true },
    { label: "Description", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const reconMatchedColumns: readonly TableColumn[] = [
    { label: "Earning", align: "left", sortable: true },
    { label: "Batch", align: "left", sortable: true },
    { label: "Track", align: "left", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const reconBalanceColumns: readonly TableColumn[] = [
    { label: "Payee", align: "left", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Rows", align: "right", sortable: true },
    { label: "First id", align: "left", sortable: false },
    { label: "Last id", align: "left", sortable: false },
    { label: "Latest closing", align: "right", sortable: true }
  ];
  const aliasColumns: readonly TableColumn[] = [
    { label: "Alias", align: "left", sortable: true },
    { label: "Target", align: "left", sortable: true },
    { label: "Type", align: "left", sortable: true }
  ];
  const duplicateColumns: readonly TableColumn[] = [
    { label: "Label", align: "left", sortable: true },
    { label: "Kind", align: "left", sortable: true },
    { label: "Count", align: "right", sortable: true },
    { label: "Samples", align: "left", sortable: false },
    { label: "Merge", align: "left", sortable: false }
  ];
  const auditColumns: readonly TableColumn[] = [
    { label: "When", align: "left", sortable: true },
    { label: "Actor", align: "left", sortable: true },
    { label: "Action", align: "left", sortable: true },
    { label: "Entity", align: "left", sortable: true }
  ];

  let activePageId = $state<DistributionPageId>("dashboard");
  let dashboardState = $state<ApiRequestState<DistributionDashboardResponse>>(
    createIdleState<DistributionDashboardResponse>()
  );
  let importBatchesState = $state<ApiRequestState<PageResult<DistributionImportBatch>>>(
    createIdleState<PageResult<DistributionImportBatch>>()
  );
  let mappingState = $state<ApiRequestState<PageResult<DistributionMappingRow>>>(
    createIdleState<PageResult<DistributionMappingRow>>()
  );
  let payeesState = $state<ApiRequestState<PageResult<PayeeSummary>>>(createIdleState<PageResult<PayeeSummary>>());
  let releasesState = $state<ApiRequestState<PageResult<ReleaseSummary>>>(createIdleState<PageResult<ReleaseSummary>>());
  let tracksState = $state<ApiRequestState<PageResult<TrackSummary>>>(createIdleState<PageResult<TrackSummary>>());
  let contractsState = $state<ApiRequestState<PageResult<DistributionContract>>>(
    createIdleState<PageResult<DistributionContract>>()
  );
  let expensesState = $state<ApiRequestState<PageResult<DistributionContractExpense>>>(
    createIdleState<PageResult<DistributionContractExpense>>()
  );
  let allocationsState = $state<ApiRequestState<PageResult<AllocationRunSummary>>>(
    createIdleState<PageResult<AllocationRunSummary>>()
  );
  let suspenseState = $state<ApiRequestState<PageResult<SuspenseItem>>>(createIdleState<PageResult<SuspenseItem>>());
  let statementsState = $state<ApiRequestState<PageResult<StatementSummary>>>(
    createIdleState<PageResult<StatementSummary>>()
  );
  let paymentsState = $state<ApiRequestState<PageResult<PaymentSummary>>>(createIdleState<PageResult<PaymentSummary>>());
  let revenueState = $state<ApiRequestState<PageResult<DistributionRevenueRow>>>(
    createIdleState<PageResult<DistributionRevenueRow>>()
  );
  let reconciliationState = $state<ApiRequestState<DistributionReconciliationResponse>>(
    createIdleState<DistributionReconciliationResponse>()
  );
  let aliasesState = $state<ApiRequestState<PageResult<DistributionAlias>>>(
    createIdleState<PageResult<DistributionAlias>>()
  );
  let duplicatesState = $state<ApiRequestState<PageResult<DistributionDuplicate>>>(
    createIdleState<PageResult<DistributionDuplicate>>()
  );
  let auditLogState = $state<ApiRequestState<PageResult<AuditLogEntry>>>(
    createIdleState<PageResult<AuditLogEntry>>()
  );
  let settingsState = $state<ApiRequestState<DistributionSettingsResponse>>(
    createIdleState<DistributionSettingsResponse>()
  );
  let importSourceFilter = $state<ImportSourceFilter>(allValue);
  let mappingStatusFilter = $state<MappingStatusFilter>("suggested");
  let suspenseStatusFilter = $state<SuspenseStatusFilter>("open");
  let paymentStatusFilter = $state<PaymentStatusFilter>(allValue);
  let revenueGroupBy = $state<RevenueGroupBy>("store");
  let importState = $state<ImportUiState>({
    status: "idle",
    source: "routenote",
    fileName: "RNSales_Jan2026_eeeemusic.xlsx",
    preview: null,
    confirm: null,
    message: "RouteNote or Kontor export ready for preview."
  });
  let runReceipt = $state<ApiRunReceipt | null>(null);
  let mutationReceipt = $state<ApiMutationReceipt | null>(null);
  let runReceiptPageId = $state<DistributionPageId | null>(null);
  let mutationReceiptPageId = $state<DistributionPageId | null>(null);

  const activePage = $derived(getNavItem(activePageId));
  const dashboardKpis = $derived(createDashboardKpis(dashboardState));
  const importBatches = $derived(readPageItems(importBatchesState));
  const mappingRows = $derived(readPageItems(mappingState));
  const payees = $derived(readPageItems(payeesState));
  const releases = $derived(readPageItems(releasesState));
  const tracks = $derived(readPageItems(tracksState));
  const contracts = $derived(readPageItems(contractsState));
  const expenses = $derived(readPageItems(expensesState));
  const allocationRuns = $derived(readPageItems(allocationsState));
  const suspenseItems = $derived(readPageItems(suspenseState));
  const statements = $derived(readPageItems(statementsState));
  const payments = $derived(readPageItems(paymentsState));
  const revenueRows = $derived(readPageItems(revenueState));
  const dashboardRows = $derived(createDashboardRows(suspenseItems, statements, payments));
  const importRows = $derived(createImportRows(importBatches));
  const mappingTableRows = $derived(createMappingRows(mappingRows));
  const catalogRows = $derived(createCatalogRows(releases, tracks));
  const contractRows = $derived(createContractRows(contracts, payees));
  const expenseRows = $derived(createExpenseRows(expenses));
  const allocationRows = $derived(createAllocationRows(allocationRuns));
  const suspenseTableRows = $derived(createSuspenseRows(suspenseItems));
  const statementRows = $derived(createStatementRows(statements));
  const paymentRows = $derived(createPaymentRows(payments));
  const revenueTableRows = $derived(createRevenueRows(revenueRows));
  const revenueChartPoints = $derived(createRevenueChartPoints(revenueRows));
  const reconciliation = $derived(reconciliationState.status === "success" ? reconciliationState.data : null);
  const reconciliationKpis = $derived(createReconciliationKpis(reconciliation));
  const reconStatementRows = $derived(createReconStatementRows(reconciliation));
  const reconExpenseRows = $derived(createReconExpenseRows(reconciliation));
  const reconMatchedRows = $derived(createReconMatchedRows(reconciliation));
  const reconBalanceRows = $derived(createReconBalanceRows(reconciliation));
  const aliases = $derived(readPageItems(aliasesState));
  const duplicates = $derived(readPageItems(duplicatesState));
  const auditEntries = $derived(readPageItems(auditLogState));
  const aliasRows = $derived(createAliasRows(aliases));
  const duplicateRows = $derived(createDuplicateRows(duplicates));
  const auditRows = $derived(createAuditRows(auditEntries));
  const settings = $derived(settingsState.status === "success" ? settingsState.data : null);
  const importToolbarFilters = $derived(createImportToolbarFilters(importState));
  const canConfirmImport = $derived(importState.preview !== null && importState.status !== "loading");
  const statementPreview = $derived(statements[0] ?? null);

  onMount((): (() => void) => {
    syncPageFromLocation();
    window.addEventListener("popstate", syncPageFromLocation);
    void loadInitialData();

    return (): void => {
      window.removeEventListener("popstate", syncPageFromLocation);
    };
  });

  async function loadInitialData(): Promise<void> {
    await Promise.all([
      loadDashboard(),
      loadImportBatches(),
      loadMappingRows(),
      loadPayees(),
      loadCatalog(),
      loadContracts(),
      loadAllocationRuns(),
      loadSuspense(),
      loadStatements(),
      loadPayments(),
      loadRevenue(),
      loadReconciliation(),
      loadAliases(),
      loadDuplicates(),
      loadAuditLog(),
      loadSettings()
    ]);
  }

  async function loadDashboard(): Promise<void> {
    dashboardState = createLoadingState<DistributionDashboardResponse>();

    try {
      dashboardState = createSuccessState<DistributionDashboardResponse>(
        await client.distribution.getDashboard({ workspaceId: distributionWorkspaceId, period: distributionPeriod })
      );
    } catch (error: unknown) {
      dashboardState = createErrorState<DistributionDashboardResponse>(error);
    }
  }

  async function loadImportBatches(): Promise<void> {
    importBatchesState = createLoadingState<PageResult<DistributionImportBatch>>();

    try {
      importBatchesState = createSuccessState<PageResult<DistributionImportBatch>>(
        await client.distribution.listImportBatches({
          workspaceId: distributionWorkspaceId,
          source: toNullableImportSource(importSourceFilter),
          status: null,
          cursor: null,
          limit: 50
        })
      );
    } catch (error: unknown) {
      importBatchesState = createErrorState<PageResult<DistributionImportBatch>>(error);
    }
  }

  async function loadMappingRows(): Promise<void> {
    mappingState = createLoadingState<PageResult<DistributionMappingRow>>();

    try {
      mappingState = createSuccessState<PageResult<DistributionMappingRow>>(
        await client.distribution.listMappingRows({
          workspaceId: distributionWorkspaceId,
          batchId: null,
          status: toNullableMappingStatus(mappingStatusFilter),
          cursor: null,
          limit: 50
        })
      );
    } catch (error: unknown) {
      mappingState = createErrorState<PageResult<DistributionMappingRow>>(error);
    }
  }

  async function loadPayees(): Promise<void> {
    payeesState = createLoadingState<PageResult<PayeeSummary>>();

    try {
      payeesState = createSuccessState<PageResult<PayeeSummary>>(
        await client.distribution.listPayees({ workspaceId: distributionWorkspaceId, status: null, cursor: null, limit: 50 })
      );
    } catch (error: unknown) {
      payeesState = createErrorState<PageResult<PayeeSummary>>(error);
    }
  }

  async function loadCatalog(): Promise<void> {
    releasesState = createLoadingState<PageResult<ReleaseSummary>>();
    tracksState = createLoadingState<PageResult<TrackSummary>>();

    try {
      const [releasePage, trackPage] = await Promise.all([
        client.distribution.listReleases({ workspaceId: distributionWorkspaceId, status: null, cursor: null, limit: 50 }),
        client.distribution.listTracks({ workspaceId: distributionWorkspaceId, releaseId: null, status: null, cursor: null, limit: 50 })
      ]);
      releasesState = createSuccessState<PageResult<ReleaseSummary>>(releasePage);
      tracksState = createSuccessState<PageResult<TrackSummary>>(trackPage);
    } catch (error: unknown) {
      releasesState = createErrorState<PageResult<ReleaseSummary>>(error);
      tracksState = createErrorState<PageResult<TrackSummary>>(error);
    }
  }

  async function loadContracts(): Promise<void> {
    contractsState = createLoadingState<PageResult<DistributionContract>>();
    expensesState = createLoadingState<PageResult<DistributionContractExpense>>();

    try {
      const contractPage = await client.distribution.listContracts({
        workspaceId: distributionWorkspaceId,
        payeeId: null,
        status: null,
        cursor: null,
        limit: 50
      });
      const firstContract = contractPage.items[0];
      const expensePage = await client.distribution.listContractExpenses({
        workspaceId: distributionWorkspaceId,
        contractId: firstContract?.id ?? "contract_alma",
        status: null,
        cursor: null,
        limit: 50
      });
      contractsState = createSuccessState<PageResult<DistributionContract>>(contractPage);
      expensesState = createSuccessState<PageResult<DistributionContractExpense>>(expensePage);
    } catch (error: unknown) {
      contractsState = createErrorState<PageResult<DistributionContract>>(error);
      expensesState = createErrorState<PageResult<DistributionContractExpense>>(error);
    }
  }

  async function loadAllocationRuns(): Promise<void> {
    allocationsState = createLoadingState<PageResult<AllocationRunSummary>>();

    try {
      allocationsState = createSuccessState<PageResult<AllocationRunSummary>>(
        await client.distribution.listAllocationRuns({
          workspaceId: distributionWorkspaceId,
          period: null,
          status: null,
          cursor: null,
          limit: 50
        })
      );
    } catch (error: unknown) {
      allocationsState = createErrorState<PageResult<AllocationRunSummary>>(error);
    }
  }

  async function loadSuspense(): Promise<void> {
    suspenseState = createLoadingState<PageResult<SuspenseItem>>();

    try {
      suspenseState = createSuccessState<PageResult<SuspenseItem>>(
        await client.distribution.listSuspense({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          status: toNullableSuspenseStatus(suspenseStatusFilter),
          cursor: null,
          limit: 50
        })
      );
    } catch (error: unknown) {
      suspenseState = createErrorState<PageResult<SuspenseItem>>(error);
    }
  }

  async function loadStatements(): Promise<void> {
    statementsState = createLoadingState<PageResult<StatementSummary>>();

    try {
      statementsState = createSuccessState<PageResult<StatementSummary>>(
        await client.distribution.listStatements({
          workspaceId: distributionWorkspaceId,
          period: null,
          payeeId: null,
          status: null,
          cursor: null,
          limit: 50
        })
      );
    } catch (error: unknown) {
      statementsState = createErrorState<PageResult<StatementSummary>>(error);
    }
  }

  async function loadPayments(): Promise<void> {
    paymentsState = createLoadingState<PageResult<PaymentSummary>>();

    try {
      paymentsState = createSuccessState<PageResult<PaymentSummary>>(
        await client.distribution.listPayments({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: null,
          status: toNullablePaymentStatus(paymentStatusFilter),
          cursor: null,
          limit: 50
        })
      );
    } catch (error: unknown) {
      paymentsState = createErrorState<PageResult<PaymentSummary>>(error);
    }
  }

  async function loadRevenue(): Promise<void> {
    revenueState = createLoadingState<PageResult<DistributionRevenueRow>>();

    try {
      revenueState = createSuccessState<PageResult<DistributionRevenueRow>>(
        await client.distribution.getRevenue({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: null,
          store: null,
          currency: null,
          groupBy: revenueGroupBy,
          cursor: null,
          limit: 50
        })
      );
    } catch (error: unknown) {
      revenueState = createErrorState<PageResult<DistributionRevenueRow>>(error);
    }
  }

  async function loadReconciliation(): Promise<void> {
    reconciliationState = createSuccessState<DistributionReconciliationResponse>(reconciliationFallback);
  }

  async function loadAliases(): Promise<void> {
    aliasesState = createSuccessState<PageResult<DistributionAlias>>(emptyAliases);
  }

  async function loadDuplicates(): Promise<void> {
    duplicatesState = createSuccessState<PageResult<DistributionDuplicate>>(emptyDuplicates);
  }

  async function loadAuditLog(): Promise<void> {
    auditLogState = createSuccessState<PageResult<AuditLogEntry>>(emptyAuditEntries);
  }

  async function loadSettings(): Promise<void> {
    settingsState = createSuccessState<DistributionSettingsResponse>(readOnlySettings);
  }

  function selectPage(pageId: DistributionPageId): void {
    activePageId = pageId;
    clearActionReceipts();
    pushPagePath(pageId);
  }

  function syncPageFromLocation(): void {
    activePageId = readPageIdFromPath(window.location.pathname);
  }

  function pushPagePath(pageId: DistributionPageId): void {
    const nextPath = pagePath(pageId);
    const currentPath = window.location.pathname;

    if (currentPath === nextPath) {
      return;
    }

    window.history.pushState(null, "", `${nextPath}${window.location.search}`);
  }

  function readPageIdFromPath(pathname: string): DistributionPageId {
    if (pathname.endsWith("/console/distribution/imports")) {
      return "imports";
    }

    if (pathname.endsWith("/console/distribution/mapping")) {
      return "mapping";
    }

    if (pathname.endsWith("/console/distribution/catalog")) {
      return "catalog";
    }

    if (pathname.endsWith("/console/distribution/contracts")) {
      return "contracts";
    }

    if (pathname.endsWith("/console/distribution/allocations")) {
      return "allocations";
    }

    if (pathname.endsWith("/console/distribution/suspense")) {
      return "suspense";
    }

    if (pathname.endsWith("/console/distribution/statements")) {
      return "statements";
    }

    if (pathname.endsWith("/console/distribution/payments")) {
      return "payments";
    }

    if (pathname.endsWith("/console/distribution/revenue")) {
      return "revenue";
    }

    if (pathname.endsWith("/console/distribution/financial-reconciliation")) {
      return "financial-reconciliation";
    }

    if (pathname.endsWith("/console/distribution/aliases")) {
      return "aliases";
    }

    if (pathname.endsWith("/console/distribution/duplicates")) {
      return "duplicates";
    }

    if (pathname.endsWith("/console/distribution/audit-log")) {
      return "audit-log";
    }

    if (pathname.endsWith("/console/distribution/settings")) {
      return "settings";
    }

    return "dashboard";
  }

  function pagePath(pageId: DistributionPageId): string {
    if (pageId === "imports") {
      return "/console/distribution/imports";
    }

    if (pageId === "mapping") {
      return "/console/distribution/mapping";
    }

    if (pageId === "catalog") {
      return "/console/distribution/catalog";
    }

    if (pageId === "contracts") {
      return "/console/distribution/contracts";
    }

    if (pageId === "allocations") {
      return "/console/distribution/allocations";
    }

    if (pageId === "suspense") {
      return "/console/distribution/suspense";
    }

    if (pageId === "statements") {
      return "/console/distribution/statements";
    }

    if (pageId === "payments") {
      return "/console/distribution/payments";
    }

    if (pageId === "revenue") {
      return "/console/distribution/revenue";
    }

    if (pageId === "financial-reconciliation") {
      return "/console/distribution/financial-reconciliation";
    }

    if (pageId === "aliases") {
      return "/console/distribution/aliases";
    }

    if (pageId === "duplicates") {
      return "/console/distribution/duplicates";
    }

    if (pageId === "audit-log") {
      return "/console/distribution/audit-log";
    }

    if (pageId === "settings") {
      return "/console/distribution/settings";
    }

    return "/console/distribution/dashboard";
  }

  function clearActionReceipts(): void {
    runReceipt = null;
    mutationReceipt = null;
    runReceiptPageId = null;
    mutationReceiptPageId = null;
  }

  function clearMutationReceipt(): void {
    mutationReceipt = null;
    mutationReceiptPageId = null;
  }

  function clearRunReceipt(): void {
    runReceipt = null;
    runReceiptPageId = null;
  }

  function updateImportFilter(event: Event): void {
    importSourceFilter = readSelectValue(event) as ImportSourceFilter;
  }

  function updateImportSource(event: Event): void {
    importState = {
      ...importState,
      source: readSelectValue(event) as ImportSource,
      preview: null,
      confirm: null,
      message: "Source changed, run preview again."
    };
  }

  function updateImportFile(event: Event): void {
    importState = {
      ...importState,
      fileName: readInputValue(event),
      preview: null,
      confirm: null,
      message: "File ready for preview."
    };
  }

  function updateMappingStatus(event: Event): void {
    mappingStatusFilter = readSelectValue(event) as MappingStatusFilter;
  }

  function updateSuspenseStatus(event: Event): void {
    suspenseStatusFilter = readSelectValue(event) as SuspenseStatusFilter;
  }

  function updatePaymentStatus(event: Event): void {
    paymentStatusFilter = readSelectValue(event) as PaymentStatusFilter;
  }

  function updateRevenueGroup(event: Event): void {
    revenueGroupBy = readSelectValue(event) as RevenueGroupBy;
  }

  async function previewImport(): Promise<void> {
    importState = {
      ...importState,
      status: "loading",
      preview: null,
      confirm: null,
      message: "Import preview in progress."
    };

    try {
      const request: DistributionImportPreviewRequest = {
        workspaceId: distributionWorkspaceId,
        source: importState.source,
        fileName: importState.fileName,
        checksum: `checksum-${importState.source}-${importState.fileName}`,
        rows: [
          { row: "1", title: "Alma", store: importState.source },
          { row: "2", title: "Redlight", store: importState.source },
          { row: "3", title: "Untitled 03", store: importState.source }
        ]
      };
      const preview = await client.distribution.previewImport(request, {
        idempotencyKey: createIdempotencyKey("import-preview")
      });
      importState = {
        ...importState,
        status: "success",
        preview,
        confirm: null,
        message: "Kontor/RouteNote preview ready."
      };
    } catch (error: unknown) {
      importState = {
        ...importState,
        status: "error",
        preview: null,
        confirm: null,
        message: getErrorMessage(error)
      };
    }
  }

  async function confirmImport(): Promise<void> {
    if (importState.preview === null) {
      return;
    }

    importState = {
      ...importState,
      status: "loading",
      message: "Import confirmation in progress."
    };

    try {
      const confirm = await client.distribution.confirmImport(
        {
          workspaceId: distributionWorkspaceId,
          previewId: importState.preview.previewId,
          acceptedRowIds: ["row_1", "row_2", "row_3"],
          rejectedRowIds: []
        },
        {
          idempotencyKey: createIdempotencyKey("import-confirm")
        }
      );
      importState = {
        ...importState,
        status: "success",
        confirm,
        message: "Import confirmed."
      };
    } catch (error: unknown) {
      importState = {
        ...importState,
        status: "error",
        message: getErrorMessage(error)
      };
    }
  }

  async function applyMappingRules(): Promise<void> {
    const rowIds = mappingRows.map((row: DistributionMappingRow): string => row.id);

    if (rowIds.length === 0) {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.applyMappingRules(
        {
          workspaceId: distributionWorkspaceId,
          batchId: mappingRows[0]?.batchId ?? "batch_routenote_may",
          rowIds
        },
        {
          idempotencyKey: createIdempotencyKey("mapping-rules")
        }
      );
      mutationReceiptPageId = activePageId;
      mappingState = createSuccessState<PageResult<DistributionMappingRow>>({
        items: mappingRows.map((row: DistributionMappingRow): DistributionMappingRow => ({ ...row, status: "mapped" })),
        nextCursor: null
      });
    } catch (error: unknown) {
      mappingState = createErrorState<PageResult<DistributionMappingRow>>(error);
    }
  }

  async function recordExpense(): Promise<void> {
    const contract = contracts[0];

    if (contract === undefined) {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.recordContractExpense(
        {
          workspaceId: distributionWorkspaceId,
          contractId: contract.id,
          payeeId: contract.payeeId,
          incurredOn: "2026-05-18",
          label: "Advance preview",
          amountMicro: "6000000000",
          currency: contract.currency
        },
        {
          idempotencyKey: createIdempotencyKey("expense-record")
        }
      );
      mutationReceiptPageId = activePageId;
    } catch (error: unknown) {
      expensesState = createErrorState<PageResult<DistributionContractExpense>>(error);
    }
  }

  async function previewAllocationRun(): Promise<void> {
    clearMutationReceipt();

    runReceipt = await client.distribution.previewAllocationRun(
      {
        workspaceId: distributionWorkspaceId,
        period: distributionPeriod,
        lockKey: allocationLockKey
      },
      {
        idempotencyKey: createIdempotencyKey("allocation-preview")
      }
    );
    runReceiptPageId = activePageId;
  }

  async function startCadencedAllocationRun(): Promise<void> {
    clearMutationReceipt();

    runReceipt = await client.distribution.startCadencedAllocationRun(
      {
        workspaceId: distributionWorkspaceId,
        period: distributionPeriod,
        lockKey: allocationLockKey,
        cadence: "manual"
      },
      {
        idempotencyKey: createIdempotencyKey("allocation-cadenced")
      }
    );
    runReceiptPageId = activePageId;
  }

  async function unpostAllocationRun(): Promise<void> {
    const run = allocationRuns[0];

    if (run === undefined) {
      return;
    }

    clearMutationReceipt();

    runReceipt = await client.distribution.requestAllocationUnpostRun(
      run.id,
      {
        workspaceId: distributionWorkspaceId,
        reason: "Preview unpost request",
        lockToken: "preview-lock-token"
      },
      {
        idempotencyKey: createIdempotencyKey("allocation-unpost")
      }
    );
    runReceiptPageId = activePageId;
  }

  async function resolveFirstSuspense(): Promise<void> {
    const item = suspenseItems[0];

    if (item === undefined) {
      return;
    }

    clearRunReceipt();

    mutationReceipt = await client.distribution.resolveSuspense(
      {
        workspaceId: distributionWorkspaceId,
        suspenseId: item.id,
        resolution: suspenseResolutionFor(item),
        targetId: "track_alma",
        note: `Resolved through ${item.exactFixPath}`
      },
      {
        idempotencyKey: createIdempotencyKey("suspense-resolve")
      }
    );
    mutationReceiptPageId = activePageId;
    suspenseState = createSuccessState<PageResult<SuspenseItem>>({
      items: suspenseItems.map((candidate: SuspenseItem): SuspenseItem =>
        candidate.id === item.id ? { ...candidate, status: "resolved" } : candidate
      ),
      nextCursor: null
    });
  }

  async function generateStatements(): Promise<void> {
    clearMutationReceipt();

    runReceipt = await client.distribution.generateStatements(
      {
        workspaceId: distributionWorkspaceId,
        period: distributionPeriod,
        payeeIds: payees.map((payee: PayeeSummary): string => payee.id),
        lockKey: `distribution:statements:${distributionPeriod}`
      },
      {
        idempotencyKey: createIdempotencyKey("statements-generate")
      }
    );
    runReceiptPageId = activePageId;
  }

  async function recordPayment(): Promise<void> {
    const statement = statements[0];

    if (statement === undefined) {
      return;
    }

    clearRunReceipt();

    mutationReceipt = await client.distribution.recordPayment(
      {
        workspaceId: distributionWorkspaceId,
        statementId: statement.id,
        payeeId: statement.payeeId,
        amountMicro: statement.netPayableMicro,
        currency: statement.currency,
        paidAt: new Date().toISOString(),
        reference: "MU-PAY-PREVIEW"
      },
      {
        idempotencyKey: createIdempotencyKey("payment-record")
      }
    );
    mutationReceiptPageId = activePageId;
  }

  async function editPayment(): Promise<void> {
    const payment = payments[0];

    if (payment === undefined) {
      return;
    }

    clearRunReceipt();

    mutationReceipt = await client.distribution.updatePayment(
      payment.id,
      {
        workspaceId: distributionWorkspaceId,
        amountMicro: payment.amountMicro,
        currency: payment.currency,
        reference: "MU-PAY-UPDATED"
      },
      {
        idempotencyKey: createIdempotencyKey("payment-edit")
      }
    );
    mutationReceiptPageId = activePageId;
  }

  async function reconcilePayment(): Promise<void> {
    const payment = payments[0];

    if (payment === undefined) {
      return;
    }

    clearRunReceipt();

    mutationReceipt = await client.distribution.reconcilePayment(
      payment.id,
      {
        workspaceId: distributionWorkspaceId,
        bankTransactionId: "bank_tx_preview",
        reconciledAt: new Date().toISOString()
      },
      {
        idempotencyKey: createIdempotencyKey("payment-reconcile")
      }
    );
    mutationReceiptPageId = activePageId;
  }

  async function voidPayment(): Promise<void> {
    const payment = payments[0];

    if (payment === undefined) {
      return;
    }

    clearRunReceipt();

    mutationReceipt = await client.distribution.updatePayment(
      payment.id,
      {
        workspaceId: distributionWorkspaceId,
        amountMicro: "0",
        currency: payment.currency,
        reference: "VOID-PREVIEW"
      },
      {
        idempotencyKey: createIdempotencyKey("payment-void")
      }
    );
    mutationReceiptPageId = activePageId;
  }

  function getNavItem(pageId: DistributionPageId): DistributionNavItem {
    const item = navItems.find((navItem: DistributionNavItem): boolean => navItem.id === pageId);

    if (item === undefined) {
      throw new Error(`Unknown Distribution page: ${pageId}`);
    }

    return item;
  }

  function readPageItems<TItem>(state: ApiRequestState<PageResult<TItem>>): readonly TItem[] {
    if (state.status === "success") {
      return state.data.items;
    }

    return [];
  }

  function createDashboardKpis(state: ApiRequestState<DistributionDashboardResponse>): readonly DistributionKpi[] {
    if (state.status !== "success") {
      return [
        { label: "Gross", value: "—", detail: stateLabel(state), tone: "muted", accent: true },
        { label: "Recouped", value: "—", detail: "kernel", tone: "muted", accent: false },
        { label: "Payable", value: "—", detail: "statements", tone: "muted", accent: false },
        { label: "Suspense", value: "—", detail: "blockers", tone: "muted", accent: false }
      ];
    }

    return [
      { label: "Gross royalties", value: formatMicro(state.data.grossRoyaltyMicro), detail: state.data.period, tone: "info", accent: true },
      { label: "Recouped", value: formatMicro(state.data.recoupedMicro), detail: "audited source records", tone: "warning", accent: false },
      { label: "Net payable", value: formatMicro(state.data.netPayableMicro), detail: `${String(state.data.openStatementCount)} statements`, tone: "success", accent: false },
      { label: "Suspense", value: String(state.data.suspenseCount), detail: "grouped by reason", tone: "warning", accent: false }
    ];
  }

  function createDashboardRows(
    suspense: readonly SuspenseItem[],
    statementItems: readonly StatementSummary[],
    paymentItems: readonly PaymentSummary[]
  ): readonly TableRow[] {
    return [
      {
        id: "dash_mapping",
        cells: [
          { kind: "text", value: "Review RouteNote mapping", strong: true },
          { kind: "text", value: "Imports · RouteNote", strong: false },
          { kind: "text", value: String(suspense.filter((item: SuspenseItem): boolean => item.reason === "unmapped_track").length), strong: false },
          { kind: "badge", value: "mapping", tone: "warning" }
        ]
      },
      {
        id: "dash_statements",
        cells: [
          { kind: "text", value: "Generate posted statements", strong: true },
          { kind: "text", value: "Statements", strong: false },
          { kind: "text", value: String(statementItems.length), strong: false },
          { kind: "badge", value: "statements", tone: "info" }
        ]
      },
      {
        id: "dash_payments",
        cells: [
          { kind: "text", value: "Reconcile queued payments", strong: true },
          { kind: "text", value: "Payments", strong: false },
          { kind: "text", value: String(paymentItems.filter((payment: PaymentSummary): boolean => payment.status === "queued").length), strong: false },
          { kind: "badge", value: "payments", tone: "active" }
        ]
      }
    ];
  }

  function createImportRows(items: readonly DistributionImportBatch[]): readonly TableRow[] {
    return items.map((batch: DistributionImportBatch): TableRow => ({
      id: batch.id,
      cells: [
        { kind: "text", value: batch.fileName, strong: true },
        { kind: "badge", value: batch.source, tone: batch.source === "kontor" ? "active" : "info" },
        { kind: "text", value: `${batch.period} · ${batch.statementReference}`, strong: false },
        { kind: "text", value: String(batch.rowCount), strong: false },
        { kind: "money", value: formatMoney(batch.grossMicro, batch.currency), tone: "success" },
        { kind: "text", value: String(batch.unmatchedRowCount), strong: false },
        { kind: "text", value: batch.joinKeySummary, strong: false },
        { kind: "badge", value: batch.status, tone: importStatusTone(batch.status) },
        { kind: "badge", value: exactImportAction(batch.nextAction), tone: "warning" }
      ]
    }));
  }

  function createMappingRows(items: readonly DistributionMappingRow[]): readonly TableRow[] {
    return items.map((row: DistributionMappingRow): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.sourceTitle, strong: true },
        { kind: "text", value: row.sourceArtist, strong: false },
        { kind: "text", value: row.sourceStore, strong: false },
        { kind: "text", value: row.suggestedTrackTitle ?? "manual track required", strong: false },
        { kind: "badge", value: formatConfidence(row.confidenceBp), tone: confidenceTone(row.confidenceBp) },
        { kind: "badge", value: row.exactFixPath, tone: "active" }
      ]
    }));
  }

  function createCatalogRows(releaseItems: readonly ReleaseSummary[], trackItems: readonly TrackSummary[]): readonly TableRow[] {
    const releaseRows = releaseItems.map((release: ReleaseSummary): TableRow => ({
      id: release.id,
      cells: [
        { kind: "text", value: release.title, strong: true },
        { kind: "text", value: release.artistName, strong: false },
        { kind: "text", value: release.upc ?? "no UPC", strong: false },
        { kind: "badge", value: release.status, tone: catalogTone(release.status) },
        { kind: "text", value: String(release.trackCount), strong: false },
        { kind: "badge", value: "release", tone: "muted" }
      ]
    }));
    const trackRows = trackItems.map((track: TrackSummary): TableRow => ({
      id: track.id,
      cells: [
        { kind: "text", value: track.title, strong: true },
        { kind: "text", value: track.artistName, strong: false },
        { kind: "text", value: track.isrc ?? "no ISRC", strong: false },
        { kind: "badge", value: track.status, tone: catalogTone(track.status) },
        { kind: "text", value: String(track.contributorCount), strong: false },
        { kind: "badge", value: track.splitStatus, tone: track.splitStatus === "balanced" ? "success" : "warning" }
      ]
    }));

    return [...releaseRows, ...trackRows];
  }

  function createContractRows(items: readonly DistributionContract[], payeeItems: readonly PayeeSummary[]): readonly TableRow[] {
    return items.map((contract: DistributionContract): TableRow => ({
      id: contract.id,
      cells: [
        { kind: "text", value: contract.title, strong: true },
        { kind: "text", value: payeeName(contract.payeeId, payeeItems), strong: false },
        { kind: "text", value: formatBasisPoints(contract.splitBp), strong: false },
        { kind: "money", value: formatMoney(contract.openExpenseMicro, contract.currency), tone: moneyTone(contract.openExpenseMicro) },
        { kind: "badge", value: contract.status, tone: contract.status === "active" ? "success" : "warning" }
      ]
    }));
  }

  function createExpenseRows(items: readonly DistributionContractExpense[]): readonly TableRow[] {
    return items.map((expense: DistributionContractExpense): TableRow => ({
      id: expense.id,
      cells: [
        { kind: "text", value: expense.label, strong: true },
        { kind: "text", value: expense.incurredOn, strong: false },
        { kind: "money", value: formatMoney(expense.originalAmountMicro, expense.currency), tone: "info" },
        { kind: "money", value: formatMoney(expense.openAmountMicro, expense.currency), tone: moneyTone(expense.openAmountMicro) },
        { kind: "badge", value: expense.status, tone: expense.status === "open" ? "warning" : "success" }
      ]
    }));
  }

  function createAllocationRows(items: readonly AllocationRunSummary[]): readonly TableRow[] {
    return items.map((run: AllocationRunSummary): TableRow => ({
      id: run.id,
      cells: [
        { kind: "text", value: run.id, strong: true },
        { kind: "text", value: run.period, strong: false },
        { kind: "text", value: run.lockKey, strong: false },
        { kind: "money", value: formatMicro(run.totalInputMicro), tone: "info" },
        { kind: "money", value: formatMicro(run.totalAllocatedMicro), tone: "success" },
        { kind: "badge", value: run.status, tone: run.status === "completed" ? "success" : "warning" }
      ]
    }));
  }

  function createSuspenseRows(items: readonly SuspenseItem[]): readonly TableRow[] {
    return items.map((item: SuspenseItem): TableRow => ({
      id: item.id,
      cells: [
        { kind: "badge", value: suspenseReason(item.reason), tone: "warning" },
        { kind: "text", value: item.sourceReference, strong: true },
        { kind: "money", value: formatMoney(item.amountMicro, item.currency), tone: moneyTone(item.amountMicro) },
        { kind: "badge", value: item.exactFixPath, tone: "active" },
        { kind: "badge", value: item.status, tone: item.status === "open" ? "warning" : "success" }
      ]
    }));
  }

  function createStatementRows(items: readonly StatementSummary[]): readonly TableRow[] {
    return items.map((statement: StatementSummary): TableRow => ({
      id: statement.id,
      cells: [
        { kind: "text", value: statement.payeeName, strong: true },
        { kind: "money", value: formatMoney(statement.grossMicro, statement.currency), tone: "info" },
        { kind: "money", value: formatMoney(statement.recoupedMicro, statement.currency), tone: "warning" },
        { kind: "money", value: formatMoney(statement.expenseMicro, statement.currency), tone: "error" },
        { kind: "money", value: formatMoney(statement.paidMicro, statement.currency), tone: "success" },
        { kind: "money", value: formatMoney(statement.netPayableMicro, statement.currency), tone: "active" },
        { kind: "badge", value: statement.status, tone: statement.status === "paid" ? "success" : "warning" }
      ]
    }));
  }

  function createPaymentRows(items: readonly PaymentSummary[]): readonly TableRow[] {
    return items.map((payment: PaymentSummary): TableRow => ({
      id: payment.id,
      cells: [
        { kind: "text", value: payment.payeeName, strong: true },
        { kind: "money", value: formatMoney(payment.amountMicro, payment.currency), tone: moneyTone(payment.amountMicro) },
        { kind: "text", value: payment.reference ?? "to complete", strong: false },
        { kind: "text", value: payment.paidAt ?? "not paid", strong: false },
        { kind: "badge", value: payment.status, tone: payment.status === "paid" ? "success" : "warning" }
      ]
    }));
  }

  function createRevenueRows(items: readonly DistributionRevenueRow[]): readonly TableRow[] {
    return items.map((row: DistributionRevenueRow): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.label, strong: true },
        { kind: "money", value: formatMoney(row.grossMicro, row.currency), tone: "info" },
        { kind: "money", value: formatMoney(row.netMicro, row.currency), tone: "success" },
        { kind: "money", value: formatMoney(row.payableMicro, row.currency), tone: "active" },
        { kind: "badge", value: row.currency, tone: "muted" }
      ]
    }));
  }

  function createRevenueChartPoints(items: readonly DistributionRevenueRow[]): readonly ChartPoint[] {
    return items.map((row: DistributionRevenueRow): ChartPoint => ({ label: row.label, value: row.barLevel }));
  }

  function createReconciliationKpis(data: DistributionReconciliationResponse | null): readonly DistributionKpi[] {
    if (data === null) {
      return [];
    }

    return data.kpis.map((kpi): DistributionKpi => ({
      label: kpi.label,
      value: kpi.value,
      detail: kpi.detail,
      tone: kpi.tone,
      accent: false
    }));
  }

  function createReconStatementRows(data: DistributionReconciliationResponse | null): readonly TableRow[] {
    if (data === null) {
      return [];
    }

    return data.statementsWithoutPaymentLinks.map((row): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.id, strong: true },
        { kind: "text", value: row.payee, strong: false },
        { kind: "text", value: `${row.periodStart} → ${row.periodEnd}`, strong: false },
        { kind: "badge", value: row.currency, tone: "muted" },
        { kind: "money", value: formatMoney(row.netPayableMicro, row.currency), tone: moneyTone(row.netPayableMicro) }
      ]
    }));
  }

  function createReconExpenseRows(data: DistributionReconciliationResponse | null): readonly TableRow[] {
    if (data === null) {
      return [];
    }

    return data.expenseTermsMissingPayee.map((row): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.id, strong: true },
        { kind: "text", value: row.contract, strong: false },
        { kind: "text", value: row.description, strong: false },
        { kind: "money", value: formatMoney(row.amountMicro, row.currency), tone: "info" },
        { kind: "badge", value: row.currency, tone: "muted" },
        { kind: "badge", value: row.status, tone: "warning" }
      ]
    }));
  }

  function createReconMatchedRows(data: DistributionReconciliationResponse | null): readonly TableRow[] {
    if (data === null) {
      return [];
    }

    return data.matchedUnallocatedSamples.map((row): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.id, strong: true },
        { kind: "text", value: row.batch, strong: false },
        { kind: "text", value: row.track, strong: false },
        { kind: "badge", value: row.currency, tone: "muted" },
        { kind: "money", value: formatMoney(row.grossMicro, row.currency), tone: "info" },
        { kind: "badge", value: row.status, tone: "warning" }
      ]
    }));
  }

  function createReconBalanceRows(data: DistributionReconciliationResponse | null): readonly TableRow[] {
    if (data === null) {
      return [];
    }

    return data.payeeBalancesSummary.map((row): TableRow => ({
      id: `${row.payee}-${row.currency}`,
      cells: [
        { kind: "text", value: row.payee, strong: true },
        { kind: "badge", value: row.currency, tone: "muted" },
        { kind: "text", value: String(row.rows), strong: false },
        { kind: "text", value: row.firstId ?? "—", strong: false },
        { kind: "text", value: row.lastId ?? "—", strong: false },
        { kind: "money", value: formatMoney(row.latestClosingMicro, row.currency), tone: moneyTone(row.latestClosingMicro) }
      ]
    }));
  }

  function createAliasRows(items: readonly DistributionAlias[]): readonly TableRow[] {
    return items.map((alias: DistributionAlias): TableRow => ({
      id: alias.id,
      cells: [
        { kind: "text", value: alias.aliasText, strong: true },
        { kind: "text", value: alias.target, strong: false },
        { kind: "badge", value: alias.targetType, tone: "muted" }
      ]
    }));
  }

  function createDuplicateRows(items: readonly DistributionDuplicate[]): readonly TableRow[] {
    return items.map((duplicate: DistributionDuplicate): TableRow => ({
      id: duplicate.id,
      cells: [
        { kind: "text", value: duplicate.label, strong: true },
        { kind: "badge", value: duplicate.kind, tone: "muted" },
        { kind: "text", value: String(duplicate.count), strong: false },
        { kind: "text", value: duplicate.sampleIds.join(", "), strong: false },
        { kind: "badge", value: "merge disabled", tone: "warning" }
      ]
    }));
  }

  function createAuditRows(items: readonly AuditLogEntry[]): readonly TableRow[] {
    return items.map((entry: AuditLogEntry): TableRow => ({
      id: entry.id,
      cells: [
        { kind: "text", value: entry.occurredAt, strong: false },
        { kind: "text", value: entry.actorId, strong: false },
        { kind: "badge", value: entry.action, tone: "info" },
        { kind: "text", value: `${entry.entityType} · ${entry.entityId}`, strong: false }
      ]
    }));
  }

  function tableStateFor(status: RequestStatus, count: number): "loading" | "error" | "empty" | "default" {
    if (status === "loading") {
      return "loading";
    }

    if (status === "error") {
      return "error";
    }

    if (count === 0) {
      return "empty";
    }

    return "default";
  }

  function createImportToolbarFilters(state: ImportUiState): readonly ToolbarFilter[] {
    return [
      { label: "Source", value: state.source, active: true, disabled: false },
      { label: "File", value: state.fileName, active: false, disabled: false },
      { label: "State", value: state.status, active: false, disabled: false }
    ];
  }

  function stateLabel(state: ApiRequestState<unknown>): string {
    if (state.status === "idle") {
      return "idle";
    }

    if (state.status === "loading") {
      return "loading";
    }

    if (state.status === "error") {
      return "error";
    }

    return "loaded";
  }

  function toNullableImportSource(value: ImportSourceFilter): "kontor" | "routenote" | null {
    if (value === "kontor" || value === "routenote") {
      return value;
    }

    return null;
  }

  function toNullableMappingStatus(value: MappingStatusFilter): "unmapped" | "suggested" | "mapped" | null {
    if (value === "unmapped" || value === "suggested" || value === "mapped") {
      return value;
    }

    return null;
  }

  function toNullableSuspenseStatus(value: SuspenseStatusFilter): "open" | "resolved" | null {
    if (value === "open" || value === "resolved") {
      return value;
    }

    return null;
  }

  function toNullablePaymentStatus(value: PaymentStatusFilter): "draft" | "queued" | "paid" | "voided" | null {
    if (value === "draft" || value === "queued" || value === "paid" || value === "voided") {
      return value;
    }

    return null;
  }

  function readSelectValue(event: Event): string {
    const target = event.currentTarget;

    if (!(target instanceof HTMLSelectElement)) {
      throw new Error("Expected select event target.");
    }

    return target.value;
  }

  function readInputValue(event: Event): string {
    const target = event.currentTarget;

    if (!(target instanceof HTMLInputElement)) {
      throw new Error("Expected input event target.");
    }

    return target.value;
  }

  function formatMicro(amountMicro: string): string {
    return formatMoney(amountMicro, "MUR");
  }

  function formatMoney(amountMicro: string, currency: CurrencyCode): string {
    return formatMoneyValue(amountMicro, currency);
  }

  function moneyTone(amountMicro: string): Tone {
    return moneyToneForValue(amountMicro);
  }

  function formatBasisPoints(value: number): string {
    const whole = Math.trunc(value / 100);
    const fraction = value % 100;

    if (fraction === 0) {
      return `${String(whole)}%`;
    }

    return `${String(whole)}.${fraction.toString().padStart(2, "0")}%`;
  }

  function formatConfidence(confidenceBp: number): string {
    return formatBasisPoints(confidenceBp);
  }

  function confidenceTone(confidenceBp: number): Tone {
    if (confidenceBp >= 9000) {
      return "success";
    }

    if (confidenceBp >= 7000) {
      return "info";
    }

    return "warning";
  }

  function payeeName(payeeId: string, payeeItems: readonly PayeeSummary[]): string {
    const payee = payeeItems.find((item: PayeeSummary): boolean => item.id === payeeId);

    if (payee === undefined) {
      return payeeId;
    }

    return payee.displayName;
  }

  function importStatusTone(status: "uploaded" | "mapped" | "validated" | "failed"): Tone {
    if (status === "validated") {
      return "success";
    }

    if (status === "failed") {
      return "error";
    }

    if (status === "mapped") {
      return "info";
    }

    return "warning";
  }

  function exactImportAction(action: "review_mapping" | "apply_rules" | "validate" | "retry"): string {
    if (action === "review_mapping") {
      return "Review mapping";
    }

    if (action === "apply_rules") {
      return "Apply rules";
    }

    if (action === "validate") {
      return "Validate batch";
    }

    return "Retry import";
  }

  function catalogTone(status: "draft" | "released" | "archived"): Tone {
    if (status === "released") {
      return "success";
    }

    if (status === "draft") {
      return "warning";
    }

    return "muted";
  }

  function suspenseReason(reason: "missing_split" | "unmapped_track" | "import_retry" | "contract_hold"): string {
    if (reason === "missing_split") {
      return "Missing split";
    }

    if (reason === "unmapped_track") {
      return "Unmapped track";
    }

    if (reason === "import_retry") {
      return "Import retry";
    }

    return "Contract hold";
  }

  function suspenseResolutionFor(item: SuspenseItem): "map_to_release" | "map_to_track" | "hold" {
    if (item.exactFixPath === "catalog") {
      return "map_to_release";
    }

    if (item.exactFixPath === "contracts") {
      return "hold";
    }

    return "map_to_track";
  }

  function createIdempotencyKey(scope: string): string {
    return `distribution-${scope}-${Date.now().toString()}`;
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return "Unknown error.";
  }
</script>

<svelte:head>
  <title>ë • Distribution</title>
</svelte:head>

<main class="distribution-shell">
  <aside class="sidebar" aria-label="Navigation Distribution">
    <button class="brand" type="button" onclick={() => selectPage("dashboard")}>
      <span>ë</span>
      <strong>ë • distribution</strong>
    </button>

    <nav>
      <h2>Distribution</h2>
      {#each navItems as item (item.id)}
        <button class="ehq-nav-fade-item ehq-edge-surface" class:active={activePageId === item.id} type="button" onclick={() => selectPage(item.id)}>
          <span aria-hidden="true"></span>
          {item.label}
        </button>
      {/each}
    </nav>

    <p class="system-status"><span aria-hidden="true"></span>erh/v1 · live reads</p>
  </aside>

  <section class="main-panel">
    <header class="topbar">
      <p><span>Distribution</span> / <strong>{activePage.label}</strong></p>
      <label class="search">
        <span>⌘K</span>
        <input aria-label="Search Distribution" placeholder="payee, ISRC, statement..." />
      </label>
      <button class="notification" type="button" aria-label="Notifications">5</button>
      <button class="profile" type="button" aria-label="Sign out" onclick={onLogout}>
        <span>{session.initials}</span>
        <strong>{session.displayName}</strong>
        <small>{session.roleLabel}</small>
      </button>
    </header>

    <div class="content">
      <section class="page-head">
        <p>Distribution</p>
        <h1>{activePage.title}</h1>
        <span>{activePage.subtitle}</span>
      </section>

      {#if mutationReceipt !== null && mutationReceiptPageId === activePageId}
        <p class="receipt" role="status">Action accepted · {mutationReceipt.id} · audit {mutationReceipt.auditEventId}</p>
      {/if}

      {#if runReceipt !== null && runReceiptPageId === activePageId}
        <p class="receipt" role="status">Run queued · {runReceipt.runId} · lock {runReceipt.lockKey}</p>
      {/if}

      {#if activePageId === "dashboard"}
        <section class="kpi-grid" aria-label="Distribution KPIs">
          {#each dashboardKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={dashboardState.status === "loading" ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>
        <section class="dashboard-grid">
          <BarsChart title="Revenue by source" points={revenueChartPoints} tone="active" />
          <Table title="Action list" columns={dashboardColumns} rows={dashboardRows} state="default" actionLabel="" />
        </section>
      {:else if activePageId === "imports"}
        <Toolbar label="Kontor RouteNote import" filters={importToolbarFilters} actionLabel="" loading={importState.status === "loading"} />
        <section class="form-panel ehq-edge-surface" aria-label="Import Kontor RouteNote">
          <label>
            <span>Source</span>
            <select value={importState.source} onchange={updateImportSource}>
              {#each importSourceOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span>Export file</span>
            <input value={importState.fileName} oninput={updateImportFile} />
          </label>
          <button class="distribution-action" type="button" onclick={previewImport}>Preview export</button>
          <button class="distribution-action primary" type="button" disabled={!canConfirmImport} onclick={confirmImport}>Validate import</button>
        </section>
        <section class="filter-strip ehq-edge-surface" aria-label="Import filters">
          <label>
            <span>Source filter</span>
            <select value={importSourceFilter} onchange={updateImportFilter}>
              {#each importFilterOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button class="distribution-action primary" type="button" onclick={loadImportBatches}>Filter</button>
        </section>
        <section class="import-result ehq-edge-surface" class:error={importState.status === "error"} aria-live="polite">
          <strong>{importState.message}</strong>
          {#if importState.preview !== null}
            <span>{importState.preview.previewId} · {importState.preview.acceptedRowCount} accepted · {importState.preview.unmappedRowCount} to suspense · {formatMoney(importState.preview.payableMicro, importState.preview.currencyCodes[0] ?? "USD")}</span>
            <span>{importState.preview.statementReference} · keys {importState.preview.joinKeys.join(" + ")} · idempotency {importState.preview.idempotencyFingerprint}</span>
          {/if}
          {#if importState.confirm !== null}
            <span>Confirm {importState.confirm.id} · {importState.confirm.importedRoyaltyEventCount} royalty events</span>
          {/if}
        </section>
        <Table title="Batches Kontor / RouteNote" columns={importColumns} rows={importRows} state={importBatchesState.status === "loading" ? "loading" : importBatchesState.status === "error" ? "error" : "default"} actionLabel="" />
      {:else if activePageId === "mapping"}
        <section class="filter-strip ehq-edge-surface" aria-label="Mapping filters">
          <label>
            <span>Status</span>
            <select value={mappingStatusFilter} onchange={updateMappingStatus}>
              {#each mappingStatusOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button class="distribution-action" type="button" onclick={loadMappingRows}>Filter</button>
          <button class="distribution-action primary" type="button" onclick={applyMappingRules}>Apply reusable rules</button>
        </section>
        <Table title="Kontor / RouteNote rows to map" columns={mappingColumns} rows={mappingTableRows} state={mappingState.status === "loading" ? "loading" : mappingState.status === "error" ? "error" : mappingRows.length === 0 ? "empty" : "default"} actionLabel="" />
      {:else if activePageId === "catalog"}
        <section class="dashboard-grid">
          <Table title="Catalog canonical + contributors" columns={catalogColumns} rows={catalogRows} state={tracksState.status === "loading" ? "loading" : tracksState.status === "error" ? "error" : "default"} actionLabel="" />
          <div class="command-card ehq-edge-surface">
            <h2>Review focus</h2>
            <p>Import artist and catalog contributors stay separate until an exact track match is approved.</p>
            <button class="distribution-action primary" type="button" onclick={() => selectPage("mapping")}>Fix contributor mapping</button>
          </div>
        </section>
      {:else if activePageId === "contracts"}
        <section class="contracts-actions ehq-edge-surface">
          <button class="distribution-action primary" type="button" onclick={recordExpense}>Record recoupable expense</button>
          <span>Expenses remain source records; corrections later become audited overrides.</span>
        </section>
        <section class="dashboard-grid">
          <Table title="Splits / contracts" columns={contractColumns} rows={contractRows} state={contractsState.status === "loading" ? "loading" : contractsState.status === "error" ? "error" : "default"} actionLabel="" />
          <Table title="Expenses / recoupments" columns={expenseColumns} rows={expenseRows} state={expensesState.status === "loading" ? "loading" : expensesState.status === "error" ? "error" : "default"} actionLabel="" />
        </section>
      {:else if activePageId === "allocations"}
        <section class="lock-panel ehq-edge-surface">
          <div>
            <h2>Server lock</h2>
            <p>{allocationLockKey}</p>
            <span>Preview, post and unpost are available only through cadenced workflow runs.</span>
          </div>
          <button class="distribution-action" type="button" onclick={previewAllocationRun}>Preview locked run</button>
          <button class="distribution-action primary" type="button" onclick={startCadencedAllocationRun}>Post cadence wave</button>
          <button class="distribution-action danger" type="button" onclick={unpostAllocationRun}>Request unpost run</button>
        </section>
        <Table title="Allocation runs" columns={allocationColumns} rows={allocationRows} state={allocationsState.status === "loading" ? "loading" : allocationsState.status === "error" ? "error" : "default"} actionLabel="" />
      {:else if activePageId === "suspense"}
        <section class="filter-strip ehq-edge-surface" aria-label="Suspense filters">
          <label>
            <span>Status</span>
            <select value={suspenseStatusFilter} onchange={updateSuspenseStatus}>
              {#each suspenseStatusOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button class="distribution-action" type="button" onclick={loadSuspense}>Filter</button>
          <button class="distribution-action primary" type="button" onclick={resolveFirstSuspense}>Resolve first exact path</button>
        </section>
        <Table title="Suspense grouped by reason" columns={suspenseColumns} rows={suspenseTableRows} state={suspenseState.status === "loading" ? "loading" : suspenseState.status === "error" ? "error" : suspenseItems.length === 0 ? "empty" : "default"} actionLabel="" />
      {:else if activePageId === "statements"}
        <section class="statement-summary ehq-edge-surface">
          {#if statementPreview !== null}
            <div>
              <p>Financial summary first</p>
              <h2>{statementPreview.payeeName} · {statementPreview.period}</h2>
              <dl>
                <div><dt>Gross</dt><dd>{formatMoney(statementPreview.grossMicro, statementPreview.currency)}</dd></div>
                <div><dt>Recoup</dt><dd>{formatMoney(statementPreview.recoupedMicro, statementPreview.currency)}</dd></div>
                <div><dt>Expenses</dt><dd>{formatMoney(statementPreview.expenseMicro, statementPreview.currency)}</dd></div>
                <div><dt>Paid</dt><dd>{formatMoney(statementPreview.paidMicro, statementPreview.currency)}</dd></div>
                <div><dt>Total due</dt><dd>{formatMoney(statementPreview.netPayableMicro, statementPreview.currency)}</dd></div>
              </dl>
            </div>
          {/if}
          <button class="distribution-action primary" type="button" onclick={generateStatements}>Generate statements run</button>
        </section>
        <section class="statement-pdf ehq-edge-surface" aria-label="A4 statement PDF preview">
          <header>
            <strong>ë • Distribution</strong>
            <span>A4 PDF · print-first</span>
          </header>
          <h2>{statementPreview?.payeeName ?? "Payee"} Statement</h2>
          <p>Period {statementPreview?.period ?? distributionPeriod} · currency {statementPreview?.currency ?? "MUR"}</p>
          <Table title="Statements" columns={statementColumns} rows={statementRows} state={statementsState.status === "loading" ? "loading" : statementsState.status === "error" ? "error" : "default"} actionLabel="" />
        </section>
      {:else if activePageId === "payments"}
        <section class="filter-strip ehq-edge-surface" aria-label="Payment filters">
          <label>
            <span>Status</span>
            <select value={paymentStatusFilter} onchange={updatePaymentStatus}>
              {#each paymentStatusOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button class="distribution-action" type="button" onclick={loadPayments}>Filter</button>
          <button class="distribution-action primary" type="button" onclick={recordPayment}>Record payment</button>
          <button class="distribution-action" type="button" onclick={editPayment}>Edit reference</button>
          <button class="distribution-action" type="button" onclick={reconcilePayment}>Reconcile payment</button>
          <button class="distribution-action danger" type="button" onclick={voidPayment}>Void payment</button>
        </section>
        <Table title="Payments" columns={paymentColumns} rows={paymentRows} state={paymentsState.status === "loading" ? "loading" : paymentsState.status === "error" ? "error" : payments.length === 0 ? "empty" : "default"} actionLabel="" />
      {:else if activePageId === "revenue"}
        <section class="filter-strip ehq-edge-surface" aria-label="Revenue filters">
          <label>
            <span>Group by</span>
            <select value={revenueGroupBy} onchange={updateRevenueGroup}>
              {#each revenueGroupOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button class="distribution-action primary" type="button" onclick={loadRevenue}>Refresh</button>
        </section>
        <section class="dashboard-grid">
          <BarsChart title="Revenue grouped view" points={revenueChartPoints} tone="active" />
          <Table title="Revenue detail" columns={revenueColumns} rows={revenueTableRows} state={revenueState.status === "loading" ? "loading" : revenueState.status === "error" ? "error" : "default"} actionLabel="" />
        </section>
      {:else if activePageId === "financial-reconciliation"}
        {#if reconciliationState.status === "loading"}
          <Loader label="Loading reconciliation" detail="Computing read-only diagnostics." size="medium" />
        {:else if reconciliationState.status === "error"}
          <section class="empty-state ehq-edge-surface">
            <strong>Reconciliation unavailable</strong>
            <span>The read-only diagnostic could not be loaded. Retry the request.</span>
            <button class="distribution-action" type="button" onclick={loadReconciliation}>Retry</button>
          </section>
        {:else}
          <section class="kpi-grid recon" aria-label="Reconciliation KPIs">
            {#each reconciliationKpis as kpi (kpi.label)}
              <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state="default" accent={kpi.accent} />
            {/each}
          </section>
          <Table title="Statements without payment links" columns={reconStatementColumns} rows={reconStatementRows} state={reconStatementRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <Table title="Expense terms missing payee" columns={reconExpenseColumns} rows={reconExpenseRows} state={reconExpenseRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <Table title="Matched unallocated (sample)" columns={reconMatchedColumns} rows={reconMatchedRows} state={reconMatchedRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <Table title="Payee balances summary" columns={reconBalanceColumns} rows={reconBalanceRows} state={reconBalanceRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <section class="recon-actions ehq-edge-surface" aria-label="Guarded repair actions">
            <header>
              <h2>Guarded repair actions</h2>
              <span>Read-only view. All actions are disabled and not wired to any mutation.</span>
            </header>
            <div class="recon-action-grid">
              {#each (reconciliation?.actions ?? []) as action (action.id)}
                <div class="recon-action ehq-edge-surface">
                  <strong>{action.label}</strong>
                  <p>{action.description}</p>
                  {#if action.maintenance}
                    <span class="recon-action-flag">One-time maintenance · flagged for review</span>
                  {/if}
                  <button class="distribution-action" type="button" disabled aria-disabled="true">Disabled (read-only)</button>
                </div>
              {/each}
            </div>
          </section>
        {/if}
      {:else if activePageId === "aliases"}
        {#if aliases.length === 0 && aliasesState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No catalog aliases</strong>
            <span>No alias records are available for this workspace. Aliases route imported names to canonical entities once configured.</span>
          </section>
        {:else}
          <Table title="Catalog aliases" columns={aliasColumns} rows={aliasRows} state={tableStateFor(aliasesState.status, aliases.length)} actionLabel="" />
        {/if}
      {:else if activePageId === "duplicates"}
        <section class="recon-actions ehq-edge-surface" aria-label="Duplicates note">
          <header>
            <h2>Duplicate detection</h2>
            <span>Read-only view. The merge action is disabled and not wired to any mutation.</span>
          </header>
        </section>
        {#if duplicates.length === 0 && duplicatesState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No duplicates detected</strong>
            <span>No potential duplicate records were found across the catalog.</span>
          </section>
        {:else}
          <Table title="Potential duplicates" columns={duplicateColumns} rows={duplicateRows} state={tableStateFor(duplicatesState.status, duplicates.length)} actionLabel="" />
        {/if}
      {:else if activePageId === "audit-log"}
        {#if auditEntries.length === 0 && auditLogState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No audit entries</strong>
            <span>No distribution-scoped audit events are recorded for this workspace.</span>
          </section>
        {:else}
          <Table title="Audit log" columns={auditColumns} rows={auditRows} state={tableStateFor(auditLogState.status, auditEntries.length)} actionLabel="" />
        {/if}
      {:else if activePageId === "settings"}
        {#if settingsState.status === "loading"}
          <Loader label="Loading settings" detail="Reading workspace configuration." size="medium" />
        {:else if settingsState.status === "error"}
          <section class="empty-state ehq-edge-surface">
            <strong>Settings unavailable</strong>
            <span>The workspace configuration could not be loaded.</span>
            <button class="distribution-action" type="button" onclick={loadSettings}>Retry</button>
          </section>
        {:else if settings !== null}
          <section class="settings-panel ehq-edge-surface" aria-label="Distribution settings">
            <dl>
              <div><dt>Workspace</dt><dd>{settings.workspaceId}</dd></div>
              <div><dt>API namespace</dt><dd>{settings.namespace}</dd></div>
              <div><dt>Reads</dt><dd>{settings.reads}</dd></div>
              <div><dt>Payees</dt><dd>{settings.payeeCount}</dd></div>
              <div><dt>Contracts</dt><dd>{settings.contractCount}</dd></div>
              <div><dt>Currencies</dt><dd>{settings.currencies.length === 0 ? "—" : settings.currencies.join(", ")}</dd></div>
              <div><dt>FX rates</dt><dd>{settings.fxRateCount}</dd></div>
              <div><dt>Mutations</dt><dd>{settings.mutationsEnabled ? "enabled" : "read-only"}</dd></div>
            </dl>
          </section>
        {/if}
      {/if}
    </div>
  </section>
</main>

<style>
  :global(body) {
    overflow: hidden;
  }

  .distribution-shell {
    height: 100dvh;
    min-height: 0;
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    display: grid;
    grid-template-columns: 236px minmax(0, 1fr);
    overflow: hidden;
  }

  .sidebar {
    min-height: 0;
    border-right: 1px solid var(--ehq-border-soft);
    background: var(--ehq-surface);
    display: flex;
    flex-direction: column;
  }

  .brand {
    padding: var(--ehq-space-4);
    border: 0;
    background: transparent;
    color: var(--ehq-text);
    display: inline-flex;
    align-items: center;
    gap: var(--ehq-space-2);
  }

  .brand span {
    color: var(--ehq-yellow);
    font-size: 24px;
    font-weight: var(--ehq-type-display-weight);
  }

  .brand strong,
  nav h2,
  .system-status,
  .topbar p,
  .search,
  .profile small,
  .page-head p,
  .receipt,
  label span,
  .distribution-action,
  .import-result,
  .contracts-actions,
  .lock-panel,
  .statement-summary,
  .statement-pdf span,
  .statement-pdf p {
    font-family: var(--ehq-mono);
  }

  .brand strong {
    color: var(--ehq-text-soft);
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: lowercase;
  }

  nav {
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--ehq-space-2);
    overflow-y: auto;
  }

  nav h2 {
    margin: var(--ehq-space-3) var(--ehq-space-2) var(--ehq-space-2);
    color: var(--ehq-text-muted);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  nav button {
    width: 100%;
    min-height: 36px;
    padding: 0 var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text-soft);
    display: flex;
    align-items: center;
    gap: var(--ehq-space-2);
    text-align: left;
  }

  nav button:hover,
  nav button.active {
    color: var(--ehq-text);
  }

  nav button.active {
    box-shadow: inset 2px 0 0 var(--ehq-yellow);
  }

  nav button span {
    width: 7px;
    height: 7px;
    border-radius: 2px;
    background: currentColor;
  }

  .system-status {
    margin: 0;
    padding: var(--ehq-space-3) var(--ehq-space-4);
    border-top: 1px solid var(--ehq-border-soft);
    color: var(--ehq-text-muted);
    display: flex;
    align-items: center;
    gap: var(--ehq-space-2);
    font-size: 11px;
  }

  .system-status span {
    width: 7px;
    height: 7px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-success);
  }

  .main-panel {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .topbar {
    flex: 0 0 auto;
    min-width: 0;
    min-height: 58px;
    padding: 0 var(--ehq-space-5);
    border-bottom: 1px solid var(--ehq-border-soft);
    display: flex;
    align-items: center;
    gap: var(--ehq-space-4);
  }

  .topbar p {
    margin: 0;
    color: var(--ehq-text-soft);
    font-size: 12px;
  }

  .topbar p span {
    color: var(--ehq-text-muted);
  }

  .search {
    flex: 1 1 360px;
    max-width: 420px;
    min-height: 38px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    color: var(--ehq-text-muted);
    display: flex;
    align-items: center;
    gap: var(--ehq-space-2);
    font-size: 11px;
  }

  .search input {
    min-width: 0;
    flex: 1;
    border: 0;
    background: transparent;
    color: var(--ehq-text);
    outline: 0;
  }

  .notification,
  .profile {
    border: 1px solid var(--ehq-border);
    background: var(--ehq-surface-high);
    color: var(--ehq-text);
  }

  .notification {
    width: 34px;
    height: 34px;
    border-radius: var(--ehq-radius-sm);
    color: var(--ehq-yellow);
    font-family: var(--ehq-mono);
    font-size: 11px;
    font-weight: var(--ehq-type-label-weight);
  }

  .profile {
    min-height: 38px;
    padding: var(--ehq-space-1) var(--ehq-space-2);
    border-radius: var(--ehq-radius-sm);
    display: grid;
    grid-template-columns: auto auto;
    align-items: center;
    column-gap: var(--ehq-space-2);
    text-align: left;
  }

  .profile span {
    grid-row: span 2;
    width: 28px;
    height: 28px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-bg-main);
    color: var(--ehq-yellow);
    display: grid;
    place-items: center;
    font-family: var(--ehq-mono);
    font-size: 10px;
    font-weight: var(--ehq-type-label-weight);
  }

  .profile strong {
    font-size: 12px;
    font-weight: var(--ehq-type-heading-weight);
  }

  .profile small {
    color: var(--ehq-text-muted);
    font-size: 10px;
  }

  .content {
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--ehq-space-5);
    display: grid;
    align-content: start;
    gap: var(--ehq-space-4);
    overflow-y: auto;
    overflow-x: hidden;
  }

  .page-head p,
  .page-head h1,
  .page-head span {
    margin: 0;
  }

  .page-head p {
    color: var(--ehq-text-muted);
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .page-head h1 {
    margin-top: var(--ehq-space-2);
    font-size: clamp(24px, 2.6vw, 34px);
    font-weight: var(--ehq-type-display-weight);
    line-height: 1;
    letter-spacing: 0;
  }

  .page-head span {
    display: block;
    margin-top: var(--ehq-space-2);
    color: var(--ehq-text-soft);
    font-size: 13.5px;
  }

  .receipt,
  .import-result {
    margin: 0;
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-yellow-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-yellow-muted);
    color: var(--ehq-yellow);
    font-size: 11px;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  .dashboard-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: var(--ehq-space-3);
  }

  .form-panel,
  .filter-strip,
  .contracts-actions,
  .lock-panel,
  .statement-summary {
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--ehq-space-3);
  }

  label {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-1);
  }

  label span {
    color: var(--ehq-text-muted);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  select,
  input {
    min-height: 38px;
    width: 100%;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-weight: var(--ehq-type-body-weight);
    color-scheme: dark;
    outline: 0;
  }

  select:focus,
  input:focus {
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .distribution-action {
    min-height: 38px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: 11px;
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .distribution-action.primary {
    border-color: var(--ehq-yellow);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
  }

  .distribution-action.danger {
    border-color: var(--ehq-error);
    background: var(--ehq-error-bg);
    color: var(--ehq-error);
  }

  .distribution-action:disabled {
    color: var(--ehq-text-disabled);
    cursor: not-allowed;
  }

  .import-result {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .import-result.error {
    border-color: var(--ehq-error);
    background: var(--ehq-error-bg);
    color: var(--ehq-error);
  }

  .command-card,
  .statement-pdf {
    min-width: 0;
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
  }

  .command-card h2,
  .command-card p,
  .statement-summary h2,
  .statement-summary p,
  .statement-pdf h2,
  .statement-pdf p,
  .statement-pdf header {
    margin: 0;
  }

  .command-card h2,
  .statement-summary h2,
  .statement-pdf h2 {
    font-size: 18px;
    font-weight: var(--ehq-type-heading-weight);
  }

  .command-card p {
    margin: var(--ehq-space-2) 0 var(--ehq-space-3);
    color: var(--ehq-text-soft);
    font-size: 13px;
    line-height: 1.6;
  }

  .contracts-actions,
  .lock-panel {
    justify-content: space-between;
  }

  .contracts-actions span,
  .lock-panel span,
  .lock-panel p {
    color: var(--ehq-text-muted);
    font-size: 11px;
  }

  .lock-panel h2 {
    margin: 0 0 var(--ehq-space-1);
    font-size: 14px;
  }

  .statement-summary {
    justify-content: space-between;
    align-items: start;
  }

  .statement-summary p {
    color: var(--ehq-text-muted);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .statement-summary dl {
    margin: var(--ehq-space-3) 0 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(90px, 1fr));
    gap: var(--ehq-space-2);
  }

  .statement-summary div {
    min-width: 0;
  }

  .statement-summary dt,
  .statement-summary dd {
    margin: 0;
  }

  .statement-summary dt {
    color: var(--ehq-text-muted);
    font-size: 11px;
  }

  .statement-summary dd {
    margin-top: var(--ehq-space-1);
    color: var(--ehq-text);
    font-weight: var(--ehq-type-figure-weight);
    font-variant-numeric: tabular-nums;
  }

  .statement-pdf {
    width: min(100%, 840px);
    min-height: 560px;
    margin: 0 auto;
    background: var(--ehq-surface-high);
  }

  .statement-pdf header {
    display: flex;
    justify-content: space-between;
    gap: var(--ehq-space-3);
    color: var(--ehq-yellow);
  }

  .statement-pdf h2 {
    margin-top: var(--ehq-space-5);
    font-size: 28px;
  }

  .statement-pdf p {
    margin: var(--ehq-space-2) 0 var(--ehq-space-4);
    color: var(--ehq-text-muted);
    font-size: 12px;
  }

  .kpi-grid.recon {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .empty-state {
    padding: var(--ehq-space-5);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    gap: var(--ehq-space-2);
    justify-items: start;
  }

  .empty-state strong {
    font-family: var(--ehq-display);
    font-size: 18px;
    font-weight: var(--ehq-type-heading-weight);
  }

  .empty-state span {
    color: var(--ehq-text-soft);
    font-size: 13px;
    line-height: 1.6;
  }

  .recon-actions {
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    gap: var(--ehq-space-3);
  }

  .recon-actions header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: var(--ehq-type-heading-weight);
  }

  .recon-actions header span {
    display: block;
    margin-top: var(--ehq-space-1);
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: 11px;
  }

  .recon-action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--ehq-space-3);
  }

  .recon-action {
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    gap: var(--ehq-space-2);
    align-content: start;
  }

  .recon-action strong {
    font-size: 13px;
    font-weight: var(--ehq-type-heading-weight);
  }

  .recon-action p {
    margin: 0;
    color: var(--ehq-text-soft);
    font-size: 12px;
    line-height: 1.5;
  }

  .recon-action-flag {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .settings-panel {
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
  }

  .settings-panel dl {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--ehq-space-3);
  }

  .settings-panel div {
    min-width: 0;
  }

  .settings-panel dt,
  .settings-panel dd {
    margin: 0;
  }

  .settings-panel dt {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .settings-panel dd {
    margin-top: var(--ehq-space-1);
    color: var(--ehq-text);
    font-weight: var(--ehq-type-figure-weight);
  }

  @media print {
    :global(body) {
      overflow: visible;
    }

    .distribution-shell {
      display: block;
      height: auto;
    }

    .sidebar,
    .topbar,
    .page-head,
    .receipt,
    .statement-summary {
      display: none;
    }

    .content {
      display: block;
      padding: 0;
      overflow: visible;
    }

    .statement-pdf {
      width: 210mm;
      min-height: 297mm;
      border: 0;
      border-radius: 0;
      background: var(--ehq-bg-main);
    }
  }

  @media (max-width: 1100px) {
    .distribution-shell {
      grid-template-columns: 210px minmax(0, 1fr);
    }

    .kpi-grid,
    .dashboard-grid {
      grid-template-columns: 1fr 1fr;
    }

    .statement-summary dl {
      grid-template-columns: repeat(2, minmax(120px, 1fr));
    }
  }

  @media (max-width: 760px) {
    .distribution-shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      display: none;
    }

    .topbar {
      padding: 0 var(--ehq-space-3);
    }

    .search {
      display: none;
    }

    .content {
      padding: var(--ehq-space-3);
    }

    .kpi-grid,
    .dashboard-grid,
    .statement-summary dl {
      grid-template-columns: 1fr;
    }
  }
</style>
