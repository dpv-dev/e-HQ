<script lang="ts">
  import {
    allWorkspaces,
    getWorkspaceAccess,
    type AuthSession,
    type WorkspaceAppId
  } from "@ehq/auth";
  import {
    createErrorState,
    createIdleState,
    createLoadingState,
    createSuccessState,
    type ApiRequestState,
    type DistributionDashboardResponse,
    type OfficeDashboardResponse
  } from "@ehq/api-client";
  import {
    Badge,
    BarsChart,
    DonutChart,
    KPI,
    LineChart,
    Panel,
    Table,
    Toolbar,
    type ChartPoint,
    type SelectOption,
    type TableColumn,
    type TableRow,
    type Tone,
    type ToolbarFilter
  } from "@ehq/ui";
  import { onMount } from "svelte";
  import { createShellApiClient } from "../../app-shell-data.js";
  import { getLatestDataPeriod, periodLabel } from "../../period-controls.js";
  import DevSessionMenu from "../../DevSessionMenu.svelte";

  type CommandCenterPageId = "dashboard" | "users" | "integrations" | "settings";
  type IntegrationStatus = "connected" | "idle" | "attention";

  interface Props {
    readonly session: AuthSession;
    readonly onLogout: () => void;
  }

  interface NavItem {
    readonly id: CommandCenterPageId;
    readonly label: string;
    readonly title: string;
    readonly subtitle: string;
  }

  interface ReadinessItem {
    readonly label: string;
    readonly detail: string;
    readonly tone: Tone;
  }

  interface IntegrationRow {
    readonly id: string;
    readonly connector: string;
    readonly kind: string;
    readonly scope: string;
    readonly status: IntegrationStatus;
    readonly action: string;
  }

  interface SettingRow {
    readonly id: string;
    readonly key: string;
    readonly value: string;
    readonly status: string;
    readonly tone: Tone;
  }

  interface CommandKpi {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly accent: boolean;
  }

  interface CommandPermissionUser {
    readonly userId: string;
    readonly email: string;
    readonly displayName: string;
    readonly initials: string;
    readonly roleLabel: string;
    readonly roleId: string;
    readonly status: "active" | "review";
    readonly session: AuthSession;
  }

  const { session, onLogout }: Props = $props();
  const client = createShellApiClient();
  const workspaceId = "eeee-mu";
  const period = getLatestDataPeriod();
  const navItems: readonly NavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      title: "Command Center dashboard",
      subtitle: "Ecosystem readiness, health signals, and action queue."
    },
    {
      id: "users",
      label: "Users & permissions",
      title: "Users & permissions",
      subtitle: "Allowed and denied app access from the shared auth model."
    },
    {
      id: "integrations",
      label: "Integrations",
      title: "Integrations",
      subtitle: "WordPress, MCP, and bank connector status."
    },
    {
      id: "settings",
      label: "Settings",
      title: "Settings",
      subtitle: "Workspace preferences for the admin and supervision surface."
    }
  ];

  const actionColumns: readonly TableColumn[] = [
    { label: "Action", align: "left", sortable: true },
    { label: "Context", align: "left", sortable: true },
    { label: "Volume", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "", align: "left", sortable: false }
  ];
  const permissionColumns: readonly TableColumn[] = [
    { label: "User", align: "left", sortable: true },
    { label: "Role", align: "left", sortable: true },
    { label: "Command Center", align: "left", sortable: true },
    { label: "Office", align: "left", sortable: true },
    { label: "Distribution", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "", align: "left", sortable: false }
  ];
  const integrationColumns: readonly TableColumn[] = [
    { label: "Connector", align: "left", sortable: true },
    { label: "Type", align: "left", sortable: true },
    { label: "Scope", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "", align: "left", sortable: false }
  ];
  const settingColumns: readonly TableColumn[] = [
    { label: "Setting", align: "left", sortable: true },
    { label: "Value", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "", align: "left", sortable: false }
  ];
  const roleOptions: readonly SelectOption[] = [
    { label: "Administrator", value: "administrator" },
    { label: "Operator", value: "operator" },
    { label: "Office", value: "office" },
    { label: "Distribution", value: "distribution" }
  ];
  const dashboardToolbar: readonly ToolbarFilter[] = [
    { label: "Scope", value: "All apps", active: true, disabled: false },
    { label: "Mode", value: "Read-only", active: false, disabled: false },
    { label: "Period", value: periodLabel(period), active: false, disabled: false }
  ];
  const usersToolbar: readonly ToolbarFilter[] = [
    { label: "Source", value: "@ehq/auth", active: true, disabled: false },
    { label: "Denied cards", value: "Visible", active: false, disabled: false },
    { label: "Hidden apps", value: "Never", active: false, disabled: false }
  ];
  const integrationToolbar: readonly ToolbarFilter[] = [
    { label: "Scope", value: "Platform", active: true, disabled: false },
    { label: "Writes", value: "Disabled", active: false, disabled: true },
    { label: "Network", value: "Status only", active: false, disabled: false }
  ];
  const settingsToolbar: readonly ToolbarFilter[] = [
    { label: "Workspace", value: "Command Center", active: true, disabled: false },
    { label: "Theme", value: "Dark", active: false, disabled: false },
    { label: "Release gate", value: "Manual", active: false, disabled: false }
  ];
  const integrations: readonly IntegrationRow[] = [
    {
      id: "wordpress",
      connector: "WordPress e-hq",
      kind: "REST / MCP",
      scope: "Office · Distribution",
      status: "connected",
      action: "Manage"
    },
    {
      id: "mcp",
      connector: "Project MCP",
      kind: "Scoped tools",
      scope: "ehq-platform only",
      status: "connected",
      action: "Inspect"
    },
    {
      id: "mcb",
      connector: "MCB statements",
      kind: "Bank connector",
      scope: "Office imports",
      status: "connected",
      action: "Manage"
    },
    {
      id: "sbi",
      connector: "SBI statements",
      kind: "Bank connector",
      scope: "Office imports",
      status: "idle",
      action: "Connect"
    }
  ];
  const settingRows: readonly SettingRow[] = [
    { id: "theme", key: "Theme", value: "Dark command center", status: "Locked", tone: "active" },
    { id: "permissions", key: "Permissions source", value: "@ehq/auth", status: "Shared", tone: "success" },
    { id: "navigation", key: "Navigation scope", value: "Command Center only", status: "Enforced", tone: "success" },
    { id: "release", key: "Release gate", value: "Manual approval", status: "Required", tone: "warning" }
  ];
  const revenuePoints: readonly ChartPoint[] = [
    { label: "Q1", value: 52 },
    { label: "Q2", value: 66 },
    { label: "Q3", value: 82 },
    { label: "Q4", value: 100 },
    { label: "YTD", value: 76 },
    { label: "Run", value: 88 }
  ];
  const healthPoints: readonly ChartPoint[] = [
    { label: "Mon", value: 72 },
    { label: "Tue", value: 78 },
    { label: "Wed", value: 74 },
    { label: "Thu", value: 86 },
    { label: "Fri", value: 83 },
    { label: "Sat", value: 91 }
  ];

  let activePageId = $state<CommandCenterPageId>("dashboard");
  let selectedRole = $state("administrator");
  let inviteEmail = $state("new.user@eeee.mu");
  let workspaceName = $state("ë • Entreprise");
  let commandNotice = $state("");
  let officeDashboardState = $state<ApiRequestState<OfficeDashboardResponse>>(createIdleState<OfficeDashboardResponse>());
  let distributionDashboardState = $state<ApiRequestState<DistributionDashboardResponse>>(
    createIdleState<DistributionDashboardResponse>()
  );

  const activePage = $derived(getNavItem(activePageId));
  const permissionUsers = $derived<readonly CommandPermissionUser[]>([createPermissionUser(session)]);
  const commandAccess = $derived(getWorkspaceAccess(session, "command-center"));
  const canUseCommandCenter = $derived(commandAccess.status === "allowed");
  const systemStatusLabel = $derived(createSystemStatusLabel(session));
  const readinessItems = $derived(createReadinessItems(officeDashboardState, distributionDashboardState));
  const dashboardKpis = $derived(createDashboardKpis(permissionUsers, integrations));
  const usersKpis = $derived(createUsersKpis(permissionUsers));
  const integrationKpis = $derived(createIntegrationKpis(integrations));
  const settingsKpis = $derived(createSettingsKpis(settingRows));
  const actionRows = $derived(createActionRows());
  const permissionRows = $derived(createPermissionRows(permissionUsers));
  const integrationRows = $derived(createIntegrationRows(integrations));
  const settingsRows = $derived(createSettingsRows(settingRows));

  onMount((): (() => void) => {
    syncPageFromLocation();
    window.addEventListener("popstate", syncPageFromLocation);
    void loadCommandReadiness();

    return (): void => {
      window.removeEventListener("popstate", syncPageFromLocation);
    };
  });

  async function loadCommandReadiness(): Promise<void> {
    officeDashboardState = createLoadingState<OfficeDashboardResponse>();
    distributionDashboardState = createLoadingState<DistributionDashboardResponse>();

    try {
      const [officeDashboard, distributionDashboard] = await Promise.all([
        client.office.getDashboard({
          workspaceId,
          period
        }),
        client.distribution.getDashboard({
          workspaceId,
          period
        })
      ]);
      officeDashboardState = createSuccessState<OfficeDashboardResponse>(officeDashboard);
      distributionDashboardState = createSuccessState<DistributionDashboardResponse>(distributionDashboard);
    } catch (error: unknown) {
      officeDashboardState = createErrorState<OfficeDashboardResponse>(error);
      distributionDashboardState = createErrorState<DistributionDashboardResponse>(error);
    }
  }

  $effect((): void => {
    if (!canUseCommandCenter) {
      redirectToHqLanding();
    }
  });

  function selectPage(pageId: CommandCenterPageId): void {
    activePageId = pageId;
    commandNotice = "";
    pushPagePath(pageId);
  }

  function syncPageFromLocation(): void {
    activePageId = readPageIdFromPath(window.location.pathname);
  }

  function pushPagePath(pageId: CommandCenterPageId): void {
    const nextPath = pagePath(pageId);
    const currentPath = window.location.pathname;

    if (currentPath === nextPath) {
      return;
    }

    window.history.pushState(null, "", `${nextPath}${window.location.search}`);
  }

  function readPageIdFromPath(pathname: string): CommandCenterPageId {
    if (pathname.endsWith("/console/command-center/users")) {
      return "users";
    }

    if (pathname.endsWith("/console/command-center/integrations")) {
      return "integrations";
    }

    if (pathname.endsWith("/console/command-center/settings")) {
      return "settings";
    }

    return "dashboard";
  }

  function pagePath(pageId: CommandCenterPageId): string {
    if (pageId === "users") {
      return "/console/command-center/users";
    }

    if (pageId === "integrations") {
      return "/console/command-center/integrations";
    }

    if (pageId === "settings") {
      return "/console/command-center/settings";
    }

    return "/console/command-center/dashboard";
  }

  function getNavItem(pageId: CommandCenterPageId): NavItem {
    const item = navItems.find((navItem: NavItem): boolean => navItem.id === pageId);

    if (item === undefined) {
      throw new Error(`Unknown Command Center page: ${pageId}`);
    }

    return item;
  }

  function createPermissionUser(activeSession: AuthSession): CommandPermissionUser {
    return {
      userId: activeSession.userId,
      email: activeSession.displayName,
      displayName: activeSession.displayName,
      initials: activeSession.initials,
      roleLabel: activeSession.roleLabel,
      roleId: activeSession.roleId,
      status: "active",
      session: activeSession
    };
  }

  function createReadinessItems(
    officeState: ApiRequestState<OfficeDashboardResponse>,
    distributionState: ApiRequestState<DistributionDashboardResponse>
  ): readonly ReadinessItem[] {
    return [
      {
        label: "Office API",
        detail: officeReadinessDetail(officeState),
        tone: requestStateTone(officeState)
      },
      {
        label: "Distribution API",
        detail: distributionReadinessDetail(distributionState),
        tone: requestStateTone(distributionState)
      },
      { label: "Auth gate", detail: "denied cards remain visible", tone: "success" },
      { label: "Review queue", detail: "permission review due this month", tone: "warning" }
    ];
  }

  function officeReadinessDetail(state: ApiRequestState<OfficeDashboardResponse>): string {
    if (state.status === "success") {
      return `${String(state.data.unreconciledTransactionCount)} unreconciled · eof/v1`;
    }

    return requestStateDetail(state);
  }

  function distributionReadinessDetail(state: ApiRequestState<DistributionDashboardResponse>): string {
    if (state.status === "success") {
      return `${String(state.data.suspenseCount)} suspense · erh/v1`;
    }

    return requestStateDetail(state);
  }

  function requestStateDetail<TData>(state: ApiRequestState<TData>): string {
    if (state.status === "loading") {
      return "loading live API";
    }

    if (state.status === "error") {
      return "live API unavailable";
    }

    return "waiting for live API";
  }

  function requestStateTone<TData>(state: ApiRequestState<TData>): Tone {
    if (state.status === "success") {
      return "success";
    }

    if (state.status === "error") {
      return "error";
    }

    return "warning";
  }

  function createDashboardKpis(
    users: readonly CommandPermissionUser[],
    rows: readonly IntegrationRow[]
  ): readonly CommandKpi[] {
    const deniedCount = countDeniedAccess(users);
    const connectedCount = rows.filter((row: IntegrationRow): boolean => row.status === "connected").length;

    return [
      { label: "Readiness", value: "86%", detail: "all workspaces visible", tone: "success", accent: true },
      { label: "Permission profiles", value: String(users.length), detail: "from @ehq/auth", tone: "info", accent: false },
      { label: "Denied cards", value: String(deniedCount), detail: "locked, never hidden", tone: "error", accent: false },
      { label: "Connectors", value: `${String(connectedCount)}/${String(rows.length)}`, detail: "healthy", tone: "success", accent: false }
    ];
  }

  function createUsersKpis(users: readonly CommandPermissionUser[]): readonly CommandKpi[] {
    return [
      { label: "Members", value: String(users.length), detail: "Supabase session", tone: "info", accent: true },
      { label: "Admins", value: String(countRole(users, "administrator")), detail: "Command Center access", tone: "success", accent: false },
      { label: "Denied app cards", value: String(countDeniedAccess(users)), detail: "red cross on HQ", tone: "error", accent: false },
      { label: "Review queue", value: String(countReviewUsers(users)), detail: "access audit", tone: "warning", accent: false }
    ];
  }

  function createIntegrationKpis(rows: readonly IntegrationRow[]): readonly CommandKpi[] {
    return [
      { label: "Connectors", value: String(rows.length), detail: "status only", tone: "info", accent: true },
      { label: "WordPress", value: "Connected", detail: "REST / MCP", tone: "success", accent: false },
      { label: "Banks", value: "2", detail: "Office import scope", tone: "info", accent: false },
      { label: "Remote writes", value: "Off", detail: "no deployment action", tone: "success", accent: false }
    ];
  }

  function createSettingsKpis(rows: readonly SettingRow[]): readonly CommandKpi[] {
    return [
      { label: "Workspace", value: "Admin", detail: "own app shell", tone: "active", accent: true },
      { label: "Settings", value: String(rows.length), detail: "local review", tone: "info", accent: false },
      { label: "Menu scope", value: "Clean", detail: "no cross-app menu", tone: "success", accent: false },
      { label: "Release gate", value: "Manual", detail: "approval required", tone: "warning", accent: false }
    ];
  }

  function createActionRows(): readonly TableRow[] {
    return [
      createTableRow("action_permissions", [
        { kind: "text", value: "Review permission requests", strong: true },
        { kind: "text", value: "Users & permissions", strong: false },
        { kind: "money", value: "3", tone: "warning" },
        { kind: "badge", value: "review", tone: "warning" },
        { kind: "action", value: "Open", tone: "active", locked: false }
      ]),
      createTableRow("action_integrations", [
        { kind: "text", value: "Inspect SBI connector", strong: true },
        { kind: "text", value: "Office bank imports", strong: false },
        { kind: "money", value: "1", tone: "muted" },
        { kind: "badge", value: "idle", tone: "muted" },
        { kind: "action", value: "Inspect", tone: "muted", locked: false }
      ]),
      createTableRow("action_settings", [
        { kind: "text", value: "Confirm release gate", strong: true },
        { kind: "text", value: "Settings", strong: false },
        { kind: "money", value: "1", tone: "warning" },
        { kind: "badge", value: "required", tone: "warning" },
        { kind: "action", value: "Review", tone: "muted", locked: false }
      ])
    ];
  }

  function createPermissionRows(users: readonly CommandPermissionUser[]): readonly TableRow[] {
    return users.map((user: CommandPermissionUser): TableRow =>
      createTableRow(user.userId, [
        { kind: "text", value: `${user.displayName} · ${user.email}`, strong: true },
        { kind: "text", value: user.roleLabel, strong: false },
        permissionCell(user, "command-center"),
        permissionCell(user, "office"),
        permissionCell(user, "distribution"),
        { kind: "badge", value: user.status, tone: user.status === "active" ? "success" : "warning" },
        { kind: "action", value: "Edit", tone: "muted", locked: false }
      ])
    );
  }

  function createIntegrationRows(rows: readonly IntegrationRow[]): readonly TableRow[] {
    return rows.map((row: IntegrationRow): TableRow =>
      createTableRow(row.id, [
        { kind: "text", value: row.connector, strong: true },
        { kind: "text", value: row.kind, strong: false },
        { kind: "text", value: row.scope, strong: false },
        { kind: "badge", value: row.status, tone: integrationTone(row.status) },
        { kind: "action", value: row.action, tone: row.status === "attention" ? "error" : "muted", locked: false }
      ])
    );
  }

  function createSettingsRows(rows: readonly SettingRow[]): readonly TableRow[] {
    return rows.map((row: SettingRow): TableRow =>
      createTableRow(row.id, [
        { kind: "text", value: row.key, strong: true },
        { kind: "text", value: row.value, strong: false },
        { kind: "badge", value: row.status, tone: row.tone },
        { kind: "action", value: "View", tone: "muted", locked: false }
      ])
    );
  }

  function createTableRow(id: string, cells: TableRow["cells"]): TableRow {
    return {
      id,
      cells
    };
  }

  function permissionCell(user: CommandPermissionUser, workspaceId: WorkspaceAppId): TableRow["cells"][number] {
    const access = getWorkspaceAccess(user.session, workspaceId);

    return {
      kind: "badge",
      value: access.status === "allowed" ? "allowed" : "denied",
      tone: access.status === "allowed" ? "success" : "error"
    };
  }

  function integrationTone(status: IntegrationStatus): Tone {
    if (status === "connected") {
      return "success";
    }

    if (status === "attention") {
      return "warning";
    }

    return "muted";
  }

  function countRole(users: readonly CommandPermissionUser[], roleId: string): number {
    return users.filter((user: CommandPermissionUser): boolean => user.roleId === roleId).length;
  }

  function countReviewUsers(users: readonly CommandPermissionUser[]): number {
    return users.filter((user: CommandPermissionUser): boolean => user.status === "review").length;
  }

  function countDeniedAccess(users: readonly CommandPermissionUser[]): number {
    return users.reduce((total: number, user: CommandPermissionUser): number => {
      const deniedForUser = allWorkspaces.filter(
        (workspaceId: WorkspaceAppId): boolean => getWorkspaceAccess(user.session, workspaceId).status === "locked"
      ).length;

      return total + deniedForUser;
    }, 0);
  }

  function createSystemStatusLabel(activeSession: AuthSession | null): string {
    if (activeSession === null) {
      return "public · no workspace scope";
    }

    const allowedScope = allWorkspaces
      .filter((workspaceId: WorkspaceAppId): boolean => getWorkspaceAccess(activeSession, workspaceId).status === "allowed")
      .map(formatWorkspaceScope)
      .join(" · ");

    return `${activeSession.roleLabel} · ${allowedScope.length > 0 ? allowedScope : "no workspace scope"}`;
  }

  function formatWorkspaceScope(workspaceId: WorkspaceAppId): string {
    if (workspaceId === "command-center") {
      return "command center";
    }

    return workspaceId;
  }

  function redirectToHqLanding(): void {
    const targetUrl = resolveHqLandingUrl();

    if (isCurrentLocation(targetUrl)) {
      return;
    }

    window.location.assign(targetUrl);
  }

  function resolveHqLandingUrl(): string {
    const configuredUrl = import.meta.env.VITE_EHQ_HQ_URL;

    if (typeof configuredUrl === "string" && configuredUrl.trim().length > 0) {
      return configuredUrl.trim();
    }

    return "/";
  }

  function isCurrentLocation(targetUrl: string): boolean {
    const resolvedTarget = new URL(targetUrl, window.location.href);

    return resolvedTarget.href === window.location.href;
  }

  function requestAccessReview(): void {
    commandNotice = "Access review prepared. Persisting this change belongs to the API layer.";
  }

  function saveSettingsReview(): void {
    commandNotice = "Settings checked locally. No deployment or remote write was triggered.";
  }

  function updateSelectedRole(event: Event): void {
    selectedRole = readSelectValue(event);
  }

  function updateInviteEmail(event: Event): void {
    inviteEmail = readInputValue(event);
  }

  function updateWorkspaceName(event: Event): void {
    workspaceName = readInputValue(event);
  }

  function readSelectValue(event: Event): string {
    const target = event.currentTarget;

    if (!(target instanceof HTMLSelectElement)) {
      throw new Error("Expected select event target.");
    }

    return target.value;
  }

  function readInputValue(event: Event): string {
    const target = event.currentTarget;

    if (!(target instanceof HTMLInputElement)) {
      throw new Error("Expected input event target.");
    }

    return target.value;
  }
</script>

<svelte:head>
  <title>ë • Command Center</title>
</svelte:head>

<main class="command-shell">
  <aside class="sidebar" aria-label="Command Center navigation">
    <button class="brand" type="button" onclick={() => selectPage("dashboard")}>
      <span>ë</span>
      <strong>ë • command</strong>
    </button>

    <nav>
      <h2>Command Center</h2>
      {#each navItems as item (item.id)}
        <button class="ehq-nav-fade-item ehq-edge-surface" class:active={activePageId === item.id} type="button" onclick={() => selectPage(item.id)}>
          <span aria-hidden="true"></span>
          {item.label}
        </button>
      {/each}
    </nav>

    <p class="system-status"><span aria-hidden="true"></span>{systemStatusLabel}</p>
  </aside>

  <section class="main-panel">
    <header class="topbar">
      <p><span>Command Center</span> / <strong>{activePage.label}</strong></p>
      <label class="search">
        <span>⌘K</span>
        <input aria-label="Search Command Center" placeholder="user, connector, setting..." />
      </label>
      <button class="notification" type="button" aria-label="Notifications">3</button>
      <DevSessionMenu {session} {onLogout} />
    </header>

    <div class="content">
      <section class="page-head">
        <p>Command Center</p>
        <h1>{activePage.title}</h1>
        <span>{activePage.subtitle}</span>
      </section>

      {#if commandNotice.length > 0}
        <p class="notice" role="status">{commandNotice}</p>
      {/if}

      {#if !canUseCommandCenter}
        <section class="redirecting-panel ehq-edge-surface" aria-label="Returning to HQ landing">
          <p>Returning to HQ landing</p>
          <h2>This profile opens workspaces from HQ.</h2>
          <span>Command Center remains available from the unlocked administrator card.</span>
        </section>
      {:else if activePageId === "dashboard"}
        <Toolbar label="Dashboard controls" filters={dashboardToolbar} actionLabel="" loading={false} />

        <section class="kpi-grid" aria-label="Command Center indicators">
          {#each dashboardKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state="default" accent={kpi.accent} />
          {/each}
        </section>

        <section class="dashboard-grid">
          <BarsChart title="Readiness by quarter" points={revenuePoints} tone="active" />
          <DonutChart title="Release readiness" value={86} label="Ready with manual release approval." tone="success" />
          <LineChart title="Health trend" points={healthPoints} tone="info" />
        </section>

        <section class="split-grid">
          <section class="readiness-panel ehq-edge-surface" aria-label="Readiness checks">
            <header>
              <h2>Readiness</h2>
              <p>Admin checks before any app release.</p>
            </header>
            <div class="check-list">
              {#each readinessItems as item (item.label)}
                <article class="ehq-edge-surface">
                  <Badge label={item.tone === "success" ? "ok" : "review"} tone={item.tone} />
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                </article>
              {/each}
            </div>
          </section>

          <Table title="Action list" columns={actionColumns} rows={actionRows} state="default" actionLabel="" />
        </section>
      {:else if activePageId === "users"}
        <Toolbar label="Permission controls" filters={usersToolbar} actionLabel="" loading={false} />

        <section class="kpi-grid" aria-label="Permission indicators">
          {#each usersKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state="default" accent={kpi.accent} />
          {/each}
        </section>

        <section class="permission-workbench">
          <section class="form-panel ehq-edge-surface" aria-label="Invite user">
            <h2>Access editor</h2>
            <p>Persisted permission changes belong behind the API layer.</p>
            <label class="field" for="invite-email">
              <span>Email</span>
              <input id="invite-email" value={inviteEmail} placeholder="user@eeee.mu" type="email" oninput={updateInviteEmail} />
            </label>
            <label class="field" for="invite-role">
              <span>Role</span>
              <select value={selectedRole} onchange={updateSelectedRole}>
                {#each roleOptions as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
            <button class="command-action" type="button" onclick={requestAccessReview}>Prepare review</button>
          </section>

          <section class="locked-card-reference ehq-edge-surface" aria-label="Locked card rule">
            <h2>HQ card rule</h2>
            <p>Denied workspaces are visible on HQ, locked with a red cross, and never silently hidden.</p>
            <div class="workspace-mini-grid">
              {#each allWorkspaces as workspaceId (workspaceId)}
                {@const access = getWorkspaceAccess(session, workspaceId)}
                <article class="ehq-edge-surface" class:locked={access.status === "locked"}>
                  <span>{access.status === "locked" ? "×" : "•"}</span>
                  <strong>{workspaceId}</strong>
                  <small>{access.status === "allowed" ? "allowed" : "denied"}</small>
                </article>
              {/each}
            </div>
          </section>
        </section>

        <Table title="Members" columns={permissionColumns} rows={permissionRows} state="default" actionLabel="" />
      {:else if activePageId === "integrations"}
        <Toolbar label="Integration controls" filters={integrationToolbar} actionLabel="" loading={false} />

        <section class="kpi-grid" aria-label="Integration indicators">
          {#each integrationKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state="default" accent={kpi.accent} />
          {/each}
        </section>

        <section class="integration-grid">
          <Panel
            title="WordPress"
            subtitle="Legacy data source status"
            body="Office eof/v1 and Distribution erh/v1 stay behind the typed API boundary. This screen displays connector health only."
            state="default"
            primaryAction="Inspect"
            secondaryAction=""
          />
          <Panel
            title="MCP"
            subtitle="Project-scoped tools"
            body="Enterprise context stays scoped to this repository. No global connector leak is introduced by the app shell."
            state="default"
            primaryAction="View scope"
            secondaryAction=""
          />
          <Panel
            title="Bank connectors"
            subtitle="Office import scope"
            body="MCB and SBI statement import status belongs to Office. Command Center watches readiness without parsing bank files."
            state="default"
            primaryAction="Open status"
            secondaryAction=""
          />
        </section>

        <Table title="Connectors" columns={integrationColumns} rows={integrationRows} state="default" actionLabel="" />
      {:else}
        <Toolbar label="Settings controls" filters={settingsToolbar} actionLabel="" loading={false} />

        <section class="kpi-grid" aria-label="Settings indicators">
          {#each settingsKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state="default" accent={kpi.accent} />
          {/each}
        </section>

        <section class="settings-grid">
          <section class="form-panel ehq-edge-surface" aria-label="Workspace settings">
            <h2>Workspace settings</h2>
            <p>Local controls only; saving here does not deploy or write remotely.</p>
            <label class="field" for="workspace-name">
              <span>Workspace name</span>
              <input id="workspace-name" value={workspaceName} placeholder="Workspace" type="text" oninput={updateWorkspaceName} />
            </label>
            <button class="command-action" type="button" onclick={saveSettingsReview}>Save review</button>
          </section>

          <Panel
            title="Supervision mode"
            subtitle="Admin workspace only"
            body="The Command Center menu is local to this app and does not appear inside Office or Distribution."
            state="default"
            primaryAction="Verified"
            secondaryAction=""
          />
        </section>

        <Table title="Preferences" columns={settingColumns} rows={settingsRows} state="default" actionLabel="" />
      {/if}
    </div>
  </section>
</main>

<style>
  :global(body) {
    overflow: hidden;
  }

  .command-shell {
    height: 100dvh;
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    display: grid;
    grid-template-columns: 236px minmax(0, 1fr);
    overflow: hidden;
  }

  .sidebar {
    min-height: 0;
    border-right: 1px solid var(--ehq-border-soft);
    background: color-mix(in srgb, var(--ehq-bg-main) 72%, var(--ehq-surface));
    display: flex;
    flex-direction: column;
  }

  .brand {
    min-height: 64px;
    padding: var(--ehq-space-4);
    border: 0;
    border-bottom: 1px solid var(--ehq-border-soft);
    background: transparent;
    color: var(--ehq-text);
    display: flex;
    align-items: center;
    gap: var(--ehq-space-2);
    text-align: left;
  }

  .brand span {
    color: var(--ehq-yellow);
    font-size: 26px;
    font-weight: var(--ehq-type-display-weight);
    line-height: 1;
  }

  .brand strong,
  nav h2,
  .system-status,
  .topbar p,
  .search span,
  .page-head p,
  .page-head span,
  .notice,
  .redirecting-panel p,
  .redirecting-panel span,
  .readiness-panel p,
  .check-list span,
  .form-panel p,
  .workspace-mini-grid small {
    font-family: var(--ehq-mono);
  }

  .brand strong {
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  nav {
    min-height: 0;
    padding: var(--ehq-space-3) var(--ehq-space-2);
    display: grid;
    align-content: start;
    gap: var(--ehq-space-1);
    overflow-y: auto;
  }

  nav h2 {
    margin: var(--ehq-space-3) var(--ehq-space-2) var(--ehq-space-2);
    color: var(--ehq-text-muted);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  nav button {
    min-height: 36px;
    padding: 0 var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text-soft);
    display: flex;
    align-items: center;
    gap: var(--ehq-space-2);
    text-align: left;
  }

  nav button:hover,
  nav button.active {
    color: var(--ehq-text);
  }

  nav button.active {
    box-shadow: inset 2px 0 0 var(--ehq-yellow);
  }

  nav button span {
    width: 7px;
    height: 7px;
    border-radius: 2px;
    background: currentColor;
    opacity: 0.5;
  }

  nav button.active span {
    background: var(--ehq-yellow);
    opacity: 1;
  }

  .system-status {
    margin: auto 0 0;
    padding: var(--ehq-space-3) var(--ehq-space-4);
    border-top: 1px solid var(--ehq-border-soft);
    color: var(--ehq-text-muted);
    display: flex;
    align-items: center;
    gap: var(--ehq-space-2);
    font-size: 11px;
  }

  .system-status span {
    width: 7px;
    height: 7px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-success);
    box-shadow: 0 0 10px var(--ehq-success-bg);
  }

  .main-panel {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .topbar {
    flex: 0 0 auto;
    min-height: 58px;
    padding: var(--ehq-space-3) var(--ehq-space-5);
    border-bottom: 1px solid var(--ehq-border-soft);
    display: flex;
    align-items: center;
    gap: var(--ehq-space-4);
  }

  .topbar p,
  .page-head p,
  .page-head h1,
  .page-head span {
    margin: 0;
  }

  .topbar p {
    color: var(--ehq-text-soft);
    font-size: 12px;
  }

  .topbar p span {
    color: var(--ehq-text-muted);
  }

  .topbar p strong {
    color: var(--ehq-text);
  }

  .search {
    width: min(380px, 34vw);
    min-width: 220px;
    min-height: 38px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    display: flex;
    align-items: center;
    gap: var(--ehq-space-2);
  }

  .search span {
    color: var(--ehq-text-muted);
    font-size: 10px;
  }

  .search input {
    min-width: 0;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--ehq-text);
    outline: 0;
  }

  .search input::placeholder {
    color: var(--ehq-text-muted);
  }

  .notification {
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
  }

  .notification {
    width: 38px;
    height: 38px;
    margin-left: auto;
    color: var(--ehq-yellow);
    font-family: var(--ehq-mono);
    font-weight: var(--ehq-type-label-weight);
  }

  .content {
    min-height: 0;
    padding: var(--ehq-space-5) var(--ehq-space-5) var(--ehq-space-8);
    display: grid;
    gap: var(--ehq-space-4);
    overflow-y: auto;
    overflow-x: hidden;
  }

  .page-head {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .page-head p {
    color: var(--ehq-text-muted);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .page-head h1 {
    font-size: var(--ehq-h1);
    font-weight: var(--ehq-type-display-weight);
    letter-spacing: 0;
  }

  .page-head span {
    color: var(--ehq-text-soft);
    font-size: 13px;
  }

  .notice {
    margin: 0;
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-yellow-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-yellow-muted);
    color: var(--ehq-yellow);
    font-size: 11px;
  }

  .redirecting-panel {
    min-height: 220px;
    padding: var(--ehq-space-6);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    place-content: center;
    gap: var(--ehq-space-2);
    text-align: center;
  }

  .redirecting-panel p,
  .redirecting-panel h2,
  .redirecting-panel span {
    margin: 0;
  }

  .redirecting-panel p {
    color: var(--ehq-yellow);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .redirecting-panel h2 {
    font-size: var(--ehq-h2);
    line-height: 1.2;
  }

  .redirecting-panel span {
    color: var(--ehq-text-soft);
    font-size: 12px;
    line-height: 1.6;
  }

  .kpi-grid,
  .dashboard-grid,
  .integration-grid,
  .settings-grid,
  .split-grid,
  .permission-workbench {
    display: grid;
    gap: var(--ehq-space-3);
    min-width: 0;
  }

  .kpi-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .dashboard-grid {
    grid-template-columns: minmax(0, 1.2fr) minmax(220px, 0.8fr) minmax(0, 1fr);
  }

  .split-grid,
  .settings-grid,
  .permission-workbench {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  }

  .integration-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .readiness-panel,
  .form-panel,
  .locked-card-reference {
    min-width: 0;
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    align-content: start;
    gap: var(--ehq-space-3);
  }

  .readiness-panel h2,
  .form-panel h2,
  .locked-card-reference h2 {
    margin: 0;
    font-size: var(--ehq-h3);
    font-weight: var(--ehq-type-heading-weight);
  }

  .readiness-panel p,
  .form-panel p,
  .locked-card-reference p {
    margin: 0;
    color: var(--ehq-text-muted);
    font-size: 11px;
    line-height: 1.6;
  }

  .check-list {
    display: grid;
    gap: var(--ehq-space-2);
  }

  .check-list article {
    padding: var(--ehq-space-2);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: flex;
    align-items: center;
    gap: var(--ehq-space-3);
  }

  .check-list div {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-1);
  }

  .check-list strong {
    font-size: 13px;
    font-weight: var(--ehq-type-body-weight);
  }

  .check-list span {
    color: var(--ehq-text-muted);
    font-size: 10px;
  }

  .field {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .field span {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .field input,
  .field select {
    min-height: 38px;
    width: 100%;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    outline: 0;
  }

  .field input:focus,
  .field select:focus {
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .command-action {
    min-height: 30px;
    width: fit-content;
    padding: 0 var(--ehq-space-2);
    border: 1px solid var(--ehq-yellow);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
    font-family: var(--ehq-font);
    font-size: 10px;
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .workspace-mini-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--ehq-space-2);
  }

  .workspace-mini-grid article {
    min-height: 104px;
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    align-content: space-between;
    gap: var(--ehq-space-2);
  }

  .workspace-mini-grid article.locked {
    border-color: var(--ehq-error);
  }

  .workspace-mini-grid span {
    color: var(--ehq-yellow);
    font-size: 20px;
    font-weight: var(--ehq-type-display-weight);
    line-height: 1;
  }

  .workspace-mini-grid article.locked span {
    color: var(--ehq-error);
  }

  .workspace-mini-grid strong {
    min-width: 0;
    font-size: 13px;
    font-weight: var(--ehq-type-body-weight);
    text-transform: capitalize;
  }

  .workspace-mini-grid small {
    color: var(--ehq-text-muted);
    font-size: 10px;
  }

  @media (max-width: 1180px) {
    .kpi-grid,
    .dashboard-grid,
    .integration-grid,
    .settings-grid,
    .split-grid,
    .permission-workbench {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 820px) {
    .command-shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      display: none;
    }

    .topbar {
      padding: var(--ehq-space-3);
      flex-wrap: wrap;
    }

    .search {
      order: 3;
      width: 100%;
      min-width: 0;
    }

    .content {
      padding: var(--ehq-space-4);
    }

    .kpi-grid,
    .dashboard-grid,
    .integration-grid,
    .settings-grid,
    .split-grid,
    .permission-workbench {
      grid-template-columns: 1fr;
    }

    .workspace-mini-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
