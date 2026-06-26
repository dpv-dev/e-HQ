<script lang="ts">
  import { onMount } from "svelte";
  import {
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
    type OfficeBankAccountSummary,
    type OfficeBankQualityResponse,
    type OfficeBankRawLine,
    type OfficeReconciliationCandidate,
    type PageResult
  } from "@ehq/api-client";
  import { formatMoneyValue, formatSignedMoneyValue, moneyToneForValue } from "../../money-format.js";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
  }

  interface BankKpi {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly accent: boolean;
  }

  const props: Props = $props();

  let accountsState = $state<ApiRequestState<PageResult<OfficeBankAccountSummary>>>(
    createIdleState<PageResult<OfficeBankAccountSummary>>()
  );
  let rawState = $state<ApiRequestState<PageResult<OfficeBankRawLine>>>(
    createIdleState<PageResult<OfficeBankRawLine>>()
  );
  let qualityState = $state<ApiRequestState<OfficeBankQualityResponse>>(
    createIdleState<OfficeBankQualityResponse>()
  );
  let reconciliationState = $state<ApiRequestState<PageResult<OfficeReconciliationCandidate>>>(
    createIdleState<PageResult<OfficeReconciliationCandidate>>()
  );

  const accountRows = $derived(readPageItems(accountsState));
  const rawRows = $derived(readPageItems(rawState));
  const reconciliationRows = $derived(readPageItems(reconciliationState));
  const bankKpis = $derived(createBankKpis(accountRows, qualityState));
  const accountTableRows = $derived(createAccountTableRows(accountRows));
  const rawTableRows = $derived(createRawTableRows(rawRows));
  const reconciliationTableRows = $derived(createReconciliationTableRows(reconciliationRows));

  onMount((): void => {
    void loadBank();
  });

  async function loadBank(): Promise<void> {
    accountsState = createLoadingState<PageResult<OfficeBankAccountSummary>>();
    rawState = createLoadingState<PageResult<OfficeBankRawLine>>();
    qualityState = createLoadingState<OfficeBankQualityResponse>();
    reconciliationState = createLoadingState<PageResult<OfficeReconciliationCandidate>>();

    try {
      const [accounts, raw, quality, reconciliations] = await Promise.all([
        props.client.listBankAccounts({ workspaceId: props.workspaceId, limit: 50 }),
        props.client.listBankRawLines({
          workspaceId: props.workspaceId,
          period: null,
          accountId: null,
          cursor: null,
          limit: 50
        }),
        props.client.getBankQuality({ workspaceId: props.workspaceId, period: props.period }),
        props.client.listReconciliations({
          workspaceId: props.workspaceId,
          accountId: null,
          period: props.period,
          status: null,
          cursor: null,
          limit: 50
        })
      ]);
      accountsState = createSuccessState<PageResult<OfficeBankAccountSummary>>(accounts);
      rawState = createSuccessState<PageResult<OfficeBankRawLine>>(raw);
      qualityState = createSuccessState<OfficeBankQualityResponse>(quality);
      reconciliationState = createSuccessState<PageResult<OfficeReconciliationCandidate>>(reconciliations);
    } catch (error: unknown) {
      accountsState = createErrorState<PageResult<OfficeBankAccountSummary>>(error);
      rawState = createErrorState<PageResult<OfficeBankRawLine>>(error);
      qualityState = createErrorState<OfficeBankQualityResponse>(error);
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
    }
  }

  function readPageItems<TItem>(state: ApiRequestState<PageResult<TItem>>): readonly TItem[] {
    if (state.status === "success") {
      return state.data.items;
    }

    return [];
  }

  function createBankKpis(
    accounts: readonly OfficeBankAccountSummary[],
    quality: ApiRequestState<OfficeBankQualityResponse>
  ): readonly BankKpi[] {
    const activeCount = accounts.filter((account: OfficeBankAccountSummary): boolean => account.isActive).length;
    const matchedValue = quality.status === "success" ? formatBasisPoints(quality.data.matchedRateBp) : "—";
    const unmatchedValue = quality.status === "success" ? String(quality.data.unmatchedLineCount) : "—";
    const duplicateValue = quality.status === "success" ? String(quality.data.duplicateCandidateCount) : "—";

    return [
      {
        label: "Accounts",
        value: String(accounts.length),
        detail: `${String(activeCount)} active`,
        tone: "info",
        accent: true
      },
      {
        label: "Matched rate",
        value: matchedValue,
        detail: quality.status === "success" ? quality.data.period : stateLabel(quality),
        tone: "success",
        accent: false
      },
      {
        label: "Unmatched lines",
        value: unmatchedValue,
        detail: "bank quality",
        tone: "warning",
        accent: false
      },
      {
        label: "Duplicate candidates",
        value: duplicateValue,
        detail: "bank quality",
        tone: "muted",
        accent: false
      }
    ];
  }

  function createAccountTableRows(rows: readonly OfficeBankAccountSummary[]): readonly TableRow[] {
    return rows.map((account: OfficeBankAccountSummary): TableRow => ({
      id: account.id,
      cells: [
        { kind: "text", value: account.bankName, strong: true },
        { kind: "text", value: account.accountLabel, strong: false },
        { kind: "badge", value: account.currency, tone: "info" },
        { kind: "money", value: formatMoney(account.currentBalanceMicro, account.currency), tone: moneyTone(account.currentBalanceMicro) },
        { kind: "money", value: account.currentBalanceMurMicro === null ? "—" : formatMoney(account.currentBalanceMurMicro, "MUR"), tone: "muted" },
        { kind: "text", value: account.balanceAsOf ?? "—", strong: false },
        { kind: "badge", value: account.isActive ? "active" : "inactive", tone: account.isActive ? "success" : "muted" }
      ]
    }));
  }

  function createRawTableRows(rows: readonly OfficeBankRawLine[]): readonly TableRow[] {
    return rows.map((line: OfficeBankRawLine): TableRow => ({
      id: line.id,
      cells: [
        { kind: "text", value: line.occurredOn, strong: false },
        { kind: "text", value: line.description, strong: true },
        { kind: "text", value: line.reference === "" ? "—" : line.reference, strong: false },
        { kind: "badge", value: line.direction, tone: line.direction === "credit" ? "success" : "warning" },
        { kind: "money", value: formatSignedMoney(line.amountMicro, line.currency), tone: moneyTone(line.amountMicro) },
        { kind: "money", value: formatMoney(line.amountMurMicro, "MUR"), tone: "muted" },
        { kind: "badge", value: line.isDuplicateCandidate ? "duplicate" : "unique", tone: line.isDuplicateCandidate ? "warning" : "muted" },
        { kind: "badge", value: line.reconciliationStatus, tone: reconciliationTone(line.reconciliationStatus) }
      ]
    }));
  }

  function createReconciliationTableRows(rows: readonly OfficeReconciliationCandidate[]): readonly TableRow[] {
    return rows.map((candidate: OfficeReconciliationCandidate): TableRow => ({
      id: candidate.id,
      cells: [
        { kind: "text", value: candidate.bankDescription, strong: true },
        { kind: "text", value: candidate.occurredOn, strong: false },
        { kind: "money", value: formatSignedMoney(candidate.amountMicro, "MUR"), tone: moneyTone(candidate.amountMicro) },
        { kind: "text", value: candidate.ledgerDescription, strong: false },
        { kind: "badge", value: candidate.status, tone: reconciliationTone(candidate.status) }
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

  function reconciliationTone(status: "unmatched" | "suggested" | "matched" | "rejected"): Tone {
    if (status === "matched") {
      return "success";
    }

    if (status === "suggested") {
      return "info";
    }

    if (status === "rejected") {
      return "error";
    }

    return "warning";
  }

  function formatBasisPoints(value: number): string {
    const whole = Math.trunc(value / 100);
    const fraction = String(value % 100).padStart(2, "0");

    return `${String(whole)}.${fraction}%`;
  }

  function formatMoney(amountMicro: string, currency: string): string {
    return formatMoneyValue(amountMicro, currency);
  }

  function formatSignedMoney(amountMicro: string, currency: string): string {
    return formatSignedMoneyValue(amountMicro, currency);
  }

  function moneyTone(amountMicro: string): Tone {
    return moneyToneForValue(amountMicro);
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return "Bank request failed.";
  }
</script>

<section class="bank-view">
  <section class="kpi-grid" aria-label="Bank indicators">
    {#each bankKpis as kpi (kpi.label)}
      <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={accountsState.status === "loading" ? "loading" : "default"} accent={kpi.accent} />
    {/each}
  </section>

  {#if accountsState.status === "loading"}
    <Loader label="Loading bank" detail="Reading accounts, raw lines, and bank quality." size="medium" />
  {:else if accountsState.status === "error"}
    <div class="state-copy error">
      <strong class="ehq-type-heading">Bank unavailable</strong>
      <span class="ehq-type-body">{getErrorMessage(accountsState.error)}</span>
    </div>
  {:else}
    <Table title="Bank accounts" columns={accountColumns} rows={accountTableRows} state={accountTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
    <Table title="Raw bank lines" columns={rawColumns} rows={rawTableRows} state={rawState.status === "loading" ? "loading" : rawState.status === "error" ? "error" : rawTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
    <Table title="Reconciliation candidates" columns={reconciliationColumns} rows={reconciliationTableRows} state={reconciliationState.status === "loading" ? "loading" : reconciliationState.status === "error" ? "error" : reconciliationTableRows.length === 0 ? "empty" : "default"} actionLabel="" />
  {/if}
</section>

<script module lang="ts">
  import type { TableColumn } from "@ehq/ui";

  const accountColumns: readonly TableColumn[] = [
    { label: "Bank", align: "left", sortable: true },
    { label: "Account", align: "left", sortable: true },
    { label: "Currency", align: "left", sortable: true },
    { label: "Balance", align: "right", sortable: true },
    { label: "Balance (MUR)", align: "right", sortable: true },
    { label: "As of", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const rawColumns: readonly TableColumn[] = [
    { label: "Date", align: "left", sortable: true },
    { label: "Description", align: "left", sortable: true },
    { label: "Reference", align: "left", sortable: false },
    { label: "Direction", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Amount (MUR)", align: "right", sortable: true },
    { label: "Duplicate", align: "left", sortable: true },
    { label: "Reconciliation", align: "left", sortable: true }
  ];
  const reconciliationColumns: readonly TableColumn[] = [
    { label: "Bank line", align: "left", sortable: true },
    { label: "Date", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Suggested match", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
</script>

<style>
  .bank-view {
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
