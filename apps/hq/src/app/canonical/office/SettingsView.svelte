<script lang="ts">
  import { onMount } from "svelte";
  import {
    Alert,
    BarsChart,
    Button,
    Card,
    Loader,
    Select,
    Table,
    type ChartPoint,
    type SelectOption,
    type TablePagination,
    type TableRow
  } from "@ehq/ui";
  import {
    beginReload,
    createErrorState,
    createIdleState,
    createSuccessState,
    type ApiRequestState,
    type OfficeApiClient,
    type OfficeBankAccountSummary,
    type OfficeSettingsResponse,
    type PageResult
  } from "@ehq/api-client";
  import { isApiRequestLoading as isLoadingState } from "../request-state.js";
  import { formatDateOnly } from "../../date-format.js";
  import { apiMoneyToMicroUnits, formatMoneyValue } from "../../money-format.js";
  import { createTablePagination, loadPageResult, readPageItems, TABLE_PAGE_SIZE, type PageLoadMode } from "../../table-pagination.js";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
    readonly writesEnabled: boolean;
  }

  const props: Props = $props();

  let accountsState = $state<ApiRequestState<PageResult<OfficeBankAccountSummary>>>(
    createIdleState<PageResult<OfficeBankAccountSummary>>()
  );
  let accountsLoadingMore = $state(false);
  let accountsLoadMoreError = $state<string | null>(null);
  let settings = $state<OfficeSettingsResponse | null>(null);
  let selectedDefaultAccountId = $state("");
  let settingsSaving = $state(false);
  let settingsMessage = $state("");
  let settingsError = $state("");

  const accountRows = $derived(readPageItems(accountsState));
  const currencyTableRows = $derived(createCurrencyTableRows(accountRows));
  const currencyBalancePoints = $derived(createCurrencyBalancePoints(accountRows));
  const accountPagination = $derived<TablePagination | null>(
    createTablePagination(accountsState, accountsLoadingMore, accountsLoadMoreError, loadMoreAccounts, loadAllAccounts)
  );
  const defaultAccountOptions = $derived<readonly SelectOption[]>([
    { value: "", label: "Automatic by bank and currency" },
    ...accountRows
      .filter((account): boolean => account.isActive)
      .map((account): SelectOption => ({
        value: account.id,
        label: `${account.bankName} · ${account.accountLabel} · ${account.currency}`
      }))
  ]);

  onMount((): void => {
    void loadSettings();
  });

  async function loadSettings(): Promise<void> {
    accountsState = beginReload<PageResult<OfficeBankAccountSummary>>(accountsState);

    try {
      const [accounts, officeSettings] = await Promise.all([
        props.client.listBankAccounts({ workspaceId: props.workspaceId, cursor: null, limit: TABLE_PAGE_SIZE }),
        props.client.getSettings(props.workspaceId)
      ]);
      accountsState = createSuccessState<PageResult<OfficeBankAccountSummary>>(accounts);
      settings = officeSettings;
      selectedDefaultAccountId = officeSettings.defaultImportAccountId ?? "";
      accountsLoadMoreError = null;
    } catch (error: unknown) {
      accountsState = createErrorState<PageResult<OfficeBankAccountSummary>>(error);
    }
  }

  async function saveSettings(): Promise<void> {
    settingsSaving = true;
    settingsError = "";
    settingsMessage = "";
    try {
      await props.client.updateSettings(
        {
          workspaceId: props.workspaceId,
          defaultImportAccountId: selectedDefaultAccountId.length === 0 ? null : selectedDefaultAccountId
        },
        { idempotencyKey: `office-settings-${crypto.randomUUID()}` }
      );
      settings = settings === null ? null : { ...settings, defaultImportAccountId: selectedDefaultAccountId || null };
      settingsMessage = "Default import account saved and audited.";
    } catch (error: unknown) {
      settingsError = getErrorMessage(error);
    } finally {
      settingsSaving = false;
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

  function createCurrencyBalancePoints(rows: readonly OfficeBankAccountSummary[]): readonly ChartPoint[] {
    const balances = new Map<string, bigint>();

    for (const account of rows) {
      const balance = account.currentBalanceMurMicro === null ? 0n : apiMoneyToMicroUnits(account.currentBalanceMurMicro);
      const previous = balances.get(account.currency) ?? 0n;
      const absoluteBalance = balance < 0n ? -balance : balance;
      balances.set(account.currency, previous + absoluteBalance);
    }

    let maxValue = 0n;
    const rawPoints: { label: string; value: bigint }[] = [];
    for (const entry of balances.entries()) {
      rawPoints.push({ label: entry[0], value: entry[1] });
      if (entry[1] > maxValue) {
        maxValue = entry[1];
      }
    }

    const points: ChartPoint[] = rawPoints
      .sort((left: { label: string; value: bigint }, right: { label: string; value: bigint }): number => {
        if (left.value === right.value) {
          return 0;
        }
        return right.value > left.value ? 1 : -1;
      })
      .slice(0, 6)
      .map((entry: { label: string; value: bigint }): ChartPoint => ({
        label: entry.label,
        value: maxValue === 0n ? 0 : Number((entry.value * 100n) / maxValue)
      }));

    while (points.length < 6) {
      points.push({ label: "-", value: 0 });
    }

    return points;
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
      title="Operational"
      subtitle="Office settings persist through the API to Postgres and every change emits an audit event."
      state="default"
      accent={false}
      badgeLabel=""
      badgeTone="muted"
      actionLabel=""
    />
  </section>

  {#if settingsError.length > 0}
    <Alert tone="error" title="Settings not saved" message={settingsError} dismissible={false} />
  {:else if settingsMessage.length > 0}
    <Alert tone="success" title="Settings saved" message={settingsMessage} dismissible={false} />
  {/if}

  <section class="settings-editor ehq-edge-surface" aria-label="Editable Office settings">
    <div>
      <p class="eyebrow">Bank imports</p>
      <h2>Default import account</h2>
      <p>Used as the first destination choice. Bank and currency detection still prevents an incompatible account.</p>
    </div>
    <Select id="office-default-import-account" label="Account" value={selectedDefaultAccountId} options={defaultAccountOptions} state="default" message={settings?.updatedAt === null ? "Not configured yet." : "Persisted in Office settings."} onchange={(value) => { selectedDefaultAccountId = value; }} />
    <Button label="Save setting" variant="primary" size="medium" type="button" disabled={!props.writesEnabled || settings === null} loading={settingsSaving} locked={false} focus={false} ariaLabel="Save default bank import account" title={props.writesEnabled ? "" : "Enable writes to edit Office settings."} onclick={saveSettings} />
  </section>

  <section class="dashboard-grid">
    <BarsChart title="Currency balance distribution (MUR)" points={currencyBalancePoints} tone="info" />
  </section>

  {#if isLoadingState(accountsState)}
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
    { label: "Currency", align: "left", sortable: true },
    { label: "Role", align: "left", sortable: true },
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

  .dashboard-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ehq-space-3);
  }

  .settings-editor {
    padding: var(--ehq-space-4);
    border-radius: var(--ehq-radius-sm);
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 420px) auto;
    align-items: end;
    gap: var(--ehq-space-4);
  }

  .settings-editor h2,
  .settings-editor p { margin: 0; }
  .settings-editor > div { display: grid; gap: var(--ehq-space-1); }
  .settings-editor > div > p:last-child { color: var(--ehq-text-soft); }
  .eyebrow { color: var(--ehq-text-muted); font-family: var(--ehq-mono); font-size: var(--ehq-type-label-size); letter-spacing: .1em; text-transform: uppercase; }

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
    .settings-editor { grid-template-columns: 1fr; align-items: stretch; }
  }
</style>
