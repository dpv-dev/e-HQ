<script lang="ts">
  import { onMount } from "svelte";
  import {
    Loader,
    Table,
    type TablePagination,
    type TableRow
  } from "@ehq/ui";
  import {
    createErrorState,
    createIdleState,
    createLoadingState,
    createSuccessState,
    type ApiRequestState,
    type OfficeApiClient,
    type OfficeBankAccountSummary,
    type PageResult
  } from "@ehq/api-client";
  import { formatDateOnly } from "../../date-format.js";
  import { formatMoneyValue } from "../../money-format.js";
  import { createTablePagination, loadPageResult, readPageItems, TABLE_PAGE_SIZE, type PageLoadMode } from "../../table-pagination.js";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
  }

  const props: Props = $props();

  let accountsState = $state<ApiRequestState<PageResult<OfficeBankAccountSummary>>>(
    createIdleState<PageResult<OfficeBankAccountSummary>>()
  );
  let accountsLoadingMore = $state(false);
  let accountsLoadMoreError = $state<string | null>(null);

  const accountRows = $derived(readPageItems(accountsState));
  const currencyTableRows = $derived(createCurrencyTableRows(accountRows));
  const accountPagination = $derived<TablePagination | null>(
    createTablePagination(accountsState, accountsLoadingMore, accountsLoadMoreError, loadMoreAccounts, loadAllAccounts)
  );

  onMount((): void => {
    void loadSettings();
  });

  async function loadSettings(): Promise<void> {
    accountsState = createLoadingState<PageResult<OfficeBankAccountSummary>>();

    try {
      const accounts = await props.client.listBankAccounts({ workspaceId: props.workspaceId, cursor: null, limit: TABLE_PAGE_SIZE });
      accountsState = createSuccessState<PageResult<OfficeBankAccountSummary>>(accounts);
      accountsLoadMoreError = null;
    } catch (error: unknown) {
      accountsState = createErrorState<PageResult<OfficeBankAccountSummary>>(error);
    }
  }

  async function loadMoreAccounts(): Promise<void> {
    await loadAccountsPage("one");
  }

  async function loadAllAccounts(): Promise<void> {
    await loadAccountsPage("all");
  }

  async function loadAccountsPage(mode: PageLoadMode): Promise<void> {
    await loadPageResult(mode, {
      state: accountsState,
      loading: accountsLoadingMore,
      setLoading: (loading: boolean): void => {
        accountsLoadingMore = loading;
      },
      setError: (error: string | null): void => {
        accountsLoadMoreError = error;
      },
      setState: (state: ApiRequestState<PageResult<OfficeBankAccountSummary>>): void => {
        accountsState = state;
      },
      fetchPage: (cursor: string): Promise<PageResult<OfficeBankAccountSummary>> =>
        props.client.listBankAccounts({
          workspaceId: props.workspaceId,
          cursor,
          limit: TABLE_PAGE_SIZE
        })
    });
  }

  function createCurrencyTableRows(rows: readonly OfficeBankAccountSummary[]): readonly TableRow[] {
    const seen = new Set<string>();
    const result: TableRow[] = [];

    for (const account of rows) {
      if (seen.has(account.currency)) {
        continue;
      }

      seen.add(account.currency);
      result.push({
        id: account.currency,
        cells: [
          { kind: "badge", value: account.currency, tone: "info" },
          { kind: "text", value: account.currentBalanceMurMicro === null ? "Reference currency" : "Converted to MUR", strong: false },
          { kind: "money", value: account.currentBalanceMurMicro === null ? "—" : formatMoneyValue(account.currentBalanceMurMicro, "MUR"), tone: "muted" },
          { kind: "text", value: formatDateOnly(account.balanceAsOf), strong: false }
        ]
      });
    }

    return result;
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return "Settings request failed.";
  }
</script>

<section class="settings-view">
  <section class="config-grid" aria-label="Office configuration">
    <section class="config-panel ehq-edge-surface">
      <p class="ehq-type-label-mono">Reference</p>
      <h2 class="ehq-type-heading">Reference currency</h2>
      <span class="ehq-type-body">MUR is the Office reference currency. Foreign-currency accounts carry a converted MUR balance derived from the data layer.</span>
    </section>
    <section class="config-panel ehq-edge-surface">
      <p class="ehq-type-label-mono">Period</p>
      <h2 class="ehq-type-heading">{props.period}</h2>
      <span class="ehq-type-body">Active accounting period used across Office reads.</span>
    </section>
    <section class="config-panel ehq-edge-surface">
      <p class="ehq-type-label-mono">Maintenance</p>
      <h2 class="ehq-type-heading">Read-only</h2>
      <span class="ehq-type-body">This console exposes Office in read-only mode. Maintenance and configuration changes are made in the eof admin backend; no editable settings are surfaced here.</span>
    </section>
  </section>

  {#if accountsState.status === "loading"}
    <Loader label="Loading settings" detail="Reading currency configuration from accounts." size="medium" />
  {:else if accountsState.status === "error"}
    <div class="state-copy error">
      <strong class="ehq-type-heading">Settings unavailable</strong>
      <span class="ehq-type-body">{getErrorMessage(accountsState.error)}</span>
    </div>
  {:else}
    <Table title="Currency configuration" columns={currencyColumns} rows={currencyTableRows} state={currencyTableRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={accountPagination} />
  {/if}
</section>

<script module lang="ts">
  import type { TableColumn } from "@ehq/ui";

  const currencyColumns: readonly TableColumn[] = [
    { label: "Currency", align: "left", sortable: true },
    { label: "Role", align: "left", sortable: false },
    { label: "Converted balance (MUR)", align: "right", sortable: true },
    { label: "As of", align: "left", sortable: true }
  ];
</script>

<style>
  .settings-view {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-4);
  }

  .config-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  .config-panel {
    min-width: 0;
    padding: var(--ehq-space-4);
    border-radius: var(--ehq-radius-sm);
    display: grid;
    gap: var(--ehq-space-2);
  }

  .config-panel p {
    margin: 0;
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .config-panel h2 {
    margin: 0;
    font-size: var(--ehq-type-section-title-size);
  }

  .config-panel span {
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
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
  }

  .state-copy.error strong {
    color: var(--ehq-error);
  }

  @media (max-width: 1100px) {
    .config-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
