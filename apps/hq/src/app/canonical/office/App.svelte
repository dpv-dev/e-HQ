<script lang="ts">
  import { onMount } from "svelte";
  import type { AuthSession } from "@ehq/auth";
  import {
    BarsChart,
    DivergeChart,
    KPI,
    Loader,
    Table,
    Toolbar,
    type ChartPoint,
    type DivergePoint,
    type SelectOption,
    type TableColumn,
    type TableRow,
    type Tone,
    type ToolbarFilter
  } from "@ehq/ui";
  import {
    createErrorState,
    createIdleState,
    createLoadingState,
    createSuccessState,
    type ApiMutationReceipt,
    type ApiRequestState,
    type BankImportPreviewResponse,
    type CashflowBucket,
    type OfficeDashboardResponse,
    type OfficePlanComptableNode,
    type OfficePnlProjectionRow,
    type OfficeReconciliationCandidate,
    type OfficeTransaction,
    type BankImportConfirmResponse,
    type BankImportPreviewRequest,
    type OfficeTransactionWriteRequest,
    type PageResult,
    type CurrencyCode,
    type OfficeCategoryType
  } from "@ehq/api-client";
  import { createShellApiClient } from "../../app-shell-data.js";
  import { formatMoneyValue, formatSignedMoneyValue, moneyToneForValue } from "../../money-format.js";
  import MonitoringView from "./MonitoringView.svelte";
  import PartnersView from "./PartnersView.svelte";
  import ProjectsView from "./ProjectsView.svelte";

  type OfficePageId =
    | "dashboard"
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
    | "monitoring";
  type SelectFilterValue = string;
  type ImportSource = "mcb" | "sbi" | "csv" | "cashflow" | "pdf";
  type RequestStatus = "idle" | "loading" | "success" | "error";

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

  interface ImportUiState {
    readonly status: RequestStatus;
    readonly source: ImportSource;
    readonly fileName: string;
    readonly preview: BankImportPreviewResponse | null;
    readonly confirm: BankImportConfirmResponse | null;
    readonly message: string;
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
  const period = "2026-05";
  const allValue = "all";
  const officeNavItems: readonly OfficeNavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      title: "Office Dashboard",
      subtitle: "Finance, bank, monitoring, and project summary."
    },
    {
      id: "pnl",
      label: "P&L",
      title: "P&L · income statement",
      subtitle: "Validated projections · all departments · May 2026."
    },
    {
      id: "coa",
      label: "Chart of accounts",
      title: "Chart of accounts",
      subtitle: "Department → Division → Category."
    },
    {
      id: "transactions",
      label: "Transactions",
      title: "Transactions",
      subtitle: "Ledger filtered by every Office dimension."
    },
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
    },
    {
      id: "imports",
      label: "Imports",
      title: "Imports",
      subtitle: "MCB, MUR bank PDF, CSV, cashflow, and receipt PDF via preview → confirm."
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
    }
  ];

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
    { label: "Matched", value: "matched" }
  ];
  const importSourceOptions: readonly SelectOption[] = [
    { label: "MCB EUR PDF", value: "mcb" },
    { label: "MUR bank PDF", value: "sbi" },
    { label: "Bank CSV", value: "csv" },
    { label: "Cashflow XLSX", value: "cashflow" },
    { label: "Receipt / invoice PDF", value: "pdf" }
  ];

  let activePageId = $state<OfficePageId>("dashboard");
  let dashboardState = $state<ApiRequestState<OfficeDashboardResponse>>(createIdleState<OfficeDashboardResponse>());
  let pnlState = $state<ApiRequestState<readonly OfficePnlProjectionRow[]>>(
    createIdleState<readonly OfficePnlProjectionRow[]>()
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
  let actionReceipt = $state<ApiMutationReceipt | null>(null);
  let departmentFilter = $state<SelectFilterValue>(allValue);
  let divisionFilter = $state<SelectFilterValue>(allValue);
  let categoryFilter = $state<SelectFilterValue>(allValue);
  let projectFilter = $state<SelectFilterValue>(allValue);
  let accountFilter = $state<SelectFilterValue>(allValue);
  let typeFilter = $state<SelectFilterValue>(allValue);
  let transactionStatusFilter = $state<SelectFilterValue>(allValue);
  let reconciliationStatusFilter = $state<SelectFilterValue>("suggested");
  let selectedPendingIds = $state<readonly string[]>([]);
  let importState = $state<ImportUiState>({
    status: "idle",
    source: "mcb",
    fileName: "Euro MCB Current Account statement (5).pdf",
    preview: null,
    confirm: null,
    message: "Ready for preview."
  });
  let planForm = $state<PlanFormState>({
    kind: "category",
    parentId: "div_shared",
    code: "6090",
    label: "New category",
    active: true,
    type: "expense"
  });

  const activePage = $derived(getOfficeNavItem(activePageId));
  const planNodes = $derived(readArrayState(planState));
  const transactionRows = $derived(readPageItems(transactionsState));
  const pendingRows = $derived(readPageItems(pendingState));
  const reconciliationRows = $derived(readPageItems(reconciliationState));
  const cashflowRows = $derived(readArrayState(cashflowState));
  const pnlRows = $derived(readArrayState(pnlState));
  const departmentOptions = $derived(createPlanOptions(planNodes, "department", "All departments"));
  const divisionOptions = $derived(createPlanOptions(planNodes, "division", "All divisions"));
  const categoryOptions = $derived(createPlanOptions(planNodes, "category", "All categories"));
  const parentOptions = $derived(createParentOptions(planNodes));
  const projectOptions = $derived(createProjectOptions(transactionRows));
  const dashboardKpis = $derived(createDashboardKpis(dashboardState));
  const pnlChartPoints = $derived(createPnlChartPoints(pnlRows));
  const pnlTableRows = $derived(createPnlTableRows(pnlRows));
  const planTableRows = $derived(createPlanTableRows(planNodes));
  const transactionTableRows = $derived(createTransactionTableRows(transactionRows));
  const pendingTableRows = $derived(createPendingTableRows(pendingRows, selectedPendingIds));
  const reconciliationTableRows = $derived(createReconciliationTableRows(reconciliationRows));
  const cashflowInflowPoints = $derived(createCashflowPoints(cashflowRows, "inflow"));
  const cashflowOutflowPoints = $derived(createCashflowPoints(cashflowRows, "outflow"));
  const cashflowTableRows = $derived(createCashflowTableRows(cashflowRows));
  const importToolbarFilters = $derived(createImportToolbarFilters(importState));
  const canConfirmImport = $derived(importState.preview !== null && importState.status !== "loading");

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
      loadPnlProjection(),
      loadPlanComptable(),
      loadTransactions(),
      loadPendingTransactions(),
      loadReconciliations(),
      loadCashflow()
    ]);
  }

  async function loadDashboard(): Promise<void> {
    dashboardState = createLoadingState<OfficeDashboardResponse>();

    try {
      const dashboard = await client.office.getDashboard({
        workspaceId: officeWorkspaceId,
        period
      });
      dashboardState = createSuccessState<OfficeDashboardResponse>(dashboard);
    } catch (error: unknown) {
      dashboardState = createErrorState<OfficeDashboardResponse>(error);
    }
  }

  async function loadPnlProjection(): Promise<void> {
    pnlState = createLoadingState<readonly OfficePnlProjectionRow[]>();

    try {
      const rows = await client.office.getPnlProjection({
        workspaceId: officeWorkspaceId,
        period,
        departmentId: toNullableFilter(departmentFilter)
      });
      pnlState = createSuccessState<readonly OfficePnlProjectionRow[]>(rows);
    } catch (error: unknown) {
      pnlState = createErrorState<readonly OfficePnlProjectionRow[]>(error);
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
        accountId: toNullableFilter(accountFilter),
        departmentId: toNullableFilter(departmentFilter),
        divisionId: toNullableFilter(divisionFilter),
        categoryId: toNullableFilter(categoryFilter),
        projectId: toNullableFilter(projectFilter),
        type: toNullableCategoryType(typeFilter),
        status: toNullableTransactionStatus(transactionStatusFilter),
        cursor: null,
        limit: 50
      });
      transactionsState = createSuccessState<PageResult<OfficeTransaction>>(page);
    } catch (error: unknown) {
      transactionsState = createErrorState<PageResult<OfficeTransaction>>(error);
    }
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
        limit: 50
      });
      pendingState = createSuccessState<PageResult<OfficeTransaction>>(page);
      selectedPendingIds = page.items.map((transaction: OfficeTransaction): string => transaction.id);
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
        status: toNullableReconciliationStatus(reconciliationStatusFilter),
        cursor: null,
        limit: 50
      });
      reconciliationState = createSuccessState<PageResult<OfficeReconciliationCandidate>>(page);
    } catch (error: unknown) {
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  async function loadCashflow(): Promise<void> {
    cashflowState = createLoadingState<readonly CashflowBucket[]>();

    try {
      const rows = await client.office.getCashflow({
        workspaceId: officeWorkspaceId,
        from: "2026-01-01",
        to: "2026-06-30",
        accountId: toNullableFilter(accountFilter)
      });
      cashflowState = createSuccessState<readonly CashflowBucket[]>(rows);
    } catch (error: unknown) {
      cashflowState = createErrorState<readonly CashflowBucket[]>(error);
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
    if (pathname.endsWith("/console/office/dashboard")) {
      return "dashboard";
    }

    if (pathname.endsWith("/console/office/clients")) {
      return "clients";
    }

    if (pathname.endsWith("/console/office/suppliers")) {
      return "suppliers";
    }

    if (pathname.endsWith("/console/office/projects")) {
      return "projects";
    }

    if (pathname.endsWith("/console/office/monitoring")) {
      return "monitoring";
    }

    if (pathname.endsWith("/console/office/transactions")) {
      return "transactions";
    }

    if (pathname.endsWith("/console/office/imports")) {
      return "imports";
    }

    if (pathname.endsWith("/console/office/reconciliation")) {
      return "reconciliation";
    }

    if (pathname.endsWith("/console/office/pending")) {
      return "pending";
    }

    if (pathname.endsWith("/console/office/cashflow")) {
      return "cashflow";
    }

    if (pathname.endsWith("/console/office/coa")) {
      return "coa";
    }

    return "dashboard";
  }

  function pagePath(pageId: OfficePageId): string {
    if (pageId === "dashboard") {
      return "/console/office/dashboard";
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

  function updateImportSource(event: Event): void {
    const source = readSelectValue(event) as ImportSource;

    importState = {
      ...importState,
      source,
      fileName: sampleFileNameForImportSource(source),
      preview: null,
      confirm: null,
      message: "Source changed; run preview again."
    };
  }

  function updateImportFileName(event: Event): void {
    importState = {
      ...importState,
      fileName: readInputValue(event),
      preview: null,
      confirm: null,
      message: "File ready for preview."
    };
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

  async function previewImport(): Promise<void> {
    importState = {
      ...importState,
      status: "loading",
      message: "Preview in progress.",
      preview: null,
      confirm: null
    };

    try {
      const request: BankImportPreviewRequest = {
        workspaceId: officeWorkspaceId,
        source: importState.source,
        fileName: importState.fileName,
        checksum: `checksum-${importState.source}-${importState.fileName}`,
        rows: [
          { row: "1", label: "preview row one" },
          { row: "2", label: "preview row two" },
          { row: "3", label: "preview row three" }
        ]
      };
      const preview = await client.office.previewBankImport(request, {
        idempotencyKey: createIdempotencyKey("import-preview")
      });
      importState = {
        ...importState,
        status: "success",
        preview,
        confirm: null,
        message: "Preview ready."
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
      importState = {
        ...importState,
        status: "error",
        message: "No preview to confirm."
      };
      return;
    }

    importState = {
      ...importState,
      status: "loading",
      message: "Confirmation in progress."
    };

    try {
      const confirm = await client.office.confirmBankImport(
        {
          workspaceId: officeWorkspaceId,
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
    const category = planNodes.find((node: OfficePlanComptableNode): boolean => node.kind === "category" && node.active);

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
      occurredOn: "2026-05-14",
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
            client.office.updateTransaction(
              transaction.id,
              {
                workspaceId: officeWorkspaceId,
                occurredOn: transaction.occurredOn,
                accountId: transaction.accountId,
                categoryId: transaction.categoryId,
                projectId: transaction.projectId,
                description: transaction.description,
                amountMicro: transaction.amountMicro,
                currency: transaction.currency
              },
              {
                idempotencyKey: createIdempotencyKey(`pending-validate-${transaction.id}`)
              }
            )
          )
      );
      const latestReceipt = writeResults[writeResults.length - 1];
      actionReceipt = latestReceipt ?? null;
      pendingState = createSuccessState<PageResult<OfficeTransaction>>({
        items: pendingRows.filter((transaction: OfficeTransaction): boolean => !selectedPendingIds.includes(transaction.id)),
        nextCursor: null
      });
      selectedPendingIds = [];
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

  function readPageItems<TItem>(state: ApiRequestState<PageResult<TItem>>): readonly TItem[] {
    if (state.status === "success") {
      return state.data.items;
    }

    return [];
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

  function createPnlTableRows(rows: readonly OfficePnlProjectionRow[]): readonly TableRow[] {
    return rows.map((row: OfficePnlProjectionRow): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.departmentLabel, strong: true },
        { kind: "money", value: formatMicro(row.revenueMicro), tone: "success" },
        { kind: "money", value: formatMicro(row.expenseMicro), tone: "error" },
        { kind: "money", value: formatSignedMicro(row.netMicro), tone: row.netTone === "positive" ? "success" : "error" },
        { kind: "badge", value: row.validatedProjectionId, tone: "info" }
      ]
    }));
  }

  function createPlanTableRows(nodes: readonly OfficePlanComptableNode[]): readonly TableRow[] {
    return nodes.map((node: OfficePlanComptableNode): TableRow => ({
      id: node.id,
      cells: [
        { kind: "text", value: indentPlanLabel(node, nodes), strong: node.kind === "department" },
        { kind: "badge", value: node.kind, tone: planKindTone(node.kind) },
        { kind: "text", value: node.code, strong: false },
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
        { kind: "text", value: transaction.occurredOn, strong: false },
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
        { kind: "text", value: candidate.occurredOn, strong: false },
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
        { kind: "text", value: row.period, strong: true },
        { kind: "money", value: formatMicro(row.inflowMicro), tone: "success" },
        { kind: "money", value: formatMicro(row.outflowMicro), tone: "error" },
        { kind: "money", value: formatMicro(row.closingMicro), tone: "info" }
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
        .map((node: OfficePlanComptableNode): SelectOption => ({ label: `${node.code} · ${node.label}`, value: node.id }))
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

  function createImportToolbarFilters(state: ImportUiState): readonly ToolbarFilter[] {
    return [
      { label: "Source", value: state.source.toUpperCase(), active: true, disabled: false },
      { label: "File", value: state.fileName, active: false, disabled: false },
      { label: "Status", value: state.status, active: false, disabled: false }
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

  function sampleFileNameForImportSource(source: ImportSource): string {
    if (source === "mcb") {
      return "Euro MCB Current Account statement (5).pdf";
    }

    if (source === "sbi") {
      return "bankStatement_1Oct2024 to 28Jan2025.pdf";
    }

    if (source === "cashflow") {
      return "Cashflow 2025.xlsx";
    }

    if (source === "pdf") {
      return "receipt_or_invoice.pdf";
    }

    return "bank_export.csv";
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

  function reconciliationTone(status: "unmatched" | "suggested" | "matched"): Tone {
    if (status === "matched") {
      return "success";
    }

    if (status === "suggested") {
      return "info";
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

<main class="office-shell">
  <aside class="sidebar" aria-label="Office navigation">
    <button class="brand" type="button" onclick={() => selectPage("dashboard")}>
      <span class="ehq-type-display">ë</span>
      <strong class="ehq-type-label-mono">ë • office</strong>
    </button>

    <nav>
      <h2 class="ehq-type-label-mono">Office</h2>
      {#each officeNavItems as item (item.id)}
        <button class="ehq-nav-fade-item ehq-edge-surface ehq-type-body" class:active={activePageId === item.id} type="button" onclick={() => selectPage(item.id)}>
          <span aria-hidden="true"></span>
          {item.label}
        </button>
      {/each}
    </nav>

    <p class="system-status ehq-type-label-mono"><span aria-hidden="true"></span>eof/v1 · live reads</p>
  </aside>

  <section class="main-panel">
    <header class="topbar">
      <p class="ehq-type-label-mono"><span>Office</span> / <strong>{activePage.label}</strong></p>
      <label class="search">
        <span class="ehq-type-label-mono">⌘K</span>
        <input class="ehq-type-body" aria-label="Search Office" placeholder="transaction, account, import..." />
      </label>
      <button class="notification ehq-type-label-mono" type="button" aria-label="Notifications">3</button>
      <button class="profile" type="button" aria-label="Sign out" onclick={onLogout}>
        <span class="ehq-type-label-mono">{session.initials}</span>
        <strong class="ehq-type-heading">{session.displayName}</strong>
        <small class="ehq-type-label-mono">{session.roleLabel}</small>
      </button>
    </header>

    <div class="content">
      <section class="page-head">
        <p class="ehq-type-label-mono">Office</p>
        <h1 class="ehq-type-display">{activePage.title}</h1>
        <span class="ehq-type-body">{activePage.subtitle}</span>
      </section>

      {#if actionReceipt !== null}
        <p class="receipt ehq-type-label-mono" role="status">Action accepted · {actionReceipt.id} · audit {actionReceipt.auditEventId}</p>
      {/if}

      {#if activePageId === "dashboard"}
        <section class="kpi-grid" aria-label="Office indicators">
          {#each dashboardKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={dashboardState.status === "loading" ? "loading" : "default"} accent={kpi.accent} />
          {/each}
        </section>

        <section class="dashboard-grid">
          <section class="form-panel ehq-edge-surface" aria-label="Recent reconciliation">
            <header>
              <h2>Recent reconciliation</h2>
              <p>Bank and ledger candidates for the selected period.</p>
            </header>
            <Table title="Reconciliation" columns={reconciliationColumns} rows={reconciliationTableRows} state={reconciliationState.status === "loading" ? "loading" : reconciliationState.status === "error" ? "error" : "default"} actionLabel="" />
          </section>

          <section class="form-panel ehq-edge-surface" aria-label="Cash flow summary">
            <header>
              <h2>Cash flow</h2>
              <p>Inflows, outflows, and closing balances.</p>
            </header>
            <BarsChart title="Inflows" points={cashflowInflowPoints} tone="success" />
            <Table title="Cash-flow by month" columns={cashflowColumns} rows={cashflowTableRows} state={cashflowState.status === "loading" ? "loading" : cashflowState.status === "error" ? "error" : "default"} actionLabel="" />
          </section>
        </section>
      {:else if activePageId === "pnl"}
        <section class="kpi-grid" aria-label="P&L indicators">
          {#each dashboardKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={dashboardState.status === "loading" ? "loading" : "default"} accent={kpi.accent} />
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
            <Table title="Result by department" columns={pnlColumns} rows={pnlTableRows} state={pnlState.status === "error" ? "error" : "default"} actionLabel="" />
          </section>
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
          <button class="office-action ehq-type-heading primary" type="button" onclick={createPlanNode}>Create</button>
          <button class="office-action ehq-type-heading" type="button" onclick={deactivateFirstCategory}>Deactivate a category</button>
        </section>

        <Table title="Department → Division → Category" columns={planColumns} rows={planTableRows} state={planState.status === "loading" ? "loading" : planState.status === "error" ? "error" : "default"} actionLabel="" />
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
          <button class="office-action ehq-type-heading" type="button" onclick={createTransactionDraft}>New entry</button>
        </section>

        <Table title="Ledger · May 2026" columns={transactionColumns} rows={transactionTableRows} state={transactionsState.status === "loading" ? "loading" : transactionsState.status === "error" ? "error" : transactionRows.length === 0 ? "empty" : "default"} actionLabel="" />
      {:else if activePageId === "clients"}
        <PartnersView
          facet="client"
          client={client.office}
          workspaceId={officeWorkspaceId}
          {period}
          onReceipt={receivePartnerReceipt}
        />
      {:else if activePageId === "suppliers"}
        <PartnersView
          facet="supplier"
          client={client.office}
          workspaceId={officeWorkspaceId}
          {period}
          onReceipt={receivePartnerReceipt}
        />
      {:else if activePageId === "projects"}
        <ProjectsView client={client.office} workspaceId={officeWorkspaceId} {period} />
      {:else if activePageId === "monitoring"}
        <MonitoringView client={client.office} workspaceId={officeWorkspaceId} {period} />
      {:else if activePageId === "imports"}
        <Toolbar label="Import" filters={importToolbarFilters} actionLabel="" loading={importState.status === "loading"} />

        <section class="form-panel ehq-edge-surface" aria-label="Import Office">
          <label>
            <span class="ehq-type-label-mono">Source</span>
            <select value={importState.source} onchange={updateImportSource}>
              {#each importSourceOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="ehq-type-label-mono">File</span>
            <input value={importState.fileName} oninput={updateImportFileName} />
          </label>
          <button class="office-action ehq-type-heading" type="button" onclick={previewImport}>Preview</button>
          <button class="office-action ehq-type-heading primary" type="button" disabled={!canConfirmImport} onclick={confirmImport}>Confirm</button>
        </section>

        <section class="import-result ehq-type-label-mono" class:error={importState.status === "error"} aria-live="polite">
          <strong>{importState.message}</strong>
          {#if importState.preview !== null}
            <span>Preview {importState.preview.previewId} · {importState.preview.detectedFormat} · {importState.preview.periodLabel}</span>
            <span>{importState.preview.acceptedRowCount} rows · {importState.preview.rejectedRowCount} rejected · {importState.preview.duplicateRowCount} duplicates · {importState.preview.currencyCodes.join(" / ")}</span>
            <span>{importState.preview.accountReference ?? "Account to confirm"} · fingerprint {importState.preview.idempotencyFingerprint}</span>
            {#if importState.preview.openingBalanceMicro !== null && importState.preview.closingBalanceMicro !== null}
              <span>Opening {formatMoney(importState.preview.openingBalanceMicro, importState.preview.currencyCodes[0] ?? "MUR")} · closing {formatMoney(importState.preview.closingBalanceMicro, importState.preview.currencyCodes[0] ?? "MUR")}</span>
            {/if}
            {#each importState.preview.parsingNotes as note (note)}
              <span>{note}</span>
            {/each}
            {#each importState.preview.warnings as warning (warning)}
              <span>{warning}</span>
            {/each}
          {/if}
          {#if importState.confirm !== null}
            <span>Confirm {importState.confirm.id} · {importState.confirm.importedTransactionCount} imported transactions</span>
          {/if}
        </section>

        <Table title="Import history" columns={importColumns} rows={importRows} state="default" actionLabel="" />
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
          <button class="office-action ehq-type-heading primary" type="button" onclick={approveSuggestedReconciliations}>Approve batch</button>
        </section>

        <Table title="Bank ↔ ledger matching" columns={reconciliationColumns} rows={reconciliationTableRows} state={reconciliationState.status === "loading" ? "loading" : reconciliationState.status === "error" ? "error" : reconciliationRows.length === 0 ? "empty" : "default"} actionLabel="" />
      {:else if activePageId === "pending"}
        <section class="pending-actions ehq-edge-surface" aria-label="Actions pending">
          <button class="office-action ehq-type-heading primary" type="button" onclick={bulkValidatePending}>Validate selection</button>
          <span class="ehq-type-label-mono">{selectedPendingIds.length} selected</span>
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

        <Table title="Queue pending" columns={pendingColumns} rows={pendingTableRows} state={pendingState.status === "loading" ? "loading" : pendingState.status === "error" ? "error" : pendingRows.length === 0 ? "empty" : "default"} actionLabel="" />
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

        <section class="dashboard-grid">
          <BarsChart title="Inflows" points={cashflowInflowPoints} tone="success" />
          <BarsChart title="Outflows" points={cashflowOutflowPoints} tone="error" />
        </section>

        <Table title="Cash-flow by month" columns={cashflowColumns} rows={cashflowTableRows} state={cashflowState.status === "loading" ? "loading" : cashflowState.status === "error" ? "error" : "default"} actionLabel="" />
      {/if}
    </div>
  </section>
</main>

<script module lang="ts">
  import type { TableColumn, TableRow } from "@ehq/ui";

  const pnlColumns: readonly TableColumn[] = [
    { label: "Department", align: "left", sortable: true },
    { label: "Revenue", align: "right", sortable: true },
    { label: "Expenses", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true },
    { label: "Projection", align: "left", sortable: false }
  ];
  const planColumns: readonly TableColumn[] = [
    { label: "Label", align: "left", sortable: true },
    { label: "Node", align: "left", sortable: true },
    { label: "Code", align: "left", sortable: true },
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
  const importRows: readonly TableRow[] = [
    {
      id: "import_mcb",
      cells: [
        { kind: "text", value: "Euro MCB Current Account statement (5).pdf", strong: true },
        { kind: "text", value: "MCB EUR PDF", strong: false },
        { kind: "text", value: "9", strong: false },
        { kind: "text", value: "May 2026", strong: false },
        { kind: "badge", value: "preview ready", tone: "success" }
      ]
    },
    {
      id: "import_mur_statement",
      cells: [
        { kind: "text", value: "bankStatement_1Oct2024 to 28Jan2025.pdf", strong: true },
        { kind: "text", value: "MUR bank PDF", strong: false },
        { kind: "text", value: "327", strong: false },
        { kind: "text", value: "Oct 2024-Jan 2025", strong: false },
        { kind: "badge", value: "preview ready", tone: "success" }
      ]
    },
    {
      id: "import_cashflow",
      cells: [
        { kind: "text", value: "Cashflow 2025.xlsx", strong: true },
        { kind: "text", value: "Cashflow XLSX", strong: false },
        { kind: "text", value: "1033", strong: false },
        { kind: "text", value: "Dec 2024-Apr 2026", strong: false },
        { kind: "badge", value: "preview", tone: "info" }
      ]
    },
    {
      id: "import_pdf",
      cells: [
        { kind: "text", value: "receipt_or_invoice.pdf", strong: true },
        { kind: "text", value: "Receipt / invoice", strong: false },
        { kind: "text", value: "1", strong: false },
        { kind: "text", value: "to detect", strong: false },
        { kind: "badge", value: "needs fix", tone: "warning" }
      ]
    }
  ];
</script>

<style>
  :global(body) {
    overflow: hidden;
  }

  .office-shell {
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

  .topbar p strong {
    color: var(--ehq-text);
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
    font-size: 11px;
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
    font-size: 10px;
  }

  .profile strong {
    font-size: 12px;
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
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .office-action.primary {
    border-color: var(--ehq-yellow);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
  }

  .office-action:disabled {
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

  .pending-actions {
    justify-content: space-between;
  }

  .pending-actions span {
    color: var(--ehq-text-muted);
    font-size: 11px;
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
    font-size: 13px;
  }

  .pending-list span {
    color: var(--ehq-text-muted);
    font-size: 11px;
    line-height: 1.5;
  }

  @media (max-width: 1100px) {
    .office-shell {
      grid-template-columns: 210px minmax(0, 1fr);
    }

    .kpi-grid,
    .dashboard-grid,
    .pending-list {
      grid-template-columns: 1fr 1fr;
    }

    .filter-grid {
      grid-template-columns: repeat(2, minmax(150px, 1fr));
    }
  }

  @media (max-width: 760px) {
    .office-shell {
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
    .filter-grid,
    .pending-list {
      grid-template-columns: 1fr;
    }
  }
</style>
