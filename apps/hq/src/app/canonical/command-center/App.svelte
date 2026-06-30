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
    PageHeader,
    Panel,
    Table,
    Toolbar,
    WorkspaceShell,
    type ChartPoint,
    type SelectOption,
    type TableColumn,
    type TableRow,
    type Tone,
    type ToolbarFilter,
    type WorkspaceNavGroup,
    type WorkspaceNavItem
  } from "@ehq/ui";
  import { onMount } from "svelte";
  import { createShellApiClient } from "../../app-shell-data.js";
  import { getLatestDataPeriod, periodLabel } from "../../period-controls.js";
  import DevSessionMenu from "../../DevSessionMenu.svelte";
  import { normalizeRoutePath } from "../../route-utils.js";

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

  interface NavGroup {
    readonly id: string;
    readonly label: string;
    readonly items: readonly NavItem[];
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
  const navGroups: readonly NavGroup[] = [
    {
      id: "overview",
      label: "Command Center",
      items: [
        {
          id: "dashboard",
          label: "Dashboard",
          title: "Command Center dashboard",
          subtitle: "Ecosystem readiness, health signals, and action queue."
        }
      ]
    },
    {
      id: "administration",
      label: "Administration",
      items: [
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
          subtitle: "Supabase runtime, MCP, and bank connector status."
        },
        {
          id: "settings",
          label: "Settings",
          title: "Settings",
          subtitle: "Workspace preferences for the admin and supervision surface."
        }
      ]
    }
  ];
  const navItems: readonly NavItem[] = navGroups.flatMap((group: NavGroup): readonly NavItem[] => group.items);

  const actionColumns: readonly TableColumn[] = [
    { label: "Action", align: "left", sortable: true },
    { label: "Context", align: "left", sortable: true },
    { label: "Volume", align: "right", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Next", align: "left", sortable: false }
  ];
  const permissionColumns: readonly TableColumn[] = [
    { label: "User", align: "left", sortable: true },
    { label: "Role", align: "left", sortable: true },
    { label: "Command Center", align: "left", sortable: true },
    { label: "Office", align: "left", sortable: true },
    { label: "Distribution", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Review", align: "left", sortable: false }
  ];
  const integrationColumns: readonly TableColumn[] = [
    { label: "Connector", align: "left", sortable: true },
    { label: "Type", align: "left", sortable: true },
    { label: "Scope", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Action", align: "left", sortable: false }
  ];
  const settingColumns: readonly TableColumn[] = [
    { label: "Setting", align: "left", sortable: true },
    { label: "Value", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Review", align: "left", sortable: false }
  ];
  const roleOptions: readonly SelectOption[] = [
    { label: "Administrator", value: "administrator" },
    { label: "Operator", value: "operator" },
    { label: "Office", value: "office" },
    { label: "Distribution", value: "distribution" }
  ];
  let writesEnabled = $state(false);
  let writeGateMessage = $state("Checking write gate.");
  const dashboardToolbar: readonly ToolbarFilter[] = [
    { label: "Scope", value: "All apps", active: true, disabled: false, actionId: "scope", title: "Open dashboard scope" },
    { label: "Mode", value: "Read-only", active: false, disabled: false, actionId: "mode", title: "Refresh write gate" },
    { label: "Period", value: periodLabel(period), active: false, disabled: false, actionId: "period", title: "Refresh readiness period" }
  ];
  const usersToolbar: readonly ToolbarFilter[] = [
    { label: "Source", value: "@ehq/auth", active: true, disabled: false, actionId: "source", title: "Show auth source" },
    { label: "Denied cards", value: "Visible", active: false, disabled: false, actionId: "denied-cards", title: "Show denied card rule" },
    { label: "Hidden apps", value: "Never", active: false, disabled: false, actionId: "hidden-apps", title: "Show hidden app policy" }
  ];
  const integrationToolbar = $derived<readonly ToolbarFilter[]>([
    { label: "Scope", value: "Platform", active: true, disabled: false, actionId: "scope", title: "Open integration scope" },
    { label: "Writes", value: writesEnabled ? "Enabled" : "Disabled", active: writesEnabled, disabled: false, actionId: "writes", title: "Refresh write gate" },
    { label: "Network", value: "Status only", active: false, disabled: false, actionId: "network", title: "Refresh API readiness" }
  ]);
  const settingsToolbar: readonly ToolbarFilter[] = [
    { label: "Workspace", value: "Command Center", active: true, disabled: false, actionId: "workspace", title: "Open workspace settings" },
    { label: "Theme", value: "Dark", active: false, disabled: false, actionId: "theme", title: "Persist theme review" },
    { label: "Release gate", value: "Manual", active: false, disabled: false, actionId: "release-gate", title: "Persist release gate review" }
  ];
  const integrations: readonly IntegrationRow[] = [
    {
      id: "supabase-runtime",
      connector: "Supabase runtime",
      kind: "Auth · Postgres · Hono",
      scope: "All workspaces",
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
  const shellNavGroups = $derived<readonly WorkspaceNavGroup[]>(
    navGroups.map((group: NavGroup): WorkspaceNavGroup => ({
      id: group.id,
      label: group.label,
      items: group.items.map((item: NavItem): WorkspaceNavItem => ({
        label: item.label,
        href: item.id,
        icon: "",
        active: activePageId === item.id,
        disabled: false,
        badge: null
      }))
    }))
  );
  const handleShellNavigate = (href: string): void => {
    selectPage(href as CommandCenterPageId);
  };
  let selectedRole = $state("administrator");
  let inviteEmail = $state("new.user@eeee.mu");
  let workspaceName = $state("ë • Entreprise");
  let commandNotice = $state("");
  let commandBusy = $state(false);
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
  const integrationKpis = $derived(createIntegrationKpis(integrations, writesEnabled, writeGateMessage));
  const settingsKpis = $derived(createSettingsKpis(settingRows));
  const actionRows = $derived(createActionRows());
  const permissionRows = $derived(createPermissionRows(permissionUsers));
  const integrationRows = $derived(createIntegrationRows(integrations));
  const settingsRows = $derived(createSettingsRows(settingRows));

  onMount((): (() => void) => {
    syncPageFromLocation();
    window.addEventListener("popstate", syncPageFromLocation);
    void loadWriteGate();
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

  async function loadWriteGate(): Promise<void> {
    try {
      const status = await client.commandCenter.getStatus({
        workspaceId
      });
      writesEnabled = status.writesEnabled;
      writeGateMessage = status.writesEnabled ? "writes enabled" : "enable writes";
    } catch (error: unknown) {
      writesEnabled = false;
      writeGateMessage = errorMessage(error);
    }
  }

  function selectDashboardToolbarFilter(filter: ToolbarFilter): void {
    if (filter.actionId === "scope") {
      selectPage("dashboard");
      commandNotice = "Dashboard scope is set to all workspaces.";
      return;
    }

    if (filter.actionId === "mode") {
      void loadWriteGate();
      commandNotice = "Write gate refresh requested.";
      return;
    }

    if (filter.actionId === "period") {
      void loadCommandReadiness();
      commandNotice = `Readiness refresh requested for ${periodLabel(period)}.`;
      return;
    }

    throw new Error(`Unknown dashboard toolbar action: ${filter.label}.`);
  }

  function selectUsersToolbarFilter(filter: ToolbarFilter): void {
    if (filter.actionId === "source") {
      commandNotice = "Permission source is the verified Supabase Auth session.";
      return;
    }

    if (filter.actionId === "denied-cards") {
      commandNotice = "Denied workspace cards remain visible on HQ.";
      return;
    }

    if (filter.actionId === "hidden-apps") {
      commandNotice = "Hidden app policy remains disabled; denied apps are never silently hidden.";
      return;
    }

    throw new Error(`Unknown users toolbar action: ${filter.label}.`);
  }

  function selectIntegrationToolbarFilter(filter: ToolbarFilter): void {
    if (filter.actionId === "scope") {
      selectPage("integrations");
      commandNotice = "Integration scope is platform-wide.";
      return;
    }

    if (filter.actionId === "writes") {
      void loadWriteGate();
      commandNotice = "Write gate refresh requested.";
      return;
    }

    if (filter.actionId === "network") {
      void loadCommandReadiness();
      commandNotice = "API readiness refresh requested.";
      return;
    }

    throw new Error(`Unknown integration toolbar action: ${filter.label}.`);
  }

  function selectSettingsToolbarFilter(filter: ToolbarFilter): void {
    if (filter.actionId === "workspace") {
      selectPage("settings");
      commandNotice = "Workspace settings are open.";
      return;
    }

    if (filter.actionId === "theme") {
      void persistCommandSetting("theme", { name: "dark-command-center" }, "reviewed");
      return;
    }

    if (filter.actionId === "release-gate") {
      void persistCommandSetting("release_gate", { mode: "manual" }, "reviewed");
      return;
    }

    throw new Error(`Unknown settings toolbar action: ${filter.label}.`);
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
    const normalizedPath = normalizeRoutePath(pathname);

    if (normalizedPath.endsWith("/console/command-center/users")) {
      return "users";
    }

    if (normalizedPath.endsWith("/console/dashboard")) {
      return "dashboard";
    }

    if (normalizedPath.endsWith("/console/command-center-dashboard")) {
      return "dashboard";
    }

    if (normalizedPath.endsWith("/console/command-center/integrations")) {
      return "integrations";
    }

    if (normalizedPath.endsWith("/console/command-center/settings")) {
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

  function createIntegrationKpis(
    rows: readonly IntegrationRow[],
    remoteWritesEnabled: boolean,
    remoteWriteGateMessage: string
  ): readonly CommandKpi[] {
    return [
      { label: "Connectors", value: String(rows.length), detail: "status only", tone: "info", accent: true },
      { label: "Supabase", value: "Live", detail: "Auth + Postgres", tone: "success", accent: false },
      { label: "Banks", value: "2", detail: "Office import scope", tone: "info", accent: false },
      {
        label: "Remote writes",
        value: remoteWritesEnabled ? "On" : "Off",
        detail: remoteWritesEnabled ? "guarded by API audit" : remoteWriteGateMessage,
        tone: remoteWritesEnabled ? "success" : "warning",
        accent: false
      }
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
        { kind: "badge", value: "open from users", tone: "active" }
      ]),
      createTableRow("action_integrations", [
        { kind: "text", value: "Inspect SBI connector", strong: true },
        { kind: "text", value: "Office bank imports", strong: false },
        { kind: "money", value: "1", tone: "muted" },
        { kind: "badge", value: "idle", tone: "muted" },
        { kind: "badge", value: "inspect in office", tone: "muted" }
      ]),
      createTableRow("action_settings", [
        { kind: "text", value: "Confirm release gate", strong: true },
        { kind: "text", value: "Settings", strong: false },
        { kind: "money", value: "1", tone: "warning" },
        { kind: "badge", value: "required", tone: "warning" },
        { kind: "badge", value: "review settings", tone: "muted" }
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
        { kind: "badge", value: "local review", tone: "muted" }
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
        { kind: "badge", value: row.action.toLowerCase(), tone: row.status === "attention" ? "error" : "muted" }
      ])
    );
  }

  function createSettingsRows(rows: readonly SettingRow[]): readonly TableRow[] {
    return rows.map((row: SettingRow): TableRow =>
      createTableRow(row.id, [
        { kind: "text", value: row.key, strong: true },
        { kind: "text", value: row.value, strong: false },
        { kind: "badge", value: row.status, tone: row.tone },
        { kind: "badge", value: "view only", tone: "muted" }
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

  async function requestAccessReview(): Promise<void> {
    commandBusy = true;
    try {
      const receipt = await client.commandCenter.updateUserPermission(
        {
          workspaceId,
          userId: inviteEmail,
          email: inviteEmail,
          role: selectedRole,
          permissions: {
            commandCenter: selectedRole === "administrator" || selectedRole === "operator",
            office: selectedRole === "administrator" || selectedRole === "office" || selectedRole === "operator",
            distribution: selectedRole === "administrator" || selectedRole === "distribution" || selectedRole === "operator"
          }
        },
        {
          idempotencyKey: createCommandIdempotencyKey("command-center-user-permission")
        }
      );
      commandNotice = `Permission review persisted · audit ${receipt.auditEventId ?? "missing"}.`;
    } catch (error: unknown) {
      commandNotice = `Permission write failed · ${errorMessage(error)}.`;
    } finally {
      commandBusy = false;
    }
  }

  async function persistCommandSetting(key: string, value: Readonly<Record<string, unknown>>, status: string): Promise<void> {
    commandBusy = true;
    try {
      const receipt = await client.commandCenter.updateSetting(
        {
          workspaceId,
          key,
          value,
          status
        },
        {
          idempotencyKey: createCommandIdempotencyKey(`command-center-setting-${key}`)
        }
      );
      commandNotice = `${key} setting persisted · audit ${receipt.auditEventId ?? "missing"}.`;
    } catch (error: unknown) {
      commandNotice = `${key} setting write failed · ${errorMessage(error)}.`;
    } finally {
      commandBusy = false;
    }
  }

  async function saveSettingsReview(): Promise<void> {
    await persistCommandSetting("workspace_name", { name: workspaceName }, "reviewed");
  }

  async function persistIntegrationStatus(integrationId: string, enabled: boolean, status: string): Promise<void> {
    commandBusy = true;
    try {
      const receipt = await client.commandCenter.toggleIntegration(
        {
          workspaceId,
          integrationId,
          enabled,
          status
        },
        {
          idempotencyKey: createCommandIdempotencyKey(`command-center-integration-${integrationId}`)
        }
      );
      commandNotice = `${integrationId} status persisted · audit ${receipt.auditEventId ?? "missing"}.`;
    } catch (error: unknown) {
      commandNotice = `${integrationId} write failed · ${errorMessage(error)}.`;
    } finally {
      commandBusy = false;
    }
  }

  function createCommandIdempotencyKey(action: string): string {
    return `${action}:${session.userId}:${crypto.randomUUID()}`;
  }

  function errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return "unknown error";
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

<WorkspaceShell
  workspace="command-center"
  brandLabel="ë • command"
  homeHref="/console/command-center/dashboard"
  navLabel="Command Center navigation"
  navItems={[]}
  navGroups={shellNavGroups}
  statusLabel="command-center"
  statusValue={systemStatusLabel}
  userInitial={session.initials}
  userName={session.displayName}
  userContext={session.roleLabel}
  signOutHref="#"
  onNavigate={handleShellNavigate}
  onSignOut={onLogout}
>
  {#snippet footer()}
    <DevSessionMenu {session} {onLogout} />
  {/snippet}
    <div class="content">
      <PageHeader
        workspace="command-center"
        eyebrow="Command Center"
        title={activePage.title}
        description={activePage.subtitle}
        meta=""
        statusLabel=""
        statusTone="muted"
      />

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
        <Toolbar label="Dashboard controls" filters={dashboardToolbar} actionLabel="" loading={false} onFilterSelect={selectDashboardToolbarFilter} />

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
        <Toolbar label="Permission controls" filters={usersToolbar} actionLabel="" loading={false} onFilterSelect={selectUsersToolbarFilter} />

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
            <button class="command-action" type="button" disabled={commandBusy || !writesEnabled} title={writeGateMessage} onclick={requestAccessReview}>Prepare review</button>
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
        <Toolbar label="Integration controls" filters={integrationToolbar} actionLabel="" loading={false} onFilterSelect={selectIntegrationToolbarFilter} />

        <section class="kpi-grid" aria-label="Integration indicators">
          {#each integrationKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state="default" accent={kpi.accent} />
          {/each}
        </section>

        <section class="integration-grid">
          <Panel
            title="Supabase runtime"
            subtitle="Auth, Postgres, and Hono API"
            body="Office eof/v1 and Distribution erh/v1 are compatibility route names on the new Hono API. The app does not use WordPress as a backend."
            state={writesEnabled ? "default" : "locked"}
            primaryAction="Inspect"
            secondaryAction=""
            onPrimaryAction={() => persistIntegrationStatus("supabase-runtime", true, "connected")}
          />
          <Panel
            title="MCP"
            subtitle="Project-scoped tools"
            body="Enterprise context stays scoped to this repository. No global connector leak is introduced by the app shell."
            state={writesEnabled ? "default" : "locked"}
            primaryAction="View scope"
            secondaryAction=""
            onPrimaryAction={() => persistIntegrationStatus("mcp", true, "connected")}
          />
          <Panel
            title="Bank connectors"
            subtitle="Office import scope"
            body="MCB and SBI statement import status belongs to Office. Command Center watches readiness without parsing bank files."
            state={writesEnabled ? "default" : "locked"}
            primaryAction="Open status"
            secondaryAction=""
            onPrimaryAction={() => persistIntegrationStatus("bank-connectors", true, "reviewed")}
          />
        </section>

        <Table title="Connectors" columns={integrationColumns} rows={integrationRows} state="default" actionLabel="" />
      {:else}
        <Toolbar label="Settings controls" filters={settingsToolbar} actionLabel="" loading={false} onFilterSelect={selectSettingsToolbarFilter} />

        <section class="kpi-grid" aria-label="Settings indicators">
          {#each settingsKpis as kpi (kpi.label)}
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state="default" accent={kpi.accent} />
          {/each}
        </section>

        <section class="settings-grid">
          <section class="form-panel ehq-edge-surface" aria-label="Workspace settings">
            <h2>Workspace settings</h2>
            <p>Saved through the Command Center API. Deployments remain manual.</p>
            <label class="field" for="workspace-name">
              <span>Workspace name</span>
              <input id="workspace-name" value={workspaceName} placeholder="Workspace" type="text" oninput={updateWorkspaceName} />
            </label>
            <button class="command-action" type="button" disabled={commandBusy || !writesEnabled} title={writeGateMessage} onclick={saveSettingsReview}>Save review</button>
          </section>

          <Panel
            title="Supervision mode"
            subtitle="Admin workspace only"
            body="The Command Center menu is local to this app and does not appear inside Office or Distribution."
            state={writesEnabled ? "default" : "locked"}
            primaryAction="Verified"
            secondaryAction=""
            onPrimaryAction={saveSettingsReview}
          />
        </section>

        <Table title="Preferences" columns={settingColumns} rows={settingsRows} state="default" actionLabel="" />
      {/if}
    </div>
</WorkspaceShell>

<style>
  :global(body) {
    overflow: hidden;
  }

  .notice,
  .redirecting-panel p,
  .redirecting-panel span,
  .readiness-panel p,
  .check-list span,
  .form-panel p,
  .workspace-mini-grid small {
    font-family: var(--ehq-mono);
  }

  .content {
    min-height: 0;
    padding: var(--ehq-space-5) var(--ehq-space-5) var(--ehq-space-8);
    display: grid;
    gap: var(--ehq-space-4);
    overflow-y: auto;
    overflow-x: auto;
  }

  .notice {
    margin: 0;
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-yellow-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-yellow-muted);
    color: var(--ehq-yellow);
    font-size: var(--ehq-type-caption-size);
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
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .redirecting-panel h2 {
    font-size: var(--ehq-type-section-title-size);
    line-height: 1.2;
  }

  .redirecting-panel span {
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
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
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .readiness-panel p,
  .form-panel p,
  .locked-card-reference p {
    margin: 0;
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    line-height: var(--ehq-type-ui-line);
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
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-body-weight);
  }

  .check-list span {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-label-size);
  }

  .field {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .field span {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
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
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
    line-height: var(--ehq-type-ui-line);
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
    font-size: var(--ehq-type-action-size);
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
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-body-weight);
    text-transform: capitalize;
  }

  .workspace-mini-grid small {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-label-size);
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
