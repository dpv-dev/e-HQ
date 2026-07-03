<script lang="ts">
  import {
    EmptyState,
    KPI,
    Loader,
    Table,
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
    type OfficeVatReport,
    type OfficeVatRow
  } from "@ehq/api-client";
  import { formatMoneyValue, formatSignedMoneyValue, moneyToneForValue } from "../../money-format.js";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
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
  const vatTableRows = $derived(createVatTableRows(vatRows));
  const hasVatSource = $derived(vatState.status === "success" && vatState.data.hasVatSource);

  // $effect (not onMount): re-runs on props.workspaceId/props.period change.
  $effect((): void => {
    void loadVat();
  });

  async function loadVat(): Promise<void> {
    vatState = createLoadingState<OfficeVatReport>();

    try {
      const report = await props.client.getVatReport({ workspaceId: props.workspaceId, period: props.period });
      vatState = createSuccessState<OfficeVatReport>(report);
    } catch (error: unknown) {
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
      <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={vatState.status === "loading" ? "loading" : "default"} accent={kpi.accent} />
    {/each}
  </section>

  {#if vatState.status === "loading"}
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
    <Table title="VAT by rate" columns={vatColumns} rows={vatTableRows} state={vatTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
  {/if}
</section>

<script module lang="ts">
  import type { TableColumn } from "@ehq/ui";

  // sortable stays false everywhere: the shared Table renders the sort glyph but
  // implements no sorting, so advertising it would be a dead affordance.
  const vatColumns: readonly TableColumn[] = [
    { label: "Line", align: "left", sortable: false },
    { label: "Base", align: "right", sortable: false },
    { label: "Rate", align: "left", sortable: false },
    { label: "VAT", align: "right", sortable: false }
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
