import type { WorkspaceAppId } from "@ehq/auth";

export type Tone = "success" | "warning" | "error" | "info" | "muted" | "active";

export type PlatformPageId =
  | "cc_dash"
  | "cc_users"
  | "cc_integ"
  | "cc_settings"
  | "of_pnl"
  | "of_coa"
  | "of_tx"
  | "of_imports"
  | "of_dash"
  | "of_recon"
  | "of_pending"
  | "of_cash"
  | "di_dash"
  | "di_imports"
  | "di_mapping"
  | "di_catalog"
  | "di_contracts"
  | "di_alloc"
  | "di_suspense"
  | "di_state"
  | "di_pay"
  | "di_rev";

export interface NavItem {
  readonly id: PlatformPageId;
  readonly label: string;
  readonly locked: boolean;
}

export interface NavGroup {
  readonly workspaceId: WorkspaceAppId;
  readonly label: string;
  readonly items: readonly NavItem[];
}

export interface WorkspaceDefinition {
  readonly id: WorkspaceAppId;
  readonly label: string;
  readonly shortLabel: string;
  readonly defaultPageId: PlatformPageId;
}

export interface FilterChip {
  readonly label: string;
  readonly value: string;
  readonly active: boolean;
}

export interface Kpi {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone: Tone;
  readonly accent: boolean;
}

export interface BarPoint {
  readonly label: string;
  readonly level: number;
}

export interface DivergenceRow {
  readonly label: string;
  readonly revenue: string;
  readonly expenses: string;
  readonly net: string;
  readonly tone: "success" | "error";
  readonly level: number;
}

export interface CheckItem {
  readonly label: string;
  readonly tone: Tone;
}

export interface InlineMetric {
  readonly label: string;
  readonly value: string;
  readonly tone: Tone;
}

export interface DetailPanel {
  readonly title: string;
  readonly subtitle: string;
  readonly metrics: readonly InlineMetric[];
  readonly checks: readonly CheckItem[];
  readonly actions: readonly string[];
}

export interface TreeRow {
  readonly depth: 1 | 2 | 3;
  readonly label: string;
  readonly meta: string;
  readonly badge: string;
  readonly tone: Tone;
  readonly action: string;
}

export interface PermissionPill {
  readonly label: string;
  readonly allowed: boolean;
}

export type TableCell =
  | { readonly kind: "text"; readonly value: string; readonly strong: boolean }
  | { readonly kind: "money"; readonly value: string; readonly tone: Tone }
  | { readonly kind: "badge"; readonly value: string; readonly tone: Tone }
  | { readonly kind: "action"; readonly value: string; readonly tone: Tone }
  | { readonly kind: "check"; readonly value: boolean }
  | { readonly kind: "permissions"; readonly values: readonly PermissionPill[] };

export interface TableColumn {
  readonly label: string;
  readonly align: "left" | "right";
}

export interface DataTable {
  readonly title: string;
  readonly actionLabel: string;
  readonly columns: readonly TableColumn[];
  readonly rows: readonly (readonly TableCell[])[];
}

export interface PlatformPage {
  readonly area: "Command Center" | "Office" | "Distribution";
  readonly title: string;
  readonly subtitle: string;
  readonly toolbar: readonly FilterChip[];
  readonly kpis: readonly Kpi[];
  readonly chartTitle: string;
  readonly chartSubtitle: string;
  readonly bars: readonly BarPoint[];
  readonly divergenceRows: readonly DivergenceRow[];
  readonly checksTitle: string;
  readonly checksSubtitle: string;
  readonly checks: readonly CheckItem[];
  readonly panels: readonly DetailPanel[];
  readonly treeRows: readonly TreeRow[];
  readonly table: DataTable;
  readonly note: string;
}

export const textCell = (value: string, strong: boolean): TableCell => ({ kind: "text", value, strong });
export const moneyCell = (value: string, tone: Tone): TableCell => ({ kind: "money", value, tone });
export const badgeCell = (value: string, tone: Tone): TableCell => ({ kind: "badge", value, tone });
export const actionCell = (value: string, tone: Tone): TableCell => ({ kind: "action", value, tone });
export const checkCell = (value: boolean): TableCell => ({ kind: "check", value });
export const permissionsCell = (values: readonly PermissionPill[]): TableCell => ({ kind: "permissions", values });

export const kpi = (label: string, value: string, detail: string, tone: Tone, accent: boolean): Kpi => ({
  label,
  value,
  detail,
  tone,
  accent
});

export const filter = (label: string, value: string, active: boolean): FilterChip => ({ label, value, active });
export const bar = (label: string, level: number): BarPoint => ({ label, level });
export const check = (label: string, tone: Tone): CheckItem => ({ label, tone });
export const metric = (label: string, value: string, tone: Tone): InlineMetric => ({ label, value, tone });

export const panel = (
  title: string,
  subtitle: string,
  metrics: readonly InlineMetric[],
  checks: readonly CheckItem[],
  actions: readonly string[]
): DetailPanel => ({
  title,
  subtitle,
  metrics,
  checks,
  actions
});

export const table = (
  title: string,
  actionLabel: string,
  columns: readonly TableColumn[],
  rows: readonly (readonly TableCell[])[]
): DataTable => ({
  title,
  actionLabel,
  columns,
  rows
});

export const page = (input: PlatformPage): PlatformPage => input;

const baseBars: readonly BarPoint[] = [bar("T1", 52), bar("T2", 67), bar("T3", 82), bar("T4", 100)];
const monthBars: readonly BarPoint[] = [
  bar("1", 34),
  bar("5", 55),
  bar("8", 28),
  bar("11", 66),
  bar("14", 48),
  bar("17", 75),
  bar("20", 58),
  bar("23", 88),
  bar("26", 70),
  bar("29", 100)
];

const standardChecks: readonly CheckItem[] = [
  check("Imports normalized", "success"),
  check("Mapping rules applied", "success"),
  check("12 splits to review", "warning"),
  check("3 statements blocked", "error")
];

const actionTable = table(
  "Actions",
  "View all",
  [
    { label: "Action", align: "left" },
    { label: "Context", align: "left" },
    { label: "Count", align: "right" },
    { label: "Status", align: "left" },
    { label: "", align: "left" }
  ],
  [
    [textCell("Fix contributors", true), textCell("catalog · review", false), moneyCell("7", "warning"), badgeCell("Review", "warning"), actionCell("Open", "muted")],
    [textCell("Resolve suspense", true), textCell("missing split", false), moneyCell("19", "warning"), badgeCell("Blocked", "error"), actionCell("Open", "muted")],
    [textCell("Post payments", true), textCell("approved statements", false), moneyCell("5", "success"), badgeCell("Ready", "success"), actionCell("Reconcile", "active")]
  ]
);

export const navGroups: readonly NavGroup[] = [
  {
    workspaceId: "command-center",
    label: "Command Center",
    items: [
      { id: "cc_dash", label: "Dashboard", locked: false },
      { id: "cc_users", label: "Users & permissions", locked: false },
      { id: "cc_integ", label: "Integrations", locked: false },
      { id: "cc_settings", label: "Settings", locked: false }
    ]
  },
  {
    workspaceId: "office",
    label: "Office",
    items: [
      { id: "of_dash", label: "Dashboard", locked: false },
      { id: "of_pnl", label: "P&L", locked: false },
      { id: "of_coa", label: "Chart of accounts", locked: false },
      { id: "of_tx", label: "Transactions", locked: false },
      { id: "of_imports", label: "Imports", locked: false },
      { id: "of_recon", label: "Reconciliation", locked: false },
      { id: "of_pending", label: "Pending", locked: false },
      { id: "of_cash", label: "Cash flow", locked: false }
    ]
  },
  {
    workspaceId: "distribution",
    label: "Distribution",
    items: [
      { id: "di_dash", label: "Dashboard", locked: false },
      { id: "di_imports", label: "Imports", locked: false },
      { id: "di_mapping", label: "Mapping", locked: false },
      { id: "di_catalog", label: "Catalog", locked: false },
      { id: "di_contracts", label: "Contracts", locked: false },
      { id: "di_alloc", label: "Allocations", locked: false },
      { id: "di_suspense", label: "Suspense", locked: false },
      { id: "di_state", label: "Statements", locked: false },
      { id: "di_pay", label: "Payments", locked: false },
      { id: "di_rev", label: "Revenue", locked: false }
    ]
  }
];

export const workspaces: readonly WorkspaceDefinition[] = [
  {
    id: "command-center",
    label: "Command Center",
    shortLabel: "Command",
    defaultPageId: "cc_dash"
  },
  {
    id: "office",
    label: "Office",
    shortLabel: "Office",
    defaultPageId: "of_dash"
  },
  {
    id: "distribution",
    label: "Distribution",
    shortLabel: "Distribution",
    defaultPageId: "di_dash"
  }
];

export function getNavGroupForWorkspace(workspaceId: WorkspaceAppId): NavGroup {
  const group = navGroups.find((item: NavGroup): boolean => item.workspaceId === workspaceId);

  if (group === undefined) {
    throw new Error(`Unknown workspace navigation group: ${workspaceId}`);
  }

  return group;
}

export function getWorkspaceForPage(pageId: PlatformPageId): WorkspaceDefinition {
  const workspace = workspaces.find((item: WorkspaceDefinition): boolean => item.defaultPageId === pageId);

  if (workspace !== undefined) {
    return workspace;
  }

  const group = navGroups.find((navGroup: NavGroup): boolean =>
    navGroup.items.some((item: NavItem): boolean => item.id === pageId)
  );

  if (group === undefined) {
    throw new Error(`Unknown page workspace: ${pageId}`);
  }

  const definition = workspaces.find((item: WorkspaceDefinition): boolean => item.id === group.workspaceId);

  if (definition === undefined) {
    throw new Error(`Unknown workspace definition: ${group.workspaceId}`);
  }

  return definition;
}

export const platformPages: Readonly<Record<PlatformPageId, PlatformPage>> = {
  cc_dash: page({
    area: "Command Center",
    title: "Dashboard",
    subtitle: "Overview, system health and actions.",
    toolbar: [],
    kpis: [
      kpi("Revenue MTD", "Rs 5 890 000", "+ 8.2 %", "success", true),
      kpi("Active labels", "5", "mutewax · zanana · bad", "muted", false),
      kpi("Suspense", "42", "- 11 this week", "success", false),
      kpi("Pending payments", "Rs 318 000", "7 payees", "warning", false)
    ],
    chartTitle: "Quarterly revenue",
    chartSubtitle: "ë • music + distribution",
    bars: baseBars,
    divergenceRows: [],
    checksTitle: "Readiness",
    checksSubtitle: "Readiness status",
    checks: standardChecks,
    panels: [],
    treeRows: [],
    table: table(
      "Top royalties",
      "View all",
      [
        { label: "Payee", align: "left" },
        { label: "Label", align: "left" },
        { label: "Royalties", align: "right" },
        { label: "Status", align: "left" },
        { label: "", align: "left" }
      ],
      [
        [textCell("Alma Kreol", true), textCell("zanana", false), moneyCell("Rs 184 000", "success"), badgeCell("Paid", "success"), actionCell("Statement", "muted")],
        [textCell("Avneesh", true), textCell("bad", false), moneyCell("Rs 96 000", "warning"), badgeCell("Pending", "warning"), actionCell("Statement", "muted")],
        [textCell("Kaya estate", true), textCell("babani", false), moneyCell("Rs 132 000", "info"), badgeCell("Review", "info"), actionCell("Share", "muted")]
      ]
    ),
    note: ""
  }),
  cc_users: page({
    area: "Command Center",
    title: "Users & permissions",
    subtitle: "Who can open Command Center, Office and Distribution.",
    toolbar: [filter("Role", "All", true), filter("Status", "Active", false)],
    kpis: [
      kpi("Members", "12", "4 active roles", "muted", true),
      kpi("Denied access", "8", "visible cards", "error", false),
      kpi("Requests", "3", "pending", "warning", false),
      kpi("SSO", "Active", "eeee.mu", "success", false)
    ],
    chartTitle: "Access coverage",
    chartSubtitle: "by workspace",
    bars: [bar("HQ", 100), bar("Office", 72), bar("Dist.", 58), bar("CC", 33)],
    divergenceRows: [],
    checksTitle: "Access gate",
    checksSubtitle: "No implicit permission",
    checks: [
      check("Explicit permissions", "success"),
      check("Denied access visible with red cross", "success"),
      check("Monthly review to run", "warning"),
      check("No implicit access", "success")
    ],
    panels: [],
    treeRows: [],
    table: table(
      "Members",
      "Invite",
      [
        { label: "User", align: "left" },
        { label: "Role", align: "left" },
        { label: "Access", align: "left" },
        { label: "Status", align: "left" },
        { label: "", align: "left" }
      ],
      [
        [textCell("David", true), textCell("General management", false), permissionsCell([{ label: "HQ", allowed: true }, { label: "Office", allowed: true }, { label: "Dist.", allowed: true }, { label: "CC", allowed: true }]), badgeCell("Active", "success"), actionCell("Edit", "muted")],
        [textCell("Sophie", true), textCell("Office manager", false), permissionsCell([{ label: "HQ", allowed: true }, { label: "Office", allowed: true }, { label: "Dist.", allowed: false }, { label: "CC", allowed: false }]), badgeCell("Active", "success"), actionCell("Edit", "muted")],
        [textCell("Théo", true), textCell("Royalty manager", false), permissionsCell([{ label: "HQ", allowed: true }, { label: "Office", allowed: true }, { label: "Dist.", allowed: true }, { label: "CC", allowed: false }]), badgeCell("Review", "warning"), actionCell("Edit", "muted")]
      ]
    ),
    note: "A denied workspace stays visible on the home page with a locked card and a red cross."
  }),
  cc_integ: page({
    area: "Command Center",
    title: "Integrations",
    subtitle: "Connected services and health status.",
    toolbar: [filter("Scope", "All", true), filter("Status", "Connected", false)],
    kpis: [kpi("Connectors", "4", "3 active", "success", true), kpi("WordPress", "Connected", "Office · Distribution", "success", false), kpi("Banks", "2", "MCB + SBI", "info", false), kpi("Incidents", "0", "today", "success", false)],
    chartTitle: "Connector activity",
    chartSubtitle: "latest signals",
    bars: [bar("WP", 96), bar("MCB", 88), bar("SBI", 36), bar("Assets", 72)],
    divergenceRows: [],
    checksTitle: "Checks",
    checksSubtitle: "read-only here",
    checks: [check("WordPress REST available", "success"), check("Project-scoped MCP", "success"), check("SBI on standby", "warning"), check("No remote writes", "success")],
    panels: [],
    treeRows: [],
    table: table(
      "Connectors",
      "Add",
      [
        { label: "Connector", align: "left" },
        { label: "Type", align: "left" },
        { label: "Scope", align: "left" },
        { label: "Status", align: "left" },
        { label: "", align: "left" }
      ],
      [
        [textCell("WordPress e-hq", true), textCell("REST / MCP", false), textCell("Office · Distribution", false), badgeCell("Connected", "success"), actionCell("Manage", "muted")],
        [textCell("MCB statements", true), textCell("Bank import", false), textCell("Office", false), badgeCell("Connected", "success"), actionCell("Manage", "muted")],
        [textCell("SBI statements", true), textCell("Bank import", false), textCell("Office", false), badgeCell("Idle", "muted"), actionCell("Connect", "muted")],
        [textCell("Firefly / Adobe", true), textCell("Assets", false), textCell("Visuals", false), badgeCell("Connected", "success"), actionCell("Manage", "muted")]
      ]
    ),
    note: ""
  }),
  cc_settings: page({
    area: "Command Center",
    title: "Settings",
    subtitle: "Workspace preferences and operational status.",
    toolbar: [],
    kpis: [kpi("Theme", "Dark", "ë identity locked", "active", true), kpi("Backups", "Nightly", "automatic", "success", false), kpi("Exports", "1", "control to review", "warning", false), kpi("Integrity", "OK", "check passed", "success", false)],
    chartTitle: "Preferences",
    chartSubtitle: "internal use",
    bars: [bar("Theme", 100), bar("A11y", 68), bar("Audit", 82), bar("Exports", 44)],
    divergenceRows: [],
    checksTitle: "System",
    checksSubtitle: "monitoring",
    checks: [check("Integrity check passed", "success"), check("Backups nightly", "success"), check("1 export control notice", "warning")],
    panels: [panel("Appearance", "The theme is locked to the ë identity.", [metric("Mode", "Dark", "active"), metric("Accent", "Signal", "active")], [], ["High contrast"])],
    treeRows: [],
    table: table("Preferences", "Save", [{ label: "Key", align: "left" }, { label: "Value", align: "left" }, { label: "Status", align: "left" }, { label: "", align: "left" }], [
      [textCell("Theme", true), textCell("Dark command center", false), badgeCell("Locked", "active"), actionCell("View", "muted")],
      [textCell("System status", true), textCell("Operational", false), badgeCell("OK", "success"), actionCell("View", "muted")]
    ]),
    note: ""
  }),
  of_pnl: page({
    area: "Office",
    title: "P&L · income statement",
    subtitle: "Consolidated · all departments · May 2026.",
    toolbar: [filter("Period", "May 2026", true), filter("Department", "All", false)],
    kpis: [kpi("Revenue", "Rs 5 890 000", "+ 8.2 %", "success", false), kpi("Expenses", "Rs 5 560 000", "+ 3.1 %", "error", false), kpi("Net result", "+ Rs 330 000", "+ 19.4 %", "success", true), kpi("Net margin", "5.6 %", "+ 0.7 pt", "success", false)],
    chartTitle: "Result by department",
    chartSubtitle: "net = revenue - expenses",
    bars: [],
    divergenceRows: [
      { label: "ë • music", revenue: "Rs 1 240 000", expenses: "Rs 890 000", net: "+ 350 000", tone: "success", level: 100 },
      { label: "the storë", revenue: "Rs 980 000", expenses: "Rs 760 000", net: "+ 220 000", tone: "success", level: 63 },
      { label: "mōris", revenue: "Rs 720 000", expenses: "Rs 540 000", net: "+ 180 000", tone: "success", level: 51 },
      { label: "evënts", revenue: "Rs 1 560 000", expenses: "Rs 1 610 000", net: "- 50 000", tone: "error", level: 14 },
      { label: "ë • office", revenue: "Rs 60 000", expenses: "Rs 410 000", net: "- 350 000", tone: "error", level: 100 }
    ],
    checksTitle: "Projection",
    checksSubtitle: "validated source",
    checks: [check("Validated ledger only", "success"), check("Complete taxonomy", "success"), check("No ad-hoc query", "success"), check("Open period", "warning")],
    panels: [],
    treeRows: [],
    table: table("Top lines", "Export", [{ label: "Line", align: "left" }, { label: "Department", align: "left" }, { label: "Amount", align: "right" }, { label: "Type", align: "left" }, { label: "", align: "left" }], [
      [textCell("Stage build", true), textCell("evënts", false), moneyCell("Rs 120 000", "error"), badgeCell("Expense", "error"), actionCell("Open", "muted")],
      [textCell("Bandcamp payout", true), textCell("ë • music", false), moneyCell("Rs 82 000", "success"), badgeCell("Income", "success"), actionCell("Open", "muted")]
    ]),
    note: "Figures come from validated projections tagged Department -> Division -> Category."
  }),
  of_dash: page({
    area: "Office",
    title: "Office dashboard",
    subtitle: "Finance, bank and monitoring summary.",
    toolbar: [],
    kpis: [
      kpi("CASH BALANCE", "Rs 0", "loading", "muted", false),
      kpi("RECEIVABLES", "Rs 0", "loading", "muted", false),
      kpi("PAYABLES", "Rs 0", "loading", "muted", false),
      kpi("UNRECONCILED", "0", "loading", "muted", true)
    ],
    chartTitle: "Cash flow",
    chartSubtitle: "daily buckets",
    bars: [],
    divergenceRows: [],
    checksTitle: "Dashboard",
    checksSubtitle: "read status",
    checks: [
      check("Dashboard endpoint loaded", "info"),
      check("Reconciliation queue", "info"),
      check("Bank quality quality", "info")
    ],
    panels: [],
    treeRows: [],
    table: table(
      "Recent reconciliation",
      "Open",
      [
        { label: "Date", align: "left" },
        { label: "Bank", align: "left" },
        { label: "Ledger", align: "left" },
        { label: "Status", align: "left" },
        { label: "Amount", align: "right" }
      ],
      []
    ),
    note: "Live Office dashboard from the typed API."
  }),
  of_coa: page({
    area: "Office",
    title: "Chart of accounts",
    subtitle: "Managed tree · Department -> Division -> Category.",
    toolbar: [filter("Department", "All", true), filter("Type", "All", false)],
    kpis: [kpi("Categories", "548", "491 expenses · 57 income", "muted", true), kpi("Departments", "8", "active", "success", false), kpi("To map", "14", "recent imports", "warning", false), kpi("Duplicates", "0", "check passed", "success", false)],
    chartTitle: "Category mix",
    chartSubtitle: "by type",
    bars: [bar("Office", 78), bar("Music", 65), bar("Store", 54), bar("Events", 42)],
    divergenceRows: [],
    checksTitle: "Quality",
    checksSubtitle: "before posting",
    checks: [check("Stable category IDs", "success"), check("Explicit types", "success"), check("14 mappings to review", "warning")],
    panels: [],
    treeRows: [
      { depth: 1, label: "ë • office", meta: "dept", badge: "", tone: "muted", action: "+ division" },
      { depth: 2, label: "Shared Costs", meta: "div", badge: "", tone: "muted", action: "+ category" },
      { depth: 3, label: "Rent", meta: "cat_009", badge: "expense", tone: "error", action: "" },
      { depth: 3, label: "Salaries", meta: "cat_008", badge: "expense", tone: "error", action: "" },
      { depth: 1, label: "ë • music", meta: "dept", badge: "", tone: "muted", action: "" },
      { depth: 2, label: "Releases", meta: "div", badge: "", tone: "muted", action: "+ category" },
      { depth: 3, label: "Track Production", meta: "cat_014", badge: "expense", tone: "error", action: "" },
      { depth: 3, label: "Streaming income", meta: "cat_031", badge: "income", tone: "success", action: "" }
    ],
    table: table("Recent changes", "Add", [{ label: "Category", align: "left" }, { label: "Division", align: "left" }, { label: "Type", align: "left" }, { label: "ID", align: "left" }, { label: "", align: "left" }], [
      [textCell("Rent", true), textCell("Shared Costs", false), badgeCell("Expense", "error"), textCell("cat_009", false), actionCell("Edit", "muted")],
      [textCell("Streaming income", true), textCell("Releases", false), badgeCell("Income", "success"), textCell("cat_031", false), actionCell("Edit", "muted")]
    ]),
    note: ""
  }),
  of_tx: page({
    area: "Office",
    title: "Transactions",
    subtitle: "Ledger filterable by dimension.",
    toolbar: [filter("Department", "All", true), filter("Division", "All", false), filter("Category", "All", false), filter("Project", "All", false), filter("Type", "All", false)],
    kpis: [kpi("May lines", "214", "posted", "success", true), kpi("Drafts", "24", "to classify", "warning", false), kpi("Revenue", "Rs 82 000", "latest line", "success", false), kpi("Expenses", "Rs 205 400", "week", "error", false)],
    chartTitle: "Recent flows",
    chartSubtitle: "revenue vs expenses",
    bars: monthBars,
    divergenceRows: [],
    checksTitle: "Validation",
    checksSubtitle: "ledger",
    checks: [check("Category required", "success"), check("Project optional", "success"), check("24 unposted drafts", "warning")],
    panels: [],
    treeRows: [],
    table: table("May 2026", "New entry", [{ label: "Date", align: "left" }, { label: "Label", align: "left" }, { label: "Department", align: "left" }, { label: "Category", align: "left" }, { label: "Amount", align: "right" }, { label: "Status", align: "left" }], [
      [textCell("12 May", false), textCell("MCB transfer — rent", true), textCell("ë • office", false), textCell("Rent", false), moneyCell("- Rs 35 000", "error"), badgeCell("Posted", "success")],
      [textCell("11 May", false), textCell("Bandcamp payout", true), textCell("ë • music", false), textCell("Streaming income", false), moneyCell("+ Rs 82 000", "success"), badgeCell("Posted", "success")],
      [textCell("10 May", false), textCell("Stage build", true), textCell("evënts", false), textCell("Stage & Build", false), moneyCell("- Rs 120 000", "error"), badgeCell("Draft", "warning")]
    ]),
    note: ""
  }),
  of_imports: page({
    area: "Office",
    title: "Imports",
    subtitle: "Bank statements, cash flow and PDF documents.",
    toolbar: [filter("Source", "All", true), filter("Status", "All", false)],
    kpis: [kpi("Recent batches", "4", "May", "info", true), kpi("Parsed lines", "311", "bank + cash flow", "success", false), kpi("To fix", "1", "PDF invoice", "warning", false), kpi("Failed", "1", "SBI April", "error", false)],
    chartTitle: "Import health",
    chartSubtitle: "by source",
    bars: [bar("MCB", 100), bar("Cash", 72), bar("PDF", 42), bar("SBI", 18)],
    divergenceRows: [],
    checksTitle: "Import",
    checksSubtitle: "reversible batch",
    checks: [check("MCB parsed", "success"), check("Cash flow in preview", "info"), check("PDF to map", "warning"), check("SBI to retry", "error")],
    panels: [],
    treeRows: [],
    table: table("Recent imports", "Import", [{ label: "File", align: "left" }, { label: "Source", align: "left" }, { label: "Lines", align: "right" }, { label: "Period", align: "left" }, { label: "Status", align: "left" }, { label: "", align: "left" }], [
      [textCell("mcb_may.csv", true), textCell("MCB statement", false), moneyCell("214", "muted"), textCell("May 2026", false), badgeCell("Parsed", "success"), actionCell("Review", "muted")],
      [textCell("cashflow_q2.xlsx", true), textCell("Cash flow", false), moneyCell("96", "muted"), textCell("Apr-Jun", false), badgeCell("Preview", "info"), actionCell("Confirm", "active")],
      [textCell("supplier_inv.pdf", true), textCell("PDF invoice", false), moneyCell("1", "muted"), textCell("May 2026", false), badgeCell("To fix", "warning"), actionCell("Fix mapping", "muted")],
      [textCell("sbi_apr.csv", true), textCell("SBI statement", false), moneyCell("-", "muted"), textCell("-", false), badgeCell("Failed", "error"), actionCell("Retry", "error")]
    ]),
    note: ""
  }),
  of_recon: page({
    area: "Office",
    title: "Reconciliation",
    subtitle: "Match bank lines to the ledger.",
    toolbar: [filter("Account", "MCB", true), filter("Period", "May 2026", false), filter("Status", "Unmatched", false)],
    kpis: [kpi("Unmatched lines", "18", "to process", "warning", true), kpi("High confidence", "12", "ready to post", "success", false), kpi("Needs review", "6", "manual", "warning", false), kpi("Atomic", "Yes", "all or rollback", "success", false)],
    chartTitle: "Matching confidence",
    chartSubtitle: "proposals",
    bars: [bar("98%", 98), bar("91%", 91), bar("Low", 24)],
    divergenceRows: [],
    checksTitle: "Gate",
    checksSubtitle: "before validation",
    checks: [check("Complete batch", "success"), check("No partial posting", "success"), check("6 manual lines", "warning")],
    panels: [],
    treeRows: [],
    table: table("Proposed matches", "Approve high-confidence", [{ label: "Bank line", align: "left" }, { label: "Date", align: "left" }, { label: "Amount", align: "right" }, { label: "Proposed match", align: "left" }, { label: "Conf.", align: "left" }, { label: "", align: "left" }], [
      [textCell("CARD — vinyl pressing", true), textCell("08 May", false), moneyCell("Rs 48 000", "error"), textCell("Cost of Goods · the storë", false), badgeCell("98 %", "success"), actionCell("Approve", "active")],
      [textCell("TRANSFER — studio", true), textCell("06 May", false), moneyCell("Rs 22 000", "error"), textCell("Studio Costs · bōucan", false), badgeCell("91 %", "success"), actionCell("Approve", "active")],
      [textCell("DEBIT — unknown", true), textCell("05 May", false), moneyCell("Rs 7 500", "error"), textCell("-", false), badgeCell("Low", "warning"), actionCell("Assign", "muted")]
    ]),
    note: ""
  }),
  of_pending: page({
    area: "Office",
    title: "Pending",
    subtitle: "Classify drafts, then bulk-validate clean lines.",
    toolbar: [filter("File", "Draft queue", true), filter("Selection", "2 checked", false)],
    kpis: [kpi("Draft queue", "24", "items", "warning", true), kpi("Selection", "2", "bulk ready", "success", false), kpi("To classify", "1", "manual", "warning", false), kpi("Risk", "Low", "outside validated money", "success", false)],
    chartTitle: "Drafts",
    chartSubtitle: "by type",
    bars: [bar("Travel", 38), bar("Print", 62), bar("Misc", 22), bar("Bank", 48)],
    divergenceRows: [],
    checksTitle: "Bulk validate",
    checksSubtitle: "clean lines only",
    checks: [check("2 lines selected", "success"), check("1 line without category", "warning"), check("Validation batch only", "success")],
    panels: [],
    treeRows: [],
    table: table("Draft queue · 24 items", "Bulk validate", [{ label: "", align: "left" }, { label: "Label", align: "left" }, { label: "Suggested department", align: "left" }, { label: "Category", align: "left" }, { label: "Amount", align: "right" }, { label: "", align: "left" }], [
      [checkCell(true), textCell("Uber — airport run", true), textCell("ë • talent", false), textCell("Travel", false), moneyCell("Rs 2 400", "error"), actionCell("Validate", "muted")],
      [checkCell(true), textCell("Print run — posters", true), textCell("ë • visuals", false), textCell("Print", false), moneyCell("Rs 18 000", "error"), actionCell("Validate", "muted")],
      [checkCell(false), textCell("Misc — to classify", true), textCell("-", false), textCell("-", false), moneyCell("Rs 5 200", "error"), actionCell("Classify", "muted")]
    ]),
    note: ""
  }),
  of_cash: page({
    area: "Office",
    title: "Cash flow",
    subtitle: "Inflows, outflows and projection.",
    toolbar: [filter("Period", "May 2026", true), filter("Account", "All", false)],
    kpis: [kpi("Opening", "Rs 1 240 000", "May 01", "muted", false), kpi("Inflows", "+ Rs 890 000", "May", "success", false), kpi("Outflows", "- Rs 640 000", "May", "error", false), kpi("Closing", "Rs 1 490 000", "+ Rs 250 000", "success", true)],
    chartTitle: "Daily movement",
    chartSubtitle: "May",
    bars: monthBars,
    divergenceRows: [],
    checksTitle: "Projection",
    checksSubtitle: "short term",
    checks: [check("MCB/SBI accounts included", "success"), check("Cash flow imported", "success"), check("Forecast to confirm", "warning")],
    panels: [],
    treeRows: [],
    table: table("Recent movements", "Project", [{ label: "Date", align: "left" }, { label: "Label", align: "left" }, { label: "Flow", align: "right" }, { label: "Account", align: "left" }, { label: "Status", align: "left" }], [
      [textCell("21 May", false), textCell("Bandcamp payout", true), moneyCell("+ Rs 82 000", "success"), textCell("MCB", false), badgeCell("Posted", "success")],
      [textCell("20 May", false), textCell("Stage build", true), moneyCell("- Rs 120 000", "error"), textCell("MCB", false), badgeCell("Posted", "success")]
    ]),
    note: ""
  }),
  di_dash: page({
    area: "Distribution",
    title: "Dashboard",
    subtitle: "Royalty cockpit, readiness and diagnostics.",
    toolbar: [],
    kpis: [kpi("Catalog tracks", "1 284", "+ 24 this month", "success", false), kpi("Open royalties", "Rs 412 000", "payables", "active", true), kpi("Suspense", "42", "grouped by reason", "warning", false), kpi("Last allocation", "3j", "posted", "success", false)],
    chartTitle: "Quarterly revenue",
    chartSubtitle: "royalties",
    bars: [bar("T1", 55), bar("T2", 69), bar("T3", 83), bar("T4", 100)],
    divergenceRows: [],
    checksTitle: "Health",
    checksSubtitle: "royalty operations",
    checks: standardChecks,
    panels: [],
    treeRows: [],
    table: actionTable,
    note: ""
  }),
  di_imports: page({
    area: "Distribution",
    title: "Imports",
    subtitle: "Upload health and batch diagnostics.",
    toolbar: [filter("Store", "All", true), filter("State", "Active", false)],
    kpis: [kpi("Batches", "3", "May 2026", "info", true), kpi("Rows", "15 156", "normalized", "success", false), kpi("Mapping", "1", "to review", "warning", false), kpi("Currency", "USD/EUR", "separate", "muted", false)],
    chartTitle: "Imported batches",
    chartSubtitle: "by store",
    bars: [bar("Spotify", 100), bar("Apple", 62), bar("Deezer", 23)],
    divergenceRows: [],
    checksTitle: "Diagnostics",
    checksSubtitle: "by batch",
    checks: [check("Spotify normalized", "success"), check("Apple in mapping", "info"), check("Deezer to fix", "warning")],
    panels: [],
    treeRows: [],
    table: table("Batches", "Import", [{ label: "Batch", align: "left" }, { label: "Store", align: "left" }, { label: "Rows", align: "right" }, { label: "Currency", align: "left" }, { label: "Status", align: "left" }, { label: "", align: "left" }], [
      [textCell("2026-05 spotify", true), textCell("Spotify", false), moneyCell("8 210", "muted"), textCell("USD", false), badgeCell("Normalized", "success"), actionCell("Open", "muted")],
      [textCell("2026-05 apple", true), textCell("Apple Music", false), moneyCell("5 044", "muted"), textCell("USD", false), badgeCell("Mapping", "info"), actionCell("Review", "muted")],
      [textCell("2026-05 deezer", true), textCell("Deezer", false), moneyCell("1 902", "muted"), textCell("EUR", false), badgeCell("To fix", "warning"), actionCell("Fix", "muted")]
    ]),
    note: ""
  }),
  di_mapping: page({
    area: "Distribution",
    title: "Mapping",
    subtitle: "Review imported lines and apply safe rules.",
    toolbar: [filter("Batch", "2026-05 apple", true), filter("State", "Unmapped", false)],
    kpis: [kpi("Rows to review", "3", "batch apple", "warning", true), kpi("Auto-match", "2", "high confidence", "success", false), kpi("Manual", "1", "untitled", "warning", false), kpi("Rules", "18", "reusable", "info", false)],
    chartTitle: "Matching confidence",
    chartSubtitle: "imported lines",
    bars: [bar("96 %", 96), bar("Low", 22), bar("88 %", 88)],
    divergenceRows: [],
    checksTitle: "Automation",
    checksSubtitle: "safe only",
    checks: [check("2 acceptable proposals", "success"), check("1 manual mapping", "warning"), check("Reusable rules", "info")],
    panels: [],
    treeRows: [],
    table: table("Rows to review", "Apply rules", [{ label: "Imported title", align: "left" }, { label: "Artist", align: "left" }, { label: "Matched track", align: "left" }, { label: "Confidence", align: "left" }, { label: "", align: "left" }], [
      [textCell("Alma (radio edit)", true), textCell("Alma Kreol", false), textCell("Alma — Alma Kreol", false), badgeCell("96 %", "success"), actionCell("Accept", "active")],
      [textCell("Untitled 03", true), textCell("Avneesh", false), textCell("-", false), badgeCell("Low", "warning"), actionCell("Map", "muted")],
      [textCell("Séga 2024", true), textCell("Various", false), textCell("Séga 2024 — V/A", false), badgeCell("88 %", "success"), actionCell("Accept", "active")]
    ]),
    note: ""
  }),
  di_catalog: page({
    area: "Distribution",
    title: "Catalog",
    subtitle: "Canonical catalog and contributors to review.",
    toolbar: [filter("Source", "All", true), filter("Status", "Needs review", false)],
    kpis: [kpi("Tracks", "1 284", "canonical catalog", "success", true), kpi("Needs review", "7", "contributors", "warning", false), kpi("Missing ISRC", "0", "check passed", "success", false), kpi("Sources", "9", "DSP", "muted", false)],
    chartTitle: "Catalog",
    chartSubtitle: "release status",
    bars: [bar("OK", 100), bar("Review", 18), bar("New", 24)],
    divergenceRows: [],
    checksTitle: "Quality",
    checksSubtitle: "before allocation",
    checks: [check("ISRC present", "success"), check("7 contributors to fix", "warning"), check("Single canonical catalog", "success")],
    panels: [],
    treeRows: [],
    table: table("Releases", "Add", [{ label: "Title", align: "left" }, { label: "Artist", align: "left" }, { label: "ISRC", align: "left" }, { label: "Contributors", align: "right" }, { label: "Status", align: "left" }, { label: "", align: "left" }], [
      [textCell("Alma Kreol", true), textCell("Alma Kreol", false), textCell("MU-A01-26-001", false), moneyCell("3", "muted"), badgeCell("OK", "success"), actionCell("Open", "muted")],
      [textCell("Redlight", true), textCell("Babani", false), textCell("MU-B02-26-014", false), moneyCell("-", "muted"), badgeCell("Needs review", "warning"), actionCell("Fix", "muted")],
      [textCell("Hal", true), textCell("V/A", false), textCell("MU-Z01-26-007", false), moneyCell("5", "muted"), badgeCell("OK", "success"), actionCell("Open", "muted")]
    ]),
    note: ""
  }),
  di_contracts: page({
    area: "Distribution",
    title: "Contracts",
    subtitle: "Splits, payees, expenses and recoupments.",
    toolbar: [filter("Status", "Active", true), filter("Split", "All", false)],
    kpis: [kpi("Active contracts", "63", "catalog", "success", true), kpi("Open recoupments", "Rs 214 000", "audited source", "warning", false), kpi("Unbalanced splits", "12", "to fix", "error", false), kpi("Exact", "10 000 bp", "invariant", "success", false)],
    chartTitle: "Contract state",
    chartSubtitle: "splits and expenses",
    bars: [bar("Balanced", 82), bar("Review", 28), bar("Recoup", 44)],
    divergenceRows: [],
    checksTitle: "Contract",
    checksSubtitle: "before allocation",
    checks: [check("Complete splits required", "success"), check("12 splits to fix", "warning"), check("Auditable recoupments", "success")],
    panels: [],
    treeRows: [],
    table: table("Tracks & releases", "Create", [{ label: "Track", align: "left" }, { label: "Artist", align: "left" }, { label: "ISRC", align: "left" }, { label: "Splits", align: "left" }, { label: "Expenses", align: "right" }, { label: "Status", align: "left" }, { label: "", align: "left" }], [
      [textCell("Alma", true), textCell("Alma Kreol", false), textCell("MU-A01-26-001", false), textCell("100 %", false), moneyCell("Rs 36 000", "warning"), badgeCell("Balanced", "success"), actionCell("Open split", "muted")],
      [textCell("Redlight", true), textCell("Babani", false), textCell("MU-B02-26-014", false), textCell("92 %", false), moneyCell("Rs 58 000", "warning"), badgeCell("Fix", "warning"), actionCell("Fix", "muted")]
    ]),
    note: ""
  }),
  di_alloc: page({
    area: "Distribution",
    title: "Allocations",
    subtitle: "Preview, post and unpost in batches with the server lock.",
    toolbar: [filter("Batch", "Pending", true), filter("Mode", "Preview", false)],
    kpis: [kpi("Pending waves", "6", "server-paced", "warning", true), kpi("Last run", "18 402", "posted lines", "success", false), kpi("Divergences", "3", "audit micro", "warning", false), kpi("Lock", "Idle", "server idle", "success", false)],
    chartTitle: "Run waves",
    chartSubtitle: "server cadence",
    bars: [bar("W1", 100), bar("W2", 85), bar("W3", 76), bar("W4", 64), bar("W5", 58), bar("W6", 44)],
    divergenceRows: [],
    checksTitle: "Run control",
    checksSubtitle: "allocation safety",
    checks: [check("Server lock idle", "success"), check("Pending batch validated", "success"), check("6 waves to post", "warning")],
    panels: [panel("Last run", "Allocation posted", [metric("Lines", "18 402", "muted"), metric("Posted", "18 402", "success"), metric("Divergences", "3 audit", "warning")], [], ["Preview batch", "Post wave 1 / 6"])],
    treeRows: [],
    table: table("Recent runs", "Preview", [{ label: "Run", align: "left" }, { label: "Lines", align: "right" }, { label: "Status", align: "left" }, { label: "Lock", align: "left" }, { label: "", align: "left" }], [
      [textCell("2026-05 wave 0", true), moneyCell("18 402", "muted"), badgeCell("Posted", "success"), textCell("Released", false), actionCell("View", "muted")],
      [textCell("2026-06 pending", true), moneyCell("6 waves", "warning"), badgeCell("Preview", "info"), textCell("Idle", false), actionCell("Preview", "active")]
    ]),
    note: ""
  }),
  di_suspense: page({
    area: "Distribution",
    title: "Suspense",
    subtitle: "Blockers grouped by reason and exact action.",
    toolbar: [filter("Reason", "All", true), filter("Priority", "High", false)],
    kpis: [kpi("Suspense total", "42", "items", "warning", true), kpi("Missing split", "19", "contracts", "warning", false), kpi("Unmapped", "14", "mapping", "warning", false), kpi("Retry", "9", "imports", "muted", false)],
    chartTitle: "Blockers",
    chartSubtitle: "by reason",
    bars: [bar("Split", 100), bar("Map", 74), bar("Retry", 47)],
    divergenceRows: [],
    checksTitle: "Fix path",
    checksSubtitle: "exact action",
    checks: [check("Grouped reasons", "success"), check("Direct actions", "success"), check("19 blocking splits", "warning")],
    panels: [],
    treeRows: [],
    table: table("Blockers", "Resolve", [{ label: "Reason", align: "left" }, { label: "Track", align: "left" }, { label: "Amount", align: "right" }, { label: "Fix path", align: "left" }, { label: "", align: "left" }], [
      [textCell("Missing split", true), textCell("Redlight — Babani", false), moneyCell("Rs 58 000", "warning"), textCell("contracts", false), actionCell("Fix split", "active")],
      [textCell("Unmapped row", true), textCell("Untitled 03", false), moneyCell("Rs 3 200", "warning"), textCell("mapping", false), actionCell("Open", "muted")],
      [textCell("Import retry", true), textCell("deezer 05", false), moneyCell("Rs 0", "muted"), textCell("imports", false), actionCell("Retry", "muted")]
    ]),
    note: ""
  }),
  di_state: page({
    area: "Distribution",
    title: "Statements",
    subtitle: "Artist/payee statements by period and currency.",
    toolbar: [filter("Payee", "Alma Kreol", true), filter("Period", "Q2 2026", false), filter("Currency", "USD", false)],
    kpis: [kpi("Revenue", "Rs 184 000", "gross", "success", false), kpi("Recoup", "- Rs 36 000", "applied", "warning", false), kpi("Expenses", "- Rs 12 000", "statement", "error", false), kpi("Total due", "Rs 136 000", "payable", "active", true)],
    chartTitle: "Statement lines",
    chartSubtitle: "3 stores",
    bars: [bar("Spotify", 100), bar("Apple", 74), bar("Deezer", 36)],
    divergenceRows: [],
    checksTitle: "Generation",
    checksSubtitle: "PDF later",
    checks: [check("12 statement lines", "success"), check("Multi-currency separated", "success"), check("PDF ready to generate", "info")],
    panels: [panel("Financial summary", "Alma Kreol · Q2 2026 · USD", [metric("Revenue", "Rs 184 000", "success"), metric("Recoup", "- Rs 36 000", "warning"), metric("Total due", "Rs 136 000", "active")], [], ["Generate PDF"])],
    treeRows: [],
    table: table("Statement lines", "Generate", [{ label: "Store", align: "left" }, { label: "Track", align: "left" }, { label: "Gross", align: "right" }, { label: "Recoup", align: "right" }, { label: "Net", align: "right" }], [
      [textCell("Spotify", true), textCell("Alma", false), moneyCell("Rs 96 000", "success"), moneyCell("- Rs 18 000", "warning"), moneyCell("Rs 78 000", "active")],
      [textCell("Apple", true), textCell("Alma", false), moneyCell("Rs 58 000", "success"), moneyCell("- Rs 12 000", "warning"), moneyCell("Rs 46 000", "active")]
    ]),
    note: ""
  }),
  di_pay: page({
    area: "Distribution",
    title: "Payments",
    subtitle: "Record, edit, void and reconcile.",
    toolbar: [filter("Status", "All", true), filter("Method", "Bank", false)],
    kpis: [kpi("To pay", "Rs 178 000", "2 payees", "warning", true), kpi("Paid", "Rs 136 000", "Alma", "success", false), kpi("Void", "1", "estate", "muted", false), kpi("Reference", "MU-PAY", "prefix", "info", false)],
    chartTitle: "Payments",
    chartSubtitle: "state",
    bars: [bar("Paid", 100), bar("Pending", 31), bar("Void", 8)],
    divergenceRows: [],
    checksTitle: "Control",
    checksSubtitle: "before reconciliation",
    checks: [check("Unique references", "success"), check("2 pending", "warning"), check("Void kept for audit", "success")],
    panels: [],
    treeRows: [],
    table: table("Payments", "Save", [{ label: "Payee", align: "left" }, { label: "Amount", align: "right" }, { label: "Method", align: "left" }, { label: "Reference", align: "left" }, { label: "Status", align: "left" }, { label: "", align: "left" }], [
      [textCell("Alma Kreol", true), moneyCell("Rs 136 000", "success"), textCell("Bank", false), textCell("MU-PAY-0142", false), badgeCell("Paid", "success"), actionCell("Edit", "muted")],
      [textCell("Avneesh", true), moneyCell("Rs 42 000", "warning"), textCell("Bank", false), textCell("-", false), badgeCell("Pending", "warning"), actionCell("Post", "active")],
      [textCell("Babani estate", true), moneyCell("Rs 0", "muted"), textCell("-", false), textCell("-", false), badgeCell("Void", "muted"), actionCell("Edit", "muted")]
    ]),
    note: ""
  }),
  di_rev: page({
    area: "Distribution",
    title: "Revenue",
    subtitle: "Financial view by payee, track, currency, store and period.",
    toolbar: [filter("Group by", "Store", true), filter("Period", "Q2 2026", false), filter("Currency", "USD", false)],
    kpis: [kpi("Gross", "Rs 612 000", "Q2", "success", false), kpi("Net", "Rs 498 000", "after costs", "active", true), kpi("Payable", "Rs 412 000", "statements", "warning", false), kpi("Stores", "5", "DSP", "muted", false)],
    chartTitle: "By store",
    chartSubtitle: "Q2 2026",
    bars: [bar("Spot.", 100), bar("Apple", 74), bar("YT", 57), bar("Deez.", 43), bar("Other", 26)],
    divergenceRows: [],
    checksTitle: "View",
    checksSubtitle: "financial",
    checks: [check("Separate currency", "success"), check("Grouped store", "success"), check("Validated revenue only", "success")],
    panels: [panel("Totals", "Q2 2026", [metric("Gross", "Rs 612 000", "success"), metric("Net", "Rs 498 000", "active"), metric("Payable", "Rs 412 000", "warning")], [], ["Export"])],
    treeRows: [],
    table: table("Revenue lines", "Filter", [{ label: "Store", align: "left" }, { label: "Payee", align: "left" }, { label: "Track", align: "left" }, { label: "Gross", align: "right" }, { label: "Net", align: "right" }], [
      [textCell("Spotify", true), textCell("Alma Kreol", false), textCell("Alma", false), moneyCell("Rs 184 000", "success"), moneyCell("Rs 136 000", "active")],
      [textCell("Apple", true), textCell("Avneesh", false), textCell("Untitled 03", false), moneyCell("Rs 42 000", "warning"), moneyCell("Rs 42 000", "warning")]
    ]),
    note: ""
  })
};
