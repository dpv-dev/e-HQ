<script lang="ts">
  import { onMount } from "svelte";
  import type { AuthSession } from "@ehq/auth";
  import {
    beginReload,
    createErrorState,
    createIdleState,
    createSuccessState,
    type ApiMutationReceipt,
    type ApiRequestState,
    type ApiRunReceipt,
    type AllocationRunSummary,
    type AuditLogEntry,
    type CurrencyCode,
    type DistributionAlias,
    type DistributionAliasTargetType,
    type DistributionContract,
    type DistributionContractExpense,
    type DistributionContractExpenseCategory,
    type DistributionDashboardResponse,
    type DistributionDashboardReadinessItem,
    type DistributionDashboardTopRoyalty,
    type DistributionDuplicate,
    type DistributionImportBatch,
    type DistributionImportConfirmResponse,
    type DistributionImportPreviewRequest,
    type DistributionImportPreviewResponse,
    type DistributionFxRate,
    type DistributionMappingRow,
    type DistributionReconciliationAction,
    type DistributionReconciliationResponse,
    type DistributionRevenueRow,
    type DistributionScreenResponse,
    type DistributionSettingsResponse,
    type PageResult,
    type PayeeSummary,
    type PaymentSummary,
    type DistributionPaymentMethod,
    type ReleaseSummary,
    type StatementPrintLine,
    type StatementPrintResponse,
    type StatementSummary,
    type SuspenseItem,
    type TrackSummary
  } from "@ehq/api-client";
  import { Alert, BarsChart, Button, Input, KPI, Loader, PageHeader, SectionTemplate, Select, Table, Toolbar, WorkspaceShell } from "@ehq/ui";
  import type { ChartPoint, IconName, SelectOption, TableColumn, TablePagination, TableRow, TableRowAction, Tone, ToolbarFilter, WorkspaceNavGroup, WorkspaceNavItem } from "@ehq/ui";
  import { createShellApiClient } from "../../app-shell-data.js";
  import { parseCsvRecords } from "../../csv-records.js";
  import { formatDateOnly, formatDateRange } from "../../date-format.js";
  import { formatMoneyValue, moneyToneForValue } from "../../money-format.js";
  import "./distribution-command.css";
  import { createPeriodOptions, getLatestDataPeriod, periodLabel, rangeForScope, rangeLabel, todayIso, type DateRange, type PeriodScope } from "../../period-controls.js";
  import { normalizeRoutePath } from "../../route-utils.js";
  import { sortOptionsAlphabetically } from "../../select-options.js";
  import { appendPageResult, createTablePagination, loadPageResult, readPageItems, TABLE_PAGE_SIZE, type PageLoadMode } from "../../table-pagination.js";
  import {
    apiRequestStateLabel as stateLabel,
    isRequestStatusLoading
  } from "../request-state.js";
  import type { CanonicalRequestStatus } from "../request-state.js";
  import {
    canCancelDistributionImportBatch,
    canOpenDistributionImportBatch,
    distributionImportBatchReadOnlyReason,
    distributionImportActionLabel,
    distributionImportStatusTone,
    isDistributionImportBatchReversible
  } from "./import-batch-status.js";

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
  type ImportBatchStatusFilter = "all" | "uploaded" | "mapped" | "validated" | "failed" | "voided";
  type ImportSource = "kontor" | "routenote";
  type MappingStatusFilter = "all" | "unmapped" | "suggested" | "mapped";
  type SuspenseStatusFilter = "all" | "open" | "resolved";
  type PaymentStatusFilter = "all" | "draft" | "paid" | "voided";
  type RevenueGroupBy = "payee" | "track" | "currency" | "store" | "period";
  type RequestStatus = CanonicalRequestStatus;
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
  type CatalogStatusFilter = "all" | CatalogEntryStatus;
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
        { id: "dashboard", label: "Dashboard", title: "Dashboard", subtitle: "Royalty cockpit, blockers and priority actions." }
      ]
    },
    {
      id: "workflow",
      label: "Royalty workflow",
      items: [
        { id: "imports", label: "Imports", title: "Imports", subtitle: "Kontor/RouteNote exports, preview and confirmation." },
        { id: "mapping", label: "Mapping", title: "Mapping", subtitle: "Review rows, automate safe matches and apply rules." },
        { id: "catalog", label: "Catalog", title: "Catalog", subtitle: "Releases, tracks, contributors and split health." },
        { id: "aliases", label: "Aliases", title: "Aliases", subtitle: "Catalog aliases route imported names to canonical entities." },
        { id: "duplicates", label: "Duplicates", title: "Duplicates", subtitle: "Detect potentially duplicated records." },
        { id: "contracts", label: "Contracts", title: "Contracts", subtitle: "Splits, payees, expenses and recoupments." },
        { id: "allocations", label: "Allocations", title: "Allocations", subtitle: "Preview, post and reverse through scheduled, locked runs." },
        { id: "suspense", label: "Suspense", title: "Suspense", subtitle: "Grouped by cause with a clear resolution path." },
        { id: "statements", label: "Statements", title: "Statements", subtitle: "Financial summary, payment reconciliation and A4 printing." },
        { id: "payments", label: "Payments", title: "Payments", subtitle: "Standalone Distribution ledger payments and statement links." }
      ]
    },
    {
      id: "administration",
      label: "Administration",
      items: [
        { id: "audit-log", label: "Audit log", title: "Audit log", subtitle: "Distribution audit trail for recorded actions." },
        { id: "settings", label: "Settings", title: "Settings", subtitle: "Distribution configuration and FX rates." },
        { id: "revenue", label: "Revenue", title: "Revenue", subtitle: "Financial view by payee, track, currency, store or period." }
      ]
    }
  ];
  const reconciliationNavItem: DistributionNavItem = {
    id: "financial-reconciliation",
    label: "Financial reconciliation",
    title: "Financial reconciliation",
    subtitle: "Compatibility route; operational queues now live on Statements and Payments."
  };
  const navItems: readonly DistributionNavItem[] = [
    ...navGroups.flatMap((group: DistributionNavGroup): readonly DistributionNavItem[] => group.items),
    reconciliationNavItem
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
  const importStatusFilterOptions: readonly SelectOption[] = [
    { label: "All statuses", value: allValue },
    { label: "Uploaded", value: "uploaded" },
    { label: "Mapped", value: "mapped" },
    { label: "Validated", value: "validated" },
    { label: "Failed", value: "failed" },
    { label: "Voided", value: "voided" }
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
    { label: "Paid", value: "paid" },
    { label: "Voided", value: "voided" }
  ];
  const paymentMethodOptions: readonly SelectOption[] = [
    { label: "Bank transfer", value: "bank_transfer" },
    { label: "PayPal", value: "paypal" },
    { label: "Cash", value: "cash" },
    { label: "Cheque", value: "cheque" },
    { label: "Crypto", value: "crypto" },
    { label: "Other", value: "other" }
  ];
  const paymentRecordStatusOptions: readonly SelectOption[] = [
    { label: "Paid · post now", value: "paid" },
    { label: "Draft", value: "draft" }
  ];
  const expenseCategoryOptions: readonly SelectOption[] = [
    { label: "Advance", value: "advance" },
    { label: "Recoupment", value: "recoupment" },
    { label: "Studio", value: "studio" },
    { label: "Marketing", value: "marketing" },
    { label: "Distribution", value: "distribution" },
    { label: "Other", value: "other" }
  ];
  const catalogStatusOptions: readonly SelectOption[] = [
    { label: "Draft", value: "draft" },
    { label: "Released", value: "released" },
    { label: "Archived", value: "archived" }
  ];
  const catalogFilterOptions: readonly SelectOption[] = [
    { label: "All statuses", value: allValue },
    ...catalogStatusOptions
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
  const aliasTargetTypeOptions: readonly SelectOption[] = [
    { label: "Unassigned", value: "unassigned" },
    { label: "Payee", value: "payee" },
    { label: "Release", value: "release" },
    { label: "Track", value: "track" },
    { label: "Artist", value: "artist" },
    { label: "Label", value: "label" }
  ];
  const dashboardReadinessColumns: readonly TableColumn[] = [
    { label: "Workflow area", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Count", align: "right", sortable: true },
    { label: "Why it matters", align: "left", sortable: true }
  ];
  const dashboardTopColumns: readonly TableColumn[] = [
    { label: "Name", align: "left", sortable: true },
    { label: "Context", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true }
  ];
  const importColumns: readonly TableColumn[] = [
    { label: "ID", align: "left", sortable: true },
    { label: "Distributor", align: "left", sortable: true },
    { label: "File", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Rows", align: "right", sortable: true },
    { label: "Normalized", align: "right", sortable: true },
    { label: "Income", align: "right", sortable: true },
    { label: "Issues", align: "right", sortable: true },
    { label: "Skipped", align: "right", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Imported", align: "left", sortable: true }
  ];
  const mappingColumns: readonly TableColumn[] = [
    { label: "Source title", align: "left", sortable: true },
    { label: "Artist", align: "left", sortable: true },
    { label: "Label", align: "left", sortable: true },
    { label: "Store", align: "left", sortable: true },
    { label: "ISRC / UPC", align: "left", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Suggested match", align: "left", sortable: true },
    { label: "Confidence", align: "left", sortable: true },
    { label: "Resolution path", align: "left", sortable: true },
    { label: "Selection", align: "left", sortable: true }
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
  const payeeColumns: readonly TableColumn[] = [
    { label: "Payee", align: "left", sortable: true },
    { label: "Email", align: "left", sortable: true },
    { label: "Preferred currency", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const expenseColumns: readonly TableColumn[] = [
    { label: "Category", align: "left", sortable: true },
    { label: "Payee charged", align: "left", sortable: true },
    { label: "Description", align: "left", sortable: true },
    { label: "Date", align: "left", sortable: true },
    { label: "Original amount", align: "right", sortable: true },
    { label: "Open", align: "right", sortable: true },
    { label: "Recoverable", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const allocationColumns: readonly TableColumn[] = [
    { label: "Run", align: "left", sortable: true },
    { label: "Period", align: "left", sortable: true },
    { label: "Lock", align: "left", sortable: true },
    { label: "Input", align: "right", sortable: true },
    { label: "Allocated", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const suspenseColumns: readonly TableColumn[] = [
    { label: "Reason", align: "left", sortable: true },
    { label: "Source", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Resolution path", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const statementColumns: readonly TableColumn[] = [
    { label: "Payee", align: "left", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Recoupment", align: "right", sortable: true },
    { label: "Paid", align: "right", sortable: true },
    { label: "Payable", align: "right", sortable: true },
    { label: "Period", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const paymentColumns: readonly TableColumn[] = [
    { label: "ID", align: "left", sortable: true },
    { label: "Payee", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Ccy", align: "left", sortable: true },
    { label: "FX rate", align: "right", sortable: true },
    { label: "Method", align: "left", sortable: true },
    { label: "Reference", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Paid at", align: "left", sortable: true },
    { label: "Statements linked", align: "right", sortable: true }
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
    { label: "Lot", align: "left", sortable: true },
    { label: "Track", align: "left", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Gross", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const reconBalanceColumns: readonly TableColumn[] = [
    { label: "Payee", align: "left", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Rows", align: "right", sortable: true },
    { label: "First row", align: "left", sortable: true },
    { label: "Last row", align: "left", sortable: true },
    { label: "Last closing balance", align: "right", sortable: true }
  ];
  const aliasColumns: readonly TableColumn[] = [
    { label: "Alias", align: "left", sortable: true },
    { label: "Target", align: "left", sortable: true },
    { label: "Type", align: "left", sortable: true }
  ];
  const duplicateColumns: readonly TableColumn[] = [
    { label: "Label", align: "left", sortable: true },
    { label: "Type", align: "left", sortable: true },
    { label: "Occurrences", align: "right", sortable: true },
    { label: "Examples", align: "left", sortable: true },
    { label: "Merge", align: "left", sortable: true }
  ];
  const auditColumns: readonly TableColumn[] = [
    { label: "Date", align: "left", sortable: true },
    { label: "Actor", align: "left", sortable: true },
    { label: "Action", align: "left", sortable: true },
    { label: "Entity", align: "left", sortable: true }
  ];
  const fxRateColumns: readonly TableColumn[] = [
    { label: "From", align: "left", sortable: true },
    { label: "To", align: "left", sortable: true },
    { label: "Date", align: "left", sortable: true },
    { label: "Rate", align: "right", sortable: true }
  ];

  let activePageId = $state<DistributionPageId>("dashboard");
  const navIcons: Readonly<Record<DistributionPageId, IconName>> = {
    dashboard: "home",
    imports: "upload",
    mapping: "layout-grid",
    catalog: "folder",
    contracts: "file-text",
    allocations: "chart-bar",
    suspense: "triangle-alert",
    statements: "file-text",
    payments: "bank",
    revenue: "trending-up",
    "financial-reconciliation": "check",
    aliases: "more-horizontal",
    duplicates: "search",
    "audit-log": "clock",
    settings: "settings"
  };
  const shellNavGroups = $derived<readonly WorkspaceNavGroup[]>(
    navGroups.map((group: DistributionNavGroup): WorkspaceNavGroup => ({
      id: group.id,
      label: group.label,
      items: group.items.map((item: DistributionNavItem): WorkspaceNavItem => ({
        label: item.label,
        href: item.id,
        icon: navIcons[item.id],
        active: activePageId === item.id,
        disabled: false,
        badge: null
      }))
    }))
  );
  const handleShellNavigate = (href: string): void => {
    selectPage(href as DistributionPageId);
  };
  let periodScope = $state<PeriodScope>("year");
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
  let fxRatesState = $state<ApiRequestState<PageResult<DistributionFxRate>>>(
    createIdleState<PageResult<DistributionFxRate>>()
  );
  let importSourceFilter = $state<ImportSourceFilter>(allValue);
  let importStatusFilter = $state<ImportBatchStatusFilter>(allValue);
  let mappingStatusFilter = $state<MappingStatusFilter>("unmapped");
  let mappingBatchFilter = $state<string>(allValue);
  let mappingSearch = $state("");
  let catalogStatusFilter = $state<CatalogStatusFilter>(allValue);
  let suspenseStatusFilter = $state<SuspenseStatusFilter>("open");
  let paymentStatusFilter = $state<PaymentStatusFilter>(allValue);
  let statementPayeeFilter = $state<string>(allValue);
  let statementCurrencyFilter = $state<CurrencyCode | "all">(allValue);
  let revenuePayeeFilter = $state<string>(allValue);
  let revenueStoreFilter = $state<string>(allValue);
  let revenueGroupBy = $state<RevenueGroupBy>("store");
  let revenueCurrencyFilter = $state<CurrencyCode | "all">(allValue);
  let importState = $state<ImportUiState>({
    status: "idle",
    source: "routenote",
    fileName: "",
    rows: [],
    checksum: "",
    preview: null,
    confirm: null,
    message: "Select a Kontor or RouteNote export (CSV/TSV) to start the preview."
  });
  let importFileInput = $state<HTMLInputElement | null>(null);
  let runReceipt = $state<ApiRunReceipt | null>(null);
  let mutationReceipt = $state<ApiMutationReceipt | null>(null);
  let runReceiptPageId = $state<DistributionPageId | null>(null);
  let mutationReceiptPageId = $state<DistributionPageId | null>(null);
  let writesEnabled = $state(false);
  let writeGateMessage = $state("Checking write access.");
  let tablePaginationLoading = $state<DistributionPagedTableId | null>(null);
  let tablePaginationErrors = $state<Partial<Record<DistributionPagedTableId, string | null>>>({});
  let selectedMappingRowIds = $state<readonly string[]>([]);
  let selectedPaymentId = $state<string | null>(null);
  let paymentPanelMode = $state<PaymentPanelMode | null>(null);
  let paymentReferenceInput = $state("");
  let paymentNotesInput = $state("");
  let paymentMethodInput = $state<DistributionPaymentMethod>("bank_transfer");
  let paymentStatusInput = $state<"draft" | "paid">("paid");
  let paymentPaidDateInput = $state(today);
  let paymentExchangeRateInput = $state("");
  let paymentReconcileStatementId = $state("");
  let paymentReconcileAmountInput = $state("");
  let recordStatementId = $state("");
  let recordPaymentPayeeId = $state("");
  let recordPaymentAmount = $state("");
  let recordPaymentCurrency = $state("MUR");
  let recordPaymentExchangeRate = $state("");
  let recordPaymentMethod = $state<DistributionPaymentMethod>("bank_transfer");
  let recordPaymentStatus = $state<"draft" | "paid">("paid");
  let recordPaymentPaidDate = $state(today);
  let recordPaymentReference = $state("");
  let recordPaymentNotes = $state("");
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
  let payeePanelOpen = $state(false);
  let payeeNameInput = $state("");
  let payeeEmailInput = $state("");
  let payeeCurrencyInput = $state("MUR");
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
  let expenseContractFilterId = $state("");
  let expensePanelOpen = $state(false);
  let expenseContractIdInput = $state("");
  let expenseLabelInput = $state("");
  let expenseCategoryInput = $state<DistributionContractExpenseCategory>("advance");
  let expensePayeeIdInput = $state("");
  let expenseRecoverableInput = $state("yes");
  let expenseAmountInput = $state("");
  let expenseDateInput = $state("");
  let printingStatementId = $state<string | null>(null);
  let statementPrintError = $state<string | null>(null);
  let fxFromCurrencyInput = $state("EUR");
  let fxToCurrencyInput = $state("MUR");
  let fxEffectiveDateInput = $state(today);
  let fxRateInput = $state("");
  let aliasEditorId = $state<string | null>(null);
  let aliasTextInput = $state("");
  let aliasTargetTypeInput = $state<DistributionAliasTargetType>("unassigned");
  let aliasTargetIdInput = $state("");
  let fxRateSaveStatus = $state<RequestStatus>("idle");
  let fxRateSaveMessage = $state<string | null>(null);
  let duplicateEditorId = $state<string | null>(null);
  let duplicateMasterId = $state("");
  // Write failures land here (per page) so a transient mutation error never
  // clobbers the loaded list states rendered by the tables.
  let actionError = $state<string | null>(null);
  let actionErrorPageId = $state<DistributionPageId | null>(null);

  const activePage = $derived(getNavItem(activePageId));
  const distributionPeriod = $derived(selectedPeriod);
  const activeRange = $derived(rangeForScope(periodScope, today, customRange));
  const periodControlVisible = $derived(pageUsesPeriodControl(activePageId));
  const allocationLockKey = $derived(`distribution:allocations:${distributionPeriod}`);
  const importBatches = $derived(readPageItems(importBatchesState));
  const mappingRows = $derived(readPageItems(mappingState));
  const filteredMappingRows = $derived(filterMappingRows(mappingRows, mappingSearch));
  const payees = $derived(readPageItems(payeesState));
  const releases = $derived(readPageItems(releasesState));
  const tracks = $derived(readPageItems(tracksState));
  const contracts = $derived(readPageItems(contractsState));
  const expenses = $derived(readPageItems(expensesState));
  const allocationRuns = $derived(readPageItems(allocationsState));
  const suspenseItems = $derived(readPageItems(suspenseState));
  const statements = $derived(readPageItems(statementsState));
  const filteredStatements = $derived(
    statements.filter((statement: StatementSummary): boolean => statementCurrencyFilter === allValue || statement.currency === statementCurrencyFilter)
  );
  // Deploys update API and static assets independently. Normalize the previous
  // payment shape so an in-flight rollout never crashes the Payments page.
  const payments = $derived(readPageItems(paymentsState).map(normalizePaymentSummary));
  const revenueRows = $derived(readPageItems(revenueState));
  const dashboardReadinessRows = $derived(createDashboardReadinessRows(dashboardState));
  const dashboardArtistRows = $derived(createDashboardTopRows(dashboardState, "artists"));
  const dashboardTrackRows = $derived(createDashboardTopRows(dashboardState, "tracks"));
  const dashboardStoreRows = $derived(createDashboardTopRows(dashboardState, "stores"));
  const dashboardMappingBlockerCount = $derived(dashboardReadinessCount(dashboardState, "mapping"));
  const importRows = $derived(createImportRows(importBatches));
  const mappingTableRows = $derived(createMappingRows(filteredMappingRows, selectedMappingRowIds));
  const catalogRows = $derived(createCatalogRows(releases, tracks));
  const contractRows = $derived(createContractRows(contracts, payees));
  const expenseRows = $derived(createExpenseRows(expenses));
  const allocationRows = $derived(createAllocationRows(allocationRuns));
  const suspenseTableRows = $derived(createSuspenseRows(suspenseItems));
  const statementRows = $derived(createStatementRows(filteredStatements));
  const paymentRows = $derived(createPaymentRows(payments));
  const unlinkedPaymentRows = $derived(createPaymentRows(payments.filter((payment) => payment.linkedStatementIds.length === 0 && payment.status !== "voided")));
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
  const fxRates = $derived(readPageItems(fxRatesState));
  const aliasRows = $derived(createAliasRows(aliases));
  const duplicateRows = $derived(createDuplicateRows(duplicates));
  const duplicateMasterOptions = $derived<readonly SelectOption[]>(createDuplicateMasterOptions(duplicates, duplicateEditorId));
  const auditRows = $derived(createAuditRows(auditEntries));
  const fxRateRows = $derived(createFxRateRows(fxRates));
  const revenueCurrencyOptions = $derived<readonly SelectOption[]>([
    { label: "All currencies", value: allValue },
    ...Array.from(new Set(revenueRows.map((row: DistributionRevenueRow): CurrencyCode => row.currency))).map((currency: CurrencyCode): SelectOption => ({ label: currency, value: currency }))
  ]);
  const revenuePayeeOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "All payees", value: allValue },
    ...payees.map((payee: PayeeSummary): SelectOption => ({ label: payee.displayName, value: payee.id }))
  ], 1));
  const revenueStoreOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "All stores", value: allValue },
    ...(revenueGroupBy === "store"
      ? Array.from(new Set(revenueRows.map((row: DistributionRevenueRow): string => row.label))).map((store: string): SelectOption => ({ label: store, value: store }))
      : [])
  ], 1));
  const dashboardKpis = $derived(createDashboardKpis(dashboardState));
  const contractKpis = $derived(createContractKpis(contracts, tracks));
  const payeeRows = $derived(createPayeeRows(payees));
  const revenueKpis = $derived(createRevenueKpis(revenueRows, payments, suspenseItems));
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
  const fxFromCurrencyNormalized = $derived(normalizeCurrencyCode(fxFromCurrencyInput));
  const fxToCurrencyNormalized = $derived(normalizeCurrencyCode(fxToCurrencyInput));
  const fxEffectiveDateNormalized = $derived(normalizeIsoDate(fxEffectiveDateInput));
  const fxRateNormalized = $derived(normalizeFxRateValue(fxRateInput));
  const fxRateFormValid = $derived(
    fxFromCurrencyNormalized !== null &&
    fxToCurrencyNormalized !== null &&
    fxEffectiveDateNormalized !== null &&
    fxRateNormalized !== null
  );
  const aliasTargetRequiresId = $derived(aliasTargetTypeInput !== "unassigned");
  const aliasTargetIsSelect = $derived(
    aliasTargetTypeInput === "payee" || aliasTargetTypeInput === "release" || aliasTargetTypeInput === "track"
  );
  const aliasTargetSelectOptions = $derived<readonly SelectOption[]>(createAliasTargetOptions(aliasTargetTypeInput, payees, releases, tracks));
  const aliasFormValid = $derived(
    aliasTextInput.trim().length > 0 &&
    (!aliasTargetRequiresId || aliasTargetIdInput.trim().length > 0)
  );
  const importToolbarFilters = $derived(createImportToolbarFilters(importState));
  const mappingBatchFilterOptions = $derived<readonly SelectOption[]>([
    { label: "All batches", value: allValue },
    ...importBatches
      .filter((batch: DistributionImportBatch): boolean => batch.status !== "voided")
      .map((batch: DistributionImportBatch): SelectOption => ({
      label: `${batch.fileName} · ${batch.period}`,
      value: batch.id
      }))
  ]);
  const canPreviewImport = $derived(importState.rows.length > 0 && importState.status !== "loading");
  const canConfirmImport = $derived(importState.preview !== null && importState.status !== "loading");
  const canOpenImportAssistant = $derived((importState.preview !== null || importState.rows.length > 0) && importState.status !== "loading");
  const statementPreview = $derived(
    filteredStatements.find((statement: StatementSummary): boolean => statementPayeeFilter !== allValue && statement.payeeId === statementPayeeFilter) ?? filteredStatements[0] ?? null
  );
  const selectedPayment = $derived(payments.find((payment: PaymentSummary): boolean => payment.id === selectedPaymentId) ?? null);
  const openStatements = $derived(
    filteredStatements.filter((statement: StatementSummary): boolean => statement.status === "draft" || statement.status === "posted")
  );
  const recordStatement = $derived(openStatements.find((statement: StatementSummary): boolean => statement.id === recordStatementId) ?? null);
  const recordPaymentAmountMicro = $derived(parseExpenseAmountMicro(recordPaymentAmount));
  const recordPaymentExchangeRateNormalized = $derived(
    recordPaymentExchangeRate.trim() === "" ? null : normalizeFxRateValue(recordPaymentExchangeRate)
  );
  const paymentExchangeRateNormalized = $derived(
    paymentExchangeRateInput.trim() === "" ? null : normalizeFxRateValue(paymentExchangeRateInput)
  );
  const paymentReconcileAmountMicro = $derived(parseExpenseAmountMicro(paymentReconcileAmountInput));
  const selectedSuspenseItem = $derived(suspenseItems.find((item: SuspenseItem): boolean => item.id === selectedSuspenseId) ?? null);
  const selectedSuspenseResolution = $derived(selectedSuspenseItem === null ? null : suspenseResolutionFor(selectedSuspenseItem));
  const selectedSuspenseTrack = $derived(
    (suspenseTrackOptions ?? []).find((track: TrackSummary): boolean => track.id === suspenseTargetTrackId) ?? null
  );
  const suspenseResolveTarget = $derived(resolveSuspenseTargetFor(selectedSuspenseResolution, selectedSuspenseTrack));
  const selectedRun = $derived(allocationRuns.find((run: AllocationRunSummary): boolean => run.id === selectedRunId) ?? null);
  const selectedRuleContract = $derived(contracts.find((contract: DistributionContract): boolean => contract.id === ruleContractId) ?? null);
  const selectedExpenseFilterContract = $derived(
    contracts.find((contract: DistributionContract): boolean => contract.id === expenseContractFilterId) ?? null
  );
  const contractSplitBp = $derived(parseSplitBasisPoints(contractSplitPercentInput));
  const ruleReplacementPercentage = $derived(normalizeSingleRuleReplacementPercentage(rulePercentageInput));
  const selectedExpenseContract = $derived(
    contracts.find((contract: DistributionContract): boolean => contract.id === expenseContractIdInput) ?? null
  );
  const expenseAmountMicro = $derived(parseExpenseAmountMicro(expenseAmountInput));
  const expenseContractSelectOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "Select a contract", value: "" },
    ...contracts.map((contract: DistributionContract): SelectOption => ({ label: `${contract.title} · ${contract.currency}`, value: contract.id }))
  ], 1));
  const expenseTableTitle = $derived(
    selectedExpenseFilterContract === null
      ? "Expenses / recoupments"
      : `Expenses / recoupments · ${selectedExpenseFilterContract.title}`
  );
  const payeeSelectOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "Select a payee", value: "" },
    ...payees.map((payee: PayeeSummary): SelectOption => ({ label: `${payee.displayName} · ${payee.defaultCurrency}`, value: payee.id }))
  ], 1));
  const expensePayeeOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "Shared / all payees", value: "" },
    ...payees.map((payee: PayeeSummary): SelectOption => ({ label: `${payee.displayName} · ${payee.defaultCurrency}`, value: payee.id }))
  ], 1));
  const trackReleaseSelectOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "No release", value: "" },
    ...releases.map((release: ReleaseSummary): SelectOption => ({ label: `${release.title} · ${release.artistName}`, value: release.id }))
  ], 1));
  const suspenseTrackSelectOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "Select a track", value: "" },
    ...(suspenseTrackOptions ?? []).map((track: TrackSummary): SelectOption => ({ label: `${track.title} · ${track.artistName}`, value: track.id }))
  ], 1));
  const openStatementSelectOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "No statement yet", value: "" },
    ...openStatements.map((statement: StatementSummary): SelectOption => ({
      label: `${statement.payeeName} · ${statement.period} · ${formatMoney(statement.netPayableMicro, statement.currency)}`,
      value: statement.id
    }))
  ], 1));
  const paymentReconcileStatementOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "Select a statement", value: "" },
    ...openStatements
      .filter((statement: StatementSummary): boolean =>
        selectedPayment !== null &&
        statement.payeeId === selectedPayment.payeeId &&
        statement.currency === selectedPayment.currency
      )
      .map((statement: StatementSummary): SelectOption => ({
        label: `${statement.payeeName} · ${statement.period} · ${formatMoney(statement.netPayableMicro, statement.currency)}`,
        value: statement.id
      }))
  ], 1));
  const statementPayeeOptions = $derived<readonly SelectOption[]>(sortOptionsAlphabetically([
    { label: "All payees", value: allValue },
    ...payees.map((payee: PayeeSummary): SelectOption => ({ label: payee.displayName, value: payee.id }))
  ], 1));
  const statementCurrencyOptions = $derived<readonly SelectOption[]>([
    { label: "All currencies", value: allValue },
    ...Array.from(new Set(statements.map((statement: StatementSummary): CurrencyCode => statement.currency))).map((currency: CurrencyCode): SelectOption => ({ label: currency, value: currency }))
  ]);
  const paymentRowActions: readonly TableRowAction[] = [
    { label: "Edit payment", onAction: (rowId: string): void => openPaymentPanel(rowId, "edit") },
    { label: "Link statement", onAction: (rowId: string): void => openPaymentPanel(rowId, "reconcile") },
    { label: "Void", onAction: (rowId: string): void => openPaymentPanel(rowId, "void"), danger: true }
  ];
  const dashboardReadinessRowActions: readonly TableRowAction[] = [
    { label: "Open", onAction: openDashboardReadiness }
  ];
  const contractRowActions: readonly TableRowAction[] = [
    { label: "Replace rule set", onAction: openContractRulePanel }
  ];
  const statementRowActions: readonly TableRowAction[] = [
    { label: "Print PDF", onAction: printStatementPdf }
  ];
  const importRowActions: readonly TableRowAction[] = [
    {
      label: "Open",
      onAction: openImportBatch,
      isEnabled: canOpenImportBatch,
      disabledReason: importBatchReadOnlyReason
    },
    {
      label: "Cancel batch",
      onAction: reverseImportBatch,
      danger: true,
      isEnabled: canCancelImportBatch,
      disabledReason: importBatchReadOnlyReason
    }
  ];
  const mappingRowActions: readonly TableRowAction[] = [
    { label: "Toggle selection", onAction: toggleMappingRowSelection }
  ];
  const catalogRowActions: readonly TableRowAction[] = [
    { label: "Review contributors", onAction: reviewCatalogRow }
  ];
  const suspenseRowActions: readonly TableRowAction[] = [
    { label: "Resolve", onAction: openSuspenseResolution }
  ];
  const allocationRowActions: readonly TableRowAction[] = [
    { label: "Request reversal", onAction: selectRunForUnpost, danger: true }
  ];
  const aliasRowActions: readonly TableRowAction[] = [
    { label: "Edit", onAction: openAliasEditor }
  ];
  const duplicateRowActions: readonly TableRowAction[] = [
    { label: "Merge into master", onAction: openDuplicateMerge }
  ];

  onMount((): (() => void) => {
    syncPageFromLocation();
    window.addEventListener("popstate", syncPageFromLocation);
    void loadInitialData();

    return (): void => {
      window.removeEventListener("popstate", syncPageFromLocation);
    };
  });

  $effect((): void => {
    if (selectedMappingRowIds.length === 0) {
      return;
    }

    const visibleIds = new Set(mappingRows.map((row: DistributionMappingRow): string => row.id));
    const kept = selectedMappingRowIds.filter((rowId: string): boolean => visibleIds.has(rowId));

    if (kept.length !== selectedMappingRowIds.length) {
      selectedMappingRowIds = kept;
    }
  });

  $effect((): void => {
    if (activePageId === "settings" && fxRatesState.status === "idle") {
      void loadFxRates();
    }
  });

  async function loadInitialData(): Promise<void> {
    try {
      const screen = await client.distribution.getScreen({
        workspaceId: distributionWorkspaceId,
        period: distributionPeriod,
        dateFrom: activeRange.from,
        dateTo: activeRange.to,
        importSource: toNullableImportSource(importSourceFilter),
        importStatus: toNullableImportBatchStatus(importStatusFilter),
        mappingStatus: toNullableMappingStatus(mappingStatusFilter),
        suspenseStatus: toNullableSuspenseStatus(suspenseStatusFilter),
        paymentStatus: toNullablePaymentStatus(paymentStatusFilter),
        revenueGroupBy
      });
      applyScreenBundle(screen);
      await loadCatalogPage("all");
    } catch {
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
        loadSettings(),
        loadFxRates()
      ]);
    }
  }

  function applyScreenBundle(screen: DistributionScreenResponse): void {
    writesEnabled = screen.status.writesEnabled;
    writeGateMessage = screen.status.writesEnabled ? "write access enabled" : "enable write access";
    dashboardState = createSuccessState<DistributionDashboardResponse>(screen.dashboard);
    importBatchesState = createSuccessState<PageResult<DistributionImportBatch>>(screen.importBatches);
    mappingState = createSuccessState<PageResult<DistributionMappingRow>>(screen.mappingRows);
    payeesState = createSuccessState<PageResult<PayeeSummary>>(screen.payees);
    releasesState = createSuccessState<PageResult<ReleaseSummary>>(screen.releases);
    tracksState = createSuccessState<PageResult<TrackSummary>>(screen.tracks);
    contractsState = createSuccessState<PageResult<DistributionContract>>(screen.contracts);
    const resolvedExpenseContractFilterId = resolveExpenseContractFilterId(screen.contracts.items, expenseContractFilterId);
    expenseContractFilterId = resolvedExpenseContractFilterId;
    expensesState = createSuccessState<PageResult<DistributionContractExpense>>(
      resolvedExpenseContractFilterId === "" ? emptyPageResult<DistributionContractExpense>() : screen.expenses
    );
    allocationsState = createSuccessState<PageResult<AllocationRunSummary>>(screen.allocations);
    suspenseState = createSuccessState<PageResult<SuspenseItem>>(screen.suspense);
    statementsState = createSuccessState<PageResult<StatementSummary>>(screen.statements);
    paymentsState = createSuccessState<PageResult<PaymentSummary>>(screen.payments);
    revenueState = createSuccessState<PageResult<DistributionRevenueRow>>(screen.revenue);
    reconciliationState = createSuccessState<DistributionReconciliationResponse>(screen.reconciliation);
    aliasesState = createSuccessState<PageResult<DistributionAlias>>(screen.aliases);
    duplicatesState = createSuccessState<PageResult<DistributionDuplicate>>(screen.duplicates);
    auditLogState = createSuccessState<PageResult<AuditLogEntry>>(screen.auditLog);
    settingsState = createSuccessState<DistributionSettingsResponse>(screen.settings);
    tablePaginationLoading = null;
    tablePaginationErrors = {};
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
          status: toNullableImportBatchStatus(importStatusFilter),
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
          batchId: toNullableBatchFilter(mappingBatchFilter),
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
                status: toNullableCatalogStatus(catalogStatusFilter),
                cursor: releaseCursor,
                limit: TABLE_PAGE_SIZE
              }),
          trackCursor === null
            ? Promise.resolve(null)
            : client.distribution.listTracks({
                workspaceId: distributionWorkspaceId,
                releaseId: null,
                status: toNullableCatalogStatus(catalogStatusFilter),
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
    if (expenseContractFilterId === "") {
      expensesState = createSuccessState<PageResult<DistributionContractExpense>>(emptyPageResult<DistributionContractExpense>());
      setTablePaginationError("expenses", null);
      return;
    }

    await loadDistributionPageResult(
      "expenses",
      expensesState,
      (state: ApiRequestState<PageResult<DistributionContractExpense>>): void => {
        expensesState = state;
      },
      (cursor: string): Promise<PageResult<DistributionContractExpense>> =>
        client.distribution.listContractExpenses({
          workspaceId: distributionWorkspaceId,
          contractId: expenseContractFilterId,
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
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
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
          period: distributionPeriod,
          payeeId: toNullablePayeeFilter(statementPayeeFilter),
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
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
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
          payeeId: toNullablePayeeFilter(revenuePayeeFilter),
          store: toNullableStoreFilter(revenueStoreFilter),
          currency: toNullableCurrency(revenueCurrencyFilter),
          groupBy: revenueGroupBy,
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
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
      writeGateMessage = status.writesEnabled ? "write access enabled" : "enable write access";
    } catch (error: unknown) {
      writesEnabled = false;
      writeGateMessage = getErrorMessage(error);
    }
  }

  async function loadDashboard(): Promise<void> {
    dashboardState = beginReload<DistributionDashboardResponse>(dashboardState);

    try {
      dashboardState = createSuccessState<DistributionDashboardResponse>(
        await client.distribution.getDashboard({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          dateFrom: activeRange.from,
          dateTo: activeRange.to
        })
      );
    } catch (error: unknown) {
      dashboardState = createErrorState<DistributionDashboardResponse>(error);
    }
  }

  async function loadImportBatches(): Promise<void> {
    importBatchesState = beginReload<PageResult<DistributionImportBatch>>(importBatchesState);

    try {
      importBatchesState = createSuccessState<PageResult<DistributionImportBatch>>(
        await client.distribution.listImportBatches({
          workspaceId: distributionWorkspaceId,
          source: toNullableImportSource(importSourceFilter),
          status: toNullableImportBatchStatus(importStatusFilter),
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
    mappingState = beginReload<PageResult<DistributionMappingRow>>(mappingState);

    try {
      mappingState = createSuccessState<PageResult<DistributionMappingRow>>(
        await client.distribution.listMappingRows({
          workspaceId: distributionWorkspaceId,
          batchId: toNullableBatchFilter(mappingBatchFilter),
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
    payeesState = beginReload<PageResult<PayeeSummary>>(payeesState);

    try {
      let page = await client.distribution.listPayees({ workspaceId: distributionWorkspaceId, status: null, cursor: null, limit: TABLE_PAGE_SIZE });
      while (page.nextCursor !== null) {
        const nextPage = await client.distribution.listPayees({ workspaceId: distributionWorkspaceId, status: null, cursor: page.nextCursor, limit: TABLE_PAGE_SIZE });
        page = appendPageResult(page, nextPage);
      }
      payeesState = createSuccessState<PageResult<PayeeSummary>>(page);
      setTablePaginationError("payees", null);
    } catch (error: unknown) {
      payeesState = createErrorState<PageResult<PayeeSummary>>(error);
    }
  }

  async function loadCatalog(): Promise<void> {
    releasesState = beginReload<PageResult<ReleaseSummary>>(releasesState);
    tracksState = beginReload<PageResult<TrackSummary>>(tracksState);

    try {
      const [releasePage, trackPage] = await Promise.all([
        client.distribution.listReleases({ workspaceId: distributionWorkspaceId, status: toNullableCatalogStatus(catalogStatusFilter), cursor: null, limit: TABLE_PAGE_SIZE }),
        client.distribution.listTracks({ workspaceId: distributionWorkspaceId, releaseId: null, status: toNullableCatalogStatus(catalogStatusFilter), cursor: null, limit: TABLE_PAGE_SIZE })
      ]);
      releasesState = createSuccessState<PageResult<ReleaseSummary>>(releasePage);
      tracksState = createSuccessState<PageResult<TrackSummary>>(trackPage);
      setTablePaginationError("catalog", null);
      await loadCatalogPage("all");
    } catch (error: unknown) {
      releasesState = createErrorState<PageResult<ReleaseSummary>>(error);
      tracksState = createErrorState<PageResult<TrackSummary>>(error);
    }
  }

  async function loadContracts(): Promise<void> {
    contractsState = beginReload<PageResult<DistributionContract>>(contractsState);
    expensesState = beginReload<PageResult<DistributionContractExpense>>(expensesState);

    try {
      const contractPage = await client.distribution.listContracts({
        workspaceId: distributionWorkspaceId,
        payeeId: null,
        status: null,
        cursor: null,
        limit: TABLE_PAGE_SIZE
      });
      const resolvedExpenseContractFilterId = resolveExpenseContractFilterId(contractPage.items, expenseContractFilterId);
      expenseContractFilterId = resolvedExpenseContractFilterId;
      const expensePage = resolvedExpenseContractFilterId === ""
        ? emptyPageResult<DistributionContractExpense>()
        : await client.distribution.listContractExpenses({
            workspaceId: distributionWorkspaceId,
            contractId: resolvedExpenseContractFilterId,
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

  async function loadExpenses(): Promise<void> {
    expensesState = beginReload<PageResult<DistributionContractExpense>>(expensesState);

    if (expenseContractFilterId === "") {
      expensesState = createSuccessState<PageResult<DistributionContractExpense>>(emptyPageResult<DistributionContractExpense>());
      setTablePaginationError("expenses", null);
      return;
    }

    try {
      expensesState = createSuccessState<PageResult<DistributionContractExpense>>(
        await client.distribution.listContractExpenses({
          workspaceId: distributionWorkspaceId,
          contractId: expenseContractFilterId,
          status: null,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
      setTablePaginationError("expenses", null);
    } catch (error: unknown) {
      expensesState = createErrorState<PageResult<DistributionContractExpense>>(error);
    }
  }

  async function loadAllocationRuns(): Promise<void> {
    allocationsState = beginReload<PageResult<AllocationRunSummary>>(allocationsState);

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
    suspenseState = beginReload<PageResult<SuspenseItem>>(suspenseState);

    try {
      suspenseState = createSuccessState<PageResult<SuspenseItem>>(
        await client.distribution.listSuspense({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          status: toNullableSuspenseStatus(suspenseStatusFilter),
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
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
    statementsState = beginReload<PageResult<StatementSummary>>(statementsState);

    try {
      statementsState = createSuccessState<PageResult<StatementSummary>>(
        await client.distribution.listStatements({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: toNullablePayeeFilter(statementPayeeFilter),
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
    paymentsState = beginReload<PageResult<PaymentSummary>>(paymentsState);

    try {
      paymentsState = createSuccessState<PageResult<PaymentSummary>>(
        await client.distribution.listPayments({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: null,
          status: toNullablePaymentStatus(paymentStatusFilter),
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
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
    revenueState = beginReload<PageResult<DistributionRevenueRow>>(revenueState);

    try {
      revenueState = createSuccessState<PageResult<DistributionRevenueRow>>(
        await client.distribution.getRevenue({
          workspaceId: distributionWorkspaceId,
          period: distributionPeriod,
          payeeId: toNullablePayeeFilter(revenuePayeeFilter),
          store: toNullableStoreFilter(revenueStoreFilter),
          currency: toNullableCurrency(revenueCurrencyFilter),
          groupBy: revenueGroupBy,
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
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
    reconciliationState = beginReload<DistributionReconciliationResponse>(reconciliationState);

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
    aliasesState = beginReload<PageResult<DistributionAlias>>(aliasesState);

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
    duplicatesState = beginReload<PageResult<DistributionDuplicate>>(duplicatesState);

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
    auditLogState = beginReload<PageResult<AuditLogEntry>>(auditLogState);

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
    settingsState = beginReload<DistributionSettingsResponse>(settingsState);

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

  async function loadFxRates(): Promise<void> {
    fxRatesState = beginReload<PageResult<DistributionFxRate>>(fxRatesState);

    try {
      fxRatesState = createSuccessState<PageResult<DistributionFxRate>>(
        await client.distribution.listFxRates({
          workspaceId: distributionWorkspaceId,
          fromCurrency: null,
          toCurrency: null,
          effectiveDate: null,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      );
    } catch (error: unknown) {
      fxRatesState = createErrorState<PageResult<DistributionFxRate>>(error);
    }
  }

  async function reloadSettingsPage(): Promise<void> {
    await Promise.all([loadSettings(), loadFxRates()]);
  }

  function resetFxRateSaveMessage(): void {
    if (fxRateSaveStatus === "loading") {
      return;
    }

    fxRateSaveStatus = "idle";
    fxRateSaveMessage = null;
  }

  function updateFxFromCurrencyInput(value: string): void {
    fxFromCurrencyInput = value;
    resetFxRateSaveMessage();
  }

  function updateFxToCurrencyInput(value: string): void {
    fxToCurrencyInput = value;
    resetFxRateSaveMessage();
  }

  function updateFxEffectiveDateInput(value: string): void {
    fxEffectiveDateInput = value;
    resetFxRateSaveMessage();
  }

  function updateFxRateInput(value: string): void {
    fxRateInput = value;
    resetFxRateSaveMessage();
  }

  async function saveFxRate(): Promise<void> {
    if (fxRateSaveStatus === "loading") {
      return;
    }

    if (!writesEnabled) {
      fxRateSaveStatus = "error";
      fxRateSaveMessage = "Enable write access to save an FX rate.";
      return;
    }

    const fromCurrency = fxFromCurrencyNormalized;
    const toCurrency = fxToCurrencyNormalized;
    const effectiveDate = fxEffectiveDateNormalized;
    const rate = fxRateNormalized;

    if (fromCurrency === null || toCurrency === null || effectiveDate === null || rate === null) {
      fxRateSaveStatus = "error";
      fxRateSaveMessage = "Check the FX fields (ISO codes, YYYY-MM-DD date, rate > 0).";
      return;
    }

    fxRateSaveStatus = "loading";
    fxRateSaveMessage = null;

    try {
      await client.distribution.saveFxRates(
        {
          workspaceId: distributionWorkspaceId,
          rates: [
            {
              fromCurrency,
              toCurrency,
              effectiveDate,
              rate
            }
          ]
        },
        {
          idempotencyKey: createIdempotencyKey("settings-fx-rate")
        }
      );
      fxRateSaveStatus = "success";
      fxRateSaveMessage = "FX rate saved.";
      fxRateInput = "";
      await Promise.all([loadSettings(), loadFxRates(), loadAuditLog()]);
    } catch (error: unknown) {
      fxRateSaveStatus = "error";
      fxRateSaveMessage = getErrorMessage(error);
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

  function updateImportStatusFilter(value: string): void {
    importStatusFilter = value as ImportBatchStatusFilter;
  }

  function updateImportSource(value: string): void {
    const source = distributionImportSourceFromValue(value);

    importState = {
      ...importState,
      source,
      preview: null,
      confirm: null,
      message: "Source changed. Run the preview again."
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
        message: `${file.name} is a binary Excel export and cannot be read here. Export it as CSV and try again.`
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
          message: "No usable rows found in this file. A header followed by data rows is required."
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
        message: `${String(rows.length)} rows read and ready for preview.`
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
      message: "Source changed. Run the preview again."
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
      message: "Select a Kontor or RouteNote export (CSV/TSV) to start the preview."
    };
  }

  function openImportFilePicker(): void {
    importFileInput?.click();
  }

  async function openImportAssistant(): Promise<void> {
    if (importState.preview === null) {
      await previewImport();
    }

    if (importState.preview === null) {
      return;
    }

    mappingBatchFilter = allValue;
    selectPage("mapping");
    await loadMappingRows();
  }

  function openImportBatch(batchId: string): void {
    if (!canOpenImportBatch(batchId)) {
      return;
    }

    mappingBatchFilter = batchId;
    selectPage("mapping");
    void loadMappingRows();
  }

  async function reverseImportBatch(batchId: string): Promise<void> {
    if (!writesEnabled) {
      reportActionError(new Error(writeGateMessage));
      return;
    }

    const batch = importBatches.find((candidate: DistributionImportBatch): boolean => candidate.id === batchId);
    if (batch === undefined) {
      reportActionError(new Error("Batch not found in the loaded list."));
      return;
    }

    if (!isDistributionImportBatchReversible(batch.status)) {
      reportActionError(new Error("This batch is already voided."));
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.reverseImportBatch(
        batch.id,
        { workspaceId: distributionWorkspaceId },
        { idempotencyKey: createIdempotencyKey("import-reverse") }
      );
      mutationReceiptPageId = activePageId;
      if (mappingBatchFilter === batch.id) {
        mappingBatchFilter = allValue;
      }
      await Promise.all([loadImportBatches(), loadMappingRows(), loadDashboard(), loadSuspense(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function canCancelImportBatch(batchId: string): boolean {
    return canCancelDistributionImportBatch(importBatchById(batchId));
  }

  function canOpenImportBatch(batchId: string): boolean {
    return canOpenDistributionImportBatch(importBatchById(batchId));
  }

  function importBatchReadOnlyReason(batchId: string): string | null {
    return distributionImportBatchReadOnlyReason(importBatchById(batchId));
  }

  function importBatchById(batchId: string): DistributionImportBatch | null {
    const batch = importBatches.find((candidate: DistributionImportBatch): boolean => candidate.id === batchId);

    if (batch === undefined) {
      return null;
    }

    return batch;
  }

  function toggleMappingRowSelection(rowId: string): void {
    if (selectedMappingRowIds.includes(rowId)) {
      selectedMappingRowIds = selectedMappingRowIds.filter((candidate: string): boolean => candidate !== rowId);
      return;
    }

    selectedMappingRowIds = [...selectedMappingRowIds, rowId];
  }

  function selectAllVisibleMappingRows(): void {
    selectedMappingRowIds = filteredMappingRows.map((row: DistributionMappingRow): string => row.id);
  }

  function clearMappingSelection(): void {
    selectedMappingRowIds = [];
  }

  function updateMappingStatus(value: string): void {
    mappingStatusFilter = value as MappingStatusFilter;
  }

  function updateMappingBatchFilter(value: string): void {
    mappingBatchFilter = value;
  }

  function updateMappingSearch(value: string): void {
    mappingSearch = value;
  }

  function filterMappingRows(rows: readonly DistributionMappingRow[], query: string): readonly DistributionMappingRow[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (normalizedQuery === "") {
      return rows;
    }

    return rows.filter((row: DistributionMappingRow): boolean =>
      [row.sourceTitle, row.sourceArtist, row.sourceLabel, row.sourceStore, row.sourceIsrc ?? "", row.sourceUpc ?? "", row.suggestedTrackTitle ?? ""]
        .some((value: string): boolean => value.toLocaleLowerCase().includes(normalizedQuery))
    );
  }

  function updateCatalogStatus(value: string): void {
    catalogStatusFilter = value as CatalogStatusFilter;
  }

  function updateSuspenseStatus(value: string): void {
    suspenseStatusFilter = value as SuspenseStatusFilter;
  }

  function updatePaymentStatus(value: string): void {
    paymentStatusFilter = value as PaymentStatusFilter;
  }

  function updateStatementPayee(value: string): void {
    statementPayeeFilter = value;
  }

  function updateStatementCurrency(value: string): void {
    statementCurrencyFilter = value === allValue ? allValue : normalizeCurrencyCode(value) ?? allValue;
  }

  function updateRevenuePayee(value: string): void {
    revenuePayeeFilter = value;
  }

  function updateRevenueStore(value: string): void {
    revenueStoreFilter = value;
  }

  function updateRevenueGroup(value: string): void {
    revenueGroupBy = value as RevenueGroupBy;
  }

  function updateRevenueCurrency(value: string): void {
    revenueCurrencyFilter = value === allValue ? allValue : normalizeCurrencyCode(value) ?? allValue;
  }

  function updateRecordStatement(value: string): void {
    recordStatementId = value;
    const statement = openStatements.find((candidate) => candidate.id === value);
    if (statement !== undefined) {
      recordPaymentPayeeId = statement.payeeId;
      recordPaymentAmount = statement.netPayableMicro;
      recordPaymentCurrency = statement.currency;
    }
  }

  function updateRecordPaymentReference(value: string): void {
    recordPaymentReference = value;
  }

  function updateRecordPaymentPayee(value: string): void { recordPaymentPayeeId = value; }
  function updateRecordPaymentAmount(value: string): void { recordPaymentAmount = value; }
  function updateRecordPaymentCurrency(value: string): void { recordPaymentCurrency = value.toUpperCase(); }
  function updateRecordPaymentExchangeRate(value: string): void { recordPaymentExchangeRate = value; }
  function updateRecordPaymentMethod(value: string): void { recordPaymentMethod = value as DistributionPaymentMethod; }
  function updateRecordPaymentStatus(value: string): void { recordPaymentStatus = value as "draft" | "paid"; }
  function updateRecordPaymentPaidDate(event: Event): void { recordPaymentPaidDate = readInputValue(event); }
  function updateRecordPaymentNotes(value: string): void { recordPaymentNotes = value; }

  function updatePaymentReferenceInput(value: string): void {
    paymentReferenceInput = value;
  }
  function updatePaymentNotesInput(value: string): void { paymentNotesInput = value; }
  function updatePaymentMethodInput(value: string): void { paymentMethodInput = value as DistributionPaymentMethod; }
  function updatePaymentStatusInput(value: string): void { paymentStatusInput = value as "draft" | "paid"; }
  function updatePaymentPaidDateInput(event: Event): void { paymentPaidDateInput = readInputValue(event); }
  function updatePaymentExchangeRateInput(value: string): void { paymentExchangeRateInput = value; }
  function updatePaymentReconcileStatement(value: string): void {
    paymentReconcileStatementId = value;
    const statement = openStatements.find((candidate) => candidate.id === value);
    if (statement !== undefined) {
      paymentReconcileAmountInput = statement.netPayableMicro;
    }
  }
  function updatePaymentReconcileAmount(value: string): void { paymentReconcileAmountInput = value; }

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
        message: "Select a CSV/TSV export file before previewing."
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
      const acceptedRowIds = preview.rowResults
        .filter((row): boolean => row.status === "accepted")
        .map((row): string => row.id);

      const fallbackAcceptedRowIds = Array.from(
        { length: preview.acceptedRowCount },
        (_: unknown, index: number): string => `row_${String(index + 1)}`
      );

      const confirm = await client.distribution.confirmImport(
        {
          workspaceId: distributionWorkspaceId,
          previewId: preview.previewId,
          acceptedRowIds: acceptedRowIds.length > 0 ? acceptedRowIds : fallbackAcceptedRowIds,
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
      await Promise.all([loadImportBatches(), loadMappingRows(), loadDashboard(), loadSuspense(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      importState = {
        ...importState,
        status: "error",
        message: getErrorMessage(error)
      };
    }
  }

  async function applyMappingRules(): Promise<void> {
    const selectedRows = mappingRows.filter((row: DistributionMappingRow): boolean => selectedMappingRowIds.includes(row.id));
    const targetRows = selectedMappingRowIds.length > 0 ? selectedRows : filteredMappingRows;

    if (targetRows.length === 0) {
      return;
    }

    const batchIds = [...new Set(targetRows.map((row: DistributionMappingRow): string => row.batchId))];
    const batchId = batchIds[0];

    if (batchId === undefined || batchIds.length !== 1) {
      reportActionError(new Error("Invalid selection: apply rules to one batch at a time."));
      return;
    }

    const rowIds = targetRows.map((row: DistributionMappingRow): string => row.id);

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.applyMappingRules(
        {
          workspaceId: distributionWorkspaceId,
          batchId,
          rowIds
        },
        {
          idempotencyKey: createIdempotencyKey("mapping-rules")
        }
      );
      mutationReceiptPageId = activePageId;
      clearMappingSelection();
      await Promise.all([loadMappingRows(), loadSuspense(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openExpensePanel(): void {
    expensePanelOpen = true;
    expenseContractIdInput = expenseContractFilterId;
    expensePayeeIdInput = selectedExpenseFilterContract?.payeeId ?? "";
    expenseCategoryInput = "advance";
    expenseLabelInput = "";
    expenseAmountInput = "";
    expenseDateInput = today;
    expenseRecoverableInput = "yes";
  }

  function closeExpensePanel(): void {
    expensePanelOpen = false;
  }

  function updateExpenseContract(value: string): void {
    expenseContractIdInput = value;
    expensePayeeIdInput = contracts.find((contract) => contract.id === value)?.payeeId ?? "";
  }

  function updateExpensePayee(value: string): void { expensePayeeIdInput = value; }
  function updateExpenseCategory(value: string): void { expenseCategoryInput = value as DistributionContractExpenseCategory; }
  function updateExpenseRecoverable(value: string): void { expenseRecoverableInput = value; }

  function updateExpenseContractFilter(value: string): void {
    expenseContractFilterId = value;
    void loadExpenses();
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

  // Keep money textual across the UI/API boundary at the Distribution scale (10 decimals).
  function parseExpenseAmountMicro(input: string): string | null {
    const match = /^(\d+)(?:[.,](\d{1,10}))?$/u.exec(input.trim());

    if (match === null || match[1] === undefined) {
      return null;
    }

    const micro = BigInt(match[1]) * 10_000_000_000n + BigInt((match[2] ?? "").padEnd(10, "0"));

    if (micro <= 0n) {
      return null;
    }

    return `${String(micro / 10_000_000_000n)}.${String(micro % 10_000_000_000n).padStart(10, "0")}`;
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
          payeeId: expensePayeeIdInput === "" ? null : expensePayeeIdInput,
          incurredOn: expenseDateInput,
          category: expenseCategoryInput,
          label,
          amountMicro,
          currency: contract.currency,
          recoverable: expenseRecoverableInput === "yes"
        },
        {
          idempotencyKey: createIdempotencyKey("expense-record")
        }
      );
      mutationReceiptPageId = activePageId;
      closeExpensePanel();
      await Promise.all([loadContracts(), loadReconciliation(), loadAuditLog()]);
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
      await Promise.all([loadCatalog(), loadAliases(), loadDuplicates()]);
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
      await Promise.all([loadCatalog(), loadAliases(), loadDuplicates()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openPayeePanel(): void {
    payeePanelOpen = true;
    payeeNameInput = "";
    payeeEmailInput = "";
    payeeCurrencyInput = "MUR";
  }

  function closePayeePanel(): void { payeePanelOpen = false; }
  function updatePayeeName(value: string): void { payeeNameInput = value; }
  function updatePayeeEmail(value: string): void { payeeEmailInput = value; }
  function updatePayeeCurrency(value: string): void { payeeCurrencyInput = value.toUpperCase(); }

  async function createPayee(): Promise<void> {
    const displayName = payeeNameInput.trim();
    const defaultCurrency = normalizeCurrencyCode(payeeCurrencyInput);
    if (displayName === "" || defaultCurrency === null) {
      return;
    }
    clearRunReceipt();
    try {
      mutationReceipt = await client.distribution.createPayee(
        {
          workspaceId: distributionWorkspaceId,
          id: null,
          displayName,
          email: payeeEmailInput.trim() || null,
          status: "active",
          defaultCurrency
        },
        { idempotencyKey: createIdempotencyKey("payee-create") }
      );
      mutationReceiptPageId = activePageId;
      closePayeePanel();
      await Promise.all([loadPayees(), loadContracts(), loadAuditLog()]);
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

  // Guardrail: this UI path currently submits a one-line ruleset, so only
  // allow an explicit 100% replacement for one payee.
  function normalizeSingleRuleReplacementPercentage(value: string): string | null {
    const match = /^(\d+)(?:[.,](\d{1,6}))?$/u.exec(value.trim());

    if (match === null || match[1] === undefined) {
      return null;
    }

    const units = BigInt(match[1]) * 1_000_000n + BigInt((match[2] ?? "").padEnd(6, "0"));

    if (units !== 100_000_000n) {
      return null;
    }

    return "100.000000";
  }

  function resolveExpenseContractFilterId(contractItems: readonly DistributionContract[], currentContractId: string): string {
    if (currentContractId !== "" && contractItems.some((contract: DistributionContract): boolean => contract.id === currentContractId)) {
      return currentContractId;
    }

    return contractItems[0]?.id ?? "";
  }

  function emptyPageResult<TItem>(): PageResult<TItem> {
    return {
      items: [],
      nextCursor: null
    };
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
      await Promise.all([loadContracts(), loadRevenue(), loadReconciliation()]);
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
    expenseContractFilterId = rowId;
    void loadExpenses();
  }

  function closeContractRulePanel(): void {
    ruleContractId = null;
    rulePayeeIdInput = "";
    rulePercentageInput = "";
  }

  async function addContractRule(): Promise<void> {
    const contract = selectedRuleContract;
    const percentage = ruleReplacementPercentage;

    if (contract === null || rulePayeeIdInput === "" || percentage === null) {
      if (rulePercentageInput.trim() !== "" && percentage === null) {
        reportActionError(new Error("This action replaces the full rule set and currently accepts only 100.000000."));
      }
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
      await Promise.all([loadContracts(), loadRevenue(), loadReconciliation()]);
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
      await Promise.all([loadAllocationRuns(), loadStatements(), loadPayments(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
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
      await Promise.all([loadAllocationRuns(), loadStatements(), loadPayments(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
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
      return { ready: false, targetId: null, hint: "Select the target track first." };
    }

    if (resolution === "map_to_track") {
      return { ready: true, targetId: track.id, hint: "" };
    }

    if (track.releaseId === null) {
      return { ready: false, targetId: null, hint: "This track has no release; select a track linked to a release." };
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
      await Promise.all([loadSuspense(), loadReconciliation(), loadAuditLog()]);
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
      await Promise.all([loadStatements(), loadPayments(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
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

      // Revoke the blob URL after printing/navigation to avoid leaking object URLs.
      const cleanupUrl = (): void => {
        URL.revokeObjectURL(url);
        printWindow.removeEventListener("afterprint", cleanupUrl);
        printWindow.removeEventListener("beforeunload", cleanupUrl);
      };
      printWindow.addEventListener("afterprint", cleanupUrl);
      printWindow.addEventListener("beforeunload", cleanupUrl);
      window.setTimeout(cleanupUrl, 60_000);
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
  body { font-family: var(--ehq-font, "Inter", "Segoe UI", sans-serif); color: var(--ehq-text, CanvasText); background: var(--ehq-bg-main, Canvas); margin: 0; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid var(--ehq-workspace-distribution, currentColor); padding-bottom: 8px; }
  h1 { font-size: var(--ehq-type-section-title-size, 18px); margin: 16px 0 4px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; margin: 16px 0; font-size: var(--ehq-type-caption-size, 12px); }
  dt { font-weight: 700; }
  dd { margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: var(--ehq-type-caption-size, 12px); }
  th, td { border-bottom: 1px solid var(--ehq-border, color-mix(in srgb, CanvasText 20%, Canvas)); padding: 6px 8px; text-align: left; }
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
  // Use integer arithmetic to avoid float precision drift on large amounts.
  function formatPrintAmount(value: string, currency: CurrencyCode): string {
    const negative = value.startsWith("-");
    const abs = negative ? value.slice(1) : value;
    const dotIdx = abs.indexOf(".");
    const intStr = dotIdx === -1 ? abs : abs.slice(0, dotIdx);
    const fracStr = dotIdx === -1 ? "" : abs.slice(dotIdx + 1);
    const padded = fracStr.padEnd(10, "0").slice(0, 10);
    const micro = BigInt(intStr) * 10_000_000_000n + BigInt(padded);
    // Round half-up to 2 decimal places (divide scale-10 by 10^8).
    const cents = (micro + 50_000_000n) / 100_000_000n;
    const wholePart = cents / 100n;
    const centPart = String(cents % 100n).padStart(2, "0");
    return `${negative ? "-" : ""}${currency} ${String(wholePart)}.${centPart}`;
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
    paymentReferenceInput = mode === "void" ? "" : payment.reference ?? "";
    paymentNotesInput = payment.notes ?? "";
    paymentMethodInput = payment.method;
    paymentStatusInput = payment.status === "draft" ? "draft" : "paid";
    paymentPaidDateInput = payment.paidAt?.slice(0, 10) ?? today;
    paymentExchangeRateInput = payment.exchangeRate ?? "";
    paymentReconcileStatementId = "";
    paymentReconcileAmountInput = payment.amountMicro;
  }

  function closePaymentPanel(): void {
    selectedPaymentId = null;
    paymentPanelMode = null;
    paymentReferenceInput = "";
    paymentNotesInput = "";
    paymentReconcileStatementId = "";
    paymentReconcileAmountInput = "";
  }

  async function recordPayment(): Promise<void> {
    const amountMicro = recordPaymentAmountMicro;
    const currency = normalizeCurrencyCode(recordPaymentCurrency);

    if (
      recordPaymentPayeeId === "" ||
      amountMicro === null ||
      currency === null ||
      (recordPaymentExchangeRate.trim() !== "" && recordPaymentExchangeRateNormalized === null) ||
      (recordPaymentStatus === "paid" && recordPaymentPaidDate === "")
    ) {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.recordPayment(
        {
          workspaceId: distributionWorkspaceId,
          statementId: recordStatement?.id ?? null,
          payeeId: recordPaymentPayeeId,
          amountMicro,
          currency,
          exchangeRate: recordPaymentExchangeRateNormalized,
          method: recordPaymentMethod,
          status: recordPaymentStatus,
          paidAt: recordPaymentStatus === "paid" ? `${recordPaymentPaidDate}T00:00:00.000Z` : null,
          reference: recordPaymentReference.trim() || null,
          notes: recordPaymentNotes.trim() || null
        },
        {
          idempotencyKey: createIdempotencyKey("payment-record")
        }
      );
      mutationReceiptPageId = activePageId;
      recordStatementId = "";
      recordPaymentPayeeId = "";
      recordPaymentAmount = "";
      recordPaymentCurrency = "MUR";
      recordPaymentExchangeRate = "";
      recordPaymentMethod = "bank_transfer";
      recordPaymentStatus = "paid";
      recordPaymentPaidDate = today;
      recordPaymentReference = "";
      recordPaymentNotes = "";
      await Promise.all([loadPayments(), loadStatements(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function editPayment(): Promise<void> {
    const payment = selectedPayment;
    if (
      payment === null ||
      (paymentExchangeRateInput.trim() !== "" && paymentExchangeRateNormalized === null) ||
      (paymentStatusInput === "paid" && paymentPaidDateInput === "")
    ) {
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
          exchangeRate: paymentExchangeRateNormalized,
          method: paymentMethodInput,
          status: paymentStatusInput,
          paidAt: paymentStatusInput === "paid" ? `${paymentPaidDateInput}T00:00:00.000Z` : null,
          reference: paymentReferenceInput.trim() || null,
          notes: paymentNotesInput.trim() || null
        },
        {
          idempotencyKey: createIdempotencyKey("payment-edit")
        }
      );
      mutationReceiptPageId = activePageId;
      closePaymentPanel();
      await Promise.all([loadPayments(), loadStatements(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function reconcilePayment(): Promise<void> {
    const payment = selectedPayment;
    const amountAppliedMicro = paymentReconcileAmountMicro;

    if (payment === null || paymentReconcileStatementId === "" || amountAppliedMicro === null) {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.reconcilePayment(
        payment.id,
        {
          workspaceId: distributionWorkspaceId,
          statementId: paymentReconcileStatementId,
          amountAppliedMicro,
          reconciledAt: new Date().toISOString()
        },
        {
          idempotencyKey: createIdempotencyKey("payment-reconcile")
        }
      );
      mutationReceiptPageId = activePageId;
      closePaymentPanel();
      await Promise.all([loadPayments(), loadStatements(), loadReconciliation(), loadAuditLog()]);
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
      await Promise.all([loadPayments(), loadStatements(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  async function runReconciliationAction(action: DistributionReconciliationAction): Promise<void> {
    clearActionReceipts();

    if (action.maintenance) {
      try {
        mutationReceipt = await client.distribution.runFinancialReconciliationAction(
          action.id,
          {
            workspaceId: distributionWorkspaceId,
            reason: `Triggered from Distribution reconciliation panel: ${action.id}`
          },
          { idempotencyKey: createIdempotencyKey(`recon-action-${action.id}`) }
        );
        mutationReceiptPageId = activePageId;
        await Promise.all([loadReconciliation(), loadAuditLog()]);
      } catch (error: unknown) {
        reportActionError(error);
      }
      return;
    }

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
            exchangeRate: null,
            method: "bank_transfer",
            status: "paid",
            paidAt: new Date().toISOString(),
            reference: "DISTRIBUTION-RECON-LINK",
            notes: "Created from the Distribution statement reconciliation queue."
          },
          { idempotencyKey: createIdempotencyKey("recon-link-payment") }
        );
        mutationReceiptPageId = activePageId;
        await Promise.all([loadPayments(), loadStatements(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
      } catch (error: unknown) {
        reportActionError(error);
      }
      return;
    }

    if (action.id === "recompute-payee-balance") {
      reportActionError(new Error("Recompute payee balance is disabled until a dedicated endpoint is available."));
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
        await Promise.all([loadStatements(), loadPayments(), loadRevenue(), loadReconciliation(), loadAuditLog()]);
      } catch (error: unknown) {
        reportActionError(error);
      }
    }
  }

  function openAliasCreatePanel(): void {
    aliasEditorId = null;
    aliasTextInput = "";
    aliasTargetTypeInput = "unassigned";
    aliasTargetIdInput = "";
  }

  function openAliasEditor(aliasId: string): void {
    const alias = aliases.find((candidate: DistributionAlias): boolean => candidate.id === aliasId);

    if (alias === undefined) {
      return;
    }

    aliasEditorId = alias.id;
    aliasTextInput = alias.aliasText;
    aliasTargetTypeInput = alias.targetType;
    aliasTargetIdInput = alias.targetId ?? "";
  }

  function closeAliasEditor(): void {
    aliasEditorId = null;
    aliasTextInput = "";
    aliasTargetTypeInput = "unassigned";
    aliasTargetIdInput = "";
  }

  function updateAliasTextInput(value: string): void {
    aliasTextInput = value;
  }

  function updateAliasTargetType(value: string): void {
    aliasTargetTypeInput = value as DistributionAliasTargetType;
    aliasTargetIdInput = "";
  }

  function updateAliasTargetId(value: string): void {
    aliasTargetIdInput = value;
  }

  async function saveAlias(): Promise<void> {
    if (!aliasFormValid) {
      return;
    }

    const normalizedAliasText = aliasTextInput.trim();
    const normalizedTargetId = aliasTargetTypeInput === "unassigned" ? null : aliasTargetIdInput.trim();
    clearRunReceipt();

    try {
      if (aliasEditorId === null) {
        mutationReceipt = await client.distribution.createAlias(
          {
            workspaceId: distributionWorkspaceId,
            aliasText: normalizedAliasText,
            targetType: aliasTargetTypeInput,
            targetId: normalizedTargetId
          },
          {
            idempotencyKey: createIdempotencyKey("alias-create")
          }
        );
      } else {
        mutationReceipt = await client.distribution.updateAlias(
          aliasEditorId,
          {
            workspaceId: distributionWorkspaceId,
            aliasText: normalizedAliasText,
            targetType: aliasTargetTypeInput,
            targetId: normalizedTargetId
          },
          {
            idempotencyKey: createIdempotencyKey("alias-update")
          }
        );
      }

      mutationReceiptPageId = activePageId;
      closeAliasEditor();
      await Promise.all([loadAliases(), loadDuplicates(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
    }
  }

  function openDuplicateMerge(duplicateId: string): void {
    const duplicate = duplicates.find((candidate: DistributionDuplicate): boolean => candidate.id === duplicateId);

    if (duplicate === undefined) {
      return;
    }

    duplicateEditorId = duplicate.id;
    duplicateMasterId = duplicate.sampleIds[0] ?? "";
  }

  function closeDuplicateMerge(): void {
    duplicateEditorId = null;
    duplicateMasterId = "";
  }

  function updateDuplicateMaster(value: string): void {
    duplicateMasterId = value;
  }

  function createDuplicateMasterOptions(
    items: readonly DistributionDuplicate[],
    duplicateId: string | null
  ): readonly SelectOption[] {
    const duplicate = items.find((candidate: DistributionDuplicate): boolean => candidate.id === duplicateId);

    if (duplicate === undefined) {
      return [{ label: "Select a master", value: "" }];
    }

    return duplicate.sampleIds.map((sampleId: string, index: number): SelectOption => ({
      label: duplicate.sampleLabels[index] ?? sampleId,
      value: sampleId
    }));
  }

  async function mergeDuplicate(): Promise<void> {
    if (duplicateEditorId === null || duplicateMasterId === "") {
      return;
    }

    clearRunReceipt();

    try {
      mutationReceipt = await client.distribution.resolveDuplicate(
        duplicateEditorId,
        {
          workspaceId: distributionWorkspaceId,
          keepEarningId: duplicateMasterId,
          reason: "Operator duplicate resolution from Distribution UI"
        },
        {
          idempotencyKey: createIdempotencyKey(`duplicate-resolve-${duplicateEditorId}`)
        }
      );
      mutationReceiptPageId = activePageId;
      closeDuplicateMerge();
      await Promise.all([loadDuplicates(), loadReconciliation(), loadAuditLog()]);
    } catch (error: unknown) {
      reportActionError(error);
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
        { label: "Imported revenue", value: "—", detail: stateLabel(state), tone: "muted", accent: true },
        { label: "Paid royalties", value: "—", detail: "backend totals", tone: "muted", accent: false },
        { label: "Open recoupments", value: "—", detail: "contract balances", tone: "muted", accent: false },
        { label: "Contract coverage", value: "—", detail: "earning tracks", tone: "muted", accent: false }
      ];
    }

    return [
      {
        label: "Imported revenue",
        value: dashboardCurrencyTotalsValue(state.data.importedRevenue),
        detail: "normalized imports",
        tone: "info",
        accent: true
      },
      { label: "Paid royalties", value: dashboardCurrencyTotalsValue(state.data.paidRoyalties), detail: "recorded payments", tone: "success", accent: false },
      { label: "Open recoupments", value: dashboardCurrencyTotalsValue(state.data.openRecoupments), detail: "open by currency", tone: "warning", accent: false },
      { label: "Contract coverage", value: `${String(state.data.contractCoverage.covered)}/${String(state.data.contractCoverage.total)}`, detail: "earning tracks covered", tone: state.data.contractCoverage.covered === state.data.contractCoverage.total ? "success" : "warning", accent: false }
    ];
  }

  function dashboardCurrencyTotalsValue(totals: readonly { readonly currency: CurrencyCode; readonly amountMicro: string }[]): string {
    if (totals.length === 0) {
      return "—";
    }

    return totals.map((total): string => formatMoney(total.amountMicro, total.currency)).join(" · ");
  }

  function createDashboardReadinessRows(state: ApiRequestState<DistributionDashboardResponse>): readonly TableRow[] {
    if (state.status !== "success") {
      return [];
    }

    return state.data.readiness.map((item: DistributionDashboardReadinessItem): TableRow => ({
      id: item.id,
      cells: [
        { kind: "text", value: item.label, strong: true },
        { kind: "badge", value: item.status, tone: item.status === "clear" ? "success" : item.status === "review" ? "warning" : "error" },
        { kind: "text", value: String(item.count), strong: false },
        { kind: "text", value: item.detail, strong: false }
      ]
    }));
  }

  function createDashboardTopRows(
    state: ApiRequestState<DistributionDashboardResponse>,
    group: "artists" | "tracks" | "stores"
  ): readonly TableRow[] {
    if (state.status !== "success") {
      return [];
    }

    const items: readonly DistributionDashboardTopRoyalty[] = group === "artists"
      ? state.data.topArtists
      : group === "tracks"
        ? state.data.topTracks
        : state.data.topStores;

    return items.map((item: DistributionDashboardTopRoyalty): TableRow => ({
      id: item.id,
      cells: [
        { kind: "text", value: item.label, strong: true },
        { kind: "text", value: item.secondaryLabel, strong: false },
        { kind: "money", value: formatMoney(item.amountMicro, item.currency), tone: "success" }
      ]
    }));
  }

  function dashboardReadinessCount(
    state: ApiRequestState<DistributionDashboardResponse>,
    itemId: string
  ): number | null {
    if (state.status !== "success") {
      return null;
    }

    return state.data.readiness.find((item: DistributionDashboardReadinessItem): boolean => item.id === itemId)?.count ?? 0;
  }

  // Client-side CSV export keeps Distribution revenue extractable without adding
  // a backend endpoint.
  function downloadCsv(filename: string, header: readonly string[], rows: readonly (readonly string[])[]): void {
    const escapeCell = (value: string): string => (/[",\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
    const content = [header, ...rows].map((cells: readonly string[]): string => cells.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportRevenueCsv(): void {
    const rows = revenueRows.map((row: DistributionRevenueRow): readonly string[] => [
      row.label,
      row.grossMicro,
      row.netMicro,
      row.payableMicro,
      row.currency,
      String(row.barLevel)
    ]);
    downloadCsv(
      `distribution-revenue-${revenueGroupBy}-${distributionPeriod}.csv`,
      ["Group", "Gross", "Net", "Payable", "Currency", "Bar level"],
      rows
    );
  }

  function exportSuspenseCsv(): void {
    const rows = suspenseItems.map((item: SuspenseItem): readonly string[] => [
      item.sourceReference,
      suspenseReason(item.reason),
      item.exactFixPath,
      item.status,
      item.currency,
      item.amountMicro,
      item.period
    ]);
    downloadCsv(
      `distribution-suspense-${suspenseStatusFilter}-${distributionPeriod}.csv`,
      ["Source", "Reason", "Fix path", "Status", "Currency", "Amount", "Period"],
      rows
    );
  }

  function exportPaymentsCsv(): void {
    const rows = payments.map((payment: PaymentSummary): readonly string[] => [
      payment.id,
      payment.payeeName,
      payment.amountMicro,
      payment.currency,
      payment.exchangeRate ?? "",
      payment.method,
      payment.reference ?? "",
      payment.status,
      payment.paidAt ?? "",
      payment.linkedStatementIds.join(" | "),
      payment.notes ?? ""
    ]);
    downloadCsv(
      `distribution-payments-${paymentStatusFilter}-${distributionPeriod}.csv`,
      ["Payment ID", "Payee", "Amount", "Currency", "FX rate", "Method", "Reference", "Status", "Paid at", "Linked statements", "Notes"],
      rows
    );
  }

  function openDashboardReadiness(rowId: string): void {
    const item = dashboardState.status === "success"
      ? dashboardState.data.readiness.find((candidate: DistributionDashboardReadinessItem): boolean => candidate.id === rowId)
      : undefined;

    if (item !== undefined) {
      selectPage(item.actionPage);
    }
  }

  function reviewCatalogRow(rowId: string): void {
    const track = tracks.find((candidate: TrackSummary): boolean => candidate.id === rowId);

    if (track === undefined || track.splitStatus !== "needs_review") {
      return;
    }

    selectPage("mapping");
  }

  function createImportRows(items: readonly DistributionImportBatch[]): readonly TableRow[] {
    return items.map((batch: DistributionImportBatch): TableRow => ({
      id: batch.id,
      cells: [
        { kind: "text", value: batch.id, strong: false },
        { kind: "badge", value: batch.source, tone: batch.source === "kontor" ? "active" : "info" },
        { kind: "text", value: batch.fileName, strong: true },
        { kind: "badge", value: batch.status, tone: distributionImportStatusTone(batch.status) },
        { kind: "text", value: String(batch.rowCount), strong: false },
        { kind: "text", value: String(batch.normalizedRowCount), strong: false },
        { kind: "money", value: formatMoney(batch.grossMicro, batch.currency), tone: "success" },
        { kind: "text", value: String(batch.issueCount), strong: false },
        { kind: "text", value: String(batch.skippedRowCount), strong: false },
        { kind: "badge", value: batch.currency, tone: "muted" },
        { kind: "text", value: formatDateOnly(batch.importedAt), strong: false }
      ]
    }));
  }

  function createMappingRows(items: readonly DistributionMappingRow[], selectedIds: readonly string[]): readonly TableRow[] {
    return items.map((row: DistributionMappingRow): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.sourceTitle, strong: true },
        { kind: "text", value: row.sourceArtist, strong: false },
        { kind: "text", value: row.sourceLabel || "—", strong: false },
        { kind: "text", value: row.sourceStore, strong: false },
        { kind: "text", value: row.sourceIsrc ?? row.sourceUpc ?? "missing", strong: false },
        { kind: "money", value: formatMoney(row.grossMicro, row.currency), tone: moneyTone(row.grossMicro) },
        { kind: "text", value: row.suggestedTrackTitle ?? "manual track required", strong: false },
        { kind: "badge", value: formatConfidence(row.confidenceBp), tone: confidenceTone(row.confidenceBp) },
        { kind: "badge", value: row.exactFixPath, tone: "active" },
        { kind: "badge", value: selectedIds.includes(row.id) ? "selected" : "—", tone: selectedIds.includes(row.id) ? "success" : "muted" }
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
        { kind: "badge", value: track.splitStatus === "balanced" ? "balanced" : track.splitStatus, tone: track.splitStatus === "balanced" ? "success" : "warning" }
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

  function createContractKpis(
    items: readonly DistributionContract[],
    trackItems: readonly TrackSummary[]
  ): readonly DistributionKpi[] {
    const openRecoupments = items.filter((contract: DistributionContract): boolean => contract.openExpenseMicro !== "0.0000000000");
    const unbalancedTrackCount = trackItems.filter((track: TrackSummary): boolean => track.splitStatus !== "balanced").length;

    return [
      { label: "Active contracts", value: String(items.filter((contract: DistributionContract): boolean => contract.status === "active").length), detail: "contracts", tone: "success", accent: true },
      { label: "Open recoupments", value: String(openRecoupments.length), detail: "contract balances", tone: "warning", accent: false },
      { label: "Unbalanced splits", value: String(unbalancedTrackCount), detail: "catalog review", tone: unbalancedTrackCount === 0 ? "success" : "warning", accent: false }
    ];
  }

  function createPayeeRows(items: readonly PayeeSummary[]): readonly TableRow[] {
    return items.map((payee): TableRow => ({
      id: payee.id,
      cells: [
        { kind: "text", value: payee.displayName, strong: true },
        { kind: "text", value: payee.email ?? "—", strong: false },
        { kind: "badge", value: payee.defaultCurrency, tone: "muted" },
        { kind: "badge", value: payee.status, tone: payee.status === "active" ? "success" : "muted" }
      ]
    }));
  }

  function createRevenueKpis(
    rows: readonly DistributionRevenueRow[],
    paymentItems: readonly PaymentSummary[],
    suspense: readonly SuspenseItem[]
  ): readonly DistributionKpi[] {
    return [
      { label: "Gross", value: currencyTotalsLabel(rows, (row) => row.grossMicro, (row) => row.currency), detail: "allocated revenue view", tone: "info", accent: true },
      { label: "Allocated / payable", value: currencyTotalsLabel(rows, (row) => row.payableMicro, (row) => row.currency), detail: "after recoupment", tone: "active", accent: false },
      { label: "Paid", value: currencyTotalsLabel(paymentItems.filter((payment) => payment.status === "paid"), (payment) => payment.amountMicro, (payment) => payment.currency), detail: "Distribution ledger", tone: "success", accent: false },
      { label: "Suspense", value: currencyTotalsLabel(suspense.filter((item) => item.status === "open"), (item) => item.amountMicro, (item) => item.currency), detail: "awaiting resolution", tone: "warning", accent: false }
    ];
  }

  function currencyTotalsLabel<T>(
    items: readonly T[],
    amount: (item: T) => string,
    currency: (item: T) => CurrencyCode
  ): string {
    const totals = new Map<CurrencyCode, bigint>();
    for (const item of items) {
      const code = currency(item);
      totals.set(code, (totals.get(code) ?? 0n) + parseScale10Units(amount(item)));
    }
    if (totals.size === 0) {
      return "—";
    }
    return [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, units]) => formatMoney(formatScale10Units(units), code))
      .join(" · ");
  }

  function parseScale10Units(value: string): bigint {
    const match = /^(-?)(\d+)(?:\.(\d{1,10}))?$/u.exec(value.trim());
    if (match === null || match[2] === undefined) {
      return 0n;
    }
    const units = BigInt(match[2]) * 10_000_000_000n + BigInt((match[3] ?? "").padEnd(10, "0"));
    return match[1] === "-" ? -units : units;
  }

  function formatScale10Units(units: bigint): string {
    const negative = units < 0n;
    const absolute = negative ? -units : units;
    return `${negative ? "-" : ""}${String(absolute / 10_000_000_000n)}.${String(absolute % 10_000_000_000n).padStart(10, "0")}`;
  }

  function createExpenseRows(items: readonly DistributionContractExpense[]): readonly TableRow[] {
    return items.map((expense: DistributionContractExpense): TableRow => ({
      id: expense.id,
      cells: [
        { kind: "badge", value: expense.category, tone: "muted" },
        { kind: "text", value: expense.payeeId === null ? "Shared" : payeeName(expense.payeeId, payees), strong: false },
        { kind: "text", value: expense.label, strong: true },
        { kind: "text", value: formatDateOnly(expense.incurredOn), strong: false },
        { kind: "money", value: formatMoney(expense.originalAmountMicro, expense.currency), tone: "info" },
        { kind: "money", value: formatMoney(expense.openAmountMicro, expense.currency), tone: moneyTone(expense.openAmountMicro) },
        { kind: "badge", value: expense.recoverable ? "yes" : "no", tone: expense.recoverable ? "active" : "muted" },
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
        { kind: "money", value: formatMoney(statement.paidMicro, statement.currency), tone: "success" },
        { kind: "money", value: formatMoney(statement.netPayableMicro, statement.currency), tone: "active" },
        { kind: "text", value: formatDateRange(statement.period_start, statement.period_end), strong: false },
        { kind: "badge", value: statement.status, tone: statement.status === "paid" ? "success" : "warning" }
      ]
    }));
  }

  function normalizePaymentSummary(payment: PaymentSummary): PaymentSummary {
    const rolloutPayment = payment as PaymentSummary & {
      readonly linkedStatementIds?: readonly string[];
      readonly exchangeRate?: string | null;
      readonly method?: DistributionPaymentMethod;
      readonly notes?: string | null;
    };
    const linkedStatementIds = rolloutPayment.linkedStatementIds
      ?? (payment.statementId === null ? [] : [payment.statementId]);

    return {
      ...payment,
      linkedStatementIds,
      exchangeRate: rolloutPayment.exchangeRate ?? null,
      method: rolloutPayment.method ?? "bank_transfer",
      notes: rolloutPayment.notes ?? null
    };
  }

  function createPaymentRows(items: readonly PaymentSummary[]): readonly TableRow[] {
    return items.map((payment: PaymentSummary): TableRow => ({
      id: payment.id,
      cells: [
        { kind: "text", value: payment.id, strong: false },
        { kind: "text", value: payment.payeeName, strong: true },
        { kind: "money", value: formatMoney(payment.amountMicro, payment.currency), tone: moneyTone(payment.amountMicro) },
        { kind: "badge", value: payment.currency, tone: "muted" },
        { kind: "text", value: payment.exchangeRate ?? "—", strong: false },
        { kind: "text", value: payment.method.replaceAll("_", " "), strong: false },
        { kind: "text", value: payment.reference ?? "missing", strong: false },
        { kind: "badge", value: payment.status, tone: payment.status === "paid" ? "success" : "warning" },
        { kind: "text", value: payment.paidAt === null ? "unpaid" : formatDateOnly(payment.paidAt), strong: false },
        { kind: "text", value: String(payment.linkedStatementIds.length), strong: false }
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

  function createAliasTargetOptions(
    targetType: DistributionAliasTargetType,
    payeeItems: readonly PayeeSummary[],
    releaseItems: readonly ReleaseSummary[],
    trackItems: readonly TrackSummary[]
  ): readonly SelectOption[] {
    if (targetType === "payee") {
      return sortOptionsAlphabetically([
        { label: "Select a payee", value: "" },
        ...payeeItems.map((payee: PayeeSummary): SelectOption => ({ label: `${payee.displayName} · ${payee.defaultCurrency}`, value: payee.id }))
      ], 1);
    }

    if (targetType === "release") {
      return sortOptionsAlphabetically([
        { label: "Select a release", value: "" },
        ...releaseItems.map((release: ReleaseSummary): SelectOption => ({ label: `${release.title} · ${release.artistName}`, value: release.id }))
      ], 1);
    }

    if (targetType === "track") {
      return sortOptionsAlphabetically([
        { label: "Select a track", value: "" },
        ...trackItems.map((track: TrackSummary): SelectOption => ({ label: `${track.title} · ${track.artistName}`, value: track.id }))
      ], 1);
    }

    return [{ label: "No selection", value: "" }];
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

  function createFxRateRows(items: readonly DistributionFxRate[]): readonly TableRow[] {
    const sorted = [...items].sort((left: DistributionFxRate, right: DistributionFxRate): number => {
      if (left.effectiveDate !== right.effectiveDate) {
        return right.effectiveDate.localeCompare(left.effectiveDate);
      }

      if (left.fromCurrency !== right.fromCurrency) {
        return left.fromCurrency.localeCompare(right.fromCurrency);
      }

      return left.toCurrency.localeCompare(right.toCurrency);
    });

    return sorted.map((rate: DistributionFxRate, index: number): TableRow => ({
      id: `${rate.fromCurrency}-${rate.toCurrency}-${rate.effectiveDate}-${String(index)}`,
      cells: [
        { kind: "badge", value: rate.fromCurrency, tone: "muted" },
        { kind: "badge", value: rate.toCurrency, tone: "muted" },
        { kind: "text", value: rate.effectiveDate, strong: false },
        { kind: "text", value: rate.rate, strong: true }
      ]
    }));
  }

  function isLoadingStatus(status: RequestStatus): boolean {
    return isRequestStatusLoading(status);
  }

  function normalizeCurrencyCode(value: string): CurrencyCode | null {
    const normalized = value.trim().toUpperCase();
    return /^[A-Z]{3}$/u.test(normalized) ? normalized : null;
  }

  function toNullableCurrency(value: CurrencyCode | "all"): CurrencyCode | null {
    return value === allValue ? null : value;
  }

  function toNullablePayeeFilter(value: string): string | null {
    return value === allValue || value.trim() === "" ? null : value;
  }

  function toNullableStoreFilter(value: string): string | null {
    return value === allValue || value.trim() === "" ? null : value;
  }

  function normalizeIsoDate(value: string): string | null {
    const normalized = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/u.test(normalized) ? normalized : null;
  }

  function normalizeFxRateValue(value: string): string | null {
    const normalized = value.trim().replace(/,/gu, ".");

    if (!/^\d+(?:\.\d{1,10})?$/u.test(normalized)) {
      return null;
    }

    if (/^0(?:\.0+)?$/u.test(normalized)) {
      return null;
    }

    return normalized;
  }

  function tableStateFor(status: RequestStatus, count: number): "loading" | "error" | "empty" | "default" {
    if (isLoadingStatus(status)) {
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
      { label: "Source", value: state.source, active: true, disabled: false, actionId: "source", title: "Change import source" },
      { label: "File", value: state.fileName === "" ? "no file selected" : state.fileName, active: false, disabled: false, actionId: "file", title: "Clear selected file" },
      { label: "Status", value: state.status, active: false, disabled: false, actionId: "status", title: "Run preview" }
    ];
  }

  function toNullableImportSource(value: ImportSourceFilter): "kontor" | "routenote" | null {
    if (value === "kontor" || value === "routenote") {
      return value;
    }

    return null;
  }

  function toNullableImportBatchStatus(
    value: ImportBatchStatusFilter
  ): "uploaded" | "mapped" | "validated" | "failed" | "voided" | null {
    if (value === "uploaded" || value === "mapped" || value === "validated" || value === "failed" || value === "voided") {
      return value;
    }

    return null;
  }

  function toNullableBatchFilter(value: string): string | null {
    if (value === allValue || value.trim() === "") {
      return null;
    }

    return value;
  }

  function toNullableCatalogStatus(value: CatalogStatusFilter): "draft" | "released" | "archived" | null {
    if (value === "draft" || value === "released" || value === "archived") {
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

  function toNullablePaymentStatus(value: PaymentStatusFilter): "draft" | "paid" | "voided" | null {
    if (value === "draft" || value === "paid" || value === "voided") {
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
    return formatMoney(amountMicro, "EUR");
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
      return "Import retry required";
    }

    return "Contract on hold";
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
      pageId === "statements" ||
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
  statusValue={writesEnabled ? "write access enabled" : "read-only"}
  userInitial={session.initials}
  userName={session.displayName}
  userContext={session.roleLabel}
  signOutHref="#"
  onNavigate={handleShellNavigate}
  onSignOut={onLogout}
>
  <div class={`content distribution-page-${activePageId}`}>
      <PageHeader
        workspace="distribution"
        eyebrow="Distribution"
        title={activePage.title}
        description={activePage.subtitle}
        meta=""
        statusLabel=""
        statusTone="muted"
      />

      <section class="distribution-workflow-hero ehq-edge-surface" aria-label="Upload, exceptions, approval">
        <div class="distribution-workflow-heading">
          <p>Distribution</p>
          <h2>Upload, exceptions, approval</h2>
          <span>Move from distributor file delivery to sign-off while keeping financial controls in the backend.</span>
        </div>
        <div class="distribution-workflow-steps">
          <article>
            <span>Upload</span>
            <strong>Upload</strong>
            <small>Bring in the distributor file.</small>
          </article>
          <article>
            <span>Map exceptions</span>
            <strong>Map exceptions</strong>
            <small>{dashboardMappingBlockerCount === null ? "Loading mapping queue." : `${String(dashboardMappingBlockerCount)} rows still need catalog mapping.`}</small>
          </article>
          <article>
            <span>Stand by</span>
            <strong>Stand by</strong>
            <small>Approvals open once the queue is clean.</small>
          </article>
        </div>
      </section>

      {#if periodControlVisible}
        <section class="period-control ehq-edge-surface" aria-label="Period controls">
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
        <Alert tone="success" title="Action accepted" message="Audit recorded." dismissible={false} />
      {/if}

      {#if runReceipt !== null && runReceiptPageId === activePageId}
        <Alert tone="info" title="Run scheduled" message="Lock held by the workflow." dismissible={false} />
      {/if}

      {#if actionError !== null && actionErrorPageId === activePageId}
        <Alert tone="error" title="Error" message={actionError} dismissible={false} />
      {/if}

      {#if activePageId === "dashboard"}
        <section class="kpi-grid" aria-label="KPI Distribution">
          {#each dashboardKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingStatus(dashboardState.status) ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>
        <section class="dashboard-grid">
          <BarsChart title="Revenue by source" points={revenueChartPoints} tone="active" />
          <Table title="Distribution readiness" columns={dashboardReadinessColumns} rows={dashboardReadinessRows} state={tableStateFor(dashboardState.status, dashboardReadinessRows.length)} actionLabel="" rowActions={dashboardReadinessRowActions} />
        </section>
        <section class="dashboard-top-grid">
          <Table title="Top artists" columns={dashboardTopColumns} rows={dashboardArtistRows} state={tableStateFor(dashboardState.status, dashboardArtistRows.length)} actionLabel="" />
          <Table title="Top tracks" columns={dashboardTopColumns} rows={dashboardTrackRows} state={tableStateFor(dashboardState.status, dashboardTrackRows.length)} actionLabel="" />
          <Table title="Top stores" columns={dashboardTopColumns} rows={dashboardStoreRows} state={tableStateFor(dashboardState.status, dashboardStoreRows.length)} actionLabel="" />
        </section>
      {:else if activePageId === "imports"}
        <Toolbar label="Import Kontor RouteNote" filters={importToolbarFilters} actionLabel="" loading={isLoadingStatus(importState.status)} onFilterSelect={selectImportToolbarFilter} />
        <section class="dashboard-grid import-parity-grid" aria-label="Import workflow">
          <section class="command-card ehq-edge-surface">
            <SectionTemplate
              eyebrow="upload"
              title="Upload capacity"
              detail="The API accepts one or more distributor exports and processes each confirmed file as an auditable import batch."
              state="ready"
            >
              <p>Preview and validation run before any import write.</p>
            </SectionTemplate>
          </section>
          <section class="command-card ehq-edge-surface">
            <SectionTemplate
              eyebrow="assistant"
              title="Import assistant"
              detail="Review parser output, catalog mapping, payee and split readiness, and FX requirements before confirmation."
              state="ready"
            >
              <Button label="Open assistant" variant="secondary" size="medium" type="button" disabled={!canOpenImportAssistant} loading={false} locked={false} focus={false} ariaLabel="Open import assistant" title={canOpenImportAssistant ? "" : "Run the preflight assistant first"} onclick={openImportAssistant} />
            </SectionTemplate>
          </section>
        </section>
        <section class="form-panel ehq-edge-surface" aria-label="Import Kontor RouteNote">
          <Select id="distribution-import-source" label="Source" value={importState.source} options={importSourceOptions} state="default" message="" onchange={updateImportSource} />
          <label>
            <span>Export file</span>
            <input type="file" accept="text/csv,.csv,.tsv,text/tab-separated-values" bind:this={importFileInput} onchange={handleImportFile} />
          </label>
          <Button label="Import files" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Import files" title="Choose an export file" onclick={openImportFilePicker} />
          <Button label="Preflight assistant" variant="secondary" size="medium" type="button" disabled={!canPreviewImport} loading={false} locked={false} focus={false} ariaLabel="Preflight assistant" title={canPreviewImport ? "" : "Select a CSV/TSV export file first"} onclick={previewImport} />
          <Button label="Open assistant" variant="secondary" size="medium" type="button" disabled={!canOpenImportAssistant} loading={false} locked={false} focus={false} ariaLabel="Open assistant" title={canOpenImportAssistant ? "" : "Run the preflight assistant first"} onclick={openImportAssistant} />
          <Button label="Confirm import" variant="primary" size="medium" type="button" disabled={!canConfirmImport || !writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Confirm import" title={writeDisabledTitle()} onclick={confirmImport} />
        </section>
        <section class="filter-strip ehq-edge-surface" aria-label="Import filters">
          <Select id="distribution-import-filter" label="Source filter" value={importSourceFilter} options={importFilterOptions} state="default" message="" onchange={updateImportFilter} />
          <Select id="distribution-import-status" label="Status filter" value={importStatusFilter} options={importStatusFilterOptions} state="default" message="" onchange={updateImportStatusFilter} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply import filters" onclick={loadImportBatches} />
        </section>
        <section class="import-result ehq-edge-surface" class:error={importState.status === "error"} aria-live="polite">
          <strong>{importState.message}</strong>
          {#if importState.preview !== null}
            <span>{importState.preview.acceptedRowCount} accepted · {importState.preview.unmappedRowCount} in suspense · {formatMoney(importState.preview.payableMicro, importState.preview.currencyCodes[0] ?? "USD")}</span>
            <span>{importState.preview.statementReference} · keys {importState.preview.joinKeys.join(" + ")}</span>
          {/if}
          {#if importState.confirm !== null}
            <span>{importState.confirm.importedRoyaltyEventCount} royalty events imported.</span>
          {/if}
        </section>
        <Table title="Imported data batches" columns={importColumns} rows={importRows} rowActions={importRowActions} state={tableStateFor(importBatchesState.status, importBatches.length)} actionLabel="" pagination={importPagination} />
      {:else if activePageId === "mapping"}
        <section class="filter-strip ehq-edge-surface" aria-label="Mapping filters">
          <Input id="distribution-mapping-search" label="Search" value={mappingSearch} placeholder="Title, artist or store" type="search" state="default" message="" oninput={updateMappingSearch} />
          <Select id="distribution-mapping-status" label="Status" value={mappingStatusFilter} options={mappingStatusOptions} state="default" message="" onchange={updateMappingStatus} />
          <Select id="distribution-mapping-batch" label="Batch" value={mappingBatchFilter} options={mappingBatchFilterOptions} state="default" message="" onchange={updateMappingBatchFilter} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply mapping filters" onclick={loadMappingRows} />
          <Button label="Automate" variant="secondary" size="medium" type="button" disabled={!writesEnabled || filteredMappingRows.length === 0} loading={false} locked={false} focus={false} ariaLabel="Automate safe mapping matches" title={writeDisabledTitle()} onclick={applyMappingRules} />
          <Button label="Select all (page)" variant="secondary" size="medium" type="button" disabled={mappingRows.length === 0} loading={false} locked={false} focus={false} ariaLabel="Select all visible mapping rows" onclick={selectAllVisibleMappingRows} />
          <Button label="Clear selection" variant="secondary" size="medium" type="button" disabled={selectedMappingRowIds.length === 0} loading={false} locked={false} focus={false} ariaLabel="Clear mapping selection" onclick={clearMappingSelection} />
          <Button label="Apply reusable rules" variant="primary" size="medium" type="button" disabled={!writesEnabled || (mappingRows.length === 0 && selectedMappingRowIds.length === 0)} loading={false} locked={false} focus={false} ariaLabel="Apply reusable rules" title={writeDisabledTitle()} onclick={applyMappingRules} />
          <span class="ehq-type-label-mono">{selectedMappingRowIds.length} selected · {filteredMappingRows.length} visible</span>
        </section>
        <Table title="Rows to review" columns={mappingColumns} rows={mappingTableRows} state={isLoadingStatus(mappingState.status) ? "loading" : mappingState.status === "error" ? "error" : filteredMappingRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={mappingRowActions} pagination={mappingPagination} />
      {:else if activePageId === "catalog"}
        <section class="filter-strip ehq-edge-surface" aria-label="Catalog filters">
          <Select id="distribution-catalog-status" label="Status" value={catalogStatusFilter} options={catalogFilterOptions} state="default" message="" onchange={updateCatalogStatus} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply catalog filters" onclick={loadCatalog} />
        </section>
        <section class="contracts-actions ehq-edge-surface">
          <Button label="New release" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="New release" onclick={() => openCatalogPanel("release")} />
          <Button label="New track" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="New track" onclick={() => openCatalogPanel("track")} />
          <span>Releases and tracks remain source data; corrections become audited overrides.</span>
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
          <Table title="Canonical catalog + contributors" columns={catalogColumns} rows={catalogRows} state={tableStateFor(tracksState.status, catalogRows.length)} actionLabel="" rowActions={catalogRowActions} pagination={catalogPagination} />
          <div class="command-card ehq-edge-surface">
            <SectionTemplate
              eyebrow="catalog"
              title="Attention required"
              detail="Imported artists and catalog contributors remain separate until an exact track match is validated."
              state="ready"
            >
              <Button label="Fix contributor mapping" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Fix contributor mapping" onclick={() => selectPage("mapping")} />
            </SectionTemplate>
          </div>
        </section>
      {:else if activePageId === "contracts"}
        <section class="kpi-grid" aria-label="Contract KPIs">
          {#each contractKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingStatus(contractsState.status) ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>
        <section class="contracts-actions ehq-edge-surface">
          <Button label="New payee" variant="secondary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="New Distribution payee" title={writeDisabledTitle()} onclick={openPayeePanel} />
          <Button label="New contract" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="New contract" onclick={openContractPanel} />
          <Button label="Record recoupable expense" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Record recoupable expense" title={writeDisabledTitle()} onclick={openExpensePanel} />
          <span>Expenses remain source data; corrections become audited overrides.</span>
        </section>
        {#if payeePanelOpen}
          <section class="form-panel ehq-edge-surface" aria-label="New Distribution payee">
            <Input id="distribution-payee-name" label="Name" value={payeeNameInput} placeholder="Artist, staff member, supplier or freelancer" type="text" state="default" message="Any royalty or expense counterparty can be a payee." oninput={updatePayeeName} />
            <Input id="distribution-payee-email" label="Email (optional)" value={payeeEmailInput} placeholder="" type="text" state="default" message="" oninput={updatePayeeEmail} />
            <Input id="distribution-payee-currency" label="Preferred currency" value={payeeCurrencyInput} placeholder="MUR" type="text" state={normalizeCurrencyCode(payeeCurrencyInput) === null ? "error" : "default"} message="ISO 3-letter code" oninput={updatePayeeCurrency} />
            <Button label="Create payee" variant="primary" size="medium" type="button" disabled={!writesEnabled || payeeNameInput.trim() === "" || normalizeCurrencyCode(payeeCurrencyInput) === null} loading={false} locked={false} focus={false} ariaLabel="Create Distribution payee" title={writeDisabledTitle()} onclick={createPayee} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel payee creation" onclick={closePayeePanel} />
          </section>
        {/if}
        {#if expensePanelOpen}
          <section class="form-panel ehq-edge-surface" aria-label="Record recoupable expense">
            <Select id="distribution-expense-contract" label="Contract" value={expenseContractIdInput} options={expenseContractSelectOptions} state="default" message="" onchange={updateExpenseContract} />
            <Select id="distribution-expense-category" label="Category" value={expenseCategoryInput} options={expenseCategoryOptions} state="default" message="" onchange={updateExpenseCategory} />
            <Select id="distribution-expense-payee" label="Payee charged" value={expensePayeeIdInput} options={expensePayeeOptions} state="default" message="" onchange={updateExpensePayee} />
            <Input id="distribution-expense-label" label="Description" value={expenseLabelInput} placeholder="Advance, studio session, campaign…" type="text" state="default" message="" oninput={updateExpenseLabel} />
            <Input id="distribution-expense-amount" label="Amount" value={expenseAmountInput} placeholder="2500.00" type="text" state="default" message="" oninput={updateExpenseAmount} />
            <label>
              <span>Currency</span>
              <input value={selectedExpenseContract?.currency ?? ""} readonly />
            </label>
            <Select id="distribution-expense-recoverable" label="Recoverable from payee share" value={expenseRecoverableInput} options={[{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]} state="default" message="" onchange={updateExpenseRecoverable} />
            <label>
              <span>Expense date</span>
              <input type="date" value={expenseDateInput} onchange={updateExpenseDate} />
            </label>
            <Button label="Record expense" variant="primary" size="medium" type="button" disabled={!writesEnabled || selectedExpenseContract === null || expenseLabelInput.trim() === "" || expenseAmountMicro === null || expenseDateInput === ""} loading={false} locked={false} focus={false} ariaLabel="Record expense" title={writesEnabled ? (selectedExpenseContract === null ? "Select a contract first" : expenseLabelInput.trim() === "" ? "Enter a label first" : expenseAmountMicro === null ? "Enter a positive amount, e.g. 2500.00" : expenseDateInput === "" ? "Choose the expense date first" : "") : writeGateMessage} onclick={recordExpense} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel expense entry" onclick={closeExpensePanel} />
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
            <Button label="Create contract" variant="primary" size="medium" type="button" disabled={!writesEnabled || contractTitleInput.trim() === "" || contractPayeeIdInput === "" || contractEffectiveFromInput === "" || contractSplitBp === null || contractCurrencyInput.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Create contract" title={writesEnabled ? (contractTitleInput.trim() === "" ? "Enter a contract title first" : contractPayeeIdInput === "" ? "Select a payee first" : contractEffectiveFromInput === "" ? "Choose the start date first" : contractSplitBp === null ? "Enter a split between 0.01 and 100" : contractCurrencyInput.trim() === "" ? "Enter a currency code first" : "") : writeGateMessage} onclick={createContract} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel contract creation" onclick={closeContractPanel} />
          </section>
        {/if}
        {#if selectedRuleContract !== null}
          <section class="form-panel ehq-edge-surface" aria-label="Replace royalty rule set">
            <div class="panel-context">
              <strong>{selectedRuleContract.title}</strong>
              <span>This action replaces the previous rule set; only a single-payee 100% replacement is allowed here.</span>
            </div>
            <Select id="distribution-rule-payee" label="Payee" value={rulePayeeIdInput} options={payeeSelectOptions} state="default" message="" onchange={updateRulePayee} />
            <Input id="distribution-rule-percentage" label="Percentage" value={rulePercentageInput} placeholder="100" type="text" state="default" message="" oninput={updateRulePercentage} />
            <Button label="Replace rule set" variant="primary" size="medium" type="button" disabled={!writesEnabled || rulePayeeIdInput === "" || ruleReplacementPercentage === null} loading={false} locked={false} focus={false} ariaLabel="Replace rule set" title={writesEnabled ? (rulePayeeIdInput === "" ? "Select a payee first" : ruleReplacementPercentage === null ? "This secure path only accepts 100.000000" : "") : writeGateMessage} onclick={addContractRule} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel rule editing" onclick={closeContractRulePanel} />
          </section>
        {/if}
        <section class="filter-strip ehq-edge-surface" aria-label="Expense contract filter">
          <Select id="distribution-expense-contract-filter" label="Expense contract" value={expenseContractFilterId} options={expenseContractSelectOptions} state="default" message="" onchange={updateExpenseContractFilter} />
          <Button label="Reload expenses" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Reload expenses for the selected contract" onclick={loadExpenses} />
        </section>
        <section class="dashboard-grid">
          <Table title="Splits / contracts" columns={contractColumns} rows={contractRows} state={tableStateFor(contractsState.status, contracts.length)} actionLabel="" rowActions={contractRowActions} pagination={contractsPagination} />
          <Table title={expenseTableTitle} columns={expenseColumns} rows={expenseRows} state={tableStateFor(expensesState.status, expenses.length)} actionLabel="" pagination={expensesPagination} />
        </section>
        <Table title="Payees" columns={payeeColumns} rows={payeeRows} state={tableStateFor(payeesState.status, payees.length)} actionLabel="" />
      {:else if activePageId === "allocations"}
        <section class="lock-panel ehq-edge-surface">
          <SectionTemplate
            eyebrow="allocations"
            title="Server lock"
            detail="Preview, posting and reversal are only available through scheduled workflow runs."
            state="ready"
          >
            {#snippet action()}
              <Button label="Preview locked run" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Preview locked run" onclick={previewAllocationRun} />
              <Button label="Post scheduled batch" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Post scheduled batch" title={writeDisabledTitle()} onclick={startCadencedAllocationRun} />
            {/snippet}
            <p class="lock-key">{allocationLockKey}</p>
          </SectionTemplate>
        </section>
        {#if selectedRun !== null}
          <section class="form-panel ehq-edge-surface" aria-label="Request run reversal">
            <div class="panel-context">
              <strong>{selectedRun.runReference}</strong>
              <span>{selectedRun.period} · {selectedRun.status} · lock {selectedRun.lockKey}</span>
            </div>
            <Input id="distribution-unpost-reason" label="Reversal reason" value={unpostReasonInput} placeholder="" type="text" state="default" message="" oninput={updateUnpostReason} />
            <Button label="Reverse run" variant="danger" size="medium" type="button" disabled={!writesEnabled || unpostReasonInput.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Reverse run" title={writesEnabled ? (unpostReasonInput.trim() === "" ? "Enter a reversal reason first" : "") : writeGateMessage} onclick={unpostAllocationRun} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel reversal request" onclick={closeUnpostPanel} />
          </section>
        {/if}
        <Table title="Allocation runs" columns={allocationColumns} rows={allocationRows} state={tableStateFor(allocationsState.status, allocationRuns.length)} actionLabel="" rowActions={allocationRowActions} pagination={allocationsPagination} />
      {:else if activePageId === "suspense"}
        <section class="filter-strip ehq-edge-surface" aria-label="Suspense filters">
          <Select id="distribution-suspense-status" label="Status" value={suspenseStatusFilter} options={suspenseStatusOptions} state="default" message="" onchange={updateSuspenseStatus} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply suspense filters" onclick={loadSuspense} />
          <Button label="Export CSV" variant="secondary" size="medium" type="button" disabled={suspenseItems.length === 0} loading={false} locked={false} focus={false} ariaLabel="Export suspense as CSV" onclick={exportSuspenseCsv} />
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
        <Table title="Suspense grouped by reason" columns={suspenseColumns} rows={suspenseTableRows} state={isLoadingStatus(suspenseState.status) ? "loading" : suspenseState.status === "error" ? "error" : suspenseItems.length === 0 ? "empty" : "default"} actionLabel="" rowActions={suspenseRowActions} pagination={suspensePagination} />
      {:else if activePageId === "statements"}
        <section class="filter-strip ehq-edge-surface" aria-label="Statement filters">
          <Select id="distribution-statement-payee" label="Payee" value={statementPayeeFilter} options={statementPayeeOptions} state="default" message="" onchange={updateStatementPayee} />
          <Select id="distribution-statement-currency" label="Currency" value={statementCurrencyFilter} options={statementCurrencyOptions} state="default" message="" onchange={updateStatementCurrency} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply statement filters" onclick={loadStatements} />
        </section>
        <section class="statement-summary ehq-edge-surface">
          {#if statementPreview !== null}
            <div>
              <p>Financial summary first</p>
              <h2>{statementPreview.payeeName} · {formatDateRange(statementPreview.period_start, statementPreview.period_end)}</h2>
              <dl>
                <div><dt>Gross</dt><dd>{formatMoney(statementPreview.grossMicro, statementPreview.currency)}</dd></div>
                <div><dt>Recouped</dt><dd>{formatMoney(statementPreview.recoupedMicro, statementPreview.currency)}</dd></div>
                <div><dt>Paid</dt><dd>{formatMoney(statementPreview.paidMicro, statementPreview.currency)}</dd></div>
                <div><dt>Total payable</dt><dd>{formatMoney(statementPreview.netPayableMicro, statementPreview.currency)}</dd></div>
              </dl>
            </div>
          {/if}
          <div class="statement-summary-actions">
            <Button label="Generate statements" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Generate statements" title={writeDisabledTitle()} onclick={generateStatements} />
          </div>
        </section>
        <Table title="Statement payment reconciliation" columns={reconStatementColumns} rows={reconStatementRows} state={isLoadingStatus(reconciliationState.status) ? "loading" : reconciliationState.status === "error" ? "error" : reconStatementRows.length === 0 ? "empty" : "default"} actionLabel="" />
        <section class="statement-pdf ehq-edge-surface" aria-label="A4 statement PDF preview">
          <header>
            <strong>ë • Distribution</strong>
            <span>A4 PDF · print-ready</span>
          </header>
          <h2>Statement {statementPreview?.payeeName ?? "Payee"}</h2>
          <p>Period {statementPreview === null ? periodLabel(distributionPeriod) : formatDateRange(statementPreview.period_start, statementPreview.period_end)} · currency {statementPreview?.currency ?? "MUR"}</p>
          {#if printingStatementId !== null}
            <div class="print-hidden">
              <Alert tone="info" title="Printing" message="Preparing print view…" dismissible={false} />
            </div>
          {/if}
          {#if statementPrintError !== null}
            <span class="panel-error" role="alert">{statementPrintError}</span>
          {/if}
          <Table title="Statements" columns={statementColumns} rows={statementRows} state={tableStateFor(statementsState.status, statements.length)} actionLabel="" rowActions={statementRowActions} pagination={statementsPagination} />
        </section>
      {:else if activePageId === "payments"}
        <Alert tone="info" title="Distribution subledger" message="Payments are recorded and linked to Distribution statements here. Office bank and accounting integration is intentionally out of scope." dismissible={false} />
        <section class="filter-strip ehq-edge-surface" aria-label="Payment filters">
          <Select id="distribution-payment-status" label="Status" value={paymentStatusFilter} options={paymentStatusOptions} state="default" message="" onchange={updatePaymentStatus} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply payment filters" onclick={loadPayments} />
          <Button label="Export CSV" variant="secondary" size="medium" type="button" disabled={payments.length === 0} loading={false} locked={false} focus={false} ariaLabel="Export payments as CSV" onclick={exportPaymentsCsv} />
        </section>
        <section class="form-panel ehq-edge-surface" aria-label="Record a payment">
          <Select id="distribution-record-payee" label="Payee" value={recordPaymentPayeeId} options={payeeSelectOptions} state="default" message="" onchange={updateRecordPaymentPayee} />
          <Input id="distribution-record-amount" label="Amount" value={recordPaymentAmount} placeholder="2500.00" type="text" state={recordPaymentAmount !== "" && recordPaymentAmountMicro === null ? "error" : "default"} message={recordPaymentAmount !== "" && recordPaymentAmountMicro === null ? "Enter a positive amount with up to 10 decimals." : ""} oninput={updateRecordPaymentAmount} />
          <Input id="distribution-record-currency" label="Currency" value={recordPaymentCurrency} placeholder="MUR" type="text" state={normalizeCurrencyCode(recordPaymentCurrency) === null ? "error" : "default"} message="ISO 3-letter code" oninput={updateRecordPaymentCurrency} />
          <Input id="distribution-record-fx" label="Exchange rate (optional)" value={recordPaymentExchangeRate} placeholder="" type="text" state={recordPaymentExchangeRate.trim() !== "" && recordPaymentExchangeRateNormalized === null ? "error" : "default"} message="Reference rate only; stored values are never rewritten." oninput={updateRecordPaymentExchangeRate} />
          <Select id="distribution-record-method" label="Method" value={recordPaymentMethod} options={paymentMethodOptions} state="default" message="" onchange={updateRecordPaymentMethod} />
          <Input id="distribution-record-reference" label="Reference (optional)" value={recordPaymentReference} placeholder="" type="text" state="default" message="" oninput={updateRecordPaymentReference} />
          <Select id="distribution-record-status" label="Status" value={recordPaymentStatus} options={paymentRecordStatusOptions} state="default" message="" onchange={updateRecordPaymentStatus} />
          {#if recordPaymentStatus === "paid"}
            <label><span>Paid date</span><input type="date" value={recordPaymentPaidDate} onchange={updateRecordPaymentPaidDate} /></label>
          {/if}
          <Input id="distribution-record-notes" label="Notes (optional)" value={recordPaymentNotes} placeholder="" type="text" state="default" message="" oninput={updateRecordPaymentNotes} />
          <Select id="distribution-record-statement" label="Link statement now (optional)" value={recordStatementId} options={openStatementSelectOptions} state="default" message="Can be linked later from the reconciliation queue." onchange={updateRecordStatement} />
          <Button label="Record payment" variant="primary" size="medium" type="button" disabled={!writesEnabled || recordPaymentPayeeId === "" || recordPaymentAmountMicro === null || normalizeCurrencyCode(recordPaymentCurrency) === null || (recordPaymentStatus === "paid" && recordPaymentPaidDate === "")} loading={false} locked={false} focus={false} ariaLabel="Record payment" title={writeDisabledTitle()} onclick={recordPayment} />
        </section>
        {#if selectedPayment !== null && paymentPanelMode !== null}
          <section class="form-panel ehq-edge-surface" aria-label="Payment action">
            <div class="panel-context">
              <strong>{selectedPayment.payeeName}</strong>
              <span>{formatMoney(selectedPayment.amountMicro, selectedPayment.currency)} · {selectedPayment.status} · {selectedPayment.reference ?? "no reference"}</span>
            </div>
            {#if paymentPanelMode === "edit"}
              <Input id="distribution-payment-fx" label="Exchange rate (optional)" value={paymentExchangeRateInput} placeholder="" type="text" state={paymentExchangeRateInput.trim() !== "" && paymentExchangeRateNormalized === null ? "error" : "default"} message="Reference rate only." oninput={updatePaymentExchangeRateInput} />
              <Select id="distribution-payment-method" label="Method" value={paymentMethodInput} options={paymentMethodOptions} state="default" message="" onchange={updatePaymentMethodInput} />
              <Input id="distribution-payment-reference" label="Reference (optional)" value={paymentReferenceInput} placeholder="" type="text" state="default" message="" oninput={updatePaymentReferenceInput} />
              <Select id="distribution-payment-edit-status" label="Status" value={paymentStatusInput} options={paymentRecordStatusOptions} state="default" message="" onchange={updatePaymentStatusInput} />
              {#if paymentStatusInput === "paid"}
                <label><span>Paid date</span><input type="date" value={paymentPaidDateInput} onchange={updatePaymentPaidDateInput} /></label>
              {/if}
              <Input id="distribution-payment-notes" label="Notes (optional)" value={paymentNotesInput} placeholder="" type="text" state="default" message="" oninput={updatePaymentNotesInput} />
              <Button label="Save payment" variant="primary" size="medium" type="button" disabled={!writesEnabled || (paymentStatusInput === "paid" && paymentPaidDateInput === "")} loading={false} locked={false} focus={false} ariaLabel="Save payment" title={writeDisabledTitle()} onclick={editPayment} />
            {:else if paymentPanelMode === "reconcile"}
              <Select id="distribution-payment-statement" label="Distribution statement" value={paymentReconcileStatementId} options={paymentReconcileStatementOptions} state="default" message="Only same-payee, same-currency statements are eligible." onchange={updatePaymentReconcileStatement} />
              <Input id="distribution-payment-applied" label="Amount applied" value={paymentReconcileAmountInput} placeholder="" type="text" state={paymentReconcileAmountInput !== "" && paymentReconcileAmountMicro === null ? "error" : "default"} message="Cannot exceed the payment or open statement balance." oninput={updatePaymentReconcileAmount} />
              <Button label="Link statement" variant="primary" size="medium" type="button" disabled={!writesEnabled || paymentReconcileStatementId === "" || paymentReconcileAmountMicro === null || selectedPayment.status !== "paid"} loading={false} locked={false} focus={false} ariaLabel="Link payment to statement" title={selectedPayment.status === "draft" ? "Post the draft payment first." : writeDisabledTitle()} onclick={reconcilePayment} />
            {:else}
              <Input id="distribution-payment-void-reason" label="Void reason" value={paymentReferenceInput} placeholder="" type="text" state="default" message="" oninput={updatePaymentReferenceInput} />
              <Button label="Void payment" variant="danger" size="medium" type="button" disabled={!writesEnabled || paymentReferenceInput.trim() === ""} loading={false} locked={false} focus={false} ariaLabel="Void payment" title={writesEnabled ? (paymentReferenceInput.trim() === "" ? "Enter a void reason first" : "") : writeGateMessage} onclick={voidPayment} />
            {/if}
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Close payment panel" onclick={closePaymentPanel} />
          </section>
        {/if}
        <Table title="Payment reconciliation queue" columns={paymentColumns} rows={unlinkedPaymentRows} state={isLoadingStatus(paymentsState.status) ? "loading" : paymentsState.status === "error" ? "error" : unlinkedPaymentRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={paymentRowActions} />
        <Table title="Payments ledger" columns={paymentColumns} rows={paymentRows} state={isLoadingStatus(paymentsState.status) ? "loading" : paymentsState.status === "error" ? "error" : payments.length === 0 ? "empty" : "default"} actionLabel="" rowActions={paymentRowActions} pagination={paymentsPagination} />
      {:else if activePageId === "revenue"}
        <section class="kpi-grid" aria-label="Revenue totals">
          {#each revenueKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingStatus(revenueState.status) ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>
        <section class="filter-strip ehq-edge-surface" aria-label="Revenue filters">
          <Select id="distribution-revenue-group" label="Group by" value={revenueGroupBy} options={revenueGroupOptions} state="default" message="" onchange={updateRevenueGroup} />
          <Select id="distribution-revenue-payee" label="Payee" value={revenuePayeeFilter} options={revenuePayeeOptions} state="default" message="" onchange={updateRevenuePayee} />
          <Select id="distribution-revenue-store" label="Store" value={revenueStoreFilter} options={revenueStoreOptions} state="default" message="" onchange={updateRevenueStore} />
          <Select id="distribution-revenue-currency" label="Currency" value={revenueCurrencyFilter} options={revenueCurrencyOptions} state="default" message="" onchange={updateRevenueCurrency} />
          <Button label="Export CSV" variant="secondary" size="medium" type="button" disabled={revenueRows.length === 0} loading={false} locked={false} focus={false} ariaLabel="Export revenue as CSV" onclick={exportRevenueCsv} />
          <Button label="Refresh" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Refresh revenue" onclick={loadRevenue} />
        </section>
        <section class="dashboard-grid">
          <BarsChart title="Grouped revenue view" points={revenueChartPoints} tone="active" />
          <Table title="Revenue details" columns={revenueColumns} rows={revenueTableRows} state={tableStateFor(revenueState.status, revenueRows.length)} actionLabel="" pagination={revenuePagination} />
        </section>
      {:else if activePageId === "financial-reconciliation"}
        {#if isLoadingStatus(reconciliationState.status)}
          <Loader label="Loading reconciliation" detail="Computing read-only diagnostics." size="medium" />
        {:else if reconciliationState.status === "error"}
          <section class="empty-state error ehq-edge-surface">
            <strong>Reconciliation unavailable</strong>
            <span>The read-only diagnostic could not be loaded. Try the request again.</span>
            <Button label="Retry" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Retry reconciliation loading" onclick={loadReconciliation} />
          </section>
        {:else}
          <section class="kpi-grid recon" aria-label="Reconciliation KPIs">
            {#each reconciliationKpis as kpi (kpi.label)}
              <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state="default" accent={kpi.accent} />
            {/each}
          </section>
          <Table title="Statements without payment links" columns={reconStatementColumns} rows={reconStatementRows} state={reconStatementRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <Table title="Expense terms without a payee" columns={reconExpenseColumns} rows={reconExpenseRows} state={reconExpenseRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <Table title="Matched but unallocated (sample)" columns={reconMatchedColumns} rows={reconMatchedRows} state={reconMatchedRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <Table title="Payee balance summary" columns={reconBalanceColumns} rows={reconBalanceRows} state={reconBalanceRows.length === 0 ? "empty" : "default"} actionLabel="" />
          <section class="recon-actions ehq-edge-surface" aria-label="Secure corrective actions">
            <SectionTemplate
              eyebrow="reconciliation"
              title="Secure corrective actions"
              detail="These actions use the API write path with idempotency, auditing and locks."
              state="ready"
            >
            <div class="recon-action-grid">
              {#each (reconciliation?.actions ?? []) as action (action.id)}
                <div class="recon-action ehq-edge-surface">
                  <strong>{action.label}</strong>
                  <p>{action.description}</p>
                  {#if action.maintenance}
                    <span class="recon-action-flag">One-off maintenance · secure execution</span>
                  {/if}
                  <Button
                    label={action.maintenance ? "Run maintenance" : "Run secure action"}
                    variant="secondary"
                    size="medium"
                    type="button"
                    disabled={!writesEnabled}
                    loading={false}
                    locked={false}
                    focus={false}
                    ariaLabel={action.maintenance ? `Run maintenance: ${action.label}` : `Run secure action: ${action.label}`}
                    title={writeDisabledTitle()}
                    onclick={() => runReconciliationAction(action)}
                  />
                </div>
              {/each}
            </div>
            </SectionTemplate>
          </section>
        {/if}
      {:else if activePageId === "aliases"}
        <section class="form-panel ehq-edge-surface" aria-label="Alias editor">
          <header class="settings-editor-head">
            <strong>{aliasEditorId === null ? "Create an alias" : "Edit an alias"}</strong>
            <span>Route imported names to canonical entities.</span>
          </header>
          <div class="settings-editor-grid">
            <Input
              id="distribution-alias-text"
              label="Alias"
              value={aliasTextInput}
              placeholder="Exact source name"
              type="text"
              state={aliasTextInput.trim().length > 0 ? "default" : "error"}
              message={aliasTextInput.trim().length > 0 ? "" : "Alias required."}
              oninput={updateAliasTextInput}
            />
            <Select
              id="distribution-alias-target-type"
              label="Target type"
              value={aliasTargetTypeInput}
              options={aliasTargetTypeOptions}
              state="default"
              message=""
              onchange={updateAliasTargetType}
            />
            {#if aliasTargetRequiresId && aliasTargetIsSelect}
              <Select
                id="distribution-alias-target-id"
                label="Target"
                value={aliasTargetIdInput}
                options={aliasTargetSelectOptions}
                state="default"
                message=""
                onchange={updateAliasTargetId}
              />
            {:else if aliasTargetRequiresId}
              <Input
                id="distribution-alias-target-id-free"
                label="Target ID"
                value={aliasTargetIdInput}
                placeholder="Canonical ID"
                type="text"
                state={aliasTargetIdInput.trim().length > 0 ? "default" : "error"}
                message={aliasTargetIdInput.trim().length > 0 ? "" : "Target ID required."}
                oninput={updateAliasTargetId}
              />
            {/if}
          </div>
          <div class="settings-editor-actions">
            <Button
              label={aliasEditorId === null ? "Create alias" : "Update alias"}
              variant="primary"
              size="medium"
              type="button"
              disabled={!writesEnabled || !aliasFormValid}
              loading={false}
              locked={false}
              focus={false}
              ariaLabel={aliasEditorId === null ? "Create alias" : "Update alias"}
              title={writesEnabled ? (!aliasFormValid ? "Complete the required fields." : "") : writeGateMessage}
              onclick={saveAlias}
            />
            <Button
              label="New"
              variant="secondary"
              size="medium"
              type="button"
              disabled={false}
              loading={false}
              locked={false}
              focus={false}
              ariaLabel="Prepare a new alias"
              onclick={openAliasCreatePanel}
            />
            <Button
              label="Reset"
              variant="secondary"
              size="medium"
              type="button"
              disabled={false}
              loading={false}
              locked={false}
              focus={false}
              ariaLabel="Reset alias editor"
              onclick={closeAliasEditor}
            />
          </div>
        </section>
        {#if aliases.length === 0 && aliasesState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No catalog aliases</strong>
            <span>No aliases are available for this workspace. Once configured, aliases route imported names to canonical entities.</span>
          </section>
        {:else}
          <Table title="Catalog aliases" columns={aliasColumns} rows={aliasRows} state={tableStateFor(aliasesState.status, aliases.length)} actionLabel="" rowActions={aliasRowActions} pagination={aliasesPagination} />
        {/if}
      {:else if activePageId === "duplicates"}
        <section class="recon-actions ehq-edge-surface" aria-label="Duplicate note">
          <SectionTemplate
            eyebrow="duplicates"
            title="Duplicate detection"
            detail="Potential duplicate records are listed with readable labels; use the resolution action to exclude duplicates.
"
            state="ready"
          />
        </section>
        {#if duplicateEditorId !== null}
          <section class="form-panel ehq-edge-surface" aria-label="Merge duplicate into master">
            <Select id="distribution-duplicate-master" label="Master record" value={duplicateMasterId} options={duplicateMasterOptions} state="default" message="" onchange={updateDuplicateMaster} />
            <Button label="Merge into master" variant="primary" size="medium" type="button" disabled={!writesEnabled || duplicateMasterId === ""} loading={false} locked={false} focus={false} ariaLabel="Merge duplicate into selected master" title={writeDisabledTitle()} onclick={mergeDuplicate} />
            <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel duplicate merge" onclick={closeDuplicateMerge} />
          </section>
        {/if}
        {#if duplicates.length === 0 && duplicatesState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No duplicates detected</strong>
            <span>No potentially duplicated records were found in the catalog.</span>
          </section>
        {:else}
          <Table title="Potential duplicates" columns={duplicateColumns} rows={duplicateRows} state={tableStateFor(duplicatesState.status, duplicates.length)} actionLabel="" rowActions={duplicateRowActions} pagination={duplicatesPagination} />
        {/if}
      {:else if activePageId === "audit-log"}
        {#if auditEntries.length === 0 && auditLogState.status === "success"}
          <section class="empty-state ehq-edge-surface">
            <strong>No audit entries</strong>
            <span>No Distribution-scoped audit events are recorded for this workspace.</span>
          </section>
        {:else}
          <Table title="Audit log" columns={auditColumns} rows={auditRows} state={tableStateFor(auditLogState.status, auditEntries.length)} actionLabel="" pagination={auditPagination} />
        {/if}
      {:else if activePageId === "settings"}
        {#if isLoadingStatus(settingsState.status)}
          <Loader label="Loading settings" detail="Reading workspace configuration." size="medium" />
        {:else if settingsState.status === "error"}
          <section class="empty-state error ehq-edge-surface">
            <strong>Settings unavailable</strong>
            <span>The workspace configuration could not be loaded.</span>
            <Button label="Retry" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Retry settings loading" onclick={reloadSettingsPage} />
          </section>
        {:else if settings !== null}
          <div class="settings-grid">
            <section class="settings-panel ehq-edge-surface" aria-label="Distribution settings">
              <dl>
                <div><dt>Workspace</dt><dd>{settings.workspaceId}</dd></div>
                <div><dt>Namespace API</dt><dd>{settings.namespace}</dd></div>
                <div><dt>Reads</dt><dd>{settings.reads}</dd></div>
                <div><dt>Payees</dt><dd>{settings.payeeCount}</dd></div>
                <div><dt>Contracts</dt><dd>{settings.contractCount}</dd></div>
                <div><dt>Currencies</dt><dd>{settings.currencies.length === 0 ? "—" : settings.currencies.join(", ")}</dd></div>
                <div><dt>FX rates</dt><dd>{settings.fxRateCount}</dd></div>
                <div><dt>Mutations</dt><dd>{settings.mutationsEnabled ? "enabled" : "read-only"}</dd></div>
              </dl>
            </section>

            <section class="settings-panel ehq-edge-surface" aria-label="Save an FX rate">
              <header class="settings-editor-head">
                <strong>Save an FX rate</strong>
                <span>Add or update a currency pair and effective date.</span>
              </header>

              <div class="settings-editor-grid">
                <Input
                  id="distribution-fx-from"
                  label="Source currency"
                  value={fxFromCurrencyInput}
                  placeholder="EUR"
                  type="text"
                  state={fxFromCurrencyInput.trim().length > 0 && fxFromCurrencyNormalized === null ? "error" : "default"}
                  message={fxFromCurrencyInput.trim().length > 0 && fxFromCurrencyNormalized === null ? "ISO code required (EUR, USD...)." : ""}
                  oninput={updateFxFromCurrencyInput}
                />
                <Input
                  id="distribution-fx-to"
                  label="Target currency"
                  value={fxToCurrencyInput}
                  placeholder="MUR"
                  type="text"
                  state={fxToCurrencyInput.trim().length > 0 && fxToCurrencyNormalized === null ? "error" : "default"}
                  message={fxToCurrencyInput.trim().length > 0 && fxToCurrencyNormalized === null ? "ISO code required (MUR, EUR...)." : ""}
                  oninput={updateFxToCurrencyInput}
                />
                <Input
                  id="distribution-fx-date"
                  label="Effective date"
                  value={fxEffectiveDateInput}
                  placeholder="YYYY-MM-DD"
                  type="text"
                  state={fxEffectiveDateInput.trim().length > 0 && fxEffectiveDateNormalized === null ? "error" : "default"}
                  message={fxEffectiveDateInput.trim().length > 0 && fxEffectiveDateNormalized === null ? "Required format: YYYY-MM-DD." : ""}
                  oninput={updateFxEffectiveDateInput}
                />
                <Input
                  id="distribution-fx-rate"
                  label="Rate"
                  value={fxRateInput}
                  placeholder="53.941005"
                  type="text"
                  state={fxRateInput.trim().length > 0 && fxRateNormalized === null ? "error" : "default"}
                  message={fxRateInput.trim().length > 0 && fxRateNormalized === null ? "Positive number, up to 10 decimal places." : ""}
                  oninput={updateFxRateInput}
                />
              </div>

              <div class="settings-editor-actions">
                <Button
                  label="Save rate"
                  variant="primary"
                  size="medium"
                  type="button"
                  disabled={fxRateSaveStatus === "loading" || !writesEnabled || !fxRateFormValid}
                  loading={fxRateSaveStatus === "loading"}
                  locked={false}
                  focus={false}
                  ariaLabel="Save FX rate"
                  onclick={saveFxRate}
                />
              </div>

              {#if fxRateSaveMessage !== null}
                <p class={`settings-save-message ${fxRateSaveStatus === "error" ? "error" : "success"}`}>{fxRateSaveMessage}</p>
              {/if}
            </section>
          </div>

          <Table title="FX history" columns={fxRateColumns} rows={fxRateRows} state={tableStateFor(fxRatesState.status, fxRateRows.length)} actionLabel="" />
        {/if}
      {/if}
    </div>
</WorkspaceShell>

<style>
  :global(body) {
    overflow: hidden;
  }

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

  .distribution-workflow-hero {
    display: grid;
    grid-template-columns: minmax(220px, 0.9fr) minmax(0, 1.5fr);
    gap: var(--ehq-space-4);
    padding: var(--ehq-space-4);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-md);
    background: var(--ehq-surface-high);
  }

  .distribution-workflow-heading,
  .distribution-workflow-steps,
  .distribution-workflow-steps article {
    display: grid;
  }

  .distribution-workflow-heading,
  .distribution-workflow-steps article {
    gap: var(--ehq-space-1);
  }

  .distribution-workflow-heading p,
  .distribution-workflow-heading h2,
  .distribution-workflow-heading span,
  .distribution-workflow-steps article span,
  .distribution-workflow-steps article strong,
  .distribution-workflow-steps article small {
    margin: 0;
  }

  .distribution-workflow-heading p,
  .distribution-workflow-steps article span {
    color: var(--ehq-workspace-distribution);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .distribution-workflow-heading h2 {
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .distribution-workflow-heading span,
  .distribution-workflow-steps article small {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    line-height: var(--ehq-type-ui-line);
  }

  .distribution-workflow-steps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  .distribution-workflow-steps article {
    align-content: start;
    min-width: 0;
    padding: var(--ehq-space-3);
    border-left: 1px solid var(--ehq-border);
  }


  .import-result {
    margin: 0;
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border-strong);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-workspace-distribution-bg);
    color: var(--ehq-workspace-distribution);
    font-size: var(--ehq-type-caption-size);
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

  .dashboard-top-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
    border-color: var(--ehq-border-strong);
    box-shadow: 0 0 0 3px var(--ehq-workspace-distribution-bg);
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
    color: var(--ehq-workspace-distribution);
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

  .empty-state.error {
    --ehq-edge-fill: var(--ehq-error-bg);
    --ehq-edge-border-color: var(--ehq-error);
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

  .settings-grid {
    display: grid;
    gap: var(--ehq-space-4);
  }

  .settings-editor-head {
    display: grid;
    gap: var(--ehq-space-1);
    margin-bottom: var(--ehq-space-3);
  }

  .settings-editor-head strong {
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .settings-editor-head span {
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-caption-size);
  }

  .settings-editor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--ehq-space-3);
    margin-bottom: var(--ehq-space-3);
  }

  .settings-editor-actions {
    display: flex;
    justify-content: flex-start;
  }

  .settings-save-message {
    margin: var(--ehq-space-2) 0 0;
    font-size: var(--ehq-type-caption-size);
  }

  .settings-save-message.error {
    color: var(--ehq-error);
  }

  .settings-save-message.success {
    color: var(--ehq-success);
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

    .print-hidden,
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
    .dashboard-grid,
    .dashboard-top-grid {
      grid-template-columns: 1fr 1fr;
    }

    .distribution-workflow-hero {
      grid-template-columns: 1fr;
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
    .dashboard-top-grid,
    .statement-summary dl {
      grid-template-columns: 1fr;
    }

    .distribution-workflow-steps {
      grid-template-columns: 1fr;
    }

    .distribution-workflow-steps article {
      border-left: 0;
      border-top: 1px solid var(--ehq-border);
    }
  }
</style>
