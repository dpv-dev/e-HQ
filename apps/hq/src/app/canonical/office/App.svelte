<script lang="ts">
  import { onMount, tick } from "svelte";
  import type { AuthSession } from "@ehq/auth";
  import {
    Alert,
    BarsChart,
    Button,
    DivergeChart,
    Drawer,
    Input,
    KPI,
    LineChart,
    Loader,
    PageHeader,
    SectionTemplate,
    Select,
    StatCard,
    Table,
    WorkspaceShell,
    type ChartPoint,
    type DivergePoint,
    type SelectOption,
    type StatTrendDirection,
    type TablePagination,
    type TableRowAction,
    type Tone,
    type IconName,
    type WorkspaceNavGroup,
    type WorkspaceNavItem
  } from "@ehq/ui";
  import "../../../office-orbital-scope.css";
  import {
    beginReload,
    createErrorState,
    createIdleState,
    createLoadingState,
    createSuccessState,
    type ApiMutationReceipt,
    type ApiRequestState,
    type AuditLogEntry,
    type BankImportPreviewResponse,
    type CashflowBucket,
    type OfficeDashboardResponse,
    type OfficeDashboardAnalyticsResponse,
    type OfficeDepartmentPnl,
    type OfficeDivisionPnl,
    type OfficeGlobalPnl,
    type OfficeLedgerBulkRow,
    type OfficeLedgerBulkPreviewResponse,
    type OfficePlanComptableCategoryNode,
    type OfficePlanComptableNode,
    type OfficePnlProjectionRow,
    type OfficePnlLine,
    type OfficeRecentImport,
    type OfficeReconciliationCandidate,
    type OfficeReconciliationOperationsResponse,
    type OfficeBankAccountSummary,
    type OfficeBankPreviewRowResult,
    type OfficeTransaction,
    type BankImportConfirmResponse,
    type BankImportParsePreviewResponse,
    type BankImportPreviewRequest,
    type OfficeTransactionWriteRequest,
    type PageResult,
    type CurrencyCode,
    type OfficeCategoryType
  } from "@ehq/api-client";
  import { createShellApiClient } from "../../app-shell-data.js";
  import "./orbital-office.css";
  import {
    canCancelRecentImportItem,
    canDeleteRecentImportItem,
    recentImportCancelDisabledReasonFor,
    recentImportDeleteDisabledReasonFor
  } from "./recent-import-actions.js";
  import { extractPdfText } from "../../pdf-extract.js";
  import { parseCsvRecords } from "../../bank-parser.js";
  import { formatDateOnly } from "../../date-format.js";
  import { apiMoneyToMicroUnits, formatMoneyValue, formatSignedMoneyValue, moneyToneForValue } from "../../money-format.js";
  import { createPeriodOptions, getLatestDataPeriod, periodLabel, rangeForScope, rangeLabel, todayIso, type DateRange, type PeriodScope } from "../../period-controls.js";
  import {
    apiRequestStateLabel as stateLabel,
    isApiRequestLoading as isLoadingState,
    type CanonicalRequestStatus
  } from "../request-state.js";
  import { normalizeRoutePath } from "../../route-utils.js";
  import { sortOptionsAlphabetically } from "../../select-options.js";
  import { createTablePagination, loadPageResult, readPageItems, TABLE_PAGE_SIZE, type PageLoadMode } from "../../table-pagination.js";
  import BankView from "./BankView.svelte";
  import CeoView from "./CeoView.svelte";
  import MonitoringView from "./MonitoringView.svelte";
  import PartnersView from "./PartnersView.svelte";
  import ProjectsView from "./ProjectsView.svelte";
  import SettingsView from "./SettingsView.svelte";
  import VatView from "./VatView.svelte";

  type OfficePageId =
    | "dashboard"
    | "ceo"
    | "pnl"
    | "coa"
    | "transactions"
    | "imports"
    | "waveInvoices"
    | "reconciliation"
    | "pending"
    | "cashflow"
    | "clients"
    | "suppliers"
    | "projects"
    | "monitoring"
    | "bank"
    | "audit"
    | "vat"
    | "settings";
  type SelectFilterValue = string;
  type ImportSource = "mcb" | "sbi" | "csv" | "cashflow" | "pdf";
  type RequestStatus = CanonicalRequestStatus;
  type OfficePagedTableId = "divisionPnl" | "pnlCategory" | "planComptable" | "transactions" | "pending" | "reconciliation" | "audit";

  interface Props {
    readonly session: AuthSession;
    readonly onLogout: () => void;
  }

  interface OfficeNavItem {
    readonly id: OfficePageId;
    readonly label: string;
    readonly title: string;
    readonly subtitle: string;
  }

  interface OfficeNavGroup {
    readonly id: string;
    readonly label: string;
    readonly items: readonly OfficeNavItem[];
  }

  interface ImportUiState {
    readonly status: RequestStatus;
    readonly source: ImportSource;
    readonly fileName: string;
    readonly rows: readonly Readonly<Record<string, string>>[];
    readonly preview: BankImportPreviewResponse | null;
    readonly confirm: BankImportConfirmResponse | null;
    readonly message: string;
  }

  interface ImportPreviewTableRow {
    readonly id: string;
    readonly rowNumber: number;
    readonly date: string;
    readonly description: string;
    readonly amount: string;
    readonly direction: string;
    readonly currency: string;
    readonly status: "accepted" | "rejected";
    readonly reason: string;
  }

  interface PlanFormState {
    readonly kind: "department" | "division" | "category";
    readonly parentId: string;
    readonly code: string;
    readonly label: string;
    readonly active: boolean;
    readonly type: OfficeCategoryType;
  }

  interface OfficeKpi {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly accent: boolean;
  }

  interface DashboardStat {
    readonly label: string;
    readonly value: string;
    readonly trendDirection: StatTrendDirection;
    readonly trendValue: string;
    readonly trendDetail: string;
  }

  interface DashboardRunwayPanel {
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly cash: string;
    readonly burn: string;
    readonly monthsUsed: string;
    readonly excludedForeignAccounts: readonly string[];
  }

  const { session, onLogout }: Props = $props();
  const client = createShellApiClient();
  const officeWorkspaceId = "eeee-mu";
  const allValue = "all";
  const periodOptions = createPeriodOptions();
  const officeNavGroups: readonly OfficeNavGroup[] = [
    {
      id: "finance",
      label: "Finance",
      items: [
        {
          id: "dashboard",
          label: "Dashboard",
          title: "Office Dashboard",
          subtitle: "Finance, bank, monitoring, and project summary."
        },
        {
          id: "ceo",
          label: "CEO view",
          title: "CEO view",
          subtitle: "Executive summary composed from dashboard and validated P&L."
        },
        {
          id: "pnl",
          label: "P&L",
          title: "P&L · income statement",
          subtitle: "Validated projections · departments, divisions, and categories."
        },
        {
          id: "cashflow",
          label: "Cash Flow",
          title: "Cash-flow",
          subtitle: "Inflows, outflows, and closing balances by period."
        },
        {
          id: "vat",
          label: "VAT",
          title: "VAT report",
          subtitle: "VAT by period, derived from existing typed data."
        },
        {
          id: "coa",
          label: "Charts of Account",
          title: "Chart of accounts",
          subtitle: "Department → Division → Category."
        }
      ]
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        {
          id: "imports",
          label: "Imports",
          title: "Imports",
          subtitle: "Monthly bank statements with automatic analysis then confirmed import."
        },
        {
          id: "waveInvoices",
          label: "Wave invoices",
          title: "Wave invoices",
          subtitle: "Dedicated lane for Wave invoice operations and follow-up."
        },
        {
          id: "bank",
          label: "Bank",
          title: "Bank",
          subtitle: "Bank accounts, raw bank lines, and bank quality."
        },
        {
          id: "transactions",
          label: "Transactions",
          title: "Transactions",
          subtitle: "Ledger filtered by every Office dimension."
        },
        {
          id: "pending",
          label: "Pending",
          title: "Pending",
          subtitle: "Classification and batch validation."
        },
        {
          id: "reconciliation",
          label: "Reconciliation",
          title: "Reconciliation",
          subtitle: "Bank ↔ ledger matching and batch approval."
        }
      ]
    },
    {
      id: "reference",
      label: "References",
      items: [
        {
          id: "clients",
          label: "Clients",
          title: "Clients",
          subtitle: "Income-side lens over partners with client activity."
        },
        {
          id: "suppliers",
          label: "Suppliers",
          title: "Suppliers",
          subtitle: "Expense-side lens over partners with supplier activity."
        },
        {
          id: "projects",
          label: "Projects",
          title: "Projects",
          subtitle: "Project P&L and coherence checks from Office projections."
        }
      ]
    },
    {
      id: "administration",
      label: "Administration",
      items: [
        {
          id: "audit",
          label: "Audit log",
          title: "Audit log",
          subtitle: "Read-only trail of Office audit events."
        },
        {
          id: "monitoring",
          label: "Monitoring",
          title: "Monitoring",
          subtitle: "Integrity checks, bank quality, pending rows, imports, and audit trail."
        },
        {
          id: "settings",
          label: "Settings",
          title: "Settings",
          subtitle: "Read-only Office configuration: reference currency and maintenance."
        }
      ]
    }
  ];
  const officeNavItems: readonly OfficeNavItem[] = officeNavGroups.flatMap((group: OfficeNavGroup): readonly OfficeNavItem[] => group.items);

  const typeOptions: readonly SelectOption[] = [
    { label: "All types", value: allValue },
    { label: "Income", value: "income" },
    { label: "Expense", value: "expense" }
  ];
  const statusOptions: readonly SelectOption[] = [
    { label: "All statuses", value: allValue },
    { label: "Pending", value: "pending" },
    { label: "Draft", value: "draft" },
    { label: "Posted", value: "posted" },
    { label: "Reconciled", value: "reconciled" },
    { label: "Voided", value: "voided" }
  ];
  // Keep all lifecycle statuses visible in the filter so reconciliation reviewers
  // can audit both accepted and declined propositions.
  const reconciliationStatusOptions: readonly SelectOption[] = [
    { label: "All", value: allValue },
    { label: "Unmatched", value: "unmatched" },
    { label: "Suggested", value: "suggested" },
    { label: "Matched", value: "matched" },
    { label: "Rejected", value: "rejected" },
    { label: "Ignored", value: "ignored" }
  ];
  const importSourceOptions: readonly SelectOption[] = [
    { label: "MCB statement PDF", value: "mcb" },
    { label: "SBI statement PDF", value: "sbi" },
    { label: "Bank CSV", value: "csv" },
    { label: "Cashflow XLSX", value: "cashflow" },
    { label: "Receipt / invoice PDF", value: "pdf" }
  ];
  const bankStatementSourceOptions: readonly SelectOption[] = importSourceOptions.filter(
    (option: SelectOption): boolean => option.value === "mcb" || option.value === "sbi"
  );
  const planKindOptions: readonly SelectOption[] = [
    { label: "Department", value: "department" },
    { label: "Division", value: "division" },
    { label: "Category", value: "category" }
  ];
  const planTypeOptions: readonly SelectOption[] = [
    { label: "Income", value: "income" },
    { label: "Expense", value: "expense" }
  ];
  const createDirectionOptions: readonly SelectOption[] = [
    { label: "Expense", value: "expense" },
    { label: "Income", value: "income" }
  ];
  const importEditDirectionOptions: readonly SelectOption[] = [
    { label: "Debit", value: "debit" },
    { label: "Credit", value: "credit" }
  ];

  let activePageId = $state<OfficePageId>("dashboard");
  const navIcons: Readonly<Record<OfficePageId, IconName>> = {
    dashboard: "home",
    ceo: "eye",
    pnl: "chart-bar",
    coa: "layout-grid",
    transactions: "file-text",
    imports: "upload",
    waveInvoices: "upload",
    reconciliation: "check",
    pending: "clock",
    cashflow: "trending-up",
    clients: "users",
    suppliers: "users",
    projects: "folder",
    monitoring: "search",
    bank: "bank",
    audit: "calendar",
    vat: "file-text",
    settings: "settings"
  };
  const shellNavGroups = $derived<readonly WorkspaceNavGroup[]>(
    officeNavGroups.map((group: OfficeNavGroup): WorkspaceNavGroup => ({
      id: group.id,
      label: group.label,
      items: group.items
        .filter((item: OfficeNavItem): boolean => item.id !== "waveInvoices")
        .map((item: OfficeNavItem): WorkspaceNavItem => ({
        label: item.label,
        href: item.id,
        icon: navIcons[item.id],
        active: activePageId === item.id,
        disabled: false,
        badge: null
        }))
    }))
  );
  const officeTabItems = $derived<readonly OfficeNavItem[]>(
    officeNavGroups.flatMap((group: OfficeNavGroup) => group.items).filter((item) => item.id !== "waveInvoices")
  );
  const handleShellNavigate = (href: string): void => {
    selectPage(href as OfficePageId);
  };
  let periodScope = $state<PeriodScope>("year");
  let selectedPeriod = $state(getLatestDataPeriod());
  const today = todayIso();
  let customRange = $state<DateRange | null>(null);
  let dashboardState = $state<ApiRequestState<OfficeDashboardResponse>>(createIdleState<OfficeDashboardResponse>());
  let dashboardAnalyticsState = $state<ApiRequestState<OfficeDashboardAnalyticsResponse>>(createIdleState<OfficeDashboardAnalyticsResponse>());
  let pnlState = $state<ApiRequestState<OfficeGlobalPnl | OfficeDepartmentPnl>>(createIdleState<OfficeGlobalPnl | OfficeDepartmentPnl>());
  let divisionPnlState = $state<ApiRequestState<PageResult<OfficeDivisionPnl>>>(
    createIdleState<PageResult<OfficeDivisionPnl>>()
  );
  let pnlCategoryState = $state<ApiRequestState<PageResult<OfficePnlLine>>>(
    createIdleState<PageResult<OfficePnlLine>>()
  );
  let planTableState = $state<ApiRequestState<PageResult<OfficePlanComptableNode>>>(
    createIdleState<PageResult<OfficePlanComptableNode>>()
  );
  let planState = $state<ApiRequestState<readonly OfficePlanComptableNode[]>>(
    createIdleState<readonly OfficePlanComptableNode[]>()
  );
  let transactionsState = $state<ApiRequestState<PageResult<OfficeTransaction>>>(
    createIdleState<PageResult<OfficeTransaction>>()
  );
  let pendingState = $state<ApiRequestState<PageResult<OfficeTransaction>>>(
    createIdleState<PageResult<OfficeTransaction>>()
  );
  let reconciliationState = $state<ApiRequestState<PageResult<OfficeReconciliationCandidate>>>(
    createIdleState<PageResult<OfficeReconciliationCandidate>>()
  );
  let reconciliationOperationsState = $state<ApiRequestState<OfficeReconciliationOperationsResponse>>(
    createIdleState<OfficeReconciliationOperationsResponse>()
  );
  let cashflowState = $state<ApiRequestState<readonly CashflowBucket[]>>(
    createIdleState<readonly CashflowBucket[]>()
  );
  let auditState = $state<ApiRequestState<PageResult<AuditLogEntry>>>(
    createIdleState<PageResult<AuditLogEntry>>()
  );
  let tablePaginationLoading = $state<OfficePagedTableId | null>(null);
  let tablePaginationErrors = $state<Partial<Record<OfficePagedTableId, string | null>>>({});
  let actionReceipt = $state<ApiMutationReceipt | null>(null);
  let writesEnabled = $state(false);
  let writeGateMessage = $state("Checking write gate.");
  let departmentFilter = $state<SelectFilterValue>(allValue);
  let divisionFilter = $state<SelectFilterValue>(allValue);
  let categoryFilter = $state<SelectFilterValue>(allValue);
  let projectFilter = $state<SelectFilterValue>(allValue);
  let accountFilter = $state<SelectFilterValue>(allValue);
  let typeFilter = $state<SelectFilterValue>(allValue);
  let transactionStatusFilter = $state<SelectFilterValue>(allValue);
  // Default to "unmatched": this remains the primary queue even though imports can
  // produce suggested candidates for optional batch approval.
  let reconciliationStatusFilter = $state<SelectFilterValue>("unmatched");
  let selectedPendingIds = $state<readonly string[]>([]);
  let selectedReconciliationIds = $state<readonly string[]>([]);
  let pendingClassifyCategoryId = $state("");
  let pendingClassifyProjectId = $state("");
  let reconcileDrawerLineId = $state<string | null>(null);
  let reconcileDrawerMode = $state<"match" | "create">("match");
  let reconcileDrawerBankLabel = $state("");
  let reconcileMatchTransactionId = $state("");
  let reconcileCreateCategoryId = $state("");
  let reconcileCreateProjectId = $state("");
  let editingTransaction = $state<OfficeTransaction | null>(null);
  let editOccurredOn = $state("");
  let editDescription = $state("");
  let editAmount = $state("");
  let editCategoryId = $state("");
  let editProjectId = $state("");
  let editAccountId = $state("");
  let creatingTransaction = $state(false);
  let createOccurredOn = $state("");
  let createDescription = $state("");
  let createAccountId = $state("");
  let createCategoryId = $state("");
  let createProjectId = $state("");
  let createAmount = $state("");
  let createDirection = $state<"expense" | "income">("expense");
  let cashflowImportRecords = $state<readonly Readonly<Record<string, string>>[]>([]);
  let cashflowImportMessage = $state("Import a cashflow CSV (Month, Inflow, Outflow, ClosingBalance, Currency).");
  let ledgerBulkRows = $state<readonly OfficeLedgerBulkRow[]>([]);
  let ledgerBulkPreviewState = $state<ApiRequestState<OfficeLedgerBulkPreviewResponse>>(
    createIdleState<OfficeLedgerBulkPreviewResponse>()
  );
  let ledgerBulkMessage = $state("Import classified ledger CSV (legacyId/externalId, occurredOn, type, amount, currency, description).");
  let importState = $state<ImportUiState>({
    status: "idle",
    source: "mcb",
    fileName: "",
    rows: [],
    preview: null,
    confirm: null,
    message: "Choose a bank statement (PDF or CSV)."
  });
  let importAccounts = $state<readonly OfficeBankAccountSummary[]>([]);
  let selectedImportAccountId = $state<string>("");
  let importRowSelection = $state<Record<string, boolean>>({});
  let editingImportRowNumber = $state<number | null>(null);
  let importEditDate = $state("");
  let importEditDescription = $state("");
  let importEditAmount = $state("");
  let importEditDirection = $state<"debit" | "credit">("debit");
  let planForm = $state<PlanFormState>({
    kind: "category",
    parentId: "div_shared",
    code: "6090",
    label: "New category",
    active: true,
    type: "expense"
  });

  const activePage = $derived(getOfficeNavItem(activePageId));
  const period = $derived(selectedPeriod);
  const activeRange = $derived(rangeForScope(periodScope, today, customRange));
  const periodControlVisible = $derived(pageUsesPeriodControl(activePageId));
  const planNodes = $derived(readArrayState(planState));
  const planTableNodes = $derived(readPageItems(planTableState));
  const transactionRows = $derived(readPageItems(transactionsState));
  const pendingRows = $derived(readPageItems(pendingState));
  const pendingVisibleIds = $derived(pendingRows.map((transaction: OfficeTransaction): string => transaction.id));
  const pendingAllVisibleSelected = $derived(
    pendingVisibleIds.length > 0 && selectedPendingIds.length === pendingVisibleIds.length
  );
  const reconciliationRows = $derived(readPageItems(reconciliationState));
  const selectableReconciliationIds = $derived(
    reconciliationRows
      .filter((candidate: OfficeReconciliationCandidate): boolean => isReconciliationBulkCreatable(candidate))
      .map((candidate: OfficeReconciliationCandidate): string => candidate.id)
  );
  const selectedCreatableReconciliationIds = $derived(
    selectedReconciliationIds.filter((id: string): boolean => selectableReconciliationIds.includes(id))
  );
  const reconciliationAllVisibleSelected = $derived(
    selectableReconciliationIds.length > 0 && selectedCreatableReconciliationIds.length === selectableReconciliationIds.length
  );
  const cashflowRows = $derived(readArrayState(cashflowState));
  const auditRows = $derived(readPageItems(auditState));
  const auditTableRows = $derived(createAuditTableRows(auditRows));
  const pnlResult = $derived(readPnlResult(pnlState));
  const pnlRows = $derived(pnlResult?.projectionRows ?? []);
  const pnlLineRows = $derived(pnlResult?.lines ?? []);
  const pnlCategoryRows = $derived(readPageItems(pnlCategoryState));
  const divisionPnlRows = $derived(readPageItems(divisionPnlState));
  const departmentOptions = $derived(createPlanOptions(planNodes, "department", "All departments"));
  const divisionOptions = $derived(createPlanOptions(planNodes, "division", "All divisions"));
  const categoryOptions = $derived(createPlanOptions(planNodes, "category", "All categories"));
  const parentOptions = $derived(createParentOptions(planNodes));
  const projectOptions = $derived(createProjectOptions(transactionRows));
  const editCategoryOptions = $derived(
    sortOptionsAlphabetically(
      planNodes
        .filter((node: OfficePlanComptableNode): boolean => node.kind === "category")
        .map((node: OfficePlanComptableNode): SelectOption => ({ label: node.label, value: node.id })),
      0
    )
  );
  const editProjectOptions = $derived(
    createProjectOptions(transactionRows).filter((option: SelectOption): boolean => option.value !== allValue)
  );
  // Placeholder-prefixed option lists for the Select component (it renders options only,
  // so the "empty" choice has to be part of the list).
  const optionalCategoryOptions = $derived<readonly SelectOption[]>([
    { label: "— None —", value: "" },
    ...editCategoryOptions
  ]);
  const optionalProjectOptions = $derived<readonly SelectOption[]>([
    { label: "— None —", value: "" },
    ...editProjectOptions
  ]);
  const reconcileCategoryOptions = $derived<readonly SelectOption[]>([
    { label: "Draft — to classify", value: "" },
    ...editCategoryOptions
  ]);
  const reconcileProjectOptions = $derived<readonly SelectOption[]>([
    { label: "None", value: "" },
    ...editProjectOptions
  ]);
  const pendingCategoryOptions = $derived<readonly SelectOption[]>([
    { label: "Choose…", value: "" },
    ...editCategoryOptions
  ]);
  const pendingProjectOptions = $derived<readonly SelectOption[]>([
    { label: "Unchanged", value: "" },
    ...editProjectOptions
  ]);
  const createAccountSelectOptions = $derived<readonly SelectOption[]>(
    importAccounts.length === 0
      ? [{ label: "No bank account loaded", value: "" }]
      : sortOptionsAlphabetically(importAccounts.map(bankAccountSelectOption), 0)
  );
  const importAccountSelectOptions = $derived<readonly SelectOption[]>(
    importAccounts.length === 0
      ? [{ label: "No account — create one in the Bank tab", value: "" }]
      : sortOptionsAlphabetically([{ label: "Choose an account…", value: "" }, ...importAccounts.map(bankAccountSelectOption)], 1)
  );
  // Account filter options come from the workspace's real bank accounts (loaded once at
  // mount via loadImportAccounts) so filter values always match server-side account ids.
  const accountOptions = $derived<readonly SelectOption[]>(
    sortOptionsAlphabetically([
      { label: "All accounts", value: allValue },
      ...importAccounts.map((account: OfficeBankAccountSummary): SelectOption => ({
        label: `${account.bankName} · ${account.accountLabel} (${account.currency})`,
        value: account.id
      }))
    ], 1)
  );
  const canSubmitTransactionCreate = $derived(
    createOccurredOn.trim().length > 0 &&
    createDescription.trim().length > 0 &&
    createAccountId.length > 0 &&
    createAmount.trim().length > 0
  );
  const ledgerRowActions = $derived<readonly TableRowAction[]>([
    { label: "Edit", onAction: openTransactionEditor },
    { label: "Cancel", onAction: cancelTransactionById, danger: true }
  ]);
  const importRowActions = $derived<readonly TableRowAction[]>(
    session.roleId === "administrator"
      ? [
          {
            label: "Cancel import",
            onAction: reverseImportBatch,
            danger: true,
            isEnabled: canCancelRecentImport,
            disabledReason: recentImportCancelDisabledReason
          },
          {
            label: "Delete permanently",
            onAction: deleteImportBatch,
            danger: true,
            isEnabled: canDeleteRecentImport,
            disabledReason: recentImportDeleteDisabledReason
          }
        ]
      : [
          {
            label: "Cancel import",
            onAction: reverseImportBatch,
            danger: true,
            isEnabled: canCancelRecentImport,
            disabledReason: recentImportCancelDisabledReason
          }
        ]
  );
  const planRowActions = $derived<readonly TableRowAction[]>([
    { label: "Activate / Deactivate", onAction: togglePlanNodeActive },
    { label: "Delete", onAction: deletePlanNode, danger: true }
  ]);
  const reconciliationRowActions = $derived<readonly TableRowAction[]>([
    {
      label: "Select",
      onAction: toggleReconciliationSelection,
      isEnabled: canSelectReconciliationById
    },
    {
      label: "Unselect",
      onAction: toggleReconciliationSelection,
      isEnabled: canUnselectReconciliationById
    },
    { label: "Accept", onAction: acceptReconciliation },
    { label: "Match", onAction: openReconcileMatch },
    { label: "Create entry", onAction: openReconcileCreate },
    { label: "Unmatch", onAction: unmatchReconciliationById },
    { label: "Reject", onAction: rejectReconciliationById, danger: true }
  ]);
  const pendingRowActions = $derived<readonly TableRowAction[]>([
    {
      label: "Select",
      onAction: togglePendingSelection,
      isEnabled: canSelectPendingById
    },
    {
      label: "Unselect",
      onAction: togglePendingSelection,
      isEnabled: canUnselectPendingById
    },
    {
      label: "Validate",
      onAction: validatePendingById,
      isEnabled: canValidatePendingById,
      disabledReason: validatePendingDisabledReason
    }
  ]);
  const reconcileTransactionOptions = $derived(
    sortOptionsAlphabetically(
      transactionRows.map((transaction: OfficeTransaction): SelectOption => ({
        value: transaction.id,
        label: `${transaction.description} · ${formatSignedMicro(transaction.amountMicro, transaction.currency)}`
      })),
      0
    )
  );
  const reconcileMatchSelectOptions = $derived<readonly SelectOption[]>([
    { label: "Choose an entry…", value: "" },
    ...reconcileTransactionOptions
  ]);
  const dashboardStats = $derived(createDashboardStats(dashboardState));
  const pnlKpis = $derived(createPnlKpis(pnlState));
  const pnlChartPoints = $derived(createPnlChartPoints(pnlRows));
  const pnlTableRows = $derived(createPnlTableRows(pnlRows));
  const dashboardPnlRows = $derived(pnlTableRows.slice(0, 6));
  const pnlLineTableRows = $derived(createPnlLineTableRows(pnlCategoryRows));
  const pnlCategoryImpactPoints = $derived(createPnlCategoryImpactPoints(pnlLineRows));
  const divisionPnlTableRows = $derived(createDivisionPnlTableRows(divisionPnlRows));
  const planTableRows = $derived(createPlanTableRows(planTableNodes));
  const transactionTableRows = $derived(createTransactionTableRows(transactionRows));
  const pendingTableRows = $derived(createPendingTableRows(pendingRows, selectedPendingIds));
  const reconciliationTableRows = $derived(createReconciliationTableRows(reconciliationRows, selectedReconciliationIds));
  const divisionPnlPagination = $derived<TablePagination | null>(
    createTablePagination(divisionPnlState, tablePaginationLoading === "divisionPnl", tablePaginationError("divisionPnl"), loadMoreDivisionPnl, loadAllDivisionPnl)
  );
  const pnlCategoryPagination = $derived<TablePagination | null>(
    createTablePagination(pnlCategoryState, tablePaginationLoading === "pnlCategory", tablePaginationError("pnlCategory"), loadMorePnlCategory, loadAllPnlCategory)
  );
  const planPagination = $derived<TablePagination | null>(
    createTablePagination(planTableState, tablePaginationLoading === "planComptable", tablePaginationError("planComptable"), loadMorePlanComptableNodes, loadAllPlanComptableNodes)
  );
  const transactionPagination = $derived<TablePagination | null>(
    createTablePagination(transactionsState, tablePaginationLoading === "transactions", tablePaginationError("transactions"), loadMoreTransactions, loadAllTransactions)
  );
  const pendingPagination = $derived<TablePagination | null>(
    createTablePagination(pendingState, tablePaginationLoading === "pending", tablePaginationError("pending"), loadMorePendingTransactions, loadAllPendingTransactions)
  );
  const reconciliationPagination = $derived<TablePagination | null>(
    createTablePagination(
      reconciliationState,
      tablePaginationLoading === "reconciliation",
      tablePaginationError("reconciliation"),
      loadMoreReconciliations,
      loadAllReconciliations
    )
  );
  const auditPagination = $derived<TablePagination | null>(
    createTablePagination(auditState, tablePaginationLoading === "audit", tablePaginationError("audit"), loadMoreAuditLog, loadAllAuditLog)
  );
  const cashflowInflowPoints = $derived(createCashflowPoints(cashflowRows, "inflow"));
  const cashflowOutflowPoints = $derived(createCashflowPoints(cashflowRows, "outflow"));
  const cashflowTableRows = $derived(createCashflowTableRows(cashflowRows));
  const canPreviewImport = $derived(importState.rows.length > 0 && importState.status !== "loading");
  const importPreviewTableRows = $derived(buildImportPreviewTableRows(importState));
  const selectedImportRowIds = $derived(
    importPreviewTableRows
      .filter((row: ImportPreviewTableRow): boolean => row.status === "accepted" && importRowSelection[row.id] === true)
      .map((row: ImportPreviewTableRow): string => row.id)
  );
  const canConfirmImport = $derived(selectedImportRowIds.length > 0 && importState.status !== "loading");
  const recentImportRows = $derived(createRecentImportRows(dashboardState));
  const dashboardImportPoints = $derived(createDashboardImportPoints(dashboardState));
  const dashboardImportRows = $derived(recentImportRows.slice(0, 6));
  const dashboardAnalyticsKpis = $derived(createDashboardAnalyticsKpis(dashboardAnalyticsState));
  const dashboardRunwayPanel = $derived(createDashboardRunwayPanel(dashboardAnalyticsState));
  const dashboardExpenseCategoryPoints = $derived(createDashboardExpenseCategoryPoints(dashboardAnalyticsState));
  const dashboardExpenseCategoryRows = $derived(createDashboardExpenseCategoryRows(dashboardAnalyticsState));
  const dashboardProjectProfitabilityPoints = $derived(createDashboardProjectProfitabilityPoints(dashboardAnalyticsState));
  const dashboardProjectProfitabilityRows = $derived(createDashboardProjectProfitabilityRows(dashboardAnalyticsState));
  const dashboardReconciliationPoints = $derived(createDashboardReconciliationPoints(dashboardAnalyticsState));
  const dashboardReconciliationRows = $derived(createDashboardReconciliationRows(dashboardAnalyticsState));
  const dashboardExpenseTrendPoints = $derived(createDashboardExpenseTrendPoints(dashboardAnalyticsState));
  const dashboardExpenseTrendRows = $derived(createDashboardExpenseTrendRows(dashboardAnalyticsState));
  const coaStructurePoints = $derived(createCoaStructurePoints(planTableNodes));
  const transactionTypePoints = $derived(createTransactionTypePoints(transactionRows));
  const transactionStatusPoints = $derived(createTransactionStatusPoints(transactionRows));
  const importQualityPoints = $derived(createImportQualityPoints(importState));
  const reconciliationStatusPoints = $derived(createReconciliationStatusPoints(reconciliationRows));
  const reconciliationOperationsKpis = $derived(createReconciliationOperationsKpis(reconciliationOperationsState));
  const pendingStatusPoints = $derived(createPendingStatusPoints(pendingRows));
  const ledgerBulkPreview = $derived(
    ledgerBulkPreviewState.status === "success" ? ledgerBulkPreviewState.data : null
  );
  const auditActionPoints = $derived(createAuditActionPoints(auditRows));

  onMount((): (() => void) => {
    syncPageFromLocation();
    window.addEventListener("popstate", syncPageFromLocation);
    void loadInitialData();

    return (): void => {
      window.removeEventListener("popstate", syncPageFromLocation);
    };
  });

  async function loadInitialData(): Promise<void> {
    // Single-request screen bundle first; the individual loaders remain as the fallback
    // path (older API without /screen/office, or a transient bundle failure).
    const seeded = await loadOfficeScreen();
    if (seeded) {
      await Promise.all([loadDashboardAnalytics(), loadReconciliationOperations()]);
      return;
    }
    await Promise.all([
      loadWriteGate(),
      loadDashboard(),
      loadDashboardAnalytics(),
      loadPnlProjection(),
      loadPlanComptable(),
      loadTransactions(),
      loadPendingTransactions(),
      loadReconciliations(),
      loadReconciliationOperations(),
      loadCashflow(),
      loadAuditLog(),
      loadImportAccounts()
    ]);
  }

  function tablePaginationError(tableId: OfficePagedTableId): string | null {
    return tablePaginationErrors[tableId] ?? null;
  }

  function setTablePaginationError(tableId: OfficePagedTableId, error: string | null): void {
    tablePaginationErrors = {
      ...tablePaginationErrors,
      [tableId]: error
    };
  }

  async function loadOfficePageResult<TItem>(
    tableId: OfficePagedTableId,
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

  async function loadMoreDivisionPnl(): Promise<void> {
    await loadDivisionPnlPage("one");
  }

  async function loadAllDivisionPnl(): Promise<void> {
    await loadDivisionPnlPage("all");
  }

  async function loadDivisionPnlPage(mode: PageLoadMode): Promise<void> {
    await loadOfficePageResult(
      "divisionPnl",
      divisionPnlState,
      (state: ApiRequestState<PageResult<OfficeDivisionPnl>>): void => {
        divisionPnlState = state;
      },
      (cursor: string): Promise<PageResult<OfficeDivisionPnl>> =>
        client.office.getDivisionPnl({
          workspaceId: officeWorkspaceId,
          period,
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMorePnlCategory(): Promise<void> {
    await loadPnlCategoryPage("one");
  }

  async function loadAllPnlCategory(): Promise<void> {
    await loadPnlCategoryPage("all");
  }

  async function loadPnlCategoryPage(mode: PageLoadMode): Promise<void> {
    await loadOfficePageResult(
      "pnlCategory",
      pnlCategoryState,
      (state: ApiRequestState<PageResult<OfficePnlLine>>): void => {
        pnlCategoryState = state;
      },
      (cursor: string): Promise<PageResult<OfficePnlLine>> =>
        client.office.getCategoryPnl({
          workspaceId: officeWorkspaceId,
          period,
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
          departmentId: toNullableFilter(departmentFilter),
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMorePlanComptableNodes(): Promise<void> {
    await loadPlanComptableNodesPage("one");
  }

  async function loadAllPlanComptableNodes(): Promise<void> {
    await loadPlanComptableNodesPage("all");
  }

  async function loadPlanComptableNodesPage(mode: PageLoadMode): Promise<void> {
    await loadOfficePageResult(
      "planComptable",
      planTableState,
      (state: ApiRequestState<PageResult<OfficePlanComptableNode>>): void => {
        planTableState = state;
      },
      (cursor: string): Promise<PageResult<OfficePlanComptableNode>> =>
        client.office.listPlanComptableNodes({
          workspaceId: officeWorkspaceId,
          includeInactive: true,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreTransactions(): Promise<void> {
    await loadTransactionsPage("one");
  }

  async function loadAllTransactions(): Promise<void> {
    await loadTransactionsPage("all");
  }

  async function loadTransactionsPage(mode: PageLoadMode): Promise<void> {
    await loadOfficePageResult(
      "transactions",
      transactionsState,
      (state: ApiRequestState<PageResult<OfficeTransaction>>): void => {
        transactionsState = state;
      },
      (cursor: string): Promise<PageResult<OfficeTransaction>> =>
        client.office.listTransactions({
          workspaceId: officeWorkspaceId,
          period,
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
          accountId: toNullableFilter(accountFilter),
          departmentId: toNullableFilter(departmentFilter),
          divisionId: toNullableFilter(divisionFilter),
          categoryId: toNullableFilter(categoryFilter),
          projectId: toNullableFilter(projectFilter),
          type: toNullableCategoryType(typeFilter),
          status: toNullableTransactionStatus(transactionStatusFilter),
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMorePendingTransactions(): Promise<void> {
    await loadPendingTransactionsPage("one");
  }

  async function loadAllPendingTransactions(): Promise<void> {
    await loadPendingTransactionsPage("all");
  }

  async function loadPendingTransactionsPage(mode: PageLoadMode): Promise<void> {
    await loadOfficePageResult(
      "pending",
      pendingState,
      (state: ApiRequestState<PageResult<OfficeTransaction>>): void => {
        pendingState = state;
      },
      (cursor: string): Promise<PageResult<OfficeTransaction>> =>
        client.office.listPendingTransactions({
          workspaceId: officeWorkspaceId,
          period,
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
          accountId: null,
          departmentId: null,
          divisionId: null,
          categoryId: null,
          projectId: null,
          type: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  async function loadMoreReconciliations(): Promise<void> {
    await loadReconciliationsPage("one");
  }

  async function loadAllReconciliations(): Promise<void> {
    await loadReconciliationsPage("all");
  }

  async function loadReconciliationsPage(mode: PageLoadMode): Promise<void> {
    await loadOfficePageResult(
      "reconciliation",
      reconciliationState,
      (state: ApiRequestState<PageResult<OfficeReconciliationCandidate>>): void => {
        reconciliationState = state;
      },
      (cursor: string): Promise<PageResult<OfficeReconciliationCandidate>> =>
        client.office.listReconciliations({
          workspaceId: officeWorkspaceId,
          accountId: toNullableFilter(accountFilter),
          period,
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
          status: toNullableReconciliationStatus(reconciliationStatusFilter),
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
    await loadOfficePageResult(
      "audit",
      auditState,
      (state: ApiRequestState<PageResult<AuditLogEntry>>): void => {
        auditState = state;
      },
      (cursor: string): Promise<PageResult<AuditLogEntry>> =>
        client.office.listAuditLog({
          workspaceId: officeWorkspaceId,
          from: activeRange.from,
          to: activeRange.to,
          actorId: null,
          entityType: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        }),
      mode
    );
  }

  // Bank statements import into one existing account, so the importer needs the
  // workspace's accounts to send an explicit accountId — the API rejects every row
  // with "account_not_found" when no target account is resolved.
  async function loadImportAccounts(): Promise<void> {
    try {
      const accounts = await client.office.listBankAccounts({ workspaceId: officeWorkspaceId, cursor: null, limit: TABLE_PAGE_SIZE });
      importAccounts = accounts.items;
      if (selectedImportAccountId.length === 0) {
        selectedImportAccountId = defaultImportAccountId(importAccounts, null);
      }
    } catch {
      importAccounts = [];
    }
  }

  function bankAccountSelectOption(account: OfficeBankAccountSummary): SelectOption {
    return {
      label: `${account.bankName} · ${account.accountLabel} (${account.currency})${account.isActive ? "" : " — inactive"}`,
      value: account.id
    };
  }

  // Prefer an active account in the detected currency, then any active account, then any account.
  function defaultImportAccountId(
    accounts: readonly OfficeBankAccountSummary[],
    currency: string | null
  ): string {
    const byCurrency = currency === null
      ? null
      : accounts.find((account: OfficeBankAccountSummary): boolean => account.isActive && account.currency === currency);
    const anyActive = accounts.find((account: OfficeBankAccountSummary): boolean => account.isActive);
    return (byCurrency ?? anyActive ?? accounts[0])?.id ?? "";
  }

  async function loadWriteGate(): Promise<void> {
    try {
      // Read the write gate from the office-scoped route: the office role is 403 on cc/v1 since the
      // domain-authz fix, so reading it from cc/v1/status would leave the UI locked forever.
      const status = await client.office.getStatus({
        workspaceId: officeWorkspaceId
      });
      writesEnabled = status.writesEnabled;
      writeGateMessage = status.writesEnabled ? "writes enabled" : "enable writes";
    } catch (error: unknown) {
      writesEnabled = false;
      writeGateMessage = getErrorMessage(error);
    }
  }

  async function loadAuditLog(): Promise<void> {
    auditState = createLoadingState<PageResult<AuditLogEntry>>();

    try {
      const page = await client.office.listAuditLog({
        workspaceId: officeWorkspaceId,
        from: activeRange.from,
        to: activeRange.to,
        actorId: null,
        entityType: null,
        cursor: null,
        limit: TABLE_PAGE_SIZE
      });
      auditState = createSuccessState<PageResult<AuditLogEntry>>(page);
      setTablePaginationError("audit", null);
    } catch (error: unknown) {
      auditState = createErrorState<PageResult<AuditLogEntry>>(error);
    }
  }

  async function loadDashboard(): Promise<void> {
    dashboardState = beginReload<OfficeDashboardResponse>(dashboardState);

    try {
      const dashboard = await client.office.getDashboard({
        workspaceId: officeWorkspaceId,
        period,
        dateFrom: activeRange.from,
        dateTo: activeRange.to
      });
      dashboardState = createSuccessState<OfficeDashboardResponse>(dashboard);
    } catch (error: unknown) {
      dashboardState = createErrorState<OfficeDashboardResponse>(error);
    }
  }

  async function loadDashboardAnalytics(): Promise<void> {
    dashboardAnalyticsState = beginReload<OfficeDashboardAnalyticsResponse>(dashboardAnalyticsState);

    try {
      const analytics = await client.office.getDashboardAnalytics({
        workspaceId: officeWorkspaceId,
        period,
        dateFrom: activeRange.from,
        dateTo: activeRange.to
      });
      dashboardAnalyticsState = createSuccessState<OfficeDashboardAnalyticsResponse>(analytics);
    } catch (error: unknown) {
      dashboardAnalyticsState = createErrorState<OfficeDashboardAnalyticsResponse>(error);
    }
  }

  async function loadPnlProjection(): Promise<void> {
    pnlState = beginReload<OfficeGlobalPnl | OfficeDepartmentPnl>(pnlState);
    divisionPnlState = beginReload<PageResult<OfficeDivisionPnl>>(divisionPnlState);
    pnlCategoryState = beginReload<PageResult<OfficePnlLine>>(pnlCategoryState);

    try {
      const departmentId = toNullableFilter(departmentFilter);
      const [pnl, divisions, categoryRows] = await Promise.all([
        departmentId === null
          ? client.office.getGlobalPnl({
              workspaceId: officeWorkspaceId,
              period,
              dateFrom: activeRange.from,
              dateTo: activeRange.to
            })
          : client.office.getDepartmentPnl(departmentId, {
              workspaceId: officeWorkspaceId,
              period,
              dateFrom: activeRange.from,
              dateTo: activeRange.to
            }),
        client.office.getDivisionPnl({
          workspaceId: officeWorkspaceId,
          period,
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
          cursor: null,
          limit: TABLE_PAGE_SIZE
          }),
        client.office.getCategoryPnl({
          workspaceId: officeWorkspaceId,
          period,
          dateFrom: activeRange.from,
          dateTo: activeRange.to,
          departmentId,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      ]);
      pnlState = createSuccessState<OfficeGlobalPnl | OfficeDepartmentPnl>(pnl);
      divisionPnlState = createSuccessState<PageResult<OfficeDivisionPnl>>(divisions);
      pnlCategoryState = createSuccessState<PageResult<OfficePnlLine>>(categoryRows);
      setTablePaginationError("divisionPnl", null);
      setTablePaginationError("pnlCategory", null);
    } catch (error: unknown) {
      pnlState = createErrorState<OfficeGlobalPnl | OfficeDepartmentPnl>(error);
      divisionPnlState = createErrorState<PageResult<OfficeDivisionPnl>>(error);
      pnlCategoryState = createErrorState<PageResult<OfficePnlLine>>(error);
    }
  }

  async function loadPlanComptable(): Promise<void> {
    planState = beginReload<readonly OfficePlanComptableNode[]>(planState);
    planTableState = beginReload<PageResult<OfficePlanComptableNode>>(planTableState);

    try {
      const [nodes, pagedNodes] = await Promise.all([
        client.office.getPlanComptable({
          workspaceId: officeWorkspaceId,
          includeInactive: true
        }),
        client.office.listPlanComptableNodes({
          workspaceId: officeWorkspaceId,
          includeInactive: true,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      ]);
      planState = createSuccessState<readonly OfficePlanComptableNode[]>(nodes);
      planTableState = createSuccessState<PageResult<OfficePlanComptableNode>>(pagedNodes);
      setTablePaginationError("planComptable", null);
    } catch (error: unknown) {
      planState = createErrorState<readonly OfficePlanComptableNode[]>(error);
      planTableState = createErrorState<PageResult<OfficePlanComptableNode>>(error);
    }
  }

  async function loadTransactions(): Promise<void> {
    transactionsState = beginReload<PageResult<OfficeTransaction>>(transactionsState);

    try {
      const page = await client.office.listTransactions({
        workspaceId: officeWorkspaceId,
        period,
        dateFrom: activeRange.from,
        dateTo: activeRange.to,
        accountId: toNullableFilter(accountFilter),
        departmentId: toNullableFilter(departmentFilter),
        divisionId: toNullableFilter(divisionFilter),
        categoryId: toNullableFilter(categoryFilter),
        projectId: toNullableFilter(projectFilter),
        type: toNullableCategoryType(typeFilter),
        status: toNullableTransactionStatus(transactionStatusFilter),
        cursor: null,
        limit: TABLE_PAGE_SIZE
      });
      transactionsState = createSuccessState<PageResult<OfficeTransaction>>(page);
      setTablePaginationError("transactions", null);
    } catch (error: unknown) {
      transactionsState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
  }

  async function cancelTransactionById(transactionId: string): Promise<void> {
    if (!window.confirm("Cancel this transaction? It will be marked “cancelled” (excluded from figures, kept for audit).")) {
      return;
    }

    try {
      const receipt = await client.office.cancelTransaction(
        transactionId,
        { workspaceId: officeWorkspaceId },
        { idempotencyKey: createIdempotencyKey("transaction-cancel") }
      );
      actionReceipt = receipt;
      await Promise.all([loadTransactions(), loadPendingTransactions(), loadDashboard(), loadDashboardAnalytics()]);
    } catch (error: unknown) {
      transactionsState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
  }

  // Always interprets the input as a DECIMAL money value → micro units (10^6); never as
  // raw micro (avoids the apiMoneyToMicroUnits integer-passthrough footgun on form input).
  function decimalAmountToMicro(input: string): string {
    const match = /^([+-]?)(\d+)(?:[.,](\d+))?$/u.exec(input.trim().replace(",", "."));
    if (match === null) {
      throw new Error(`Invalid amount: ${input}`);
    }
    const sign = match[1] === "-" ? -1n : 1n;
    const whole = BigInt(match[2] ?? "0");
    const fraction = (match[3] ?? "").padEnd(6, "0").slice(0, 6);
    return (sign * (whole * 1_000_000n + BigInt(fraction))).toString();
  }

  // The edit/create panels render ABOVE the ledger table in DOM order, so when the user
  // clicks a row action after scrolling down, the panel opens outside the viewport and the
  // click looks like a no-op. Scroll the panel into view once Svelte has rendered it.
  let transactionPanelElement = $state<HTMLElement | null>(null);

  function scrollTransactionPanelIntoView(): void {
    void tick().then((): void => {
      transactionPanelElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function openTransactionEditor(transactionId: string): void {
    const transaction = transactionRows.find((row: OfficeTransaction): boolean => row.id === transactionId);
    if (transaction === undefined) {
      return;
    }
    creatingTransaction = false;
    editingTransaction = transaction;
    editOccurredOn = transaction.occurredOn.slice(0, 10);
    editDescription = transaction.description;
    editAmount = (Number(transaction.amountMicro) / 1_000_000).toFixed(2);
    editCategoryId = transaction.categoryId ?? "";
    editProjectId = transaction.projectId ?? "";
    editAccountId = transaction.accountId ?? defaultImportAccountId(importAccounts, transaction.currency);
    scrollTransactionPanelIntoView();
  }

  function closeTransactionEditor(): void {
    editingTransaction = null;
  }

  async function saveTransactionEdit(): Promise<void> {
    const transaction = editingTransaction;
    if (transaction === null) {
      return;
    }

    try {
      if (editAccountId.length === 0) {
        throw new Error("Choose a bank account for this transaction.");
      }
      const receipt = await client.office.updateTransaction(
        transaction.id,
        {
          workspaceId: officeWorkspaceId,
          occurredOn: editOccurredOn,
          accountId: editAccountId,
          categoryId: editCategoryId.length > 0 ? editCategoryId : null,
          projectId: editProjectId.length > 0 ? editProjectId : null,
          description: editDescription,
          amountMicro: decimalAmountToMicro(editAmount),
          currency: transaction.currency,
          type: transaction.type
        },
        { idempotencyKey: createIdempotencyKey("transaction-update") }
      );
      actionReceipt = receipt;
      editingTransaction = null;
      await Promise.all([loadTransactions(), loadPendingTransactions(), loadDashboard(), refreshReconciliationViews()]);
    } catch (error: unknown) {
      transactionsState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
  }

  async function validateEditingTransaction(): Promise<void> {
    const transaction = editingTransaction;
    if (transaction === null) {
      return;
    }

    try {
      const receipt = await client.office.validateTransaction(
        transaction.id,
        { workspaceId: officeWorkspaceId },
        { idempotencyKey: createIdempotencyKey("transaction-validate") }
      );
      actionReceipt = receipt;
      editingTransaction = null;
      await Promise.all([loadTransactions(), loadPendingTransactions(), loadDashboard(), refreshReconciliationViews()]);
    } catch (error: unknown) {
      transactionsState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
  }

  async function togglePlanNodeActive(nodeId: string): Promise<void> {
    const node = planNodes.find((candidate: OfficePlanComptableNode): boolean => candidate.id === nodeId);
    if (node === undefined) {
      return;
    }

    try {
      const receipt = await client.office.updatePlanComptableNode(
        nodeId,
        {
          workspaceId: officeWorkspaceId,
          parentId: node.parentId,
          kind: node.kind,
          code: node.code,
          label: node.label,
          active: !node.active,
          type: node.kind === "category" ? node.type : null
        },
        { idempotencyKey: createIdempotencyKey("plan-toggle") }
      );
      actionReceipt = receipt;
      await loadPlanComptable();
    } catch (error: unknown) {
      planState = createErrorState<readonly OfficePlanComptableNode[]>(error);
    }
  }

  async function deletePlanNode(nodeId: string): Promise<void> {
    const node = planNodes.find((candidate: OfficePlanComptableNode): boolean => candidate.id === nodeId);
    if (node === undefined) {
      return;
    }

    if (!window.confirm(`Delete ${node.kind} \"${node.label}\" permanently? This cannot be undone.`)) {
      return;
    }

    try {
      const receipt = await client.office.deletePlanComptableNode(
        nodeId,
        { workspaceId: officeWorkspaceId },
        { idempotencyKey: createIdempotencyKey("plan-delete") }
      );
      actionReceipt = receipt;
      await loadPlanComptable();
    } catch (error: unknown) {
      planState = createErrorState<readonly OfficePlanComptableNode[]>(error);
    }
  }

  async function acceptReconciliation(candidateId: string): Promise<void> {
    try {
      const receipt = await client.office.approveReconciliations(
        {
          workspaceId: officeWorkspaceId,
          reconciliationIds: [candidateId],
          approvedAt: new Date().toISOString()
        },
        { idempotencyKey: createIdempotencyKey("reconcile-accept") }
      );
      actionReceipt = receipt;
      await Promise.all([refreshReconciliationViews(), loadDashboard(), loadDashboardAnalytics(), loadTransactions()]);
    } catch (error: unknown) {
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  // Reconciliation candidate rows are keyed by candidate id, but the match/unmatch/reject/create
  // endpoints address the bank line — so resolve the line id from the candidate before each call.
  function reconcileLineIdFor(candidateId: string): string | null {
    return reconciliationRows.find((candidate: OfficeReconciliationCandidate): boolean => candidate.id === candidateId)?.statementLineId ?? null;
  }

  function openReconcileMatch(candidateId: string): void {
    const candidate = reconciliationRows.find((item: OfficeReconciliationCandidate): boolean => item.id === candidateId);
    if (candidate === undefined) {
      return;
    }
    reconcileDrawerLineId = candidate.statementLineId;
    reconcileDrawerMode = "match";
    reconcileDrawerBankLabel = candidate.bankDescription;
    reconcileMatchTransactionId = "";
  }

  function openReconcileCreate(candidateId: string): void {
    const candidate = reconciliationRows.find((item: OfficeReconciliationCandidate): boolean => item.id === candidateId);
    if (candidate === undefined) {
      return;
    }
    reconcileDrawerLineId = candidate.statementLineId;
    reconcileDrawerMode = "create";
    reconcileDrawerBankLabel = candidate.bankDescription;
    reconcileCreateCategoryId = "";
    reconcileCreateProjectId = "";
  }

  function closeReconcileDrawer(): void {
    reconcileDrawerLineId = null;
  }

  async function submitReconcileMatch(): Promise<void> {
    const statementLineId = reconcileDrawerLineId;
    if (statementLineId === null || reconcileMatchTransactionId.length === 0) {
      return;
    }
    try {
      const receipt = await client.office.matchReconciliation(
        { workspaceId: officeWorkspaceId, statementLineId, transactionId: reconcileMatchTransactionId, matchedAt: new Date().toISOString() },
        { idempotencyKey: createIdempotencyKey("reconcile-match") }
      );
      actionReceipt = receipt;
      reconcileDrawerLineId = null;
      await Promise.all([refreshReconciliationViews(), loadDashboard(), loadDashboardAnalytics(), loadTransactions()]);
    } catch (error: unknown) {
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  async function submitReconcileCreate(): Promise<void> {
    const statementLineId = reconcileDrawerLineId;
    if (statementLineId === null) {
      return;
    }
    try {
      const receipt = await client.office.createTransactionFromBankLine(
        {
          workspaceId: officeWorkspaceId,
          statementLineId,
          categoryId: reconcileCreateCategoryId.length > 0 ? reconcileCreateCategoryId : null,
          projectId: reconcileCreateProjectId.length > 0 ? reconcileCreateProjectId : null,
          matchedAt: new Date().toISOString()
        },
        { idempotencyKey: createIdempotencyKey("reconcile-create") }
      );
      actionReceipt = receipt;
      reconcileDrawerLineId = null;
      await Promise.all([
        refreshReconciliationViews(),
        loadTransactions(),
        loadPendingTransactions(),
        loadDashboard(),
        loadDashboardAnalytics()
      ]);
    } catch (error: unknown) {
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  async function unmatchReconciliationById(candidateId: string): Promise<void> {
    const statementLineId = reconcileLineIdFor(candidateId);
    if (statementLineId === null) {
      return;
    }
    try {
      const receipt = await client.office.unmatchReconciliation(
        { workspaceId: officeWorkspaceId, statementLineId },
        { idempotencyKey: createIdempotencyKey("reconcile-unmatch") }
      );
      actionReceipt = receipt;
      await Promise.all([refreshReconciliationViews(), loadDashboard(), loadDashboardAnalytics(), loadTransactions()]);
    } catch (error: unknown) {
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  async function rejectReconciliationById(candidateId: string): Promise<void> {
    const statementLineId = reconcileLineIdFor(candidateId);
    if (statementLineId === null) {
      return;
    }
    try {
      const receipt = await client.office.rejectReconciliation(
        { workspaceId: officeWorkspaceId, statementLineId },
        { idempotencyKey: createIdempotencyKey("reconcile-reject") }
      );
      actionReceipt = receipt;
      await Promise.all([refreshReconciliationViews(), loadDashboard(), loadDashboardAnalytics(), loadTransactions()]);
    } catch (error: unknown) {
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  function recentImportById(importId: string): OfficeRecentImport | null {
    if (dashboardState.status !== "success") {
      return null;
    }

    const found = (dashboardState.data.recentImports ?? []).find(
      (item: OfficeRecentImport): boolean => item.id === importId
    );

    if (found === undefined) {
      return null;
    }

    return found;
  }

  function canCancelRecentImport(importId: string): boolean {
    return canCancelRecentImportItem(recentImportById(importId));
  }

  function recentImportCancelDisabledReason(importId: string): string | null {
    return recentImportCancelDisabledReasonFor(recentImportById(importId));
  }

  function canDeleteRecentImport(importId: string): boolean {
    return canDeleteRecentImportItem(recentImportById(importId));
  }

  function recentImportDeleteDisabledReason(importId: string): string | null {
    return recentImportDeleteDisabledReasonFor(recentImportById(importId));
  }

  async function reverseImportBatch(batchId: string): Promise<void> {
    if (!canCancelRecentImport(batchId)) {
      return;
    }

    if (!window.confirm("Cancel this import? All its rows will be removed (action reserved for administrators).")) {
      return;
    }

    try {
      const receipt = await client.office.reverseBankImportBatch(
        batchId,
        { workspaceId: officeWorkspaceId },
        { idempotencyKey: createIdempotencyKey("import-reverse") }
      );
      actionReceipt = receipt;
      await Promise.all([loadDashboard(), loadDashboardAnalytics(), loadTransactions(), loadPendingTransactions(), refreshReconciliationViews()]);
    } catch (error: unknown) {
      dashboardState = createErrorState<OfficeDashboardResponse>(error);
    }
  }

  // Permanently removes the batch's own bank lines and reconciliation matches (and the
  // batch row); any transaction created from or matched to those lines is left untouched
  // (only its bank-line link disappears) — this cannot be undone, hence the double confirm.
  async function deleteImportBatch(batchId: string): Promise<void> {
    if (!canDeleteRecentImport(batchId)) {
      return;
    }

    if (!window.confirm("Permanently delete this import? Its bank lines and reconciliation matches are erased and cannot be recovered. Linked transactions are kept (cancel those separately if unwanted).")) {
      return;
    }

    if (!window.confirm("This is irreversible. Confirm permanent deletion?")) {
      return;
    }

    try {
      const receipt = await client.office.deleteBankImportBatch(
        batchId,
        { workspaceId: officeWorkspaceId },
        { idempotencyKey: createIdempotencyKey("import-delete") }
      );
      actionReceipt = receipt;
      await Promise.all([loadDashboard(), loadDashboardAnalytics(), loadTransactions(), loadPendingTransactions(), refreshReconciliationViews()]);
    } catch (error: unknown) {
      dashboardState = createErrorState<OfficeDashboardResponse>(error);
    }
  }

  // Client-side CSV download (RFC-4180 quoting) — no server round-trip needed.
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

  function exportTransactionsCsv(): void {
    const rows = transactionRows.map((transaction: OfficeTransaction): readonly string[] => [
      transaction.occurredOn.slice(0, 10),
      transaction.description,
      transaction.categoryLabel ?? "",
      transaction.projectLabel ?? "",
      transaction.type ?? "",
      (Number(typedSignedAmountMicro(transaction)) / 1_000_000).toFixed(2),
      transaction.currency,
      transaction.status
    ]);
    downloadCsv("transactions.csv", ["Date", "Description", "Category", "Project", "Type", "Amount", "Currency", "Status"], rows);
  }

  async function loadPendingTransactions(): Promise<void> {
    pendingState = beginReload<PageResult<OfficeTransaction>>(pendingState);

    try {
      const page = await client.office.listPendingTransactions({
        workspaceId: officeWorkspaceId,
        period,
        dateFrom: activeRange.from,
        dateTo: activeRange.to,
        accountId: null,
        departmentId: null,
        divisionId: null,
        categoryId: null,
        projectId: null,
        type: null,
        cursor: null,
        limit: TABLE_PAGE_SIZE
      });
      pendingState = createSuccessState<PageResult<OfficeTransaction>>(page);
      setTablePaginationError("pending", null);
      selectedPendingIds = selectedPendingIds.filter((id: string): boolean =>
        page.items.some((transaction: OfficeTransaction): boolean => transaction.id === id)
      );
    } catch (error: unknown) {
      pendingState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
  }

  async function loadReconciliations(): Promise<void> {
    reconciliationState = beginReload<PageResult<OfficeReconciliationCandidate>>(reconciliationState);

    try {
      const page = await client.office.listReconciliations({
        workspaceId: officeWorkspaceId,
        accountId: toNullableFilter(accountFilter),
        period,
        dateFrom: activeRange.from,
        dateTo: activeRange.to,
        status: toNullableReconciliationStatus(reconciliationStatusFilter),
        cursor: null,
        limit: TABLE_PAGE_SIZE
      });
      reconciliationState = createSuccessState<PageResult<OfficeReconciliationCandidate>>(page);
      setTablePaginationError("reconciliation", null);
      selectedReconciliationIds = selectedReconciliationIds.filter((id: string): boolean =>
        page.items.some((candidate: OfficeReconciliationCandidate): boolean => candidate.id === id && isReconciliationBulkCreatable(candidate))
      );
    } catch (error: unknown) {
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  async function loadReconciliationOperations(): Promise<void> {
    reconciliationOperationsState = beginReload<OfficeReconciliationOperationsResponse>(reconciliationOperationsState);

    try {
      const operations = await client.office.getReconciliationOperations({
        workspaceId: officeWorkspaceId,
        accountId: toNullableFilter(accountFilter),
        period,
        dateFrom: activeRange.from,
        dateTo: activeRange.to
      });
      reconciliationOperationsState = createSuccessState<OfficeReconciliationOperationsResponse>(operations);
    } catch (error: unknown) {
      reconciliationOperationsState = createErrorState<OfficeReconciliationOperationsResponse>(error);
    }
  }

  async function refreshReconciliationViews(): Promise<void> {
    await Promise.all([loadReconciliations(), loadReconciliationOperations()]);
  }

  async function loadCashflow(): Promise<void> {
    cashflowState = beginReload<readonly CashflowBucket[]>(cashflowState);

    try {
      const rows = await client.office.getCashflow({
        workspaceId: officeWorkspaceId,
        from: activeRange.from,
        to: activeRange.to,
        accountId: toNullableFilter(accountFilter)
      });
      cashflowState = createSuccessState<readonly CashflowBucket[]>(rows);
    } catch (cashflowLoadError: unknown) {
      cashflowState = createErrorState<readonly CashflowBucket[]>(cashflowLoadError);
    }
  }

  async function handleCashflowFile(event: Event): Promise<void> {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.item(0) ?? null;
    if (file === null) {
      return;
    }

    try {
      const records = parseCsvRecords(await file.text());
      if (records.length === 0) {
        cashflowImportRecords = [];
        cashflowImportMessage = "No readable row in this CSV.";
        return;
      }
      const preview = await client.office.previewCashflowImport(
        { workspaceId: officeWorkspaceId, rows: records },
        { idempotencyKey: createIdempotencyKey("cashflow-preview") }
      );
      cashflowImportRecords = records;
      cashflowImportMessage = `${preview.acceptedRowCount} rows ready · ${preview.rejectedRowCount} rejected.`;
    } catch (error: unknown) {
      cashflowImportRecords = [];
      cashflowImportMessage = getErrorMessage(error);
    }
  }

  async function confirmCashflowFileImport(): Promise<void> {
    if (cashflowImportRecords.length === 0) {
      return;
    }

    try {
      const receipt = await client.office.confirmCashflowImport(
        { workspaceId: officeWorkspaceId, rows: cashflowImportRecords },
        { idempotencyKey: createIdempotencyKey("cashflow-confirm") }
      );
      actionReceipt = receipt;
      cashflowImportRecords = [];
      cashflowImportMessage = "Cashflow imported.";
      await Promise.all([loadCashflow(), loadDashboard(), loadDashboardAnalytics()]);
    } catch (error: unknown) {
      cashflowImportMessage = getErrorMessage(error);
    }
  }

  async function handleLedgerBulkFile(event: Event): Promise<void> {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.item(0) ?? null;
    if (file === null) {
      return;
    }

    try {
      const records = parseCsvRecords(await file.text());
      const rows = normalizeLedgerBulkRows(records);
      if (rows.length === 0) {
        ledgerBulkRows = [];
        ledgerBulkPreviewState = createIdleState<OfficeLedgerBulkPreviewResponse>();
        ledgerBulkMessage = "No valid ledger row found. Required: legacyId/externalId, occurredOn, type, amount, currency, description.";
        return;
      }

      ledgerBulkRows = rows;
      await previewLedgerBulkRows(rows);
    } catch (error: unknown) {
      ledgerBulkRows = [];
      ledgerBulkPreviewState = createErrorState<OfficeLedgerBulkPreviewResponse>(error);
      ledgerBulkMessage = getErrorMessage(error);
    }
  }

  async function previewLedgerBulkRows(rows: readonly OfficeLedgerBulkRow[]): Promise<void> {
    ledgerBulkPreviewState = createLoadingState<OfficeLedgerBulkPreviewResponse>();

    try {
      const preview = await client.office.previewLedgerBulk(
        { workspaceId: officeWorkspaceId, rows },
        { idempotencyKey: createIdempotencyKey("ledger-bulk-preview") }
      );
      ledgerBulkPreviewState = createSuccessState<OfficeLedgerBulkPreviewResponse>(preview);
      ledgerBulkMessage = `${preview.acceptedRowCount} accepted · ${preview.rejectedRowCount} rejected · ${preview.validatedRowCount} will validate.`;
    } catch (error: unknown) {
      ledgerBulkPreviewState = createErrorState<OfficeLedgerBulkPreviewResponse>(error);
      ledgerBulkMessage = getErrorMessage(error);
    }
  }

  async function confirmLedgerBulkImport(): Promise<void> {
    if (ledgerBulkRows.length === 0) {
      return;
    }

    try {
      const receipt = await client.office.confirmLedgerBulk(
        { workspaceId: officeWorkspaceId, rows: ledgerBulkRows },
        { idempotencyKey: createIdempotencyKey("ledger-bulk-confirm") }
      );
      actionReceipt = receipt;
      ledgerBulkRows = [];
      ledgerBulkPreviewState = createIdleState<OfficeLedgerBulkPreviewResponse>();
      ledgerBulkMessage = `${receipt.upsertedRowCount} ledger row(s) upserted.`;
      await Promise.all([
        loadTransactions(),
        loadPendingTransactions(),
        loadDashboard(),
        loadDashboardAnalytics(),
        refreshReconciliationViews()
      ]);
    } catch (error: unknown) {
      ledgerBulkMessage = getErrorMessage(error);
    }
  }

  function normalizeLedgerBulkRows(rows: readonly Readonly<Record<string, string>>[]): readonly OfficeLedgerBulkRow[] {
    const normalized: OfficeLedgerBulkRow[] = [];

    for (const raw of rows) {
      const legacyId = parseOptionalNumber(raw.legacyId ?? raw.legacy_id ?? raw.tx_id);
      const externalId = parseOptionalNumber(raw.externalId ?? raw.external_id);
      const occurredOn = nullableText(raw.occurredOn ?? raw.occurred_on ?? raw.date ?? raw.transactionDate);
      const type = normalizeLedgerType(raw.type ?? raw.direction ?? raw.sens);
      const amount = nullableText(raw.amount ?? raw.amountMinor ?? raw.amount_minor ?? raw.value);
      const currency = normalizeLedgerCurrency(raw.currency ?? "MUR");
      const description = nullableText(raw.description ?? raw.label ?? raw.libelle);

      if ((legacyId === undefined && externalId === undefined) || occurredOn === null || type === null || amount === null || currency === null || description === null) {
        continue;
      }

      normalized.push({
        ...(legacyId === undefined ? {} : { legacyId }),
        ...(externalId === undefined ? {} : { externalId }),
        occurredOn,
        type,
        amount,
        currency,
        description,
        departmentId: nullableText(raw.departmentId),
        divisionId: nullableText(raw.divisionId),
        categoryId: nullableText(raw.categoryId),
        departmentName: nullableText(raw.departmentName ?? raw.department),
        divisionName: nullableText(raw.divisionName ?? raw.division),
        categoryName: nullableText(raw.categoryName ?? raw.category),
        partnerName: nullableText(raw.partnerName ?? raw.partner),
        accountCode: nullableText(raw.accountCode ?? raw.account_code),
        accountLabel: nullableText(raw.accountLabel ?? raw.account_label),
        projectId: nullableText(raw.projectId)
      });
    }

    return normalized;
  }

  function normalizeLedgerType(value: string | undefined): "income" | "expense" | null {
    if (value === undefined) {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized === "income" || normalized === "credit") {
      return "income";
    }
    if (normalized === "expense" || normalized === "debit") {
      return "expense";
    }
    return null;
  }

  function nullableText(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  function parseOptionalNumber(value: string | undefined): number | undefined {
    const text = nullableText(value);
    if (text === null) {
      return undefined;
    }
    const parsed = Number.parseInt(text, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function normalizeLedgerCurrency(value: string): CurrencyCode | null {
    const normalized = value.trim().toUpperCase();
    return /^[A-Z]{3}$/u.test(normalized) ? (normalized as CurrencyCode) : null;
  }

  function selectPage(pageId: OfficePageId): void {
    activePageId = pageId;
    pushPagePath(pageId);
  }

  function syncPageFromLocation(): void {
    activePageId = readPageIdFromPath(window.location.pathname);
  }

  function pushPagePath(pageId: OfficePageId): void {
    const nextPath = pagePath(pageId);
    const currentPath = window.location.pathname;
    if (currentPath === nextPath) {
      return;
    }

    window.history.pushState(null, "", `${nextPath}${window.location.search}`);
  }

  function readPageIdFromPath(pathname: string): OfficePageId {
    const normalizedPath = normalizeRoutePath(pathname);

    if (normalizedPath.endsWith("/console/office/dashboard")) {
      return "dashboard";
    }

    if (normalizedPath.endsWith("/console/office-dashboard")) {
      return "dashboard";
    }

    if (normalizedPath.endsWith("/console/ceo")) {
      return "ceo";
    }

    if (normalizedPath.endsWith("/console/office/ceo")) {
      return "ceo";
    }

    if (normalizedPath.endsWith("/console/office-imports")) {
      return "imports";
    }

    // Legacy Office route now has its own dedicated page.
    if (normalizedPath.endsWith("/console/wave-invoices")) {
      return "waveInvoices";
    }

    if (normalizedPath.endsWith("/console/pl")) {
      return "pnl";
    }

    if (normalizedPath.endsWith("/console/pnl")) {
      return "pnl";
    }

    if (normalizedPath.endsWith("/console/office-audit")) {
      return "audit";
    }

    if (normalizedPath.endsWith("/console/audit")) {
      return "audit";
    }

    if (normalizedPath.endsWith("/console/office-settings")) {
      return "settings";
    }

    if (normalizedPath.endsWith("/console/settings")) {
      return "settings";
    }

    if (normalizedPath.endsWith("/console/coa")) {
      return "coa";
    }

    if (normalizedPath.endsWith("/console/plan-comptable")) {
      return "coa";
    }

    if (normalizedPath.endsWith("/console/chart-of-accounts")) {
      return "coa";
    }

    if (normalizedPath.endsWith("/console/transactions")) {
      return "transactions";
    }

    if (normalizedPath.endsWith("/console/imports")) {
      return "imports";
    }

    if (normalizedPath.endsWith("/console/reconciliation")) {
      return "reconciliation";
    }

    if (normalizedPath.endsWith("/console/reconciliations")) {
      return "reconciliation";
    }

    if (normalizedPath.endsWith("/console/pending")) {
      return "pending";
    }

    if (normalizedPath.endsWith("/console/cashflow")) {
      return "cashflow";
    }

    if (normalizedPath.endsWith("/console/clients")) {
      return "clients";
    }

    if (normalizedPath.endsWith("/console/suppliers")) {
      return "suppliers";
    }

    if (normalizedPath.endsWith("/console/projects")) {
      return "projects";
    }

    if (normalizedPath.endsWith("/console/monitoring")) {
      return "monitoring";
    }

    if (normalizedPath.endsWith("/console/integrity")) {
      return "monitoring";
    }

    if (normalizedPath.endsWith("/console/vat")) {
      return "vat";
    }

    if (normalizedPath.endsWith("/console/bank")) {
      return "bank";
    }

    if (normalizedPath.endsWith("/console/office/bank")) {
      return "bank";
    }

    if (normalizedPath.endsWith("/console/office/audit")) {
      return "audit";
    }

    if (normalizedPath.endsWith("/console/office/chart-of-accounts")) {
      return "coa";
    }

    if (normalizedPath.endsWith("/console/office/plan-comptable")) {
      return "coa";
    }

    if (normalizedPath.endsWith("/console/office/vat")) {
      return "vat";
    }

    if (normalizedPath.endsWith("/console/office/settings")) {
      return "settings";
    }

    if (normalizedPath.endsWith("/console/office/clients")) {
      return "clients";
    }

    if (normalizedPath.endsWith("/console/office/suppliers")) {
      return "suppliers";
    }

    if (normalizedPath.endsWith("/console/office/projects")) {
      return "projects";
    }

    if (normalizedPath.endsWith("/console/office/monitoring")) {
      return "monitoring";
    }

    if (normalizedPath.endsWith("/console/office/integrity")) {
      return "monitoring";
    }

    if (normalizedPath.endsWith("/console/office/transactions")) {
      return "transactions";
    }

    if (normalizedPath.endsWith("/console/office/pl")) {
      return "pnl";
    }

    if (normalizedPath.endsWith("/console/office/pnl")) {
      return "pnl";
    }

    if (normalizedPath.endsWith("/console/office/imports")) {
      return "imports";
    }

    if (normalizedPath.endsWith("/console/office/wave-invoices")) {
      return "waveInvoices";
    }

    if (normalizedPath.endsWith("/console/office/reconciliation")) {
      return "reconciliation";
    }

    if (normalizedPath.endsWith("/console/office/reconciliations")) {
      return "reconciliation";
    }

    if (normalizedPath.endsWith("/console/office/pending")) {
      return "pending";
    }

    if (normalizedPath.endsWith("/console/office/cashflow")) {
      return "cashflow";
    }

    if (normalizedPath.endsWith("/console/office/coa")) {
      return "coa";
    }

    return "dashboard";
  }

  function pagePath(pageId: OfficePageId): string {
    if (pageId === "dashboard") {
      return "/console/office/dashboard";
    }

    if (pageId === "ceo") {
      return "/console/office/ceo";
    }

    if (pageId === "bank") {
      return "/console/office/bank";
    }

    if (pageId === "audit") {
      return "/console/office/audit";
    }


    if (pageId === "vat") {
      return "/console/office/vat";
    }

    if (pageId === "settings") {
      return "/console/office/settings";
    }

    if (pageId === "clients") {
      return "/console/office/clients";
    }

    if (pageId === "suppliers") {
      return "/console/office/suppliers";
    }

    if (pageId === "projects") {
      return "/console/office/projects";
    }

    if (pageId === "monitoring") {
      return "/console/office/monitoring";
    }

    if (pageId === "transactions") {
      return "/console/office/transactions";
    }

    if (pageId === "imports") {
      return "/console/office/imports";
    }

    if (pageId === "waveInvoices") {
      return "/console/office/wave-invoices";
    }

    if (pageId === "reconciliation") {
      return "/console/office/reconciliation";
    }

    if (pageId === "pending") {
      return "/console/office/pending";
    }

    if (pageId === "cashflow") {
      return "/console/office/cashflow";
    }

    if (pageId === "coa") {
      return "/console/office/coa";
    }

    return "/console/office/pnl";
  }

  function receivePartnerReceipt(receipt: ApiMutationReceipt): void {
    actionReceipt = receipt;
  }

  function updateDepartmentFilter(value: string): void {
    departmentFilter = value;
  }

  function updateDivisionFilter(value: string): void {
    divisionFilter = value;
  }

  function updateCategoryFilter(value: string): void {
    categoryFilter = value;
  }

  function updateProjectFilter(value: string): void {
    projectFilter = value;
  }

  function updateAccountFilter(value: string): void {
    accountFilter = value;
  }

  function updateTypeFilter(value: string): void {
    typeFilter = value;
  }

  function updateTransactionStatusFilter(value: string): void {
    transactionStatusFilter = value;
  }

  function updateReconciliationStatusFilter(value: string): void {
    reconciliationStatusFilter = value;
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

  function updateImportSource(value: string): void {
    const source = officeImportSourceFromValue(value);
    const rows = importState.rows;
    const fileName = importState.fileName;

    importState = {
      ...importState,
      source,
      preview: null,
      confirm: null,
      message: rows.length > 0 ? "Source corrected. Re-running API analysis." : "Source corrected."
    };

    if (rows.length > 0 && fileName.length > 0) {
      void previewImportRows(rows, source, fileName);
    }
  }

  function updatePlanKind(value: string): void {
    planForm = {
      ...planForm,
      kind: value as "department" | "division" | "category"
    };
  }

  function updatePlanParent(value: string): void {
    planForm = {
      ...planForm,
      parentId: value
    };
  }

  function updatePlanCode(value: string): void {
    planForm = {
      ...planForm,
      code: value
    };
  }

  function updatePlanLabel(value: string): void {
    planForm = {
      ...planForm,
      label: value
    };
  }

  function updatePlanType(value: string): void {
    planForm = {
      ...planForm,
      type: value as OfficeCategoryType
    };
  }

  async function applyTransactionFilters(): Promise<void> {
    await loadTransactions();
  }

  async function applyPnlFilters(): Promise<void> {
    await loadPnlProjection();
  }

  async function applyReconciliationFilters(): Promise<void> {
    await refreshReconciliationViews();
  }

  async function applyCashflowFilters(): Promise<void> {
    await loadCashflow();
  }

  // One network round trip instead of ~10: the screen bundle seeds every period-scoped
  // state at once. Sub-payloads are fetched with the DEFAULT filters, so any filter the
  // user changed is refetched individually right after (still cheaper than the old
  // full fan-out). Returns false when the bundle call failed so callers can fall back.
  async function loadOfficeScreen(): Promise<boolean> {
    try {
      const screen = await client.office.getScreen({
        workspaceId: officeWorkspaceId,
        period,
        dateFrom: activeRange.from,
        dateTo: activeRange.to
      });
      writesEnabled = screen.status.writesEnabled;
      writeGateMessage = screen.status.writesEnabled ? "writes enabled" : "enable writes";
      dashboardState = createSuccessState<OfficeDashboardResponse>(screen.dashboard);
      pnlState = createSuccessState<OfficeGlobalPnl | OfficeDepartmentPnl>(screen.globalPnl);
      divisionPnlState = createSuccessState<PageResult<OfficeDivisionPnl>>(screen.divisionPnl);
      pnlCategoryState = createSuccessState<PageResult<OfficePnlLine>>({
        items: screen.globalPnl.lines.slice(0, TABLE_PAGE_SIZE),
        nextCursor: screen.globalPnl.lines.length > TABLE_PAGE_SIZE ? String(TABLE_PAGE_SIZE) : null
      });
      setTablePaginationError("divisionPnl", null);
      setTablePaginationError("pnlCategory", null);
      planState = createSuccessState<readonly OfficePlanComptableNode[]>(screen.planComptable);
      planTableState = createSuccessState<PageResult<OfficePlanComptableNode>>({
        items: screen.planComptable.slice(0, TABLE_PAGE_SIZE),
        nextCursor: screen.planComptable.length > TABLE_PAGE_SIZE ? String(TABLE_PAGE_SIZE) : null
      });
      setTablePaginationError("planComptable", null);
      transactionsState = createSuccessState<PageResult<OfficeTransaction>>(screen.transactions);
      setTablePaginationError("transactions", null);
      pendingState = createSuccessState<PageResult<OfficeTransaction>>(screen.pendingTransactions);
      setTablePaginationError("pending", null);
      reconciliationState = createSuccessState<PageResult<OfficeReconciliationCandidate>>(screen.reconciliations);
      setTablePaginationError("reconciliation", null);
      cashflowState = createSuccessState<readonly CashflowBucket[]>(screen.cashflow);
      auditState = createSuccessState<PageResult<AuditLogEntry>>(screen.auditLog);
      setTablePaginationError("audit", null);
      importAccounts = screen.bankAccounts.items;
      if (selectedImportAccountId.length === 0) {
        selectedImportAccountId = defaultImportAccountId(importAccounts, null);
      }
      return true;
    } catch {
      return false;
    }
  }

  function hasCustomTransactionFilters(): boolean {
    return (
      accountFilter !== allValue ||
      departmentFilter !== allValue ||
      divisionFilter !== allValue ||
      categoryFilter !== allValue ||
      projectFilter !== allValue ||
      typeFilter !== allValue ||
      transactionStatusFilter !== allValue
    );
  }

  async function reloadPeriodScopedData(): Promise<void> {
    const seeded = await loadOfficeScreen();
    if (!seeded) {
      await Promise.all([
        loadDashboard(),
        loadDashboardAnalytics(),
        loadPnlProjection(),
        loadTransactions(),
        loadPendingTransactions(),
        loadReconciliations(),
        loadReconciliationOperations(),
        loadCashflow()
      ]);
      return;
    }

    // The bundle used default filters — refetch only the sections whose active filter differs.
    const followUps: Promise<void>[] = [loadDashboardAnalytics(), loadReconciliationOperations()];
    if (departmentFilter !== allValue) {
      followUps.push(loadPnlProjection());
    }
    if (hasCustomTransactionFilters()) {
      followUps.push(loadTransactions());
    }
    if (accountFilter !== allValue || reconciliationStatusFilter !== "unmatched") {
      followUps.push(loadReconciliations());
    }
    if (accountFilter !== allValue) {
      followUps.push(loadCashflow());
    }
    await Promise.all(followUps);
  }

  // Join the API's per-row verdict (accepted/rejected + issues) with the locally parsed rows so the
  // import table shows date/amount/description alongside the reason. Rejected rows are listed first.
  function buildImportPreviewTableRows(state: ImportUiState): readonly ImportPreviewTableRow[] {
    const preview = state.preview;
    if (preview === null) {
      return [];
    }
    const rows = preview.rowResults.map((result: OfficeBankPreviewRowResult): ImportPreviewTableRow => {
      const raw: Readonly<Record<string, string>> = state.rows[result.rowNumber - 1] ?? {};
      const debit = raw.debit ?? "";
      const credit = raw.credit ?? "";
      const isCredit = credit.trim().length > 0 && debit.trim().length === 0;
      return {
        id: result.id,
        rowNumber: result.rowNumber,
        date: raw.transactionDate ?? raw.date ?? "",
        description: raw.description ?? "",
        amount: isCredit ? credit : debit,
        direction: isCredit ? "Credit" : "Debit",
        currency: raw.currency ?? "",
        status: result.status,
        reason: result.issues.map(describeRejectionReason).join(", ")
      };
    });
    return [...rows].sort((left: ImportPreviewTableRow, right: ImportPreviewTableRow): number =>
      left.status === right.status ? left.rowNumber - right.rowNumber : left.status === "rejected" ? -1 : 1
    );
  }

  function initImportSelection(preview: BankImportPreviewResponse): void {
    const selection: Record<string, boolean> = {};
    for (const result of preview.rowResults) {
      if (result.status === "accepted") {
        selection[result.id] = true;
      }
    }
    importRowSelection = selection;
  }

  function toggleImportRow(id: string): void {
    importRowSelection = { ...importRowSelection, [id]: importRowSelection[id] !== true };
  }

  function setAllImportRows(value: boolean): void {
    const selection: Record<string, boolean> = {};
    for (const row of importPreviewTableRows) {
      if (row.status === "accepted") {
        selection[row.id] = value;
      }
    }
    importRowSelection = selection;
  }

  function startImportRowEdit(rowNumber: number): void {
    const raw = importState.rows[rowNumber - 1];
    if (raw === undefined) {
      return;
    }
    editingImportRowNumber = rowNumber;
    importEditDate = raw.transactionDate ?? raw.date ?? "";
    importEditDescription = raw.description ?? "";
    const debit = raw.debit ?? "";
    const credit = raw.credit ?? "";
    importEditDirection = credit.trim().length > 0 && debit.trim().length === 0 ? "credit" : "debit";
    importEditAmount = importEditDirection === "credit" ? credit : debit;
  }

  function cancelImportRowEdit(): void {
    editingImportRowNumber = null;
  }

  // Apply a manual fix to one rejected row, then re-run the preview so the API re-validates it.
  async function applyImportRowEdit(): Promise<void> {
    const rowNumber = editingImportRowNumber;
    if (rowNumber === null) {
      return;
    }
    const index = rowNumber - 1;
    const existing = importState.rows[index];
    if (existing === undefined) {
      return;
    }
    const corrected: Record<string, string> = {
      ...existing,
      transactionDate: importEditDate.trim(),
      description: importEditDescription.trim()
    };
    delete corrected.debit;
    delete corrected.credit;
    corrected[importEditDirection] = importEditAmount.trim();
    const nextRows = importState.rows.map(
      (row: Readonly<Record<string, string>>, position: number): Readonly<Record<string, string>> =>
        position === index ? corrected : row
    );
    editingImportRowNumber = null;
    await previewImportRows(nextRows, importState.source, importState.fileName);
  }

  async function handleStatementFile(event: Event): Promise<void> {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.item(0) ?? null;
    if (file === null) {
      return;
    }

    importState = {
      ...importState,
      status: "loading",
      fileName: file.name,
      rows: [],
      preview: null,
      confirm: null,
      message: "Reading the statement."
    };

    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
      const text = isCsv ? await file.text() : await extractPdfText(file);
      const parsed = await client.office.parseBankImportPreview({
        workspaceId: officeWorkspaceId,
        fileName: file.name,
        sourceHint: isCsv ? "csv" : null,
        contentText: text
      }, {
        idempotencyKey: createIdempotencyKey("import-parse-preview")
      });

      await applyBackendParsedImportRows(file.name, parsed);
    } catch (error: unknown) {
      importState = { ...importState, status: "error", rows: [], message: getErrorMessage(error) };
    }
  }

  async function applyBackendParsedImportRows(fileName: string, parsed: BankImportParsePreviewResponse): Promise<void> {
    const source = parsed.source;
    const currency = parsed.currency;
    const rows = parsed.rows;

    if (importAccounts.length === 0) {
      await loadImportAccounts();
    }
    if (selectedImportAccountId.length === 0) {
      selectedImportAccountId = defaultImportAccountId(importAccounts, currency);
    }

    if (rows.length === 0) {
      importState = {
        ...importState,
        status: "error",
        source,
        rows: [],
        message: "No readable transaction in this file."
      };
      return;
    }

    importState = {
      ...importState,
      status: "loading",
      source,
      rows,
      message: `${rows.length} rows detected (${sourceLabel(source)}, ${currency}). Running API analysis.`
    };
    await previewImportRows(rows, source, fileName);
  }

  async function previewImport(): Promise<void> {
    await previewImportRows(importState.rows, importState.source, importState.fileName);
  }

  function describeRejectionReason(reason: string): string {
    switch (reason) {
      case "account_not_found":
        return "destination account not found — choose the right account";
      case "occurred_on_missing":
        return "missing or unreadable date";
      case "description_missing":
        return "missing description";
      case "amount_missing_or_invalid":
        return "missing or invalid amount";
      case "amount_mur_missing_for_foreign_currency":
        return "no MUR exchange rate for this date";
      default:
        return reason;
    }
  }

  function previewSummaryMessage(preview: BankImportPreviewResponse): string {
    if (preview.rejectedRowCount === 0) {
      return "Preview ready. Check the detected rows then import to the database.";
    }
    const topReason = preview.rejectionReasons[0];
    const reasonText = topReason === undefined
      ? ""
      : ` Main reason: ${describeRejectionReason(topReason.reason)} (${topReason.count} rows).`;
    if (preview.acceptedRowCount === 0) {
      return `No row accepted out of ${preview.rejectedRowCount}.${reasonText}`;
    }
    return `Preview ready: ${preview.acceptedRowCount} ready, ${preview.rejectedRowCount} rejected.${reasonText}`;
  }

  async function previewImportRows(
    rows: readonly Readonly<Record<string, string>>[],
    source: ImportSource,
    fileName: string
  ): Promise<void> {
    if (rows.length === 0) {
      importState = { ...importState, status: "error", message: "Choose a bank statement first (PDF or CSV)." };
      return;
    }
    if (selectedImportAccountId.length === 0) {
      importState = {
        ...importState,
        status: "error",
        rows,
        message: importAccounts.length === 0
          ? "No bank account in this workspace. Create an account in the Bank tab first, then restart the import."
          : "Choose the destination bank account before running the preview."
      };
      return;
    }

    // Stamp the chosen account on every row: the API resolves the target account per row
    // (accountId), and the stored preview is what confirm replays — so the id must be baked in here.
    const accountId = selectedImportAccountId;
    const stampedRows = rows.map(
      (row: Readonly<Record<string, string>>): Readonly<Record<string, string>> => ({ ...row, accountId })
    );

    importState = {
      ...importState,
      status: "loading",
      source,
      fileName,
      rows: stampedRows,
      message: "Running API analysis.",
      preview: null,
      confirm: null
    };

    try {
      const request: BankImportPreviewRequest = {
        workspaceId: officeWorkspaceId,
        source,
        fileName,
        checksum: `checksum-${source}-${fileName}`,
        rows: stampedRows
      };
      const preview = await client.office.previewBankImport(request, {
        idempotencyKey: createIdempotencyKey("import-preview")
      });
      initImportSelection(preview);
      importState = {
        ...importState,
        status: "success",
        preview,
        confirm: null,
        message: previewSummaryMessage(preview)
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
      importState = {
        ...importState,
        status: "error",
        message: "Analyze the statement before importing it."
      };
      return;
    }
    const acceptedRowIds = selectedImportRowIds;
    if (acceptedRowIds.length === 0) {
      importState = {
        ...importState,
        status: "error",
        message: "Check at least one accepted row to import."
      };
      return;
    }
    const acceptedSet = new Set<string>(acceptedRowIds);
    const rejectedRowIds = preview.rowResults
      .filter((row: OfficeBankPreviewRowResult): boolean => !acceptedSet.has(row.id))
      .map((row: OfficeBankPreviewRowResult): string => row.id);

    importState = {
      ...importState,
      status: "loading",
      message: "Importing to the database."
    };

    // One idempotency key for both attempts: on a proxy timeout the first confirm often
    // COMMITS server-side while the client sees a 500. Replaying the same request is safe
    // (the API answers an already-confirmed batch with a graceful duplicate receipt), so a
    // single retry turns that false failure into the success it actually was.
    const idempotencyKey = createIdempotencyKey("import-confirm");
    const request = {
      workspaceId: officeWorkspaceId,
      previewId: preview.previewId,
      acceptedRowIds,
      rejectedRowIds
    };

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const confirm = await client.office.confirmBankImport(request, { idempotencyKey });
        importState = {
          ...importState,
          status: "success",
          confirm,
          message: "Statement imported to the database."
        };
        await Promise.all([
          loadDashboard(),
          loadDashboardAnalytics(),
          loadTransactions(),
          loadPendingTransactions(),
          refreshReconciliationViews()
        ]);
        return;
      } catch (error: unknown) {
        lastError = error;
        if (attempt === 1) {
          importState = {
            ...importState,
            status: "loading",
            message: "The first attempt did not answer — checking whether the import completed…"
          };
          await new Promise<void>((resolve: () => void): void => { window.setTimeout(resolve, 2500); });
        }
      }
    }
        await Promise.all([
          refreshReconciliationViews(),
          loadTransactions(),
          loadPendingTransactions(),
          loadDashboard(),
          loadDashboardAnalytics()
        ]);
    importState = {
      ...importState,
      status: "error",
      message: `${getErrorMessage(lastError)} The import may still have completed server-side — check the Bank tab's raw lines before re-importing.`
    };
  }

  async function createPlanNode(): Promise<void> {
    const parentId = planForm.parentId === allValue ? null : planForm.parentId;

    try {
      const receipt = await client.office.createPlanComptableNode(
        {
          workspaceId: officeWorkspaceId,
          parentId,
          kind: planForm.kind,
          code: planForm.code,
          label: planForm.label,
          active: planForm.active,
          type: planForm.kind === "category" ? planForm.type : null
        },
        {
          idempotencyKey: createIdempotencyKey("plan-create")
        }
      );
      actionReceipt = receipt;
      // Reload the server truth instead of appending an optimistic local node.
      await loadPlanComptable();
    } catch (error: unknown) {
      planState = createErrorState<readonly OfficePlanComptableNode[]>(error);
    }
  }

  async function deactivateFirstCategory(): Promise<void> {
    const category = planNodes.find((node: OfficePlanComptableNode): node is OfficePlanComptableCategoryNode => node.kind === "category" && node.active);

    if (category === undefined) {
      return;
    }

    try {
      const receipt = await client.office.updatePlanComptableNode(
        category.id,
        {
          workspaceId: officeWorkspaceId,
          parentId: category.parentId,
          kind: category.kind,
          code: category.code,
          label: category.label,
          active: false,
          type: category.type
        },
        {
          idempotencyKey: createIdempotencyKey("plan-update")
        }
      );
      actionReceipt = receipt;
      // Reload the server truth instead of mutating the loaded list locally.
      await loadPlanComptable();
    } catch (error: unknown) {
      planState = createErrorState<readonly OfficePlanComptableNode[]>(error);
    }
  }

  function openTransactionCreate(): void {
    editingTransaction = null;
    creatingTransaction = true;
    createOccurredOn = today;
    createDescription = "";
    createAccountId = defaultImportAccountId(importAccounts, null);
    createCategoryId = "";
    createProjectId = "";
    createAmount = "";
    createDirection = "expense";
    scrollTransactionPanelIntoView();
  }

  function closeTransactionCreate(): void {
    creatingTransaction = false;
  }

  // The signed amount is derived from the user's decimal input plus the income/expense
  // direction, and the currency from the selected bank account — nothing is fabricated.
  async function submitTransactionCreate(): Promise<void> {
    try {
      const account = importAccounts.find((candidate: OfficeBankAccountSummary): boolean => candidate.id === createAccountId);
      if (account === undefined) {
        throw new Error("Choose a bank account for the new entry.");
      }
      const magnitudeMicro = BigInt(decimalAmountToMicro(createAmount));
      const absoluteMicro = magnitudeMicro < 0n ? -magnitudeMicro : magnitudeMicro;
      if (absoluteMicro === 0n) {
        throw new Error("The amount must not be zero.");
      }
      const request: OfficeTransactionWriteRequest = {
        workspaceId: officeWorkspaceId,
        occurredOn: createOccurredOn,
        accountId: account.id,
        categoryId: createCategoryId.length > 0 ? createCategoryId : null,
        projectId: createProjectId.length > 0 ? createProjectId : null,
        description: createDescription.trim(),
        amountMicro: (createDirection === "expense" ? -absoluteMicro : absoluteMicro).toString(),
        currency: account.currency,
        type: createDirection
      };
      const receipt = await client.office.createTransaction(request, {
        idempotencyKey: createIdempotencyKey("transaction-create")
      });
      actionReceipt = receipt;
      creatingTransaction = false;
      await Promise.all([loadTransactions(), loadPendingTransactions(), loadDashboard(), loadDashboardAnalytics()]);
    } catch (error: unknown) {
      transactionsState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
  }

  async function approveSuggestedReconciliations(): Promise<void> {
    const operations = reconciliationOperationsState.status === "success"
      ? reconciliationOperationsState.data
      : null;
    if (operations !== null && operations.autoApprovableCount === 0) {
      return;
    }

    try {
      const receipt = await client.office.approveSuggestedReconciliations(
        {
          workspaceId: officeWorkspaceId,
          approvedAt: new Date().toISOString(),
          minConfidenceBp: 9500,
          limit: 500
        },
        {
          idempotencyKey: createIdempotencyKey("reconciliation-approve-suggested")
        }
      );
      actionReceipt = receipt;
      await Promise.all([refreshReconciliationViews(), loadDashboard(), loadDashboardAnalytics(), loadTransactions()]);
    } catch (error: unknown) {
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  function isReconciliationBulkCreatable(candidate: OfficeReconciliationCandidate): boolean {
    return candidate.status === "unmatched" || candidate.status === "suggested";
  }

  function reconciliationCandidateById(candidateId: string): OfficeReconciliationCandidate | null {
    return reconciliationRows.find((candidate: OfficeReconciliationCandidate): boolean => candidate.id === candidateId) ?? null;
  }

  function canSelectReconciliationById(candidateId: string): boolean {
    const candidate = reconciliationCandidateById(candidateId);
    return candidate !== null && isReconciliationBulkCreatable(candidate) && !selectedReconciliationIds.includes(candidateId);
  }

  function canUnselectReconciliationById(candidateId: string): boolean {
    return selectedReconciliationIds.includes(candidateId);
  }

  function toggleReconciliationSelection(candidateId: string): void {
    if (selectedReconciliationIds.includes(candidateId)) {
      selectedReconciliationIds = selectedReconciliationIds.filter((id: string): boolean => id !== candidateId);
      return;
    }

    const candidate = reconciliationCandidateById(candidateId);
    if (candidate === null || !isReconciliationBulkCreatable(candidate)) {
      return;
    }

    selectedReconciliationIds = [...selectedReconciliationIds, candidateId];
  }

  function toggleSelectAllReconciliations(): void {
    if (selectableReconciliationIds.length === 0) {
      return;
    }

    if (reconciliationAllVisibleSelected) {
      selectedReconciliationIds = selectedReconciliationIds.filter(
        (id: string): boolean => !selectableReconciliationIds.includes(id)
      );
      return;
    }

    selectedReconciliationIds = [...new Set([...selectedReconciliationIds, ...selectableReconciliationIds])];
  }

  async function bulkCreateSelectedReconciliations(): Promise<void> {
    if (selectedCreatableReconciliationIds.length === 0) {
      return;
    }

    try {
      const matchedAt = new Date().toISOString();
      const selectedCandidates = reconciliationRows.filter(
        (candidate: OfficeReconciliationCandidate): boolean =>
          selectedCreatableReconciliationIds.includes(candidate.id) && isReconciliationBulkCreatable(candidate)
      );
      const writeResults = await Promise.all(
        selectedCandidates.map((candidate: OfficeReconciliationCandidate): Promise<ApiMutationReceipt> =>
          client.office.createTransactionFromBankLine(
            {
              workspaceId: officeWorkspaceId,
              statementLineId: candidate.statementLineId,
              categoryId: null,
              projectId: null,
              matchedAt
            },
            { idempotencyKey: createIdempotencyKey(`reconcile-create-bulk-${candidate.statementLineId}`) }
          )
        )
      );
      actionReceipt = writeResults[writeResults.length - 1] ?? null;
      selectedReconciliationIds = [];
      await Promise.all([
        refreshReconciliationViews(),
        loadTransactions(),
        loadPendingTransactions(),
        loadDashboard(),
        loadDashboardAnalytics()
      ]);
    } catch (error: unknown) {
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  function togglePendingSelection(transactionId: string): void {
    if (selectedPendingIds.includes(transactionId)) {
      selectedPendingIds = selectedPendingIds.filter((id: string): boolean => id !== transactionId);
      return;
    }

    selectedPendingIds = [...selectedPendingIds, transactionId];
  }

  function pendingTransactionById(transactionId: string): OfficeTransaction | null {
    return pendingRows.find((transaction: OfficeTransaction): boolean => transaction.id === transactionId) ?? null;
  }

  function canSelectPendingById(transactionId: string): boolean {
    return pendingVisibleIds.includes(transactionId) && !selectedPendingIds.includes(transactionId);
  }

  function canUnselectPendingById(transactionId: string): boolean {
    return selectedPendingIds.includes(transactionId);
  }

  function canValidatePendingById(transactionId: string): boolean {
    if (!writesEnabled) {
      return false;
    }

    const transaction = pendingTransactionById(transactionId);
    return transaction !== null && transaction.categoryId !== null;
  }

  function validatePendingDisabledReason(transactionId: string): string | null {
    if (!writesEnabled) {
      return writeDisabledTitle();
    }

    const transaction = pendingTransactionById(transactionId);
    if (transaction === null) {
      return "This row is no longer available.";
    }

    if (transaction.categoryId === null) {
      return "Classify this row before validation.";
    }

    return null;
  }

  function toggleSelectAllPending(): void {
    if (pendingVisibleIds.length === 0) {
      return;
    }

    if (pendingAllVisibleSelected) {
      selectedPendingIds = [];
      return;
    }

    selectedPendingIds = [...pendingVisibleIds];
  }

  async function validatePendingById(transactionId: string): Promise<void> {
    if (!canValidatePendingById(transactionId)) {
      return;
    }

    try {
      const receipt = await client.office.validateTransaction(
        transactionId,
        { workspaceId: officeWorkspaceId },
        { idempotencyKey: createIdempotencyKey(`pending-validate-${transactionId}`) }
      );
      actionReceipt = receipt;
      selectedPendingIds = selectedPendingIds.filter((id: string): boolean => id !== transactionId);
      await Promise.all([
        loadPendingTransactions(),
        loadTransactions(),
        loadDashboard(),
        loadDashboardAnalytics(),
        refreshReconciliationViews()
      ]);
    } catch (error: unknown) {
      pendingState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
  }

  // Apply one category (and optionally project) to every selected pending row via the transaction
  // update endpoint, keeping each row's own project when none is chosen. Classification is the
  // precondition for validation — a pending row cannot be validated until it has a category.
  async function classifySelectedPending(): Promise<void> {
    if (selectedPendingIds.length === 0 || pendingClassifyCategoryId.length === 0) {
      return;
    }

    try {
      const selectedTransactions = pendingRows.filter((transaction: OfficeTransaction): boolean =>
        selectedPendingIds.includes(transaction.id)
      );
      const writeResults = await Promise.all(
        selectedTransactions.map((transaction: OfficeTransaction): Promise<ApiMutationReceipt> =>
          client.office.updateTransaction(
            transaction.id,
            {
              workspaceId: officeWorkspaceId,
              occurredOn: transaction.occurredOn,
              accountId: transaction.accountId ?? defaultImportAccountId(importAccounts, transaction.currency),
              categoryId: pendingClassifyCategoryId,
              projectId: pendingClassifyProjectId.length > 0 ? pendingClassifyProjectId : transaction.projectId,
              description: transaction.description,
              amountMicro: transaction.amountMicro,
              currency: transaction.currency,
              type: transaction.type
            },
            { idempotencyKey: createIdempotencyKey(`pending-classify-${transaction.id}`) }
          )
        )
      );
      actionReceipt = writeResults[writeResults.length - 1] ?? null;
      await Promise.all([loadPendingTransactions(), loadTransactions(), loadDashboard(), loadDashboardAnalytics()]);
    } catch (error: unknown) {
      pendingState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
  }

  async function bulkValidatePending(): Promise<void> {
    if (selectedPendingIds.length === 0) {
      return;
    }

    try {
      const selectedTransactions = pendingRows.filter((transaction: OfficeTransaction): boolean =>
        selectedPendingIds.includes(transaction.id)
      );
      assertTransactionsCanValidate(selectedTransactions);
      const writeResults = await Promise.all(
        selectedTransactions.map((transaction: OfficeTransaction): Promise<ApiMutationReceipt> =>
          client.office.validateTransaction(
            transaction.id,
            { workspaceId: officeWorkspaceId },
            { idempotencyKey: createIdempotencyKey(`pending-validate-${transaction.id}`) }
          )
        )
      );
      actionReceipt = writeResults[writeResults.length - 1] ?? null;
      selectedPendingIds = [];
      await Promise.all([
        loadPendingTransactions(),
        loadTransactions(),
        loadDashboard(),
        loadDashboardAnalytics(),
        refreshReconciliationViews()
      ]);
    } catch (error: unknown) {
      pendingState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
  }

  function assertTransactionsCanValidate(rows: readonly OfficeTransaction[]): void {
    const uncategorized = rows.find((transaction: OfficeTransaction): boolean => transaction.categoryId === null);

    if (uncategorized !== undefined) {
      throw new Error(`Cannot validate "${uncategorized.description}" until it has a category.`);
    }
  }

  function getOfficeNavItem(pageId: OfficePageId): OfficeNavItem {
    const item = officeNavItems.find((navItem: OfficeNavItem): boolean => navItem.id === pageId);

    if (item === undefined) {
      throw new Error(`Unknown Office page: ${pageId}`);
    }

    return item;
  }

  function readArrayState<TItem>(state: ApiRequestState<readonly TItem[]>): readonly TItem[] {
    if (state.status === "success") {
      return state.data;
    }

    return [];
  }

  function readPnlResult(state: ApiRequestState<OfficeGlobalPnl | OfficeDepartmentPnl>): OfficeGlobalPnl | OfficeDepartmentPnl | null {
    if (state.status === "success") {
      return state.data;
    }

    return null;
  }

  // Percent change of current vs previous, as a StatCard trend. "none" when the
  // previous value is missing or zero (no meaningful ratio).
  function computeStatTrend(current: number, previous: number | null): { readonly direction: StatTrendDirection; readonly value: string } {
    if (previous === null || !Number.isFinite(previous) || previous === 0 || !Number.isFinite(current)) {
      return { direction: "none", value: "—" };
    }

    const ratio = (current - previous) / Math.abs(previous);
    if (ratio === 0) {
      return { direction: "none", value: "0%" };
    }

    return { direction: ratio > 0 ? "up" : "down", value: `${Math.abs(ratio * 100).toFixed(1)}%` };
  }

  function createDashboardStats(state: ApiRequestState<OfficeDashboardResponse>): readonly DashboardStat[] {
    if (state.status !== "success") {
      return [
        { label: "Revenus comptables", value: "—", trendDirection: "none", trendValue: "—", trendDetail: "écritures validées" },
        { label: "Dépenses comptables", value: "—", trendDirection: "none", trendValue: "—", trendDetail: "écritures validées" },
        { label: "Résultat net", value: "—", trendDirection: "none", trendValue: "—", trendDetail: "écritures validées" },
        { label: "Transactions", value: "—", trendDirection: "none", trendValue: "—", trendDetail: "validées" }
      ];
    }

    const previous = state.data.previous ?? null;
    const trendDetail = previous === null ? "no previous period" : `vs ${previous.dateFrom} → ${previous.dateTo}`;
    const incomeTrend = computeStatTrend(Number(state.data.ledgerIncomeMicro), previous === null ? null : Number(previous.receivablesMicro));
    const expenseTrend = computeStatTrend(Number(state.data.ledgerExpenseMicro), previous === null ? null : Number(previous.payablesMicro));
    const previousNet = previous === null ? null : Number(previous.receivablesMicro) - Number(previous.payablesMicro);
    const netTrend = computeStatTrend(Number(state.data.netProfitMicro), previousNet);
    return [
      {
        label: "Revenus comptables",
        value: formatMicro(state.data.ledgerIncomeMicro),
        trendDirection: incomeTrend.direction,
        trendValue: incomeTrend.value,
        trendDetail
      },
      {
        label: "Dépenses comptables",
        value: formatMicro(state.data.ledgerExpenseMicro),
        trendDirection: expenseTrend.direction,
        trendValue: expenseTrend.value,
        trendDetail
      },
      {
        label: "Résultat net",
        value: formatMicro(state.data.netProfitMicro),
        trendDirection: netTrend.direction,
        trendValue: netTrend.value,
        trendDetail
      },
      {
        label: "Transactions",
        value: String(state.data.validatedTransactionCount),
        trendDirection: "none",
        trendValue: `${String(state.data.pendingTransactionCount)} en attente`,
        trendDetail: `${String(state.data.unreconciledTransactionCount)} lignes à rapprocher`
      }
    ];
  }

  function createDashboardImportPoints(state: ApiRequestState<OfficeDashboardResponse>): readonly ChartPoint[] {
    const points: ChartPoint[] = [];
    const imports = state.status === "success" ? (state.data.recentImports ?? []).slice(0, 6) : [];
    let maxAccepted = 0;

    for (const item of imports) {
      if (item.acceptedRowCount > maxAccepted) {
        maxAccepted = item.acceptedRowCount;
      }
    }

    for (const item of imports) {
      const labelSource = item.periodLabel.trim().length > 0 ? item.periodLabel : item.source.toUpperCase();
      const label = labelSource.length > 9 ? labelSource.slice(0, 9) : labelSource;
      const value = maxAccepted === 0 ? 0 : Math.round((item.acceptedRowCount / maxAccepted) * 100);
      points.push({ label, value });
    }

    while (points.length < 6) {
      points.push({ label: "-", value: 0 });
    }

    return points;
  }

  function createDashboardAnalyticsKpis(state: ApiRequestState<OfficeDashboardAnalyticsResponse>): readonly OfficeKpi[] {
    if (state.status !== "success") {
      return [
        { label: "Runway", value: "—", detail: stateLabel(state), tone: "muted", accent: true },
        { label: "Top expense", value: "—", detail: "category", tone: "muted", accent: false },
        { label: "Top project", value: "—", detail: "net contribution", tone: "muted", accent: false },
        { label: "Reconciliation", value: "—", detail: "health by account", tone: "muted", accent: false },
        { label: "Oldest unmatched", value: "—", detail: "ageing", tone: "muted", accent: false }
      ];
    }

    const topExpense = state.data.topExpenseCategories[0] ?? null;
    const topProject = state.data.projectProfitability[0] ?? null;
    const totalLines = state.data.reconciliationByAccount.reduce(
      (sum: number, row: { readonly lineCount: number }): number => sum + row.lineCount,
      0
    );
    const totalUnmatched = state.data.reconciliationByAccount.reduce(
      (sum: number, row: { readonly unmatchedLineCount: number }): number => sum + row.unmatchedLineCount,
      0
    );
    const matchedBp = totalLines === 0 ? 0 : Math.round(((totalLines - totalUnmatched) * 10_000) / totalLines);
    const runwayMonths = state.data.runway.runwayMonths === null ? null : Number(state.data.runway.runwayMonths);

    return [
      {
        label: "Runway",
        value: state.data.runway.runwayMonths === null ? "No burn" : `${state.data.runway.runwayMonths} months`,
        detail: `cash ${formatMicro(state.data.runway.cashBalanceMicro)} · burn ${formatMicro(state.data.runway.averageMonthlyBurnMicro)}`,
        tone: runwayMonths === null ? "info" : runwayMonths < 3 ? "warning" : "success",
        accent: true
      },
      {
        label: "Top expense",
        value: topExpense === null ? "—" : formatMicro(topExpense.expenseMicro),
        detail: topExpense === null ? "no expense" : `${compactChartLabel(topExpense.label)} · ${formatBasisPoints(topExpense.shareBp)}`,
        tone: topExpense === null ? "muted" : "warning",
        accent: false
      },
      {
        label: "Top project",
        value: topProject === null ? "—" : formatSignedMicro(topProject.netMicro, "MUR"),
        detail: topProject === null ? "no project activity" : topProject.projectLabel,
        tone: topProject === null ? "muted" : moneyTone(topProject.netMicro),
        accent: false
      },
      {
        label: "Reconciliation",
        value: formatBasisPoints(matchedBp),
        detail: `${String(totalUnmatched)} unmatched line(s)`,
        tone: matchedBp >= 9000 ? "success" : matchedBp >= 7500 ? "info" : "warning",
        accent: false
      },
      {
        label: "Oldest unmatched",
        value: state.data.oldestUnmatchedDays === null ? "0 day" : `${String(state.data.oldestUnmatchedDays)} day(s)`,
        detail: "bank ageing",
        tone: state.data.oldestUnmatchedDays === null ? "success" : state.data.oldestUnmatchedDays > 30 ? "error" : "warning",
        accent: false
      }
    ];
  }

  function createDashboardRunwayPanel(state: ApiRequestState<OfficeDashboardAnalyticsResponse>): DashboardRunwayPanel {
    if (state.status !== "success") {
      return {
        value: "—",
        detail: stateLabel(state),
        tone: "muted",
        cash: "—",
        burn: "—",
        monthsUsed: "—",
        excludedForeignAccounts: []
      };
    }

    const monthsValue = state.data.runway.runwayMonths;
    const numericMonths = monthsValue === null ? null : Number(monthsValue);
    const excludedForeignAccounts = state.data.runway.excludedForeignAccounts.map(
      (account) => `${account.bankName} · ${account.accountLabel} · ${formatMoney(account.balanceMicro, account.currency)}`
    );
    return {
      value: monthsValue === null ? "No burn" : `${monthsValue} months`,
      detail: numericMonths === null ? "runway not constrained" : numericMonths < 3 ? "critical · below 3 months" : "runway stable",
      tone: numericMonths === null ? "info" : numericMonths < 3 ? "error" : "success",
      cash: formatMicro(state.data.runway.cashBalanceMicro),
      burn: formatMicro(state.data.runway.averageMonthlyBurnMicro),
      monthsUsed: state.data.runway.monthsUsed.join(" · "),
      excludedForeignAccounts
    };
  }

  function createDashboardExpenseCategoryPoints(state: ApiRequestState<OfficeDashboardAnalyticsResponse>): readonly ChartPoint[] {
    if (state.status !== "success") {
      return createNormalizedCountChartPoints([], 6);
    }

    const topRows = state.data.topExpenseCategories.slice(0, 6);
    let maxUnits = 0n;
    for (const row of topRows) {
      const units = absBigInt(apiMoneyToMicroUnits(row.expenseMicro));
      if (units > maxUnits) {
        maxUnits = units;
      }
    }

    const points = topRows.map((row): ChartPoint => {
      const units = absBigInt(apiMoneyToMicroUnits(row.expenseMicro));
      return {
        label: compactChartLabel(row.label),
        value: maxUnits === 0n ? 0 : Number((units * 100n) / maxUnits)
      };
    });

    while (points.length < 6) {
      points.push({ label: "-", value: 0 });
    }

    return points;
  }

  function createDashboardExpenseCategoryRows(state: ApiRequestState<OfficeDashboardAnalyticsResponse>): readonly TableRow[] {
    if (state.status !== "success") {
      return [];
    }

    return state.data.topExpenseCategories.map((row): TableRow => ({
      id: row.categoryId,
      cells: [
        { kind: "text", value: row.label, strong: true },
        { kind: "money", value: formatMicro(row.expenseMicro), tone: "error" },
        { kind: "badge", value: formatBasisPoints(row.shareBp), tone: "warning" }
      ]
    }));
  }

  function createDashboardProjectProfitabilityPoints(state: ApiRequestState<OfficeDashboardAnalyticsResponse>): readonly ChartPoint[] {
    if (state.status !== "success") {
      return createNormalizedCountChartPoints([], 6);
    }

    const topRows = state.data.projectProfitability.slice(0, 6);
    let maxUnits = 0n;
    for (const row of topRows) {
      const units = absBigInt(apiMoneyToMicroUnits(row.netMicro));
      if (units > maxUnits) {
        maxUnits = units;
      }
    }

    const points = topRows.map((row): ChartPoint => ({
      label: compactChartLabel(row.projectLabel),
      value: maxUnits === 0n ? 0 : Number((absBigInt(apiMoneyToMicroUnits(row.netMicro)) * 100n) / maxUnits)
    }));

    while (points.length < 6) {
      points.push({ label: "-", value: 0 });
    }

    return points;
  }

  function createDashboardProjectProfitabilityRows(state: ApiRequestState<OfficeDashboardAnalyticsResponse>): readonly TableRow[] {
    if (state.status !== "success") {
      return [];
    }

    return state.data.projectProfitability.map((row): TableRow => ({
      id: row.projectId,
      cells: [
        { kind: "text", value: row.projectLabel, strong: true },
        { kind: "money", value: formatMicro(row.incomeMicro), tone: "success" },
        { kind: "money", value: formatMicro(row.expenseMicro), tone: "error" },
        { kind: "money", value: formatSignedMicro(row.netMicro, "MUR"), tone: moneyTone(row.netMicro) },
        { kind: "badge", value: row.marginBp === null ? "—" : formatSignedBasisPoints(row.marginBp), tone: row.marginBp === null ? "muted" : row.marginBp >= 0 ? "success" : "warning" }
      ]
    }));
  }

  function createDashboardReconciliationPoints(state: ApiRequestState<OfficeDashboardAnalyticsResponse>): readonly ChartPoint[] {
    if (state.status !== "success") {
      return createNormalizedCountChartPoints([], 6);
    }

    return createNormalizedCountChartPoints(
      state.data.reconciliationByAccount.slice(0, 6).map((row) => ({
        label: compactChartLabel(`${row.bankName} ${row.accountLabel}`),
        count: row.unmatchedLineCount
      })),
      6
    );
  }

  function createDashboardReconciliationRows(state: ApiRequestState<OfficeDashboardAnalyticsResponse>): readonly TableRow[] {
    if (state.status !== "success") {
      return [];
    }

    return state.data.reconciliationByAccount.map((row): TableRow => ({
      id: row.accountId,
      cells: [
        { kind: "text", value: `${row.bankName} · ${row.accountLabel}`, strong: true },
        { kind: "text", value: String(row.unmatchedLineCount), strong: false },
        { kind: "badge", value: formatBasisPoints(row.matchedRateBp), tone: row.matchedRateBp >= 9000 ? "success" : row.matchedRateBp >= 7500 ? "info" : "warning" },
        { kind: "text", value: row.oldestUnmatchedDays === null ? "—" : `${String(row.oldestUnmatchedDays)} day(s)`, strong: false }
      ]
    }));
  }

  function createDashboardExpenseTrendPoints(state: ApiRequestState<OfficeDashboardAnalyticsResponse>): readonly ChartPoint[] {
    if (state.status !== "success") {
      return [
        { label: "m1", value: 0 },
        { label: "m2", value: 0 }
      ];
    }

    const series = state.data.expenseTrendByDepartment[0] ?? null;
    if (series === null || state.data.expenseTrendMonths.length === 0) {
      return [
        { label: "m1", value: 0 },
        { label: "m2", value: 0 }
      ];
    }

    const values = series.monthlyExpenseMicro.map((value) => absBigInt(apiMoneyToMicroUnits(value)));
    const maxValue = values.reduce((current, value) => (value > current ? value : current), 0n);
    return state.data.expenseTrendMonths.map((month, index): ChartPoint => ({
      label: month.slice(5),
      value: maxValue === 0n ? 0 : Number(((values[index] ?? 0n) * 100n) / maxValue)
    }));
  }

  function createDashboardExpenseTrendRows(state: ApiRequestState<OfficeDashboardAnalyticsResponse>): readonly TableRow[] {
    if (state.status !== "success") {
      return [];
    }

    return state.data.expenseTrendByDepartment.map((row): TableRow => {
      const first = apiMoneyToMicroUnits(row.monthlyExpenseMicro[0] ?? "0");
      const last = apiMoneyToMicroUnits(row.latestMonthExpenseMicro);
      const delta = last - first;
      return {
        id: row.departmentId,
        cells: [
          { kind: "text", value: row.departmentLabel, strong: true },
          { kind: "money", value: formatMicro(row.latestMonthExpenseMicro), tone: "error" },
          { kind: "money", value: formatSignedMicro(delta.toString(), "MUR"), tone: delta <= 0n ? "success" : "warning" },
          { kind: "text", value: state.data.expenseTrendMonths.join(" · "), strong: false }
        ]
      };
    });
  }

  function formatBasisPoints(value: number): string {
    return `${(value / 100).toFixed(2)}%`;
  }

  function formatSignedBasisPoints(value: number): string {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${(value / 100).toFixed(2)}%`;
  }

  function createCoaStructurePoints(nodes: readonly OfficePlanComptableNode[]): readonly ChartPoint[] {
    const departmentCount = nodes.filter((node: OfficePlanComptableNode): boolean => node.kind === "department").length;
    const divisionCount = nodes.filter((node: OfficePlanComptableNode): boolean => node.kind === "division").length;
    const categoryCount = nodes.filter((node: OfficePlanComptableNode): boolean => node.kind === "category").length;

    return createNormalizedCountChartPoints(
      [
        { label: "Departments", count: departmentCount },
        { label: "Divisions", count: divisionCount },
        { label: "Categories", count: categoryCount }
      ],
      6
    );
  }

  function createTransactionTypePoints(rows: readonly OfficeTransaction[]): readonly ChartPoint[] {
    let incomeCount = 0;
    let expenseCount = 0;
    let unvalidatedCount = 0;

    for (const row of rows) {
      if (row.type === "income") {
        incomeCount += 1;
        continue;
      }
      if (row.type === "expense") {
        expenseCount += 1;
        continue;
      }
      unvalidatedCount += 1;
    }

    return createNormalizedCountChartPoints(
      [
        { label: "Income", count: incomeCount },
        { label: "Expense", count: expenseCount },
        { label: "Unvalidated", count: unvalidatedCount }
      ],
      6
    );
  }

  function createTransactionStatusPoints(rows: readonly OfficeTransaction[]): readonly ChartPoint[] {
    let pendingCount = 0;
    let draftCount = 0;
    let postedCount = 0;
    let reconciledCount = 0;
    let voidedCount = 0;

    for (const row of rows) {
      if (row.status === "pending") {
        pendingCount += 1;
        continue;
      }
      if (row.status === "draft") {
        draftCount += 1;
        continue;
      }
      if (row.status === "posted") {
        postedCount += 1;
        continue;
      }
      if (row.status === "reconciled") {
        reconciledCount += 1;
        continue;
      }
      voidedCount += 1;
    }

    return createNormalizedCountChartPoints(
      [
        { label: "Pending", count: pendingCount },
        { label: "Draft", count: draftCount },
        { label: "Posted", count: postedCount },
        { label: "Reconciled", count: reconciledCount },
        { label: "Voided", count: voidedCount }
      ],
      6
    );
  }

  function createImportQualityPoints(state: ImportUiState): readonly ChartPoint[] {
    const preview = state.preview;
    if (preview === null) {
      return createNormalizedCountChartPoints([], 6);
    }

    return createNormalizedCountChartPoints(
      [
        { label: "Accepted", count: preview.acceptedRowCount },
        { label: "Rejected", count: preview.rejectedRowCount },
        { label: "Duplicates", count: preview.duplicateRowCount }
      ],
      6
    );
  }

  function createReconciliationStatusPoints(rows: readonly OfficeReconciliationCandidate[]): readonly ChartPoint[] {
    let unmatchedCount = 0;
    let suggestedCount = 0;
    let matchedCount = 0;
    let rejectedCount = 0;

    for (const row of rows) {
      if (row.status === "unmatched") {
        unmatchedCount += 1;
        continue;
      }
      if (row.status === "suggested") {
        suggestedCount += 1;
        continue;
      }
      if (row.status === "matched") {
        matchedCount += 1;
        continue;
      }
      rejectedCount += 1;
    }

    return createNormalizedCountChartPoints(
      [
        { label: "Unmatched", count: unmatchedCount },
        { label: "Suggested", count: suggestedCount },
        { label: "Matched", count: matchedCount },
        { label: "Rejected", count: rejectedCount }
      ],
      6
    );
  }

  function createReconciliationOperationsKpis(
    state: ApiRequestState<OfficeReconciliationOperationsResponse>
  ): readonly OfficeKpi[] {
    if (state.status !== "success") {
      return [
        { label: "Matched rate", value: "—", detail: stateLabel(state), tone: "muted", accent: true },
        { label: "Unmatched", value: "—", detail: "queue", tone: "muted", accent: false },
        { label: "Auto-approvable", value: "—", detail: "suggested >= 95%", tone: "muted", accent: false },
        { label: "Stale suggested", value: "—", detail: "> 7 days", tone: "muted", accent: false },
        { label: "Oldest unmatched", value: "—", detail: "ageing", tone: "muted", accent: false }
      ];
    }

    const matchedRateBp = state.data.matchedRateBp;
    const oldestUnmatchedDays = state.data.oldestUnmatchedDays;
    return [
      {
        label: "Matched rate",
        value: formatBasisPoints(matchedRateBp),
        detail: `${String(state.data.matchedCount)} / ${String(state.data.totalCount)} lines`,
        tone: matchedRateBp >= 9000 ? "success" : matchedRateBp >= 7500 ? "info" : "warning",
        accent: true
      },
      {
        label: "Unmatched",
        value: String(state.data.unmatchedCount),
        detail: "active queue",
        tone: state.data.unmatchedCount === 0 ? "success" : "warning",
        accent: false
      },
      {
        label: "Auto-approvable",
        value: String(state.data.autoApprovableCount),
        detail: "suggested >= 95%",
        tone: state.data.autoApprovableCount > 0 ? "info" : "muted",
        accent: false
      },
      {
        label: "Stale suggested",
        value: String(state.data.staleSuggestedCount),
        detail: "older than 7 days",
        tone: state.data.staleSuggestedCount > 0 ? "warning" : "success",
        accent: false
      },
      {
        label: "Oldest unmatched",
        value: oldestUnmatchedDays === null ? "0 day" : `${String(oldestUnmatchedDays)} day(s)`,
        detail: "bank ageing",
        tone: oldestUnmatchedDays === null ? "success" : oldestUnmatchedDays > 30 ? "error" : "warning",
        accent: false
      }
    ];
  }

  function createPendingStatusPoints(rows: readonly OfficeTransaction[]): readonly ChartPoint[] {
    let pendingCount = 0;
    let draftCount = 0;
    let postedCount = 0;
    let otherCount = 0;

    for (const row of rows) {
      if (row.status === "pending") {
        pendingCount += 1;
        continue;
      }
      if (row.status === "draft") {
        draftCount += 1;
        continue;
      }
      if (row.status === "posted") {
        postedCount += 1;
        continue;
      }
      otherCount += 1;
    }

    return createNormalizedCountChartPoints(
      [
        { label: "Pending", count: pendingCount },
        { label: "Draft", count: draftCount },
        { label: "Posted", count: postedCount },
        { label: "Other", count: otherCount }
      ],
      6
    );
  }

  function createAuditActionPoints(rows: readonly AuditLogEntry[]): readonly ChartPoint[] {
    const actionCounts = new Map<string, number>();

    for (const row of rows) {
      const label = compactChartLabel(row.action);
      actionCounts.set(label, (actionCounts.get(label) ?? 0) + 1);
    }

    const ranked = [...actionCounts.entries()]
      .sort((left: readonly [string, number], right: readonly [string, number]): number => right[1] - left[1])
      .slice(0, 6)
      .map((entry: readonly [string, number]): { readonly label: string; readonly count: number } => ({
        label: entry[0],
        count: entry[1]
      }));

    return createNormalizedCountChartPoints(ranked, 6);
  }

  function createNormalizedCountChartPoints(
    entries: readonly { readonly label: string; readonly count: number }[],
    targetSize: number
  ): readonly ChartPoint[] {
    const points: ChartPoint[] = [];
    let maxCount = 0;

    for (const entry of entries) {
      if (entry.count > maxCount) {
        maxCount = entry.count;
      }
    }

    for (const entry of entries) {
      points.push({
        label: compactChartLabel(entry.label),
        value: maxCount === 0 ? 0 : Math.round((entry.count * 100) / maxCount)
      });
    }

    while (points.length < targetSize) {
      points.push({ label: "-", value: 0 });
    }

    return points.slice(0, targetSize);
  }

  function createPnlChartPoints(rows: readonly OfficePnlProjectionRow[]): readonly DivergePoint[] {
    return rows.map((row: OfficePnlProjectionRow): DivergePoint => ({
      label: row.departmentLabel,
      negative: row.expenseBarLevel,
      positive: row.revenueBarLevel
    }));
  }

  function createPnlKpis(state: ApiRequestState<OfficeGlobalPnl | OfficeDepartmentPnl>): readonly OfficeKpi[] {
    if (state.status !== "success") {
      return [
        { label: "Revenue", value: "-", detail: stateLabel(state), tone: "muted", accent: true },
        { label: "Expenses", value: "-", detail: "validated", tone: "muted", accent: false },
        { label: "Net", value: "-", detail: "validated", tone: "muted", accent: false },
        { label: "Margin", value: "-", detail: "net / revenue", tone: "muted", accent: false }
      ];
    }

    return [
      {
        label: "Revenue",
        value: formatMicro(state.data.incomeMicro),
        detail: periodLabel(state.data.period),
        tone: "success",
        accent: true
      },
      {
        label: "Expenses",
        value: formatMicro(state.data.expenseMicro),
        detail: "validated categories",
        tone: "warning",
        accent: false
      },
      {
        label: "Net",
        // P&L aggregates only ever include MUR-valid transactions today (isBaseIncluded
        // excludes any foreign-currency row without a stored FX rate), so MUR is correct here.
        value: formatSignedMicro(state.data.netMicro, "MUR"),
        detail: state.data.completeness,
        tone: moneyTone(state.data.netMicro),
        accent: false
      },
      {
        label: "Margin",
        value: formatMargin(state.data.netMicro, state.data.incomeMicro),
        detail: "net / revenue",
        tone: moneyTone(state.data.netMicro),
        accent: false
      }
    ];
  }

  function createPnlTableRows(rows: readonly OfficePnlProjectionRow[]): readonly TableRow[] {
    return rows.map((row: OfficePnlProjectionRow): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.departmentLabel, strong: true },
        { kind: "money", value: formatMicro(row.revenueMicro), tone: "success" },
        { kind: "money", value: formatMicro(row.expenseMicro), tone: "error" },
        { kind: "money", value: formatSignedMicro(row.netMicro, "MUR"), tone: row.netTone === "positive" ? "success" : "error" },
        { kind: "badge", value: formatDateOnly(row.validatedAt), tone: "info" }
      ]
    }));
  }

  function createDivisionPnlTableRows(rows: readonly OfficeDivisionPnl[]): readonly TableRow[] {
    return rows.map((row: OfficeDivisionPnl): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.label, strong: true },
        { kind: "money", value: formatMicro(row.incomeMicro), tone: "success" },
        { kind: "money", value: formatMicro(row.expenseMicro), tone: "error" },
        { kind: "money", value: formatSignedMicro(row.netMicro, "MUR"), tone: moneyTone(row.netMicro) }
      ]
    }));
  }

  function createPnlLineTableRows(rows: readonly OfficePnlLine[]): readonly TableRow[] {
    return rows.map((row: OfficePnlLine): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.label, strong: true },
        { kind: "money", value: formatMicro(row.incomeMicro), tone: "success" },
        { kind: "money", value: formatMicro(row.expenseMicro), tone: "error" },
        { kind: "money", value: formatSignedMicro(row.netMicro, "MUR"), tone: moneyTone(row.netMicro) }
      ]
    }));
  }

  function createPnlCategoryImpactPoints(rows: readonly OfficePnlLine[]): readonly ChartPoint[] {
    if (rows.length === 0) {
      return [
        { label: "-", value: 0 },
        { label: "-", value: 0 },
        { label: "-", value: 0 },
        { label: "-", value: 0 },
        { label: "-", value: 0 },
        { label: "-", value: 0 }
      ];
    }

    const sortedRows = [...rows].sort((left: OfficePnlLine, right: OfficePnlLine): number => {
      const leftMagnitude = absoluteMicro(left.netMicro);
      const rightMagnitude = absoluteMicro(right.netMicro);
      if (leftMagnitude === rightMagnitude) {
        return 0;
      }
      return rightMagnitude > leftMagnitude ? 1 : -1;
    });
    const topRows = sortedRows.slice(0, 6);
    let maxMagnitude = 0n;

    for (const row of topRows) {
      const magnitude = absoluteMicro(row.netMicro);
      if (magnitude > maxMagnitude) {
        maxMagnitude = magnitude;
      }
    }

    const points = topRows.map((row: OfficePnlLine): ChartPoint => {
      const magnitude = absoluteMicro(row.netMicro);
      const value =
        maxMagnitude === 0n
          ? 0
          : Number((magnitude * 100n) / maxMagnitude);
      return {
        label: compactChartLabel(row.label),
        value
      };
    });

    while (points.length < 6) {
      points.push({ label: "-", value: 0 });
    }

    return points;
  }

  function absoluteMicro(value: string): bigint {
    try {
      const parsed = BigInt(value);
      return parsed < 0n ? -parsed : parsed;
    } catch {
      return 0n;
    }
  }

  function absBigInt(value: bigint): bigint {
    return value < 0n ? -value : value;
  }

  function compactChartLabel(label: string): string {
    const normalized = label.trim();
    if (normalized.length <= 10) {
      return normalized;
    }

    return normalized.slice(0, 10);
  }

  function createPlanTableRows(nodes: readonly OfficePlanComptableNode[]): readonly TableRow[] {
    return nodes.map((node: OfficePlanComptableNode): TableRow => ({
      id: node.id,
      cells: [
        { kind: "text", value: indentPlanLabel(node, nodes), strong: node.kind === "department" },
        { kind: "badge", value: node.kind, tone: planKindTone(node.kind) },
        { kind: "text", value: planReferenceLabel(node), strong: false },
        { kind: "badge", value: categoryTypeLabel(node), tone: categoryTypeTone(node) },
        { kind: "text", value: planPathLabel(node), strong: false },
        { kind: "badge", value: node.active ? "active" : "inactive", tone: node.active ? "success" : "muted" }
      ]
    }));
  }

  function categoryTypeLabel(node: OfficePlanComptableNode): string {
    if (node.kind === "category") {
      return node.type;
    }

    return "—";
  }

  function categoryTypeTone(node: OfficePlanComptableNode): Tone {
    if (node.kind === "category" && node.type === "income") {
      return "success";
    }

    if (node.kind === "category" && node.type === "expense") {
      return "warning";
    }

    return "muted";
  }

  function planPathLabel(node: OfficePlanComptableNode): string {
    if (node.kind === "department") {
      return node.label;
    }

    if (node.kind === "division") {
      return `${node.departmentLabel} · ${node.label}`;
    }

    return `${node.departmentLabel} · ${node.divisionLabel} · ${node.label}`;
  }

  function transactionPathLabel(transaction: OfficeTransaction): string {
    if (
      transaction.departmentLabel === null ||
      transaction.divisionLabel === null ||
      transaction.categoryLabel === null
    ) {
      return "To classify";
    }

    return `${transaction.departmentLabel} · ${transaction.divisionLabel} · ${transaction.categoryLabel}`;
  }

  // Display sign follows the transaction TYPE, not the stored sign: write paths disagree on
  // the stored sign convention (manual entry negates expenses, bank-derived rows store a
  // positive magnitude), so a "Rent" expense could otherwise show as "+17,250.00" in green.
  // Same normalization the P&L aggregator applies (magnitude + type carries the meaning).
  function typedSignedAmountMicro(transaction: OfficeTransaction): string {
    const magnitude = transaction.amountMicro.replace(/^[+-]/u, "");
    if (transaction.type === "expense") {
      return `-${magnitude}`;
    }
    if (transaction.type === "income") {
      return magnitude;
    }
    return transaction.amountMicro;
  }

  function createTransactionTableRows(rows: readonly OfficeTransaction[]): readonly TableRow[] {
    return rows.map((transaction: OfficeTransaction): TableRow => {
      const signedAmountMicro = typedSignedAmountMicro(transaction);
      return {
        id: transaction.id,
        cells: [
          { kind: "text", value: formatDateOnly(transaction.occurredOn), strong: false },
          { kind: "text", value: transaction.description, strong: true },
          { kind: "text", value: transactionPathLabel(transaction), strong: false },
          { kind: "badge", value: transaction.type ?? "unvalidated", tone: transaction.type === "income" ? "success" : transaction.type === "expense" ? "warning" : "muted" },
          { kind: "text", value: transaction.projectLabel ?? "—", strong: false },
          { kind: "money", value: formatSignedMicro(signedAmountMicro, transaction.currency), tone: moneyTone(signedAmountMicro) },
          { kind: "badge", value: transaction.status, tone: transactionStatusTone(transaction.status) }
        ]
      };
    });
  }

  function createPendingTableRows(rows: readonly OfficeTransaction[], selectedIds: readonly string[]): readonly TableRow[] {
    return rows.map((transaction: OfficeTransaction): TableRow => ({
      id: transaction.id,
      cells: [
        { kind: "text", value: formatDateOnly(transaction.occurredOn), strong: false },
        { kind: "badge", value: selectedIds.includes(transaction.id) ? "selected" : "to validate", tone: selectedIds.includes(transaction.id) ? "active" : "warning" },
        { kind: "text", value: transaction.description, strong: true },
        { kind: "text", value: transactionPathLabel(transaction), strong: false },
        { kind: "money", value: formatSignedMicro(typedSignedAmountMicro(transaction), transaction.currency), tone: moneyTone(typedSignedAmountMicro(transaction)) },
        { kind: "badge", value: transaction.status, tone: "warning" }
      ]
    }));
  }

  function createReconciliationTableRows(rows: readonly OfficeReconciliationCandidate[], selectedIds: readonly string[]): readonly TableRow[] {
    return rows.map((candidate: OfficeReconciliationCandidate): TableRow => ({
      id: candidate.id,
      cells: [
        { kind: "text", value: formatDateOnly(candidate.occurredOn), strong: false },
        {
          kind: "badge",
          value: selectedIds.includes(candidate.id) ? "selected" : isReconciliationBulkCreatable(candidate) ? "selectable" : "locked",
          tone: selectedIds.includes(candidate.id) ? "active" : isReconciliationBulkCreatable(candidate) ? "muted" : "warning"
        },
        { kind: "text", value: candidate.bankDescription, strong: true },
        // amountMicro here is the bank line's MUR-converted magnitude (amountMurMinor),
        // not its original currency — MUR is the correct label, not a hardcoding bug.
        { kind: "money", value: formatSignedMicro(candidate.amountMicro, "MUR"), tone: moneyTone(candidate.amountMicro) },
        { kind: "text", value: candidate.ledgerDescription, strong: false },
        { kind: "badge", value: formatConfidence(candidate.confidenceBp), tone: confidenceTone(candidate.confidenceBp) },
        { kind: "badge", value: candidate.status, tone: reconciliationTone(candidate.status) }
      ]
    }));
  }

  function createCashflowPoints(rows: readonly CashflowBucket[], mode: "inflow" | "outflow"): readonly ChartPoint[] {
    return rows.map((row: CashflowBucket): ChartPoint => ({
      label: row.period.slice(5),
      value: mode === "inflow" ? row.inflowLevel : row.outflowLevel
    }));
  }

  function createCashflowTableRows(rows: readonly CashflowBucket[]): readonly TableRow[] {
    return rows.map((row: CashflowBucket): TableRow => ({
      id: row.period,
      cells: [
        { kind: "text", value: periodLabel(row.period), strong: true },
        { kind: "money", value: formatMicro(row.inflowMicro), tone: "success" },
        { kind: "money", value: formatMicro(row.outflowMicro), tone: "error" },
        { kind: "money", value: formatMicro(row.closingMicro), tone: "info" }
      ]
    }));
  }

  function createAuditTableRows(rows: readonly AuditLogEntry[]): readonly TableRow[] {
    return rows.map((entry: AuditLogEntry): TableRow => ({
      id: entry.id,
      cells: [
        { kind: "text", value: formatDateOnly(entry.occurredAt), strong: false },
        { kind: "text", value: entry.action, strong: true },
        { kind: "text", value: entry.entityType, strong: false },
        { kind: "text", value: entry.entityReference, strong: false },
        { kind: "badge", value: entry.idempotencyKey === null ? "read" : "idempotent", tone: entry.idempotencyKey === null ? "muted" : "success" }
      ]
    }));
  }

  function createRecentImportRows(state: ApiRequestState<OfficeDashboardResponse>): readonly TableRow[] {
    if (state.status !== "success") {
      return [];
    }

    return (state.data.recentImports ?? []).map((item: OfficeRecentImport): TableRow => ({
      id: item.id,
      cells: [
        { kind: "text", value: item.fileName, strong: true },
        { kind: "text", value: sourceLabel(item.source), strong: false },
        { kind: "text", value: String(item.acceptedRowCount), strong: false },
        { kind: "text", value: item.periodLabel, strong: false },
        { kind: "badge", value: item.status, tone: recentImportStatusTone(item.status) }
      ]
    }));
  }

  function createPlanOptions(
    nodes: readonly OfficePlanComptableNode[],
    kind: "department" | "division" | "category",
    allLabel: string
  ): readonly SelectOption[] {
    return sortOptionsAlphabetically([
      { label: allLabel, value: allValue },
      ...nodes
        .filter((node: OfficePlanComptableNode): boolean => node.kind === kind)
        .map((node: OfficePlanComptableNode): SelectOption => ({ label: node.label, value: node.id }))
    ], 1);
  }

  function createParentOptions(nodes: readonly OfficePlanComptableNode[]): readonly SelectOption[] {
    return sortOptionsAlphabetically([
      { label: "Root", value: allValue },
      ...nodes
        .filter((node: OfficePlanComptableNode): boolean => node.kind !== "category")
        .map((node: OfficePlanComptableNode): SelectOption => ({ label: planReferenceLabel(node), value: node.id }))
    ], 1);
  }

  function createProjectOptions(rows: readonly OfficeTransaction[]): readonly SelectOption[] {
    const projectPairs = rows
      .filter((transaction: OfficeTransaction): boolean => transaction.projectId !== null && transaction.projectLabel !== null)
      .map((transaction: OfficeTransaction): SelectOption => ({
        label: transaction.projectLabel ?? "",
        value: transaction.projectId ?? ""
      }));
    const uniqueValues = new Set<string>();
    const uniqueProjects: SelectOption[] = [];

    for (const project of projectPairs) {
      if (!uniqueValues.has(project.value)) {
        uniqueValues.add(project.value);
        uniqueProjects.push(project);
      }
    }

    return sortOptionsAlphabetically([{ label: "All projects", value: allValue }, ...uniqueProjects], 1);
  }

  function toNullableFilter(value: SelectFilterValue): string | null {
    if (value === allValue) {
      return null;
    }

    return value;
  }

  function toNullableCategoryType(value: SelectFilterValue): OfficeCategoryType | null {
    if (value === "income" || value === "expense") {
      return value;
    }

    return null;
  }

  function toNullableTransactionStatus(value: SelectFilterValue): "pending" | "draft" | "posted" | "reconciled" | "voided" | null {
    if (value === "pending" || value === "draft" || value === "posted" || value === "reconciled" || value === "voided") {
      return value;
    }

    return null;
  }

  function toNullableReconciliationStatus(value: SelectFilterValue): "unmatched" | "suggested" | "matched" | "rejected" | "ignored" | null {
    if (value === "unmatched" || value === "suggested" || value === "matched" || value === "rejected" || value === "ignored") {
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

  function officeImportSourceFromValue(value: string): ImportSource {
    if (value === "mcb" || value === "sbi" || value === "csv" || value === "cashflow" || value === "pdf") {
      return value;
    }

    throw new Error(`Unknown Office import source: ${value}.`);
  }

  function sourceLabel(source: ImportSource): string {
    const option = importSourceOptions.find((item: SelectOption): boolean => item.value === source);

    if (option === undefined) {
      throw new Error(`Unknown Office import source label: ${source}.`);
    }

    return option.label;
  }

  function recentImportStatusTone(status: "previewed" | "confirmed" | "failed"): Tone {
    if (status === "confirmed") {
      return "success";
    }

    if (status === "failed") {
      return "error";
    }

    return "info";
  }

  function formatMicro(amountMicro: string): string {
    return formatMoney(amountMicro, "MUR");
  }

  function formatMoney(amountMicro: string, currency: CurrencyCode): string {
    return formatMoneyValue(amountMicro, currency);
  }

  function formatSignedMicro(amountMicro: string, currency: CurrencyCode): string {
    return formatSignedMoneyValue(amountMicro, currency);
  }

  function moneyTone(amountMicro: string): Tone {
    return moneyToneForValue(amountMicro);
  }

  function planReferenceLabel(node: OfficePlanComptableNode): string {
    const code = node.code.trim();

    if (code.length === 0 || code === node.id || isUuidLike(code)) {
      return node.label;
    }

    return code;
  }

  function isUuidLike(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  function formatMargin(netMicro: string, incomeMicro: string): string {
    const income = apiMoneyToMicroUnits(incomeMicro);
    if (income === 0n) {
      return "0.00%";
    }

    const net = apiMoneyToMicroUnits(netMicro);
    const basisPoints = (net * 10_000n) / income;
    const sign = basisPoints < 0n ? "-" : "";
    const absolute = basisPoints < 0n ? -basisPoints : basisPoints;
    const whole = absolute / 100n;
    const fraction = absolute % 100n;
    return `${sign}${whole.toString()}.${fraction.toString().padStart(2, "0")}%`;
  }

  function pageUsesPeriodControl(pageId: OfficePageId): boolean {
    return pageId === "dashboard" ||
      pageId === "ceo" ||
      pageId === "pnl" ||
      pageId === "transactions" ||
      pageId === "reconciliation" ||
      pageId === "pending" ||
      pageId === "cashflow" ||
      pageId === "clients" ||
      pageId === "suppliers" ||
      pageId === "projects" ||
      pageId === "monitoring" ||
      pageId === "bank" ||
      pageId === "vat";
  }

  function writeDisabledTitle(): string {
    return writesEnabled ? "" : writeGateMessage;
  }

  function planKindTone(kind: "department" | "division" | "category"): Tone {
    if (kind === "department") {
      return "active";
    }

    if (kind === "division") {
      return "info";
    }

    return "muted";
  }

  function transactionStatusTone(status: "pending" | "draft" | "posted" | "reconciled" | "voided"): Tone {
    if (status === "reconciled") {
      return "success";
    }

    if (status === "posted") {
      return "info";
    }

    if (status === "draft" || status === "pending") {
      return "warning";
    }

    return "muted";
  }

  function reconciliationTone(status: OfficeReconciliationCandidate["status"]): Tone {
    if (status === "matched") {
      return "success";
    }

    if (status === "suggested") {
      return "info";
    }

    if (status === "rejected") {
      return "muted";
    }

    return "warning";
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

  function formatConfidence(confidenceBp: number): string {
    return `${String(Math.trunc(confidenceBp / 100))}%`;
  }

  function indentPlanLabel(node: OfficePlanComptableNode, nodes: readonly OfficePlanComptableNode[]): string {
    const depth = getPlanDepth(node, nodes);

    if (depth === 1) {
      return node.label;
    }

    if (depth === 2) {
      return `· ${node.label}`;
    }

    return `·· ${node.label}`;
  }

  function getPlanDepth(node: OfficePlanComptableNode, nodes: readonly OfficePlanComptableNode[]): 1 | 2 | 3 {
    if (node.parentId === null) {
      return 1;
    }

    const parent = nodes.find((item: OfficePlanComptableNode): boolean => item.id === node.parentId);

    if (parent === undefined || parent.parentId === null) {
      return 2;
    }

    return 3;
  }

  function createIdempotencyKey(scope: string): string {
    return `office-${scope}-${Date.now().toString()}`;
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return "Unknown error.";
  }
</script>

<svelte:head>
  <title>ë • Office</title>
</svelte:head>

<WorkspaceShell
  workspace="office"
  brandLabel="ë • office"
  homeHref="/console"
  navLabel="Office navigation"
  navItems={[]}
  navGroups={shellNavGroups}
  showWorkspaceNav={true}
  statusLabel="eof/v1"
  statusValue={writesEnabled ? "writes enabled" : "live reads"}
  onNavigate={handleShellNavigate}
>
    <div class={`content office-page-${activePageId}`}>
      <nav class="office-tab-bar ehq-edge-surface" aria-label="Sections Office">
        {#each officeTabItems as item (item.id)}
          <a
            class="office-tab"
            class:active={activePageId === item.id}
            href={item.id}
            onclick={(event: MouseEvent): void => {
              event.preventDefault();
              selectPage(item.id);
            }}
          >{item.label}</a>
        {/each}
      </nav>
      <section class:office-dashboard-hero={activePageId === "dashboard"} class="office-page-intro">
        <PageHeader
          workspace="office"
          eyebrow="Office"
          title={activePage.title}
          description={activePage.subtitle}
          meta=""
          statusLabel=""
          statusTone="muted"
        />

        {#if periodControlVisible}
          <section class="period-control ehq-edge-surface" aria-label="Period control">
            <Select
              id="office-period-scope"
              label="Period"
              value={periodScope}
              options={periodOptions}
              state="default"
              message=""
              onchange={updatePeriodScope}
            />
            {#if periodScope === "custom"}
              <label>
                <span class="ehq-type-label-mono">From</span>
                <input type="date" value={activeRange.from} max={activeRange.to} onchange={updateCustomFrom} />
              </label>
              <label>
                <span class="ehq-type-label-mono">To</span>
                <input type="date" value={activeRange.to} min={activeRange.from} onchange={updateCustomTo} />
              </label>
            {/if}
            <p class="ehq-type-label-mono">{rangeLabel(activeRange)}</p>
          </section>
        {/if}
      </section>

      {#if actionReceipt !== null}
        <Alert tone="success" title="Action accepted" message="Audit recorded." dismissible={false} />
      {/if}

      {#if activePageId === "dashboard"}
        <section class="kpi-grid" aria-label="Office indicators">
          {#each dashboardStats as stat (stat.label)}
            <StatCard
              label={stat.label}
              value={stat.value}
              trendDirection={stat.trendDirection}
              trendValue={stat.trendValue}
              trendDetail={stat.trendDetail}
            />
          {/each}
        </section>

        <section class="kpi-grid" aria-label="Dashboard analytics indicators">
          {#each dashboardAnalyticsKpis as kpi (kpi.label)}
            <KPI
              label={kpi.label}
              value={kpi.value}
              detail={kpi.detail}
              tone={kpi.tone}
              state={isLoadingState(dashboardAnalyticsState) ? "loading" : "default"}
              accent={kpi.accent}
            />
          {/each}
        </section>

        <section class="dashboard-grid">
          <div class="panel-card ehq-edge-surface">
            <SectionTemplate eyebrow="PROMPT 1 · runway — months of cash left" title="Runway" detail="Cash left and average burn based on selected period." state={isLoadingState(dashboardAnalyticsState) ? "loading" : dashboardAnalyticsState.status === "error" ? "error" : "ready"}>
              <KPI label="Runway" value={dashboardRunwayPanel.value} detail={dashboardRunwayPanel.detail} tone={dashboardRunwayPanel.tone} state={isLoadingState(dashboardAnalyticsState) ? "loading" : "default"} accent={true} />
              <div class="runway-meta">
                <span>Cash {dashboardRunwayPanel.cash}</span>
                <span>Avg burn {dashboardRunwayPanel.burn} / month</span>
                <span>Window {dashboardRunwayPanel.monthsUsed}</span>
                {#if dashboardRunwayPanel.excludedForeignAccounts.length > 0}
                  <span class="runway-meta-note">Comptes devises exclus (V1, pas de source EUR->MUR):</span>
                  {#each dashboardRunwayPanel.excludedForeignAccounts as accountLabel (accountLabel)}
                    <span class="runway-meta-note">{accountLabel}</span>
                  {/each}
                {/if}
              </div>
            </SectionTemplate>
          </div>

          <div class="panel-card ehq-edge-surface">
            <SectionTemplate eyebrow="PROMPT 4 · reconciliation health — by account" title="Reconciliation health" detail="Matched rate, unmatched pressure, and ageing by bank account." state={isLoadingState(dashboardAnalyticsState) ? "loading" : dashboardAnalyticsState.status === "error" ? "error" : "ready"}>
              <BarsChart title="Unmatched lines by account" points={dashboardReconciliationPoints} tone="info" />
              <Table title="Account reconciliation health" columns={dashboardReconciliationColumns} rows={dashboardReconciliationRows} state={isLoadingState(dashboardAnalyticsState) ? "loading" : dashboardAnalyticsState.status === "error" ? "error" : dashboardReconciliationRows.length === 0 ? "empty" : "default"} actionLabel="" />
            </SectionTemplate>
          </div>
        </section>

        <section class="dashboard-grid">
          <div class="panel-card ehq-edge-surface">
            <SectionTemplate eyebrow="PROMPT 2 · top categories by expense" title="Top categories by expense" detail="Fiable par categorie. Classement fournisseur: champ contrepartie structure requis." state={isLoadingState(dashboardAnalyticsState) ? "loading" : dashboardAnalyticsState.status === "error" ? "error" : "ready"}>
              <BarsChart title="Expense concentration" points={dashboardExpenseCategoryPoints} tone="warning" />
              <Table title="Top expense categories" columns={dashboardExpenseCategoryColumns} rows={dashboardExpenseCategoryRows} state={isLoadingState(dashboardAnalyticsState) ? "loading" : dashboardAnalyticsState.status === "error" ? "error" : dashboardExpenseCategoryRows.length === 0 ? "empty" : "default"} actionLabel="" />
            </SectionTemplate>
          </div>

          <div class="panel-card ehq-edge-surface">
            <SectionTemplate eyebrow="PROMPT 3 · project profitability — worst first" title="Project profitability" detail="Net contribution ranking over the selected period." state={isLoadingState(dashboardAnalyticsState) ? "loading" : dashboardAnalyticsState.status === "error" ? "error" : "ready"}>
              <BarsChart title="Top project net contribution" points={dashboardProjectProfitabilityPoints} tone="success" />
              <Table title="Project profitability" columns={dashboardProjectProfitabilityColumns} rows={dashboardProjectProfitabilityRows} state={isLoadingState(dashboardAnalyticsState) ? "loading" : dashboardAnalyticsState.status === "error" ? "error" : dashboardProjectProfitabilityRows.length === 0 ? "empty" : "default"} actionLabel="" />
            </SectionTemplate>
          </div>
        </section>

        <section class="dashboard-grid">
          <div class="panel-card ehq-edge-surface dashboard-wide-panel">
            <SectionTemplate eyebrow="PROMPT 5 · expense trend by department — monthly" title="Expense trend by department" detail="Monthly rolling trend by department." state={isLoadingState(dashboardAnalyticsState) ? "loading" : dashboardAnalyticsState.status === "error" ? "error" : "ready"}>
              <LineChart title="Rolling expense trend (top department)" points={dashboardExpenseTrendPoints} tone="active" />
              <Table title="Department trend snapshot" columns={dashboardExpenseTrendColumns} rows={dashboardExpenseTrendRows} state={isLoadingState(dashboardAnalyticsState) ? "loading" : dashboardAnalyticsState.status === "error" ? "error" : dashboardExpenseTrendRows.length === 0 ? "empty" : "default"} actionLabel="" />
            </SectionTemplate>
          </div>
        </section>
      {:else if activePageId === "pnl"}
        <section class="kpi-grid" aria-label="P&L indicators">
          {#each pnlKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingState(pnlState) ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>

        <section class="filter-strip ehq-edge-surface" aria-label="P&L filters">
          <Select
            id="office-pnl-department"
            label="Department"
            value={departmentFilter}
            options={departmentOptions}
            state="default"
            message=""
            onchange={updateDepartmentFilter}
          />
          <Button label="Filter" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply P&L filters" onclick={applyPnlFilters} />
        </section>

        {#if isLoadingState(pnlState)}
          <Loader label="Loading P&L" detail="Reading validated projections." size="medium" />
        {:else}
          <section class="dashboard-grid">
            <DivergeChart title="Revenue and expenses by department" points={pnlChartPoints} />
            <Table title="Result by department" columns={pnlColumns} rows={pnlTableRows} state={pnlState.status === "error" ? "error" : pnlTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
          </section>
          <section class="dashboard-grid">
            <BarsChart title="Top category impact (absolute net)" points={pnlCategoryImpactPoints} tone="active" />
            <Table title="Result by division" columns={divisionPnlColumns} rows={divisionPnlTableRows} state={isLoadingState(divisionPnlState) ? "loading" : divisionPnlState.status === "error" ? "error" : divisionPnlTableRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={divisionPnlPagination} />
          </section>
          <Table title="Result by category" columns={pnlLineColumns} rows={pnlLineTableRows} state={isLoadingState(pnlCategoryState) ? "loading" : pnlCategoryState.status === "error" ? "error" : pnlLineTableRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={pnlCategoryPagination} />
        {/if}
      {:else if activePageId === "coa"}
        <section class="form-panel ehq-edge-surface" aria-label="Chart of accounts editor">
          <Select id="office-plan-kind" label="Type" value={planForm.kind} options={planKindOptions} state="default" message="" onchange={updatePlanKind} />
          <Select id="office-plan-parent" label="Parent" value={planForm.parentId} options={parentOptions} state="default" message="" onchange={updatePlanParent} />
          <Input id="office-plan-code" label="Code" value={planForm.code} placeholder="" type="text" state="default" message="" oninput={updatePlanCode} />
          <Input id="office-plan-label" label="Label" value={planForm.label} placeholder="" type="text" state="default" message="" oninput={updatePlanLabel} />
          {#if planForm.kind === "category"}
            <Select id="office-plan-type" label="Category type" value={planForm.type} options={planTypeOptions} state="default" message="" onchange={updatePlanType} />
          {/if}
          <Button label="Create" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Create plan node" title={writeDisabledTitle()} onclick={createPlanNode} />
          <Button label="Deactivate a category" variant="secondary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Deactivate a category" title={writeDisabledTitle()} onclick={deactivateFirstCategory} />
        </section>

        <section class="dashboard-grid">
          <BarsChart title="Chart of accounts node mix" points={coaStructurePoints} tone="info" />
        </section>

        <Table title="Department → Division → Category" columns={planColumns} rows={planTableRows} state={isLoadingState(planTableState) ? "loading" : planTableState.status === "error" ? "error" : planTableRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={planRowActions} pagination={planPagination} />
      {:else if activePageId === "transactions"}
        <section class="filter-grid ehq-edge-surface" aria-label="Transaction filters">
          <Select id="office-filter-account" label="Account" value={accountFilter} options={accountOptions} state="default" message="" onchange={updateAccountFilter} />
          <Select id="office-filter-department" label="Department" value={departmentFilter} options={departmentOptions} state="default" message="" onchange={updateDepartmentFilter} />
          <Select id="office-filter-division" label="Division" value={divisionFilter} options={divisionOptions} state="default" message="" onchange={updateDivisionFilter} />
          <Select id="office-filter-category" label="Category" value={categoryFilter} options={categoryOptions} state="default" message="" onchange={updateCategoryFilter} />
          <Select id="office-filter-project" label="Project" value={projectFilter} options={projectOptions} state="default" message="" onchange={updateProjectFilter} />
          <Select id="office-filter-type" label="Type" value={typeFilter} options={typeOptions} state="default" message="" onchange={updateTypeFilter} />
          <Select id="office-filter-status" label="Status" value={transactionStatusFilter} options={statusOptions} state="default" message="" onchange={updateTransactionStatusFilter} />
          <div class="filter-actions">
            <Button label="Filter" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply transaction filters" onclick={applyTransactionFilters} />
            <Button label="New entry" variant="secondary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="New ledger entry" title={writeDisabledTitle()} onclick={openTransactionCreate} />
            <Button label="Export CSV" variant="secondary" size="medium" type="button" disabled={transactionRows.length === 0} loading={false} locked={false} focus={false} ariaLabel="Export transactions as CSV" onclick={exportTransactionsCsv} />
          </div>
        </section>

        <section class="dashboard-grid">
          <BarsChart title="Transaction mix by type (current page)" points={transactionTypePoints} tone="active" />
          <BarsChart title="Transaction mix by status (current page)" points={transactionStatusPoints} tone="info" />
        </section>

        {#if creatingTransaction}
          <section class="office-edit-panel ehq-edge-surface" aria-label="New entry" bind:this={transactionPanelElement}>
            <div class="office-edit-grid">
              <label>
                <span class="ehq-type-label-mono">Date</span>
                <input type="date" bind:value={createOccurredOn} />
              </label>
              <div class="office-edit-wide">
                <Input id="office-create-description" label="Description" value={createDescription} placeholder="" type="text" state="default" message="" oninput={(value: string): void => { createDescription = value; }} />
              </div>
              <Select
                id="office-create-account"
                label="Account"
                value={createAccountId}
                options={createAccountSelectOptions}
                state={importAccounts.length === 0 ? "disabled" : "default"}
                message=""
                onchange={(value: string): void => { createAccountId = value; }}
              />
              <Input id="office-create-amount" label="Amount" value={createAmount} placeholder="1200.00" type="text" state="default" message="" oninput={(value: string): void => { createAmount = value; }} />
              <Select id="office-create-direction" label="Direction" value={createDirection} options={createDirectionOptions} state="default" message="" onchange={(value: string): void => { createDirection = value === "income" ? "income" : "expense"; }} />
              <Select id="office-create-category" label="Category" value={createCategoryId} options={optionalCategoryOptions} state="default" message="" onchange={(value: string): void => { createCategoryId = value; }} />
              <Select id="office-create-project" label="Project" value={createProjectId} options={optionalProjectOptions} state="default" message="" onchange={(value: string): void => { createProjectId = value; }} />
            </div>
            <div class="office-edit-actions">
              <Button label="Create entry" variant="primary" size="medium" type="button" disabled={!writesEnabled || !canSubmitTransactionCreate} loading={false} locked={false} focus={false} ariaLabel="Create entry" title={writeDisabledTitle()} onclick={submitTransactionCreate} />
              <Button label="Close" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Close the creation form" onclick={closeTransactionCreate} />
            </div>
          </section>
        {/if}

        {#if editingTransaction !== null}
          <section class="office-edit-panel ehq-edge-surface" aria-label="Edit transaction" bind:this={transactionPanelElement}>
            <div class="office-edit-grid">
              <label>
                <span class="ehq-type-label-mono">Date</span>
                <input type="date" bind:value={editOccurredOn} />
              </label>
              <div class="office-edit-wide">
                <Input id="office-edit-description" label="Description" value={editDescription} placeholder="" type="text" state="default" message="" oninput={(value: string): void => { editDescription = value; }} />
              </div>
              <Select
                id="office-edit-account"
                label="Account"
                value={editAccountId}
                options={createAccountSelectOptions}
                state={importAccounts.length === 0 ? "disabled" : "default"}
                message=""
                onchange={(value: string): void => { editAccountId = value; }}
              />
              <Input id="office-edit-amount" label="Amount" value={editAmount} placeholder="" type="text" state="default" message="" oninput={(value: string): void => { editAmount = value; }} />
              <Select id="office-edit-category" label="Category" value={editCategoryId} options={optionalCategoryOptions} state="default" message="" onchange={(value: string): void => { editCategoryId = value; }} />
              <Select id="office-edit-project" label="Project" value={editProjectId} options={optionalProjectOptions} state="default" message="" onchange={(value: string): void => { editProjectId = value; }} />
            </div>
            <div class="office-edit-actions">
              <Button label="Save" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Save transaction" title={writeDisabledTitle()} onclick={saveTransactionEdit} />
              <Button label="Validate" variant="secondary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Validate transaction" title={writeDisabledTitle()} onclick={validateEditingTransaction} />
              <Button label="Close" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Close editor" onclick={closeTransactionEditor} />
            </div>
          </section>
        {/if}

        <Table title={`Ledger · ${rangeLabel(activeRange)}`} columns={transactionColumns} rows={transactionTableRows} state={isLoadingState(transactionsState) ? "loading" : transactionsState.status === "error" ? "error" : transactionRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={ledgerRowActions} pagination={transactionPagination} />
      {:else if activePageId === "clients"}
        <PartnersView
          facet="client"
          client={client.office}
          workspaceId={officeWorkspaceId}
          {period}
          dateFrom={activeRange.from}
          dateTo={activeRange.to}
          writesEnabled={writesEnabled}
          onReceipt={receivePartnerReceipt}
        />
      {:else if activePageId === "suppliers"}
        <PartnersView
          facet="supplier"
          client={client.office}
          workspaceId={officeWorkspaceId}
          {period}
          dateFrom={activeRange.from}
          dateTo={activeRange.to}
          writesEnabled={writesEnabled}
          onReceipt={receivePartnerReceipt}
        />
      {:else if activePageId === "projects"}
        <ProjectsView client={client.office} workspaceId={officeWorkspaceId} {period} dateFrom={activeRange.from} dateTo={activeRange.to} writesEnabled={writesEnabled} />
      {:else if activePageId === "monitoring"}
        <MonitoringView client={client.office} workspaceId={officeWorkspaceId} {period} dateFrom={activeRange.from} dateTo={activeRange.to} />
      {:else if activePageId === "waveInvoices"}
        <section class="statement-import-panel ehq-edge-surface" aria-label="Wave invoices lane">
          <header>
            <div>
              <span class="ehq-type-label-mono">Wave invoices</span>
              <h2>Dedicated Wave lane</h2>
              <p>This page is dedicated to Wave invoice operations while keeping bank-statement imports in their existing workspace.</p>
            </div>
            <strong>{writesEnabled ? "Entries enabled" : "Entries locked"}</strong>
          </header>

          <div class="import-steps" aria-label="Wave invoices actions">
            <article class:complete={recentImportRows.length > 0}>
              <b>1</b>
              <span>Review latest imports</span>
              <small>{recentImportRows.length > 0 ? `${recentImportRows.length} batch(es) visible` : "No batch loaded"}</small>
            </article>
            <article class:complete={reconciliationRows.length > 0}>
              <b>2</b>
              <span>Check reconciliation queue</span>
              <small>{reconciliationRows.length > 0 ? `${reconciliationRows.length} row(s) in scope` : "No row in current scope"}</small>
            </article>
            <article class:complete={pendingRows.length > 0}>
              <b>3</b>
              <span>Classify pending transactions</span>
              <small>{pendingRows.length > 0 ? `${pendingRows.length} pending row(s)` : "No pending row in current scope"}</small>
            </article>
          </div>

          <div class="import-actions">
            <Button label="Open imports workflow" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Open imports workflow" onclick={(): void => { selectPage("imports"); }} />
            <Button label="Open reconciliation" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Open reconciliation" onclick={(): void => { selectPage("reconciliation"); }} />
            <Button label="Open pending" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Open pending" onclick={(): void => { selectPage("pending"); }} />
          </div>
        </section>

        <section class="dashboard-grid">
          <BarsChart title="Import quality" points={importQualityPoints} tone="warning" />
          <BarsChart title="Reconciliation status" points={reconciliationStatusPoints} tone="info" />
        </section>

        <Table title="Recent batches" columns={importColumns} rows={recentImportRows} state={isLoadingState(dashboardState) ? "loading" : dashboardState.status === "error" ? "error" : recentImportRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={importRowActions} />
      {:else if activePageId === "imports"}
        <section class="statement-import-panel ehq-edge-surface" aria-label="Import a bank statement">
          <header>
            <div>
              <span class="ehq-type-label-mono">Monthly bank import</span>
              <h2>Import a statement</h2>
              <p>Drop an MCB or SBI/SBM PDF. The app detects the bank, reads the rows, runs the API preview, then you confirm the import.</p>
            </div>
            <strong>{writesEnabled ? "Entries enabled" : "Entries locked"}</strong>
          </header>

          <div class="import-steps" aria-label="Import progress">
            <article class:complete={importState.fileName.length > 0}>
              <b>1</b>
              <span>File</span>
              <small>{importState.fileName.length > 0 ? importState.fileName : "No file"}</small>
            </article>
            <article class:complete={importState.preview !== null}>
              <b>2</b>
              <span>Analysis</span>
              <small>{importState.preview === null ? "Pending" : `${importState.preview.acceptedRowCount} rows ready`}</small>
            </article>
            <article class:complete={importState.confirm !== null}>
              <b>3</b>
              <span>Import</span>
              <small>{importState.confirm === null ? "Not confirmed" : `${importState.confirm.importedTransactionCount} transactions`}</small>
            </article>
          </div>

          <div class="import-actions">
            <div class="file-control">
              <Select
                id="office-import-account"
                label="Destination account"
                value={selectedImportAccountId}
                options={importAccountSelectOptions}
                state={importAccounts.length === 0 ? "disabled" : "default"}
                message=""
                onchange={(value: string): void => { selectedImportAccountId = value; }}
              />
            </div>
            <label class="file-control">
              <span class="ehq-type-label-mono">Bank statement PDF or CSV</span>
              <input type="file" accept="application/pdf,.pdf,text/csv,.csv" onchange={handleStatementFile} />
            </label>
            <Button label="Analyze" variant="secondary" size="medium" type="button" disabled={!canPreviewImport} loading={false} locked={false} focus={false} ariaLabel="Analyze the statement" onclick={previewImport} />
            <Button label="Import to database" variant="primary" size="medium" type="button" disabled={!canConfirmImport || !writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Import the statement to the database" title={writeDisabledTitle()} onclick={confirmImport} />
          </div>

          <details class="import-advanced">
            <summary>Source correction</summary>
            <Select
              id="office-import-source"
              label="Detected bank"
              value={importState.source}
              options={bankStatementSourceOptions}
              state="default"
              message=""
              onchange={updateImportSource}
            />
          </details>

          <section class="dashboard-grid">
            <BarsChart title="Import quality" points={importQualityPoints} tone="warning" />
          </section>

          <section class="import-result ehq-type-label-mono" class:error={importState.status === "error"} aria-live="polite">
            <strong>{importState.message}</strong>
            {#if importState.preview !== null}
              <span>{sourceLabel(importState.preview.source)} · {importState.preview.periodLabel} · {importState.preview.currencyCodes.join(" / ")}</span>
              <span>{importState.preview.acceptedRowCount} rows ready · {importState.preview.rejectedRowCount} rejected · {importState.preview.duplicateRowCount} duplicates</span>
              <span>{importState.preview.accountReference ?? "Account detected on confirmation"}</span>
              {#if importState.preview.openingBalanceMicro !== null && importState.preview.closingBalanceMicro !== null}
                <span>Opening {formatMoney(importState.preview.openingBalanceMicro, importState.preview.currencyCodes[0] ?? "MUR")} · closing {formatMoney(importState.preview.closingBalanceMicro, importState.preview.currencyCodes[0] ?? "MUR")}</span>
              {/if}
              {#each importState.preview.warnings as warning (warning)}
                <span>{warning}</span>
              {/each}
            {/if}
            {#if !writesEnabled}
              <span>To import to the database, the API must have WRITES_ENABLED=true and be restarted.</span>
            {/if}
          </section>

          {#if importState.preview !== null && importPreviewTableRows.length > 0}
            <section class="import-rows" aria-label="Detected rows">
              <header class="import-rows-head">
                <span class="ehq-type-label-mono">Detected rows · {importPreviewTableRows.length} · {selectedImportRowIds.length} checked</span>
                <div class="import-rows-tools">
                  <Button label="Check all" variant="secondary" size="small" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Check all rows" onclick={(): void => { setAllImportRows(true); }} />
                  <Button label="Uncheck all" variant="secondary" size="small" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Uncheck all rows" onclick={(): void => { setAllImportRows(false); }} />
                </div>
              </header>
              <div class="import-rows-table" role="table">
                <div class="import-row import-row--header" role="row">
                  <span role="columnheader">Date</span>
                  <span role="columnheader">Description</span>
                  <span role="columnheader">Amount</span>
                  <span role="columnheader">Direction</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader" aria-label="Import"></span>
                  <span role="columnheader" aria-label="Action"></span>
                </div>
                {#each importPreviewTableRows.slice(0, 200) as row (row.id)}
                  <div class="import-row" class:import-row--rejected={row.status === "rejected"} role="row">
                    <span role="cell">{row.date}</span>
                    <span role="cell" class="import-row-desc">{row.description}</span>
                    <span role="cell">{row.amount} {row.currency}</span>
                    <span role="cell">{row.direction}</span>
                    <span role="cell">{row.status === "accepted" ? "Accepted" : `Rejected — ${row.reason}`}</span>
                    <span role="cell">
                      {#if row.status === "accepted"}
                        <input type="checkbox" checked={importRowSelection[row.id] === true} onchange={() => toggleImportRow(row.id)} aria-label={`Import row ${String(row.rowNumber)}`} />
                      {:else}
                        <span class="import-row-flag" aria-hidden="true">!</span>
                      {/if}
                    </span>
                    <span role="cell">
                      {#if row.status === "rejected"}
                        <Button label="Fix" variant="secondary" size="small" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel={`Fix row ${String(row.rowNumber)}`} onclick={(): void => { startImportRowEdit(row.rowNumber); }} />
                      {/if}
                    </span>
                  </div>
                {/each}
              </div>
              {#if importPreviewTableRows.length > 200}
                <small>{importPreviewTableRows.length - 200} additional rows not shown — every checked accepted row will be imported.</small>
              {/if}

              {#if editingImportRowNumber !== null}
                <div class="import-row-editor ehq-edge-surface" aria-label="Fix a row">
                  <span class="ehq-type-label-mono">Fix row {editingImportRowNumber} then re-analyze</span>
                  <div class="import-row-editor-grid">
                    <Input id="office-import-edit-date" label="Date (YYYY-MM-DD)" value={importEditDate} placeholder="2026-05-27" type="text" state="default" message="" oninput={(value: string): void => { importEditDate = value; }} />
                    <Input id="office-import-edit-description" label="Description" value={importEditDescription} placeholder="" type="text" state="default" message="" oninput={(value: string): void => { importEditDescription = value; }} />
                    <Select id="office-import-edit-direction" label="Direction" value={importEditDirection} options={importEditDirectionOptions} state="default" message="" onchange={(value: string): void => { importEditDirection = value === "credit" ? "credit" : "debit"; }} />
                    <Input id="office-import-edit-amount" label="Amount" value={importEditAmount} placeholder="40.00" type="text" state="default" message="" oninput={(value: string): void => { importEditAmount = value; }} />
                  </div>
                  <div class="import-row-editor-actions">
                    <Button label="Apply + re-analyze" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply the fix and re-analyze" onclick={applyImportRowEdit} />
                    <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel the fix" onclick={cancelImportRowEdit} />
                  </div>
                </div>
              {/if}
            </section>
          {/if}
        </section>

        <Table title="Bank batches known to the API" columns={importColumns} rows={recentImportRows} state={isLoadingState(dashboardState) ? "loading" : dashboardState.status === "error" ? "error" : recentImportRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={importRowActions} />
      {:else if activePageId === "reconciliation"}
        <section class="filter-strip ehq-edge-surface" aria-label="Reconciliation filters">
          <Select id="office-reconciliation-account" label="Account" value={accountFilter} options={accountOptions} state="default" message="" onchange={updateAccountFilter} />
          <Select id="office-reconciliation-status" label="Status" value={reconciliationStatusFilter} options={reconciliationStatusOptions} state="default" message="" onchange={updateReconciliationStatusFilter} />
          <Button label="Filter" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Apply reconciliation filters" onclick={applyReconciliationFilters} />
          <Button label={reconciliationAllVisibleSelected ? "Unselect all visible" : "Select all visible"} variant="secondary" size="medium" type="button" disabled={selectableReconciliationIds.length === 0} loading={false} locked={false} focus={false} ariaLabel="Toggle select all visible reconciliation rows" onclick={toggleSelectAllReconciliations} />
          <Button label="Bulk create transaction" variant="primary" size="medium" type="button" disabled={!writesEnabled || selectedCreatableReconciliationIds.length === 0} loading={false} locked={false} focus={false} ariaLabel="Create transactions from selected reconciliation rows" title={writeDisabledTitle()} onclick={bulkCreateSelectedReconciliations} />
          <span class="ehq-type-label-mono">{selectedCreatableReconciliationIds.length} selected</span>
          <Button label="Auto-approve strong suggested" variant="primary" size="medium" type="button" disabled={!writesEnabled} loading={false} locked={false} focus={false} ariaLabel="Auto-approve suggested reconciliations above confidence threshold" title={writeDisabledTitle()} onclick={approveSuggestedReconciliations} />
        </section>

        <section class="kpi-grid" aria-label="Reconciliation operations indicators">
          {#each reconciliationOperationsKpis as kpi (kpi.label)}
            <KPI
              label={kpi.label}
              value={kpi.value}
              detail={kpi.detail}
              tone={kpi.tone}
              state={isLoadingState(reconciliationOperationsState) ? "loading" : "default"}
              accent={kpi.accent}
            />
          {/each}
        </section>

        <section class="dashboard-grid">
          <BarsChart title="Reconciliation status mix (current page)" points={reconciliationStatusPoints} tone="info" />
        </section>

        <Table title="Bank ↔ ledger matching" columns={reconciliationColumns} rows={reconciliationTableRows} state={isLoadingState(reconciliationState) ? "loading" : reconciliationState.status === "error" ? "error" : reconciliationRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={reconciliationRowActions} pagination={reconciliationPagination} />

        {#if reconcileDrawerLineId !== null}
          <Drawer
            open={true}
            title={reconcileDrawerMode === "match" ? `Match “${reconcileDrawerBankLabel}”` : `Create an entry from “${reconcileDrawerBankLabel}”`}
            badgeLabel={reconcileDrawerMode === "match" ? "match" : "creation"}
            badgeTone="info"
            body=""
            primaryAction={reconcileDrawerMode === "match" ? "Match" : "Create & match"}
            secondaryAction="Cancel"
            state="default"
            primaryDisabled={!writesEnabled || (reconcileDrawerMode === "match" && reconcileMatchTransactionId.length === 0)}
            primaryTitle={writeDisabledTitle()}
            onPrimary={reconcileDrawerMode === "match" ? submitReconcileMatch : submitReconcileCreate}
            onSecondary={closeReconcileDrawer}
          >
            {#snippet content()}
              {#if reconcileDrawerMode === "match"}
                <Select
                  id="office-reconcile-transaction"
                  label="Ledger entry"
                  value={reconcileMatchTransactionId}
                  options={reconcileMatchSelectOptions}
                  state="default"
                  message=""
                  onchange={(value: string): void => { reconcileMatchTransactionId = value; }}
                />
              {:else}
                <Select
                  id="office-reconcile-category"
                  label="Category (opt.)"
                  value={reconcileCreateCategoryId}
                  options={reconcileCategoryOptions}
                  state="default"
                  message=""
                  onchange={(value: string): void => { reconcileCreateCategoryId = value; }}
                />
                <Select
                  id="office-reconcile-project"
                  label="Project (opt.)"
                  value={reconcileCreateProjectId}
                  options={reconcileProjectOptions}
                  state="default"
                  message=""
                  onchange={(value: string): void => { reconcileCreateProjectId = value; }}
                />
              {/if}
            {/snippet}
          </Drawer>
        {/if}
      {:else if activePageId === "pending"}
        <section class="pending-actions ehq-edge-surface" aria-label="Pending actions">
          <Select
            id="office-pending-category"
            label="Category"
            value={pendingClassifyCategoryId}
            options={pendingCategoryOptions}
            state="default"
            message=""
            onchange={(value: string): void => { pendingClassifyCategoryId = value; }}
          />
          <Select
            id="office-pending-project"
            label="Project (opt.)"
            value={pendingClassifyProjectId}
            options={pendingProjectOptions}
            state="default"
            message=""
            onchange={(value: string): void => { pendingClassifyProjectId = value; }}
          />
          <Button label={pendingAllVisibleSelected ? "Unselect all visible" : "Select all visible"} variant="secondary" size="medium" type="button" disabled={pendingVisibleIds.length === 0} loading={false} locked={false} focus={false} ariaLabel="Toggle select all pending rows" onclick={toggleSelectAllPending} />
          <Button label="Classify selection" variant="secondary" size="medium" type="button" disabled={!writesEnabled || selectedPendingIds.length === 0 || pendingClassifyCategoryId.length === 0} loading={false} locked={false} focus={false} ariaLabel="Classify selection" title={writeDisabledTitle()} onclick={classifySelectedPending} />
          <Button label="Validate selection" variant="primary" size="medium" type="button" disabled={!writesEnabled || selectedPendingIds.length === 0} loading={false} locked={false} focus={false} ariaLabel="Validate selection" title={writeDisabledTitle()} onclick={bulkValidatePending} />
          <span class="ehq-type-label-mono">{selectedPendingIds.length} selected</span>
        </section>

        <section class="office-edit-panel ehq-edge-surface" aria-label="Bulk ledger upsert">
          <div class="office-edit-grid">
            <label class="office-edit-wide">
              <span class="ehq-type-label-mono">Bulk ledger CSV (legacyId/externalId, occurredOn, type, amount, currency, description)</span>
              <input type="file" accept="text/csv,.csv" onchange={handleLedgerBulkFile} />
            </label>
          </div>
          <div class="office-edit-actions">
            <span class="ehq-type-label-mono">{ledgerBulkMessage}</span>
            <Button label="Confirm ledger upsert" variant="primary" size="medium" type="button" disabled={!writesEnabled || ledgerBulkRows.length === 0 || ledgerBulkPreview === null || ledgerBulkPreview.acceptedRowCount === 0} loading={false} locked={false} focus={false} ariaLabel="Confirm ledger upsert" title={writeDisabledTitle()} onclick={confirmLedgerBulkImport} />
          </div>
          {#if ledgerBulkPreview !== null}
            <div class="state-copy">
              <strong>Preview</strong>
              <span>{ledgerBulkPreview.acceptedRowCount} accepted · {ledgerBulkPreview.rejectedRowCount} rejected · {ledgerBulkPreview.validatedRowCount} validated.</span>
            </div>
          {/if}
        </section>

        <section class="dashboard-grid">
          <BarsChart title="Pending queue status mix (current page)" points={pendingStatusPoints} tone="warning" />
        </section>

        <Table title="Queue pending" columns={pendingColumns} rows={pendingTableRows} state={isLoadingState(pendingState) ? "loading" : pendingState.status === "error" ? "error" : pendingRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={pendingRowActions} pagination={pendingPagination} />
      {:else if activePageId === "cashflow"}
        <section class="filter-strip ehq-edge-surface" aria-label="Cash-flow filters">
          <Select id="office-cashflow-account" label="Account" value={accountFilter} options={accountOptions} state="default" message="" onchange={updateAccountFilter} />
          <Button label="Filter" variant="primary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Refresh cash-flow" onclick={applyCashflowFilters} />
        </section>

        <section class="office-edit-panel ehq-edge-surface" aria-label="Import a cashflow">
          <div class="office-edit-grid">
            <label class="office-edit-wide">
              <span class="ehq-type-label-mono">Import a cashflow CSV (Month, Inflow, Outflow, ClosingBalance, Currency)</span>
              <input type="file" accept="text/csv,.csv" onchange={handleCashflowFile} />
            </label>
          </div>
          <div class="office-edit-actions">
            <span class="ehq-type-label-mono">{cashflowImportMessage}</span>
            <Button label="Import to database" variant="primary" size="medium" type="button" disabled={!writesEnabled || cashflowImportRecords.length === 0} loading={false} locked={false} focus={false} ariaLabel="Import the cashflow to the database" title={writeDisabledTitle()} onclick={confirmCashflowFileImport} />
          </div>
        </section>

        <section class="dashboard-grid">
          <BarsChart title="Inflows" points={cashflowInflowPoints} tone="success" />
          <BarsChart title="Outflows" points={cashflowOutflowPoints} tone="error" />
        </section>

        <Table title="Cash-flow by month" columns={cashflowColumns} rows={cashflowTableRows} state={isLoadingState(cashflowState) ? "loading" : cashflowState.status === "error" ? "error" : cashflowTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
      {:else if activePageId === "ceo"}
        <CeoView client={client.office} workspaceId={officeWorkspaceId} {period} dateFrom={activeRange.from} dateTo={activeRange.to} />
      {:else if activePageId === "bank"}
        <BankView client={client.office} workspaceId={officeWorkspaceId} {period} dateFrom={activeRange.from} dateTo={activeRange.to} writesEnabled={writesEnabled} />
      {:else if activePageId === "audit"}
        <section class="dashboard-grid">
          <BarsChart title="Top audit actions" points={auditActionPoints} tone="muted" />
        </section>

        <Table title="Audit log" columns={auditColumns} rows={auditTableRows} state={isLoadingState(auditState) ? "loading" : auditState.status === "error" ? "error" : auditTableRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={auditPagination} />
      {:else if activePageId === "vat"}
        <VatView client={client.office} workspaceId={officeWorkspaceId} {period} dateFrom={activeRange.from} dateTo={activeRange.to} />
      {:else if activePageId === "settings"}
        <SettingsView client={client.office} workspaceId={officeWorkspaceId} {period} />
      {/if}
    </div>
</WorkspaceShell>

<script module lang="ts">
  import type { TableColumn, TableRow } from "@ehq/ui";

  // sortable stays false everywhere: the shared Table renders the sort glyph but
  // implements no sorting, so advertising it would be a dead affordance.
  const pnlColumns: readonly TableColumn[] = [
    { label: "Department", align: "left", sortable: true },
    { label: "Revenue", align: "right", sortable: true },
    { label: "Expenses", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true },
    { label: "Validated", align: "left", sortable: true }
  ];
  const divisionPnlColumns: readonly TableColumn[] = [
    { label: "Division", align: "left", sortable: true },
    { label: "Revenue", align: "right", sortable: true },
    { label: "Expenses", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true }
  ];
  const pnlLineColumns: readonly TableColumn[] = [
    { label: "Category", align: "left", sortable: true },
    { label: "Revenue", align: "right", sortable: true },
    { label: "Expenses", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true }
  ];
  const planColumns: readonly TableColumn[] = [
    { label: "Label", align: "left", sortable: true },
    { label: "Node", align: "left", sortable: true },
    { label: "Reference", align: "left", sortable: true },
    { label: "Category type", align: "left", sortable: true },
    { label: "Path", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const transactionColumns: readonly TableColumn[] = [
    { label: "Date", align: "left", sortable: true },
    { label: "Label", align: "left", sortable: true },
    { label: "Department · Division · Category", align: "left", sortable: true },
    { label: "Type", align: "left", sortable: true },
    { label: "Project", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const importColumns: readonly TableColumn[] = [
    { label: "File", align: "left", sortable: true },
    { label: "Source", align: "left", sortable: true },
    { label: "Rows", align: "right", sortable: true },
    { label: "Period", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const dashboardExpenseCategoryColumns: readonly TableColumn[] = [
    { label: "Category", align: "left", sortable: true },
    { label: "Expense", align: "right", sortable: true },
    { label: "Share", align: "left", sortable: true }
  ];
  const dashboardProjectProfitabilityColumns: readonly TableColumn[] = [
    { label: "Project", align: "left", sortable: true },
    { label: "Income", align: "right", sortable: true },
    { label: "Expense", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true },
    { label: "Margin", align: "left", sortable: true }
  ];
  const dashboardReconciliationColumns: readonly TableColumn[] = [
    { label: "Account", align: "left", sortable: true },
    { label: "Unmatched", align: "right", sortable: true },
    { label: "Matched", align: "left", sortable: true },
    { label: "Oldest", align: "left", sortable: true }
  ];
  const dashboardExpenseTrendColumns: readonly TableColumn[] = [
    { label: "Department", align: "left", sortable: true },
    { label: "Latest month", align: "right", sortable: true },
    { label: "Delta", align: "right", sortable: true },
    { label: "Window", align: "left", sortable: true }
  ];
  const reconciliationColumns: readonly TableColumn[] = [
    { label: "Date", align: "left", sortable: true },
    { label: "Selection", align: "left", sortable: true },
    { label: "Description", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Suggested match", align: "left", sortable: true },
    { label: "Conf.", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const pendingColumns: readonly TableColumn[] = [
    { label: "Date", align: "left", sortable: true },
    { label: "Selection", align: "left", sortable: true },
    { label: "Label", align: "left", sortable: true },
    { label: "Department · Division · Category", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const cashflowColumns: readonly TableColumn[] = [
    { label: "Period", align: "left", sortable: true },
    { label: "Inflows", align: "right", sortable: true },
    { label: "Outflows", align: "right", sortable: true },
    { label: "Closing", align: "right", sortable: true }
  ];
  const auditColumns: readonly TableColumn[] = [
    { label: "Time", align: "left", sortable: true },
    { label: "Action", align: "left", sortable: true },
    { label: "Entity", align: "left", sortable: true },
    { label: "Entity id", align: "left", sortable: true },
    { label: "Write guard", align: "left", sortable: true }
  ];
</script>

<style>
  :global(body) {
    overflow: hidden;
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

  .runway-meta {
    display: grid;
    gap: var(--ehq-space-1);
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    font-family: var(--ehq-mono);
  }

  .runway-meta-note {
    color: var(--ehq-warning);
  }

  .dashboard-wide-panel {
    grid-column: 1 / -1;
  }

  .import-result {
    margin: 0;
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-yellow-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-yellow-muted);
    color: var(--ehq-yellow);
    font-size: var(--ehq-type-caption-size);
  }

  .import-rows {
    display: grid;
    gap: var(--ehq-space-2);
  }

  .import-rows-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-2);
  }

  .import-rows-tools {
    display: flex;
    gap: var(--ehq-space-2);
  }

  .import-rows-table {
    border: 1px solid var(--ehq-border-soft);
    border-radius: var(--ehq-radius-sm);
    overflow: hidden;
  }

  .import-row {
    display: grid;
    grid-template-columns: 36px 96px minmax(0, 1fr) 110px 64px minmax(0, 1.2fr) 88px;
    align-items: center;
    gap: var(--ehq-space-2);
    padding: var(--ehq-space-2) var(--ehq-space-3);
    border-top: 1px solid var(--ehq-border-soft);
    font-size: var(--ehq-type-caption-size);
  }

  .import-row:first-child {
    border-top: 0;
  }

  .import-row--header {
    background: var(--ehq-bg-main);
    font-family: var(--ehq-mono);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ehq-text-soft);
  }

  .import-row--rejected {
    background: var(--ehq-yellow-muted);
    color: var(--ehq-yellow);
  }

  .import-row-desc {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .import-row-flag {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
    font-family: var(--ehq-mono);
  }

  .import-row-editor {
    display: grid;
    gap: var(--ehq-space-2);
    padding: var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
  }

  .import-row-editor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--ehq-space-2);
  }

  .import-row-editor-actions {
    display: flex;
    gap: var(--ehq-space-2);
  }

  .period-control {
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--ehq-space-3);
  }

  .office-edit-panel {
    padding: var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
    display: grid;
    gap: var(--ehq-space-3);
    margin-bottom: var(--ehq-space-3);
  }

  .office-edit-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--ehq-space-3);
  }

  .office-edit-grid label {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .office-edit-wide {
    grid-column: span 2;
  }

  .office-edit-actions {
    display: flex;
    gap: var(--ehq-space-2);
    justify-content: flex-end;
  }

  .period-control label,
  .period-control :global(.ehq-select-field) {
    width: min(360px, 100%);
  }

  .period-control p {
    margin: 0;
    color: var(--ehq-text-muted);
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

  .panel-card {
    min-width: 0;
    padding: var(--ehq-space-4);
    border-radius: var(--ehq-radius-sm);
  }

  .statement-import-panel {
    padding: var(--ehq-space-4);
    border-radius: var(--ehq-radius-sm);
    display: grid;
    gap: var(--ehq-space-4);
  }

  .statement-import-panel header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--ehq-space-4);
  }

  .statement-import-panel h2,
  .statement-import-panel p {
    margin: 0;
  }

  .statement-import-panel h2 {
    margin-top: var(--ehq-space-1);
    font-size: var(--ehq-h2);
    line-height: 1.1;
  }

  .statement-import-panel p {
    max-width: 72ch;
    margin-top: var(--ehq-space-2);
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  .statement-import-panel header > strong {
    flex: 0 0 auto;
    padding: var(--ehq-space-1) var(--ehq-space-2);
    border: 1px solid var(--ehq-yellow-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-yellow-muted);
    color: var(--ehq-yellow);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .import-steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--ehq-space-2);
  }

  .import-steps article {
    min-width: 0;
    min-height: 86px;
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border-soft);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-content: center;
    column-gap: var(--ehq-space-2);
    row-gap: var(--ehq-space-1);
  }

  .import-steps article.complete {
    border-color: var(--ehq-yellow-border);
    box-shadow: inset 3px 0 0 var(--ehq-yellow);
  }

  .import-steps b {
    grid-row: span 2;
    width: 28px;
    height: 28px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
    display: grid;
    place-items: center;
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
  }

  .import-steps span {
    font-weight: var(--ehq-type-heading-weight);
  }

  .import-steps small {
    min-width: 0;
    overflow: hidden;
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .import-actions {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) auto auto;
    align-items: end;
    gap: var(--ehq-space-3);
  }

  .file-control {
    min-width: 0;
  }

  .import-advanced {
    width: fit-content;
  }

  .import-advanced summary {
    color: var(--ehq-text-muted);
    cursor: pointer;
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .import-advanced :global(.ehq-select-field) {
    width: min(280px, calc(100vw - var(--ehq-space-8)));
    margin-top: var(--ehq-space-2);
  }

  .filter-strip,
  .filter-grid,
  .form-panel,
  .pending-actions {
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--ehq-space-3);
  }

  /* Select/Input components carry their own label layout; in the flex strips they
     need a minimum width so the controls stay usable. */
  .filter-strip :global(.ehq-select-field),
  .form-panel :global(.ehq-select-field),
  .form-panel :global(.ehq-field),
  .pending-actions :global(.ehq-select-field) {
    min-width: 180px;
    flex: 0 1 auto;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(150px, 1fr));
  }

  .filter-actions {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--ehq-space-2);
  }

  label {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-1);
  }

  label span {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  /* Raw inputs remain only for control types the design-system Input does not
     cover yet (date, file, checkbox); selects and text inputs use the DS components. */
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

  .import-result.error {
    border-color: var(--ehq-error);
    background: var(--ehq-error-bg);
    color: var(--ehq-error);
  }

  .pending-actions span {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
  }

  @media (max-width: 1100px) {
    .kpi-grid,
    .dashboard-grid {
      grid-template-columns: 1fr 1fr;
    }

    .import-actions {
      grid-template-columns: 1fr 1fr;
    }

    .file-control {
      grid-column: 1 / -1;
    }

    .filter-grid {
      grid-template-columns: repeat(2, minmax(150px, 1fr));
    }
  }

  @media (max-width: 760px) {
    .content {
      padding: var(--ehq-space-3);
    }

    .kpi-grid,
    .dashboard-grid,
    .import-actions,
    .import-steps,
    .filter-grid {
      grid-template-columns: 1fr;
    }

    .statement-import-panel header {
      display: grid;
    }

    .statement-import-panel header > strong {
      width: fit-content;
    }
  }
</style>
