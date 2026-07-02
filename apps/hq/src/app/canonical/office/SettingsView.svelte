<script lang="ts">
  import { onMount } from "svelte";
  import {
    Card,
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
  import { apiMoneyToMicroUnits, formatMoneyValue } from "../../money-format.js";
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

  interface CurrencyAggregate {
    readonly currency: string;
    readonly accountCount: number;
    // Sum of the converted MUR balances across every account of the currency;
    // null when no account carries a converted balance (reference currency).
    readonly convertedSumMicro: bigint | null;
    readonly latestAsOf: string | null;
  }

  // The "Converted balance (MUR)" column is the consolidated balance of every
  // account in the currency, not just the first one encountered.
  function createCurrencyTableRows(rows: readonly OfficeBankAccountSummary[]): readonly TableRow[] {
    const aggregates = new Map<string, CurrencyAggregate>();

    for (const account of rows) {
      const previous = aggregates.get(account.currency) ?? {
        currency: account.currency,
        accountCount: 0,
        convertedSumMicro: null,
        latestAsOf: null
      };
      const accountConverted = account.currentBalanceMurMicro === null ? null : apiMoneyToMicroUnits(account.currentBalanceMurMicro);
      const convertedSumMicro = accountConverted === null
        ? previous.convertedSumMicro
        : (previous.convertedSumMicro ?? 0n) + accountConverted;
      const latestAsOf = account.balanceAsOf === null
        ? previous.latestAsOf
        : previous.latestAsOf === null || account.balanceAsOf > previous.latestAsOf
          ? account.balanceAsOf
          : previous.latestAsOf;

      aggregates.set(account.currency, {
        currency: account.currency,
        accountCount: previous.accountCount + 1,
        convertedSumMicro,
        latestAsOf
      });
    }

    return [...aggregates.values()].map((aggregate: CurrencyAggregate): TableRow => ({
      id: aggregate.currency,
      cells: [
        { kind: "badge", value: aggregate.currency, tone: "info" },
        {
          kind: "text",
          value: `${aggregate.convertedSumMicro === null ? "Reference currency" : "Converted to MUR"} · ${String(aggregate.accountCount)} ${aggregate.accountCount === 1 ? "account" : "accounts"}`,
          strong: false
        },
        {
          kind: "money",
          value: aggregate.convertedSumMicro === null ? "—" : formatMoneyValue(aggregate.convertedSumMicro.toString(), "MUR"),
          tone: "muted"
        },
        { kind: "text", value: formatDateOnly(aggregate.latestAsOf), strong: false }
      ]
    }));
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
    <Card
      eyebrow="Reference"
      title="Reference currency"
      subtitle="MUR is the Office reference currency. Foreign-currency accounts carry a converted MUR balance derived from the data layer."
      state="default"
      accent={false}
      badgeLabel=""
      badgeTone="muted"
      actionLabel=""
    />
    <Card
      eyebrow="Period"
      title={props.period}
      subtitle="Active accounting period used across Office reads."
      state="default"
      accent={false}
      badgeLabel=""
      badgeTone="muted"
      actionLabel=""
    />
    <Card
      eyebrow="Maintenance"
      title="Read-only"
      subtitle="This console exposes Office in read-only mode. Maintenance and configuration changes are made in the eof admin backend; no editable settings are surfaced here."
      state="default"
      accent={false}
      badgeLabel=""
      badgeTone="muted"
      actionLabel=""
    />
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

  // sortable stays false everywhere: the shared Table renders the sort glyph but
  // implements no sorting, so advertising it would be a dead affordance.
  const currencyColumns: readonly TableColumn[] = [
    { label: "Currency", align: "left", sortable: false },
    { label: "Role", align: "left", sortable: false },
    { label: "Converted balance (MUR)", align: "right", sortable: false },
    { label: "As of", align: "left", sortable: false }
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
