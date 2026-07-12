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
    type CommandCenterNotificationsResponse,
    type CommandCenterOverviewResponse
  } from "@ehq/api-client";
  import {
    Alert,
    Badge,
    Button,
    DonutChart,
    Input,
    KPI,
    Loader,
    PageHeader,
    Panel,
    Select,
    Table,
    Toolbar,
    WorkspaceShell,
    type AlertTone,
    type SelectOption,
    type SurfaceState,
    type TableColumn,
    type TableRow,
    type TableRowAction,
    type TableState,
    type IconName,
    type Tone,
    type ToolbarFilter,
    type WorkspaceNavGroup,
    type WorkspaceNavItem
  } from "@ehq/ui";
  import { onMount } from "svelte";
  import { createShellApiClient } from "../../app-shell-data.js";
  import { getLatestDataPeriod, periodLabel } from "../../period-controls.js";
  import { normalizeRoutePath } from "../../route-utils.js";
  import { isApiRequestLoading as isLoadingState } from "../request-state.js";
  import "../../../office-orbital-scope.css";
  import "../office/orbital-office.css";

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
    readonly id: string;
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
    { label: "Next", align: "left", sortable: true }
  ];
  const permissionColumns: readonly TableColumn[] = [
    { label: "User", align: "left", sortable: true },
    { label: "Role", align: "left", sortable: true },
    { label: "Command Center", align: "left", sortable: true },
    { label: "Office", align: "left", sortable: true },
    { label: "Distribution", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Review", align: "left", sortable: true }
  ];
  const integrationColumns: readonly TableColumn[] = [
    { label: "Connector", align: "left", sortable: true },
    { label: "Type", align: "left", sortable: true },
    { label: "Scope", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Action", align: "left", sortable: true }
  ];
  const settingColumns: readonly TableColumn[] = [
    { label: "Setting", align: "left", sortable: true },
    { label: "Value", align: "left", sortable: true },
    { label: "Status", align: "left", sortable: true },
    { label: "Review", align: "left", sortable: true }
  ];
  const roleOptions: readonly SelectOption[] = [
    { label: "Administrator", value: "administrator" },
    { label: "Operator", value: "operator" },
    { label: "Office", value: "office" },
    { label: "Distribution", value: "distribution" }
  ];
  let writesEnabled = $state(false);
  let writeGateMessage = $state("Checking write gate.");
  let commandBusy = $state(false);
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
  const settingsToolbar = $derived<readonly ToolbarFilter[]>([
    { label: "Workspace", value: "Command Center", active: true, disabled: false, actionId: "workspace", title: "Open workspace settings" },
    {
      label: "Theme",
      value: "Dark",
      active: false,
      disabled: true,
      actionId: "theme",
      title: "Locked setting · view only"
    },
    {
      label: "Release gate",
      value: "Manual",
      active: false,
      disabled: true,
      actionId: "release-gate",
      title: "Locked setting · view only"
    }
  ]);
  let activePageId = $state<CommandCenterPageId>("dashboard");
  const navIcons: Readonly<Record<CommandCenterPageId, IconName>> = {
    dashboard: "home",
    users: "users",
    integrations: "layout-grid",
    settings: "settings"
  };
  const shellNavGroups = $derived<readonly WorkspaceNavGroup[]>(
    navGroups.map((group: NavGroup): WorkspaceNavGroup => ({
      id: group.id,
      label: group.label,
      items: group.items.map((item: NavItem): WorkspaceNavItem => ({
        label: item.label,
        href: item.id,
        icon: navIcons[item.id],
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
  let inviteEmail = $state("");
  let workspaceName = $state("ë • Entreprise");
  let lastSavedWorkspaceName = $state("ë • Entreprise");
  let unreadNotifications = $state(0);
  let commandNotice = $state("");
  let commandNoticeTone = $state<AlertTone>("info");

  function setCommandNotice(tone: AlertTone, text: string): void {
    commandNoticeTone = tone;
    commandNotice = text;
  }
  let overviewState = $state<ApiRequestState<CommandCenterOverviewResponse>>(createIdleState<CommandCenterOverviewResponse>());

  const activePage = $derived(getNavItem(activePageId));
  const permissionUsers = $derived<readonly CommandPermissionUser[]>([createPermissionUser(session)]);
  const commandAccess = $derived(getWorkspaceAccess(session, "command-center"));
  const canUseCommandCenter = $derived(commandAccess.status === "allowed");
  const systemStatusLabel = $derived(createSystemStatusLabel(session));
  const readinessItems = $derived(createReadinessItems(overviewState));
  const readinessOkCount = $derived(countReadyChecks(readinessItems));
  const readinessPercent = $derived(readinessItems.length === 0 ? 0 : Math.round((readinessOkCount / readinessItems.length) * 100));
  const integrations = $derived(createIntegrations(overviewState));
  const settingRows = $derived(createSettings(overviewState));
  const dashboardKpis = $derived(createDashboardKpis(readinessItems, permissionUsers, integrations, unreadNotifications));
  const usersKpis = $derived(createUsersKpis(permissionUsers));
  const integrationKpis = $derived(createIntegrationKpis(integrations, writesEnabled, writeGateMessage));
  const settingsKpis = $derived(createSettingsKpis(settingRows));
  const actionRows = $derived(createActionRows(permissionUsers, integrations, settingRows));
  const dashboardSurfaceState = $derived(deriveDashboardSurfaceState(overviewState));
  const actionTableState = $derived(deriveActionTableState(dashboardSurfaceState, actionRows));
  const permissionRows = $derived(createPermissionRows(permissionUsers));
  const integrationRows = $derived(createIntegrationRows(integrations));
  const integrationTableState = $derived(deriveAuxTableState(overviewState, integrationRows.length));
  const integrationRowActions = $derived(createIntegrationRowActions());
  const settingsRows = $derived(createSettingsRows(settingRows));
  const settingsTableState = $derived(deriveAuxTableState(overviewState, settingsRows.length));

  onMount((): (() => void) => {
    syncPageFromLocation();
    window.addEventListener("popstate", syncPageFromLocation);
    void loadWriteGate();
    void loadCommandOverview();
    void loadNotifications();

    return (): void => {
      window.removeEventListener("popstate", syncPageFromLocation);
    };
  });

  async function loadCommandOverview(): Promise<void> {
    overviewState = createLoadingState<CommandCenterOverviewResponse>();

    try {
      const overview = await client.commandCenter.getOverview({
        workspaceId
      });
      overviewState = createSuccessState<CommandCenterOverviewResponse>(overview);
    } catch (error: unknown) {
      setCommandNotice("error", `Overview unavailable · ${errorMessage(error)}.`);
      overviewState = createErrorState<CommandCenterOverviewResponse>(error);
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

  async function loadNotifications(): Promise<void> {
    try {
      const notifications: CommandCenterNotificationsResponse = await client.commandCenter.listNotifications({
        workspaceId
      });
      unreadNotifications = notifications.unreadCount;
    } catch {
      unreadNotifications = 0;
    }
  }

  function selectDashboardToolbarFilter(filter: ToolbarFilter): void {
    if (filter.actionId === "scope") {
      selectPage("dashboard");
      setCommandNotice("info", "Dashboard scope is set to all workspaces.");
      return;
    }

    if (filter.actionId === "mode") {
      void loadWriteGate();
      setCommandNotice("info", "Write gate refresh requested.");
      return;
    }

    if (filter.actionId === "period") {
      void Promise.all([loadCommandOverview(), loadNotifications()]);
      setCommandNotice("info", `Readiness refresh requested for ${periodLabel(period)}.`);
      return;
    }

    throw new Error(`Unknown dashboard toolbar action: ${filter.label}.`);
  }

  function selectUsersToolbarFilter(filter: ToolbarFilter): void {
    if (filter.actionId === "source") {
      setCommandNotice("info", "Permission source is the verified Supabase Auth session.");
      return;
    }

    if (filter.actionId === "denied-cards") {
      setCommandNotice("info", "Denied workspace cards remain visible on HQ.");
      return;
    }

    if (filter.actionId === "hidden-apps") {
      setCommandNotice("info", "Hidden app policy remains disabled; denied apps are never silently hidden.");
      return;
    }

    throw new Error(`Unknown users toolbar action: ${filter.label}.`);
  }

  function selectIntegrationToolbarFilter(filter: ToolbarFilter): void {
    if (filter.actionId === "scope") {
      selectPage("integrations");
      setCommandNotice("info", "Integration scope is platform-wide.");
      return;
    }

    if (filter.actionId === "writes") {
      void loadWriteGate();
      setCommandNotice("info", "Write gate refresh requested.");
      return;
    }

    if (filter.actionId === "network") {
      void loadCommandOverview();
      setCommandNotice("info", "API readiness refresh requested.");
      return;
    }

    throw new Error(`Unknown integration toolbar action: ${filter.label}.`);
  }

  function selectSettingsToolbarFilter(filter: ToolbarFilter): void {
    if (filter.actionId === "workspace") {
      selectPage("settings");
      setCommandNotice("info", "Workspace settings are open.");
      return;
    }

    if (filter.actionId === "theme") {
      setCommandNotice("info", "Theme is locked in Command Center and remains view only.");
      return;
    }

    if (filter.actionId === "release-gate") {
      setCommandNotice("info", "Release gate is locked to manual approval and remains view only.");
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
    setCommandNotice("info", "");
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

  function createReadinessItems(overview: ApiRequestState<CommandCenterOverviewResponse>): readonly ReadinessItem[] {
    if (overview.status === "success") {
      return overview.data.readiness.map((item): ReadinessItem => ({
        id: item.id,
        label: item.label,
        detail: item.detail,
        tone: item.tone
      }));
    }

    if (isLoadingState(overview)) {
      return [
        {
          id: "loading",
          label: "Readiness",
          detail: "loading live API",
          tone: "warning"
        }
      ];
    }

    if (overview.status === "error") {
      return [
        {
          id: "error",
          label: "Readiness",
          detail: "live API unavailable",
          tone: "error"
        }
      ];
    }

    return [
      {
        id: "idle",
        label: "Readiness",
        detail: "waiting for live API",
        tone: "warning"
      }
    ];
  }

  function createIntegrations(overview: ApiRequestState<CommandCenterOverviewResponse>): readonly IntegrationRow[] {
    if (overview.status !== "success") {
      return [];
    }

    return overview.data.integrations.map((integration): IntegrationRow => ({
      id: integration.id,
      connector: integration.connector,
      kind: integration.kind,
      scope: integration.scope,
      status: integration.status,
      action: integration.action
    }));
  }

  function createSettings(overview: ApiRequestState<CommandCenterOverviewResponse>): readonly SettingRow[] {
    if (overview.status !== "success") {
      return [];
    }

    return overview.data.settings.map((setting): SettingRow => ({
      id: setting.id,
      key: setting.key,
      value: setting.value,
      status: setting.status,
      tone: setting.tone
    }));
  }

  function countReadyChecks(items: readonly ReadinessItem[]): number {
    return items.filter((item: ReadinessItem): boolean => item.tone === "success").length;
  }

  function createDashboardKpis(
    checks: readonly ReadinessItem[],
    users: readonly CommandPermissionUser[],
    rows: readonly IntegrationRow[],
    unreadCount: number
  ): readonly CommandKpi[] {
    const readyCount = countReadyChecks(checks);
    const readyPercent = Math.round((readyCount / checks.length) * 100);
    const connectedCount = rows.filter((row: IntegrationRow): boolean => row.status === "connected").length;

    return [
      {
        label: "Readiness",
        value: `${String(readyPercent)}%`,
        detail: `${String(readyCount)}/${String(checks.length)} checks ok`,
        tone: readyCount === checks.length ? "success" : "warning",
        accent: true
      },
      { label: "Permission profiles", value: String(users.length), detail: "from @ehq/auth", tone: "info", accent: false },
      { label: "Alerts", value: String(unreadCount), detail: "cc notifications", tone: unreadCount === 0 ? "success" : "warning", accent: false },
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
    const connectedCount = rows.filter((row: IntegrationRow): boolean => row.status === "connected").length;
    const bankConnectorCount = rows.filter((row: IntegrationRow): boolean =>
      row.kind.toLowerCase().includes("bank") ||
      row.connector.toLowerCase().includes("bank")
    ).length;
    const supabaseIntegration = rows.find((row: IntegrationRow): boolean =>
      row.id === "supabase-runtime" || row.connector.toLowerCase().includes("supabase")
    );
    const supabaseConnected = supabaseIntegration?.status === "connected";

    return [
      { label: "Connectors", value: String(rows.length), detail: "status only", tone: "info", accent: true },
      {
        label: "Supabase",
        value: supabaseConnected ? "Connected" : "Review",
        detail: supabaseIntegration === undefined ? "missing connector" : "Auth + Postgres",
        tone: supabaseConnected ? "success" : "warning",
        accent: false
      },
      {
        label: "Banks",
        value: String(bankConnectorCount),
        detail: `${String(connectedCount)}/${String(rows.length)} connectors connected`,
        tone: bankConnectorCount > 0 ? "info" : "warning",
        accent: false
      },
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
    const reviewedCount = rows.filter((row: SettingRow): boolean => row.tone === "success").length;
    const warningCount = rows.filter((row: SettingRow): boolean => row.tone === "warning").length;
    const lockedCount = rows.filter((row: SettingRow): boolean => row.tone === "active").length;
    const workspaceConfigured = rows.some((row: SettingRow): boolean =>
      row.id === "workspace_name" || row.key.toLowerCase().includes("workspace")
    );

    return [
      {
        label: "Workspace",
        value: workspaceConfigured ? "Configured" : "Default",
        detail: workspaceConfigured ? "persisted in API settings" : "using default workspace label",
        tone: workspaceConfigured ? "active" : "info",
        accent: true
      },
      {
        label: "Settings",
        value: String(rows.length),
        detail: `${String(reviewedCount)} reviewed`,
        tone: "info",
        accent: false
      },
      {
        label: "Locked",
        value: String(lockedCount),
        detail: "view-only command center controls",
        tone: lockedCount > 0 ? "success" : "info",
        accent: false
      },
      {
        label: "Needs review",
        value: String(warningCount),
        detail: warningCount === 0 ? "no pending settings" : "pending setting reviews",
        tone: warningCount === 0 ? "success" : "warning",
        accent: false
      }
    ];
  }

  function createActionRows(
    users: readonly CommandPermissionUser[],
    connectorRows: readonly IntegrationRow[],
    settings: readonly SettingRow[]
  ): readonly TableRow[] {
    const rows: TableRow[] = [];
    const reviewCount = countReviewUsers(users);
    const inactiveConnectors = connectorRows.filter((row: IntegrationRow): boolean => row.status !== "connected");
    const pendingSettings = settings.filter((row: SettingRow): boolean => row.tone === "warning");

    if (reviewCount > 0) {
      rows.push(
        createTableRow("action_permissions", [
          { kind: "text", value: "Review permission requests", strong: true },
          { kind: "text", value: "Users & permissions", strong: false },
          { kind: "money", value: String(reviewCount), tone: "warning" },
          { kind: "badge", value: "review", tone: "warning" },
          { kind: "badge", value: "open from users", tone: "active" }
        ])
      );
    }

    if (inactiveConnectors.length > 0) {
      const hasAttention = inactiveConnectors.some((row: IntegrationRow): boolean => row.status === "attention");

      rows.push(
        createTableRow("action_integrations", [
          {
            kind: "text",
            value: `Inspect ${inactiveConnectors.map((row: IntegrationRow): string => row.connector).join(", ")}`,
            strong: true
          },
          { kind: "text", value: "Office bank imports", strong: false },
          { kind: "money", value: String(inactiveConnectors.length), tone: hasAttention ? "warning" : "muted" },
          { kind: "badge", value: hasAttention ? "attention" : "idle", tone: hasAttention ? "warning" : "muted" },
          { kind: "badge", value: "inspect in office", tone: "muted" }
        ])
      );
    }

    if (pendingSettings.length > 0) {
      rows.push(
        createTableRow("action_settings", [
          {
            kind: "text",
            value: `Review ${pendingSettings.map((row: SettingRow): string => row.key.toLowerCase()).join(", ")}`,
            strong: true
          },
          { kind: "text", value: "Settings", strong: false },
          { kind: "money", value: String(pendingSettings.length), tone: "warning" },
          { kind: "badge", value: "required", tone: "warning" },
          { kind: "badge", value: "review settings", tone: "muted" }
        ])
      );
    }

    return rows;
  }

  function deriveDashboardSurfaceState(overview: ApiRequestState<CommandCenterOverviewResponse>): SurfaceState {
    if (isLoadingState(overview)) {
      return "loading";
    }

    return overview.status === "success" ? "default" : "error";
  }

  function deriveActionTableState(surfaceState: SurfaceState, rows: readonly TableRow[]): TableState {
    if (surfaceState === "loading") {
      return "loading";
    }

    if (surfaceState === "error") {
      return "error";
    }

    return rows.length === 0 ? "empty" : "default";
  }

  function deriveAuxTableState(overview: ApiRequestState<CommandCenterOverviewResponse>, rowCount: number): TableState {
    if (isLoadingState(overview)) {
      return "loading";
    }

    if (overview.status === "error") {
      return "error";
    }

    if (overview.status === "success" && rowCount === 0) {
      return "empty";
    }

    return overview.status === "success" ? "default" : "error";
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

  function createIntegrationRowActions(): readonly TableRowAction[] {
    return [
      {
        label: "Toggle",
        onAction: (integrationId: string): void => {
          void toggleIntegration(integrationId);
        },
        isEnabled: (integrationId: string): boolean => canToggleIntegration(integrationId),
        disabledReason: (integrationId: string): string | null => integrationToggleDisabledReason(integrationId)
      }
    ];
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

  function canToggleIntegration(integrationId: string): boolean {
    return writesEnabled && !commandBusy && integrations.some((row: IntegrationRow): boolean => row.id === integrationId);
  }

  function integrationToggleDisabledReason(integrationId: string): string | null {
    if (!writesEnabled) {
      return writeGateMessage;
    }

    if (commandBusy) {
      return "Another command is running.";
    }

    if (!integrations.some((row: IntegrationRow): boolean => row.id === integrationId)) {
      return "Integration unavailable.";
    }

    return null;
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
      setCommandNotice("success", `Permission review persisted · audit ${receipt.auditEventId ?? "missing"}.`);
      await Promise.all([loadCommandOverview(), loadNotifications()]);
    } catch (error: unknown) {
      setCommandNotice("error", `Permission write failed · ${errorMessage(error)}.`);
    } finally {
      commandBusy = false;
    }
  }

  async function persistCommandSetting(key: string, value: Readonly<Record<string, unknown>>, status: string): Promise<boolean> {
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
      if (receipt.auditEventId === null) {
        setCommandNotice("info", `${key} already up to date.`);
      } else {
        setCommandNotice("success", `${key} setting persisted · audit ${receipt.auditEventId}.`);
      }
      await Promise.all([loadCommandOverview(), loadNotifications()]);
      return true;
    } catch (error: unknown) {
      setCommandNotice("error", `${key} setting write failed · ${errorMessage(error)}.`);
      return false;
    } finally {
      commandBusy = false;
    }
  }

  async function saveSettingsReview(): Promise<void> {
    const nextWorkspaceName = workspaceName.trim();

    if (nextWorkspaceName.length === 0) {
      setCommandNotice("error", "Workspace name is required before saving.");
      return;
    }

    if (nextWorkspaceName === lastSavedWorkspaceName) {
      setCommandNotice("info", "Workspace name is already up to date.");
      return;
    }

    const persisted = await persistCommandSetting("workspace_name", { name: nextWorkspaceName }, "reviewed");
    if (persisted) {
      lastSavedWorkspaceName = nextWorkspaceName;
    }
  }

  function showIntegrationDetail(integrationId: string): void {
    const row = integrations.find((integration: IntegrationRow): boolean => integration.id === integrationId);

    if (row === undefined) {
      throw new Error(`Unknown integration: ${integrationId}.`);
    }

    setCommandNotice("info", `${row.connector} · ${row.kind} · ${row.scope} · status ${row.status}.`);
  }

  async function toggleIntegration(integrationId: string): Promise<void> {
    const row = integrations.find((integration: IntegrationRow): boolean => integration.id === integrationId);

    if (row === undefined) {
      throw new Error(`Unknown integration: ${integrationId}.`);
    }

    const enabled = row.status !== "connected";
    const nextStatus = enabled ? "connected" : "idle";

    commandBusy = true;
    try {
      const receipt = await client.commandCenter.toggleIntegration(
        {
          workspaceId,
          integrationId,
          enabled,
          status: nextStatus
        },
        {
          idempotencyKey: createCommandIdempotencyKey(`command-center-integration-${integrationId}`)
        }
      );
      setCommandNotice("success", `Integration updated · audit ${receipt.auditEventId ?? "missing"}.`);
      await Promise.all([loadCommandOverview(), loadNotifications()]);
    } catch (error: unknown) {
      setCommandNotice("error", `Integration update failed · ${errorMessage(error)}.`);
    } finally {
      commandBusy = false;
    }
  }

  function openOfficeBankStatus(): void {
    window.location.assign("/console/office/bank");
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

  function updateSelectedRole(value: string): void {
    selectedRole = value;
  }

  function updateInviteEmail(value: string): void {
    inviteEmail = value;
  }

  function updateWorkspaceName(value: string): void {
    workspaceName = value;
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
  onNavigate={handleShellNavigate}
>
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
        <Alert
          tone={commandNoticeTone}
          title={commandNoticeTone === "error" ? "Error" : commandNoticeTone === "success" ? "Success" : "Info"}
          message={commandNotice}
          dismissible={true}
          ondismiss={(): void => { setCommandNotice("info", ""); }}
        />
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
            <KPI label={kpi.label} value={kpi.value} detail={kpi.detail} tone={kpi.tone} state={dashboardSurfaceState} accent={kpi.accent} />
          {/each}
        </section>

        <section class="split-grid">
          {#if dashboardSurfaceState === "loading"}
            <section class="chart-loading ehq-edge-surface" aria-label="Release readiness">
              <Loader label="Loading readiness" detail="Reading Office and Distribution dashboards." size="medium" />
            </section>
          {:else}
            <DonutChart
              title="Release readiness"
              value={readinessPercent}
              label={`${String(readinessOkCount)}/${String(readinessItems.length)} readiness checks ok.`}
              tone={dashboardSurfaceState === "error" ? "error" : readinessOkCount === readinessItems.length ? "success" : "warning"}
            />
          {/if}

          <section class="readiness-panel ehq-edge-surface" aria-label="Readiness checks">
            <header>
              <h2>Readiness</h2>
              <p>Admin checks before any app release.</p>
            </header>
            <div class="check-list">
              {#each readinessItems as item (item.id)}
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

          <Table title="Action list" columns={actionColumns} rows={actionRows} state={actionTableState} actionLabel="" />
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
            <header>
              <h2>Access editor</h2>
              <p>Persisted permission changes belong behind the API layer.</p>
            </header>
            <Input
              id="invite-email"
              label="Email"
              value={inviteEmail}
              placeholder="user@eeee.mu"
              type="email"
              state={commandBusy ? "disabled" : "default"}
              message=""
              oninput={updateInviteEmail}
            />
            <Select
              id="invite-role"
              label="Role"
              value={selectedRole}
              options={roleOptions}
              state={commandBusy ? "disabled" : "default"}
              message=""
              onchange={updateSelectedRole}
            />
            <div class="form-action">
              <Button
                label="Prepare review"
                variant="primary"
                size="small"
                type="button"
                disabled={!writesEnabled || inviteEmail.trim().length === 0}
                loading={commandBusy}
                locked={false}
                focus={false}
                ariaLabel="Prepare review"
                title={writesEnabled ? (inviteEmail.trim().length === 0 ? "Enter an email to review" : "Persist permission review") : writeGateMessage}
                onclick={requestAccessReview}
              />
            </div>
          </section>

          <section class="locked-card-reference ehq-edge-surface" aria-label="Locked card rule">
            <header>
              <h2>HQ card rule</h2>
              <p>Denied workspaces are visible on HQ, locked with a red cross, and never silently hidden.</p>
            </header>
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
            state="default"
            primaryAction="Inspect"
            secondaryAction=""
            onPrimaryAction={() => showIntegrationDetail("supabase-runtime")}
          />
          <Panel
            title="MCP"
            subtitle="Project-scoped tools"
            body="Enterprise context stays scoped to this repository. No global connector leak is introduced by the app shell."
            state="default"
            primaryAction="View scope"
            secondaryAction=""
            onPrimaryAction={() => showIntegrationDetail("mcp")}
          />
          <Panel
            title="Bank connectors"
            subtitle="Office import scope"
            body="MCB and SBI statement import status belongs to Office. Command Center watches readiness without parsing bank files."
            state="default"
            primaryAction="Open status"
            secondaryAction=""
            onPrimaryAction={openOfficeBankStatus}
          />
        </section>

        <Table
          title="Connectors"
          columns={integrationColumns}
          rows={integrationRows}
          state={integrationTableState}
          actionLabel=""
          rowActions={integrationRowActions}
        />
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
            <Input
              id="workspace-name"
              label="Workspace name"
              value={workspaceName}
              placeholder="Workspace"
              type="text"
              state={commandBusy ? "disabled" : "default"}
              message=""
              oninput={updateWorkspaceName}
            />
            <div class="form-action">
              <Button
                label="Save review"
                variant="primary"
                size="small"
                type="button"
                disabled={!writesEnabled || workspaceName.trim().length === 0}
                loading={commandBusy}
                locked={false}
                focus={false}
                ariaLabel="Save review"
                title={writesEnabled ? (workspaceName.trim().length === 0 ? "Enter a workspace name" : "Persist workspace settings review") : writeGateMessage}
                onclick={saveSettingsReview}
              />
            </div>
          </section>

          <Panel
            title="Supervision mode"
            subtitle="Admin workspace only"
            body="The Command Center menu is local to this app and does not appear inside Office or Distribution."
            state={writesEnabled ? (commandBusy ? "loading" : "default") : "locked"}
            primaryAction="Save review"
            secondaryAction=""
            onPrimaryAction={saveSettingsReview}
          />
        </section>

        <Table title="Preferences" columns={settingColumns} rows={settingsRows} state={settingsTableState} actionLabel="" />
      {/if}
    </div>
</WorkspaceShell>

<style>
  :global(body) {
    overflow: hidden;
  }

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

  .split-grid {
    grid-template-columns: minmax(220px, 0.7fr) minmax(0, 0.9fr) minmax(0, 1.4fr);
  }

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

  .form-action {
    display: flex;
    justify-content: flex-start;
  }

  .chart-loading {
    min-height: 190px;
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    place-items: center;
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
    --ehq-edge-border-color: var(--ehq-error);
  }

  .workspace-mini-grid span {
    color: var(--ehq-yellow);
    font-size: var(--ehq-type-section-title-size);
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
