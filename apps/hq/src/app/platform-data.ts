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
