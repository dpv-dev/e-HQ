<script lang="ts">
  import {
    Alert,
    BarsChart,
    Button,
    Input,
    KPI,
    Select,
    Table,
    type ChartPoint,
    type SelectOption,
    type TableColumn,
    type TableRow,
    type TableRowAction
  } from "@ehq/ui";
  import type {
    OfficeApiClient,
    OfficeBankAccountSummary,
    OfficeCashflowManualEntry,
    OfficeCashflowWorkbenchBucket,
    OfficeCashflowWorkbenchResponse
  } from "@ehq/api-client";
  import { parseCsvRecords } from "../../bank-parser.js";
  import { apiMoneyToMicroUnits, formatMoneyValue, moneyToneForValue } from "../../money-format.js";
  import { periodLabel } from "../../period-controls.js";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly writesEnabled: boolean;
  }

  const props: Props = $props();
  let data = $state<OfficeCashflowWorkbenchResponse | null>(null);
  let accounts = $state<readonly OfficeBankAccountSummary[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let errorMessage = $state("");
  let successMessage = $state("");
  let selectedAccountId = $state("");
  let entryDate = $state("");
  let direction = $state<"inflow" | "outflow">("outflow");
  let amount = $state("");
  let label = $state("");
  let notes = $state("");
  let importRecords = $state<readonly Readonly<Record<string, string>>[]>([]);
  let importMessage = $state("Import a baseline CSV when you already have a monthly forecast.");

  const directionOptions: readonly SelectOption[] = [
    { label: "Expected inflow", value: "inflow" },
    { label: "Expected outflow", value: "outflow" }
  ];
  const accountOptions = $derived<readonly SelectOption[]>([
    { label: "All accounts", value: "" },
    ...accounts.map((account) => ({
      label: `${account.bankName} · ${account.accountLabel} (${account.currency})`,
      value: account.id
    }))
  ]);
  const buckets = $derived(data?.buckets ?? []);
  const manualEntries = $derived(data?.manualEntries ?? []);
  const actualInflowPoints = $derived(chartPoints(buckets, "actualInflowLevel"));
  const actualOutflowPoints = $derived(chartPoints(buckets, "actualOutflowLevel"));
  const forecastInflowPoints = $derived(chartPoints(buckets, "forecastInflowLevel"));
  const forecastOutflowPoints = $derived(chartPoints(buckets, "forecastOutflowLevel"));
  const cashflowRows = $derived(toCashflowRows(buckets));
  const manualRows = $derived(toManualRows(manualEntries));
  const actualNet = $derived(sumMoney(buckets, "actualInflowMicro") - sumMoney(buckets, "actualOutflowMicro"));
  const forecastNet = $derived(sumMoney(buckets, "forecastInflowMicro") - sumMoney(buckets, "forecastOutflowMicro"));
  const variance = $derived(sumMoney(buckets, "varianceMicro"));
  const closing = $derived(buckets.at(-1)?.forecastClosingMicro ?? "0.00");
  const manualActions: readonly TableRowAction[] = [
    {
      label: "Cancel",
      danger: true,
      onAction: cancelManualEntry,
      isEnabled: (rowId: string): boolean => manualEntries.some((entry) => entry.id === rowId && entry.status !== "cancelled"),
      disabledReason: (): string => "This entry is already cancelled."
    }
  ];

  $effect((): void => {
    const key = `${props.workspaceId}:${props.dateFrom}:${props.dateTo}:${selectedAccountId}`;
    void key;
    void loadWorkbench();
  });

  $effect((): void => {
    if (entryDate.length === 0) {
      entryDate = props.dateTo;
    }
  });

  async function loadWorkbench(): Promise<void> {
    loading = true;
    errorMessage = "";
    try {
      const [workbench, accountPage] = await Promise.all([
        props.client.getCashflowWorkbench({
          workspaceId: props.workspaceId,
          from: props.dateFrom,
          to: props.dateTo,
          accountId: selectedAccountId.length === 0 ? null : selectedAccountId
        }),
        props.client.listBankAccounts({ workspaceId: props.workspaceId, cursor: null, limit: 100 })
      ]);
      data = workbench;
      accounts = accountPage.items;
    } catch (error: unknown) {
      errorMessage = messageFor(error);
    } finally {
      loading = false;
    }
  }

  async function createManualEntry(): Promise<void> {
    if (entryDate.length === 0 || amount.trim().length === 0 || label.trim().length === 0) {
      errorMessage = "Date, amount, and label are required.";
      return;
    }
    saving = true;
    errorMessage = "";
    successMessage = "";
    try {
      await props.client.createCashflowManualEntry(
        {
          workspaceId: props.workspaceId,
          accountId: selectedAccountId.length === 0 ? null : selectedAccountId,
          partnerId: null,
          projectId: null,
          entryDate,
          direction,
          amountMicro: amount.trim(),
          currency: "MUR",
          label: label.trim(),
          notes: notes.trim().length === 0 ? null : notes.trim(),
          status: "planned"
        },
        { idempotencyKey: createIdempotencyKey("cashflow-manual") }
      );
      amount = "";
      label = "";
      notes = "";
      successMessage = "Manual forecast entry saved and audited.";
      await loadWorkbench();
    } catch (error: unknown) {
      errorMessage = messageFor(error);
    } finally {
      saving = false;
    }
  }

  async function cancelManualEntry(entryId: string): Promise<void> {
    if (!props.writesEnabled) {
      return;
    }
    saving = true;
    errorMessage = "";
    try {
      await props.client.cancelCashflowManualEntry(
        entryId,
        { workspaceId: props.workspaceId, reason: "Cancelled from cash-flow workbench" },
        { idempotencyKey: createIdempotencyKey(`cashflow-cancel-${entryId}`) }
      );
      successMessage = "Manual forecast entry cancelled.";
      await loadWorkbench();
    } catch (error: unknown) {
      errorMessage = messageFor(error);
    } finally {
      saving = false;
    }
  }

  async function handleCashflowFile(event: Event): Promise<void> {
    const input = event.currentTarget instanceof HTMLInputElement ? event.currentTarget : null;
    const file = input?.files?.item(0) ?? null;
    if (file === null) return;
    try {
      const records = parseCsvRecords(await file.text());
      const preview = await props.client.previewCashflowImport(
        { workspaceId: props.workspaceId, rows: records },
        { idempotencyKey: createIdempotencyKey("cashflow-preview") }
      );
      importRecords = records;
      importMessage = `${String(preview.acceptedRowCount)} rows ready · ${String(preview.rejectedRowCount)} rejected.`;
    } catch (error: unknown) {
      importRecords = [];
      importMessage = messageFor(error);
    }
  }

  async function confirmImport(): Promise<void> {
    if (importRecords.length === 0) return;
    saving = true;
    try {
      await props.client.confirmCashflowImport(
        { workspaceId: props.workspaceId, rows: importRecords },
        { idempotencyKey: createIdempotencyKey("cashflow-confirm") }
      );
      importRecords = [];
      importMessage = "Baseline forecast imported and audited.";
      await loadWorkbench();
    } catch (error: unknown) {
      importMessage = messageFor(error);
    } finally {
      saving = false;
    }
  }

  function chartPoints(rows: readonly OfficeCashflowWorkbenchBucket[], key: "actualInflowLevel" | "actualOutflowLevel" | "forecastInflowLevel" | "forecastOutflowLevel"): readonly ChartPoint[] {
    return rows.map((row) => ({ label: row.period.slice(5), value: row[key] }));
  }

  function sumMoney(rows: readonly OfficeCashflowWorkbenchBucket[], key: "actualInflowMicro" | "actualOutflowMicro" | "forecastInflowMicro" | "forecastOutflowMicro" | "varianceMicro"): bigint {
    return rows.reduce((sum, row) => sum + apiMoneyToMicroUnits(row[key]), 0n);
  }

  function toCashflowRows(rows: readonly OfficeCashflowWorkbenchBucket[]): readonly TableRow[] {
    return rows.map((row) => ({
      id: row.period,
      cells: [
        { kind: "text", value: periodLabel(row.period), strong: true },
        { kind: "money", value: formatMoneyValue(row.actualInflowMicro, "MUR"), tone: "success" },
        { kind: "money", value: formatMoneyValue(row.actualOutflowMicro, "MUR"), tone: "error" },
        { kind: "money", value: formatMoneyValue(row.forecastInflowMicro, "MUR"), tone: "success" },
        { kind: "money", value: formatMoneyValue(row.forecastOutflowMicro, "MUR"), tone: "warning" },
        { kind: "money", value: formatMoneyValue(row.varianceMicro, "MUR"), tone: moneyToneForValue(row.varianceMicro) },
        { kind: "money", value: formatMoneyValue(row.forecastClosingMicro, "MUR"), tone: "info" }
      ]
    }));
  }

  function toManualRows(rows: readonly OfficeCashflowManualEntry[]): readonly TableRow[] {
    return rows.map((entry) => ({
      id: entry.id,
      cells: [
        { kind: "text", value: entry.entryDate, strong: false },
        { kind: "text", value: entry.label, strong: true },
        { kind: "badge", value: entry.direction, tone: entry.direction === "inflow" ? "success" : "warning" },
        { kind: "money", value: formatMoneyValue(entry.amountMicro, entry.currency), tone: entry.direction === "inflow" ? "success" : "error" },
        { kind: "badge", value: entry.status, tone: entry.status === "cancelled" ? "muted" : "active" }
      ]
    }));
  }

  function createIdempotencyKey(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  function messageFor(error: unknown): string {
    return error instanceof Error ? error.message : "The request failed.";
  }

  const cashflowColumns: readonly TableColumn[] = [
    { label: "Period", align: "left", sortable: true },
    { label: "Actual in", align: "right", sortable: true },
    { label: "Actual out", align: "right", sortable: true },
    { label: "Forecast in", align: "right", sortable: true },
    { label: "Forecast out", align: "right", sortable: true },
    { label: "Variance", align: "right", sortable: true },
    { label: "Forecast closing", align: "right", sortable: true }
  ];
  const manualColumns: readonly TableColumn[] = [
    { label: "Date", align: "left", sortable: true },
    { label: "Label", align: "left", sortable: true },
    { label: "Direction", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
</script>

{#if errorMessage.length > 0}
  <Alert tone="error" title="Cash flow unavailable" message={errorMessage} dismissible={false} />
{:else if successMessage.length > 0}
  <Alert tone="success" title="Cash flow updated" message={successMessage} dismissible={false} />
{/if}

<section class="kpi-grid" aria-label="Cash-flow indicators">
  <KPI label="Actual net" value={formatMoneyValue(actualNet.toString(), "MUR")} detail="validated transactions" tone={actualNet >= 0n ? "success" : "error"} state={loading ? "loading" : "default"} accent={true} />
  <KPI label="Forecast net" value={formatMoneyValue(forecastNet.toString(), "MUR")} detail="baseline + manual + advances" tone={forecastNet >= 0n ? "success" : "warning"} state={loading ? "loading" : "default"} accent={false} />
  <KPI label="Variance" value={formatMoneyValue(variance.toString(), "MUR")} detail="actual net − forecast net" tone={variance >= 0n ? "success" : "error"} state={loading ? "loading" : "default"} accent={false} />
  <KPI label="Forecast closing" value={formatMoneyValue(closing, "MUR")} detail="latest period" tone={apiMoneyToMicroUnits(closing) >= 0n ? "info" : "error"} state={loading ? "loading" : "default"} accent={false} />
</section>

<section class="filters ehq-edge-surface" aria-label="Cash-flow account filter">
  <Select id="cashflow-account" label="Account" value={selectedAccountId} options={accountOptions} state="default" message="" onchange={(value) => { selectedAccountId = value; }} />
</section>

<section class="entry-panel ehq-edge-surface" aria-label="Manual cash-flow entry">
  <header>
    <div><p class="eyebrow">Manual forecast</p><h2>Add expected cash movement</h2></div>
    <span>Audited</span>
  </header>
  <div class="form-grid">
    <label><span>Date</span><input type="date" bind:value={entryDate} min={props.dateFrom} /></label>
    <Select id="cashflow-direction" label="Direction" value={direction} options={directionOptions} state="default" message="" onchange={(value) => { direction = value as "inflow" | "outflow"; }} />
    <Input id="cashflow-amount" label="Amount (MUR)" value={amount} placeholder="0.00" type="text" state="default" message="" oninput={(value) => { amount = value; }} />
    <Input id="cashflow-label" label="Label" value={label} placeholder="Expected payment" type="text" state="default" message="" oninput={(value) => { label = value; }} />
    <Input id="cashflow-notes" label="Notes" value={notes} placeholder="Optional" type="text" state="default" message="" oninput={(value) => { notes = value; }} />
    <Button label="Add forecast" variant="primary" size="medium" type="button" disabled={!props.writesEnabled} loading={saving} locked={false} focus={false} ariaLabel="Add manual cash-flow forecast" title={props.writesEnabled ? "" : "Enable writes to add a forecast."} onclick={createManualEntry} />
  </div>
</section>

<section class="charts">
  <BarsChart title="Actual inflows" points={actualInflowPoints} tone="success" />
  <BarsChart title="Actual outflows" points={actualOutflowPoints} tone="error" />
  <BarsChart title="Forecast inflows" points={forecastInflowPoints} tone="active" />
  <BarsChart title="Forecast outflows" points={forecastOutflowPoints} tone="warning" />
</section>

<Table title="Actual vs forecast" columns={cashflowColumns} rows={cashflowRows} state={loading ? "loading" : errorMessage.length > 0 ? "error" : cashflowRows.length === 0 ? "empty" : "default"} actionLabel="" />
<Table title="Manual forecast entries" columns={manualColumns} rows={manualRows} state={loading ? "loading" : manualRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={manualActions} />

<section class="import-panel ehq-edge-surface" aria-label="Import baseline cash-flow forecast">
  <label><span>Baseline CSV · Month, Inflow, Outflow, ClosingBalance, Currency</span><input type="file" accept="text/csv,.csv" onchange={handleCashflowFile} /></label>
  <p>{importMessage}</p>
  <Button label="Import baseline" variant="secondary" size="medium" type="button" disabled={!props.writesEnabled || importRecords.length === 0} loading={saving} locked={false} focus={false} ariaLabel="Import baseline cash-flow forecast" onclick={confirmImport} />
</section>

<style>
  .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--ehq-space-3); }
  .filters, .entry-panel, .import-panel { padding: var(--ehq-space-4); border-radius: var(--ehq-radius-sm); }
  .filters { display: grid; grid-template-columns: minmax(220px, 360px); }
  .entry-panel, .import-panel { display: grid; gap: var(--ehq-space-3); }
  header { display: flex; justify-content: space-between; gap: var(--ehq-space-3); align-items: start; }
  header h2, header p, .import-panel p { margin: 0; }
  header > span, .eyebrow, label > span { color: var(--ehq-text-muted); font-family: var(--ehq-mono); font-size: var(--ehq-type-label-size); letter-spacing: .1em; text-transform: uppercase; }
  .form-grid { display: grid; grid-template-columns: repeat(5, minmax(140px, 1fr)) auto; gap: var(--ehq-space-3); align-items: end; }
  label { display: grid; gap: var(--ehq-space-1); }
  input[type="date"], input[type="file"] { min-height: 36px; padding: 0 var(--ehq-space-3); border: 1px solid var(--ehq-border); border-radius: var(--ehq-radius-sm); background: var(--ehq-bg-main); color: var(--ehq-text); font: inherit; }
  .charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ehq-space-3); }
  .import-panel { grid-template-columns: minmax(0, 1fr) auto; align-items: end; }
  .import-panel p { color: var(--ehq-text-muted); }
  @media (max-width: 1100px) { .kpi-grid, .charts { grid-template-columns: repeat(2, minmax(0, 1fr)); } .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 680px) { .kpi-grid, .charts, .form-grid, .import-panel { grid-template-columns: 1fr; } }
</style>
