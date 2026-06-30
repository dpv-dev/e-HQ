<script lang="ts">
  import { onMount } from "svelte";
  import { Badge, Loader, type Tone } from "@ehq/ui";
  import {
    createErrorState,
    createIdleState,
    createLoadingState,
    createSuccessState,
    type ApiMutationReceipt,
    type ApiRequestState,
    type EntityId,
    type OfficeApiClient,
    type OfficePartnerDetail,
    type OfficePartnerFacet,
    type OfficePartnerListItem,
    type OfficePartnerPayeeLink,
    type OfficePartnerSideActivity,
    type OfficePartnerWriteRequest,
    type PageResult
  } from "@ehq/api-client";
  import { formatDateOnly } from "../../date-format.js";
  import { formatMoneyValue, moneySignForValue, moneyToneForValue } from "../../money-format.js";

  type DrawerMode = "closed" | "detail" | "create" | "edit";
  type RequestStatus = "idle" | "loading" | "success" | "error";

  interface Props {
    readonly facet: OfficePartnerFacet;
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly onReceipt: (receipt: ApiMutationReceipt) => void;
  }

  interface PartnerFormState {
    readonly name: string;
    readonly email: string;
    readonly phone: string;
    readonly address: string;
    readonly taxId: string;
    readonly notes: string;
    readonly active: boolean;
  }

  interface FacetCopy {
    readonly title: string;
    readonly subtitle: string;
    readonly tableTitle: string;
    readonly amountLabel: string;
    readonly balanceLabel: string;
    readonly alsoLabel: string;
    readonly emptyLabel: string;
    readonly drawerContext: string;
  }

  const props: Props = $props();
  const currency = "MUR";
  const writesEnabled = true;
  const emptyFormState: PartnerFormState = {
    name: "",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    notes: "",
    active: true
  };

  let partnersState = $state<ApiRequestState<PageResult<OfficePartnerListItem>>>(
    createIdleState<PageResult<OfficePartnerListItem>>()
  );
  let detailState = $state<ApiRequestState<OfficePartnerDetail>>(createIdleState<OfficePartnerDetail>());
  let drawerMode = $state<DrawerMode>("closed");
  let selectedPartnerId = $state<EntityId | null>(null);
  let partnerForm = $state<PartnerFormState>(emptyFormState);
  let linkPayeeId = $state<string>("");
  let linkStatus = $state<RequestStatus>("idle");
  let actionMessage = $state<string>("Select a partner to see the full relationship.");

  const copy = $derived(createFacetCopy(props.facet));
  const partners = $derived(readPartnerItems(partnersState));
  const selectedPartner = $derived(readPartnerDetail(detailState));
  const drawerOpen = $derived(drawerMode !== "closed");

  onMount((): void => {
    void loadPartners();
  });

  async function loadPartners(): Promise<void> {
    partnersState = createLoadingState<PageResult<OfficePartnerListItem>>();

    try {
      const page = await props.client.listPartners({
        workspaceId: props.workspaceId,
        period: props.period,
        dateFrom: props.dateFrom,
        dateTo: props.dateTo,
        facet: props.facet,
        cursor: null,
        limit: 50
      });
      partnersState = createSuccessState<PageResult<OfficePartnerListItem>>(page);
    } catch (error: unknown) {
      partnersState = createErrorState<PageResult<OfficePartnerListItem>>(error);
    }
  }

  async function openPartner(partnerId: EntityId): Promise<void> {
    selectedPartnerId = partnerId;
    drawerMode = "detail";
    detailState = createLoadingState<OfficePartnerDetail>();
    actionMessage = "Loading full partner relationship.";

    try {
      const [record, pnl, suggestions, payeeLink] = await Promise.all([
        props.client.getPartnerRecord(partnerId, {
          workspaceId: props.workspaceId
        }),
        props.client.getPartnerPnl(partnerId, {
          workspaceId: props.workspaceId,
          period: props.period,
          dateFrom: props.dateFrom,
          dateTo: props.dateTo
        }),
        props.client.listPartnerClassificationSuggestions(partnerId, {
          workspaceId: props.workspaceId
        }),
        props.client.getPartnerPayeeLink(partnerId, {
          workspaceId: props.workspaceId,
          period: props.period
        })
      ]);
      const detailWithLink: OfficePartnerDetail = {
        id: record.id,
        name: record.name,
        status: record.status,
        email: record.email,
        phone: record.phone,
        address: record.address,
        taxId: record.taxId,
        notes: record.notes,
        activity: pnl.activity,
        distributionPayeeLink: payeeLink,
        classificationSuggestions: suggestions
      };
      detailState = createSuccessState<OfficePartnerDetail>(detailWithLink);
      partnerForm = createFormStateFromDetail(detailWithLink);
      linkPayeeId = payeeLink.payeeId ?? "";
      actionMessage = "Full relationship loaded.";
    } catch (error: unknown) {
      detailState = createErrorState<OfficePartnerDetail>(error);
      actionMessage = "Partner detail unavailable.";
    }
  }

  function openCreateDrawer(): void {
    selectedPartnerId = null;
    drawerMode = "create";
    detailState = createIdleState<OfficePartnerDetail>();
    partnerForm = emptyFormState;
    linkPayeeId = "";
    actionMessage = "Create a unified partner record. The client/supplier lenses remain derived from transactions.";
  }

  function openEditDrawer(): void {
    if (selectedPartner === null) {
      return;
    }

    drawerMode = "edit";
    partnerForm = createFormStateFromDetail(selectedPartner);
    actionMessage = "Editing partner details. Activity sides remain derived.";
  }

  function closeDrawer(): void {
    drawerMode = "closed";
    selectedPartnerId = null;
    detailState = createIdleState<OfficePartnerDetail>();
    actionMessage = "Select a partner to see the full relationship.";
  }

  async function submitPartnerForm(): Promise<void> {
    const request = createPartnerWriteRequest(partnerForm, props.workspaceId);
    linkStatus = "loading";

    try {
      if (drawerMode === "create") {
        const receipt = await props.client.createPartner(request, {
          idempotencyKey: createIdempotencyKey("partner-create")
        });
        props.onReceipt(receipt);
        actionMessage = "Partner create request accepted.";
      } else if (selectedPartnerId !== null) {
        const receipt = await props.client.updatePartner(selectedPartnerId, request, {
          idempotencyKey: createIdempotencyKey("partner-update")
        });
        props.onReceipt(receipt);
        actionMessage = "Partner update request accepted.";
      }

      linkStatus = "success";
      await loadPartners();
    } catch (error: unknown) {
      linkStatus = "error";
      actionMessage = getErrorMessage(error);
    }
  }

  async function linkPartnerPayee(): Promise<void> {
    if (selectedPartnerId === null) {
      return;
    }

    linkStatus = "loading";
    try {
      const receipt = await props.client.linkPartnerPayee(
        selectedPartnerId,
        {
          workspaceId: props.workspaceId,
          payeeId: linkPayeeId.length > 0 ? linkPayeeId : null
        },
        {
          idempotencyKey: createIdempotencyKey("partner-payee-link")
        }
      );
      props.onReceipt(receipt);
      linkStatus = "success";
      actionMessage = "Distribution payee link request accepted.";
    } catch (error: unknown) {
      linkStatus = "error";
      actionMessage = getErrorMessage(error);
    }
  }

  async function unlinkPartnerPayee(): Promise<void> {
    if (selectedPartnerId === null) {
      return;
    }

    linkStatus = "loading";
    try {
      const receipt = await props.client.unlinkPartnerPayee(
        selectedPartnerId,
        {
          workspaceId: props.workspaceId,
          payeeId: null
        },
        {
          idempotencyKey: createIdempotencyKey("partner-payee-unlink")
        }
      );
      props.onReceipt(receipt);
      linkStatus = "success";
      actionMessage = "Distribution payee unlink request accepted.";
    } catch (error: unknown) {
      linkStatus = "error";
      actionMessage = getErrorMessage(error);
    }
  }

  function updateName(event: Event): void {
    partnerForm = { ...partnerForm, name: readInputValue(event) };
  }

  function updateEmail(event: Event): void {
    partnerForm = { ...partnerForm, email: readInputValue(event) };
  }

  function updatePhone(event: Event): void {
    partnerForm = { ...partnerForm, phone: readInputValue(event) };
  }

  function updateAddress(event: Event): void {
    partnerForm = { ...partnerForm, address: readInputValue(event) };
  }

  function updateTaxId(event: Event): void {
    partnerForm = { ...partnerForm, taxId: readInputValue(event) };
  }

  function updateNotes(event: Event): void {
    partnerForm = { ...partnerForm, notes: readTextAreaValue(event) };
  }

  function updateActive(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      throw new Error("Partner active input event target is not an input.");
    }

    partnerForm = { ...partnerForm, active: target.checked };
  }

  function updateLinkPayeeId(event: Event): void {
    linkPayeeId = readInputValue(event);
  }

  function submitPartnerFormEvent(event: SubmitEvent): void {
    event.preventDefault();
    void submitPartnerForm();
  }

  function readPartnerItems(state: ApiRequestState<PageResult<OfficePartnerListItem>>): readonly OfficePartnerListItem[] {
    if (state.status === "success") {
      return state.data.items;
    }

    return [];
  }

  function readPartnerDetail(state: ApiRequestState<OfficePartnerDetail>): OfficePartnerDetail | null {
    if (state.status === "success") {
      return state.data;
    }

    return null;
  }

  function createFacetCopy(facet: OfficePartnerFacet): FacetCopy {
    if (facet === "client") {
      return {
        title: "Clients",
        subtitle: "Income-side lens over the same partners resource.",
        tableTitle: "Client-side activity",
        amountLabel: "Period income",
        balanceLabel: "Receivable",
        alsoLabel: "also supplier",
        emptyLabel: "No partners have income-side activity in this period.",
        drawerContext: "Opened from Clients"
      };
    }

    return {
      title: "Suppliers",
      subtitle: "Expense-side lens over the same partners resource.",
      tableTitle: "Supplier-side activity",
      amountLabel: "Period expense",
      balanceLabel: "Payable",
      alsoLabel: "also client",
      emptyLabel: "No partners have expense-side activity in this period.",
      drawerContext: "Opened from Suppliers"
    };
  }

  function createFormStateFromDetail(partner: OfficePartnerDetail): PartnerFormState {
    return {
      name: partner.name,
      email: partner.email ?? "",
      phone: partner.phone ?? "",
      address: partner.address ?? "",
      taxId: partner.taxId ?? "",
      notes: partner.notes ?? "",
      active: partner.status === "active"
    };
  }

  function createPartnerWriteRequest(form: PartnerFormState, workspaceId: string): OfficePartnerWriteRequest {
    return {
      workspaceId,
      name: form.name,
      email: toNullableText(form.email),
      phone: toNullableText(form.phone),
      address: toNullableText(form.address),
      taxId: toNullableText(form.taxId),
      notes: toNullableText(form.notes),
      active: form.active
    };
  }

  function toNullableText(value: string): string | null {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return null;
    }

    return trimmed;
  }

  function facetActivity(partner: OfficePartnerListItem): OfficePartnerSideActivity {
    if (props.facet === "client") {
      return partner.activity.income;
    }

    return partner.activity.expense;
  }

  function alsoActivity(partner: OfficePartnerListItem): OfficePartnerSideActivity {
    if (props.facet === "client") {
      return partner.activity.expense;
    }

    return partner.activity.income;
  }

  function lastActivityLabel(partner: OfficePartnerListItem): string {
    const side = facetActivity(partner);

    if (side.lastActivityOn === null) {
      return "No activity";
    }

    return formatDateOnly(side.lastActivityOn);
  }

  function hasAlsoActivity(partner: OfficePartnerListItem): boolean {
    return moneySignForValue(alsoActivity(partner).periodTotalMicro) !== 0;
  }

  function netTone(value: string): Tone {
    return moneyToneForValue(value);
  }

  function suggestionTone(type: "income" | "expense"): Tone {
    if (type === "income") {
      return "success";
    }

    return "warning";
  }

  function formatMoneyMicro(amountMicro: string): string {
    return formatMoneyValue(amountMicro, currency);
  }

  function formatConfidence(confidenceBp: number): string {
    const whole = Math.floor(confidenceBp / 100);
    const fraction = String(confidenceBp % 100).padStart(2, "0");

    return `${whole}.${fraction}%`;
  }

  function payeeLinkLabel(link: OfficePartnerPayeeLink | null): string {
    if (link === null || link.payeeId === null) {
      return "No Distribution payee linked";
    }

    return `${link.payeeName ?? "Distribution payee"} · ${link.resolution}`;
  }

  function createIdempotencyKey(scope: string): string {
    return `office-${scope}-${Date.now().toString(36)}`;
  }

  function readInputValue(event: Event): string {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      throw new Error("Partner input event target is not an input.");
    }

    return target.value;
  }

  function readTextAreaValue(event: Event): string {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) {
      throw new Error("Partner textarea event target is not a textarea.");
    }

    return target.value;
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return "Partner action failed.";
  }

  function writeDisabledTitle(): string {
    return writesEnabled ? "" : "enable writes";
  }
</script>

<section class="partners-view">
  <header class="partners-head ehq-edge-surface">
    <div>
      <p>{copy.drawerContext}</p>
      <h2>{copy.title}</h2>
      <span>{copy.subtitle}</span>
    </div>
    <button class="head-action" type="button" disabled={!writesEnabled} title={writeDisabledTitle()} onclick={openCreateDrawer}>Create partner</button>
  </header>

  <div class="partners-layout">
    <section class="partners-table ehq-edge-surface" aria-label={copy.tableTitle}>
      <header>
        <div>
          <p>{copy.tableTitle}</p>
          <strong>{partners.length} visible</strong>
        </div>
        <button type="button" onclick={loadPartners}>Refresh</button>
      </header>

      {#if partnersState.status === "loading"}
        <Loader label="Loading partners" detail="Reading partner activity sides." size="medium" />
      {:else if partnersState.status === "error"}
        <div class="empty-state error-state">
          <strong>Partners unavailable</strong>
          <span>{getErrorMessage(partnersState.error)}</span>
        </div>
      {:else if partners.length === 0}
        <div class="empty-state">
          <strong>No activity</strong>
          <span>{copy.emptyLabel}</span>
        </div>
      {:else}
        <div class="table-frame">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th class="right">{copy.amountLabel}</th>
                <th class="right">{copy.balanceLabel}</th>
                <th>Last activity</th>
                <th>Other side</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each partners as partner (partner.id)}
                <tr>
                  <td>
                    <button class="partner-row-button" type="button" onclick={() => openPartner(partner.id)}>
                      {partner.name}
                    </button>
                  </td>
                  <td class="right money">{formatMoneyMicro(facetActivity(partner).periodTotalMicro)}</td>
                  <td class="right money">{formatMoneyMicro(facetActivity(partner).openBalanceMicro)}</td>
                  <td>{lastActivityLabel(partner)}</td>
                  <td>
                    {#if hasAlsoActivity(partner)}
                      <Badge label={copy.alsoLabel} tone="info" />
                    {:else}
                      <span class="muted">—</span>
                    {/if}
                  </td>
                  <td><Badge label={partner.status} tone={partner.status === "active" ? "success" : "muted"} /></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <aside class="partner-drawer ehq-edge-surface" class:open={drawerOpen} aria-label="Partner relationship drawer">
      {#if drawerMode === "closed"}
        <div class="drawer-empty">
          <strong>Select a partner</strong>
          <span>Clients and suppliers are two lenses over the same partner record.</span>
        </div>
      {:else if detailState.status === "loading"}
        <Loader label="Loading partner" detail="Reading income and expense sides." size="medium" />
      {:else if detailState.status === "error"}
        <div class="drawer-empty error-state">
          <strong>Partner unavailable</strong>
          <span>{getErrorMessage(detailState.error)}</span>
          <button type="button" onclick={closeDrawer}>Close</button>
        </div>
      {:else}
        <header class="drawer-head">
          <div>
            <p>{drawerMode === "create" ? "Unified partner" : copy.drawerContext}</p>
            <h3>{drawerMode === "create" ? "New partner" : selectedPartner?.name}</h3>
          </div>
          <button type="button" onclick={closeDrawer}>Close</button>
        </header>

        {#if selectedPartner !== null && drawerMode !== "create"}
          <section class="side-grid" aria-label="Full relationship sides">
            <article class="ehq-edge-surface">
              <p>Client side</p>
              <strong>{formatMoneyMicro(selectedPartner.activity.income.periodTotalMicro)}</strong>
              <span>Receivable {formatMoneyMicro(selectedPartner.activity.income.openBalanceMicro)}</span>
            </article>
            <article class="ehq-edge-surface">
              <p>Supplier side</p>
              <strong>{formatMoneyMicro(selectedPartner.activity.expense.periodTotalMicro)}</strong>
              <span>Payable {formatMoneyMicro(selectedPartner.activity.expense.openBalanceMicro)}</span>
            </article>
            <article class="net-card ehq-edge-surface">
              <p>Net relationship</p>
              <strong class={`tone-${netTone(selectedPartner.activity.netMicro)}`}>{formatMoneyMicro(selectedPartner.activity.netMicro)}</strong>
              <span>Income minus expense for {props.period}</span>
            </article>
          </section>

          <section class="suggestions ehq-edge-surface" aria-label="Classification suggestions">
            <p>Classification suggestions</p>
            {#each selectedPartner.classificationSuggestions as suggestion (suggestion.id)}
              <div>
                <span>{suggestion.categoryLabel}</span>
                <Badge label={`${suggestion.type} · ${formatConfidence(suggestion.confidenceBp)}`} tone={suggestionTone(suggestion.type)} />
              </div>
            {/each}
          </section>

          <section class="link-panel ehq-edge-surface" aria-label="Distribution payee link">
            <p>Distribution payee link</p>
            <strong>{payeeLinkLabel(selectedPartner.distributionPayeeLink)}</strong>
            <label>
              <span>Payee id</span>
              <input value={linkPayeeId} oninput={updateLinkPayeeId} placeholder="payee_..." />
            </label>
            <div class="drawer-actions">
              <button type="button" disabled={linkStatus === "loading" || !writesEnabled} title={writeDisabledTitle()} onclick={linkPartnerPayee}>Idempotent link</button>
              <button type="button" disabled={linkStatus === "loading" || !writesEnabled} title={writeDisabledTitle()} onclick={unlinkPartnerPayee}>Idempotent unlink</button>
            </div>
          </section>
        {/if}

        {#if drawerMode === "detail" && selectedPartner !== null}
          <div class="drawer-actions">
            <button type="button" disabled={!writesEnabled} title={writeDisabledTitle()} onclick={openEditDrawer}>Edit partner</button>
          </div>
        {/if}

        {#if drawerMode === "create" || drawerMode === "edit"}
          <form class="partner-form ehq-edge-surface" onsubmit={submitPartnerFormEvent}>
            <label>
              <span>Name</span>
              <input value={partnerForm.name} oninput={updateName} />
            </label>
            <label>
              <span>Email</span>
              <input value={partnerForm.email} oninput={updateEmail} />
            </label>
            <label>
              <span>Phone</span>
              <input value={partnerForm.phone} oninput={updatePhone} />
            </label>
            <label>
              <span>Address</span>
              <input value={partnerForm.address} oninput={updateAddress} />
            </label>
            <label>
              <span>Tax id</span>
              <input value={partnerForm.taxId} oninput={updateTaxId} />
            </label>
            <label>
              <span>Notes</span>
              <textarea value={partnerForm.notes} oninput={updateNotes}></textarea>
            </label>
            <label class="check-row">
              <input type="checkbox" checked={partnerForm.active} onchange={updateActive} />
              <span>Active partner</span>
            </label>
            <div class="drawer-actions">
              <button type="submit" disabled={linkStatus === "loading" || !writesEnabled} title={writeDisabledTitle()}>{drawerMode === "create" ? "Create partner" : "Save partner"}</button>
            </div>
          </form>
        {/if}

        <p class="action-message" role="status">{actionMessage}</p>
      {/if}
    </aside>
  </div>
</section>

<style>
  .partners-view {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-4);
  }

  .partners-head,
  .partners-table > header,
  .drawer-head,
  .drawer-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-3);
  }

  .partners-head {
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
  }

  .partners-layout {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.42fr);
    gap: var(--ehq-space-4);
    align-items: start;
  }

  .partners-table,
  .partner-drawer {
    min-width: 0;
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    overflow: visible;
  }

  .partners-table > header {
    padding: var(--ehq-space-3);
    border-bottom: 1px solid var(--ehq-border-soft);
  }

  .table-frame {
    width: 100%;
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 720px;
    border-collapse: collapse;
  }

  th,
  td {
    padding: var(--ehq-space-3);
    border-bottom: 1px solid var(--ehq-border-soft);
    text-align: left;
    vertical-align: middle;
  }

  th {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    text-transform: uppercase;
  }

  tr:last-child td {
    border-bottom: 0;
  }

  p,
  h2,
  h3,
  strong {
    margin: 0;
  }

  p,
  label span,
  .muted,
  .action-message {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    text-transform: uppercase;
  }

  h2 {
    margin-top: var(--ehq-space-1);
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  h3 {
    margin-top: var(--ehq-space-1);
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .partners-head span,
  .empty-state span,
  .drawer-empty span,
  .side-grid span,
  .link-panel strong {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-body-weight);
    line-height: var(--ehq-type-ui-line);
  }

  .right {
    text-align: right;
  }

  .money,
  .tone-success,
  .tone-error,
  .tone-muted {
    font-family: var(--ehq-font);
    font-weight: var(--ehq-type-figure-weight);
    font-variant-numeric: tabular-nums;
  }

  .tone-success {
    color: var(--ehq-success);
  }

  .tone-error {
    color: var(--ehq-error);
  }

  .tone-muted {
    color: var(--ehq-text-muted);
  }

  .partner-row-button,
  button,
  input,
  textarea {
    font: inherit;
  }

  button,
  .partner-row-button {
    min-height: 34px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-action-size);
    font-weight: var(--ehq-type-heading-weight);
    text-transform: uppercase;
  }

  button:hover,
  .partner-row-button:hover {
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  button:disabled {
    color: var(--ehq-text-disabled);
    cursor: not-allowed;
  }

  .partner-row-button {
    width: 100%;
    justify-content: flex-start;
    text-align: left;
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-body-weight);
    text-transform: none;
  }

  .head-action {
    border-color: var(--ehq-yellow);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
  }

  .empty-state,
  .drawer-empty {
    min-height: 220px;
    padding: var(--ehq-space-5);
    display: grid;
    place-items: center;
    gap: var(--ehq-space-2);
    text-align: center;
  }

  .error-state strong {
    color: var(--ehq-error);
  }

  .partner-drawer {
    padding: var(--ehq-space-4);
    display: grid;
    gap: var(--ehq-space-4);
  }

  .side-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  .side-grid article,
  .suggestions,
  .link-panel,
  .partner-form {
    min-width: 0;
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    gap: var(--ehq-space-2);
  }

  .net-card {
    grid-column: 1 / -1;
  }

  .suggestions div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-2);
  }

  label {
    display: grid;
    gap: var(--ehq-space-1);
  }

  input,
  textarea {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface);
    color: var(--ehq-text);
  }

  input {
    min-height: 36px;
    padding: 0 var(--ehq-space-3);
  }

  textarea {
    min-height: 80px;
    padding: var(--ehq-space-3);
    resize: vertical;
  }

  .check-row {
    display: flex;
    align-items: center;
    gap: var(--ehq-space-2);
  }

  .check-row input {
    width: 16px;
    min-height: 16px;
  }

  @media (max-width: 980px) {
    .partners-layout {
      grid-template-columns: 1fr;
    }

    .side-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 680px) {
    .partners-head,
    .partners-table > header,
    .drawer-head,
    .drawer-actions,
    .suggestions div {
      align-items: stretch;
      flex-direction: column;
    }

    table {
      min-width: 640px;
    }
  }
</style>
