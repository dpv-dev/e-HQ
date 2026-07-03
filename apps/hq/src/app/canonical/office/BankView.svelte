<script lang="ts">
  import {
    Button,
    Input,
    KPI,
    Loader,
    Select,
    Table,
    type SelectOption,
    type TablePagination,
    type TableRow,
    type TableRowAction,
    type Tone
  } from "@ehq/ui";
  import {
    createErrorState,
    createIdleState,
    createLoadingState,
    createSuccessState,
    type ApiRequestState,
    type CurrencyCode,
    type OfficeApiClient,
    type OfficeBankAccountSummary,
    type OfficeBankAccountWriteRequest,
    type OfficeBankQualityResponse,
    type OfficeBankRawLine,
    type OfficeReconciliationCandidate,
    type PageResult
  } from "@ehq/api-client";
  import { formatDateOnly } from "../../date-format.js";
  import { formatMoneyValue, formatSignedMoneyValue, moneyToneForValue } from "../../money-format.js";
  import { appendPageResult, createTablePagination, readPageItems, TABLE_PAGE_SIZE } from "../../table-pagination.js";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
    readonly writesEnabled: boolean;
  }

  interface BankKpi {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly accent: boolean;
  }

  type RequestStatus = "idle" | "loading" | "success" | "error";

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
  const accountRowActions = $derived<readonly TableRowAction[]>([
    { label: "Éditer", onAction: startEditAccount },
    { label: "Supprimer", onAction: deleteAccountById, danger: true }
  ]);

  let bankFormName = $state("");
  let bankFormLabel = $state("");
  let bankFormCurrency = $state<CurrencyCode>("MUR");
  let bankFormActive = $state(true);
  let editingAccountId = $state<string | null>(null);
  let accountSubmitStatus = $state<RequestStatus>("idle");
  let accountSubmitMessage = $state<string | null>(null);
  let reconciliationActionStatus = $state<RequestStatus>("idle");
  let reconciliationActionMessage = $state<string | null>(null);
  let accountsNextCursor = $state<string | null>(null);
  let accountsLoadingMore = $state(false);
  let accountsLoadMoreError = $state<string | null>(null);
  let rawNextCursor = $state<string | null>(null);
  let rawLoadingMore = $state(false);
  let rawLoadMoreError = $state<string | null>(null);
  let reconciliationNextCursor = $state<string | null>(null);
  let reconciliationLoadingMore = $state(false);
  let reconciliationLoadMoreError = $state<string | null>(null);

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

  async function deleteAccountById(accountId: string): Promise<void> {
    if (!props.writesEnabled) {
      accountSubmitStatus = "error";
      accountSubmitMessage = "Activez les écritures pour supprimer un compte bancaire.";
      return;
    }

    if (accountSubmitStatus === "loading") {
      return;
    }

    const account = accountRows.find((row: OfficeBankAccountSummary): boolean => row.id === accountId);
    if (account === undefined) {
      accountSubmitStatus = "error";
      accountSubmitMessage = "Compte bancaire introuvable dans la liste chargée.";
      return;
    }

    const confirmed = globalThis.confirm(
      `Supprimer ${account.bankName} · ${account.accountLabel} et toutes ses lignes bancaires importées ?`
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
      accountSubmitMessage = "Compte bancaire et lignes liées supprimés.";
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
      accountSubmitMessage = accountId === null ? "Compte bancaire créé." : "Compte bancaire mis à jour.";
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
      return "Activez les écritures pour modifier les comptes bancaires.";
    }

    if (accountSubmitStatus === "loading") {
      return "Enregistrement en cours.";
    }

    if (!accountFormComplete) {
      return "Renseignez la banque et le libellé du compte.";
    }

    return "";
  }

  // Reconciliation candidate rows are keyed by candidate id, but the
  // unmatch/reject endpoints address the bank statement line — resolve it first.
  function reconciliationLineIdFor(candidateId: string): string | null {
    return (
      reconciliationRows.find((candidate: OfficeReconciliationCandidate): boolean => candidate.id === candidateId)
        ?.statementLineId ?? null
    );
  }

  // Shared write path for the per-row reconciliation actions: gate on the write
  // lock, run the call, then reload the bank data so the queue reflects reality.
  async function runReconciliationAction(action: () => Promise<unknown>, successMessage: string): Promise<void> {
    if (!props.writesEnabled) {
      reconciliationActionStatus = "error";
      reconciliationActionMessage = "Activez les écritures pour agir sur les candidats de rapprochement.";
      return;
    }

    if (reconciliationActionStatus === "loading") {
      return;
    }

    reconciliationActionStatus = "loading";
    reconciliationActionMessage = null;

    try {
      await action();
      await loadBank();
      reconciliationActionStatus = "success";
      reconciliationActionMessage = successMessage;
    } catch (error: unknown) {
      // Action failures stay on the status line; reconciliationState keeps the loaded list.
      reconciliationActionStatus = "error";
      reconciliationActionMessage = getErrorMessage(error);
    }
  }

  async function approveReconciliationById(candidateId: string): Promise<void> {
    await runReconciliationAction(
      (): Promise<unknown> =>
        props.client.approveReconciliations(
          {
            workspaceId: props.workspaceId,
            reconciliationIds: [candidateId],
            approvedAt: new Date().toISOString()
          },
          { idempotencyKey: crypto.randomUUID() }
        ),
      "Rapprochement approuvé."
    );
  }

  async function unmatchReconciliationById(candidateId: string): Promise<void> {
    const statementLineId = reconciliationLineIdFor(candidateId);
    if (statementLineId === null) {
      reconciliationActionStatus = "error";
      reconciliationActionMessage = "Ligne bancaire introuvable pour ce candidat — recharge la page Bank.";
      return;
    }
    await runReconciliationAction(
      (): Promise<unknown> =>
        props.client.unmatchReconciliation(
          { workspaceId: props.workspaceId, statementLineId },
          { idempotencyKey: crypto.randomUUID() }
        ),
      "Match annulé."
    );
  }

  async function rejectReconciliationById(candidateId: string): Promise<void> {
    const statementLineId = reconciliationLineIdFor(candidateId);
    if (statementLineId === null) {
      reconciliationActionStatus = "error";
      reconciliationActionMessage = "Ligne bancaire introuvable pour ce candidat — recharge la page Bank.";
      return;
    }
    await runReconciliationAction(
      (): Promise<unknown> =>
        props.client.rejectReconciliation(
          { workspaceId: props.workspaceId, statementLineId },
          { idempotencyKey: crypto.randomUUID() }
        ),
      "Candidat rejeté."
    );
  }

  const reconciliationRowActions = $derived<readonly TableRowAction[]>([
    { label: "Accepter", onAction: approveReconciliationById },
    { label: "Annuler match", onAction: unmatchReconciliationById },
    { label: "Rejeter", onAction: rejectReconciliationById, danger: true }
  ]);
  const rawTableRows = $derived(createRawTableRows(rawRows));
  const accountsPagination = $derived<TablePagination | null>(
    createTablePagination(accountsState, accountsLoadingMore, accountsLoadMoreError, loadMoreAccounts, loadAllAccounts)
  );
  const rawPagination = $derived<TablePagination | null>(
    createTablePagination(rawState, rawLoadingMore, rawLoadMoreError, loadMoreRawLines, loadAllRawLines)
  );
  const reconciliationTableRows = $derived(createReconciliationTableRows(reconciliationRows));
  const reconciliationPagination = $derived<TablePagination | null>(
    createTablePagination(
      reconciliationState,
      reconciliationLoadingMore,
      reconciliationLoadMoreError,
      loadMoreReconciliations,
      loadAllReconciliations
    )
  );

  // $effect (not onMount): re-runs on props.workspaceId/props.period change.
  $effect((): void => {
    void loadBank();
  });

  async function loadBank(): Promise<void> {
    accountsState = createLoadingState<PageResult<OfficeBankAccountSummary>>();
    rawState = createLoadingState<PageResult<OfficeBankRawLine>>();
    qualityState = createLoadingState<OfficeBankQualityResponse>();
    reconciliationState = createLoadingState<PageResult<OfficeReconciliationCandidate>>();

    try {
      const [accounts, raw, quality, reconciliations] = await Promise.all([
        props.client.listBankAccounts({ workspaceId: props.workspaceId, cursor: null, limit: TABLE_PAGE_SIZE }),
        props.client.listBankRawLines({
          workspaceId: props.workspaceId,
          period: null,
          accountId: null,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        }),
        props.client.getBankQuality({ workspaceId: props.workspaceId, period: props.period }),
        props.client.listReconciliations({
          workspaceId: props.workspaceId,
          accountId: null,
          period: props.period,
          status: null,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      ]);
      accountsState = createSuccessState<PageResult<OfficeBankAccountSummary>>(accounts);
      accountsNextCursor = accounts.nextCursor;
      accountsLoadMoreError = null;
      rawState = createSuccessState<PageResult<OfficeBankRawLine>>(raw);
      rawNextCursor = raw.nextCursor;
      rawLoadMoreError = null;
      qualityState = createSuccessState<OfficeBankQualityResponse>(quality);
      reconciliationState = createSuccessState<PageResult<OfficeReconciliationCandidate>>(reconciliations);
      reconciliationNextCursor = reconciliations.nextCursor;
      reconciliationLoadMoreError = null;
    } catch (error: unknown) {
      accountsState = createErrorState<PageResult<OfficeBankAccountSummary>>(error);
      rawState = createErrorState<PageResult<OfficeBankRawLine>>(error);
      qualityState = createErrorState<OfficeBankQualityResponse>(error);
      reconciliationState = createErrorState<PageResult<OfficeReconciliationCandidate>>(error);
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
          period: null,
          accountId: null,
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

  async function loadMoreReconciliations(): Promise<void> {
    await loadReconciliationsPage("one");
  }

  async function loadAllReconciliations(): Promise<void> {
    await loadReconciliationsPage("all");
  }

  async function loadReconciliationsPage(mode: "one" | "all"): Promise<void> {
    if (reconciliationState.status !== "success" || reconciliationNextCursor === null || reconciliationLoadingMore) {
      return;
    }

    reconciliationLoadingMore = true;
    reconciliationLoadMoreError = null;

    try {
      let nextCursor: string | null = reconciliationNextCursor;
      let loaded: PageResult<OfficeReconciliationCandidate> = reconciliationState.data;

      while (nextCursor !== null) {
        const nextPage = await props.client.listReconciliations({
          workspaceId: props.workspaceId,
          accountId: null,
          period: props.period,
          status: null,
          cursor: nextCursor,
          limit: TABLE_PAGE_SIZE
        });
        loaded = appendPageResult(loaded, nextPage);
        reconciliationState = createSuccessState<PageResult<OfficeReconciliationCandidate>>(loaded);
        reconciliationNextCursor = nextPage.nextCursor;
        nextCursor = nextPage.nextCursor;

        if (mode === "one") {
          break;
        }
      }
    } catch (error: unknown) {
      reconciliationLoadMoreError = getErrorMessage(error);
    } finally {
      reconciliationLoadingMore = false;
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

  function createReconciliationTableRows(rows: readonly OfficeReconciliationCandidate[]): readonly TableRow[] {
    return rows.map((candidate: OfficeReconciliationCandidate): TableRow => ({
      id: candidate.id,
      cells: [
        { kind: "text", value: candidate.bankDescription, strong: true },
        { kind: "text", value: formatDateOnly(candidate.occurredOn), strong: false },
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
    <section class="bank-account-form ehq-edge-surface" aria-label={editingAccountId === null ? "Ajouter un compte bancaire" : "Éditer le compte bancaire"}>
      <Input
        id="bank-account-name"
        label="Banque"
        value={bankFormName}
        placeholder="MCB"
        type="text"
        state="default"
        message=""
        oninput={(value: string): void => { bankFormName = value; }}
      />
      <Input
        id="bank-account-label"
        label="Libellé du compte"
        value={bankFormLabel}
        placeholder="MCB EUR"
        type="text"
        state="default"
        message=""
        oninput={(value: string): void => { bankFormLabel = value; }}
      />
      <Select
        id="bank-account-currency"
        label="Devise"
        value={bankFormCurrency}
        options={currencyOptions}
        state="default"
        message=""
        onchange={(value: string): void => { bankFormCurrency = value; }}
      />
      <label class="bank-account-active">
        <input type="checkbox" bind:checked={bankFormActive} />
        <span class="ehq-type-label-mono">Actif</span>
      </label>
      <div class="bank-account-actions">
        <Button
          label={accountSubmitStatus === "loading" ? "Enregistrement…" : editingAccountId === null ? "Ajouter le compte" : "Enregistrer"}
          variant="primary"
          size="medium"
          type="button"
          disabled={!props.writesEnabled || !accountFormComplete}
          loading={accountSubmitStatus === "loading"}
          locked={false}
          focus={false}
          ariaLabel={editingAccountId === null ? "Ajouter le compte bancaire" : "Enregistrer le compte bancaire"}
          title={accountSubmitTitle()}
          onclick={submitAccountForm}
        />
        {#if editingAccountId !== null}
          <Button
            label="Annuler"
            variant="secondary"
            size="medium"
            type="button"
            disabled={false}
            loading={false}
            locked={false}
            focus={false}
            ariaLabel="Annuler l'édition du compte bancaire"
            onclick={resetAccountForm}
          />
        {/if}
      </div>
      {#if accountSubmitMessage !== null}
        <p class="form-message ehq-type-body" class:error={accountSubmitStatus === "error"} role="status">{accountSubmitMessage}</p>
      {/if}
    </section>
    <!-- This branch only renders when accountsState is idle or success: the
         loading and error statuses are handled by the view-level Loader and
         error copy above, so the table only distinguishes empty from default. -->
    <Table title="Bank accounts" columns={accountColumns} rows={accountTableRows} state={accountTableRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={accountRowActions} pagination={accountsPagination} />
    <Table title="Raw bank lines" columns={rawColumns} rows={rawTableRows} state={rawState.status === "loading" ? "loading" : rawState.status === "error" ? "error" : rawTableRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={rawPagination} />
    <Table title="Reconciliation candidates" columns={reconciliationColumns} rows={reconciliationTableRows} state={reconciliationState.status === "loading" ? "loading" : reconciliationState.status === "error" ? "error" : reconciliationTableRows.length === 0 ? "empty" : "default"} actionLabel="" rowActions={reconciliationRowActions} pagination={reconciliationPagination} />
    {#if reconciliationActionMessage !== null}
      <p class="form-message ehq-type-body" class:error={reconciliationActionStatus === "error"} role="status">{reconciliationActionMessage}</p>
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
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
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

  .bank-account-form {
    padding: var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--ehq-space-3);
  }

  .bank-account-active {
    display: flex;
    align-items: center;
    gap: var(--ehq-space-1);
  }

  .bank-account-actions {
    display: flex;
    gap: var(--ehq-space-2);
    margin-left: auto;
  }

  .form-message {
    flex-basis: 100%;
    margin: 0;
    color: var(--ehq-success);
  }

  .form-message.error {
    color: var(--ehq-error);
  }
</style>
