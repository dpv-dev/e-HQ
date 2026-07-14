<script lang="ts">
  import {
    Alert,
    Button,
    Input,
    KPI,
    Select,
    Table,
    type SelectOption,
    type TableColumn,
    type TableRow,
    type TableRowAction
  } from "@ehq/ui";
  import type {
    OfficeAdvanceKind,
    OfficeAdvanceRow,
    OfficeAdvanceStatus,
    OfficeAdvancesWorkbenchResponse,
    OfficeApiClient,
    OfficePartnerListItem,
    OfficeProjectSummary
  } from "@ehq/api-client";
  import { formatMoneyValue, moneyToneForValue } from "../../money-format.js";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly writesEnabled: boolean;
  }

  const props: Props = $props();
  let data = $state<OfficeAdvancesWorkbenchResponse | null>(null);
  let partners = $state<readonly OfficePartnerListItem[]>([]);
  let projects = $state<readonly OfficeProjectSummary[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let errorMessage = $state("");
  let successMessage = $state("");
  let kindFilter = $state<OfficeAdvanceKind | "all">("all");
  let statusFilter = $state<OfficeAdvanceStatus | "all">("all");
  let beneficiaryType = $state<OfficeAdvanceKind>("staff");
  let beneficiaryName = $state("");
  let partnerId = $state("");
  let projectId = $state("");
  let advanceLabel = $state("");
  let advanceAmount = $state("");
  let plannedOn = $state("");
  let advanceStatus = $state<"planned" | "paid">("planned");
  let paidOn = $state("");
  let advanceNotes = $state("");
  let selectedAdvanceId = $state<string | null>(null);
  let markPaidAdvanceId = $state<string | null>(null);
  let markPaidDate = $state("");
  let applicationDate = $state("");
  let applicationAmount = $state("");
  let applicationKind = $state<"invoice" | "expense" | "refund" | "write_off">("expense");
  let applicationReference = $state("");
  let applicationNotes = $state("");

  const kindOptions: readonly SelectOption[] = [
    { label: "All advances", value: "all" },
    { label: "Staff", value: "staff" },
    { label: "Freelancer", value: "freelancer" },
    { label: "Artist", value: "artist" },
    { label: "Supplier", value: "supplier" },
    { label: "Contractor", value: "contractor" },
    { label: "Other", value: "other" }
  ];
  const beneficiaryTypeOptions = kindOptions.filter((option) => option.value !== "all");
  const statusOptions: readonly SelectOption[] = [
    { label: "All statuses", value: "all" },
    { label: "Planned", value: "planned" },
    { label: "Open", value: "open" },
    { label: "Paid", value: "paid" },
    { label: "Partially applied", value: "partially_applied" },
    { label: "Settled", value: "settled" },
    { label: "Recouped", value: "recouped" },
    { label: "Refunded", value: "refunded" },
    { label: "Waived", value: "waived" },
    { label: "Written off", value: "written_off" }
  ];
  const advanceStatusOptions: readonly SelectOption[] = [
    { label: "Planned", value: "planned" },
    { label: "Already paid", value: "paid" }
  ];
  const applicationKindOptions: readonly SelectOption[] = [
    { label: "Invoice", value: "invoice" },
    { label: "Expense", value: "expense" },
    { label: "Refund", value: "refund" },
    { label: "Write-off", value: "write_off" }
  ];
  const partnerOptions = $derived<readonly SelectOption[]>([
    { label: "No linked supplier record", value: "" },
    ...partners.map((partner) => ({ label: partner.name, value: partner.id }))
  ]);
  const projectOptions = $derived<readonly SelectOption[]>([
    { label: "No project", value: "" },
    ...projects.map((project) => ({ label: project.label, value: project.id }))
  ]);
  const advanceRows = $derived(data?.items ?? []);
  const tableRows = $derived(toAdvanceTableRows(advanceRows));
  const selectedAdvance = $derived(selectedAdvanceId === null ? null : advanceRows.find((row) => row.id === selectedAdvanceId) ?? null);
  const markPaidAdvance = $derived(markPaidAdvanceId === null ? null : advanceRows.find((row) => row.id === markPaidAdvanceId) ?? null);
  const rowActions: readonly TableRowAction[] = [
    {
      label: "Mark paid",
      onAction: openMarkPaid,
      isEnabled: (rowId: string): boolean => advanceRows.some(
        (row) => row.id === rowId && row.source === "office_managed" && row.status === "planned"
      ),
      disabledReason: (): string => "Only planned Office-managed advances can be marked paid here."
    },
    {
      label: "Apply",
      onAction: openApplication,
      isEnabled: (rowId: string): boolean => advanceRows.some(
        (row) => row.id === rowId && row.source === "office_managed" && (row.status === "paid" || row.status === "partially_applied")
      ),
      disabledReason: (): string => "Applications are available for paid Office-managed advances."
    }
  ];

  $effect((): void => {
    const key = `${props.workspaceId}:${props.period}:${props.dateFrom}:${props.dateTo}:${kindFilter}:${statusFilter}`;
    void key;
    void loadAdvances();
  });

  $effect((): void => {
    if (plannedOn.length === 0) plannedOn = props.dateTo;
    if (applicationDate.length === 0) applicationDate = props.dateTo;
    if (markPaidDate.length === 0) markPaidDate = props.dateTo;
  });

  async function loadAdvances(): Promise<void> {
    loading = true;
    errorMessage = "";
    try {
      const [workbench, partnerPage, projectPage] = await Promise.all([
        props.client.getAdvancesWorkbench({
          workspaceId: props.workspaceId,
          kind: kindFilter === "all" ? null : kindFilter,
          status: statusFilter === "all" ? null : statusFilter,
          cursor: null,
          limit: 100
        }),
        props.client.listPartners({
          workspaceId: props.workspaceId,
          period: props.period,
          dateFrom: props.dateFrom,
          dateTo: props.dateTo,
          facet: "supplier",
          cursor: null,
          limit: 100
        }),
        props.client.listProjects({
          workspaceId: props.workspaceId,
          period: props.period,
          dateFrom: props.dateFrom,
          dateTo: props.dateTo,
          status: null,
          cursor: null,
          limit: 100
        })
      ]);
      data = workbench;
      partners = partnerPage.items;
      projects = projectPage.items;
      if (selectedAdvanceId !== null && !workbench.items.some((row) => row.id === selectedAdvanceId)) {
        selectedAdvanceId = null;
      }
      if (markPaidAdvanceId !== null && !workbench.items.some((row) => row.id === markPaidAdvanceId)) {
        markPaidAdvanceId = null;
      }
    } catch (error: unknown) {
      errorMessage = messageFor(error);
    } finally {
      loading = false;
    }
  }

  async function createAdvance(): Promise<void> {
    if (beneficiaryName.trim().length === 0 || advanceLabel.trim().length === 0 || advanceAmount.trim().length === 0 || plannedOn.length === 0) {
      errorMessage = "Beneficiary, label, planned date, and amount are required.";
      return;
    }
    if (advanceStatus === "paid" && paidOn.length === 0) {
      errorMessage = "A paid advance requires its payment date.";
      return;
    }
    saving = true;
    errorMessage = "";
    successMessage = "";
    try {
      await props.client.createAdvance(
        {
          workspaceId: props.workspaceId,
          beneficiaryType,
          beneficiaryName: beneficiaryName.trim(),
          partnerId: partnerId.length === 0 ? null : partnerId,
          projectId: projectId.length === 0 ? null : projectId,
          transactionId: null,
          label: advanceLabel.trim(),
          plannedPaymentOn: plannedOn,
          paidOn: advanceStatus === "paid" ? paidOn : null,
          originalAmountMicro: advanceAmount.trim(),
          currency: "MUR",
          status: advanceStatus,
          notes: advanceNotes.trim().length === 0 ? null : advanceNotes.trim()
        },
        { idempotencyKey: createIdempotencyKey("advance") }
      );
      beneficiaryName = "";
      advanceLabel = "";
      advanceAmount = "";
      advanceNotes = "";
      successMessage = "Advance saved and audited.";
      await loadAdvances();
    } catch (error: unknown) {
      errorMessage = messageFor(error);
    } finally {
      saving = false;
    }
  }

  function openApplication(rowId: string): void {
    selectedAdvanceId = rowId;
    markPaidAdvanceId = null;
    applicationAmount = advanceRows.find((row) => row.id === rowId)?.outstandingAmountMicro ?? "";
    successMessage = "";
  }

  function openMarkPaid(rowId: string): void {
    markPaidAdvanceId = rowId;
    selectedAdvanceId = null;
    successMessage = "";
  }

  async function markAdvancePaid(): Promise<void> {
    if (markPaidAdvanceId === null || markPaidDate.length === 0) {
      errorMessage = "Payment date is required.";
      return;
    }
    saving = true;
    errorMessage = "";
    successMessage = "";
    try {
      await props.client.markAdvancePaid(
        markPaidAdvanceId,
        { workspaceId: props.workspaceId, paidOn: markPaidDate, transactionId: null },
        { idempotencyKey: createIdempotencyKey(`advance-paid-${markPaidAdvanceId}`) }
      );
      markPaidAdvanceId = null;
      successMessage = "Advance marked paid and added to actual cash flow.";
      await loadAdvances();
    } catch (error: unknown) {
      errorMessage = messageFor(error);
    } finally {
      saving = false;
    }
  }

  async function applyAdvance(): Promise<void> {
    if (selectedAdvanceId === null || applicationAmount.trim().length === 0 || applicationDate.length === 0) {
      errorMessage = "Application date and amount are required.";
      return;
    }
    saving = true;
    errorMessage = "";
    successMessage = "";
    try {
      await props.client.applyAdvance(
        selectedAdvanceId,
        {
          workspaceId: props.workspaceId,
          appliedOn: applicationDate,
          amountMicro: applicationAmount.trim(),
          kind: applicationKind,
          reference: applicationReference.trim().length === 0 ? null : applicationReference.trim(),
          notes: applicationNotes.trim().length === 0 ? null : applicationNotes.trim()
        },
        { idempotencyKey: createIdempotencyKey(`advance-apply-${selectedAdvanceId}`) }
      );
      selectedAdvanceId = null;
      applicationAmount = "";
      applicationReference = "";
      applicationNotes = "";
      successMessage = "Advance application recorded.";
      await loadAdvances();
    } catch (error: unknown) {
      errorMessage = messageFor(error);
    } finally {
      saving = false;
    }
  }

  function toAdvanceTableRows(rows: readonly OfficeAdvanceRow[]): readonly TableRow[] {
    return rows.map((row) => ({
      id: row.id,
      cells: [
        { kind: "badge", value: row.kind, tone: row.source === "distribution_contract" ? "active" : "info" },
        { kind: "text", value: row.counterpartyLabel, strong: true },
        { kind: "text", value: row.label, strong: false },
        { kind: "text", value: row.contextLabel ?? "—", strong: false },
        { kind: "text", value: row.plannedOn, strong: false },
        { kind: "money", value: formatMoneyValue(row.originalAmountMicro, row.currency), tone: "muted" },
        { kind: "money", value: formatMoneyValue(row.appliedAmountMicro, row.currency), tone: "success" },
        { kind: "money", value: formatMoneyValue(row.outstandingAmountMicro, row.currency), tone: moneyToneForValue(row.outstandingAmountMicro) },
        { kind: "badge", value: row.status.replaceAll("_", " "), tone: statusTone(row.status) }
      ]
    }));
  }

  function statusTone(status: OfficeAdvanceStatus): "active" | "success" | "warning" | "muted" | "error" {
    if (status === "settled" || status === "recouped" || status === "refunded") return "success";
    if (status === "written_off") return "error";
    if (status === "waived") return "muted";
    if (status === "planned") return "active";
    return "warning";
  }

  function createIdempotencyKey(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  function messageFor(error: unknown): string {
    return error instanceof Error ? error.message : "The request failed.";
  }

  const columns: readonly TableColumn[] = [
    { label: "Beneficiary type", align: "left", sortable: true },
    { label: "Beneficiary", align: "left", sortable: true },
    { label: "Label", align: "left", sortable: true },
    { label: "Contract / project", align: "left", sortable: true },
    { label: "Planned / incurred", align: "left", sortable: true },
    { label: "Original", align: "right", sortable: true },
    { label: "Applied / recouped", align: "right", sortable: true },
    { label: "Outstanding", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
</script>

{#if errorMessage.length > 0}
  <Alert tone="error" title="Advances unavailable" message={errorMessage} dismissible={false} />
{:else if successMessage.length > 0}
  <Alert tone="success" title="Advances updated" message={successMessage} dismissible={false} />
{/if}

<section class="kpi-grid" aria-label="Advance indicators">
  <KPI label="Total outstanding" value={formatMoneyValue(data?.totalOutstandingMicro ?? "0.00", "MUR")} detail="MUR advances" tone="warning" state={loading ? "loading" : "default"} accent={true} />
  <KPI label="Office-managed" value={formatMoneyValue(data?.managedOutstandingMicro ?? "0.00", "MUR")} detail="staff, freelancers, suppliers, others" tone="info" state={loading ? "loading" : "default"} accent={false} />
  <KPI label="Distribution contractual" value={formatMoneyValue(data?.distributionOutstandingMicro ?? "0.00", "MUR")} detail="recouped through Distribution" tone="active" state={loading ? "loading" : "default"} accent={false} />
  <KPI label="Planned" value={formatMoneyValue(data?.plannedManagedMicro ?? "0.00", "MUR")} detail="future managed cash outflow" tone="warning" state={loading ? "loading" : "default"} accent={false} />
</section>

<Alert tone="info" title="One view, controlled sources" message="Advances can be recorded for staff, freelancers, artists, suppliers, contractors, or any other beneficiary. Contract advances already owned by Distribution remain managed and recouped there." dismissible={false} />

<section class="filters ehq-edge-surface" aria-label="Advance filters">
  <Select id="advance-kind" label="Kind" value={kindFilter} options={kindOptions} state="default" message="" onchange={(value) => { kindFilter = value as OfficeAdvanceKind | "all"; }} />
  <Select id="advance-status-filter" label="Status" value={statusFilter} options={statusOptions} state="default" message="" onchange={(value) => { statusFilter = value as OfficeAdvanceStatus | "all"; }} />
</section>

<section class="editor ehq-edge-surface" aria-label="Create beneficiary advance">
  <header><div><p>Beneficiary advance</p><h2>Plan or record a prepayment</h2></div><span>Idempotent + audited</span></header>
  <div class="form-grid">
    <Select id="advance-beneficiary-type" label="Beneficiary type" value={beneficiaryType} options={beneficiaryTypeOptions} state="default" message="" onchange={(value) => { beneficiaryType = value as OfficeAdvanceKind; }} />
    <Input id="advance-beneficiary-name" label="Beneficiary" value={beneficiaryName} placeholder="Name or organisation" type="text" state="default" message="" oninput={(value) => { beneficiaryName = value; }} />
    <Select id="advance-partner" label="Linked supplier (optional)" value={partnerId} options={partnerOptions} state="default" message="" onchange={(value) => { partnerId = value; }} />
    <Select id="advance-project" label="Project" value={projectId} options={projectOptions} state="default" message="" onchange={(value) => { projectId = value; }} />
    <Input id="advance-label" label="Label" value={advanceLabel} placeholder="Production deposit" type="text" state="default" message="" oninput={(value) => { advanceLabel = value; }} />
    <Input id="advance-amount" label="Amount (MUR)" value={advanceAmount} placeholder="0.00" type="text" state="default" message="" oninput={(value) => { advanceAmount = value; }} />
    <label><span>Planned date</span><input type="date" bind:value={plannedOn} /></label>
    <Select id="advance-status" label="Status" value={advanceStatus} options={advanceStatusOptions} state="default" message="" onchange={(value) => { advanceStatus = value as "planned" | "paid"; }} />
    {#if advanceStatus === "paid"}<label><span>Paid date</span><input type="date" bind:value={paidOn} /></label>{/if}
    <Input id="advance-notes" label="Notes" value={advanceNotes} placeholder="Optional" type="text" state="default" message="" oninput={(value) => { advanceNotes = value; }} />
    <Button label="Save advance" variant="primary" size="medium" type="button" disabled={!props.writesEnabled} loading={saving} locked={false} focus={false} ariaLabel="Save beneficiary advance" title={props.writesEnabled ? "" : "Enable writes to save an advance."} onclick={createAdvance} />
  </div>
</section>

{#if selectedAdvance !== null}
  <section class="editor ehq-edge-surface" aria-label="Apply advance">
    <header><div><p>Apply balance</p><h2>{selectedAdvance.counterpartyLabel} · {selectedAdvance.label}</h2></div><span>{formatMoneyValue(selectedAdvance.outstandingAmountMicro, selectedAdvance.currency)} open</span></header>
    <div class="application-grid">
      <label><span>Application date</span><input type="date" bind:value={applicationDate} /></label>
      <Select id="advance-application-kind" label="Application" value={applicationKind} options={applicationKindOptions} state="default" message="" onchange={(value) => { applicationKind = value as typeof applicationKind; }} />
      <Input id="advance-application-amount" label="Amount (MUR)" value={applicationAmount} placeholder="0.00" type="text" state="default" message="" oninput={(value) => { applicationAmount = value; }} />
      <Input id="advance-application-reference" label="Reference" value={applicationReference} placeholder="Invoice or expense ref" type="text" state="default" message="" oninput={(value) => { applicationReference = value; }} />
      <Input id="advance-application-notes" label="Notes" value={applicationNotes} placeholder="Optional" type="text" state="default" message="" oninput={(value) => { applicationNotes = value; }} />
      <Button label="Record application" variant="primary" size="medium" type="button" disabled={!props.writesEnabled} loading={saving} locked={false} focus={false} ariaLabel="Apply advance" onclick={applyAdvance} />
      <Button label="Close" variant="ghost" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Close application form" onclick={() => { selectedAdvanceId = null; }} />
    </div>
  </section>
{/if}

{#if markPaidAdvance !== null}
  <section class="editor ehq-edge-surface" aria-label="Mark advance paid">
    <header><div><p>Payment confirmation</p><h2>{markPaidAdvance.counterpartyLabel} · {markPaidAdvance.label}</h2></div><span>{formatMoneyValue(markPaidAdvance.outstandingAmountMicro, markPaidAdvance.currency)}</span></header>
    <div class="payment-grid">
      <label><span>Paid date</span><input type="date" bind:value={markPaidDate} /></label>
      <Button label="Mark paid" variant="primary" size="medium" type="button" disabled={!props.writesEnabled} loading={saving} locked={false} focus={false} ariaLabel="Mark advance paid" onclick={markAdvancePaid} />
      <Button label="Close" variant="ghost" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Close payment form" onclick={() => { markPaidAdvanceId = null; }} />
    </div>
  </section>
{/if}

<Table title="Advance payments" columns={columns} rows={tableRows} state={loading ? "loading" : errorMessage.length > 0 ? "error" : tableRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={rowActions} />

<style>
  .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--ehq-space-3); }
  .filters, .editor { padding: var(--ehq-space-4); border-radius: var(--ehq-radius-sm); }
  .filters { display: grid; grid-template-columns: repeat(2, minmax(220px, 320px)); gap: var(--ehq-space-3); }
  .editor { display: grid; gap: var(--ehq-space-4); }
  header { display: flex; align-items: start; justify-content: space-between; gap: var(--ehq-space-3); }
  header p, header h2 { margin: 0; }
  header p, header > span, label > span { color: var(--ehq-text-muted); font-family: var(--ehq-mono); font-size: var(--ehq-type-label-size); letter-spacing: .1em; text-transform: uppercase; }
  .form-grid { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: var(--ehq-space-3); align-items: end; }
  .application-grid { display: grid; grid-template-columns: repeat(5, minmax(140px, 1fr)) auto auto; gap: var(--ehq-space-3); align-items: end; }
  .payment-grid { display: grid; grid-template-columns: minmax(180px, 280px) auto auto; gap: var(--ehq-space-3); align-items: end; }
  label { display: grid; gap: var(--ehq-space-1); }
  input[type="date"] { min-height: 36px; width: 100%; padding: 0 var(--ehq-space-3); border: 1px solid var(--ehq-border); border-radius: var(--ehq-radius-sm); background: var(--ehq-bg-main); color: var(--ehq-text); font: inherit; }
  @media (max-width: 1100px) { .kpi-grid, .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .application-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 680px) { .kpi-grid, .filters, .form-grid, .application-grid, .payment-grid { grid-template-columns: 1fr; } }
</style>
