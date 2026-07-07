<script lang="ts">
  import {
    Badge,
    Button,
    Drawer,
    EmptyState,
    Input,
    KPI,
    Loader,
    Table,
    type TableColumn,
    type TablePagination,
    type TableRow,
    type TableRowAction,
    type Tone
  } from "@ehq/ui";
  import {
    beginReload,
    createLoadingState,
    createErrorState,
    createIdleState,
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
  import { createTablePagination, loadPageResult, readPageItems, TABLE_PAGE_SIZE, type PageLoadMode } from "../../table-pagination.js";
  import { untrack } from "svelte";

  type DrawerMode = "closed" | "detail" | "create" | "edit";
  type RequestStatus = "idle" | "loading" | "success" | "error";
  type PayeeLinkAction = "link" | "unlink";

  interface Props {
    readonly facet: OfficePartnerFacet;
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly writesEnabled: boolean;
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
  let formStatus = $state<RequestStatus>("idle");
  let payeeLinkStatus = $state<RequestStatus>("idle");
  // Which payee action is in flight, so only the triggering button spins.
  let payeeLinkAction = $state<PayeeLinkAction | null>(null);
  // Drawer-level status line; form and payee-link outcomes have their own
  // messages rendered next to the action they belong to.
  let actionMessage = $state<string>("Select a partner to see the full relationship.");
  let formMessage = $state<string | null>(null);
  let payeeLinkMessage = $state<string | null>(null);
  let partnersLoadingMore = $state(false);
  let partnersLoadMoreError = $state<string | null>(null);

  const copy = $derived(createFacetCopy(props.facet));
  const partners = $derived(readPageItems(partnersState));
  const selectedPartner = $derived(readPartnerDetail(detailState));
  const partnerTableRows = $derived(createPartnerTableRows(partners, copy));
  const partnerRowActions = $derived<readonly TableRowAction[]>([
    { label: "Open", onAction: openPartner }
  ]);
  const partnersPagination = $derived<TablePagination | null>(
    createTablePagination(partnersState, partnersLoadingMore, partnersLoadMoreError, loadMorePartners, loadAllPartners)
  );
  // Drawer footer wiring: the DS Drawer owns the primary/secondary actions, so
  // the mode-dependent submit ("Edit partner" vs create/update) is derived here.
  const drawerTitle = $derived(drawerMode === "create" ? "New partner" : selectedPartner?.name ?? "Partner");
  const drawerBadgeLabel = $derived(drawerMode === "create" ? "new" : selectedPartner?.status ?? "");
  const drawerBadgeTone = $derived<Tone>(
    drawerMode === "create" ? "info" : selectedPartner?.status === "active" ? "success" : "muted"
  );
  const drawerPrimaryLabel = $derived(createDrawerPrimaryLabel(drawerMode, formStatus));
  const drawerPrimaryDisabled = $derived(
    drawerMode === "detail"
      ? !props.writesEnabled || detailState.status !== "success"
      : !props.writesEnabled || formStatus === "loading"
  );
  const drawerPrimaryTitle = $derived(createDrawerPrimaryTitle());

  function createDrawerPrimaryLabel(mode: DrawerMode, status: RequestStatus): string {
    if (mode === "detail") {
      return "Edit partner";
    }

    if (status === "loading") {
      return "Saving…";
    }

    return mode === "create" ? "Create partner" : "Save partner";
  }

  function createDrawerPrimaryTitle(): string {
    if (drawerMode === "detail") {
      if (!props.writesEnabled) {
        return writeDisabledTitle();
      }

      if (detailState.status !== "success") {
        return "Partner detail unavailable.";
      }

      return "";
    }

    return writeActionTitle(formStatus);
  }

  // $effect (not onMount): re-runs on props.workspaceId/period/dateFrom/dateTo/
  // facet change (all read synchronously inside loadPartners).
  $effect((): void => {
    void loadPartners();
  });

  // Sequence token: discard a stale response if a newer loadPartners() call
  // started before this one's request resolves (out-of-order network replies).
  let loadPartnersToken = 0;

  async function loadPartners(): Promise<void> {
    const token = ++loadPartnersToken;
    untrack((): void => {
      partnersState = beginReload<PageResult<OfficePartnerListItem>>(partnersState);
    });

    try {
      const page = await props.client.listPartners({
        workspaceId: props.workspaceId,
        period: props.period,
        dateFrom: props.dateFrom,
        dateTo: props.dateTo,
        facet: props.facet,
        cursor: null,
        limit: TABLE_PAGE_SIZE
      });
      if (token !== loadPartnersToken) {
        return;
      }
      partnersState = createSuccessState<PageResult<OfficePartnerListItem>>(page);
      partnersLoadMoreError = null;
    } catch (error: unknown) {
      if (token !== loadPartnersToken) {
        return;
      }
      partnersState = createErrorState<PageResult<OfficePartnerListItem>>(error);
    }
  }

  async function openPartner(partnerId: EntityId): Promise<void> {
    selectedPartnerId = partnerId;
    drawerMode = "detail";
    formStatus = "idle";
    payeeLinkStatus = "idle";
    formMessage = null;
    payeeLinkMessage = null;
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
    formStatus = "idle";
    payeeLinkStatus = "idle";
    formMessage = null;
    payeeLinkMessage = null;
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
    formStatus = "idle";
    formMessage = null;
    partnerForm = createFormStateFromDetail(selectedPartner);
    actionMessage = "Editing partner details. Activity sides remain derived.";
  }

  function closeDrawer(): void {
    drawerMode = "closed";
    selectedPartnerId = null;
    formStatus = "idle";
    payeeLinkStatus = "idle";
    formMessage = null;
    payeeLinkMessage = null;
    detailState = createIdleState<OfficePartnerDetail>();
    actionMessage = "Select a partner to see the full relationship.";
  }

  async function submitPartnerForm(): Promise<void> {
    if (formStatus === "loading") {
      return;
    }

    const request = createPartnerWriteRequest(partnerForm, props.workspaceId);
    formStatus = "loading";
    formMessage = null;

    try {
      if (drawerMode === "create") {
        const receipt = await props.client.createPartner(request, {
          idempotencyKey: createIdempotencyKey("partner-create")
        });
        props.onReceipt(receipt);
        // receipt.id is the created partner id. openPartner flips the drawer
        // to the detail view synchronously, unmounting the create form so a
        // second click cannot re-create the partner under a fresh
        // idempotency key.
        await openPartner(receipt.id);
        actionMessage = "Partner create request accepted.";
        await loadPartners();
        return;
      }

      if (selectedPartnerId === null) {
        formStatus = "idle";
        return;
      }

      const receipt = await props.client.updatePartner(selectedPartnerId, request, {
        idempotencyKey: createIdempotencyKey("partner-update")
      });
      props.onReceipt(receipt);
      // Keep the status at "loading" through the list reload so the submit
      // button stays disabled until the refreshed data is visible.
      await loadPartners();
      formStatus = "success";
      formMessage = "Partner update request accepted.";
    } catch (error: unknown) {
      formStatus = "error";
      formMessage = getErrorMessage(error);
    }
  }

  async function linkPartnerPayee(): Promise<void> {
    if (selectedPartnerId === null || payeeLinkStatus === "loading") {
      return;
    }

    payeeLinkStatus = "loading";
    payeeLinkAction = "link";
    payeeLinkMessage = null;
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
      payeeLinkStatus = "success";
      payeeLinkMessage = "Distribution payee link request accepted.";
    } catch (error: unknown) {
      payeeLinkStatus = "error";
      payeeLinkMessage = getErrorMessage(error);
    } finally {
      // The action marker only exists to target the right button's spinner
      // while loading; clear it so no stale state survives the attempt.
      payeeLinkAction = null;
    }
  }

  async function unlinkPartnerPayee(): Promise<void> {
    if (selectedPartnerId === null || payeeLinkStatus === "loading") {
      return;
    }

    payeeLinkStatus = "loading";
    payeeLinkAction = "unlink";
    payeeLinkMessage = null;
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
      payeeLinkStatus = "success";
      payeeLinkMessage = "Distribution payee unlink request accepted.";
    } catch (error: unknown) {
      payeeLinkStatus = "error";
      payeeLinkMessage = getErrorMessage(error);
    } finally {
      payeeLinkAction = null;
    }
  }

  function updateName(value: string): void {
    partnerForm = { ...partnerForm, name: value };
  }

  function updateEmail(value: string): void {
    partnerForm = { ...partnerForm, email: value };
  }

  function updatePhone(value: string): void {
    partnerForm = { ...partnerForm, phone: value };
  }

  function updateAddress(value: string): void {
    partnerForm = { ...partnerForm, address: value };
  }

  function updateTaxId(value: string): void {
    partnerForm = { ...partnerForm, taxId: value };
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

  function updateLinkPayeeId(value: string): void {
    linkPayeeId = value;
  }

  function submitPartnerFormEvent(event: SubmitEvent): void {
    event.preventDefault();
    void submitPartnerForm();
  }

  async function loadMorePartners(): Promise<void> {
    await loadPartnersPage("one");
  }

  async function loadAllPartners(): Promise<void> {
    await loadPartnersPage("all");
  }

  async function loadPartnersPage(mode: PageLoadMode): Promise<void> {
    await loadPageResult(mode, {
      state: partnersState,
      loading: partnersLoadingMore,
      setLoading: (loading: boolean): void => {
        partnersLoadingMore = loading;
      },
      setError: (error: string | null): void => {
        partnersLoadMoreError = error;
      },
      setState: (state: ApiRequestState<PageResult<OfficePartnerListItem>>): void => {
        partnersState = state;
      },
      fetchPage: (cursor: string): Promise<PageResult<OfficePartnerListItem>> =>
        props.client.listPartners({
          workspaceId: props.workspaceId,
          period: props.period,
          dateFrom: props.dateFrom,
          dateTo: props.dateTo,
          facet: props.facet,
          cursor,
          limit: TABLE_PAGE_SIZE
        })
    });
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

  function createPartnerTableRows(
    rows: readonly OfficePartnerListItem[],
    facetCopy: FacetCopy
  ): readonly TableRow[] {
    return rows.map((partner: OfficePartnerListItem): TableRow => ({
      id: partner.id,
      cells: [
        { kind: "text", value: partner.name, strong: false },
        { kind: "money", value: formatMoneyMicro(facetActivity(partner).periodTotalMicro), tone: netTone(facetActivity(partner).periodTotalMicro) },
        { kind: "money", value: formatMoneyMicro(facetActivity(partner).openBalanceMicro), tone: netTone(facetActivity(partner).openBalanceMicro) },
        { kind: "text", value: lastActivityLabel(partner), strong: false },
        { kind: "badge", value: hasAlsoActivity(partner) ? facetCopy.alsoLabel : "—", tone: hasAlsoActivity(partner) ? "info" : "muted" },
        { kind: "badge", value: partner.status, tone: partner.status === "active" ? "success" : "muted" }
      ]
    }));
  }

  function partnerColumns(facetCopy: FacetCopy): readonly TableColumn[] {
    return [
      { label: "Name", align: "left", sortable: true },
      { label: facetCopy.amountLabel, align: "right", sortable: true },
      { label: facetCopy.balanceLabel, align: "right", sortable: true },
      { label: "Last activity", align: "left", sortable: true },
      { label: "Other side", align: "left", sortable: true },
      { label: "Status", align: "left", sortable: true }
    ];
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
    return props.writesEnabled ? "" : "enable writes";
  }

  function writeActionTitle(status: RequestStatus): string {
    if (!props.writesEnabled) {
      return "enable writes";
    }

    if (status === "loading") {
      return "request in progress";
    }

    return "";
  }
</script>

<section class="partners-view">
  <header class="partners-head ehq-edge-surface">
    <div>
      <p>{copy.drawerContext}</p>
      <h2>{copy.title}</h2>
      <span>{copy.subtitle}</span>
    </div>
    <Button
      label="Create partner"
      variant="primary"
      size="medium"
      type="button"
      disabled={!props.writesEnabled}
      loading={false}
      locked={false}
      focus={false}
      ariaLabel="Create partner"
      title={writeDisabledTitle()}
      onclick={openCreateDrawer}
    />
  </header>

  <div class="partners-layout">
    <section class="partners-list" aria-label={copy.tableTitle}>
      <header class="partners-toolbar ehq-edge-surface">
        <div>
          <p>{copy.tableTitle}</p>
          <strong>{partners.length} visible</strong>
        </div>
        <Button
          label="Refresh"
          variant="secondary"
          size="small"
          type="button"
          disabled={false}
          loading={false}
          locked={false}
          focus={false}
          ariaLabel="Refresh partners"
          onclick={loadPartners}
        />
      </header>

      <Table
        title={copy.tableTitle}
        columns={partnerColumns(copy)}
        rows={partnerTableRows}
        state={partnersState.status === "loading" ? "loading" : partnersState.status === "error" ? "error" : partnerTableRows.length === 0 ? "empty" : "default"}
        actionLabel=""
        rowActions={partnerRowActions}
        pagination={partnersPagination}
      />
    </section>

    <aside class="partner-drawer" aria-label="Partner relationship drawer">
      {#if drawerMode === "closed"}
        <EmptyState
          title="Select a partner"
          detail="Clients and suppliers are two lenses over the same partner record."
          state="empty"
          actionLabel=""
          actionHref={null}
          disabledReason=""
        />
      {:else}
        <Drawer
          open={true}
          title={drawerTitle}
          badgeLabel={drawerBadgeLabel}
          badgeTone={drawerBadgeTone}
          body=""
          primaryAction={drawerPrimaryLabel}
          secondaryAction="Close"
          state={detailState.status === "error" ? "error" : "default"}
          primaryDisabled={drawerPrimaryDisabled}
          primaryTitle={drawerPrimaryTitle}
          onPrimary={drawerMode === "detail" ? openEditDrawer : submitPartnerForm}
          onSecondary={closeDrawer}
        >
          {#snippet content()}
            {#if detailState.status === "loading"}
              <Loader label="Loading partner" detail="Reading income and expense sides." size="medium" />
            {:else if detailState.status === "error"}
              <div class="drawer-empty error-state">
                <strong>Partner unavailable</strong>
                <span>{getErrorMessage(detailState.error)}</span>
              </div>
            {:else}
              {#if selectedPartner !== null && drawerMode !== "create"}
                <section class="side-grid" aria-label="Full relationship sides">
                  <KPI
                    label="Client side"
                    value={formatMoneyMicro(selectedPartner.activity.income.periodTotalMicro)}
                    detail={`Receivable ${formatMoneyMicro(selectedPartner.activity.income.openBalanceMicro)}`}
                    tone="muted"
                    state="default"
                    accent={false}
                  />
                  <KPI
                    label="Supplier side"
                    value={formatMoneyMicro(selectedPartner.activity.expense.periodTotalMicro)}
                    detail={`Payable ${formatMoneyMicro(selectedPartner.activity.expense.openBalanceMicro)}`}
                    tone="muted"
                    state="default"
                    accent={false}
                  />
                  <div class="net-card">
                    <KPI
                      label="Net relationship"
                      value={formatMoneyMicro(selectedPartner.activity.netMicro)}
                      detail={`Income minus expense for ${props.period}`}
                      tone={netTone(selectedPartner.activity.netMicro)}
                      state="default"
                      accent={false}
                    />
                  </div>
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
                  <Input
                    id="partner-link-payee-id"
                    label="Payee id"
                    value={linkPayeeId}
                    placeholder="payee_..."
                    type="text"
                    state="default"
                    message=""
                    oninput={updateLinkPayeeId}
                  />
                  <div class="drawer-actions">
                    <Button
                      label="Idempotent link"
                      variant="secondary"
                      size="small"
                      type="button"
                      disabled={payeeLinkStatus === "loading" || !props.writesEnabled}
                      loading={payeeLinkStatus === "loading" && payeeLinkAction === "link"}
                      locked={false}
                      focus={false}
                      ariaLabel="Link Distribution payee"
                      title={writeActionTitle(payeeLinkStatus)}
                      onclick={linkPartnerPayee}
                    />
                    <Button
                      label="Idempotent unlink"
                      variant="secondary"
                      size="small"
                      type="button"
                      disabled={payeeLinkStatus === "loading" || !props.writesEnabled}
                      loading={payeeLinkStatus === "loading" && payeeLinkAction === "unlink"}
                      locked={false}
                      focus={false}
                      ariaLabel="Unlink Distribution payee"
                      title={writeActionTitle(payeeLinkStatus)}
                      onclick={unlinkPartnerPayee}
                    />
                  </div>
                  {#if payeeLinkMessage !== null}
                    <p class="outcome-message" class:error={payeeLinkStatus === "error"} role="status">{payeeLinkMessage}</p>
                  {/if}
                </section>
              {/if}

              {#if drawerMode === "create" || drawerMode === "edit"}
                <!-- The visible submit control lives in the Drawer footer
                     (type="button"). Implicit Enter-to-submit needs a real
                     submit control inside the form, hence the off-screen one. -->
                <form class="partner-form ehq-edge-surface" onsubmit={submitPartnerFormEvent}>
                  <input class="submit-proxy" type="submit" value="Save partner" tabindex="-1" aria-hidden="true" />
                  <Input
                    id="partner-form-name"
                    label="Name"
                    value={partnerForm.name}
                    placeholder=""
                    type="text"
                    state="default"
                    message=""
                    oninput={updateName}
                  />
                  <Input
                    id="partner-form-email"
                    label="Email"
                    value={partnerForm.email}
                    placeholder=""
                    type="text"
                    state="default"
                    message=""
                    oninput={updateEmail}
                  />
                  <Input
                    id="partner-form-phone"
                    label="Phone"
                    value={partnerForm.phone}
                    placeholder=""
                    type="text"
                    state="default"
                    message=""
                    oninput={updatePhone}
                  />
                  <Input
                    id="partner-form-address"
                    label="Address"
                    value={partnerForm.address}
                    placeholder=""
                    type="text"
                    state="default"
                    message=""
                    oninput={updateAddress}
                  />
                  <Input
                    id="partner-form-tax-id"
                    label="Tax id"
                    value={partnerForm.taxId}
                    placeholder=""
                    type="text"
                    state="default"
                    message=""
                    oninput={updateTaxId}
                  />
                  <label>
                    <span>Notes</span>
                    <textarea value={partnerForm.notes} oninput={updateNotes}></textarea>
                  </label>
                  <label class="check-row">
                    <input type="checkbox" checked={partnerForm.active} onchange={updateActive} />
                    <span>Active partner</span>
                  </label>
                  {#if formMessage !== null}
                    <p class="outcome-message" class:error={formStatus === "error"} role="status">{formMessage}</p>
                  {/if}
                </form>
              {/if}

              <p class="action-message" role="status">{actionMessage}</p>
            {/if}
          {/snippet}
        </Drawer>
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
  .partners-toolbar,
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

  .partners-list,
  .partner-drawer {
    min-width: 0;
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    overflow: visible;
  }

  .partners-list {
    display: grid;
    gap: var(--ehq-space-3);
  }

  .partners-toolbar {
    padding: var(--ehq-space-3);
  }

  p,
  h2,
  strong {
    margin: 0;
  }

  p,
  label span,
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

  .partners-head span,
  .drawer-empty span,
  .link-panel strong {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-body-weight);
    line-height: var(--ehq-type-ui-line);
  }

  /* Raw controls that remain after the DS migration: the notes textarea and
     the active checkbox, which have no @ehq/ui equivalent yet. */
  input,
  textarea {
    font: inherit;
  }

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

  /* Per-action outcome line (form submit or payee link), rendered next to the
     action it belongs to; the drawer-level .action-message stays contextual. */
  .outcome-message {
    margin: 0;
    color: var(--ehq-success);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    text-transform: none;
  }

  .outcome-message.error {
    color: var(--ehq-error);
  }

  .side-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  .suggestions,
  .link-panel,
  /* Off-screen submit control enabling implicit Enter-to-submit inside the
     drawer form (the visible action is the Drawer footer button). */
  .submit-proxy {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

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

  textarea {
    width: 100%;
    min-width: 0;
    min-height: 80px;
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface);
    color: var(--ehq-text);
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
    .partners-toolbar,
    .drawer-actions,
    .suggestions div {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
