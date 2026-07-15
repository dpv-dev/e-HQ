<script lang="ts">
  import {
    Alert,
    BarsChart,
    Button,
    type ChartPoint,
    Input,
    KPI,
    Loader,
    Select,
    Table,
    Toggle,
    type SelectOption,
    type TablePagination,
    type TableRow,
    type TableRowAction,
    type Tone
  } from "@ehq/ui";
  import {
    beginReload,
    createErrorState,
    createIdleState,
    createSuccessState,
    type ApiRequestState,
    type CurrencyCode,
    type OfficeApiClient,
    type OfficeBankAccountSummary,
    type OfficeBankAccountWriteRequest,
    type OfficeBankQualityResponse,
    type OfficeBankRawLine,
    type PageResult
  } from "@ehq/api-client";
  import {
    apiRequestStateLabel as stateLabel,
    isApiRequestLoading as isLoadingState,
    type CanonicalRequestStatus
  } from "../request-state.js";
  import { formatDateOnly } from "../../date-format.js";
  import { sortOptionsAlphabetically } from "../../select-options.js";
  import { formatMoneyValue, formatSignedMoneyValue, moneyToneForValue } from "../../money-format.js";
  import { appendPageResult, createTablePagination, readPageItems, TABLE_PAGE_SIZE } from "../../table-pagination.js";
  import { untrack } from "svelte";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly writesEnabled: boolean;
    readonly isAdministrator: boolean;
  }

  interface BankKpi {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly accent: boolean;
  }

  type RequestStatus = CanonicalRequestStatus;

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
  const accountRows = $derived(readPageItems(accountsState));
  const rawRows = $derived(readPageItems(rawState));
  const bankKpis = $derived(createBankKpis(accountRows, qualityState));
  const accountTableRows = $derived(createAccountTableRows(accountRows));
  const accountRowActions = $derived<readonly TableRowAction[]>([
    { label: "Edit", onAction: startEditAccount },
    {
      label: "Delete empty account",
      onAction: deleteAccountById,
      danger: true,
      isEnabled: canDeleteAccount,
      disabledReason: deleteAccountDisabledReason
    }
  ]);

  let bankFormName = $state("");
  let bankFormLabel = $state("");
  let bankFormCurrency = $state<CurrencyCode>("MUR");
  let bankFormActive = $state(true);
  let editingAccountId = $state<string | null>(null);
  let accountSubmitStatus = $state<RequestStatus>("idle");
  let accountSubmitMessage = $state<string | null>(null);
  let rawActionStatus = $state<RequestStatus>("idle");
  let rawActionMessage = $state<string | null>(null);
  let accountsNextCursor = $state<string | null>(null);
  let accountsLoadingMore = $state(false);
  let accountsLoadMoreError = $state<string | null>(null);
  let rawNextCursor = $state<string | null>(null);
  let rawLoadingMore = $state(false);
  let rawLoadMoreError = $state<string | null>(null);

  const currencyOptions: readonly SelectOption[] = [
    { label: "MUR", value: "MUR" },
    { label: "EUR", value: "EUR" },
    { label: "USD", value: "USD" }
  ];

  function accountWriteRequest(): OfficeBankAccountWriteRequest {
    return {
      workspaceId: props.workspaceId,
      bankName: bankFormName.trim(),
      accountLabel: bankFormLabel.trim(),
      currency: bankFormCurrency,
      active: bankFormActive
    };
  }

  // Clears the input fields only; the submit status/message stay owned by the
  // submit flow so the button remains disabled through the post-write reload.
  function resetAccountFormFields(): void {
    editingAccountId = null;
    bankFormName = "";
    bankFormLabel = "";
    bankFormCurrency = "MUR";
    bankFormActive = true;
  }

  function resetAccountForm(): void {
    resetAccountFormFields();
    accountSubmitStatus = "idle";
    accountSubmitMessage = null;
  }

  function startEditAccount(accountId: string): void {
    const account = accountRows.find((row: OfficeBankAccountSummary): boolean => row.id === accountId);
    if (account === undefined) {
      return;
    }
    editingAccountId = account.id;
    bankFormName = account.bankName;
    bankFormLabel = account.accountLabel;
    bankFormCurrency = account.currency;
    bankFormActive = account.isActive;
  }

  function canDeleteAccount(accountId: string): boolean {
    const account = accountRows.find((row: OfficeBankAccountSummary): boolean => row.id === accountId);
    return props.isAdministrator && account?.canDelete === true;
  }

  function deleteAccountDisabledReason(accountId: string): string | null {
    if (!props.isAdministrator) {
      return "Administrator access is required.";
    }

    const account = accountRows.find((row: OfficeBankAccountSummary): boolean => row.id === accountId);
    if (account === undefined) {
      return "Bank account is not loaded.";
    }

    return account.canDelete ? null : "Deactivate this account; linked financial records cannot be deleted.";
  }

  async function deleteAccountById(accountId: string): Promise<void> {
    if (!props.writesEnabled) {
      accountSubmitStatus = "error";
      accountSubmitMessage = "Enable writes to delete a bank account.";
      return;
    }

    if (accountSubmitStatus === "loading") {
      return;
    }

    const account = accountRows.find((row: OfficeBankAccountSummary): boolean => row.id === accountId);
    if (account === undefined) {
      accountSubmitStatus = "error";
      accountSubmitMessage = "Bank account not found in the loaded list.";
      return;
    }
    if (!canDeleteAccount(accountId)) {
      accountSubmitStatus = "error";
      accountSubmitMessage = deleteAccountDisabledReason(accountId);
      return;
    }

    const confirmed = globalThis.confirm(
      `Delete the empty account ${account.bankName} · ${account.accountLabel}?`
    );
    if (!confirmed) {
      return;
    }

    accountSubmitStatus = "loading";
    accountSubmitMessage = null;
    try {
      await props.client.deleteBankAccount(
        accountId,
        { workspaceId: props.workspaceId },
        { idempotencyKey: crypto.randomUUID() }
      );
      if (editingAccountId === accountId) {
        resetAccountFormFields();
      }
      await loadBank();
      accountSubmitStatus = "success";
      accountSubmitMessage = "Empty bank account deleted.";
    } catch (error: unknown) {
      accountSubmitStatus = "error";
      accountSubmitMessage = getErrorMessage(error);
    }
  }

  async function submitAccountForm(): Promise<void> {
    if (accountSubmitStatus === "loading") {
      return;
    }
    if (bankFormName.trim().length === 0 || bankFormLabel.trim().length === 0) {
      return;
    }
    const accountId = editingAccountId;
    // One idempotency key per submit attempt; transport-level retries reuse it.
    const idempotencyKey = crypto.randomUUID();
    accountSubmitStatus = "loading";
    accountSubmitMessage = null;
    try {
      if (accountId === null) {
        await props.client.createBankAccount(accountWriteRequest(), { idempotencyKey });
      } else {
        await props.client.updateBankAccount(accountId, accountWriteRequest(), { idempotencyKey });
      }
      // Keep the status at "loading" through the reload so the submit button
      // stays disabled and the progress label holds until the list refreshes.
      resetAccountFormFields();
      await loadBank();
      accountSubmitStatus = "success";
      accountSubmitMessage = accountId === null ? "Bank account created." : "Bank account updated.";
    } catch (error: unknown) {
      // Write failures stay on the form; accountsState keeps the loaded list.
      accountSubmitStatus = "error";
      accountSubmitMessage = getErrorMessage(error);
    }
  }

  // The submit button is disabled while the form is incomplete, so the empty
  // guard inside submitAccountForm can no longer be hit silently.
  const accountFormComplete = $derived(bankFormName.trim().length > 0 && bankFormLabel.trim().length > 0);

  function accountSubmitTitle(): string {
    if (!props.writesEnabled) {
      return "Enable writes to edit bank accounts.";
    }

    if (accountSubmitStatus === "loading") {
      return "Saving in progress.";
    }

    if (!accountFormComplete) {
      return "Fill in the bank and account label.";
    }

    return "";
  }

  async function runRawLineAction(action: () => Promise<unknown>, successMessage: string): Promise<void> {
    if (!props.writesEnabled) {
      rawActionStatus = "error";
      rawActionMessage = "Enable writes to update bank lines.";
      return;
    }

    if (rawActionStatus === "loading") {
      return;
    }

    rawActionStatus = "loading";
    rawActionMessage = null;

    try {
      await action();
      await loadBank();
      rawActionStatus = "success";
      rawActionMessage = successMessage;
    } catch (error: unknown) {
      rawActionStatus = "error";
      rawActionMessage = getErrorMessage(error);
    }
  }

  async function ignoreRawLineById(lineId: string): Promise<void> {
    await runRawLineAction(
      (): Promise<unknown> =>
        props.client.ignoreBankRawLine(
          { workspaceId: props.workspaceId, statementLineId: lineId },
          { idempotencyKey: crypto.randomUUID() }
        ),
      "Bank line ignored."
    );
  }

  let movingRawLineId = $state<string | null>(null);
  let moveTargetAccountId = $state("");

  function startMoveRawLine(lineId: string): void {
    movingRawLineId = lineId;
    const currentAccountId = rawRows.find((line: OfficeBankRawLine): boolean => line.id === lineId)?.accountId ?? "";
    const fallbackAccountId = accountRows.find((account: OfficeBankAccountSummary): boolean => account.id !== currentAccountId)?.id ?? "";
    moveTargetAccountId = fallbackAccountId;
  }

  function cancelMoveRawLine(): void {
    movingRawLineId = null;
    moveTargetAccountId = "";
  }

  async function confirmMoveRawLine(): Promise<void> {
    const lineId = movingRawLineId;
    if (lineId === null || moveTargetAccountId.length === 0) {
      return;
    }

    await runRawLineAction(
      (): Promise<unknown> =>
        props.client.reassignBankRawLineAccount(
          { workspaceId: props.workspaceId, statementLineId: lineId, accountId: moveTargetAccountId },
          { idempotencyKey: crypto.randomUUID() }
        ),
      "Bank line moved to the selected account."
    );
    movingRawLineId = null;
    moveTargetAccountId = "";
  }

  const moveAccountOptions = $derived<readonly SelectOption[]>(
    sortOptionsAlphabetically(
      accountRows.map((account: OfficeBankAccountSummary): SelectOption => ({
        label: `${account.bankName} · ${account.accountLabel} (${account.currency})`,
        value: account.id
      })),
      0
    )
  );

  function canMoveRawLine(lineId: string): boolean {
    const status = rawRows.find((line: OfficeBankRawLine): boolean => line.id === lineId)?.reconciliationStatus;
    return status === "unmatched" || status === "rejected" || status === "ignored";
  }

  function canIgnoreRawLine(lineId: string): boolean {
    const status = rawRows.find((line: OfficeBankRawLine): boolean => line.id === lineId)?.reconciliationStatus;
    return status === "unmatched" || status === "suggested" || status === "rejected";
  }

  const rawRowActions = $derived<readonly TableRowAction[]>([
    { label: "Move account", onAction: startMoveRawLine, isEnabled: canMoveRawLine },
    { label: "Ignore", onAction: ignoreRawLineById, danger: true, isEnabled: canIgnoreRawLine }
  ]);
  const rawTableRows = $derived(createRawTableRows(rawRows));
  const accountsPagination = $derived<TablePagination | null>(
    createTablePagination(accountsState, accountsLoadingMore, accountsLoadMoreError, loadMoreAccounts, loadAllAccounts)
  );
  const rawPagination = $derived<TablePagination | null>(
    createTablePagination(rawState, rawLoadingMore, rawLoadMoreError, loadMoreRawLines, loadAllRawLines)
  );
  const rawDirectionPoints = $derived(createRawDirectionPoints(rawRows));
  const reconciliationStatusPoints = $derived(createReconciliationStatusPoints(rawRows));

  // $effect (not onMount): re-runs on props.workspaceId/props.period change.
  $effect((): void => {
    void loadBank();
  });

  // Sequence token: discard a stale response if a newer loadBank() call
  // (period change or a write-path reload) started before this one's request
  // resolves (out-of-order network replies).
  let loadBankToken = 0;

  async function loadBank(): Promise<void> {
    const token = ++loadBankToken;
    untrack((): void => {
      accountsState = beginReload<PageResult<OfficeBankAccountSummary>>(accountsState);
      rawState = beginReload<PageResult<OfficeBankRawLine>>(rawState);
      qualityState = beginReload<OfficeBankQualityResponse>(qualityState);
    });

    try {
      const [accounts, raw, quality] = await Promise.all([
        props.client.listBankAccounts({ workspaceId: props.workspaceId, cursor: null, limit: TABLE_PAGE_SIZE }),
        props.client.listBankRawLines({
          workspaceId: props.workspaceId,
          period: props.period,
          accountId: null,
          dateFrom: props.dateFrom,
          dateTo: props.dateTo,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        }),
        props.client.getBankQuality({ workspaceId: props.workspaceId, period: props.period, dateFrom: props.dateFrom, dateTo: props.dateTo })
      ]);
      if (token !== loadBankToken) {
        return;
      }
      accountsState = createSuccessState<PageResult<OfficeBankAccountSummary>>(accounts);
      accountsNextCursor = accounts.nextCursor;
      accountsLoadMoreError = null;
      rawState = createSuccessState<PageResult<OfficeBankRawLine>>(raw);
      rawNextCursor = raw.nextCursor;
      rawLoadMoreError = null;
      qualityState = createSuccessState<OfficeBankQualityResponse>(quality);
    } catch (error: unknown) {
      if (token !== loadBankToken) {
        return;
      }
      accountsState = createErrorState<PageResult<OfficeBankAccountSummary>>(error);
      rawState = createErrorState<PageResult<OfficeBankRawLine>>(error);
      qualityState = createErrorState<OfficeBankQualityResponse>(error);
    }
  }

  async function loadMoreAccounts(): Promise<void> {
    await loadAccountsPage("one");
  }

  async function loadAllAccounts(): Promise<void> {
    await loadAccountsPage("all");
  }

  async function loadAccountsPage(mode: "one" | "all"): Promise<void> {
    if (accountsState.status !== "success" || accountsNextCursor === null || accountsLoadingMore) {
      return;
    }

    accountsLoadingMore = true;
    accountsLoadMoreError = null;

    try {
      let nextCursor: string | null = accountsNextCursor;
      let loaded: PageResult<OfficeBankAccountSummary> = accountsState.data;

      while (nextCursor !== null) {
        const nextPage = await props.client.listBankAccounts({
          workspaceId: props.workspaceId,
          cursor: nextCursor,
          limit: TABLE_PAGE_SIZE
        });
        loaded = appendPageResult(loaded, nextPage);
        accountsState = createSuccessState<PageResult<OfficeBankAccountSummary>>(loaded);
        accountsNextCursor = nextPage.nextCursor;
        nextCursor = nextPage.nextCursor;

        if (mode === "one") {
          break;
        }
      }
    } catch (error: unknown) {
      accountsLoadMoreError = getErrorMessage(error);
    } finally {
      accountsLoadingMore = false;
    }
  }

  async function loadMoreRawLines(): Promise<void> {
    await loadRawLinesPage("one");
  }

  async function loadAllRawLines(): Promise<void> {
    await loadRawLinesPage("all");
  }

  async function loadRawLinesPage(mode: "one" | "all"): Promise<void> {
    if (rawState.status !== "success" || rawNextCursor === null || rawLoadingMore) {
      return;
    }

    rawLoadingMore = true;
    rawLoadMoreError = null;

    try {
      let nextCursor: string | null = rawNextCursor;
      let loaded: PageResult<OfficeBankRawLine> = rawState.data;

      while (nextCursor !== null) {
        const nextPage = await props.client.listBankRawLines({
          workspaceId: props.workspaceId,
          period: props.period,
          accountId: null,
          dateFrom: props.dateFrom,
          dateTo: props.dateTo,
          cursor: nextCursor,
          limit: TABLE_PAGE_SIZE
        });
        loaded = appendPageResult(loaded, nextPage);
        rawState = createSuccessState<PageResult<OfficeBankRawLine>>(loaded);
        rawNextCursor = nextPage.nextCursor;
        nextCursor = nextPage.nextCursor;

        if (mode === "one") {
          break;
        }
      }
    } catch (error: unknown) {
      rawLoadMoreError = getErrorMessage(error);
    } finally {
      rawLoadingMore = false;
    }
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
        { kind: "text", value: formatDateOnly(account.balanceAsOf), strong: false },
        {
          kind: "text",
          value: typeof account.importedLineCount === "number" ? String(account.importedLineCount) : "—",
          strong: false
        },
        { kind: "badge", value: account.isActive ? "active" : "inactive", tone: account.isActive ? "success" : "muted" }
      ]
    }));
  }

  function createRawTableRows(rows: readonly OfficeBankRawLine[]): readonly TableRow[] {
    return rows.map((line: OfficeBankRawLine): TableRow => {
      // A debit leaves the account (money out) -> shown negative (red); a credit is money in -> positive (green).
      const directionalAmount = line.direction === "debit" ? `-${line.amountMicro.replace(/^[+-]/u, "")}` : line.amountMicro;
      const directionalMurAmount = line.direction === "debit" ? `-${line.amountMurMicro.replace(/^[+-]/u, "")}` : line.amountMurMicro;

      return {
        id: line.id,
        cells: [
          { kind: "text", value: formatDateOnly(line.occurredOn), strong: false },
          { kind: "text", value: line.description, strong: true },
          { kind: "text", value: line.reference === "" ? "—" : line.reference, strong: false },
          { kind: "badge", value: line.direction, tone: line.direction === "credit" ? "success" : "warning" },
          { kind: "money", value: formatSignedMoney(directionalAmount, line.currency), tone: moneyTone(directionalAmount) },
          { kind: "money", value: formatSignedMoney(directionalMurAmount, "MUR"), tone: moneyTone(directionalMurAmount) },
          { kind: "badge", value: line.isDuplicateCandidate ? "duplicate" : "unique", tone: line.isDuplicateCandidate ? "warning" : "muted" },
          { kind: "badge", value: line.reconciliationStatus, tone: reconciliationTone(line.reconciliationStatus) }
        ]
      };
    });
  }

  function createRawDirectionPoints(rows: readonly OfficeBankRawLine[]): readonly ChartPoint[] {
    let creditCount = 0;
    let debitCount = 0;

    for (const row of rows) {
      if (row.direction === "credit") {
        creditCount += 1;
      } else {
        debitCount += 1;
      }
    }

    return createNormalizedCountChartPoints(
      [
        { label: "Credit", count: creditCount },
        { label: "Debit", count: debitCount }
      ],
      6
    );
  }

  function createReconciliationStatusPoints(rows: readonly OfficeBankRawLine[]): readonly ChartPoint[] {
    let unmatchedCount = 0;
    let suggestedCount = 0;
    let matchedCount = 0;
    let rejectedCount = 0;
    let ignoredCount = 0;

    for (const row of rows) {
      if (row.reconciliationStatus === "unmatched") {
        unmatchedCount += 1;
        continue;
      }
      if (row.reconciliationStatus === "suggested") {
        suggestedCount += 1;
        continue;
      }
      if (row.reconciliationStatus === "matched") {
        matchedCount += 1;
        continue;
      }
      if (row.reconciliationStatus === "rejected") {
        rejectedCount += 1;
        continue;
      }
      ignoredCount += 1;
    }

    return createNormalizedCountChartPoints(
      [
        { label: "Unmatched", count: unmatchedCount },
        { label: "Suggested", count: suggestedCount },
        { label: "Matched", count: matchedCount },
        { label: "Rejected", count: rejectedCount },
        { label: "Ignored", count: ignoredCount }
      ],
      6
    );
  }

  function createNormalizedCountChartPoints(
    entries: readonly { readonly label: string; readonly count: number }[],
    targetSize: number
  ): readonly ChartPoint[] {
    const points: ChartPoint[] = [];
    let maxCount = 0;

    for (const entry of entries) {
      if (entry.count > maxCount) {
        maxCount = entry.count;
      }
    }

    for (const entry of entries) {
      points.push({
        label: compactChartLabel(entry.label),
        value: maxCount === 0 ? 0 : Math.round((entry.count * 100) / maxCount)
      });
    }

    while (points.length < targetSize) {
      points.push({ label: "-", value: 0 });
    }

    return points.slice(0, targetSize);
  }

  function compactChartLabel(label: string): string {
    const normalized = label.trim();
    if (normalized.length <= 10) {
      return normalized;
    }

    return normalized.slice(0, 10);
  }

  function reconciliationTone(status: "unmatched" | "suggested" | "matched" | "rejected" | "ignored"): Tone {
    if (status === "matched") {
      return "success";
    }

    if (status === "suggested") {
      return "info";
    }

    if (status === "rejected") {
      return "error";
    }

    if (status === "ignored") {
      return "muted";
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

    return "The bank request failed.";
  }
</script>

<section class="bank-view">
  <section class="kpi-grid" aria-label="Bank indicators">
    {#each bankKpis as kpi (kpi.label)}
      <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={isLoadingState(accountsState) ? "loading" : "default"} accent={kpi.accent} />
    {/each}
  </section>

  {#if isLoadingState(accountsState)}
    <Loader label="Loading bank data" detail="Reading accounts, raw lines, and quality indicators." size="medium" />
  {:else if accountsState.status === "error"}
    <div class="state-copy error">
      <strong class="ehq-type-heading">Bank unavailable</strong>
      <span class="ehq-type-body">{getErrorMessage(accountsState.error)}</span>
    </div>
  {:else}
    <section class="dashboard-grid">
      <BarsChart title="Bank transaction mix" points={rawDirectionPoints} tone="active" />
      <BarsChart title="Reconciliation status mix" points={reconciliationStatusPoints} tone="info" />
    </section>

    <section class="bank-account-form ehq-edge-surface" aria-label={editingAccountId === null ? "Add a bank account" : "Edit bank account"}>
      <Input
        id="bank-account-name"
        label="Bank"
        value={bankFormName}
        placeholder="MCB"
        type="text"
        state="default"
        message=""
        oninput={(value: string): void => { bankFormName = value; }}
      />
      <Input
        id="bank-account-label"
        label="Account label"
        value={bankFormLabel}
        placeholder="MCB EUR"
        type="text"
        state="default"
        message=""
        oninput={(value: string): void => { bankFormLabel = value; }}
      />
      <Select
        id="bank-account-currency"
        label="Currency"
        value={bankFormCurrency}
        options={currencyOptions}
        state="default"
        message=""
        onchange={(value: string): void => { bankFormCurrency = value; }}
      />
      <Toggle
        id="bank-account-active"
        label="Active"
        checked={bankFormActive}
        disabled={false}
        onchange={(checked: boolean): void => { bankFormActive = checked; }}
      />
      <div class="bank-account-actions">
        <Button
          label={accountSubmitStatus === "loading" ? "Saving…" : editingAccountId === null ? "Add account" : "Save"}
          variant="primary"
          size="medium"
          type="button"
          disabled={!props.writesEnabled || !accountFormComplete}
          loading={accountSubmitStatus === "loading"}
          locked={false}
          focus={false}
          ariaLabel={editingAccountId === null ? "Add a bank account" : "Save bank account"}
          title={accountSubmitTitle()}
          onclick={submitAccountForm}
        />
        {#if editingAccountId !== null}
          <Button
            label="Cancel"
            variant="secondary"
            size="medium"
            type="button"
            disabled={false}
            loading={false}
            locked={false}
            focus={false}
            ariaLabel="Cancel bank account editing"
            onclick={resetAccountForm}
          />
        {/if}
      </div>
      {#if accountSubmitMessage !== null}
        <Alert
          tone={accountSubmitStatus === "error" ? "error" : "success"}
          title={accountSubmitStatus === "error" ? "Error" : "Operation successful"}
          message={accountSubmitMessage}
          dismissible={false}
        />
      {/if}
    </section>
    <!-- This branch only renders when accountsState is idle or success: the
         loading and error statuses are handled by the view-level Loader and
         error copy above, so the table only distinguishes empty from default. -->
    <Table title="Bank accounts" columns={accountColumns} rows={accountTableRows} state={accountTableRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={accountRowActions} pagination={accountsPagination} />
    <Table title="Raw bank lines" columns={rawColumns} rows={rawTableRows} state={isLoadingState(rawState) ? "loading" : rawState.status === "error" ? "error" : rawTableRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={rawRowActions} pagination={rawPagination} />
    {#if movingRawLineId !== null}
      <section class="bank-account-form ehq-edge-surface" aria-label="Move a bank line to another account">
        <Select
          id="office-bank-raw-move-account"
          label="Move to account"
          value={moveTargetAccountId}
          options={moveAccountOptions}
          state="default"
          message=""
          onchange={(value: string): void => { moveTargetAccountId = value; }}
        />
        <Button label="Confirm" variant="primary" size="medium" type="button" disabled={!props.writesEnabled || moveTargetAccountId.length === 0} loading={false} locked={false} focus={false} ariaLabel="Confirm move to account" title={props.writesEnabled ? "" : "Enable writes to move a bank line."} onclick={confirmMoveRawLine} />
        <Button label="Cancel" variant="secondary" size="medium" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel="Cancel moving the bank line" onclick={cancelMoveRawLine} />
      </section>
    {/if}
    {#if rawActionMessage !== null}
      <Alert
        tone={rawActionStatus === "error" ? "error" : "success"}
        title={rawActionStatus === "error" ? "Error" : "Operation successful"}
        message={rawActionMessage}
        dismissible={false}
      />
    {/if}
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
    { label: "Imported lines", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const rawColumns: readonly TableColumn[] = [
    { label: "Date", align: "left", sortable: true },
    { label: "Description", align: "left", sortable: true },
    { label: "Reference", align: "left", sortable: true },
    { label: "Direction", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true },
    { label: "Amount (MUR)", align: "right", sortable: true },
    { label: "Duplicate", align: "left", sortable: true },
    { label: "Reconciliation", align: "left", sortable: true }
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
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  .state-copy.error strong {
    color: var(--ehq-error);
  }

  .dashboard-grid {
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  @media (max-width: 1100px) {
    .kpi-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }

    .kpi-grid {
      grid-template-columns: 1fr;
    }
  }

  .bank-account-form {
    padding: var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--ehq-space-3);
  }

  .bank-account-actions {
    display: flex;
    gap: var(--ehq-space-2);
    margin-left: auto;
  }

</style>
