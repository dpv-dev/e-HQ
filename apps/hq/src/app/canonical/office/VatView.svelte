<script lang="ts">
  import {
    BarsChart,
    EmptyState,
    KPI,
    Loader,
    Table,
    type ChartPoint,
    type TableRow,
    type Tone
  } from "@ehq/ui";
  import {
    beginReload,
    createErrorState,
    createIdleState,
    createSuccessState,
    type ApiRequestState,
    type OfficeApiClient,
    type OfficeVatReport,
    type OfficeVatRow
  } from "@ehq/api-client";
  import { formatMoneyValue, formatSignedMoneyValue, moneyToneForValue } from "../../money-format.js";
  import { untrack } from "svelte";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
    readonly dateFrom: string;
    readonly dateTo: string;
  }

  interface VatKpi {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly accent: boolean;
  }

  const props: Props = $props();

  let vatState = $state<ApiRequestState<OfficeVatReport>>(createIdleState<OfficeVatReport>());

  const vatRows = $derived(readVatRows(vatState));
  const vatKpis = $derived(createVatKpis(vatState, props.period));
  const vatAmountPoints = $derived(createVatAmountPoints(vatRows));
  const vatTableRows = $derived(createVatTableRows(vatRows));
  const hasVatSource = $derived(vatState.status === "success" && vatState.data.hasVatSource);

  // $effect (not onMount): re-runs on props.workspaceId/props.period change.
  $effect((): void => {
    void loadVat();
  });

  // Sequence token: discard a stale response if a newer loadVat() call has
  // started before this one's request resolves (out-of-order network replies).
  let loadVatToken = 0;

  async function loadVat(): Promise<void> {
    const token = ++loadVatToken;
    untrack((): void => {
      vatState = beginReload<OfficeVatReport>(vatState);
    });

    try {
      const report = await props.client.getVatReport({ workspaceId: props.workspaceId, period: props.period, dateFrom: props.dateFrom, dateTo: props.dateTo });
      if (token !== loadVatToken) {
        return;
      }
      vatState = createSuccessState<OfficeVatReport>(report);
    } catch (error: unknown) {
      if (token !== loadVatToken) {
        return;
      }
      vatState = createErrorState<OfficeVatReport>(error);
    }
  }

  function readVatRows(state: ApiRequestState<OfficeVatReport>): readonly OfficeVatRow[] {
    if (state.status === "success") {
      return state.data.rows;
    }

    return [];
  }

  function createVatKpis(state: ApiRequestState<OfficeVatReport>, requestedPeriod: string): readonly VatKpi[] {
    if (state.status !== "success") {
      return [
        { label: "Output VAT", value: "—", detail: stateLabel(state), tone: "muted", accent: true },
        { label: "Input VAT", value: "—", detail: requestedPeriod, tone: "muted", accent: false },
        { label: "Net VAT", value: "—", detail: requestedPeriod, tone: "muted", accent: false }
      ];
    }

    return [
      {
        label: "Output VAT",
        value: formatMicro(state.data.outputVatMicro),
        detail: state.data.period,
        tone: "info",
        accent: true
      },
      {
        label: "Input VAT",
        value: formatMicro(state.data.inputVatMicro),
        detail: state.data.period,
        tone: "info",
        accent: false
      },
      {
        label: "Net VAT",
        value: formatSignedMicro(state.data.netVatMicro),
        detail: state.data.period,
        tone: moneyTone(state.data.netVatMicro),
        accent: false
      }
    ];
  }

  function createVatTableRows(rows: readonly OfficeVatRow[]): readonly TableRow[] {
    return rows.map((row: OfficeVatRow): TableRow => ({
      id: row.id,
      cells: [
        { kind: "text", value: row.label, strong: true },
        { kind: "money", value: formatMicro(row.baseMicro), tone: "muted" },
        { kind: "text", value: formatRate(row.rateBp), strong: false },
        { kind: "money", value: formatMicro(row.vatMicro), tone: "info" }
      ]
    }));
  }

  function createVatAmountPoints(rows: readonly OfficeVatRow[]): readonly ChartPoint[] {
    const sortedRows = [...rows]
      .sort((left: OfficeVatRow, right: OfficeVatRow): number => {
        const leftMagnitude = absoluteMicro(left.vatMicro);
        const rightMagnitude = absoluteMicro(right.vatMicro);
        if (leftMagnitude === rightMagnitude) {
          return 0;
        }
        return rightMagnitude > leftMagnitude ? 1 : -1;
      })
      .slice(0, 6);

    let maxMagnitude = 0n;
    for (const row of sortedRows) {
      const magnitude = absoluteMicro(row.vatMicro);
      if (magnitude > maxMagnitude) {
        maxMagnitude = magnitude;
      }
    }

    const points: ChartPoint[] = sortedRows.map((row: OfficeVatRow): ChartPoint => ({
      label: compactChartLabel(row.label),
      value: maxMagnitude === 0n ? 0 : Number((absoluteMicro(row.vatMicro) * 100n) / maxMagnitude)
    }));

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

  function compactChartLabel(label: string): string {
    const normalized = label.trim();
    if (normalized.length <= 10) {
      return normalized;
    }

    return normalized.slice(0, 10);
  }

  function stateLabel(state: ApiRequestState<unknown>): string {
    if (state.status === "idle") {
      return "loading";
    }

    if (state.status === "loading") {
      return "loading";
    }

    if (state.status === "error") {
      return "error";
    }

    return "loaded";
  }

  function isLoadingState(state: ApiRequestState<unknown>): boolean {
    return state.status === "loading" || state.status === "idle";
  }

  function formatRate(rateBp: number): string {
    return `${String(Math.trunc(rateBp / 100))}%`;
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

    return "VAT request failed.";
  }
</script>

<section class="vat-view">
  <section class="kpi-grid" aria-label="VAT indicators">
    {#each vatKpis as kpi (kpi.label)}
      <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingState(vatState) ? "loading" : "default"} accent={kpi.accent} />
    {/each}
  </section>

  {#if isLoadingState(vatState)}
    <Loader label="Loading VAT" detail="Reading the VAT report for the period." size="medium" />
  {:else if vatState.status === "error"}
    <div class="state-copy error">
      <strong class="ehq-type-heading">VAT unavailable</strong>
      <span class="ehq-type-body">{getErrorMessage(vatState.error)}</span>
    </div>
  {:else if !hasVatSource}
    <EmptyState
      title="No VAT source configured"
      detail="This workspace has no VAT source yet. Configure one in the eof admin backend to populate the report."
      state="empty"
      actionLabel=""
      actionHref={null}
      disabledReason=""
    />
  {:else}
    <section class="dashboard-grid">
      <BarsChart title="Top VAT lines by amount" points={vatAmountPoints} tone="info" />
    </section>

    <Table title="VAT by rate" columns={vatColumns} rows={vatTableRows} state={vatTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
  {/if}
</section>

<script module lang="ts">
  import type { TableColumn } from "@ehq/ui";

  const vatColumns: readonly TableColumn[] = [
    { label: "Line", align: "left", sortable: true },
    { label: "Base", align: "right", sortable: true },
    { label: "Rate", align: "left", sortable: true },
    { label: "VAT", align: "right", sortable: true }
  ];
</script>

<style>
  .vat-view {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-4);
  }

  .kpi-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  .dashboard-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
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
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
    max-width: 520px;
  }

  .state-copy.error strong {
    color: var(--ehq-error);
  }

  @media (max-width: 1100px) {
    .kpi-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
