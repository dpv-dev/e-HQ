<script lang="ts">
  import { onMount } from "svelte";
  import {
    Badge,
    KPI,
    Loader,
    Table,
    type TableColumn,
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
    type OfficeProjectPnlLine,
    type OfficeProjectSummary,
    type PageResult
  } from "@ehq/api-client";
  import { formatMoneyValue, moneyToneForValue } from "../../money-format.js";

  interface Props {
    readonly client: OfficeApiClient;
    readonly workspaceId: string;
    readonly period: string;
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
  let selectedProjectId = $state<EntityId | null>(null);

  const projects = $derived(readPageItems(projectsState));
  const selectedProject = $derived(readSelectedProject(projects, selectedProjectId));
  const projectPnl = $derived(readProjectPnl(projectPnlState));
  const violations = $derived(readPageItems(violationsState));
  const projectKpis = $derived(createProjectKpis(projectPnlState));
  const projectRows = $derived(createProjectRows(projects, selectedProjectId));
  const pnlRows = $derived(createPnlRows(projectPnl));
  const violationRows = $derived(createViolationRows(violations));

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
        limit: 50
      });
      projectsState = createSuccessState<PageResult<OfficeProjectSummary>>(page);
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
          period: props.period
        }),
        props.client.listProjectCoherenceViolations(projectId, {
          workspaceId: props.workspaceId,
          cursor: null,
          limit: 50
        })
      ]);
      projectPnlState = createSuccessState<OfficeProjectPnl>(projectPnlResult);
      violationsState = createSuccessState<PageResult<OfficeProjectCoherenceViolation>>(violationsResult);
    } catch (error: unknown) {
      projectPnlState = createErrorState<OfficeProjectPnl>(error);
      violationsState = createErrorState<PageResult<OfficeProjectCoherenceViolation>>(error);
    }
  }

  function readPageItems<TItem>(state: ApiRequestState<PageResult<TItem>>): readonly TItem[] {
    if (state.status === "success") {
      return state.data.items;
    }

    return [];
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
        detail: state.data.validatedProjectionId,
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
        { kind: "text", value: `${project.code} · ${project.label}`, strong: true },
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
        { kind: "text", value: violation.relatedEntityId ?? "—", strong: false }
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
              <span>{project.code} · {project.ownerLabel}</span>
              <small>{project.lastActivityOn ?? "No activity"} · {project.openViolationCount} open checks</small>
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
          <Badge label={selectedProject.status} tone="info" />
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

  <Table title="Active projects" columns={projectColumns} rows={projectRows} state={projectsState.status === "loading" ? "loading" : projectsState.status === "error" ? "error" : projectRows.length === 0 ? "empty" : "default"} actionLabel="" />
  <Table title="Coherence violations" columns={violationColumns} rows={violationRows} state={violationsState.status === "loading" ? "loading" : violationsState.status === "error" ? "error" : violationRows.length === 0 ? "empty" : "default"} actionLabel="" />
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
    { label: "Entity", align: "left", sortable: true }
  ];
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
    font-size: 10px;
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
    font-size: 10px;
    font-weight: var(--ehq-type-label-weight);
    text-transform: uppercase;
  }

  h2 {
    margin-top: var(--ehq-space-1);
    font-weight: var(--ehq-type-heading-weight);
    font-size: var(--ehq-h2);
  }

  .project-detail > header span,
  .project-buttons span,
  .state-copy span {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: 13px;
    font-weight: var(--ehq-type-body-weight);
    line-height: 1.5;
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
