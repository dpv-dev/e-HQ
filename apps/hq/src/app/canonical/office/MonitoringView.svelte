<script lang="ts">
  import { onMount } from "svelte";
  import {
    BarsChart,
    KPI,
    Loader,
    Table,
    type ChartPoint,
    type TablePagination,
    type TableRow,
    type Tone
  } from "@ehq/ui";
  import {
    createErrorState,
    createIdleState,
    createLoadingState,
    createSuccessState,
    type ApiRequestState,
    type AuditLogEntry,
    type OfficeApiClient,
    type OfficeBankQualityResponse,
    type OfficeDashboardResponse,
    type OfficeIntegrityCheck,
    type OfficeIntegrityCheckAllResponse,
    type OfficeRecentImport,
    type OfficeTransaction,
    type PageResult
  } from "@ehq/api-client";
  import { formatDateOnly } from "../../date-format.js";
  import { formatMoneyValue, moneyToneForValue } from "../../money-format.js";
  import { createTablePagination, loadPageResult, readPageItems, TABLE_PAGE_SIZE, type PageLoadMode } from "../../table-pagination.js";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
  }

  interface MonitoringKpi {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly accent: boolean;
  }

  const props: Props = $props();

  let integrityState = $state<ApiRequestState<OfficeIntegrityCheckAllResponse>>(
    createIdleState<OfficeIntegrityCheckAllResponse>()
  );
  let bankQualityState = $state<ApiRequestState<OfficeBankQualityResponse>>(
    createIdleState<OfficeBankQualityResponse>()
  );
  let pendingState = $state<ApiRequestState<PageResult<OfficeTransaction>>>(
    createIdleState<PageResult<OfficeTransaction>>()
  );
  let auditState = $state<ApiRequestState<PageResult<AuditLogEntry>>>(
    createIdleState<PageResult<AuditLogEntry>>()
  );
  let pendingLoadingMore = $state(false);
  let pendingLoadMoreError = $state<string | null>(null);
  let auditLoadingMore = $state(false);
  let auditLoadMoreError = $state<string | null>(null);
  let dashboardState = $state<ApiRequestState<OfficeDashboardResponse>>(createIdleState<OfficeDashboardResponse>());

  const pendingRows = $derived(readPageItems(pendingState));
  const auditRows = $derived(readPageItems(auditState));
  const recentImports = $derived(readRecentImports(dashboardState));
  const integrityRows = $derived(readIntegrityRows(integrityState));
  const monitoringKpis = $derived(createMonitoringKpis(integrityState, bankQualityState, pendingRows));
  const bankQualityPoints = $derived(createBankQualityPoints(bankQualityState));
  const integrityTableRows = $derived(createIntegrityTableRows(integrityRows));
  const pendingTableRows = $derived(createPendingTableRows(pendingRows));
  const auditTableRows = $derived(createAuditTableRows(auditRows));
  const importTableRows = $derived(createImportTableRows(recentImports));
  const pendingPagination = $derived<TablePagination | null>(
    createTablePagination(pendingState, pendingLoadingMore, pendingLoadMoreError, loadMorePending, loadAllPending)
  );
  const auditPagination = $derived<TablePagination | null>(
    createTablePagination(auditState, auditLoadingMore, auditLoadMoreError, loadMoreAudit, loadAllAudit)
  );

  onMount((): void => {
    void loadMonitoring();
  });

  async function loadMonitoring(): Promise<void> {
    integrityState = createLoadingState<OfficeIntegrityCheckAllResponse>();
    bankQualityState = createLoadingState<OfficeBankQualityResponse>();
    pendingState = createLoadingState<PageResult<OfficeTransaction>>();
    auditState = createLoadingState<PageResult<AuditLogEntry>>();
    dashboardState = createLoadingState<OfficeDashboardResponse>();

    const pendingQuery = {
      workspaceId: props.workspaceId,
      period: props.period,
      accountId: null,
      departmentId: null,
      divisionId: null,
      categoryId: null,
      projectId: null,
      type: null,
      status: "pending" as const,
      cursor: null,
      limit: TABLE_PAGE_SIZE
    };

    try {
      const [integrity, bankQuality, pending, audit, dashboard] = await Promise.all([
        props.client.checkIntegrity({
          workspaceId: props.workspaceId
        }),
        props.client.getBankQuality({
          workspaceId: props.workspaceId,
          period: props.period
        }),
        props.client.listTransactions(pendingQuery),
        props.client.listAuditLog({
          workspaceId: props.workspaceId,
          from: null,
          to: null,
          actorId: null,
          entityType: null,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        }),
        props.client.getDashboard({
          workspaceId: props.workspaceId,
          period: props.period
        })
      ]);
      integrityState = createSuccessState<OfficeIntegrityCheckAllResponse>(integrity);
      bankQualityState = createSuccessState<OfficeBankQualityResponse>(bankQuality);
      pendingState = createSuccessState<PageResult<OfficeTransaction>>(pending);
      pendingLoadMoreError = null;
      auditState = createSuccessState<PageResult<AuditLogEntry>>(audit);
      auditLoadMoreError = null;
      dashboardState = createSuccessState<OfficeDashboardResponse>(dashboard);
    } catch (error: unknown) {
      integrityState = createErrorState<OfficeIntegrityCheckAllResponse>(error);
      bankQualityState = createErrorState<OfficeBankQualityResponse>(error);
      pendingState = createErrorState<PageResult<OfficeTransaction>>(error);
      auditState = createErrorState<PageResult<AuditLogEntry>>(error);
      dashboardState = createErrorState<OfficeDashboardResponse>(error);
    }
  }

  async function loadMorePending(): Promise<void> {
    await loadPendingPage("one");
  }

  async function loadAllPending(): Promise<void> {
    await loadPendingPage("all");
  }

  async function loadPendingPage(mode: PageLoadMode): Promise<void> {
    await loadPageResult(mode, {
      state: pendingState,
      loading: pendingLoadingMore,
      setLoading: (loading: boolean): void => {
        pendingLoadingMore = loading;
      },
      setError: (error: string | null): void => {
        pendingLoadMoreError = error;
      },
      setState: (state: ApiRequestState<PageResult<OfficeTransaction>>): void => {
        pendingState = state;
      },
      fetchPage: (cursor: string): Promise<PageResult<OfficeTransaction>> =>
        props.client.listTransactions({
          workspaceId: props.workspaceId,
          period: props.period,
          accountId: null,
          departmentId: null,
          divisionId: null,
          categoryId: null,
          projectId: null,
          type: null,
          status: "pending",
          cursor,
          limit: TABLE_PAGE_SIZE
        })
    });
  }

  async function loadMoreAudit(): Promise<void> {
    await loadAuditPage("one");
  }

  async function loadAllAudit(): Promise<void> {
    await loadAuditPage("all");
  }

  async function loadAuditPage(mode: PageLoadMode): Promise<void> {
    await loadPageResult(mode, {
      state: auditState,
      loading: auditLoadingMore,
      setLoading: (loading: boolean): void => {
        auditLoadingMore = loading;
      },
      setError: (error: string | null): void => {
        auditLoadMoreError = error;
      },
      setState: (state: ApiRequestState<PageResult<AuditLogEntry>>): void => {
        auditState = state;
      },
      fetchPage: (cursor: string): Promise<PageResult<AuditLogEntry>> =>
        props.client.listAuditLog({
          workspaceId: props.workspaceId,
          from: null,
          to: null,
          actorId: null,
          entityType: null,
          cursor,
          limit: TABLE_PAGE_SIZE
        })
    });
  }

  function readIntegrityRows(state: ApiRequestState<OfficeIntegrityCheckAllResponse>): readonly OfficeIntegrityCheck[] {
    if (state.status === "success") {
      return state.data.checks;
    }

    return [];
  }

  function readRecentImports(state: ApiRequestState<OfficeDashboardResponse>): readonly OfficeRecentImport[] {
    if (state.status === "success") {
      return state.data.recentImports ?? [];
    }

    return [];
  }

  function createMonitoringKpis(
    integrity: ApiRequestState<OfficeIntegrityCheckAllResponse>,
    bankQuality: ApiRequestState<OfficeBankQualityResponse>,
    pending: readonly OfficeTransaction[]
  ): readonly MonitoringKpi[] {
    const integrityValue = integrity.status === "success" ? integrity.data.status : "—";
    const integrityDetail =
      integrity.status === "success"
        ? `${String(integrity.data.warningCount)} warnings · ${String(integrity.data.failCount)} failures`
        : stateLabel(integrity);
    const bankValue = bankQuality.status === "success" ? formatBasisPoints(bankQuality.data.matchedRateBp) : "—";
    const bankDetail =
      bankQuality.status === "success"
        ? `${String(bankQuality.data.unmatchedLineCount)} unmatched lines`
        : stateLabel(bankQuality);

    return [
      {
        label: "Integrity",
        value: integrityValue,
        detail: integrityDetail,
        tone: integrityTone(integrityValue),
        accent: true
      },
      {
        label: "Bank quality",
        value: bankValue,
        detail: bankDetail,
        tone: "info",
        accent: false
      },
      {
        label: "Pending",
        value: String(pending.length),
        detail: "first page · max 50",
        tone: pending.length > 0 ? "warning" : "success",
        accent: false
      },
      {
        label: "Recent imports",
        value: dashboardImportCountLabel(dashboardState),
        detail: "from dashboard",
        tone: "muted",
        accent: false
      }
    ];
  }

  function dashboardImportCountLabel(state: ApiRequestState<OfficeDashboardResponse>): string {
    if (state.status !== "success") {
      return "—";
    }

    return String((state.data.recentImports ?? []).length);
  }

  function createBankQualityPoints(state: ApiRequestState<OfficeBankQualityResponse>): readonly ChartPoint[] {
    if (state.status !== "success") {
      return [
        { label: "Matched", value: 0 },
        { label: "Unmatched", value: 0 },
        { label: "Duplicates", value: 0 },
        { label: "Missing ref.", value: 0 },
        { label: "Stale", value: 0 },
        { label: "Window", value: 0 }
      ];
    }

    return [
      { label: "Matched", value: basisPointsToLevel(state.data.matchedRateBp) },
      { label: "Unmatched", value: cappedLevel(state.data.unmatchedLineCount) },
      { label: "Duplicates", value: cappedLevel(state.data.duplicateCandidateCount) },
      { label: "Missing ref.", value: cappedLevel(state.data.missingReferenceCount) },
      { label: "Stale", value: cappedLevel(state.data.staleImportCount) },
      { label: "Window", value: state.data.lastImportAt === null ? 0 : 100 }
    ];
  }

  function createIntegrityTableRows(rows: readonly OfficeIntegrityCheck[]): readonly TableRow[] {
    return rows.map((check: OfficeIntegrityCheck): TableRow => ({
      id: check.id,
      cells: [
        { kind: "text", value: check.label, strong: true },
        { kind: "text", value: check.detail, strong: false },
        { kind: "badge", value: check.exactFixPath, tone: "info" },
        { kind: "badge", value: check.status, tone: integrityTone(check.status) }
      ]
    }));
  }

  function createPendingTableRows(rows: readonly OfficeTransaction[]): readonly TableRow[] {
    return rows.map((transaction: OfficeTransaction): TableRow => ({
      id: transaction.id,
      cells: [
        { kind: "text", value: formatDateOnly(transaction.occurredOn), strong: false },
        { kind: "text", value: transaction.description, strong: true },
        { kind: "text", value: transaction.departmentLabel ?? "to classify", strong: false },
        { kind: "text", value: transaction.categoryLabel ?? "to classify", strong: false },
        { kind: "money", value: formatMoneyMicro(transaction.amountMicro), tone: moneyTone(transaction.amountMicro) },
        { kind: "badge", value: transaction.status, tone: "warning" }
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

  function createImportTableRows(rows: readonly OfficeRecentImport[]): readonly TableRow[] {
    return rows.map((entry: OfficeRecentImport): TableRow => ({
      id: entry.id,
      cells: [
        { kind: "text", value: entry.fileName, strong: true },
        { kind: "badge", value: entry.source, tone: "info" },
        { kind: "text", value: entry.periodLabel, strong: false },
        { kind: "text", value: String(entry.acceptedRowCount), strong: false },
        { kind: "text", value: String(entry.rejectedRowCount + entry.duplicateRowCount), strong: false },
        { kind: "badge", value: entry.status, tone: entry.status === "failed" ? "error" : "success" }
      ]
    }));
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

  function integrityTone(status: string): Tone {
    if (status === "pass") {
      return "success";
    }

    if (status === "fail") {
      return "error";
    }

    if (status === "warning") {
      return "warning";
    }

    return "muted";
  }

  function basisPointsToLevel(value: number): number {
    return Math.trunc(value / 100);
  }

  function cappedLevel(value: number): number {
    return Math.min(100, value * 5);
  }

  function formatBasisPoints(value: number): string {
    const whole = Math.trunc(value / 100);
    const fraction = String(value % 100).padStart(2, "0");

    return `${String(whole)}.${fraction}%`;
  }

  function moneyTone(amountMicro: string): Tone {
    return moneyToneForValue(amountMicro);
  }

  function formatMoneyMicro(amountMicro: string): string {
    return formatMoneyValue(amountMicro, "MUR");
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return "Monitoring request failed.";
  }
</script>

<section class="monitoring-view">
  <section class="kpi-grid" aria-label="Monitoring indicators">
    {#each monitoringKpis as kpi (kpi.label)}
      <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={integrityState.status === "loading" ? "loading" : "default"} accent={kpi.accent} />
    {/each}
  </section>

  <section class="monitoring-layout">
    <BarsChart title="Bank quality" points={bankQualityPoints} tone="info" />
    <section class="monitoring-panel ehq-edge-surface" aria-label="Monitoring refresh">
      <header>
        <div>
          <p class="ehq-type-label-mono">Monitoring</p>
          <h2 class="ehq-type-heading">Operational checks</h2>
          <span class="ehq-type-body">Read-only integrity, bank quality, pending rows, and recent audit activity.</span>
        </div>
        <button class="ehq-type-heading" type="button" onclick={loadMonitoring}>Refresh</button>
      </header>
      {#if integrityState.status === "loading"}
        <Loader label="Loading monitoring" detail="Reading Office monitoring endpoints." size="medium" />
      {:else if integrityState.status === "error"}
        <div class="state-copy error">
          <strong class="ehq-type-heading">Monitoring unavailable</strong>
          <span class="ehq-type-body">{getErrorMessage(integrityState.error)}</span>
        </div>
      {:else}
        <div class="check-summary">
          <strong class="ehq-type-body">{integrityState.status === "success" ? integrityState.data.checkedAt : "Not checked"}</strong>
          <span class="ehq-type-body">{integrityState.status === "success" ? `${String(integrityState.data.passCount)} passed · ${String(integrityState.data.warningCount)} warnings · ${String(integrityState.data.failCount)} failures` : "Waiting for checks."}</span>
        </div>
      {/if}
    </section>
  </section>

  <Table title="Integrity checks" columns={integrityColumns} rows={integrityTableRows} state={integrityState.status === "loading" ? "loading" : integrityState.status === "error" ? "error" : integrityTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
  <Table title="Pending transactions" columns={pendingColumns} rows={pendingTableRows} state={pendingState.status === "loading" ? "loading" : pendingState.status === "error" ? "error" : pendingTableRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={pendingPagination} />
  <Table title="Recent imports" columns={importColumns} rows={importTableRows} state={dashboardState.status === "loading" ? "loading" : dashboardState.status === "error" ? "error" : importTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
  <Table title="Audit log" columns={auditColumns} rows={auditTableRows} state={auditState.status === "loading" ? "loading" : auditState.status === "error" ? "error" : auditTableRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={auditPagination} />
</section>

<script module lang="ts">
  import type { TableColumn } from "@ehq/ui";

  const integrityColumns: readonly TableColumn[] = [
    { label: "Check", align: "left", sortable: true },
    { label: "Detail", align: "left", sortable: false },
    { label: "Fix path", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const pendingColumns: readonly TableColumn[] = [
    { label: "Date", align: "left", sortable: true },
    { label: "Label", align: "left", sortable: true },
    { label: "Department", align: "left", sortable: true },
    { label: "Category", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const importColumns: readonly TableColumn[] = [
    { label: "File", align: "left", sortable: true },
    { label: "Source", align: "left", sortable: true },
    { label: "Period", align: "left", sortable: true },
    { label: "Accepted", align: "left", sortable: true },
    { label: "Issues", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
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
  .monitoring-view {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-4);
  }

  .kpi-grid,
  .monitoring-layout {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-3);
  }

  .kpi-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .monitoring-layout {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  }

  .monitoring-panel {
    min-width: 0;
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    overflow: visible;
  }

  .monitoring-panel header {
    padding: var(--ehq-space-4);
    border-bottom: 1px solid var(--ehq-border-soft);
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: var(--ehq-space-3);
  }

  .monitoring-panel button {
    min-height: 34px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
    font-size: var(--ehq-type-action-size);
    text-transform: uppercase;
  }

  .monitoring-panel button:hover {
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  p,
  h2,
  strong,
  span {
    margin: 0;
  }

  p {
    font-size: var(--ehq-type-label-size);
    text-transform: uppercase;
  }

  h2 {
    margin-top: var(--ehq-space-1);
    font-size: var(--ehq-type-section-title-size);
  }

  .monitoring-panel header span,
  .state-copy span,
  .check-summary span {
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  .check-summary,
  .state-copy {
    min-height: 180px;
    padding: var(--ehq-space-5);
    display: grid;
    place-items: center;
    gap: var(--ehq-space-2);
    text-align: center;
  }

  .check-summary strong {
    font-size: var(--ehq-type-ui-size);
  }

  .state-copy.error strong {
    color: var(--ehq-error);
  }

  @media (max-width: 1100px) {
    .kpi-grid,
    .monitoring-layout {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .kpi-grid,
    .monitoring-layout {
      grid-template-columns: 1fr;
    }

    .monitoring-panel header {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
