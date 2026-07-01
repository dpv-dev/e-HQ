<script lang="ts">
  import { onMount } from "svelte";
  import {
    Badge,
    KPI,
    Loader,
    Table,
    type TablePagination,
    type TableRow,
    type Tone
  } from "@ehq/ui";
  import {
    createErrorState,
    createIdleState,
    createLoadingState,
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

  const props: Props = $props();
  const currency: CurrencyCode = "MUR";

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

  function projectWriteRequest(): OfficeProjectWriteRequest {
    return {
      workspaceId: props.workspaceId,
      name: projectFormName.trim(),
      status: projectFormStatus,
      description: projectFormDescription.trim().length > 0 ? projectFormDescription.trim() : null,
      active: projectFormActive
    };
  }

  function resetProjectForm(): void {
    editingProjectId = null;
    projectFormName = "";
    projectFormStatus = "active";
    projectFormDescription = "";
    projectFormActive = true;
  }

  function startEditProject(projectId: string): void {
    const project = projects.find((row: OfficeProjectSummary): boolean => row.id === projectId);
    if (project === undefined) {
      return;
    }
    editingProjectId = project.id;
    projectFormName = project.label;
    projectFormStatus = project.status;
    projectFormActive = true;
  }

  async function submitProjectForm(): Promise<void> {
    if (projectFormName.trim().length === 0) {
      return;
    }
    const projectId = editingProjectId;
    try {
      if (projectId === null) {
        await props.client.createProject(projectWriteRequest(), { idempotencyKey: crypto.randomUUID() });
      } else {
        await props.client.updateProject(projectId, projectWriteRequest(), { idempotencyKey: crypto.randomUUID() });
      }
      resetProjectForm();
      await loadProjects();
    } catch (error: unknown) {
      projectsState = createErrorState<PageResult<OfficeProjectSummary>>(error);
    }
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

  onMount((): void => {
    void loadProjects();
  });

  async function loadProjects(): Promise<void> {
    projectsState = createLoadingState<PageResult<OfficeProjectSummary>>();

    try {
      const page = await props.client.listProjects({
        workspaceId: props.workspaceId,
        status: "active",
        cursor: null,
        limit: TABLE_PAGE_SIZE
      });
      projectsState = createSuccessState<PageResult<OfficeProjectSummary>>(page);
      projectsLoadMoreError = null;
      const firstProject = page.items[0] ?? null;

      if (firstProject !== null) {
        await selectProject(firstProject.id);
      }
    } catch (error: unknown) {
      projectsState = createErrorState<PageResult<OfficeProjectSummary>>(error);
    }
  }

  async function selectProject(projectId: EntityId): Promise<void> {
    selectedProjectId = projectId;
    projectPnlState = createLoadingState<OfficeProjectPnl>();
    violationsState = createLoadingState<PageResult<OfficeProjectCoherenceViolation>>();

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
      projectPnlState = createSuccessState<OfficeProjectPnl>(projectPnlResult);
      violationsState = createSuccessState<PageResult<OfficeProjectCoherenceViolation>>(violationsResult);
      violationsLoadMoreError = null;
    } catch (error: unknown) {
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
        { kind: "badge", value: violation.exactFixPath, tone: "info" },
        { kind: "text", value: violation.exactFixPath, strong: false }
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
        <button type="button" onclick={loadProjects}>Refresh</button>
      </header>

      <section class="project-form ehq-edge-surface" aria-label={editingProjectId === null ? "Créer un projet" : "Éditer le projet"}>
        <label>
          <span class="ehq-type-label-mono">Nom du projet</span>
          <input type="text" bind:value={projectFormName} placeholder="Album launch" />
        </label>
        <label>
          <span class="ehq-type-label-mono">Statut</span>
          <select bind:value={projectFormStatus}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <div class="project-form-actions">
          <button type="button" class="project-submit" disabled={!props.writesEnabled} onclick={submitProjectForm}>
            {editingProjectId === null ? "Créer le projet" : "Enregistrer"}
          </button>
          {#if editingProjectId !== null}
            <button type="button" class="project-cancel" onclick={resetProjectForm}>Annuler</button>
          {/if}
        </div>
      </section>

      {#if projectsState.status === "loading"}
        <Loader label="Loading projects" detail="Reading eof/v1/projects." size="medium" />
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
              onclick={() => selectProject(project.id)}
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
            <button type="button" class="project-edit" onclick={() => startEditProject(selectedProject.id)}>Éditer</button>
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
    { label: "Message", align: "left", sortable: false },
    { label: "Fix path", align: "left", sortable: true },
    { label: "Route", align: "left", sortable: true }
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

  .project-form label {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .project-form-actions,
  .project-detail-actions {
    display: flex;
    gap: var(--ehq-space-2);
    align-items: center;
  }

  .project-submit,
  .project-cancel,
  .project-edit {
    min-height: 32px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .project-submit {
    border-color: var(--ehq-yellow);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
  }

  .project-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .project-buttons button,
  .project-list > header button {
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
    font: inherit;
  }

  .project-buttons button {
    min-width: 0;
    min-height: 92px;
    padding: var(--ehq-space-3);
    border: 0;
    background: transparent;
    display: grid;
    gap: var(--ehq-space-1);
    text-align: left;
  }

  .project-buttons button:hover,
  .project-buttons button.selected {
    --ehq-edge-border-color: var(--ehq-yellow-border);
  }

  .project-list > header button:hover {
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .project-list > header button {
    min-height: 34px;
    padding: 0 var(--ehq-space-3);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    text-transform: uppercase;
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
