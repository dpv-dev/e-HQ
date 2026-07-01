<script lang="ts">
  import { onMount } from "svelte";
  import type { AuthSession } from "@ehq/auth";
  import {
    BarsChart,
    DivergeChart,
    KPI,
    Loader,
    PageHeader,
    SectionTemplate,
    Table,
    WorkspaceShell,
    type ChartPoint,
    type DivergePoint,
    type SelectOption,
    type TablePagination,
    type TableRowAction,
    type Tone,
    type WorkspaceNavGroup,
    type WorkspaceNavItem
  } from "@ehq/ui";
  import {
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
    type OfficeDepartmentPnl,
    type OfficeDivisionPnl,
    type OfficeGlobalPnl,
    type OfficePlanComptableCategoryNode,
    type OfficePlanComptableNode,
    type OfficePnlProjectionRow,
    type OfficePnlLine,
    type OfficeRecentImport,
    type OfficeReconciliationCandidate,
    type OfficeBankAccountSummary,
    type OfficeBankPreviewRowResult,
    type OfficeTransaction,
    type BankImportConfirmResponse,
    type BankImportPreviewRequest,
    type OfficeTransactionWriteRequest,
    type PageResult,
    type CurrencyCode,
    type OfficeCategoryType
  } from "@ehq/api-client";
  import { createShellApiClient } from "../../app-shell-data.js";
  import { extractPdfText } from "../../pdf-extract.js";
  import { parseBankStatement, parseBankCsv, parseCsvRecords, detectBankFormat, detectStatementCurrency, detectCsvCurrency, type ParsedBankRow } from "../../bank-parser.js";
  import { formatDateOnly } from "../../date-format.js";
  import { apiMoneyToMicroUnits, formatMoneyValue, formatSignedMoneyValue, moneyToneForValue } from "../../money-format.js";
  import { createPeriodOptions, getLatestDataPeriod, periodLabel, rangeForScope, rangeLabel, todayIso, type DateRange, type PeriodScope } from "../../period-controls.js";
  import { normalizeRoutePath } from "../../route-utils.js";
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
    | "settings"
    | "wave-invoices";
  type SelectFilterValue = string;
  type ImportSource = "mcb" | "sbi" | "csv" | "cashflow" | "pdf";
  type RequestStatus = "idle" | "loading" | "success" | "error";
  type OfficePagedTableId = "divisionPnl" | "transactions" | "pending" | "reconciliation" | "audit";

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
          id: "coa",
          label: "Chart of accounts",
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
          id: "transactions",
          label: "Transactions",
          title: "Transactions",
          subtitle: "Ledger filtered by every Office dimension."
        },
        {
          id: "imports",
          label: "Imports",
          title: "Imports",
          subtitle: "Relevés bancaires mensuels avec analyse automatique puis import confirmé."
        },
        {
          id: "reconciliation",
          label: "Reconciliation",
          title: "Reconciliation",
          subtitle: "Bank ↔ ledger matching and batch approval."
        },
        {
          id: "pending",
          label: "Pending",
          title: "Pending",
          subtitle: "Classification and batch validation."
        },
        {
          id: "cashflow",
          label: "Cash-flow",
          title: "Cash-flow",
          subtitle: "Inflows, outflows, and closing balances by period."
        },
        {
          id: "bank",
          label: "Bank",
          title: "Bank",
          subtitle: "Bank accounts, raw bank lines, and bank quality."
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
        },
        {
          id: "monitoring",
          label: "Monitoring",
          title: "Monitoring",
          subtitle: "Integrity checks, bank quality, pending rows, imports, and audit trail."
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
          id: "vat",
          label: "VAT",
          title: "VAT report",
          subtitle: "VAT by period, derived from existing typed data."
        },
        {
          id: "settings",
          label: "Settings",
          title: "Settings",
          subtitle: "Read-only Office configuration: reference currency and maintenance."
        },
        {
          id: "wave-invoices",
          label: "Wave invoices — coming",
          title: "Wave invoices",
          subtitle: "Wave invoice integration is not yet available in this console."
        }
      ]
    }
  ];
  const officeNavItems: readonly OfficeNavItem[] = officeNavGroups.flatMap((group: OfficeNavGroup): readonly OfficeNavItem[] => group.items);

  const accountOptions: readonly SelectOption[] = [
    { label: "All accounts", value: allValue },
    { label: "MCB main", value: "mcb-main" },
    { label: "SBI operating", value: "sbi-operating" }
  ];
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
  const reconciliationStatusOptions: readonly SelectOption[] = [
    { label: "All", value: allValue },
    { label: "Unmatched", value: "unmatched" },
    { label: "Suggested", value: "suggested" },
    { label: "Matched", value: "matched" },
    { label: "Rejected", value: "rejected" }
  ];
  const importSourceOptions: readonly SelectOption[] = [
    { label: "MCB EUR PDF", value: "mcb" },
    { label: "MUR bank PDF", value: "sbi" },
    { label: "Bank CSV", value: "csv" },
    { label: "Cashflow XLSX", value: "cashflow" },
    { label: "Receipt / invoice PDF", value: "pdf" }
  ];
  const bankStatementSourceOptions: readonly SelectOption[] = importSourceOptions.filter(
    (option: SelectOption): boolean => option.value === "mcb" || option.value === "sbi"
  );

  let activePageId = $state<OfficePageId>("dashboard");
  const shellNavGroups = $derived<readonly WorkspaceNavGroup[]>(
    officeNavGroups.map((group: OfficeNavGroup): WorkspaceNavGroup => ({
      id: group.id,
      label: group.label,
      items: group.items.map((item: OfficeNavItem): WorkspaceNavItem => ({
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
    selectPage(href as OfficePageId);
  };
  let periodScope = $state<PeriodScope>("month");
  let selectedPeriod = $state(getLatestDataPeriod());
  const today = todayIso();
  let customRange = $state<DateRange | null>(null);
  let dashboardState = $state<ApiRequestState<OfficeDashboardResponse>>(createIdleState<OfficeDashboardResponse>());
  let pnlState = $state<ApiRequestState<OfficeGlobalPnl | OfficeDepartmentPnl>>(createIdleState<OfficeGlobalPnl | OfficeDepartmentPnl>());
  let divisionPnlState = $state<ApiRequestState<PageResult<OfficeDivisionPnl>>>(
    createIdleState<PageResult<OfficeDivisionPnl>>()
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
  let reconciliationStatusFilter = $state<SelectFilterValue>("suggested");
  let selectedPendingIds = $state<readonly string[]>([]);
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
  let cashflowImportRecords = $state<readonly Readonly<Record<string, string>>[]>([]);
  let cashflowImportMessage = $state("Importer un cashflow CSV (Month, Inflow, Outflow, ClosingBalance, Currency).");
  let importState = $state<ImportUiState>({
    status: "idle",
    source: "mcb",
    fileName: "",
    rows: [],
    preview: null,
    confirm: null,
    message: "Choisis un relevé bancaire (PDF ou CSV)."
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
  const transactionRows = $derived(readPageItems(transactionsState));
  const pendingRows = $derived(readPageItems(pendingState));
  const reconciliationRows = $derived(readPageItems(reconciliationState));
  const cashflowRows = $derived(readArrayState(cashflowState));
  const auditRows = $derived(readPageItems(auditState));
  const auditTableRows = $derived(createAuditTableRows(auditRows));
  const pnlResult = $derived(readPnlResult(pnlState));
  const pnlRows = $derived(pnlResult?.projectionRows ?? []);
  const pnlLineRows = $derived(pnlResult?.lines ?? []);
  const divisionPnlRows = $derived(readPageItems(divisionPnlState));
  const departmentOptions = $derived(createPlanOptions(planNodes, "department", "All departments"));
  const divisionOptions = $derived(createPlanOptions(planNodes, "division", "All divisions"));
  const categoryOptions = $derived(createPlanOptions(planNodes, "category", "All categories"));
  const parentOptions = $derived(createParentOptions(planNodes));
  const projectOptions = $derived(createProjectOptions(transactionRows));
  const editCategoryOptions = $derived(
    planNodes
      .filter((node: OfficePlanComptableNode): boolean => node.kind === "category")
      .map((node: OfficePlanComptableNode): SelectOption => ({ label: node.label, value: node.id }))
  );
  const editProjectOptions = $derived(
    createProjectOptions(transactionRows).filter((option: SelectOption): boolean => option.value !== allValue)
  );
  const ledgerRowActions = $derived<readonly TableRowAction[]>([
    { label: "Éditer", onAction: openTransactionEditor },
    { label: "Annuler", onAction: cancelTransactionById, danger: true }
  ]);
  const importRowActions = $derived<readonly TableRowAction[]>([
    { label: "Annuler l'import", onAction: reverseImportBatch, danger: true }
  ]);
  const planRowActions = $derived<readonly TableRowAction[]>([
    { label: "Activer / Désactiver", onAction: togglePlanNodeActive }
  ]);
  const reconciliationRowActions = $derived<readonly TableRowAction[]>([
    { label: "Accepter", onAction: acceptReconciliation },
    { label: "Matcher", onAction: openReconcileMatch },
    { label: "Créer écriture", onAction: openReconcileCreate },
    { label: "Annuler match", onAction: unmatchReconciliationById },
    { label: "Rejeter", onAction: rejectReconciliationById, danger: true }
  ]);
  const reconcileTransactionOptions = $derived(
    transactionRows.map((transaction: OfficeTransaction): SelectOption => ({
      value: transaction.id,
      label: `${transaction.description} · ${formatSignedMicro(transaction.amountMicro)}`
    }))
  );
  const dashboardKpis = $derived(createDashboardKpis(dashboardState));
  const pnlKpis = $derived(createPnlKpis(pnlState));
  const pnlChartPoints = $derived(createPnlChartPoints(pnlRows));
  const pnlTableRows = $derived(createPnlTableRows(pnlRows));
  const pnlLineTableRows = $derived(createPnlLineTableRows(pnlLineRows));
  const divisionPnlTableRows = $derived(createDivisionPnlTableRows(divisionPnlRows));
  const planTableRows = $derived(createPlanTableRows(planNodes));
  const transactionTableRows = $derived(createTransactionTableRows(transactionRows));
  const pendingTableRows = $derived(createPendingTableRows(pendingRows, selectedPendingIds));
  const reconciliationTableRows = $derived(createReconciliationTableRows(reconciliationRows));
  const divisionPnlPagination = $derived<TablePagination | null>(
    createTablePagination(divisionPnlState, tablePaginationLoading === "divisionPnl", tablePaginationError("divisionPnl"), loadMoreDivisionPnl, loadAllDivisionPnl)
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
      loadPnlProjection(),
      loadPlanComptable(),
      loadTransactions(),
      loadPendingTransactions(),
      loadReconciliations(),
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
        client.office.listTransactions({
          workspaceId: officeWorkspaceId,
          period,
          accountId: null,
          departmentId: null,
          divisionId: null,
          categoryId: null,
          projectId: null,
          type: null,
          status: "pending",
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
    dashboardState = createLoadingState<OfficeDashboardResponse>();

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

  async function loadPnlProjection(): Promise<void> {
    pnlState = createLoadingState<OfficeGlobalPnl | OfficeDepartmentPnl>();
    divisionPnlState = createLoadingState<PageResult<OfficeDivisionPnl>>();

    try {
      const departmentId = toNullableFilter(departmentFilter);
      const [pnl, divisions] = await Promise.all([
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
        })
      ]);
      pnlState = createSuccessState<OfficeGlobalPnl | OfficeDepartmentPnl>(pnl);
      divisionPnlState = createSuccessState<PageResult<OfficeDivisionPnl>>(divisions);
      setTablePaginationError("divisionPnl", null);
    } catch (error: unknown) {
      pnlState = createErrorState<OfficeGlobalPnl | OfficeDepartmentPnl>(error);
      divisionPnlState = createErrorState<PageResult<OfficeDivisionPnl>>(error);
    }
  }

  async function loadPlanComptable(): Promise<void> {
    planState = createLoadingState<readonly OfficePlanComptableNode[]>();

    try {
      const nodes = await client.office.getPlanComptable({
        workspaceId: officeWorkspaceId,
        includeInactive: true
      });
      planState = createSuccessState<readonly OfficePlanComptableNode[]>(nodes);
    } catch (error: unknown) {
      planState = createErrorState<readonly OfficePlanComptableNode[]>(error);
    }
  }

  async function loadTransactions(): Promise<void> {
    transactionsState = createLoadingState<PageResult<OfficeTransaction>>();

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
    if (!window.confirm("Annuler cette transaction ? Elle passera en « annulée » (exclue des chiffres, conservée pour l'audit).")) {
      return;
    }

    try {
      const receipt = await client.office.cancelTransaction(
        transactionId,
        { workspaceId: officeWorkspaceId },
        { idempotencyKey: createIdempotencyKey("transaction-cancel") }
      );
      actionReceipt = receipt;
      await loadTransactions();
    } catch (error: unknown) {
      transactionsState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
  }

  // Always interprets the input as a DECIMAL money value → micro units (10^6); never as
  // raw micro (avoids the apiMoneyToMicroUnits integer-passthrough footgun on form input).
  function decimalAmountToMicro(input: string): string {
    const match = /^([+-]?)(\d+)(?:[.,](\d+))?$/u.exec(input.trim().replace(",", "."));
    if (match === null) {
      throw new Error(`Montant invalide : ${input}`);
    }
    const sign = match[1] === "-" ? -1n : 1n;
    const whole = BigInt(match[2] ?? "0");
    const fraction = (match[3] ?? "").padEnd(6, "0").slice(0, 6);
    return (sign * (whole * 1_000_000n + BigInt(fraction))).toString();
  }

  function openTransactionEditor(transactionId: string): void {
    const transaction = transactionRows.find((row: OfficeTransaction): boolean => row.id === transactionId);
    if (transaction === undefined) {
      return;
    }
    editingTransaction = transaction;
    editOccurredOn = transaction.occurredOn.slice(0, 10);
    editDescription = transaction.description;
    editAmount = (Number(transaction.amountMicro) / 1_000_000).toFixed(2);
    editCategoryId = transaction.categoryId ?? "";
    editProjectId = transaction.projectId ?? "";
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
      const receipt = await client.office.updateTransaction(
        transaction.id,
        {
          workspaceId: officeWorkspaceId,
          occurredOn: editOccurredOn,
          accountId: transaction.accountId,
          categoryId: editCategoryId.length > 0 ? editCategoryId : null,
          projectId: editProjectId.length > 0 ? editProjectId : null,
          description: editDescription,
          amountMicro: decimalAmountToMicro(editAmount),
          currency: transaction.currency
        },
        { idempotencyKey: createIdempotencyKey("transaction-update") }
      );
      actionReceipt = receipt;
      editingTransaction = null;
      await loadTransactions();
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
      await loadTransactions();
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
      await loadReconciliations();
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
      await loadReconciliations();
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
      await Promise.all([loadReconciliations(), loadTransactions(), loadPendingTransactions()]);
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
      await loadReconciliations();
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
      await loadReconciliations();
    } catch (error: unknown) {
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  async function reverseImportBatch(batchId: string): Promise<void> {
    if (!window.confirm("Annuler cet import ? Toutes ses lignes seront retirées (action réservée à l'administrateur).")) {
      return;
    }

    try {
      const receipt = await client.office.reverseBankImportBatch(
        batchId,
        { workspaceId: officeWorkspaceId },
        { idempotencyKey: createIdempotencyKey("import-reverse") }
      );
      actionReceipt = receipt;
      await Promise.all([loadDashboard(), loadTransactions()]);
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
      (Number(transaction.amountMicro) / 1_000_000).toFixed(2),
      transaction.currency,
      transaction.status
    ]);
    downloadCsv("transactions.csv", ["Date", "Description", "Category", "Project", "Type", "Amount", "Currency", "Status"], rows);
  }

  async function loadPendingTransactions(): Promise<void> {
    pendingState = createLoadingState<PageResult<OfficeTransaction>>();

    try {
      const page = await client.office.listTransactions({
        workspaceId: officeWorkspaceId,
        period,
        accountId: null,
        departmentId: null,
        divisionId: null,
        categoryId: null,
        projectId: null,
        type: null,
        status: "pending",
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
    reconciliationState = createLoadingState<PageResult<OfficeReconciliationCandidate>>();

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
    } catch (error: unknown) {
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  async function loadCashflow(): Promise<void> {
    cashflowState = createLoadingState<readonly CashflowBucket[]>();

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
        cashflowImportMessage = "Aucune ligne lisible dans ce CSV.";
        return;
      }
      const preview = await client.office.previewCashflowImport(
        { workspaceId: officeWorkspaceId, rows: records },
        { idempotencyKey: createIdempotencyKey("cashflow-preview") }
      );
      cashflowImportRecords = records;
      cashflowImportMessage = `${preview.acceptedRowCount} lignes prêtes · ${preview.rejectedRowCount} rejetées.`;
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
      cashflowImportMessage = "Cashflow importé.";
      await loadCashflow();
    } catch (error: unknown) {
      cashflowImportMessage = getErrorMessage(error);
    }
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

    if (normalizedPath.endsWith("/console/pl")) {
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

    if (normalizedPath.endsWith("/console/wave-invoices")) {
      return "wave-invoices";
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

    if (normalizedPath.endsWith("/console/office/wave-invoices")) {
      return "wave-invoices";
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

    if (normalizedPath.endsWith("/console/office/imports")) {
      return "imports";
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

    if (pageId === "wave-invoices") {
      return "/console/office/wave-invoices";
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

    return "/console/office/pl";
  }

  function receivePartnerReceipt(receipt: ApiMutationReceipt): void {
    actionReceipt = receipt;
  }

  function updateDepartmentFilter(event: Event): void {
    departmentFilter = readSelectValue(event);
  }

  function updateDivisionFilter(event: Event): void {
    divisionFilter = readSelectValue(event);
  }

  function updateCategoryFilter(event: Event): void {
    categoryFilter = readSelectValue(event);
  }

  function updateProjectFilter(event: Event): void {
    projectFilter = readSelectValue(event);
  }

  function updateAccountFilter(event: Event): void {
    accountFilter = readSelectValue(event);
  }

  function updateTypeFilter(event: Event): void {
    typeFilter = readSelectValue(event);
  }

  function updateTransactionStatusFilter(event: Event): void {
    transactionStatusFilter = readSelectValue(event);
  }

  function updateReconciliationStatusFilter(event: Event): void {
    reconciliationStatusFilter = readSelectValue(event);
  }

  function updatePeriodScope(event: Event): void {
    periodScope = readSelectValue(event) as PeriodScope;
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

  function updateImportSource(event: Event): void {
    const source = officeImportSourceFromValue(readSelectValue(event));
    const rows = importState.rows;
    const fileName = importState.fileName;

    importState = {
      ...importState,
      source,
      preview: null,
      confirm: null,
      message: rows.length > 0 ? "Source corrigée. Analyse API relancée." : "Source corrigée."
    };

    if (rows.length > 0 && fileName.length > 0) {
      void previewImportRows(rows, source, fileName);
    }
  }

  function updatePlanKind(event: Event): void {
    planForm = {
      ...planForm,
      kind: readSelectValue(event) as "department" | "division" | "category"
    };
  }

  function updatePlanParent(event: Event): void {
    planForm = {
      ...planForm,
      parentId: readSelectValue(event)
    };
  }

  function updatePlanCode(event: Event): void {
    planForm = {
      ...planForm,
      code: readInputValue(event)
    };
  }

  function updatePlanLabel(event: Event): void {
    planForm = {
      ...planForm,
      label: readInputValue(event)
    };
  }

  function updatePlanType(event: Event): void {
    planForm = {
      ...planForm,
      type: readSelectValue(event) as OfficeCategoryType
    };
  }

  async function applyTransactionFilters(): Promise<void> {
    await loadTransactions();
  }

  async function applyPnlFilters(): Promise<void> {
    await loadPnlProjection();
  }

  async function applyReconciliationFilters(): Promise<void> {
    await loadReconciliations();
  }

  async function applyCashflowFilters(): Promise<void> {
    await loadCashflow();
  }

  async function reloadPeriodScopedData(): Promise<void> {
    await Promise.all([
      loadDashboard(),
      loadPnlProjection(),
      loadTransactions(),
      loadPendingTransactions(),
      loadReconciliations(),
      loadCashflow()
    ]);
  }

  function bankRowToRecord(row: ParsedBankRow, currency: string): Readonly<Record<string, string>> {
    const record: Record<string, string> = {
      transactionDate: row.date,
      description: row.description,
      currency,
      [row.direction]: row.amount.toFixed(2)
    };
    if (row.balance !== null) {
      record.balance = row.balance.toFixed(2);
    }
    if (row.reference !== null) {
      record.reference = row.reference;
    }
    return record;
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
        direction: isCredit ? "Crédit" : "Débit",
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
      message: "Lecture du relevé en cours."
    };

    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
      let parsed: readonly ParsedBankRow[];
      let currency: string;
      let source: ImportSource;
      if (isCsv) {
        const text = await file.text();
        parsed = parseBankCsv(text);
        currency = detectCsvCurrency(text) ?? "MUR";
        source = "csv";
      } else {
        const text = await extractPdfText(file);
        parsed = parseBankStatement(text);
        currency = detectStatementCurrency(text);
        source = detectBankFormat(text) === "mcb" ? "mcb" : "sbi";
      }
      if (importAccounts.length === 0) {
        await loadImportAccounts();
      }
      if (selectedImportAccountId.length === 0) {
        selectedImportAccountId = defaultImportAccountId(importAccounts, currency);
      }
      const rows = parsed.map((row: ParsedBankRow): Readonly<Record<string, string>> => bankRowToRecord(row, currency));
      if (parsed.length === 0) {
        importState = {
          ...importState,
          status: "error",
          source,
          rows: [],
          message: isCsv ? "Aucune transaction lisible dans ce CSV." : "Aucune transaction lisible dans ce PDF."
        };
        return;
      }

      importState = {
        ...importState,
        status: "loading",
        source,
        rows,
        message: `${parsed.length} lignes détectées (${sourceLabel(source)}, ${currency}). Analyse API en cours.`
      };
      await previewImportRows(rows, source, file.name);
    } catch (error: unknown) {
      importState = { ...importState, status: "error", rows: [], message: getErrorMessage(error) };
    }
  }

  async function previewImport(): Promise<void> {
    await previewImportRows(importState.rows, importState.source, importState.fileName);
  }

  function describeRejectionReason(reason: string): string {
    switch (reason) {
      case "account_not_found":
        return "compte de destination introuvable — choisis le bon compte";
      case "occurred_on_missing":
        return "date manquante ou illisible";
      case "description_missing":
        return "libellé manquant";
      case "amount_missing_or_invalid":
        return "montant manquant ou invalide";
      case "amount_mur_missing_for_foreign_currency":
        return "pas de taux de change MUR à cette date";
      default:
        return reason;
    }
  }

  function previewSummaryMessage(preview: BankImportPreviewResponse): string {
    if (preview.rejectedRowCount === 0) {
      return "Aperçu prêt. Vérifie les lignes détectées puis importe en base.";
    }
    const topReason = preview.rejectionReasons[0];
    const reasonText = topReason === undefined
      ? ""
      : ` Raison principale : ${describeRejectionReason(topReason.reason)} (${topReason.count} lignes).`;
    if (preview.acceptedRowCount === 0) {
      return `Aucune ligne acceptée sur ${preview.rejectedRowCount}.${reasonText}`;
    }
    return `Aperçu prêt : ${preview.acceptedRowCount} prêtes, ${preview.rejectedRowCount} rejetées.${reasonText}`;
  }

  async function previewImportRows(
    rows: readonly Readonly<Record<string, string>>[],
    source: ImportSource,
    fileName: string
  ): Promise<void> {
    if (rows.length === 0) {
      importState = { ...importState, status: "error", message: "Choisis d'abord un relevé bancaire (PDF ou CSV)." };
      return;
    }
    if (selectedImportAccountId.length === 0) {
      importState = {
        ...importState,
        status: "error",
        rows,
        message: importAccounts.length === 0
          ? "Aucun compte bancaire dans cet espace. Crée d'abord un compte dans l'onglet Bank, puis relance l'import."
          : "Choisis le compte bancaire de destination avant de lancer l'aperçu."
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
      message: "Analyse API en cours.",
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
        message: "Analyse le relevé avant de l'importer."
      };
      return;
    }
    const acceptedRowIds = selectedImportRowIds;
    if (acceptedRowIds.length === 0) {
      importState = {
        ...importState,
        status: "error",
        message: "Coche au moins une ligne acceptée à importer."
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
      message: "Import en base en cours."
    };

    try {
      const confirm = await client.office.confirmBankImport(
        {
          workspaceId: officeWorkspaceId,
          previewId: preview.previewId,
          acceptedRowIds,
          rejectedRowIds
        },
        {
          idempotencyKey: createIdempotencyKey("import-confirm")
        }
      );
      importState = {
        ...importState,
        status: "success",
        confirm,
        message: "Relevé importé en base."
      };
      await Promise.all([
        loadDashboard(),
        loadTransactions(),
        loadPendingTransactions(),
        loadReconciliations()
      ]);
    } catch (error: unknown) {
      importState = {
        ...importState,
        status: "error",
        message: getErrorMessage(error)
      };
    }
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
      const nextNode = createPlanNodeFromForm(`${receipt.id}_${planForm.code}`, parentId, planForm, planNodes);
      planState = createSuccessState<readonly OfficePlanComptableNode[]>([...planNodes, nextNode]);
      actionReceipt = receipt;
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
      planState = createSuccessState<readonly OfficePlanComptableNode[]>(
        planNodes.map((node: OfficePlanComptableNode): OfficePlanComptableNode =>
          node.id === category.id ? { ...node, active: false } : node
        )
      );
      actionReceipt = receipt;
    } catch (error: unknown) {
      planState = createErrorState<readonly OfficePlanComptableNode[]>(error);
    }
  }

  async function createTransactionDraft(): Promise<void> {
    const request: OfficeTransactionWriteRequest = {
      workspaceId: officeWorkspaceId,
      occurredOn: `${period}-14`,
      accountId: "mcb-main",
      categoryId: "cat_print",
      projectId: "project_album_posters",
      description: "Draft Office preview",
      amountMicro: "-1200000000",
      currency: "MUR"
    };

    try {
      const receipt = await client.office.createTransaction(request, {
        idempotencyKey: createIdempotencyKey("transaction-create")
      });
      actionReceipt = receipt;
      await loadTransactions();
    } catch (error: unknown) {
      transactionsState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
  }

  async function approveSuggestedReconciliations(): Promise<void> {
    const reconciliationIds = reconciliationRows
      .filter((candidate: OfficeReconciliationCandidate): boolean => candidate.status === "suggested")
      .map((candidate: OfficeReconciliationCandidate): string => candidate.id);

    if (reconciliationIds.length === 0) {
      return;
    }

    try {
      const receipt = await client.office.approveReconciliations(
        {
          workspaceId: officeWorkspaceId,
          reconciliationIds,
          approvedAt: new Date().toISOString()
        },
        {
          idempotencyKey: createIdempotencyKey("reconciliation-approve")
        }
      );
      reconciliationState = createSuccessState<PageResult<OfficeReconciliationCandidate>>({
        items: reconciliationRows.map((candidate: OfficeReconciliationCandidate): OfficeReconciliationCandidate =>
          reconciliationIds.includes(candidate.id) ? { ...candidate, status: "matched" } : candidate
        ),
        nextCursor: null
      });
      actionReceipt = receipt;
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
              accountId: transaction.accountId,
              categoryId: pendingClassifyCategoryId,
              projectId: pendingClassifyProjectId.length > 0 ? pendingClassifyProjectId : transaction.projectId,
              description: transaction.description,
              amountMicro: transaction.amountMicro,
              currency: transaction.currency
            },
            { idempotencyKey: createIdempotencyKey(`pending-classify-${transaction.id}`) }
          )
        )
      );
      actionReceipt = writeResults[writeResults.length - 1] ?? null;
      await loadPendingTransactions();
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
      await loadPendingTransactions();
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

  function createDashboardKpis(state: ApiRequestState<OfficeDashboardResponse>): readonly OfficeKpi[] {
    if (state.status !== "success") {
      return [
        { label: "Cash", value: "—", detail: stateLabel(state), tone: "muted", accent: true },
        { label: "Receivables", value: "—", detail: "projection", tone: "muted", accent: false },
        { label: "Payables", value: "—", detail: "projection", tone: "muted", accent: false },
        { label: "To reconcile", value: "—", detail: "bank", tone: "muted", accent: false }
      ];
    }

    return [
      {
        label: "Cash",
        value: formatMicro(state.data.cashBalanceMicro),
        detail: state.data.period,
        tone: "success",
        accent: true
      },
      {
        label: "Receivables",
        value: formatMicro(state.data.receivablesMicro),
        detail: "validated projection",
        tone: "info",
        accent: false
      },
      {
        label: "Payables",
        value: formatMicro(state.data.payablesMicro),
        detail: "validated projection",
        tone: "warning",
        accent: false
      },
      {
        label: "To reconcile",
        value: String(state.data.unreconciledTransactionCount),
        detail: "bank rows",
        tone: "warning",
        accent: false
      }
    ];
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
        value: formatSignedMicro(state.data.netMicro),
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
        { kind: "money", value: formatSignedMicro(row.netMicro), tone: row.netTone === "positive" ? "success" : "error" },
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
        { kind: "money", value: formatSignedMicro(row.netMicro), tone: moneyTone(row.netMicro) }
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
        { kind: "money", value: formatSignedMicro(row.netMicro), tone: moneyTone(row.netMicro) }
      ]
    }));
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

  function createPlanNodeFromForm(
    id: string,
    parentId: string | null,
    form: PlanFormState,
    nodes: readonly OfficePlanComptableNode[]
  ): OfficePlanComptableNode {
    if (form.kind === "department") {
      return {
        id,
        parentId: null,
        kind: "department",
        code: form.code,
        label: form.label,
        active: form.active
      };
    }

    if (form.kind === "division") {
      const department = findDepartmentNode(parentId, nodes);

      return {
        id,
        parentId: department.id,
        kind: "division",
        code: form.code,
        label: form.label,
        active: form.active,
        departmentId: department.id,
        departmentLabel: department.label
      };
    }

    const division = findDivisionNode(parentId, nodes);

    return {
      id,
      parentId: division.id,
      kind: "category",
      code: form.code,
      label: form.label,
      active: form.active,
      departmentId: division.departmentId,
      departmentLabel: division.departmentLabel,
      divisionId: division.id,
      divisionLabel: division.label,
      type: form.type
    };
  }

  function findDepartmentNode(
    nodeId: string | null,
    nodes: readonly OfficePlanComptableNode[]
  ): Extract<OfficePlanComptableNode, { readonly kind: "department" }> {
    const node = nodes.find((item: OfficePlanComptableNode): boolean => item.id === nodeId);

    if (node === undefined || node.kind !== "department") {
      throw new Error("Division parent must be a department.");
    }

    return node;
  }

  function findDivisionNode(
    nodeId: string | null,
    nodes: readonly OfficePlanComptableNode[]
  ): Extract<OfficePlanComptableNode, { readonly kind: "division" }> {
    const node = nodes.find((item: OfficePlanComptableNode): boolean => item.id === nodeId);

    if (node === undefined || node.kind !== "division") {
      throw new Error("Category parent must be a division.");
    }

    return node;
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

  function createTransactionTableRows(rows: readonly OfficeTransaction[]): readonly TableRow[] {
    return rows.map((transaction: OfficeTransaction): TableRow => ({
      id: transaction.id,
      cells: [
        { kind: "text", value: formatDateOnly(transaction.occurredOn), strong: false },
        { kind: "text", value: transaction.description, strong: true },
        { kind: "text", value: transactionPathLabel(transaction), strong: false },
        { kind: "badge", value: transaction.type ?? "unvalidated", tone: transaction.type === "income" ? "success" : transaction.type === "expense" ? "warning" : "muted" },
        { kind: "text", value: transaction.projectLabel ?? "—", strong: false },
        { kind: "money", value: formatSignedMicro(transaction.amountMicro), tone: moneyTone(transaction.amountMicro) },
        { kind: "badge", value: transaction.status, tone: transactionStatusTone(transaction.status) }
      ]
    }));
  }

  function createPendingTableRows(rows: readonly OfficeTransaction[], selectedIds: readonly string[]): readonly TableRow[] {
    return rows.map((transaction: OfficeTransaction): TableRow => ({
      id: transaction.id,
      cells: [
        { kind: "badge", value: selectedIds.includes(transaction.id) ? "selected" : "to validate", tone: selectedIds.includes(transaction.id) ? "active" : "warning" },
        { kind: "text", value: transaction.description, strong: true },
        { kind: "text", value: transactionPathLabel(transaction), strong: false },
        { kind: "money", value: formatSignedMicro(transaction.amountMicro), tone: moneyTone(transaction.amountMicro) },
        { kind: "badge", value: transaction.status, tone: "warning" }
      ]
    }));
  }

  function createReconciliationTableRows(rows: readonly OfficeReconciliationCandidate[]): readonly TableRow[] {
    return rows.map((candidate: OfficeReconciliationCandidate): TableRow => ({
      id: candidate.id,
      cells: [
        { kind: "text", value: candidate.bankDescription, strong: true },
        { kind: "text", value: formatDateOnly(candidate.occurredOn), strong: false },
        { kind: "money", value: formatSignedMicro(candidate.amountMicro), tone: moneyTone(candidate.amountMicro) },
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
    return [
      { label: allLabel, value: allValue },
      ...nodes
        .filter((node: OfficePlanComptableNode): boolean => node.kind === kind)
        .map((node: OfficePlanComptableNode): SelectOption => ({ label: node.label, value: node.id }))
    ];
  }

  function createParentOptions(nodes: readonly OfficePlanComptableNode[]): readonly SelectOption[] {
    return [
      { label: "Root", value: allValue },
      ...nodes
        .filter((node: OfficePlanComptableNode): boolean => node.kind !== "category")
        .map((node: OfficePlanComptableNode): SelectOption => ({ label: planReferenceLabel(node), value: node.id }))
    ];
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

    return [{ label: "All projects", value: allValue }, ...uniqueProjects];
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

  function toNullableReconciliationStatus(value: SelectFilterValue): "unmatched" | "suggested" | "matched" | null {
    if (value === "unmatched" || value === "suggested" || value === "matched") {
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

  function formatSignedMicro(amountMicro: string): string {
    return formatSignedMoneyValue(amountMicro, "MUR");
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
  homeHref="/console/office/dashboard"
  navLabel="Office navigation"
  navItems={[]}
  navGroups={shellNavGroups}
  statusLabel="eof/v1"
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
          <label>
            <span class="ehq-type-label-mono">Period</span>
            <select value={periodScope} onchange={updatePeriodScope}>
              {#each periodOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
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

      {#if actionReceipt !== null}
        <p class="receipt ehq-type-label-mono" role="status">Action accepted · audit recorded</p>
      {/if}

      {#if activePageId === "dashboard"}
        <section class="kpi-grid" aria-label="Office indicators">
          {#each dashboardKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={dashboardState.status === "loading" ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>

        <section class="dashboard-grid">
          <div class="panel-card ehq-edge-surface">
            <SectionTemplate eyebrow="reconciliation" title="Recent reconciliation" detail="Bank and ledger candidates for the selected period." state="ready">
              <Table title="Reconciliation" columns={reconciliationColumns} rows={reconciliationTableRows} state={reconciliationState.status === "loading" ? "loading" : reconciliationState.status === "error" ? "error" : "default"} actionLabel="" pagination={reconciliationPagination} />
            </SectionTemplate>
          </div>

          <div class="panel-card ehq-edge-surface">
            <SectionTemplate eyebrow="cash-flow" title="Cash flow" detail="Inflows, outflows, and closing balances." state="ready">
              <BarsChart title="Inflows" points={cashflowInflowPoints} tone="success" />
              <Table title="Cash-flow by month" columns={cashflowColumns} rows={cashflowTableRows} state={cashflowState.status === "loading" ? "loading" : cashflowState.status === "error" ? "error" : "default"} actionLabel="" />
            </SectionTemplate>
          </div>
        </section>
      {:else if activePageId === "pnl"}
        <section class="kpi-grid" aria-label="P&L indicators">
          {#each pnlKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={pnlState.status === "loading" ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>

        <section class="filter-strip ehq-edge-surface" aria-label="P&L filters">
          <label>
            <span class="ehq-type-label-mono">Department</span>
            <select value={departmentFilter} onchange={updateDepartmentFilter}>
              {#each departmentOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button class="office-action ehq-type-heading primary" type="button" onclick={applyPnlFilters}>Apply</button>
        </section>

        {#if pnlState.status === "loading"}
          <Loader label="Loading P&L" detail="Reading validated projections." size="medium" />
        {:else}
          <section class="dashboard-grid">
            <DivergeChart title="Revenue and expenses by department" points={pnlChartPoints} />
            <Table title="Result by department" columns={pnlColumns} rows={pnlTableRows} state={pnlState.status === "error" ? "error" : pnlTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
          </section>
          <Table title="Result by division" columns={divisionPnlColumns} rows={divisionPnlTableRows} state={divisionPnlState.status === "loading" ? "loading" : divisionPnlState.status === "error" ? "error" : divisionPnlTableRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={divisionPnlPagination} />
          <Table title="Result by category" columns={pnlLineColumns} rows={pnlLineTableRows} state={pnlLineTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
        {/if}
      {:else if activePageId === "coa"}
        <section class="form-panel ehq-edge-surface" aria-label="Chart of accounts editor">
          <label>
            <span class="ehq-type-label-mono">Type</span>
            <select value={planForm.kind} onchange={updatePlanKind}>
              <option value="department">Department</option>
              <option value="division">Division</option>
              <option value="category">Category</option>
            </select>
          </label>
          <label>
            <span class="ehq-type-label-mono">Parent</span>
            <select value={planForm.parentId} onchange={updatePlanParent}>
              {#each parentOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="ehq-type-label-mono">Code</span>
            <input value={planForm.code} oninput={updatePlanCode} />
          </label>
          <label>
            <span class="ehq-type-label-mono">Label</span>
            <input value={planForm.label} oninput={updatePlanLabel} />
          </label>
          {#if planForm.kind === "category"}
            <label>
              <span class="ehq-type-label-mono">Category type</span>
              <select value={planForm.type} onchange={updatePlanType}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </label>
          {/if}
          <button class="office-action ehq-type-heading primary" type="button" disabled={!writesEnabled} title={writeDisabledTitle()} onclick={createPlanNode}>Create</button>
          <button class="office-action ehq-type-heading" type="button" disabled={!writesEnabled} title={writeDisabledTitle()} onclick={deactivateFirstCategory}>Deactivate a category</button>
        </section>

        <Table title="Department → Division → Category" columns={planColumns} rows={planTableRows} state={planState.status === "loading" ? "loading" : planState.status === "error" ? "error" : "default"} actionLabel="" rowActions={planRowActions} />
      {:else if activePageId === "transactions"}
        <section class="filter-grid ehq-edge-surface" aria-label="Transaction filters">
          <label>
            <span class="ehq-type-label-mono">Account</span>
            <select value={accountFilter} onchange={updateAccountFilter}>
              {#each accountOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="ehq-type-label-mono">Department</span>
            <select value={departmentFilter} onchange={updateDepartmentFilter}>
              {#each departmentOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="ehq-type-label-mono">Division</span>
            <select value={divisionFilter} onchange={updateDivisionFilter}>
              {#each divisionOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="ehq-type-label-mono">Category</span>
            <select value={categoryFilter} onchange={updateCategoryFilter}>
              {#each categoryOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="ehq-type-label-mono">Project</span>
            <select value={projectFilter} onchange={updateProjectFilter}>
              {#each projectOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="ehq-type-label-mono">Type</span>
            <select value={typeFilter} onchange={updateTypeFilter}>
              {#each typeOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="ehq-type-label-mono">Status</span>
            <select value={transactionStatusFilter} onchange={updateTransactionStatusFilter}>
              {#each statusOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button class="office-action ehq-type-heading primary" type="button" onclick={applyTransactionFilters}>Filter</button>
          <button class="office-action ehq-type-heading" type="button" disabled={!writesEnabled} title={writeDisabledTitle()} onclick={createTransactionDraft}>New entry</button>
          <button class="office-action ehq-type-heading" type="button" disabled={transactionRows.length === 0} onclick={exportTransactionsCsv}>Export CSV</button>
        </section>

        {#if editingTransaction !== null}
          <section class="office-edit-panel ehq-edge-surface" aria-label="Éditer la transaction">
            <div class="office-edit-grid">
              <label>
                <span class="ehq-type-label-mono">Date</span>
                <input type="date" bind:value={editOccurredOn} />
              </label>
              <label class="office-edit-wide">
                <span class="ehq-type-label-mono">Description</span>
                <input type="text" bind:value={editDescription} />
              </label>
              <label>
                <span class="ehq-type-label-mono">Montant</span>
                <input type="text" inputmode="decimal" bind:value={editAmount} />
              </label>
              <label>
                <span class="ehq-type-label-mono">Catégorie</span>
                <select bind:value={editCategoryId}>
                  <option value="">— Aucune —</option>
                  {#each editCategoryOptions as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
              <label>
                <span class="ehq-type-label-mono">Projet</span>
                <select bind:value={editProjectId}>
                  <option value="">— Aucun —</option>
                  {#each editProjectOptions as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
            </div>
            <div class="office-edit-actions">
              <button class="office-action ehq-type-heading primary" type="button" disabled={!writesEnabled} title={writeDisabledTitle()} onclick={saveTransactionEdit}>Enregistrer</button>
              <button class="office-action ehq-type-heading" type="button" disabled={!writesEnabled} title={writeDisabledTitle()} onclick={validateEditingTransaction}>Valider</button>
              <button class="office-action ehq-type-heading" type="button" onclick={closeTransactionEditor}>Fermer</button>
            </div>
          </section>
        {/if}

        <Table title="Ledger · May 2026" columns={transactionColumns} rows={transactionTableRows} state={transactionsState.status === "loading" ? "loading" : transactionsState.status === "error" ? "error" : transactionRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={ledgerRowActions} pagination={transactionPagination} />
      {:else if activePageId === "clients"}
        <PartnersView
          facet="client"
          client={client.office}
          workspaceId={officeWorkspaceId}
          {period}
          dateFrom={activeRange.from}
          dateTo={activeRange.to}
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
          onReceipt={receivePartnerReceipt}
        />
      {:else if activePageId === "projects"}
        <ProjectsView client={client.office} workspaceId={officeWorkspaceId} {period} dateFrom={activeRange.from} dateTo={activeRange.to} writesEnabled={writesEnabled} />
      {:else if activePageId === "monitoring"}
        <MonitoringView client={client.office} workspaceId={officeWorkspaceId} {period} />
      {:else if activePageId === "imports"}
        <section class="statement-import-panel ehq-edge-surface" aria-label="Importer un relevé bancaire">
          <header>
            <div>
              <span class="ehq-type-label-mono">Import bancaire mensuel</span>
              <h2>Importer un statement</h2>
              <p>Dépose un PDF MCB ou SBI/SBM. L'app détecte la banque, lit les lignes, lance l'aperçu API, puis tu confirmes l'import.</p>
            </div>
            <strong>{writesEnabled ? "Écritures activées" : "Écritures verrouillées"}</strong>
          </header>

          <div class="import-steps" aria-label="Progression import">
            <article class:complete={importState.fileName.length > 0}>
              <b>1</b>
              <span>Fichier</span>
              <small>{importState.fileName.length > 0 ? importState.fileName : "Aucun fichier"}</small>
            </article>
            <article class:complete={importState.preview !== null}>
              <b>2</b>
              <span>Analyse</span>
              <small>{importState.preview === null ? "En attente" : `${importState.preview.acceptedRowCount} lignes prêtes`}</small>
            </article>
            <article class:complete={importState.confirm !== null}>
              <b>3</b>
              <span>Import</span>
              <small>{importState.confirm === null ? "Non confirmé" : `${importState.confirm.importedTransactionCount} transactions`}</small>
            </article>
          </div>

          <div class="import-actions">
            <label class="file-control">
              <span class="ehq-type-label-mono">Compte de destination</span>
              <select bind:value={selectedImportAccountId} disabled={importAccounts.length === 0}>
                {#if importAccounts.length === 0}
                  <option value="">Aucun compte — crée-en un dans l'onglet Bank</option>
                {:else}
                  <option value="">Choisis un compte…</option>
                  {#each importAccounts as account (account.id)}
                    <option value={account.id}>{account.bankName} · {account.accountLabel} ({account.currency}){account.isActive ? "" : " — inactif"}</option>
                  {/each}
                {/if}
              </select>
            </label>
            <label class="file-control">
              <span class="ehq-type-label-mono">Relevé PDF ou CSV</span>
              <input type="file" accept="application/pdf,.pdf,text/csv,.csv" onchange={handleStatementFile} />
            </label>
            <button class="office-action ehq-type-heading" type="button" disabled={!canPreviewImport} onclick={previewImport}>
              Analyser
            </button>
            <button class="office-action ehq-type-heading primary" type="button" disabled={!canConfirmImport || !writesEnabled} title={writeDisabledTitle()} onclick={confirmImport}>
              Importer en base
            </button>
          </div>

          <details class="import-advanced">
            <summary>Correction source</summary>
            <label>
              <span class="ehq-type-label-mono">Banque détectée</span>
              <select value={importState.source} onchange={updateImportSource}>
                {#each bankStatementSourceOptions as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
          </details>

          <section class="import-result ehq-type-label-mono" class:error={importState.status === "error"} aria-live="polite">
            <strong>{importState.message}</strong>
            {#if importState.preview !== null}
              <span>{sourceLabel(importState.preview.source)} · {importState.preview.periodLabel} · {importState.preview.currencyCodes.join(" / ")}</span>
              <span>{importState.preview.acceptedRowCount} lignes prêtes · {importState.preview.rejectedRowCount} rejetées · {importState.preview.duplicateRowCount} doublons</span>
              <span>{importState.preview.accountReference ?? "Compte détecté à la confirmation"}</span>
              {#if importState.preview.openingBalanceMicro !== null && importState.preview.closingBalanceMicro !== null}
                <span>Ouverture {formatMoney(importState.preview.openingBalanceMicro, importState.preview.currencyCodes[0] ?? "MUR")} · clôture {formatMoney(importState.preview.closingBalanceMicro, importState.preview.currencyCodes[0] ?? "MUR")}</span>
              {/if}
              {#each importState.preview.warnings as warning (warning)}
                <span>{warning}</span>
              {/each}
            {/if}
            {#if !writesEnabled}
              <span>Pour importer en base, l'API doit avoir WRITES_ENABLED=true puis être redémarrée.</span>
            {/if}
          </section>

          {#if importState.preview !== null && importPreviewTableRows.length > 0}
            <section class="import-rows" aria-label="Lignes détectées">
              <header class="import-rows-head">
                <span class="ehq-type-label-mono">Lignes détectées · {importPreviewTableRows.length} · {selectedImportRowIds.length} cochées</span>
                <div class="import-rows-tools">
                  <button type="button" class="office-action ehq-type-heading" onclick={() => setAllImportRows(true)}>Tout cocher</button>
                  <button type="button" class="office-action ehq-type-heading" onclick={() => setAllImportRows(false)}>Tout décocher</button>
                </div>
              </header>
              <div class="import-rows-table" role="table">
                <div class="import-row import-row--header" role="row">
                  <span role="columnheader" aria-label="Importer"></span>
                  <span role="columnheader">Date</span>
                  <span role="columnheader">Description</span>
                  <span role="columnheader">Montant</span>
                  <span role="columnheader">Sens</span>
                  <span role="columnheader">Statut</span>
                  <span role="columnheader" aria-label="Action"></span>
                </div>
                {#each importPreviewTableRows.slice(0, 200) as row (row.id)}
                  <div class="import-row" class:import-row--rejected={row.status === "rejected"} role="row">
                    <span role="cell">
                      {#if row.status === "accepted"}
                        <input type="checkbox" checked={importRowSelection[row.id] === true} onchange={() => toggleImportRow(row.id)} aria-label={`Importer la ligne ${String(row.rowNumber)}`} />
                      {:else}
                        <span class="import-row-flag" aria-hidden="true">!</span>
                      {/if}
                    </span>
                    <span role="cell">{row.date}</span>
                    <span role="cell" class="import-row-desc">{row.description}</span>
                    <span role="cell">{row.amount} {row.currency}</span>
                    <span role="cell">{row.direction}</span>
                    <span role="cell">{row.status === "accepted" ? "Accepté" : `Rejeté — ${row.reason}`}</span>
                    <span role="cell">
                      {#if row.status === "rejected"}
                        <button type="button" class="office-action" onclick={() => startImportRowEdit(row.rowNumber)}>Corriger</button>
                      {/if}
                    </span>
                  </div>
                {/each}
              </div>
              {#if importPreviewTableRows.length > 200}
                <small>{importPreviewTableRows.length - 200} lignes supplémentaires non affichées — toutes les lignes acceptées cochées seront importées.</small>
              {/if}

              {#if editingImportRowNumber !== null}
                <div class="import-row-editor ehq-edge-surface" aria-label="Corriger une ligne">
                  <span class="ehq-type-label-mono">Corriger la ligne {editingImportRowNumber} puis ré-analyser</span>
                  <div class="import-row-editor-grid">
                    <label><span class="ehq-type-label-mono">Date (AAAA-MM-JJ)</span><input type="text" bind:value={importEditDate} placeholder="2026-05-27" /></label>
                    <label><span class="ehq-type-label-mono">Description</span><input type="text" bind:value={importEditDescription} /></label>
                    <label><span class="ehq-type-label-mono">Sens</span>
                      <select bind:value={importEditDirection}>
                        <option value="debit">Débit</option>
                        <option value="credit">Crédit</option>
                      </select>
                    </label>
                    <label><span class="ehq-type-label-mono">Montant</span><input type="text" bind:value={importEditAmount} placeholder="40.00" /></label>
                  </div>
                  <div class="import-row-editor-actions">
                    <button type="button" class="office-action ehq-type-heading primary" onclick={applyImportRowEdit}>Appliquer + ré-analyser</button>
                    <button type="button" class="office-action ehq-type-heading" onclick={cancelImportRowEdit}>Annuler</button>
                  </div>
                </div>
              {/if}
            </section>
          {/if}
        </section>

        <Table title="Batches bancaires connus par l'API" columns={importColumns} rows={recentImportRows} state={dashboardState.status === "loading" ? "loading" : dashboardState.status === "error" ? "error" : recentImportRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={importRowActions} />
      {:else if activePageId === "reconciliation"}
        <section class="filter-strip ehq-edge-surface" aria-label="Reconciliation filters">
          <label>
            <span class="ehq-type-label-mono">Account</span>
            <select value={accountFilter} onchange={updateAccountFilter}>
              {#each accountOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="ehq-type-label-mono">Status</span>
            <select value={reconciliationStatusFilter} onchange={updateReconciliationStatusFilter}>
              {#each reconciliationStatusOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button class="office-action ehq-type-heading" type="button" onclick={applyReconciliationFilters}>Filter</button>
          <button class="office-action ehq-type-heading primary" type="button" disabled={!writesEnabled} title={writeDisabledTitle()} onclick={approveSuggestedReconciliations}>Approve batch</button>
        </section>

        <Table title="Bank ↔ ledger matching" columns={reconciliationColumns} rows={reconciliationTableRows} state={reconciliationState.status === "loading" ? "loading" : reconciliationState.status === "error" ? "error" : reconciliationRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={reconciliationRowActions} pagination={reconciliationPagination} />

        {#if reconcileDrawerLineId !== null}
          <section class="reconcile-drawer ehq-edge-surface" aria-label="Action de rapprochement">
            {#if reconcileDrawerMode === "match"}
              <span class="ehq-type-label-mono">Matcher « {reconcileDrawerBankLabel} » à une écriture existante</span>
              <label class="reconcile-drawer-field">
                <span class="ehq-type-label-mono">Écriture du grand livre</span>
                <select bind:value={reconcileMatchTransactionId}>
                  <option value="">Choisir une écriture…</option>
                  {#each reconcileTransactionOptions as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
              <div class="reconcile-drawer-actions">
                <button class="office-action ehq-type-heading primary" type="button" disabled={!writesEnabled || reconcileMatchTransactionId.length === 0} title={writeDisabledTitle()} onclick={submitReconcileMatch}>Matcher</button>
                <button class="office-action ehq-type-heading" type="button" onclick={closeReconcileDrawer}>Annuler</button>
              </div>
            {:else}
              <span class="ehq-type-label-mono">Créer une écriture depuis « {reconcileDrawerBankLabel} »</span>
              <div class="reconcile-drawer-grid">
                <label class="reconcile-drawer-field">
                  <span class="ehq-type-label-mono">Catégorie (option.)</span>
                  <select bind:value={reconcileCreateCategoryId}>
                    <option value="">Brouillon — à classer</option>
                    {#each editCategoryOptions as option (option.value)}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                </label>
                <label class="reconcile-drawer-field">
                  <span class="ehq-type-label-mono">Projet (option.)</span>
                  <select bind:value={reconcileCreateProjectId}>
                    <option value="">Aucun</option>
                    {#each editProjectOptions as option (option.value)}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                </label>
              </div>
              <div class="reconcile-drawer-actions">
                <button class="office-action ehq-type-heading primary" type="button" disabled={!writesEnabled} title={writeDisabledTitle()} onclick={submitReconcileCreate}>Créer &amp; matcher</button>
                <button class="office-action ehq-type-heading" type="button" onclick={closeReconcileDrawer}>Annuler</button>
              </div>
            {/if}
          </section>
        {/if}
      {:else if activePageId === "pending"}
        <section class="pending-actions ehq-edge-surface" aria-label="Actions pending">
          <label class="pending-field">
            <span class="ehq-type-label-mono">Catégorie</span>
            <select bind:value={pendingClassifyCategoryId}>
              <option value="">Choisir…</option>
              {#each editCategoryOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label class="pending-field">
            <span class="ehq-type-label-mono">Projet (option.)</span>
            <select bind:value={pendingClassifyProjectId}>
              <option value="">Inchangé</option>
              {#each editProjectOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button class="office-action ehq-type-heading" type="button" disabled={!writesEnabled || selectedPendingIds.length === 0 || pendingClassifyCategoryId.length === 0} title={writeDisabledTitle()} onclick={classifySelectedPending}>Classer la sélection</button>
          <button class="office-action ehq-type-heading primary" type="button" disabled={!writesEnabled || selectedPendingIds.length === 0} title={writeDisabledTitle()} onclick={bulkValidatePending}>Valider la sélection</button>
          <span class="ehq-type-label-mono">{selectedPendingIds.length} sélectionnées</span>
        </section>

        <div class="pending-list">
          {#each pendingRows as transaction (transaction.id)}
            <button
              class="ehq-edge-surface"
              class:selected={selectedPendingIds.includes(transaction.id)}
              type="button"
              onclick={() => togglePendingSelection(transaction.id)}
            >
              <strong class="ehq-type-body">{transaction.description}</strong>
              <span class="ehq-type-body">{transaction.departmentLabel ?? "to classify"} · {transaction.categoryLabel ?? "to classify"} · {formatSignedMicro(transaction.amountMicro)}</span>
            </button>
          {/each}
        </div>

        <Table title="Queue pending" columns={pendingColumns} rows={pendingTableRows} state={pendingState.status === "loading" ? "loading" : pendingState.status === "error" ? "error" : pendingRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={pendingPagination} />
      {:else if activePageId === "cashflow"}
        <section class="filter-strip ehq-edge-surface" aria-label="Cash-flow filters">
          <label>
            <span class="ehq-type-label-mono">Account</span>
            <select value={accountFilter} onchange={updateAccountFilter}>
              {#each accountOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <button class="office-action ehq-type-heading primary" type="button" onclick={applyCashflowFilters}>Refresh</button>
        </section>

        <section class="office-edit-panel ehq-edge-surface" aria-label="Importer un cashflow">
          <div class="office-edit-grid">
            <label class="office-edit-wide">
              <span class="ehq-type-label-mono">Importer un CSV cashflow (Month, Inflow, Outflow, ClosingBalance, Currency)</span>
              <input type="file" accept="text/csv,.csv" onchange={handleCashflowFile} />
            </label>
          </div>
          <div class="office-edit-actions">
            <span class="ehq-type-label-mono">{cashflowImportMessage}</span>
            <button class="office-action ehq-type-heading primary" type="button" disabled={!writesEnabled || cashflowImportRecords.length === 0} title={writeDisabledTitle()} onclick={confirmCashflowFileImport}>Importer en base</button>
          </div>
        </section>

        <section class="dashboard-grid">
          <BarsChart title="Inflows" points={cashflowInflowPoints} tone="success" />
          <BarsChart title="Outflows" points={cashflowOutflowPoints} tone="error" />
        </section>

        <Table title="Cash-flow by month" columns={cashflowColumns} rows={cashflowTableRows} state={cashflowState.status === "loading" ? "loading" : cashflowState.status === "error" ? "error" : "default"} actionLabel="" />
      {:else if activePageId === "ceo"}
        <CeoView client={client.office} workspaceId={officeWorkspaceId} {period} />
      {:else if activePageId === "bank"}
        <BankView client={client.office} workspaceId={officeWorkspaceId} {period} writesEnabled={writesEnabled} />
      {:else if activePageId === "audit"}
        <Table title="Audit log" columns={auditColumns} rows={auditTableRows} state={auditState.status === "loading" ? "loading" : auditState.status === "error" ? "error" : auditTableRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={auditPagination} />
      {:else if activePageId === "vat"}
        <VatView client={client.office} workspaceId={officeWorkspaceId} {period} />
      {:else if activePageId === "settings"}
        <SettingsView client={client.office} workspaceId={officeWorkspaceId} {period} />
      {:else if activePageId === "wave-invoices"}
        <section class="coming-panel ehq-edge-surface" aria-label="Wave invoices">
          <strong class="ehq-type-heading">Wave invoices — coming</strong>
          <span class="ehq-type-body">Wave invoice integration is not yet available in this console. There is no Wave data or actions here yet.</span>
        </section>
      {/if}
    </div>
</WorkspaceShell>

<script module lang="ts">
  import type { TableColumn, TableRow } from "@ehq/ui";

  const pnlColumns: readonly TableColumn[] = [
    { label: "Department", align: "left", sortable: true },
    { label: "Revenue", align: "right", sortable: true },
    { label: "Expenses", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true },
    { label: "Validated", align: "left", sortable: false }
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
    { label: "Path", align: "left", sortable: false },
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
  const reconciliationColumns: readonly TableColumn[] = [
    { label: "Bank line", align: "left", sortable: true },
    { label: "Date", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Suggested match", align: "left", sortable: true },
    { label: "Conf.", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const pendingColumns: readonly TableColumn[] = [
    { label: "Selection", align: "left", sortable: false },
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

  .import-row-editor-grid label {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .import-row-editor-actions {
    display: flex;
    gap: var(--ehq-space-2);
  }

  .reconcile-drawer {
    display: grid;
    gap: var(--ehq-space-2);
    padding: var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
  }

  .reconcile-drawer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--ehq-space-2);
  }

  .reconcile-drawer-field {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .reconcile-drawer-actions {
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

  .period-control label {
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
    font-size: 24px;
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

  .import-advanced label {
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

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(150px, 1fr));
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
    font-size: var(--ehq-type-control-size);
    line-height: var(--ehq-type-ui-line);
    color-scheme: dark;
    outline: 0;
  }

  select:focus,
  input:focus {
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .office-action {
    min-height: 38px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-action-size);
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .office-action.primary {
    border-color: var(--ehq-yellow);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
  }

  .office-action:disabled {
    border-color: var(--ehq-border);
    background: transparent;
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

  .pending-actions span {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
  }

  .pending-field {
    display: grid;
    gap: var(--ehq-space-1);
    min-width: 160px;
  }

  .pending-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  .pending-list button {
    min-width: 0;
    min-height: 88px;
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
    display: grid;
    gap: var(--ehq-space-2);
    text-align: left;
  }

  .pending-list button.selected {
    border-color: var(--ehq-yellow-border);
    box-shadow: inset 3px 0 0 var(--ehq-yellow);
  }

  .pending-list strong {
    font-size: var(--ehq-type-ui-size);
  }

  .coming-panel {
    min-width: 0;
    min-height: 180px;
    padding: var(--ehq-space-5);
    border-radius: var(--ehq-radius-sm);
    display: grid;
    place-items: center;
    gap: var(--ehq-space-2);
    text-align: center;
  }

  .coming-panel span {
    max-width: 520px;
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  .pending-list span {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    line-height: var(--ehq-type-ui-line);
  }

  @media (max-width: 1100px) {
    .kpi-grid,
    .dashboard-grid,
    .pending-list {
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
    .filter-grid,
    .pending-list {
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
