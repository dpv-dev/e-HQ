<script lang="ts">
  import {
    Alert,
    Badge,
    Button,
    Input,
    KPI,
    Loader,
    Select,
    Table,
    Toggle,
    type SelectOption,
    type TablePagination,
    type TableRow,
    type Tone
  } from "@ehq/ui";
  import {
    beginReload,
    createErrorState,
    createIdleState,
    createSuccessState,
    type ApiRequestState,
    type CurrencyCode,
    type EntityId,
    type OfficeApiClient,
    type OfficeProjectCoherenceViolation,
    type OfficeProjectPnl,
    type OfficeProjectWriteRequest,
    type OfficeProjectWriteStatus,
    type OfficeProjectPnlLine,
    type OfficeProjectSummary,
    type PageResult
  } from "@ehq/api-client";
  import { formatDateOnly } from "../../date-format.js";
  import { formatMoneyValue, moneyToneForValue } from "../../money-format.js";
  import { createTablePagination, loadPageResult, readPageItems, TABLE_PAGE_SIZE, type PageLoadMode } from "../../table-pagination.js";
  import { untrack } from "svelte";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
    readonly dateFrom: string;
    readonly dateTo: string;
    readonly writesEnabled: boolean;
  }

  interface ProjectKpi {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly accent: boolean;
  }

  type RequestStatus = "idle" | "loading" | "success" | "error";

  const props: Props = $props();
  const currency: CurrencyCode = "MUR";
  const projectStatusOptions: readonly SelectOption[] = [
    { label: "draft", value: "draft" },
    { label: "active", value: "active" },
    { label: "paused", value: "paused" },
    { label: "completed", value: "completed" },
    { label: "cancelled", value: "cancelled" },
    { label: "archived", value: "archived" }
  ];

  let projectsState = $state<ApiRequestState<PageResult<OfficeProjectSummary>>>(
    createIdleState<PageResult<OfficeProjectSummary>>()
  );
  let projectPnlState = $state<ApiRequestState<OfficeProjectPnl>>(createIdleState<OfficeProjectPnl>());
  let violationsState = $state<ApiRequestState<PageResult<OfficeProjectCoherenceViolation>>>(
    createIdleState<PageResult<OfficeProjectCoherenceViolation>>()
  );
  let projectsLoadingMore = $state(false);
  let projectsLoadMoreError = $state<string | null>(null);
  let violationsLoadingMore = $state(false);
  let violationsLoadMoreError = $state<string | null>(null);
  let selectedProjectId = $state<EntityId | null>(null);
  let projectFormName = $state("");
  let projectFormStatus = $state<OfficeProjectWriteStatus>("active");
  let projectFormDescription = $state("");
  let projectFormActive = $state(true);
  let editingProjectId = $state<string | null>(null);
  let projectSubmitStatus = $state<RequestStatus>("idle");
  let projectSubmitMessage = $state<string | null>(null);

  function projectWriteRequest(): OfficeProjectWriteRequest {
    return {
      workspaceId: props.workspaceId,
      name: projectFormName.trim(),
      status: projectFormStatus,
      description: projectFormDescription.trim().length > 0 ? projectFormDescription.trim() : null,
      active: projectFormActive
    };
  }

  // Clears the input fields only; the submit status/message stay owned by the
  // submit flow so the button remains disabled through the post-write reload.
  function resetProjectFormFields(): void {
    editingProjectId = null;
    projectFormName = "";
    projectFormStatus = "active";
    projectFormDescription = "";
    projectFormActive = true;
  }

  function resetProjectForm(): void {
    resetProjectFormFields();
    projectSubmitStatus = "idle";
    projectSubmitMessage = null;
  }

  function startEditProject(projectId: string): void {
    const project = projects.find((row: OfficeProjectSummary): boolean => row.id === projectId);
    if (project === undefined) {
      return;
    }
    editingProjectId = project.id;
    projectFormName = project.label;
    projectFormStatus = project.writeStatus;
    projectFormDescription = project.description ?? "";
    projectFormActive = project.active;
    projectSubmitStatus = "idle";
    projectSubmitMessage = null;
  }

  async function submitProjectForm(): Promise<void> {
    if (projectSubmitStatus === "loading") {
      return;
    }
    if (projectFormName.trim().length === 0) {
      return;
    }
    const projectId = editingProjectId;
    // One idempotency key per submit attempt; every call made for this attempt reuses it.
    const idempotencyKey = crypto.randomUUID();
    projectSubmitStatus = "loading";
    projectSubmitMessage = null;
    try {
      if (projectId === null) {
        await props.client.createProject(projectWriteRequest(), { idempotencyKey });
      } else {
        await props.client.updateProject(projectId, projectWriteRequest(), { idempotencyKey });
      }
      // Keep the status at "loading" through the reload so the submit button
      // stays disabled and the progress label holds until the list refreshes.
      resetProjectFormFields();
      await loadProjects();
      projectSubmitStatus = "success";
      projectSubmitMessage = projectId === null ? "Project created." : "Project updated.";
    } catch (error: unknown) {
      // Write failures stay on the form; projectsState keeps the loaded list.
      projectSubmitStatus = "error";
      projectSubmitMessage = getErrorMessage(error);
    }
  }

  // The submit button is disabled while the name is empty, so the empty guard
  // inside submitProjectForm can no longer be hit silently.
  const projectFormComplete = $derived(projectFormName.trim().length > 0);

  function projectSubmitTitle(): string {
    if (!props.writesEnabled) {
      return "Enable writes to edit projects.";
    }

    if (projectSubmitStatus === "loading") {
      return "Saving in progress.";
    }

    if (!projectFormComplete) {
      return "Enter the project name.";
    }

    return "";
  }

  function setProjectFormStatus(value: string): void {
    const allowed: readonly OfficeProjectWriteStatus[] = ["draft", "active", "paused", "completed", "cancelled", "archived"];
    const match = allowed.find((status: OfficeProjectWriteStatus): boolean => status === value);
    if (match === undefined) {
      throw new Error(`Unsupported project status option: ${value}`);
    }
    projectFormStatus = match;
  }

  const projects = $derived(readPageItems(projectsState));
  const selectedProject = $derived(readSelectedProject(projects, selectedProjectId));
  const projectPnl = $derived(readProjectPnl(projectPnlState));
  const violations = $derived(readPageItems(violationsState));
  const projectKpis = $derived(createProjectKpis(projectPnlState));
  const projectRows = $derived(createProjectRows(projects, selectedProjectId));
  const pnlRows = $derived(createPnlRows(projectPnl));
  const violationRows = $derived(createViolationRows(violations));
  const projectsPagination = $derived<TablePagination | null>(
    createTablePagination(projectsState, projectsLoadingMore, projectsLoadMoreError, loadMoreProjects, loadAllProjects)
  );
  const violationsPagination = $derived<TablePagination | null>(
    createTablePagination(violationsState, violationsLoadingMore, violationsLoadMoreError, loadMoreViolations, loadAllViolations)
  );

  // $effect (not onMount): re-runs if props.workspaceId ever changes.
  $effect((): void => {
    void loadProjects();
  });

  // Single owner of "fetch the selected project's PnL/violations": reacts to
  // selectedProjectId changing (row click, or auto-select below) AND to
  // props.period/dateFrom/dateTo changing (read synchronously inside
  // selectProject, before its first await) — so switching period actually
  // refetches the currently open project instead of freezing on the value
  // fetched at mount.
  $effect((): void => {
    const projectId = selectedProjectId;
    if (projectId !== null) {
      void selectProject(projectId);
    }
  });

  async function loadProjects(): Promise<void> {
    untrack((): void => {
      projectsState = beginReload<PageResult<OfficeProjectSummary>>(projectsState);
    });

    try {
      const page = await props.client.listProjects({
        workspaceId: props.workspaceId,
        period: props.period,
        dateFrom: props.dateFrom,
        dateTo: props.dateTo,
        status: "active",
        cursor: null,
        limit: TABLE_PAGE_SIZE
      });
      projectsState = createSuccessState<PageResult<OfficeProjectSummary>>(page);
      projectsLoadMoreError = null;
      const firstProject = page.items[0] ?? null;

      // Write-only: the selectProject effect above owns fetching. Only
      // auto-select when nothing is selected yet, so this does not override
      // an in-progress user selection if the project list ever reloads.
      if (firstProject !== null && selectedProjectId === null) {
        selectedProjectId = firstProject.id;
      }
    } catch (error: unknown) {
      projectsState = createErrorState<PageResult<OfficeProjectSummary>>(error);
    }
  }

  // Sequence token: discard a stale response if a newer selectProject() call
  // (row click, or the period-change effect above) started before this one's
  // request resolves (out-of-order network replies).
  let selectProjectToken = 0;

  async function selectProject(projectId: EntityId): Promise<void> {
    const token = ++selectProjectToken;
    selectedProjectId = projectId;
    untrack((): void => {
      projectPnlState = beginReload<OfficeProjectPnl>(projectPnlState);
      violationsState = beginReload<PageResult<OfficeProjectCoherenceViolation>>(violationsState);
    });

    try {
      const [projectPnlResult, violationsResult] = await Promise.all([
        props.client.getProjectPnl(projectId, {
          workspaceId: props.workspaceId,
          period: props.period,
          dateFrom: props.dateFrom,
          dateTo: props.dateTo
        }),
        props.client.listProjectCoherenceViolations(projectId, {
          workspaceId: props.workspaceId,
          cursor: null,
          limit: TABLE_PAGE_SIZE
        })
      ]);
      if (token !== selectProjectToken) {
        return;
      }
      projectPnlState = createSuccessState<OfficeProjectPnl>(projectPnlResult);
      violationsState = createSuccessState<PageResult<OfficeProjectCoherenceViolation>>(violationsResult);
      violationsLoadMoreError = null;
    } catch (error: unknown) {
      if (token !== selectProjectToken) {
        return;
      }
      projectPnlState = createErrorState<OfficeProjectPnl>(error);
      violationsState = createErrorState<PageResult<OfficeProjectCoherenceViolation>>(error);
    }
  }

  async function loadMoreProjects(): Promise<void> {
    await loadProjectsPage("one");
  }

  async function loadAllProjects(): Promise<void> {
    await loadProjectsPage("all");
  }

  async function loadProjectsPage(mode: PageLoadMode): Promise<void> {
    await loadPageResult(mode, {
      state: projectsState,
      loading: projectsLoadingMore,
      setLoading: (loading: boolean): void => {
        projectsLoadingMore = loading;
      },
      setError: (error: string | null): void => {
        projectsLoadMoreError = error;
      },
      setState: (state: ApiRequestState<PageResult<OfficeProjectSummary>>): void => {
        projectsState = state;
      },
      fetchPage: (cursor: string): Promise<PageResult<OfficeProjectSummary>> =>
        props.client.listProjects({
          workspaceId: props.workspaceId,
          period: props.period,
          dateFrom: props.dateFrom,
          dateTo: props.dateTo,
          status: "active",
          cursor,
          limit: TABLE_PAGE_SIZE
        })
    });
  }

  async function loadMoreViolations(): Promise<void> {
    await loadViolationsPage("one");
  }

  async function loadAllViolations(): Promise<void> {
    await loadViolationsPage("all");
  }

  async function loadViolationsPage(mode: PageLoadMode): Promise<void> {
    if (selectedProjectId === null) {
      return;
    }
    const projectId = selectedProjectId;

    await loadPageResult(mode, {
      state: violationsState,
      loading: violationsLoadingMore,
      setLoading: (loading: boolean): void => {
        violationsLoadingMore = loading;
      },
      setError: (error: string | null): void => {
        violationsLoadMoreError = error;
      },
      setState: (state: ApiRequestState<PageResult<OfficeProjectCoherenceViolation>>): void => {
        violationsState = state;
      },
      fetchPage: (cursor: string): Promise<PageResult<OfficeProjectCoherenceViolation>> =>
        props.client.listProjectCoherenceViolations(projectId, {
          workspaceId: props.workspaceId,
          cursor,
          limit: TABLE_PAGE_SIZE
        })
    });
  }

  function readProjectPnl(state: ApiRequestState<OfficeProjectPnl>): OfficeProjectPnl | null {
    if (state.status === "success") {
      return state.data;
    }

    return null;
  }

  function readSelectedProject(
    rows: readonly OfficeProjectSummary[],
    projectId: EntityId | null
  ): OfficeProjectSummary | null {
    if (projectId === null) {
      return null;
    }

    return rows.find((project: OfficeProjectSummary): boolean => project.id === projectId) ?? null;
  }

  function createProjectKpis(state: ApiRequestState<OfficeProjectPnl>): readonly ProjectKpi[] {
    if (state.status !== "success") {
      const detail = stateLabel(state);
      return [
        { label: "Income", value: "—", detail, tone: "muted", accent: true },
        { label: "Expense", value: "—", detail, tone: "muted", accent: false },
        { label: "Net", value: "—", detail, tone: "muted", accent: false },
        { label: "Receivable", value: "—", detail, tone: "muted", accent: false }
      ];
    }

    return [
      {
        label: "Income",
        value: formatMoneyMicro(state.data.incomeMicro),
        detail: state.data.period,
        tone: "success",
        accent: true
      },
      {
        label: "Expense",
        value: formatMoneyMicro(state.data.expenseMicro),
        detail: `${String(state.data.transactionCount)} server lines`,
        tone: "warning",
        accent: false
      },
      {
        label: "Net",
        value: formatMoneyMicro(state.data.netMicro),
        detail: state.data.period,
        tone: moneyTone(state.data.netMicro),
        accent: false
      },
      {
        label: "Receivable",
        value: formatMoneyMicro(state.data.receivableMicro),
        detail: `payable ${formatMoneyMicro(state.data.payableMicro)}`,
        tone: "info",
        accent: false
      }
    ];
  }

  function createProjectRows(
    rows: readonly OfficeProjectSummary[],
    projectId: EntityId | null
  ): readonly TableRow[] {
    return rows.map((project: OfficeProjectSummary): TableRow => ({
      id: project.id,
      cells: [
        { kind: "text", value: projectReferenceLabel(project), strong: true },
        { kind: "text", value: project.ownerLabel, strong: false },
        { kind: "money", value: formatMoneyMicro(project.periodIncomeMicro), tone: "success" },
        { kind: "money", value: formatMoneyMicro(project.periodExpenseMicro), tone: "warning" },
        { kind: "money", value: formatMoneyMicro(project.netMicro), tone: moneyTone(project.netMicro) },
        { kind: "badge", value: String(project.openViolationCount), tone: project.openViolationCount > 0 ? "warning" : "success" },
        { kind: "badge", value: project.id === projectId ? "selected" : project.status, tone: project.id === projectId ? "active" : "info" }
      ]
    }));
  }

  function createPnlRows(project: OfficeProjectPnl | null): readonly TableRow[] {
    if (project === null) {
      return [];
    }

    return project.lines.map((line: OfficeProjectPnlLine): TableRow => ({
      id: line.id,
      cells: [
        { kind: "text", value: line.label, strong: true },
        { kind: "text", value: line.categoryLabel, strong: false },
        { kind: "badge", value: line.type, tone: line.type === "income" ? "success" : "warning" },
        { kind: "text", value: String(line.transactionCount), strong: false },
        { kind: "money", value: formatMoneyMicro(line.amountMicro), tone: line.type === "income" ? "success" : "warning" }
      ]
    }));
  }

  function createViolationRows(rows: readonly OfficeProjectCoherenceViolation[]): readonly TableRow[] {
    return rows.map((violation: OfficeProjectCoherenceViolation): TableRow => ({
      id: violation.id,
      cells: [
        { kind: "badge", value: violation.severity, tone: violation.severity === "error" ? "error" : "warning" },
        { kind: "text", value: violation.rule, strong: true },
        { kind: "text", value: violation.message, strong: false },
        { kind: "badge", value: violation.exactFixPath, tone: "info" }
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

  function moneyTone(amountMicro: string): Tone {
    return moneyToneForValue(amountMicro);
  }

  function formatMoneyMicro(amountMicro: string): string {
    return formatMoneyValue(amountMicro, currency);
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return "Project request failed.";
  }
</script>

<section class="projects-view">
  <section class="kpi-grid" aria-label="Selected project indicators">
    {#each projectKpis as kpi (kpi.label)}
      <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={projectPnlState.status === "loading" ? "loading" : "default"} accent={kpi.accent} />
    {/each}
  </section>

  <section class="projects-layout">
    <aside class="project-list ehq-edge-surface" aria-label="Projects">
      <header>
        <div>
          <p>Projects</p>
          <strong>{projects.length} active</strong>
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
          ariaLabel="Refresh projects"
          onclick={loadProjects}
        />
      </header>

      <section class="project-form ehq-edge-surface" aria-label={editingProjectId === null ? "Create a project" : "Edit project"}>
        <Input
          id="project-form-name"
          label="Project name"
          value={projectFormName}
          placeholder="Album launch"
          type="text"
          state="default"
          message=""
          oninput={(value: string): void => { projectFormName = value; }}
        />
        <Select
          id="project-form-status"
          label="Status"
          value={projectFormStatus}
          options={projectStatusOptions}
          state="default"
          message=""
          onchange={setProjectFormStatus}
        />
        <Input
          id="project-form-description"
          label="Description"
          value={projectFormDescription}
          placeholder="Optional"
          type="text"
          state="default"
          message=""
          oninput={(value: string): void => { projectFormDescription = value; }}
        />
        <Toggle
          id="project-form-active"
          label="Active"
          checked={projectFormActive}
          disabled={false}
          onchange={(checked: boolean): void => { projectFormActive = checked; }}
        />
        <div class="project-form-actions">
          <Button
            label={projectSubmitStatus === "loading" ? "Saving…" : editingProjectId === null ? "Create project" : "Save"}
            variant="primary"
            size="medium"
            type="button"
            disabled={!props.writesEnabled || !projectFormComplete}
            loading={projectSubmitStatus === "loading"}
            locked={false}
            focus={false}
            ariaLabel={editingProjectId === null ? "Create project" : "Save project"}
            title={projectSubmitTitle()}
            onclick={submitProjectForm}
          />
          {#if editingProjectId !== null}
            <Button
              label="Cancel"
              variant="secondary"
              size="medium"
              type="button"
              disabled={false}
              loading={false}
              locked={false}
              focus={false}
              ariaLabel="Cancel project edit"
              onclick={resetProjectForm}
            />
          {/if}
        </div>
        {#if projectSubmitMessage !== null}
          <Alert
            tone={projectSubmitStatus === "error" ? "error" : "success"}
            title={projectSubmitStatus === "error" ? "Error" : "Success"}
            message={projectSubmitMessage}
            dismissible={false}
          />
        {/if}
      </section>

      {#if projectsState.status === "loading"}
        <Loader label="Loading projects" detail="Reading active projects." size="medium" />
      {:else if projectsState.status === "error"}
        <div class="state-copy error">
          <strong>Projects unavailable</strong>
          <span>{getErrorMessage(projectsState.error)}</span>
        </div>
      {:else}
        <div class="project-buttons">
          {#each projects as project (project.id)}
            <button
              class="ehq-edge-surface"
              class:selected={selectedProjectId === project.id}
              type="button"
              onclick={() => { selectedProjectId = project.id; }}
            >
              <strong>{project.label}</strong>
              <span>{projectReferenceLabel(project)} · {project.ownerLabel}</span>
              <small>{formatDateOnly(project.lastActivityOn)} · {project.openViolationCount} open checks</small>
            </button>
          {/each}
        </div>
      {/if}
    </aside>

    <section class="project-detail ehq-edge-surface" aria-label="Selected project detail">
      <header>
        <div>
          <p>Server P&L</p>
          <h2>{selectedProject?.label ?? "Select a project"}</h2>
          <span>Validated project projection from Office.</span>
        </div>
        {#if selectedProject !== null}
          <div class="project-detail-actions">
            <Badge label={selectedProject.status} tone="info" />
            <Button
              label="Edit"
              variant="secondary"
              size="small"
              type="button"
              disabled={false}
              loading={false}
              locked={false}
              focus={false}
              ariaLabel="Edit selected project"
              onclick={() => startEditProject(selectedProject.id)}
            />
          </div>
        {/if}
      </header>

      {#if projectPnlState.status === "loading"}
        <Loader label="Loading project P&L" detail="Reading validated project projection." size="medium" />
      {:else if projectPnlState.status === "error"}
        <div class="state-copy error">
          <strong>Project P&L unavailable</strong>
          <span>{getErrorMessage(projectPnlState.error)}</span>
        </div>
      {:else}
        <Table title="Project P&L lines" columns={pnlColumns} rows={pnlRows} state={pnlRows.length === 0 ? "empty" : "default"} actionLabel="" />
      {/if}
    </section>
  </section>

  <Table title="Active projects" columns={projectColumns} rows={projectRows} state={projectsState.status === "loading" ? "loading" : projectsState.status === "error" ? "error" : projectRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={projectsPagination} />
  <Table title="Coherence violations" columns={violationColumns} rows={violationRows} state={violationsState.status === "loading" ? "loading" : violationsState.status === "error" ? "error" : violationRows.length === 0 ? "empty" : "default"} actionLabel="" pagination={violationsPagination} />
</section>

<script module lang="ts">
  import type { TableColumn } from "@ehq/ui";

  const projectColumns: readonly TableColumn[] = [
    { label: "Project", align: "left", sortable: true },
    { label: "Owner", align: "left", sortable: true },
    { label: "Income", align: "right", sortable: true },
    { label: "Expense", align: "right", sortable: true },
    { label: "Net", align: "right", sortable: true },
    { label: "Checks", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true }
  ];
  const pnlColumns: readonly TableColumn[] = [
    { label: "Line", align: "left", sortable: true },
    { label: "Category", align: "left", sortable: true },
    { label: "Type", align: "left", sortable: true },
    { label: "Count", align: "left", sortable: true },
    { label: "Amount", align: "right", sortable: true }
  ];
  const violationColumns: readonly TableColumn[] = [
    { label: "Severity", align: "left", sortable: true },
    { label: "Rule", align: "left", sortable: true },
    { label: "Message", align: "left", sortable: true },
    { label: "Fix path", align: "left", sortable: true }
  ];

  function projectReferenceLabel(project: OfficeProjectSummary): string {
    const code = project.code.trim();

    if (code.length === 0 || code === project.id || isUuidLike(code)) {
      return project.label;
    }

    return `${code} · ${project.label}`;
  }

  function isUuidLike(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }
</script>

<style>
  .projects-view {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-4);
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--ehq-space-3);
  }

  .projects-layout {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(260px, 0.36fr) minmax(0, 1fr);
    gap: var(--ehq-space-4);
    align-items: start;
  }

  .project-list,
  .project-form {
    padding: var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
    display: grid;
    gap: var(--ehq-space-2);
    margin-bottom: var(--ehq-space-3);
  }

  .project-form-actions,
  .project-detail-actions {
    display: flex;
    gap: var(--ehq-space-2);
    align-items: center;
  }

  .project-detail {
    min-width: 0;
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    overflow: visible;
  }

  .project-list > header,
  .project-detail > header {
    padding: var(--ehq-space-3);
    border-bottom: 1px solid var(--ehq-border-soft);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-3);
  }

  .project-detail > header {
    align-items: start;
  }

  .project-buttons {
    padding: var(--ehq-space-3);
    display: grid;
    gap: var(--ehq-space-2);
  }

  .project-buttons button {
    min-width: 0;
    min-height: 92px;
    padding: var(--ehq-space-3);
    border: 0;
    background: transparent;
    color: var(--ehq-text);
    font: inherit;
    display: grid;
    gap: var(--ehq-space-1);
    text-align: left;
  }

  .project-buttons button:hover,
  .project-buttons button.selected {
    --ehq-edge-border-color: var(--ehq-yellow-border);
  }

  p,
  h2,
  strong,
  span,
  small {
    margin: 0;
  }

  p,
  small {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    text-transform: uppercase;
  }

  h2 {
    margin-top: var(--ehq-space-1);
    font-weight: var(--ehq-type-heading-weight);
    font-size: var(--ehq-type-section-title-size);
  }

  .project-detail > header span,
  .project-buttons span,
  .state-copy span {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-body-weight);
    line-height: var(--ehq-type-ui-line);
  }

  .state-copy {
    min-height: 220px;
    padding: var(--ehq-space-5);
    display: grid;
    place-items: center;
    gap: var(--ehq-space-2);
    text-align: center;
  }

  .state-copy.error strong {
    color: var(--ehq-error);
  }

  @media (max-width: 1100px) {
    .kpi-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .projects-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 680px) {
    .kpi-grid {
      grid-template-columns: 1fr;
    }

    .project-list > header,
    .project-detail > header {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
