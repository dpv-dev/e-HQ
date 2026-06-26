<script lang="ts">
  import { onMount } from "svelte";
  import {
    DivergeChart,
    KPI,
    Loader,
    Table,
    type DivergePoint,
    type TableRow,
    type Tone
  } from "@ehq/ui";
  import {
    createErrorState,
    createIdleState,
    createLoadingState,
    createSuccessState,
    type ApiRequestState,
    type OfficeApiClient,
    type OfficeDashboardResponse,
    type OfficeDivisionPnl,
    type OfficeGlobalPnl,
    type OfficePnlLine,
    type OfficePnlProjectionRow,
    type PageResult
  } from "@ehq/api-client";
  import { formatMoneyValue, formatSignedMoneyValue, moneyToneForValue } from "../../money-format.js";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
  }

  interface CeoKpi {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly accent: boolean;
  }

  const props: Props = $props();

  let dashboardState = $state<ApiRequestState<OfficeDashboardResponse>>(createIdleState<OfficeDashboardResponse>());
  let globalPnlState = $state<ApiRequestState<OfficeGlobalPnl>>(createIdleState<OfficeGlobalPnl>());
  let divisionState = $state<ApiRequestState<PageResult<OfficeDivisionPnl>>>(createIdleState<PageResult<OfficeDivisionPnl>>());

  const divisionRows = $derived(readPageItems(divisionState));
  const ceoKpis = $derived(createCeoKpis(dashboardState, globalPnlState));
  const departmentChartPoints = $derived(createDepartmentChartPoints(globalPnlState));
  const departmentTableRows = $derived(createDepartmentTableRows(globalPnlState));
  const divisionTableRows = $derived(createDivisionTableRows(divisionRows));

  onMount((): void => {
    void loadCeo();
  });

  async function loadCeo(): Promise<void> {
    dashboardState = createLoadingState<OfficeDashboardResponse>();
    globalPnlState = createLoadingState<OfficeGlobalPnl>();
    divisionState = createLoadingState<PageResult<DivisionPnl>>();

    try {
      const [dashboard, globalPnl, divisions] = await Promise.all([
        props.client.getDashboard({ workspaceId: props.workspaceId, period: props.period }),
        props.client.getGlobalPnl({ workspaceId: props.workspaceId, period: props.period }),
        props.client.getDivisionPnl({ workspaceId: props.workspaceId, period: props.period })
      ]);
      dashboardState = createSuccessState<OfficeDashboardResponse>(dashboard);
      globalPnlState = createSuccessState<OfficeGlobalPnl>(globalPnl);
      divisionState = createSuccessState<PageResult<OfficeDivisionPnl>>(divisions);
    } catch (error: unknown) {
      dashboardState = createErrorState<OfficeDashboardResponse>(error);
      globalPnlState = createErrorState<OfficeGlobalPnl>(error);
      divisionState = createErrorState<PageResult<OfficeDivisionPnl>>(error);
    }
  }

  function readPageItems<TItem>(state: ApiRequestState<PageResult<TItem>>): readonly TItem[] {
    if (state.status === "success") {
      return state.data.items;
    }

    return [];
  }

  function createCeoKpis(
    dashboard: ApiRequestState<OfficeDashboardResponse>,
    globalPnl: ApiRequestState<OfficeGlobalPnl>
  ): readonly CeoKpi[] {
    const netValue = globalPnl.status === "success" ? formatSignedMicro(globalPnl.data.netMicro) : "—";
    const netTone: Tone =
      globalPnl.status === "success" ? moneyTone(globalPnl.data.netMicro) : "muted";
    const incomeValue = globalPnl.status === "success" ? formatMicro(globalPnl.data.incomeMicro) : "—";
    const expenseValue = globalPnl.status === "success" ? formatMicro(globalPnl.data.expenseMicro) : "—";
    const cashValue = dashboard.status === "success" ? formatMicro(dashboard.data.cashBalanceMicro) : "—";

    return [
      {
        label: "Net result",
        value: netValue,
        detail: globalPnl.status === "success" ? globalPnl.data.period : stateLabel(globalPnl),
        tone: netTone,
        accent: true
      },
      {
        label: "Income",
        value: incomeValue,
        detail: "validated projection",
        tone: "success",
        accent: false
      },
      {
        label: "Expenses",
        value: expenseValue,
        detail: "validated projection",
        tone: "warning",
        accent: false
      },
      {
        label: "Cash",
        value: cashValue,
        detail: dashboard.status === "success" ? `${String(dashboard.data.unreconciledTransactionCount)} to reconcile` : stateLabel(dashboard),
        tone: "info",
        accent: false
      }
    ];
  }

  function createDepartmentChartPoints(state: ApiRequestState<OfficeGlobalPnl>): readonly DivergePoint[] {
    if (state.status !== "success") {
      return [];
    }

    return state.data.projectionRows.map((row: OfficePnlProjectionRow): DivergePoint => ({
      label: row.departmentLabel,
      negative: row.expenseBarLevel,
      positive: row.revenueBarLevel
    }));
  }

  function createDepartmentTableRows(state: ApiRequestState<OfficeGlobalPnl>): readonly TableRow[] {
    if (state.status !== "success") {
      return [];
    }

    return state.data.lines.map((line: OfficePnlLine): TableRow => ({
      id: line.id,
      cells: [
        { kind: "text", value: line.label, strong: true },
        { kind: "money", value: formatMicro(line.incomeMicro), tone: "success" },
        { kind: "money", value: formatMicro(line.expenseMicro), tone: "error" },
        { kind: "money", value: formatSignedMicro(line.netMicro), tone: moneyTone(line.netMicro) }
      ]
    }));
  }

  function createDivisionTableRows(rows: readonly OfficeDivisionPnl[]): readonly TableRow[] {
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

  function formatMicro(amountMicro: string): string {
    return formatMoneyValue(amountMicro, "MUR");
  }

  function formatSignedMicro(amountMicro: string): string {
    return formatSignedMoneyValue(amountMicro, "MUR");
  }

  function moneyTone(amountMicro: string): Tone {
    return moneyToneForValue(amountMicro);
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return "CEO view request failed.";
  }
</script>

<section class="ceo-view">
  <section class="kpi-grid" aria-label="Executive indicators">
    {#each ceoKpis as kpi (kpi.label)}
      <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={globalPnlState.status === "loading" ? "loading" : "default"} accent={kpi.accent} />
    {/each}
  </section>

  {#if globalPnlState.status === "loading"}
    <Loader label="Loading CEO view" detail="Composing dashboard and validated P&L." size="medium" />
  {:else if globalPnlState.status === "error"}
    <div class="state-copy error">
      <strong class="ehq-type-heading">CEO view unavailable</strong>
      <span class="ehq-type-body">{getErrorMessage(globalPnlState.error)}</span>
    </div>
  {:else}
    <DivergeChart title="Revenue and expenses by department" points={departmentChartPoints} />
    <Table title="Result by category" columns={categoryColumns} rows={departmentTableRows} state={departmentTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
    <Table title="Result by division" columns={divisionColumns} rows={divisionTableRows} state={divisionState.status === "loading" ? "loading" : divisionState.status === "error" ? "error" : divisionTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
  {/if}
</section>

<script module lang="ts">
  import type { TableColumn } from "@ehq/ui";

  const categoryColumns: readonly TableColumn[] = [
    { label: "Category", align: "left", sortable: true },
    { label: "Income", align: "right", sortable: true },
    { label: "Expenses", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true }
  ];
  const divisionColumns: readonly TableColumn[] = [
    { label: "Division", align: "left", sortable: true },
    { label: "Income", align: "right", sortable: true },
    { label: "Expenses", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true }
  ];
</script>

<style>
  .ceo-view {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-4);
  }

  .kpi-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  .state-copy {
    min-height: 180px;
    padding: var(--ehq-space-5);
    display: grid;
    place-items: center;
    gap: var(--ehq-space-2);
    text-align: center;
  }

  .state-copy span {
    color: var(--ehq-text-soft);
    font-size: 13px;
    line-height: 1.5;
  }

  .state-copy.error strong {
    color: var(--ehq-error);
  }

  @media (max-width: 1100px) {
    .kpi-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .kpi-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
