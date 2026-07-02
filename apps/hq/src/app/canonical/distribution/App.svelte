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
    type DistributionReconciliationAction,
    type DistributionReconciliationResponse,
    type DistributionRevenueRow,
    type DistributionSettingsResponse,
    type PageResult,
    type PayeeSummary,
    type PaymentSummary,
    type ReleaseSummary,
    type StatementPrintLine,
    type StatementPrintResponse,
    type StatementSummary,
    type SuspenseItem,
    type TrackSummary
  } from "@ehq/api-client";
  import { BarsChart, Button, Input, KPI, Loader, PageHeader, SectionTemplate, Select, Table, Toolbar, WorkspaceShell } from "@ehq/ui";
  import type { ChartPoint, SelectOption, TableColumn, TablePagination, TableRow, TableRowAction, Tone, ToolbarFilter, WorkspaceNavGroup, WorkspaceNavItem } from "@ehq/ui";
  import { createShellApiClient } from "../../app-shell-data.js";
  import { parseCsvRecords } from "../../bank-parser.js";
  import { formatDateOnly, formatDateRange } from "../../date-format.js";
  import { formatMoneyValue, moneyToneForValue } from "../../money-format.js";
  import { createPeriodOptions, getLatestDataPeriod, periodLabel, rangeForScope, rangeLabel, todayIso, type DateRange, type PeriodScope } from "../../period-controls.js";
  import { normalizeRoutePath } from "../../route-utils.js";
  import { appendPageResult, createTablePagination, loadPageResult, readPageItems, TABLE_PAGE_SIZE, type PageLoadMode } from "../../table-pagination.js";

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
  type DistributionPagedTableId =
    | "importBatches"
    | "mapping"
    | "payees"
    | "releases"
    | "tracks"
    | "catalog"
    | "contracts"
    | "expenses"
    | "allocations"
    | "suspense"
    | "statements"
    | "payments"
    | "revenue"
    | "aliases"
    | "duplicates"
    | "auditLog";

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

  interface DistributionNavGroup {
    readonly id: string;
    readonly label: string;
    readonly items: readonly DistributionNavItem[];
  }

  interface ImportUiState {
    readonly status: RequestStatus;
    readonly source: ImportSource;
    readonly fileName: string;
    readonly rows: readonly Readonly<Record<string, string>>[];
    readonly checksum: string;
    readonly preview: DistributionImportPreviewResponse | null;
    readonly confirm: DistributionImportConfirmResponse | null;
    readonly message: string;
  }

  type PaymentPanelMode = "edit" | "reconcile" | "void";
  type CatalogPanelMode = "release" | "track";
  type CatalogEntryStatus = "draft" | "released" | "archived";
  type ContractStatus = "draft" | "active" | "paused" | "ended";

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
  const allValue = "all";
  const periodOptions = createPeriodOptions();
  const navGroups: readonly DistributionNavGroup[] = [
    {
      id: "overview",
      label: "Overview",
      items: [
        { id: "dashboard", label: "Dashboard", title: "Dashboard", subtitle: "Royalty cockpit, blockers, and actions." },
        { id: "allocations", label: "Allocations", title: "Allocations", subtitle: "Preview/post/unpost through cadenced runs and server locks." },
        { id: "suspense", label: "Suspense", title: "Suspense", subtitle: "Grouped by reason with an exact fix path." },
        { id: "statements", label: "Statements", title: "Statements", subtitle: "Financial summary first, print-first A4 PDF." },
        { id: "payments", label: "Payments", title: "Payments", subtitle: "Record, edit, void, and reconcile payment records." },
        { id: "revenue", label: "Revenue", title: "Revenue", subtitle: "Financial view by payee, track, currency, store, or period." },
      ]
    },
    {
      id: "imports",
      label: "Import & Mapping",
      items: [
        { id: "imports", label: "Imports", title: "Imports", subtitle: "Kontor and RouteNote exports, preview then confirm." },
        { id: "mapping", label: "Mapping", title: "Mapping", subtitle: "Review rows, automate safe matches, apply reusable rules." },
        { id: "aliases", label: "Aliases", title: "Aliases", subtitle: "Catalog aliases that route imported names to canonical entities." },
        { id: "duplicates", label: "Duplicates", title: "Duplicates", subtitle: "Potential duplicate records detected across the catalog." }
      ]
    },
    {
      id: "catalog",
      label: "Catalog & Contracts",
      items: [
        { id: "catalog", label: "Catalog", title: "Catalog", subtitle: "Releases, tracks, contributors, and split health." },
        { id: "contracts", label: "Contracts", title: "Contracts", subtitle: "Splits, payees, expenses, and recoupments." },
        { id: "financial-reconciliation", label: "Financial reconciliation", title: "Financial reconciliation", subtitle: "Read-only diagnostic of payments, statements, balances, and allocations." }
      ]
    },
    {
      id: "administration",
      label: "Administration",
      items: [
        { id: "audit-log", label: "Audit log", title: "Audit log", subtitle: "Distribution-scoped audit trail of recorded actions." },
        { id: "settings", label: "Settings", title: "Settings", subtitle: "Read-only workspace configuration for Distribution." }
      ]
    }
  ];
  const navItems: readonly DistributionNavItem[] = navGroups.flatMap((group: DistributionNavGroup): readonly DistributionNavItem[] => group.items);
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
  const catalogStatusOptions: readonly SelectOption[] = [
    { label: "Draft", value: "draft" },
    { label: "Released", value: "released" },
    { label: "Archived", value: "archived" }
  ];
  const contractStatusOptions: readonly SelectOption[] = [
    { label: "Draft", value: "draft" },
    { label: "Active", value: "active" },
    { label: "Paused", value: "paused" },
    { label: "Ended", value: "ended" }
  ];
  const revenueGroupOptions: readonly SelectOption[] = [
    { label: "Store", value: "store" },
    { label: "Payee", value: "payee" },
    { label: "Track", value: "track" },
    { label: "Currency", value: "currency" },
    { label: "Period", value: "period" }
  ];
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
    { label: "Period", align: "left", sortable: true },
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
    { label: "First row", align: "left", sortable: false },
    { label: "Last row", align: "left", sortable: false },
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
  const shellNavGroups = $derived<readonly WorkspaceNavGroup[]>(
    navGroups.map((group: DistributionNavGroup): WorkspaceNavGroup => ({
      id: group.id,
      label: group.label,
      items: group.items.map((item: DistributionNavItem): WorkspaceNavItem => ({
        label: item.label,
        href: item.id,
        icon: "",
        active: activePageId === item.id,
        disabled: false,
        badge: null
      }))
    }))
  );
  const handleShellNavigate = (href: string): void => {
    selectPage(href as DistributionPageId);
  };
  let periodScope = $state<PeriodScope>("month");
  let selectedPeriod = $state(getLatestDataPeriod());
  const today = todayIso();
  let customRange = $state<DateRange | null>(null);
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
    fileName: "",
    rows: [],
    checksum: "",
    preview: null,
    confirm: null,
    message: "Select a Kontor or RouteNote export (CSV/TSV) to preview."
  });
  let runReceipt = $state<ApiRunReceipt | null>(null);
  let mutationReceipt = $state<ApiMutationReceipt | null>(null);
  let runReceiptPageId = $state<DistributionPageId | null>(null);
  let mutationReceiptPageId = $state<DistributionPageId | null>(null);
  let writesEnabled = $state(false);
  let writeGateMessage = $state("Checking write gate.");
  let tablePaginationLoading = $state<DistributionPagedTableId | null>(null);
  let tablePaginationErrors = $state<Partial<Record<DistributionPagedTableId, string | null>>>({});
  let selectedPaymentId = $state<string | null>(null);
  let paymentPanelMode = $state<PaymentPanelMode | null>(null);
  let paymentReferenceInput = $state("");
  let paymentBankTransactionInput = $state("");
  let recordStatementId = $state("");
  let recordPaymentReference = $state("");
  let selectedSuspenseId = $state<string | null>(null);
  let suspenseTargetTrackId = $state("");
  let suspenseTrackOptions = $state<readonly TrackSummary[] | null>(null);
  let suspenseTrackOptionsError = $state<string | null>(null);
  let selectedRunId = $state<string | null>(null);
  let unpostReasonInput = $state("");
  let catalogPanelMode = $state<CatalogPanelMode | null>(null);
  let releaseTitleInput = $state("");
  let releaseArtistInput = $state("");
  let releaseUpcInput = $state("");
  let releaseStatusInput = $state<CatalogEntryStatus>("draft");
  let releaseDateInput = $state("");
  let trackTitleInput = $state("");
  let trackArtistInput = $state("");
  let trackIsrcInput = $state("");
  let trackReleaseIdInput = $state("");
  let trackStatusInput = $state<CatalogEntryStatus>("draft");
  let contractPanelOpen = $state(false);
  let contractTitleInput = $state("");
  let contractPayeeIdInput = $state("");
  let contractStatusInput = $state<ContractStatus>("draft");
  let contractEffectiveFromInput = $state("");
  let contractEffectiveToInput = $state("");
  let contractSplitPercentInput = $state("");
  let contractCurrencyInput = $state("");
  let ruleContractId = $state<string | null>(null);
  let rulePayeeIdInput = $state("");
  let rulePercentageInput = $state("");
  let expensePanelOpen = $state(false);
  let expenseContractIdInput = $state("");
  let expenseLabelInput = $state("");
  let expenseAmountInput = $state("");
  let expenseDateInput = $state("");
  let printingStatementId = $state<string | null>(null);
  let statementPrintError = $state<string | null>(null);
  // Write failures land here (per page) so a transient mutation error never
  // clobbers the loaded list states rendered by the tables.
  let actionError = $state<string | null>(null);
  let actionErrorPageId = $state<DistributionPageId | null>(null);

  const activePage = $derived(getNavItem(activePageId));
  const distributionPeriod = $derived(selectedPeriod);
  const activeRange = $derived(rangeForScope(periodScope, today, customRange));
  const periodControlVisible = $derived(pageUsesPeriodControl(activePageId));
  const allocationLockKey = $derived(`distribution:allocations:${distributionPeriod}`);
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
  const importPagination = $derived<TablePagination | null>(
    createTablePagination(importBatchesState, tablePaginationLoading === "importBatches", tablePaginationError("importBatches"), loadMoreImportBatches, loadAllImportBatches)
  );
  const mappingPagination = $derived<TablePagination | null>(
    createTablePagination(mappingState, tablePaginationLoading === "mapping", tablePaginationError("mapping"), loadMoreMappingRows, loadAllMappingRows)
  );
  const catalogPagination = $derived<TablePagination | null>(createCatalogPagination());
  const contractsPagination = $derived<TablePagination | null>(
    createTablePagination(contractsState, tablePaginationLoading === "contracts", tablePaginationError("contracts"), loadMoreContracts, loadAllContracts)
  );
  const expensesPagination = $derived<TablePagination | null>(
    createTablePagination(expensesState, tablePaginationLoading === "expenses", tablePaginationError("expenses"), loadMoreExpenses, loadAllExpenses)
  );
  const allocationsPagination = $derived<TablePagination | null>(
    createTablePagination(allocationsState, tablePaginationLoading === "allocations", tablePaginationError("allocations"), loadMoreAllocationRuns, loadAllAllocationRuns)
  );
  const suspensePagination = $derived<TablePagination | null>(
    createTablePagination(suspenseState, tablePaginationLoading === "suspense", tablePaginationError("suspense"), loadMoreSuspense, loadAllSuspense)
  );
  const statementsPagination = $derived<TablePagination | null>(
    createTablePagination(statementsState, tablePaginationLoading === "statements", tablePaginationError("statements"), loadMoreStatements, loadAllStatements)
  );
  const paymentsPagination = $derived<TablePagination | null>(
    createTablePagination(paymentsState, tablePaginationLoading === "payments", tablePaginationError("payments"), loadMorePayments, loadAllPayments)
  );
  const revenuePagination = $derived<TablePagination | null>(
    createTablePagination(revenueState, tablePaginationLoading === "revenue", tablePaginationError("revenue"), loadMoreRevenue, loadAllRevenue)
  );
  const aliasesPagination = $derived<TablePagination | null>(
    createTablePagination(aliasesState, tablePaginationLoading === "aliases", tablePaginationError("aliases"), loadMoreAliases, loadAllAliases)
  );
  const duplicatesPagination = $derived<TablePagination | null>(
    createTablePagination(duplicatesState, tablePaginationLoading === "duplicates", tablePaginationError("duplicates"), loadMoreDuplicates, loadAllDuplicates)
  );
  const auditPagination = $derived<TablePagination | null>(
    createTablePagination(auditLogState, tablePaginationLoading === "auditLog", tablePaginationError("auditLog"), loadMoreAuditLog, loadAllAuditLog)
  );
  const settings = $derived(settingsState.status === "success" ? settingsState.data : null);
  const importToolbarFilters = $derived(createImportToolbarFilters(importState));
  const canPreviewImport = $derived(importState.rows.length > 0 && importState.status !== "loading");
  const canConfirmImport = $derived(importState.preview !== null && importState.status !== "loading");
  const statementPreview = $derived(statements[0] ?? null);
  const selectedPayment = $derived(payments.find((payment: PaymentSummary): boolean => payment.id === selectedPaymentId) ?? null);
  const openStatements = $derived(statements.filter((statement: StatementSummary): boolean => statement.status !== "paid"));
  const recordStatement = $derived(openStatements.find((statement: StatementSummary): boolean => statement.id === recordStatementId) ?? null);
  const selectedSuspenseItem = $derived(suspenseItems.find((item: SuspenseItem): boolean => item.id === selectedSuspenseId) ?? null);
  const selectedSuspenseResolution = $derived(selectedSuspenseItem === null ? null : suspenseResolutionFor(selectedSuspenseItem));
  const selectedSuspenseTrack = $derived(
    (suspenseTrackOptions ?? []).find((track: TrackSummary): boolean => track.id === suspenseTargetTrackId) ?? null
  );
  const suspenseResolveTarget = $derived(resolveSuspenseTargetFor(selectedSuspenseResolution, selectedSuspenseTrack));
  const selectedRun = $derived(allocationRuns.find((run: AllocationRunSummary): boolean => run.id === selectedRunId) ?? null);
  const selectedRuleContract = $derived(contracts.find((contract: DistributionContract): boolean => contract.id === ruleContractId) ?? null);
  const contractSplitBp = $derived(parseSplitBasisPoints(contractSplitPercentInput));
  const selectedExpenseContract = $derived(
    contracts.find((contract: DistributionContract): boolean => contract.id === expenseContractIdInput) ?? null
  );
  const expenseAmountMicro = $derived(parseExpenseAmountMicro(expenseAmountInput));
  const expenseContractSelectOptions = $derived<readonly SelectOption[]>([
    { label: "Select a contract", value: "" },
    ...contracts.map((contract: DistributionContract): SelectOption => ({ label: `${contract.title} · ${contract.currency}`, value: contract.id }))
  ]);
  const payeeSelectOptions = $derived<readonly SelectOption[]>([
    { label: "Select a payee", value: "" },
    ...payees.map((payee: PayeeSummary): SelectOption => ({ label: `${payee.displayName} · ${payee.defaultCurrency}`, value: payee.id }))
  ]);
  const trackReleaseSelectOptions = $derived<readonly SelectOption[]>([
    { label: "No release", value: "" },
    ...releases.map((release: ReleaseSummary): SelectOption => ({ label: `${release.title} · ${release.artistName}`, value: release.id }))
  ]);
  const suspenseTrackSelectOptions = $derived<readonly SelectOption[]>([
    { label: "Select a track", value: "" },
    ...(suspenseTrackOptions ?? []).map((track: TrackSummary): SelectOption => ({ label: `${track.title} · ${track.artistName}`, value: track.id }))
  ]);
  const openStatementSelectOptions = $derived<readonly SelectOption[]>([
    { label: "Select an open statement", value: "" },
    ...openStatements.map((statement: StatementSummary): SelectOption => ({
      label: `${statement.payeeName} · ${statement.period} · ${formatMoney(statement.netPayableMicro, statement.currency)}`,
      value: statement.id
    }))
  ]);
  // The dashboard action list derives from suspense, statements, and payments;
  // its table state must reflect those source requests instead of a frozen default.
  const dashboardActionListStatus = $derived(
    combineRequestStatuses([suspenseState.status, statementsState.status, paymentsState.status])
  );
  const paymentRowActions: readonly TableRowAction[] = [
    { label: "Edit reference", onAction: (rowId: string): void => openPaymentPanel(rowId, "edit") },
    { label: "Reconcile", onAction: (rowId: string): void => openPaymentPanel(rowId, "reconcile") },
    { label: "Void", onAction: (rowId: string): void => openPaymentPanel(rowId, "void"), danger: true }
  ];
  const contractRowActions: readonly TableRowAction[] = [
    { label: "Add rule", onAction: openContractRulePanel }
  ];
  const statementRowActions: readonly TableRowAction[] = [
    { label: "Print PDF", onAction: printStatementPdf }
  ];
  const suspenseRowActions: readonly TableRowAction[] = [
    { label: "Resolve", onAction: openSuspenseResolution }
  ];
  const allocationRowActions: readonly TableRowAction[] = [
    { label: "Request unpost", onAction: selectRunForUnpost, danger: true }
  ];

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
      loadWriteGate(),
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

  function tablePaginationError(tableId: DistributionPagedTableId): string | null {
    return tablePaginationErrors[tableId] ?? null;
  }

  function setTablePaginationError(tableId: DistributionPagedTableId, error: string | null): void {
    tablePaginationErrors = {
      ...tablePaginationErrors,
      [tableId]: error
    };
  }

  async function loadDistributionPageResult<TItem>(
    tableId: DistributionPagedTableId,
    state: ApiRequestState<PageResult<TItem>>,
    setState: (state: ApiRequestState<PageResult<TItem>>) => void,
    fetchPage: (cursor: string) => Promise<PageResult<TItem>>,
    mode: PageLoadMode
  ): Promise<void> {
    await loadPageResult(mode, {
      state,
      loading: tablePaginationLoading === tableId,
      setLoading: (loading: boolean): void => {
        tablePaginationLoading = loading ? tableId : null;
      },
      setError: (error: string | null): void => {
        setTablePaginationError(tableId, error);
      },
      setState,
      fetchPage
    });
  }

  function createCatalogPagination(): TablePagination | null {
    if (releasesState.status !== "success" || tracksState.status !== "success") {
      return null;
    }

    const loadedCount = releasesState.data.items.length + tracksState.data.items.length;
    const hasMore = releasesState.data.nextCursor !== null || tracksState.data.nextCursor !== null;

    return {
      loadedCount,
      hasMore,
      loading: tablePaginationLoading === "catalog",
      error: tablePaginationError("catalog"),
      onLoadMore: loadMoreCatalog,
      onLoadAll: loadAllCatalog
    };
  }

  async function loadMoreImportBatches(): Promise<void> {
    await loadImportBatchesPage("one");
  }

  async function loadAllImportBatches(): Promise<void> {
    await loadImportBatchesPage("all");
  }

  async function loadImportBatchesPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "importBatches",
      importBatchesState,
      (state: ApiRequestState<PageResult<DistributionImportBatch>>): void => {
        importBatchesState = state;
      },
      (cursor: string): Promise<PageResult<DistributionImportBatch>> =>
        client.distribution.listImportBatches({
          workspaceId: distributionWorkspaceId,
          source: toNullableImportSource(importSourceFilter),
          status: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreMappingRows(): Promise<void> {
    await loadMappingRowsPage("one");
  }

  async function loadAllMappingRows(): Promise<void> {
    await loadMappingRowsPage("all");
  }

  async function loadMappingRowsPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "mapping",
      mappingState,
      (state: ApiRequestState<PageResult<DistributionMappingRow>>): void => {
        mappingState = state;
      },
      (cursor: string): Promise<PageResult<DistributionMappingRow>> =>
        client.distribution.listMappingRows({
          workspaceId: distributionWorkspaceId,
          batchId: null,
          status: toNullableMappingStatus(mappingStatusFilter),
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreCatalog(): Promise<void> {
    await loadCatalogPage("one");
  }

  async function loadAllCatalog(): Promise<void> {
    await loadCatalogPage("all");
  }

  async function loadCatalogPage(mode: PageLoadMode): Promise<void> {
    if (
      tablePaginationLoading === "catalog" ||
      releasesState.status !== "success" ||
      tracksState.status !== "success" ||
      (releasesState.data.nextCursor === null && tracksState.data.nextCursor === null)
    ) {
      return;
    }

    tablePaginationLoading = "catalog";
    setTablePaginationError("catalog", null);

    try {
      let releaseCursor: string | null = releasesState.data.nextCursor;
      let trackCursor: string | null = tracksState.data.nextCursor;
      let loadedReleases: PageResult<ReleaseSummary> = releasesState.data;
      let loadedTracks: PageResult<TrackSummary> = tracksState.data;

      while (releaseCursor !== null || trackCursor !== null) {
        const [releasePage, trackPage] = await Promise.all([
          releaseCursor === null
            ? Promise.resolve(null)
            : client.distribution.listReleases({
                workspaceId: distributionWorkspaceId,
                status: null,
                cursor: releaseCursor,
                limit: TABLE_PAGE_SIZE
              }),
          trackCursor === null
            ? Promise.resolve(null)
            : client.distribution.listTracks({
                workspaceId: distributionWorkspaceId,
                releaseId: null,
                status: null,
                cursor: trackCursor,
                limit: TABLE_PAGE_SIZE
              })
        ]);

        if (releasePage !== null) {
          loadedReleases = appendPageResult(loadedReleases, releasePage);
          releasesState = createSuccessState<PageResult<ReleaseSummary>>(loadedReleases);
          releaseCursor = releasePage.nextCursor;
        }

        if (trackPage !== null) {
          loadedTracks = appendPageResult(loadedTracks, trackPage);
          tracksState = createSuccessState<PageResult<TrackSummary>>(loadedTracks);
          trackCursor = trackPage.nextCursor;
        }

        if (mode === "one") {
          break;
        }
      }
    } catch (error: unknown) {
      setTablePaginationError("catalog", getErrorMessage(error));
    } finally {
      tablePaginationLoading = null;
    }
  }

  async function loadMoreContracts(): Promise<void> {
    await loadContractsPage("one");
  }

  async function loadAllContracts(): Promise<void> {
    await loadContractsPage("all");
  }

  async function loadContractsPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "contracts",
      contractsState,
      (state: ApiRequestState<PageResult<DistributionContract>>): void => {
        contractsState = state;
      },
      (cursor: string): Promise<PageResult<DistributionContract>> =>
        client.distribution.listContracts({
          workspaceId: distributionWorkspaceId,
          payeeId: null,
          status: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreExpenses(): Promise<void> {
    await loadExpensesPage("one");
  }

  async function loadAllExpenses(): Promise<void> {
    await loadExpensesPage("all");
  }

  async function loadExpensesPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "expenses",
      expensesState,
      (state: ApiRequestState<PageResult<DistributionContractExpense>>): void => {
        expensesState = state;
      },
      (cursor: string): Promise<PageResult<DistributionContractExpense>> =>
        client.distribution.listContractExpenses({
          workspaceId: distributionWorkspaceId,
          contractId: contracts[0]?.id ?? "contract_alma",
          status: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreAllocationRuns(): Promise<void> {
    await loadAllocationRunsPage("one");
  }

  async function loadAllAllocationRuns(): Promise<void> {
    await loadAllocationRunsPage("all");
  }

  async function loadAllocationRunsPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "allocations",
      allocationsState,
      (state: ApiRequestState<PageResult<AllocationRunSummary>>): void => {
        allocationsState = state;
      },
      (cursor: string): Promise<PageResult<AllocationRunSummary>> =>
        client.distribution.listAllocationRuns({
          workspaceId: distributionWorkspaceId,
          period: null,
          status: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreSuspense(): Promise<void> {
    await loadSuspensePage("one");
  }

  async function loadAllSuspense(): Promise<void> {
    await loadSuspensePage("all");
  }

  async function loadSuspensePage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "suspense",
      suspenseState,
      (state: ApiRequestState<PageResult<SuspenseItem>>): void => {
        suspenseState = state;
      },
      (cursor: string): Promise<PageResult<SuspenseItem>> =>
        client.distribution.listSuspense({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          status: toNullableSuspenseStatus(suspenseStatusFilter),
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreStatements(): Promise<void> {
    await loadStatementsPage("one");
  }

  async function loadAllStatements(): Promise<void> {
    await loadStatementsPage("all");
  }

  async function loadStatementsPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "statements",
      statementsState,
      (state: ApiRequestState<PageResult<StatementSummary>>): void => {
        statementsState = state;
      },
      (cursor: string): Promise<PageResult<StatementSummary>> =>
        client.distribution.listStatements({
          workspaceId: distributionWorkspaceId,
          period: null,
          payeeId: null,
          status: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMorePayments(): Promise<void> {
    await loadPaymentsPage("one");
  }

  async function loadAllPayments(): Promise<void> {
    await loadPaymentsPage("all");
  }

  async function loadPaymentsPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "payments",
      paymentsState,
      (state: ApiRequestState<PageResult<PaymentSummary>>): void => {
        paymentsState = state;
      },
      (cursor: string): Promise<PageResult<PaymentSummary>> =>
        client.distribution.listPayments({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: null,
          status: toNullablePaymentStatus(paymentStatusFilter),
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreRevenue(): Promise<void> {
    await loadRevenuePage("one");
  }

  async function loadAllRevenue(): Promise<void> {
    await loadRevenuePage("all");
  }

  async function loadRevenuePage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "revenue",
      revenueState,
      (state: ApiRequestState<PageResult<DistributionRevenueRow>>): void => {
        revenueState = state;
      },
      (cursor: string): Promise<PageResult<DistributionRevenueRow>> =>
        client.distribution.getRevenue({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: null,
          store: null,
          currency: null,
          groupBy: revenueGroupBy,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreAliases(): Promise<void> {
    await loadAliasesPage("one");
  }

  async function loadAllAliases(): Promise<void> {
    await loadAliasesPage("all");
  }

  async function loadAliasesPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "aliases",
      aliasesState,
      (state: ApiRequestState<PageResult<DistributionAlias>>): void => {
        aliasesState = state;
      },
      (cursor: string): Promise<PageResult<DistributionAlias>> =>
        client.distribution.listAliases({
          workspaceId: distributionWorkspaceId,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreDuplicates(): Promise<void> {
    await loadDuplicatesPage("one");
  }

  async function loadAllDuplicates(): Promise<void> {
    await loadDuplicatesPage("all");
  }

  async function loadDuplicatesPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "duplicates",
      duplicatesState,
      (state: ApiRequestState<PageResult<DistributionDuplicate>>): void => {
        duplicatesState = state;
      },
      (cursor: string): Promise<PageResult<DistributionDuplicate>> =>
        client.distribution.listDuplicates({
          workspaceId: distributionWorkspaceId,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreAuditLog(): Promise<void> {
    await loadAuditLogPage("one");
  }

  async function loadAllAuditLog(): Promise<void> {
    await loadAuditLogPage("all");
  }

  async function loadAuditLogPage(mode: PageLoadMode): Promise<void> {
    await loadDistributionPageResult(
      "auditLog",
      auditLogState,
      (state: ApiRequestState<PageResult<AuditLogEntry>>): void => {
        auditLogState = state;
      },
      (cursor: string): Promise<PageResult<AuditLogEntry>> =>
        client.distribution.listAuditLog({
          workspaceId: distributionWorkspaceId,
          from: null,
          to: null,
          actorId: null,
          entityType: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadWriteGate(): Promise<void> {
    try {
      // Distribution-scoped write gate: the distribution role is 403 on cc/v1 since the domain-authz
      // fix, so read writesEnabled from erh/v1/status — not cc/v1/status.
      const status = await client.distribution.getStatus({
        workspaceId: distributionWorkspaceId
      });
      writesEnabled = status.writesEnabled;
      writeGateMessage = status.writesEnabled ? "writes enabled" : "enable writes";
    } catch (error: unknown) {
      writesEnabled = false;
      writeGateMessage = getErrorMessage(error);
    }
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
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("importBatches", null);
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
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("mapping", null);
    } catch (error: unknown) {
      mappingState = createErrorState<PageResult<DistributionMappingRow>>(error);
    }
  }

  async function loadPayees(): Promise<void> {
    payeesState = createLoadingState<PageResult<PayeeSummary>>();

    try {
      payeesState = createSuccessState<PageResult<PayeeSummary>>(
        await client.distribution.listPayees({ workspaceId: distributionWorkspaceId, status: null, cursor: null, limit: TABLE_PAGE_SIZE })
      );
      setTablePaginationError("payees", null);
    } catch (error: unknown) {
      payeesState = createErrorState<PageResult<PayeeSummary>>(error);
    }
  }

  async function loadCatalog(): Promise<void> {
    releasesState = createLoadingState<PageResult<ReleaseSummary>>();
    tracksState = createLoadingState<PageResult<TrackSummary>>();

    try {
      const [releasePage, trackPage] = await Promise.all([
        client.distribution.listReleases({ workspaceId: distributionWorkspaceId, status: null, cursor: null, limit: TABLE_PAGE_SIZE }),
        client.distribution.listTracks({ workspaceId: distributionWorkspaceId, releaseId: null, status: null, cursor: null, limit: TABLE_PAGE_SIZE })
      ]);
      releasesState = createSuccessState<PageResult<ReleaseSummary>>(releasePage);
      tracksState = createSuccessState<PageResult<TrackSummary>>(trackPage);
      setTablePaginationError("catalog", null);
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
        limit: TABLE_PAGE_SIZE
      });
      const firstContract = contractPage.items[0];
      const expensePage = await client.distribution.listContractExpenses({
        workspaceId: distributionWorkspaceId,
        contractId: firstContract?.id ?? "contract_alma",
        status: null,
        cursor: null,
        limit: TABLE_PAGE_SIZE
      });
      contractsState = createSuccessState<PageResult<DistributionContract>>(contractPage);
      expensesState = createSuccessState<PageResult<DistributionContractExpense>>(expensePage);
      setTablePaginationError("contracts", null);
      setTablePaginationError("expenses", null);
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
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("allocations", null);
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
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("suspense", null);
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
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("statements", null);
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
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("payments", null);
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
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("revenue", null);
    } catch (error: unknown) {
      revenueState = createErrorState<PageResult<DistributionRevenueRow>>(error);
    }
  }

  async function loadReconciliation(): Promise<void> {
    reconciliationState = createLoadingState<DistributionReconciliationResponse>();

    try {
      reconciliationState = createSuccessState<DistributionReconciliationResponse>(
        await client.distribution.getFinancialReconciliation({
          workspaceId: distributionWorkspaceId
        })
      );
    } catch (error: unknown) {
      reconciliationState = createErrorState<DistributionReconciliationResponse>(error);
    }
  }

  async function loadAliases(): Promise<void> {
    aliasesState = createLoadingState<PageResult<DistributionAlias>>();

    try {
      aliasesState = createSuccessState<PageResult<DistributionAlias>>(
        await client.distribution.listAliases({
          workspaceId: distributionWorkspaceId,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("aliases", null);
    } catch (error: unknown) {
      aliasesState = createErrorState<PageResult<DistributionAlias>>(error);
    }
  }

  async function loadDuplicates(): Promise<void> {
    duplicatesState = createLoadingState<PageResult<DistributionDuplicate>>();

    try {
      duplicatesState = createSuccessState<PageResult<DistributionDuplicate>>(
        await client.distribution.listDuplicates({
          workspaceId: distributionWorkspaceId,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("duplicates", null);
    } catch (error: unknown) {
      duplicatesState = createErrorState<PageResult<DistributionDuplicate>>(error);
    }
  }

  async function loadAuditLog(): Promise<void> {
    auditLogState = createLoadingState<PageResult<AuditLogEntry>>();

    try {
      auditLogState = createSuccessState<PageResult<AuditLogEntry>>(
        await client.distribution.listAuditLog({
          workspaceId: distributionWorkspaceId,
          from: null,
          to: null,
          actorId: null,
          entityType: null,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("auditLog", null);
    } catch (error: unknown) {
      auditLogState = createErrorState<PageResult<AuditLogEntry>>(error);
    }
  }

  async function loadSettings(): Promise<void> {
    settingsState = createLoadingState<DistributionSettingsResponse>();

    try {
      settingsState = createSuccessState<DistributionSettingsResponse>(
        await client.distribution.getSettings({
          workspaceId: distributionWorkspaceId
        })
      );
    } catch (error: unknown) {
      settingsState = createErrorState<DistributionSettingsResponse>(error);
    }
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
    const normalizedPath = normalizeRoutePath(pathname);

    if (normalizedPath.endsWith("/console/distribution/contracts/duplicates")) {
      return "duplicates";
    }

    if (normalizedPath.endsWith("/console/contracts/duplicates")) {
      return "duplicates";
    }

    if (normalizedPath.endsWith("/console/distribution/contracts")) {
      return "contracts";
    }

    if (normalizedPath.endsWith("/console/contracts")) {
      return "contracts";
    }

    if (normalizedPath.endsWith("/console/import")) {
      return "imports";
    }

    if (normalizedPath.endsWith("/console/imports")) {
      return "imports";
    }

    if (normalizedPath.endsWith("/console/mapping")) {
      return "mapping";
    }

    if (normalizedPath.endsWith("/console/catalog")) {
      return "catalog";
    }

    if (normalizedPath.endsWith("/console/allocations")) {
      return "allocations";
    }

    if (normalizedPath.endsWith("/console/action-needed")) {
      return "suspense";
    }

    if (normalizedPath.endsWith("/console/suspense")) {
      return "suspense";
    }

    if (normalizedPath.endsWith("/console/statements")) {
      return "statements";
    }

    if (normalizedPath.endsWith("/console/payments")) {
      return "payments";
    }

    if (normalizedPath.endsWith("/console/revenue")) {
      return "revenue";
    }

    if (normalizedPath.endsWith("/console/aliases")) {
      return "aliases";
    }

    if (normalizedPath.endsWith("/console/duplicates")) {
      return "duplicates";
    }

    if (normalizedPath.endsWith("/console/audit-log")) {
      return "audit-log";
    }

    if (normalizedPath.endsWith("/console/distribution/import")) {
      return "imports";
    }

    if (normalizedPath.endsWith("/console/distribution/audit")) {
      return "audit-log";
    }

    if (normalizedPath.endsWith("/console/distribution/imports")) {
      return "imports";
    }

    if (normalizedPath.endsWith("/console/distribution/mapping")) {
      return "mapping";
    }

    if (normalizedPath.endsWith("/console/distribution/catalog")) {
      return "catalog";
    }

    if (normalizedPath.endsWith("/console/distribution/allocations")) {
      return "allocations";
    }

    if (normalizedPath.endsWith("/console/distribution/action-needed")) {
      return "suspense";
    }

    if (normalizedPath.endsWith("/console/distribution/suspense")) {
      return "suspense";
    }

    if (normalizedPath.endsWith("/console/distribution/statements")) {
      return "statements";
    }

    if (normalizedPath.endsWith("/console/distribution/payments")) {
      return "payments";
    }

    if (normalizedPath.endsWith("/console/distribution/revenue")) {
      return "revenue";
    }

    if (normalizedPath.endsWith("/console/distribution/financial-reconciliation")) {
      return "financial-reconciliation";
    }

    if (normalizedPath.endsWith("/console/distribution/aliases")) {
      return "aliases";
    }

    if (normalizedPath.endsWith("/console/distribution/duplicates")) {
      return "duplicates";
    }

    if (normalizedPath.endsWith("/console/distribution/audit-log")) {
      return "audit-log";
    }

    if (normalizedPath.endsWith("/console/distribution/settings")) {
      return "settings";
    }

    if (normalizedPath.endsWith("/console/financial-reconciliation")) {
      return "financial-reconciliation";
    }

    if (normalizedPath.endsWith("/console/settings")) {
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
    clearMutationReceipt();
    clearRunReceipt();
  }

  function clearMutationReceipt(): void {
    mutationReceipt = null;
    mutationReceiptPageId = null;
    actionError = null;
    actionErrorPageId = null;
  }

  function clearRunReceipt(): void {
    runReceipt = null;
    runReceiptPageId = null;
    actionError = null;
    actionErrorPageId = null;
  }

  // Routes a write failure to the dedicated action banner: the loaded list
  // states stay intact so the tables keep rendering the last known data.
  function reportActionError(error: unknown): void {
    actionError = getErrorMessage(error);
    actionErrorPageId = activePageId;
  }

  function updateImportFilter(value: string): void {
    importSourceFilter = value as ImportSourceFilter;
  }

  function updateImportSource(value: string): void {
    const source = distributionImportSourceFromValue(value);

    importState = {
      ...importState,
      source,
      preview: null,
      confirm: null,
      message: "Source changed, run preview again."
    };
  }

  async function handleImportFile(event: Event): Promise<void> {
    const input = event.currentTarget;

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected file input event target.");
    }

    const file = input.files?.item(0) ?? null;

    if (file === null) {
      return;
    }

    if (/\.xlsx?$/iu.test(file.name)) {
      importState = {
        ...importState,
        status: "error",
        fileName: file.name,
        rows: [],
        checksum: "",
        preview: null,
        confirm: null,
        message: `${file.name} is a binary Excel export and cannot be parsed here. Re-export it as CSV, then retry.`
      };
      return;
    }

    try {
      const text = await file.text();
      const rows = file.name.toLowerCase().endsWith(".tsv") ? parseTsvRecords(text) : parseCsvRecords(text);

      if (rows.length === 0) {
        importState = {
          ...importState,
          status: "error",
          fileName: file.name,
          rows: [],
          checksum: "",
          preview: null,
          confirm: null,
          message: "No parseable rows in this file. Expecting a header line followed by data rows."
        };
        return;
      }

      importState = {
        ...importState,
        status: "idle",
        fileName: file.name,
        rows,
        checksum: importContentChecksum(text),
        preview: null,
        confirm: null,
        message: `${String(rows.length)} rows parsed, ready for preview.`
      };
    } catch (error: unknown) {
      importState = {
        ...importState,
        status: "error",
        fileName: file.name,
        rows: [],
        checksum: "",
        preview: null,
        confirm: null,
        message: getErrorMessage(error)
      };
    }
  }

  function selectImportToolbarFilter(filter: ToolbarFilter): void {
    if (filter.actionId === "source") {
      cycleImportSource();
      return;
    }

    if (filter.actionId === "file") {
      clearImportFile();
      return;
    }

    if (filter.actionId === "status") {
      void previewImport();
      return;
    }

    throw new Error(`Unknown Distribution import toolbar action: ${filter.label}.`);
  }

  function cycleImportSource(): void {
    const currentIndex = importSourceOptions.findIndex((option: SelectOption): boolean => option.value === importState.source);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % importSourceOptions.length;
    const nextOption = importSourceOptions[nextIndex];

    if (nextOption === undefined) {
      throw new Error("Distribution import source options are empty.");
    }

    const source = distributionImportSourceFromValue(nextOption.value);
    importState = {
      ...importState,
      source,
      preview: null,
      confirm: null,
      message: "Source changed, run preview again."
    };
  }

  function clearImportFile(): void {
    importState = {
      ...importState,
      status: "idle",
      fileName: "",
      rows: [],
      checksum: "",
      preview: null,
      confirm: null,
      message: "Select a Kontor or RouteNote export (CSV/TSV) to preview."
    };
  }

  function updateMappingStatus(value: string): void {
    mappingStatusFilter = value as MappingStatusFilter;
  }

  function updateSuspenseStatus(value: string): void {
    suspenseStatusFilter = value as SuspenseStatusFilter;
  }

  function updatePaymentStatus(value: string): void {
    paymentStatusFilter = value as PaymentStatusFilter;
  }

  function updateRevenueGroup(value: string): void {
    revenueGroupBy = value as RevenueGroupBy;
  }

  function updateRecordStatement(value: string): void {
    recordStatementId = value;
  }

  function updateRecordPaymentReference(value: string): void {
    recordPaymentReference = value;
  }

  function updatePaymentReferenceInput(value: string): void {
    paymentReferenceInput = value;
  }

  function updatePaymentBankTransactionInput(value: string): void {
    paymentBankTransactionInput = value;
  }

  function updateSuspenseTargetTrack(value: string): void {
    suspenseTargetTrackId = value;
  }

  function updateUnpostReason(value: string): void {
    unpostReasonInput = value;
  }

  function updateReleaseTitle(value: string): void {
    releaseTitleInput = value;
  }

  function updateReleaseArtist(value: string): void {
    releaseArtistInput = value;
  }

  function updateReleaseUpc(value: string): void {
    releaseUpcInput = value;
  }

  function updateReleaseStatus(value: string): void {
    releaseStatusInput = value as CatalogEntryStatus;
  }

  function updateReleaseDate(event: Event): void {
    releaseDateInput = readInputValue(event);
  }

  function updateTrackTitle(value: string): void {
    trackTitleInput = value;
  }

  function updateTrackArtist(value: string): void {
    trackArtistInput = value;
  }

  function updateTrackIsrc(value: string): void {
    trackIsrcInput = value;
  }

  function updateTrackRelease(value: string): void {
    trackReleaseIdInput = value;
  }

  function updateTrackStatus(value: string): void {
    trackStatusInput = value as CatalogEntryStatus;
  }

  function updateContractTitle(value: string): void {
    contractTitleInput = value;
  }

  function updateContractPayee(value: string): void {
    contractPayeeIdInput = value;
  }

  function updateContractStatus(value: string): void {
    contractStatusInput = value as ContractStatus;
  }

  function updateContractEffectiveFrom(event: Event): void {
    contractEffectiveFromInput = readInputValue(event);
  }

  function updateContractEffectiveTo(event: Event): void {
    contractEffectiveToInput = readInputValue(event);
  }

  function updateContractSplitPercent(value: string): void {
    contractSplitPercentInput = value;
  }

  function updateContractCurrency(value: string): void {
    contractCurrencyInput = value;
  }

  function updateRulePayee(value: string): void {
    rulePayeeIdInput = value;
  }

  function updateRulePercentage(value: string): void {
    rulePercentageInput = value;
  }

  function updatePeriodScope(value: string): void {
    periodScope = value as PeriodScope;
    if (periodScope === "custom" && customRange === null) {
      customRange = activeRange;
    }
    void reloadPeriodScopedData();
  }

  function updateCustomFrom(event: Event): void {
    const base = customRange ?? activeRange;
    customRange = { from: readInputValue(event), to: base.to };
    void reloadPeriodScopedData();
  }

  function updateCustomTo(event: Event): void {
    const base = customRange ?? activeRange;
    customRange = { from: base.from, to: readInputValue(event) };
    void reloadPeriodScopedData();
  }

  async function reloadPeriodScopedData(): Promise<void> {
    await Promise.all([
      loadDashboard(),
      loadSuspense(),
      loadPayments(),
      loadRevenue()
    ]);
  }

  async function previewImport(): Promise<void> {
    if (importState.rows.length === 0) {
      importState = {
        ...importState,
        status: "error",
        preview: null,
        confirm: null,
        message: "Select a CSV/TSV export file before running the preview."
      };
      return;
    }

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
        checksum: importState.checksum,
        rows: importState.rows
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
    const preview = importState.preview;
    if (preview === null) {
      return;
    }

    importState = {
      ...importState,
      status: "loading",
      message: "Import confirmation in progress."
    };

    try {
      // The preview endpoint enumerates the submitted rows as row_1..row_N (in submission
      // order) and reports how many it accepted; rebuild those ids from the response.
      const acceptedRowIds = Array.from(
        { length: preview.acceptedRowCount },
        (_: unknown, index: number): string => `row_${String(index + 1)}`
      );
      const confirm = await client.distribution.confirmImport(
        {
          workspaceId: distributionWorkspaceId,
          previewId: preview.previewId,
          acceptedRowIds,
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
      await loadImportBatches();
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
      await loadMappingRows();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openExpensePanel(): void {
    expensePanelOpen = true;
    expenseContractIdInput = "";
    expenseLabelInput = "";
    expenseAmountInput = "";
    expenseDateInput = today;
  }

  function closeExpensePanel(): void {
    expensePanelOpen = false;
  }

  function updateExpenseContract(value: string): void {
    expenseContractIdInput = value;
  }

  function updateExpenseLabel(value: string): void {
    expenseLabelInput = value;
  }

  function updateExpenseAmount(value: string): void {
    expenseAmountInput = value;
  }

  function updateExpenseDate(event: Event): void {
    expenseDateInput = readInputValue(event);
  }

  // Interprets the input as a DECIMAL money value ("2500" or "2500.50") and converts
  // it to micro units (10^6); returns null while the input is not a valid amount yet.
  function parseExpenseAmountMicro(input: string): string | null {
    const match = /^(\d+)(?:[.,](\d{1,2}))?$/u.exec(input.trim());

    if (match === null || match[1] === undefined) {
      return null;
    }

    const micro = BigInt(match[1]) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0"));

    if (micro <= 0n) {
      return null;
    }

    return micro.toString();
  }

  async function recordExpense(): Promise<void> {
    const contract = selectedExpenseContract;
    const label = expenseLabelInput.trim();
    const amountMicro = expenseAmountMicro;

    if (contract === null || label === "" || amountMicro === null || expenseDateInput === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.recordContractExpense(
        {
          workspaceId: distributionWorkspaceId,
          contractId: contract.id,
          payeeId: contract.payeeId,
          incurredOn: expenseDateInput,
          label,
          amountMicro,
          currency: contract.currency
        },
        {
          idempotencyKey: createIdempotencyKey("expense-record")
        }
      );
      mutationReceiptPageId = activePageId;
      closeExpensePanel();
      await loadContracts();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openCatalogPanel(mode: CatalogPanelMode): void {
    catalogPanelMode = mode;
    releaseTitleInput = "";
    releaseArtistInput = "";
    releaseUpcInput = "";
    releaseStatusInput = "draft";
    releaseDateInput = "";
    trackTitleInput = "";
    trackArtistInput = "";
    trackIsrcInput = "";
    trackReleaseIdInput = "";
    trackStatusInput = "draft";
  }

  function closeCatalogPanel(): void {
    catalogPanelMode = null;
  }

  async function createRelease(): Promise<void> {
    const title = releaseTitleInput.trim();
    const artistName = releaseArtistInput.trim();

    if (title === "" || artistName === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.createRelease(
        {
          workspaceId: distributionWorkspaceId,
          id: null,
          title,
          artistName,
          upc: releaseUpcInput.trim() === "" ? null : releaseUpcInput.trim(),
          status: releaseStatusInput,
          releaseDate: releaseDateInput === "" ? null : releaseDateInput
        },
        {
          idempotencyKey: createIdempotencyKey("release-create")
        }
      );
      mutationReceiptPageId = activePageId;
      closeCatalogPanel();
      await loadCatalog();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function createTrack(): Promise<void> {
    const title = trackTitleInput.trim();
    const artistName = trackArtistInput.trim();

    if (title === "" || artistName === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.createTrack(
        {
          workspaceId: distributionWorkspaceId,
          id: null,
          releaseId: trackReleaseIdInput === "" ? null : trackReleaseIdInput,
          title,
          artistName,
          isrc: trackIsrcInput.trim() === "" ? null : trackIsrcInput.trim(),
          status: trackStatusInput
        },
        {
          idempotencyKey: createIdempotencyKey("track-create")
        }
      );
      mutationReceiptPageId = activePageId;
      closeCatalogPanel();
      await loadCatalog();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openContractPanel(): void {
    contractPanelOpen = true;
    contractTitleInput = "";
    contractPayeeIdInput = "";
    contractStatusInput = "draft";
    contractEffectiveFromInput = today;
    contractEffectiveToInput = "";
    contractSplitPercentInput = "";
    contractCurrencyInput = "";
  }

  function closeContractPanel(): void {
    contractPanelOpen = false;
  }

  // Split percent is typed as a human percentage (e.g. "80" or "12.5") and
  // stored as basis points; null means the input is not a valid percentage yet.
  function parseSplitBasisPoints(value: string): number | null {
    const trimmed = value.trim();

    if (!/^\d+(\.\d{1,2})?$/u.test(trimmed)) {
      return null;
    }

    const basisPoints = Math.round(Number(trimmed) * 100);

    if (basisPoints <= 0 || basisPoints > 10000) {
      return null;
    }

    return basisPoints;
  }

  async function createContract(): Promise<void> {
    const title = contractTitleInput.trim();
    const currency = contractCurrencyInput.trim().toUpperCase();
    const splitBp = contractSplitBp;

    if (title === "" || contractPayeeIdInput === "" || contractEffectiveFromInput === "" || splitBp === null || currency === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.createContract(
        {
          workspaceId: distributionWorkspaceId,
          id: null,
          payeeId: contractPayeeIdInput,
          title,
          status: contractStatusInput,
          effectiveFrom: contractEffectiveFromInput,
          effectiveTo: contractEffectiveToInput === "" ? null : contractEffectiveToInput,
          splitBp,
          currency
        },
        {
          idempotencyKey: createIdempotencyKey("contract-create")
        }
      );
      mutationReceiptPageId = activePageId;
      closeContractPanel();
      await loadContracts();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openContractRulePanel(rowId: string): void {
    const contract = contracts.find((candidate: DistributionContract): boolean => candidate.id === rowId);

    if (contract === undefined) {
      return;
    }

    ruleContractId = rowId;
    rulePayeeIdInput = contract.payeeId;
    rulePercentageInput = "";
  }

  function closeContractRulePanel(): void {
    ruleContractId = null;
    rulePayeeIdInput = "";
    rulePercentageInput = "";
  }

  async function addContractRule(): Promise<void> {
    const contract = selectedRuleContract;
    const percentage = rulePercentageInput.trim();

    if (contract === null || rulePayeeIdInput === "" || percentage === "") {
      return;
    }

    clearRunReceipt();

    try {
      // The rules route replaces the full royalty rule set and the server
      // rejects any set that does not total exactly 100 percent.
      mutationReceipt = await client.distribution.updateContractRules(
        contract.id,
        {
          workspaceId: distributionWorkspaceId,
          rules: [
            {
              payeeId: rulePayeeIdInput,
              percentage,
              scopeType: null,
              scopeId: null,
              effectiveFrom: null,
              effectiveTo: null
            }
          ]
        },
        {
          idempotencyKey: createIdempotencyKey("contract-rules")
        }
      );
      mutationReceiptPageId = activePageId;
      closeContractRulePanel();
      await loadContracts();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function previewAllocationRun(): Promise<void> {
    clearMutationReceipt();

    try {
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
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function startCadencedAllocationRun(): Promise<void> {
    clearMutationReceipt();

    try {
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
      // The cadenced run persists a new calculation run; refresh the run list.
      await loadAllocationRuns();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function selectRunForUnpost(runId: string): void {
    const run = allocationRuns.find((candidate: AllocationRunSummary): boolean => candidate.id === runId);

    if (run === undefined) {
      return;
    }

    selectedRunId = runId;
    unpostReasonInput = "";
  }

  function closeUnpostPanel(): void {
    selectedRunId = null;
    unpostReasonInput = "";
  }

  async function unpostAllocationRun(): Promise<void> {
    const run = selectedRun;
    const reason = unpostReasonInput.trim();

    if (run === null || reason === "") {
      return;
    }

    clearMutationReceipt();

    try {
      runReceipt = await client.distribution.requestAllocationUnpostRun(
        run.id,
        {
          workspaceId: distributionWorkspaceId,
          reason,
          // The server re-acquires the advisory lock under the run's own lock key
          // ("distribution:allocation:<runId>", surfaced as AllocationRunSummary.lockKey),
          // so that key is the real token to hand back on unpost.
          lockToken: run.lockKey
        },
        {
          idempotencyKey: createIdempotencyKey("allocation-unpost")
        }
      );
      runReceiptPageId = activePageId;
      closeUnpostPanel();
      await loadAllocationRuns();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openSuspenseResolution(rowId: string): void {
    const item = suspenseItems.find((candidate: SuspenseItem): boolean => candidate.id === rowId);

    if (item === undefined || item.status !== "open") {
      return;
    }

    selectedSuspenseId = rowId;
    suspenseTargetTrackId = "";
    void ensureSuspenseTrackOptions();
  }

  function closeSuspensePanel(): void {
    selectedSuspenseId = null;
    suspenseTargetTrackId = "";
  }

  async function ensureSuspenseTrackOptions(): Promise<void> {
    // The catalog can span several pages; fetch it once and cache it for later panels.
    if (suspenseTrackOptions !== null) {
      return;
    }

    suspenseTrackOptionsError = null;

    try {
      const items: TrackSummary[] = [];
      let cursor: string | null = null;

      do {
        const page: PageResult<TrackSummary> = await client.distribution.listTracks({
          workspaceId: distributionWorkspaceId,
          releaseId: null,
          status: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        });
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor !== null);

      suspenseTrackOptions = items;
    } catch (error: unknown) {
      suspenseTrackOptionsError = getErrorMessage(error);
    }
  }

  interface SuspenseResolveTarget {
    readonly ready: boolean;
    readonly targetId: string | null;
    readonly hint: string;
  }

  function resolveSuspenseTargetFor(
    resolution: "map_to_release" | "map_to_track" | "hold" | null,
    track: TrackSummary | null
  ): SuspenseResolveTarget {
    if (resolution === null) {
      return { ready: false, targetId: null, hint: "Select a suspense item first." };
    }

    if (resolution === "hold") {
      return { ready: true, targetId: null, hint: "" };
    }

    if (track === null) {
      return { ready: false, targetId: null, hint: "Pick the target track first." };
    }

    if (resolution === "map_to_track") {
      return { ready: true, targetId: track.id, hint: "" };
    }

    if (track.releaseId === null) {
      return { ready: false, targetId: null, hint: "This track has no release; pick a track attached to a release." };
    }

    return { ready: true, targetId: track.releaseId, hint: "" };
  }

  async function resolveSelectedSuspense(): Promise<void> {
    const item = selectedSuspenseItem;
    const target = suspenseResolveTarget;

    if (item === null || !target.ready) {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.resolveSuspense(
        {
          workspaceId: distributionWorkspaceId,
          suspenseId: item.id,
          resolution: suspenseResolutionFor(item),
          targetId: target.targetId,
          note: `Resolved through ${item.exactFixPath}`
        },
        {
          idempotencyKey: createIdempotencyKey("suspense-resolve")
        }
      );
      mutationReceiptPageId = activePageId;
      closeSuspensePanel();
      await loadSuspense();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function generateStatements(): Promise<void> {
    clearMutationReceipt();

    try {
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
      // The generation run persists new statements; refresh the list.
      await loadStatements();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function printStatementPdf(statementId: string): Promise<void> {
    if (printingStatementId !== null) {
      return;
    }

    printingStatementId = statementId;
    statementPrintError = null;

    try {
      // The print endpoint returns a typed JSON payload (header + per-track
      // lines); render it into a printable A4 HTML page on the client.
      const payload = await client.distribution.printStatement({
        workspaceId: distributionWorkspaceId,
        statementId
      });
      const html = renderStatementPrintHtml(payload, tracks);
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      const printWindow = window.open(url, "_blank");

      if (printWindow === null) {
        URL.revokeObjectURL(url);
        throw new Error("The print tab was blocked by the browser; allow pop-ups for this console and retry.");
      }
    } catch (error: unknown) {
      statementPrintError = getErrorMessage(error);
    } finally {
      printingStatementId = null;
    }
  }

  function renderStatementPrintHtml(payload: StatementPrintResponse, trackItems: readonly TrackSummary[]): string {
    const statement = payload.statement;
    const lineRows = payload.lines
      .map((line: StatementPrintLine): string => `
        <tr>
          <td>${escapeHtml(printTrackLabel(line.trackId, trackItems))}</td>
          <td class="num">${escapeHtml(line.quantity)}</td>
          <td class="num">${escapeHtml(formatPrintAmount(line.grossShare, line.currency))}</td>
          <td class="num">${escapeHtml(formatPrintAmount(line.recoupmentApplied, line.currency))}</td>
          <td class="num">${escapeHtml(formatPrintAmount(line.netPayable, line.currency))}</td>
        </tr>`)
      .join("");

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Statement ${escapeHtml(statement.payeeName)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #111; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #111; padding-bottom: 8px; }
  h1 { font-size: 18px; margin: 16px 0 4px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; margin: 16px 0; font-size: 12px; }
  dt { font-weight: 700; }
  dd { margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
<header><strong>ë • Distribution</strong><span>Royalty statement · A4</span></header>
<h1>${escapeHtml(statement.payeeName)}</h1>
<p>Period ${escapeHtml(statement.periodStart)} → ${escapeHtml(statement.periodEnd)} · status ${escapeHtml(statement.status)} · version ${escapeHtml(String(statement.version))}</p>
<dl>
  <dt>Gross</dt><dd>${escapeHtml(formatPrintAmount(statement.grossTotal, statement.currency))}</dd>
  <dt>Recoupment</dt><dd>${escapeHtml(formatPrintAmount(statement.recoupmentTotal, statement.currency))}</dd>
  <dt>Net payable</dt><dd>${escapeHtml(formatPrintAmount(statement.netPayable, statement.currency))}</dd>
  <dt>Amount due</dt><dd>${escapeHtml(formatPrintAmount(statement.amountDue, statement.currency))}</dd>
</dl>
<table>
  <thead><tr><th>Track</th><th class="num">Quantity</th><th class="num">Gross share</th><th class="num">Recoupment</th><th class="num">Net payable</th></tr></thead>
  <tbody>${lineRows}</tbody>
</table>
<script>window.addEventListener("load", function () { window.print(); });</${"script"}>
</body>
</html>`;
  }

  function printTrackLabel(trackId: string | null, trackItems: readonly TrackSummary[]): string {
    if (trackId === null) {
      return "Unallocated";
    }

    const track = trackItems.find((candidate: TrackSummary): boolean => candidate.id === trackId);

    if (track === undefined) {
      return trackId;
    }

    return `${track.title} · ${track.artistName}`;
  }

  // The print payload carries 10-decimal money strings; round to cents for A4 output.
  function formatPrintAmount(value: string, currency: CurrencyCode): string {
    return `${currency} ${Number(value).toFixed(2)}`;
  }

  function escapeHtml(value: string): string {
    return value
      .replace(/&/gu, "&amp;")
      .replace(/</gu, "&lt;")
      .replace(/>/gu, "&gt;")
      .replace(/"/gu, "&quot;");
  }

  function openPaymentPanel(paymentId: string, mode: PaymentPanelMode): void {
    const payment = payments.find((candidate: PaymentSummary): boolean => candidate.id === paymentId);

    if (payment === undefined) {
      return;
    }

    selectedPaymentId = paymentId;
    paymentPanelMode = mode;
    // Void asks for an audit reason, not the wire reference, so it starts empty.
    paymentReferenceInput = mode === "void" ? "" : payment.reference ?? "";
    paymentBankTransactionInput = "";
  }

  function closePaymentPanel(): void {
    selectedPaymentId = null;
    paymentPanelMode = null;
    paymentReferenceInput = "";
    paymentBankTransactionInput = "";
  }

  async function recordPayment(): Promise<void> {
    const statement = recordStatement;
    const reference = recordPaymentReference.trim();

    if (statement === null || reference === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.recordPayment(
        {
          workspaceId: distributionWorkspaceId,
          statementId: statement.id,
          payeeId: statement.payeeId,
          amountMicro: statement.netPayableMicro,
          currency: statement.currency,
          paidAt: new Date().toISOString(),
          reference
        },
        {
          idempotencyKey: createIdempotencyKey("payment-record")
        }
      );
      mutationReceiptPageId = activePageId;
      recordStatementId = "";
      recordPaymentReference = "";
      await Promise.all([loadPayments(), loadStatements()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function editPayment(): Promise<void> {
    const payment = selectedPayment;
    const reference = paymentReferenceInput.trim();

    if (payment === null || reference === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.updatePayment(
        payment.id,
        {
          workspaceId: distributionWorkspaceId,
          amountMicro: payment.amountMicro,
          currency: payment.currency,
          reference
        },
        {
          idempotencyKey: createIdempotencyKey("payment-edit")
        }
      );
      mutationReceiptPageId = activePageId;
      closePaymentPanel();
      await loadPayments();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function reconcilePayment(): Promise<void> {
    const payment = selectedPayment;
    const bankTransactionId = paymentBankTransactionInput.trim();

    if (payment === null || bankTransactionId === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.reconcilePayment(
        payment.id,
        {
          workspaceId: distributionWorkspaceId,
          bankTransactionId,
          reconciledAt: new Date().toISOString()
        },
        {
          idempotencyKey: createIdempotencyKey("payment-reconcile")
        }
      );
      mutationReceiptPageId = activePageId;
      closePaymentPanel();
      await loadPayments();
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function voidPayment(): Promise<void> {
    const payment = selectedPayment;
    const reason = paymentReferenceInput.trim();

    if (payment === null || reason === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.voidPayment(
        payment.id,
        {
          workspaceId: distributionWorkspaceId,
          reason
        },
        {
          idempotencyKey: createIdempotencyKey("payment-void")
        }
      );
      mutationReceiptPageId = activePageId;
      closePaymentPanel();
      await Promise.all([loadPayments(), loadStatements()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function runReconciliationAction(action: DistributionReconciliationAction): Promise<void> {
    if (action.maintenance) {
      return;
    }

    clearActionReceipts();

    if (action.id === "link-statement-payment") {
      const statementGap = reconciliation?.statementsWithoutPaymentLinks[0];
      const statement = statements.find((candidate: StatementSummary): boolean => candidate.id === statementGap?.id) ?? statements[0];
      if (statement === undefined) {
        return;
      }

      try {
        mutationReceipt = await client.distribution.recordPayment(
          {
            workspaceId: distributionWorkspaceId,
            statementId: statement.id,
            payeeId: statement.payeeId,
            amountMicro: statement.netPayableMicro,
            currency: statement.currency,
            paidAt: new Date().toISOString(),
            reference: "CODEx-RECON-LINK"
          },
          { idempotencyKey: createIdempotencyKey("recon-link-payment") }
        );
        mutationReceiptPageId = activePageId;
        await Promise.all([loadPayments(), loadReconciliation(), loadAuditLog()]);
      } catch (error: unknown) {
        reportActionError(error);
      }
      return;
    }

    if (action.id === "recompute-payee-balance") {
      const payment = payments[0];
      if (payment === undefined) {
        return;
      }

      try {
        mutationReceipt = await client.distribution.updatePayment(
          payment.id,
          {
            workspaceId: distributionWorkspaceId,
            amountMicro: payment.amountMicro,
            currency: payment.currency,
            reference: payment.reference ?? "CODEx-BALANCE-RECOMPUTE"
          },
          { idempotencyKey: createIdempotencyKey("recon-recompute-balance") }
        );
        mutationReceiptPageId = activePageId;
        await Promise.all([loadPayments(), loadReconciliation(), loadAuditLog()]);
      } catch (error: unknown) {
        reportActionError(error);
      }
      return;
    }

    if (action.id === "assign-expense-payee") {
      // The guarded expense write needs explicit operator input (contract, label,
      // amount, date): route to the real expense form instead of fabricating one.
      selectPage("contracts");
      openExpensePanel();
      return;
    }

    if (action.id === "allocate-matched-row") {
      await startCadencedAllocationRun();
      await Promise.all([loadReconciliation(), loadAuditLog()]);
      return;
    }

    if (action.id === "void-statement") {
      const statementGap = reconciliation?.statementsWithoutPaymentLinks[0];
      const statement = statements.find((candidate: StatementSummary): boolean => candidate.id === statementGap?.id) ?? statements[0];
      if (statement === undefined) {
        return;
      }

      try {
        mutationReceipt = await client.distribution.voidStatement(
          statement.id,
          {
            workspaceId: distributionWorkspaceId,
            reason: "Operator reconciliation void"
          },
          { idempotencyKey: createIdempotencyKey("recon-void-statement") }
        );
        mutationReceiptPageId = activePageId;
        await Promise.all([loadStatements(), loadReconciliation(), loadAuditLog()]);
      } catch (error: unknown) {
        reportActionError(error);
      }
    }
  }

  function getNavItem(pageId: DistributionPageId): DistributionNavItem {
    const item = navItems.find((navItem: DistributionNavItem): boolean => navItem.id === pageId);

    if (item === undefined) {
      throw new Error(`Unknown Distribution page: ${pageId}`);
    }

    return item;
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
        { kind: "text", value: formatDateOnly(expense.incurredOn), strong: false },
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
        { kind: "text", value: run.runReference, strong: true },
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
        { kind: "text", value: formatDateRange(statement.period_start, statement.period_end), strong: false },
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
        { kind: "text", value: payment.paidAt === null ? "not paid" : formatDateOnly(payment.paidAt), strong: false },
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
        { kind: "text", value: row.statementReference, strong: true },
        { kind: "text", value: row.payee, strong: false },
        { kind: "text", value: formatDateRange(row.periodStart, row.periodEnd), strong: false },
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
        { kind: "text", value: humanReference(row.expenseReference, row.contract), strong: true },
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
        { kind: "text", value: humanReference(row.sourceReference, row.track), strong: true },
        { kind: "text", value: humanReference(row.batch, row.track), strong: false },
        { kind: "text", value: humanReference(row.track, row.sourceReference), strong: false },
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
        { kind: "text", value: row.firstReference ?? "—", strong: false },
        { kind: "text", value: row.lastReference ?? "—", strong: false },
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
        { kind: "text", value: duplicate.sampleLabels.join(", "), strong: false },
        { kind: "badge", value: "review required", tone: "warning" }
      ]
    }));
  }

  function createAuditRows(items: readonly AuditLogEntry[]): readonly TableRow[] {
    return items.map((entry: AuditLogEntry): TableRow => ({
      id: entry.id,
      cells: [
        { kind: "text", value: formatDateOnly(entry.occurredAt), strong: false },
        { kind: "text", value: auditActorLabel(entry), strong: false },
        { kind: "badge", value: entry.action, tone: "info" },
        { kind: "text", value: `${entry.entityType} · ${entry.entityReference}`, strong: false }
      ]
    }));
  }

  // Combines several request statuses into one: any error wins, then any
  // loading, then idle while nothing has succeeded yet, else success.
  function combineRequestStatuses(statuses: readonly RequestStatus[]): RequestStatus {
    if (statuses.includes("error")) {
      return "error";
    }

    if (statuses.includes("loading")) {
      return "loading";
    }

    if (statuses.every((status: RequestStatus): boolean => status === "idle")) {
      return "idle";
    }

    return "success";
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
      { label: "Source", value: state.source, active: true, disabled: false, actionId: "source", title: "Cycle import source" },
      { label: "File", value: state.fileName === "" ? "no file selected" : state.fileName, active: false, disabled: false, actionId: "file", title: "Clear selected file" },
      { label: "State", value: state.status, active: false, disabled: false, actionId: "status", title: "Run import preview" }
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

  function readInputValue(event: Event): string {
    const target = event.currentTarget;

    if (!(target instanceof HTMLInputElement)) {
      throw new Error("Expected input event target.");
    }

    return target.value;
  }

  function distributionImportSourceFromValue(value: string): ImportSource {
    if (value === "kontor" || value === "routenote") {
      return value;
    }

    throw new Error(`Unknown Distribution import source: ${value}.`);
  }

  // TSV twin of parseCsvRecords (bank-parser handles comma-separated files only):
  // first non-empty line is the header, remaining lines become keyed records.
  function parseTsvRecords(text: string): readonly Readonly<Record<string, string>>[] {
    const lines = text.split(/\r\n|\r|\n/u).filter((line: string): boolean => line.trim().length > 0);
    const headerLine = lines[0];

    if (lines.length < 2 || headerLine === undefined) {
      return [];
    }

    const header = headerLine.split("\t").map((value: string): string => value.trim());

    return lines.slice(1).map((line: string): Readonly<Record<string, string>> => {
      const cells = line.split("\t").map((value: string): string => value.trim());
      const record: Record<string, string> = {};

      for (let index = 0; index < header.length; index += 1) {
        const key = header[index];

        if (key !== undefined && key.length > 0) {
          record[key] = cells[index] ?? "";
        }
      }

      return record;
    });
  }

  // FNV-1a 32-bit over the raw file text: a stable client-side content fingerprint
  // used as the preview checksum (the server folds it into its idempotency fingerprint).
  function importContentChecksum(text: string): string {
    let hash = 0x811c9dc5;

    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }

    return (hash >>> 0).toString(16).padStart(8, "0");
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

  function auditActorLabel(entry: AuditLogEntry): string {
    const actorEmail = entry.context.actorEmail ?? entry.context.actor_email ?? entry.context.actor;

    if (actorEmail !== undefined && actorEmail.trim() !== "") {
      return actorEmail;
    }

    return "Verified actor";
  }

  function humanReference(value: string, fallback: string): string {
    const trimmed = stripRawMoneySuffix(value.trim());
    const [firstPart, ...rest] = trimmed.split(" · ");

    if (firstPart !== undefined && isUuidLike(firstPart) && rest.length > 0) {
      return rest.join(" · ");
    }

    if (isUuidLike(trimmed)) {
      return stripRawMoneySuffix(fallback.trim());
    }

    return trimmed;
  }

  function stripRawMoneySuffix(value: string): string {
    return value.replace(/ · [A-Z]{3} -?\d+\.\d{3,}$/u, "");
  }

  function isUuidLike(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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

  function pageUsesPeriodControl(pageId: DistributionPageId): boolean {
    return pageId === "dashboard" ||
      pageId === "allocations" ||
      pageId === "suspense" ||
      pageId === "payments" ||
      pageId === "revenue";
  }

  function writeDisabledTitle(): string {
    return writesEnabled ? "" : writeGateMessage;
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

<WorkspaceShell
  workspace="distribution"
  brandLabel="ë • distribution"
  homeHref="/console/distribution/dashboard"
  navLabel="Navigation Distribution"
  navItems={[]}
  navGroups={shellNavGroups}
  statusLabel="erh/v1"
  statusValue={writesEnabled ? "writes enabled" : "live reads"}
  userInitial={session.initials}
  userName={session.displayName}
  userContext={session.roleLabel}
  signOutHref="#"
  onNavigate={handleShellNavigate}
  onSignOut={onLogout}
>
    <div class="content">
      <PageHeader
        workspace="distribution"
        eyebrow="Distribution"
        title={activePage.title}
        description={activePage.subtitle}
        meta=""
        statusLabel=""
        statusTone="muted"
      />

      {#if periodControlVisible}
        <section class="period-control ehq-edge-surface" aria-label="Period control">
          <Select
            id="distribution-period-scope"
            label="Period"
            value={periodScope}
            options={periodOptions}
            state="default"
            message=""
            onchange={updatePeriodScope}
          />
          {#if periodScope === "custom"}
            <label>
              <span>From</span>
              <input type="date" value={activeRange.from} max={activeRange.to} onchange={updateCustomFrom} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={activeRange.to} min={activeRange.from} onchange={updateCustomTo} />
            </label>
          {/if}
          <p>{rangeLabel(activeRange)}</p>
        </section>
      {/if}

      {#if mutationReceipt !== null && mutationReceiptPageId === activePageId}
        <p class="receipt" role="status">Action accepted · audit recorded.</p>
      {/if}

      {#if runReceipt !== null && runReceiptPageId === activePageId}
        <p class="receipt" role="status">Run queued · lock held by the workflow.</p>
      {/if}

      {#if actionError !== null && actionErrorPageId === activePageId}
        <p class="receipt error" role="alert">{actionError}</p>
      {/if}

      {#if activePageId === "dashboard"}
        <section class="kpi-grid" aria-label="Distribution KPIs">
          {#each dashboardKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={dashboardState.status === "loading" ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>
        <section class="dashboard-grid">
          <BarsChart title="Revenue by source" points={revenueChartPoints} tone="active" />
          <Table title="Action list" columns={dashboardColumns} rows={dashboardRows} state={tableStateFor(dashboardActionListStatus, dashboardRows.length)} actionLabel="" />
        </section>
      {:else if activePageId === "imports"}
        <Toolbar label="Kontor RouteNote import" filters={importToolbarFilters} actionLabel="" loading={importState.status === "loading"} onFilterSelect={selectImportToolbarFilter} />
        <section class="form-panel ehq-edge-surface" aria-label="Import Kontor RouteNote">
          <Select id="distribution-import-source" label="Source" value={importState.source} options={importSourceOptions} state="default" message="" onchange={updateImportSource} />
          <label>
            <span>Export file</span>
            <input type="file" accept="text/csv,.csv,.tsv,text/tab-separated-values" onchange={handleImportFile} />
          </label>
          <Button label="Preview export" variant="secondary" size="medium" type="button" disabled={!canPreviewImport} loading={false} locked={false} focus={false} ariaLabel="Preview export" title={canPreviewImport ? "" : "Select a CSV/TSV export file first"} onclick={previewImport} />
          <Button label="Validate import" variant="primary" size="medium" type="button" disabled={!canConfirmImport || !writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Validate import" title={writeDisabledTitle()} onclick={confirmImport} />
        </section>
        <section class="filter-strip ehq-edge-surface" aria-label="Import filters">
          <Select id="distribution-import-filter" label="Source filter" value={importSourceFilter} options={importFilterOptions} state="default" message="" onchange={updateImportFilter} />
          <Button label="Filter" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply import filters" onclick={loadImportBatches} />
        </section>
        <section class="import-result ehq-edge-surface" class:error={importState.status === "error"} aria-live="polite">
          <strong>{importState.message}</strong>
          {#if importState.preview !== null}
            <span>{importState.preview.acceptedRowCount} accepted · {importState.preview.unmappedRowCount} to suspense · {formatMoney(importState.preview.payableMicro, importState.preview.currencyCodes[0] ?? "USD")}</span>
            <span>{importState.preview.statementReference} · keys {importState.preview.joinKeys.join(" + ")}</span>
          {/if}
          {#if importState.confirm !== null}
            <span>{importState.confirm.importedRoyaltyEventCount} royalty events imported.</span>
          {/if}
        </section>
        <Table title="Batches Kontor / RouteNote" columns={importColumns} rows={importRows} state={tableStateFor(importBatchesState.status, importBatches.length)} actionLabel="" pagination={importPagination} />
      {:else if activePageId === "mapping"}
        <section class="filter-strip ehq-edge-surface" aria-label="Mapping filters">
          <Select id="distribution-mapping-status" label="Status" value={mappingStatusFilter} options={mappingStatusOptions} state="default" message="" onchange={updateMappingStatus} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply mapping filters" onclick={loadMappingRows} />
          <Button label="Apply reusable rules" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Apply reusable rules" title={writeDisabledTitle()} onclick={applyMappingRules} />
        </section>
        <Table title="Kontor / RouteNote rows to map" columns={mappingColumns} rows={mappingTableRows} state={mappingState.status === "loading" ? "loading" : mappingState.status === "error" ? "error" : mappingRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={mappingPagination} />
      {:else if activePageId === "catalog"}
        <section class="contracts-actions ehq-edge-surface">
          <Button label="New release" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="New release" onclick={() => openCatalogPanel("release")} />
          <Button label="New track" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="New track" onclick={() => openCatalogPanel("track")} />
          <span>Releases and tracks are source records; edits later become audited overrides.</span>
        </section>
        {#if catalogPanelMode === "release"}
          <section class="form-panel ehq-edge-surface" aria-label="New release">
            <Input id="distribution-release-title" label="Title" value={releaseTitleInput} placeholder="" type="text" state="default" message="" oninput={updateReleaseTitle} />
            <Input id="distribution-release-artist" label="Artist" value={releaseArtistInput} placeholder="" type="text" state="default" message="" oninput={updateReleaseArtist} />
            <Input id="distribution-release-upc" label="UPC (optional)" value={releaseUpcInput} placeholder="" type="text" state="default" message="" oninput={updateReleaseUpc} />
            <Select id="distribution-release-status" label="Status" value={releaseStatusInput} options={catalogStatusOptions} state="default" message="" onchange={updateReleaseStatus} />
            <label>
              <span>Release date (optional)</span>
              <input type="date" value={releaseDateInput} onchange={updateReleaseDate} />
            </label>
            <Button label="Create release" variant="primary" size="medium" type="button" disabled={!writesEnabled || releaseTitleInput.trim() === "" || releaseArtistInput.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Create release" title={writesEnabled ? (releaseTitleInput.trim() === "" ? "Enter a release title first" : releaseArtistInput.trim() === "" ? "Enter an artist name first" : "") : writeGateMessage} onclick={createRelease} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel release creation" onclick={closeCatalogPanel} />
          </section>
        {:else if catalogPanelMode === "track"}
          <section class="form-panel ehq-edge-surface" aria-label="New track">
            <Input id="distribution-track-title" label="Title" value={trackTitleInput} placeholder="" type="text" state="default" message="" oninput={updateTrackTitle} />
            <Input id="distribution-track-artist" label="Artist" value={trackArtistInput} placeholder="" type="text" state="default" message="" oninput={updateTrackArtist} />
            <Input id="distribution-track-isrc" label="ISRC (optional)" value={trackIsrcInput} placeholder="" type="text" state="default" message="" oninput={updateTrackIsrc} />
            <Select id="distribution-track-release" label="Release" value={trackReleaseIdInput} options={trackReleaseSelectOptions} state="default" message="" onchange={updateTrackRelease} />
            <Select id="distribution-track-status" label="Status" value={trackStatusInput} options={catalogStatusOptions} state="default" message="" onchange={updateTrackStatus} />
            <Button label="Create track" variant="primary" size="medium" type="button" disabled={!writesEnabled || trackTitleInput.trim() === "" || trackArtistInput.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Create track" title={writesEnabled ? (trackTitleInput.trim() === "" ? "Enter a track title first" : trackArtistInput.trim() === "" ? "Enter an artist name first" : "") : writeGateMessage} onclick={createTrack} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel track creation" onclick={closeCatalogPanel} />
          </section>
        {/if}
        <section class="dashboard-grid">
          <Table title="Catalog canonical + contributors" columns={catalogColumns} rows={catalogRows} state={tableStateFor(tracksState.status, catalogRows.length)} actionLabel="" pagination={catalogPagination} />
          <div class="command-card ehq-edge-surface">
            <SectionTemplate
              eyebrow="catalog"
              title="Review focus"
              detail="Import artist and catalog contributors stay separate until an exact track match is approved."
              state="ready"
            >
              <Button label="Fix contributor mapping" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Fix contributor mapping" onclick={() => selectPage("mapping")} />
            </SectionTemplate>
          </div>
        </section>
      {:else if activePageId === "contracts"}
        <section class="contracts-actions ehq-edge-surface">
          <Button label="New contract" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="New contract" onclick={openContractPanel} />
          <Button label="Record recoupable expense" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Record recoupable expense" title={writeDisabledTitle()} onclick={openExpensePanel} />
          <span>Expenses remain source records; corrections later become audited overrides.</span>
        </section>
        {#if expensePanelOpen}
          <section class="form-panel ehq-edge-surface" aria-label="Record recoupable expense">
            <Select id="distribution-expense-contract" label="Contract" value={expenseContractIdInput} options={expenseContractSelectOptions} state="default" message="" onchange={updateExpenseContract} />
            <Input id="distribution-expense-label" label="Label" value={expenseLabelInput} placeholder="Advance" type="text" state="default" message="" oninput={updateExpenseLabel} />
            <Input id="distribution-expense-amount" label="Amount" value={expenseAmountInput} placeholder="2500.00" type="text" state="default" message="" oninput={updateExpenseAmount} />
            <label>
              <span>Incurred on</span>
              <input type="date" value={expenseDateInput} onchange={updateExpenseDate} />
            </label>
            <Button label="Record expense" variant="primary" size="medium" type="button" disabled={!writesEnabled || selectedExpenseContract === null || expenseLabelInput.trim() === "" || expenseAmountMicro === null || expenseDateInput === ""} loading={false} locked={false} focus={false} ariaLabel="Record expense" title={writesEnabled ? (selectedExpenseContract === null ? "Select a contract first" : expenseLabelInput.trim() === "" ? "Enter an expense label first" : expenseAmountMicro === null ? "Enter a positive amount like 2500.00" : expenseDateInput === "" ? "Pick the incurred date first" : "") : writeGateMessage} onclick={recordExpense} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel expense recording" onclick={closeExpensePanel} />
          </section>
        {/if}
        {#if contractPanelOpen}
          <section class="form-panel ehq-edge-surface" aria-label="New contract">
            <Input id="distribution-contract-title" label="Title" value={contractTitleInput} placeholder="" type="text" state="default" message="" oninput={updateContractTitle} />
            <Select id="distribution-contract-payee" label="Payee" value={contractPayeeIdInput} options={payeeSelectOptions} state="default" message="" onchange={updateContractPayee} />
            <Select id="distribution-contract-status" label="Status" value={contractStatusInput} options={contractStatusOptions} state="default" message="" onchange={updateContractStatus} />
            <label>
              <span>Effective from</span>
              <input type="date" value={contractEffectiveFromInput} onchange={updateContractEffectiveFrom} />
            </label>
            <label>
              <span>Effective to (optional)</span>
              <input type="date" value={contractEffectiveToInput} min={contractEffectiveFromInput} onchange={updateContractEffectiveTo} />
            </label>
            <Input id="distribution-contract-split" label="Split (%)" value={contractSplitPercentInput} placeholder="80" type="text" state="default" message="" oninput={updateContractSplitPercent} />
            <Input id="distribution-contract-currency" label="Currency" value={contractCurrencyInput} placeholder="MUR" type="text" state="default" message="" oninput={updateContractCurrency} />
            <Button label="Create contract" variant="primary" size="medium" type="button" disabled={!writesEnabled || contractTitleInput.trim() === "" || contractPayeeIdInput === "" || contractEffectiveFromInput === "" || contractSplitBp === null || contractCurrencyInput.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Create contract" title={writesEnabled ? (contractTitleInput.trim() === "" ? "Enter a contract title first" : contractPayeeIdInput === "" ? "Select a payee first" : contractEffectiveFromInput === "" ? "Pick the effective-from date first" : contractSplitBp === null ? "Enter a split between 0.01 and 100 percent" : contractCurrencyInput.trim() === "" ? "Enter a currency code first" : "") : writeGateMessage} onclick={createContract} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel contract creation" onclick={closeContractPanel} />
          </section>
        {/if}
        {#if selectedRuleContract !== null}
          <section class="form-panel ehq-edge-surface" aria-label="Add royalty rule">
            <div class="panel-context">
              <strong>{selectedRuleContract.title}</strong>
              <span>Rules replace the previous set and must total exactly 100%.</span>
            </div>
            <Select id="distribution-rule-payee" label="Payee" value={rulePayeeIdInput} options={payeeSelectOptions} state="default" message="" onchange={updateRulePayee} />
            <Input id="distribution-rule-percentage" label="Percentage" value={rulePercentageInput} placeholder="100" type="text" state="default" message="" oninput={updateRulePercentage} />
            <Button label="Save rule set" variant="primary" size="medium" type="button" disabled={!writesEnabled || rulePayeeIdInput === "" || rulePercentageInput.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Save rule set" title={writesEnabled ? (rulePayeeIdInput === "" ? "Select a payee first" : rulePercentageInput.trim() === "" ? "Enter the rule percentage first" : "") : writeGateMessage} onclick={addContractRule} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel rule editing" onclick={closeContractRulePanel} />
          </section>
        {/if}
        <section class="dashboard-grid">
          <Table title="Splits / contracts" columns={contractColumns} rows={contractRows} state={tableStateFor(contractsState.status, contracts.length)} actionLabel="" rowActions={contractRowActions} pagination={contractsPagination} />
          <Table title="Expenses / recoupments" columns={expenseColumns} rows={expenseRows} state={tableStateFor(expensesState.status, expenses.length)} actionLabel="" pagination={expensesPagination} />
        </section>
      {:else if activePageId === "allocations"}
        <section class="lock-panel ehq-edge-surface">
          <SectionTemplate
            eyebrow="allocations"
            title="Server lock"
            detail="Preview, post and unpost are available only through cadenced workflow runs."
            state="ready"
          >
            {#snippet action()}
              <Button label="Preview locked run" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Preview locked run" onclick={previewAllocationRun} />
              <Button label="Post cadence wave" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Post cadence wave" title={writeDisabledTitle()} onclick={startCadencedAllocationRun} />
            {/snippet}
            <p class="lock-key">{allocationLockKey}</p>
          </SectionTemplate>
        </section>
        {#if selectedRun !== null}
          <section class="form-panel ehq-edge-surface" aria-label="Request unpost run">
            <div class="panel-context">
              <strong>{selectedRun.runReference}</strong>
              <span>{selectedRun.period} · {selectedRun.status} · lock {selectedRun.lockKey}</span>
            </div>
            <Input id="distribution-unpost-reason" label="Unpost reason" value={unpostReasonInput} placeholder="" type="text" state="default" message="" oninput={updateUnpostReason} />
            <Button label="Request unpost run" variant="danger" size="medium" type="button" disabled={!writesEnabled || unpostReasonInput.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Request unpost run" title={writesEnabled ? (unpostReasonInput.trim() === "" ? "Enter an unpost reason first" : "") : writeGateMessage} onclick={unpostAllocationRun} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel unpost request" onclick={closeUnpostPanel} />
          </section>
        {/if}
        <Table title="Allocation runs" columns={allocationColumns} rows={allocationRows} state={tableStateFor(allocationsState.status, allocationRuns.length)} actionLabel="" rowActions={allocationRowActions} pagination={allocationsPagination} />
      {:else if activePageId === "suspense"}
        <section class="filter-strip ehq-edge-surface" aria-label="Suspense filters">
          <Select id="distribution-suspense-status" label="Status" value={suspenseStatusFilter} options={suspenseStatusOptions} state="default" message="" onchange={updateSuspenseStatus} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply suspense filters" onclick={loadSuspense} />
        </section>
        {#if selectedSuspenseItem !== null}
          <section class="form-panel ehq-edge-surface" aria-label="Resolve suspense item">
            <div class="panel-context">
              <strong>{selectedSuspenseItem.sourceReference}</strong>
              <span>{suspenseReason(selectedSuspenseItem.reason)} · {formatMoney(selectedSuspenseItem.amountMicro, selectedSuspenseItem.currency)} · resolution {selectedSuspenseResolution}</span>
            </div>
            {#if selectedSuspenseResolution !== "hold"}
              <Select id="distribution-suspense-track" label="Target track" value={suspenseTargetTrackId} options={suspenseTrackSelectOptions} state="default" message="" onchange={updateSuspenseTargetTrack} />
              {#if suspenseTrackOptionsError !== null}
                <span class="panel-error">{suspenseTrackOptionsError}</span>
              {/if}
            {/if}
            <Button label="Resolve" variant="primary" size="medium" type="button" disabled={!writesEnabled || !suspenseResolveTarget.ready} loading={false} locked={false} focus={false} ariaLabel="Resolve suspense item" title={writesEnabled ? suspenseResolveTarget.hint : writeGateMessage} onclick={resolveSelectedSuspense} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel suspense resolution" onclick={closeSuspensePanel} />
          </section>
        {/if}
        <Table title="Suspense grouped by reason" columns={suspenseColumns} rows={suspenseTableRows} state={suspenseState.status === "loading" ? "loading" : suspenseState.status === "error" ? "error" : suspenseItems.length === 0 ? "empty" : "default"} actionLabel="" rowActions={suspenseRowActions} pagination={suspensePagination} />
      {:else if activePageId === "statements"}
        <section class="statement-summary ehq-edge-surface">
          {#if statementPreview !== null}
            <div>
              <p>Financial summary first</p>
              <h2>{statementPreview.payeeName} · {formatDateRange(statementPreview.period_start, statementPreview.period_end)}</h2>
              <dl>
                <div><dt>Gross</dt><dd>{formatMoney(statementPreview.grossMicro, statementPreview.currency)}</dd></div>
                <div><dt>Recoup</dt><dd>{formatMoney(statementPreview.recoupedMicro, statementPreview.currency)}</dd></div>
                <div><dt>Expenses</dt><dd>{formatMoney(statementPreview.expenseMicro, statementPreview.currency)}</dd></div>
                <div><dt>Paid</dt><dd>{formatMoney(statementPreview.paidMicro, statementPreview.currency)}</dd></div>
                <div><dt>Total due</dt><dd>{formatMoney(statementPreview.netPayableMicro, statementPreview.currency)}</dd></div>
              </dl>
            </div>
          {/if}
          <Button label="Generate statements run" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Generate statements run" title={writeDisabledTitle()} onclick={generateStatements} />
        </section>
        <section class="statement-pdf ehq-edge-surface" aria-label="A4 statement PDF preview">
          <header>
            <strong>ë • Distribution</strong>
            <span>A4 PDF · print-first</span>
          </header>
          <h2>{statementPreview?.payeeName ?? "Payee"} Statement</h2>
          <p>Period {statementPreview === null ? periodLabel(distributionPeriod) : formatDateRange(statementPreview.period_start, statementPreview.period_end)} · currency {statementPreview?.currency ?? "MUR"}</p>
          {#if printingStatementId !== null}
            <p class="receipt" role="status">Preparing the print view…</p>
          {/if}
          {#if statementPrintError !== null}
            <span class="panel-error" role="alert">{statementPrintError}</span>
          {/if}
          <Table title="Statements" columns={statementColumns} rows={statementRows} state={tableStateFor(statementsState.status, statements.length)} actionLabel="" rowActions={statementRowActions} pagination={statementsPagination} />
        </section>
      {:else if activePageId === "payments"}
        <section class="filter-strip ehq-edge-surface" aria-label="Payment filters">
          <Select id="distribution-payment-status" label="Status" value={paymentStatusFilter} options={paymentStatusOptions} state="default" message="" onchange={updatePaymentStatus} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply payment filters" onclick={loadPayments} />
        </section>
        <section class="form-panel ehq-edge-surface" aria-label="Record payment">
          <Select id="distribution-record-statement" label="Statement" value={recordStatementId} options={openStatementSelectOptions} state="default" message="" onchange={updateRecordStatement} />
          <label>
            <span>Amount (from statement)</span>
            <input value={recordStatement === null ? "" : formatMoney(recordStatement.netPayableMicro, recordStatement.currency)} readonly />
          </label>
          <Input id="distribution-record-reference" label="Reference" value={recordPaymentReference} placeholder="" type="text" state="default" message="" oninput={updateRecordPaymentReference} />
          <Button label="Record payment" variant="primary" size="medium" type="button" disabled={!writesEnabled || recordStatement === null || recordPaymentReference.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Record payment" title={writesEnabled ? (recordStatement === null ? "Select an open statement first" : recordPaymentReference.trim() === "" ? "Enter a payment reference first" : "") : writeGateMessage} onclick={recordPayment} />
        </section>
        {#if selectedPayment !== null && paymentPanelMode !== null}
          <section class="form-panel ehq-edge-surface" aria-label="Payment action">
            <div class="panel-context">
              <strong>{selectedPayment.payeeName}</strong>
              <span>{formatMoney(selectedPayment.amountMicro, selectedPayment.currency)} · {selectedPayment.status} · {selectedPayment.reference ?? "no reference"}</span>
            </div>
            {#if paymentPanelMode === "edit"}
              <Input id="distribution-payment-reference" label="New reference" value={paymentReferenceInput} placeholder="" type="text" state="default" message="" oninput={updatePaymentReferenceInput} />
              <Button label="Save reference" variant="primary" size="medium" type="button" disabled={!writesEnabled || paymentReferenceInput.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Save payment reference" title={writesEnabled ? (paymentReferenceInput.trim() === "" ? "Enter the new reference first" : "") : writeGateMessage} onclick={editPayment} />
            {:else if paymentPanelMode === "reconcile"}
              <Input id="distribution-payment-bank-transaction" label="Bank transaction ID" value={paymentBankTransactionInput} placeholder="" type="text" state="default" message="" oninput={updatePaymentBankTransactionInput} />
              <Button label="Reconcile payment" variant="primary" size="medium" type="button" disabled={!writesEnabled || paymentBankTransactionInput.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Reconcile payment" title={writesEnabled ? (paymentBankTransactionInput.trim() === "" ? "Enter the bank transaction ID first" : "") : writeGateMessage} onclick={reconcilePayment} />
            {:else}
              <Input id="distribution-payment-void-reason" label="Void reason" value={paymentReferenceInput} placeholder="" type="text" state="default" message="" oninput={updatePaymentReferenceInput} />
              <Button label="Void payment" variant="danger" size="medium" type="button" disabled={!writesEnabled || paymentReferenceInput.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Void payment" title={writesEnabled ? (paymentReferenceInput.trim() === "" ? "Enter a void reason first" : "") : writeGateMessage} onclick={voidPayment} />
            {/if}
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Close payment panel" onclick={closePaymentPanel} />
          </section>
        {/if}
        <Table title="Payments" columns={paymentColumns} rows={paymentRows} state={paymentsState.status === "loading" ? "loading" : paymentsState.status === "error" ? "error" : payments.length === 0 ? "empty" : "default"} actionLabel="" rowActions={paymentRowActions} pagination={paymentsPagination} />
      {:else if activePageId === "revenue"}
        <section class="filter-strip ehq-edge-surface" aria-label="Revenue filters">
          <Select id="distribution-revenue-group" label="Group by" value={revenueGroupBy} options={revenueGroupOptions} state="default" message="" onchange={updateRevenueGroup} />
          <Button label="Refresh" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Refresh revenue" onclick={loadRevenue} />
        </section>
        <section class="dashboard-grid">
          <BarsChart title="Revenue grouped view" points={revenueChartPoints} tone="active" />
          <Table title="Revenue detail" columns={revenueColumns} rows={revenueTableRows} state={tableStateFor(revenueState.status, revenueRows.length)} actionLabel="" pagination={revenuePagination} />
        </section>
      {:else if activePageId === "financial-reconciliation"}
        {#if reconciliationState.status === "loading"}
          <Loader label="Loading reconciliation" detail="Computing read-only diagnostics." size="medium" />
        {:else if reconciliationState.status === "error"}
          <section class="empty-state ehq-edge-surface">
            <strong>Reconciliation unavailable</strong>
            <span>The read-only diagnostic could not be loaded. Retry the request.</span>
            <Button label="Retry" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Retry loading reconciliation" onclick={loadReconciliation} />
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
            <SectionTemplate
              eyebrow="reconciliation"
              title="Guarded repair actions"
              detail="Guarded actions use the API write path with idempotency, audit, and locks."
              state="ready"
            >
            <div class="recon-action-grid">
              {#each (reconciliation?.actions ?? []) as action (action.id)}
                <div class="recon-action ehq-edge-surface">
                  <strong>{action.label}</strong>
                  <p>{action.description}</p>
                  {#if action.maintenance}
                    <span class="recon-action-flag">One-time maintenance · flagged for review</span>
                  {/if}
                  <Button
                    label={action.maintenance ? "Maintenance only" : "Run guarded action"}
                    variant="secondary"
                    size="medium"
                    type="button"
                    disabled={action.maintenance || !writesEnabled}
                    loading={false}
                    locked={false}
                    focus={false}
                    ariaLabel={action.maintenance ? "Maintenance only" : `Run guarded action: ${action.label}`}
                    title={action.maintenance ? "maintenance only" : writeDisabledTitle()}
                    onclick={() => runReconciliationAction(action)}
                  />
                </div>
              {/each}
            </div>
            </SectionTemplate>
          </section>
        {/if}
      {:else if activePageId === "aliases"}
        {#if aliases.length === 0 && aliasesState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No catalog aliases</strong>
            <span>No alias records are available for this workspace. Aliases route imported names to canonical entities once configured.</span>
          </section>
        {:else}
          <Table title="Catalog aliases" columns={aliasColumns} rows={aliasRows} state={tableStateFor(aliasesState.status, aliases.length)} actionLabel="" pagination={aliasesPagination} />
        {/if}
      {:else if activePageId === "duplicates"}
        <section class="recon-actions ehq-edge-surface" aria-label="Duplicates note">
          <SectionTemplate
            eyebrow="duplicates"
            title="Duplicate detection"
            detail="Potential duplicate records are listed with human labels; merge remains a reviewed maintenance action."
            state="ready"
          />
        </section>
        {#if duplicates.length === 0 && duplicatesState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No duplicates detected</strong>
            <span>No potential duplicate records were found across the catalog.</span>
          </section>
        {:else}
          <Table title="Potential duplicates" columns={duplicateColumns} rows={duplicateRows} state={tableStateFor(duplicatesState.status, duplicates.length)} actionLabel="" pagination={duplicatesPagination} />
        {/if}
      {:else if activePageId === "audit-log"}
        {#if auditEntries.length === 0 && auditLogState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No audit entries</strong>
            <span>No distribution-scoped audit events are recorded for this workspace.</span>
          </section>
        {:else}
          <Table title="Audit log" columns={auditColumns} rows={auditRows} state={tableStateFor(auditLogState.status, auditEntries.length)} actionLabel="" pagination={auditPagination} />
        {/if}
      {:else if activePageId === "settings"}
        {#if settingsState.status === "loading"}
          <Loader label="Loading settings" detail="Reading workspace configuration." size="medium" />
        {:else if settingsState.status === "error"}
          <section class="empty-state ehq-edge-surface">
            <strong>Settings unavailable</strong>
            <span>The workspace configuration could not be loaded.</span>
            <Button label="Retry" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Retry loading settings" onclick={loadSettings} />
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
</WorkspaceShell>

<style>
  :global(body) {
    overflow: hidden;
  }

  .receipt,
  label span,
  .import-result,
  .contracts-actions,
  .lock-panel,
  .statement-summary,
  .statement-pdf span,
  .statement-pdf p {
    font-family: var(--ehq-mono);
  }

  .content {
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--ehq-space-5);
    display: grid;
    align-content: start;
    gap: var(--ehq-space-4);
    overflow-y: auto;
    overflow-x: auto;
  }


  .receipt,
  .import-result {
    margin: 0;
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-yellow-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-yellow-muted);
    color: var(--ehq-yellow);
    font-size: var(--ehq-type-caption-size);
  }

  .receipt.error {
    border-color: var(--ehq-error);
    background: var(--ehq-error-bg);
    color: var(--ehq-error);
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
  .period-control,
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

  .period-control {
    justify-content: space-between;
  }

  .period-control label,
  .period-control :global(.ehq-select-field) {
    width: min(360px, 100%);
  }

  .period-control p {
    margin: 0;
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-caption-size);
  }

  label {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-1);
  }

  label span {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  /* Raw inputs remain only for cases the DS Input does not cover: date, file, readonly. */
  input {
    min-height: 38px;
    width: 100%;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
    font-weight: var(--ehq-type-body-weight);
    line-height: var(--ehq-type-ui-line);
    color-scheme: dark;
    outline: 0;
  }

  input:focus {
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .import-result {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .panel-context {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .panel-context strong {
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .panel-context span {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-caption-size);
  }

  .panel-error {
    color: var(--ehq-error);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-caption-size);
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

  .statement-summary h2,
  .statement-summary p,
  .statement-pdf h2,
  .statement-pdf p,
  .statement-pdf header {
    margin: 0;
  }

  .statement-summary h2,
  .statement-pdf h2 {
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .contracts-actions,
  .lock-panel {
    justify-content: space-between;
  }

  .contracts-actions span,
  .lock-panel p {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
  }

  .statement-summary {
    justify-content: space-between;
    align-items: start;
  }

  .statement-summary p {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
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
    font-size: var(--ehq-type-caption-size);
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
    font-size: var(--ehq-type-page-title-size);
  }

  .statement-pdf p {
    margin: var(--ehq-space-2) 0 var(--ehq-space-4);
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
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
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .empty-state span {
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  .recon-actions {
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    gap: var(--ehq-space-3);
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
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .recon-action p {
    margin: 0;
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-caption-size);
    line-height: var(--ehq-type-ui-line);
  }

  .recon-action-flag {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
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
    font-size: var(--ehq-type-caption-size);
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
    .kpi-grid,
    .dashboard-grid {
      grid-template-columns: 1fr 1fr;
    }

    .statement-summary dl {
      grid-template-columns: repeat(2, minmax(120px, 1fr));
    }
  }

  @media (max-width: 760px) {
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
