import type { PlatformPageId } from "./platform-data.js";
import { normalizeRoutePath } from "./route-utils.js";
import type { WorkspaceAppId } from "@ehq/auth";

export type AppRoute = "/" | "/login" | "/app" | "/console" | "/design" | `/console/${string}`;

export interface ConsoleTarget {
  readonly workspaceId: WorkspaceAppId;
  readonly pageId?: PlatformPageId;
}

const exactConsoleTargets: Readonly<Record<string, ConsoleTarget>> = {
  "/console": {
    workspaceId: "command-center",
    pageId: "cc_dash"
  },
  "/console/dashboard": {
    workspaceId: "command-center",
    pageId: "cc_dash"
  },
  "/console/command-center": {
    workspaceId: "command-center",
    pageId: "cc_dash"
  },
  "/console/command-center/dashboard": {
    workspaceId: "command-center",
    pageId: "cc_dash"
  },
  "/console/command-center/users": {
    workspaceId: "command-center",
    pageId: "cc_users"
  },
  "/console/command-center/integrations": {
    workspaceId: "command-center",
    pageId: "cc_integ"
  },
  "/console/command-center/settings": {
    workspaceId: "command-center",
    pageId: "cc_settings"
  },
  "/console/distribution/dashboard": {
    workspaceId: "distribution",
    pageId: "di_dash"
  },
  "/console/distribution/imports": {
    workspaceId: "distribution",
    pageId: "di_imports"
  },
  "/console/distribution/import": {
    workspaceId: "distribution",
    pageId: "di_imports"
  },
  "/console/distribution/mapping": {
    workspaceId: "distribution",
    pageId: "di_mapping"
  },
  "/console/distribution/catalog": {
    workspaceId: "distribution",
    pageId: "di_catalog"
  },
  "/console/distribution/aliases": {
    workspaceId: "distribution"
  },
  "/console/distribution/contracts": {
    workspaceId: "distribution",
    pageId: "di_contracts"
  },
  "/console/distribution/contracts/duplicates": {
    workspaceId: "distribution"
  },
  "/console/distribution/duplicates": {
    workspaceId: "distribution"
  },
  "/console/distribution/settings": {
    workspaceId: "distribution"
  },
  "/console/distribution/allocations": {
    workspaceId: "distribution",
    pageId: "di_alloc"
  },
  "/console/distribution/suspense": {
    workspaceId: "distribution",
    pageId: "di_suspense"
  },
  "/console/distribution/action-needed": {
    workspaceId: "distribution",
    pageId: "di_suspense"
  },
  "/console/distribution/statements": {
    workspaceId: "distribution",
    pageId: "di_state"
  },
  "/console/distribution/payments": {
    workspaceId: "distribution",
    pageId: "di_pay"
  },
  "/console/distribution/revenue": {
    workspaceId: "distribution",
    pageId: "di_rev"
  },
  "/console/distribution/audit-log": {
    workspaceId: "distribution"
  },
  "/console/distribution/audit": {
    workspaceId: "distribution"
  },
  "/console/distribution/financial-reconciliation": {
    workspaceId: "distribution"
  },
  "/console/import": {
    workspaceId: "distribution",
    pageId: "di_imports"
  },
  "/console/imports": {
    workspaceId: "distribution",
    pageId: "di_imports"
  },
  "/console/mapping": {
    workspaceId: "distribution",
    pageId: "di_mapping"
  },
  "/console/catalog": {
    workspaceId: "distribution",
    pageId: "di_catalog"
  },
  "/console/contracts": {
    workspaceId: "distribution",
    pageId: "di_contracts"
  },
  "/console/allocations": {
    workspaceId: "distribution",
    pageId: "di_alloc"
  },
  "/console/suspense": {
    workspaceId: "distribution",
    pageId: "di_suspense"
  },
  "/console/action-needed": {
    workspaceId: "distribution",
    pageId: "di_suspense"
  },
  "/console/statements": {
    workspaceId: "distribution",
    pageId: "di_state"
  },
  "/console/payments": {
    workspaceId: "distribution",
    pageId: "di_pay"
  },
  "/console/revenue": {
    workspaceId: "distribution",
    pageId: "di_rev"
  },
  "/console/aliases": {
    workspaceId: "distribution"
  },
  "/console/duplicates": {
    workspaceId: "distribution"
  },
  "/console/audit-log": {
    workspaceId: "distribution"
  },
  "/console/financial-reconciliation": {
    workspaceId: "distribution"
  },
  "/console/settings": {
    workspaceId: "distribution"
  },
  "/console/office/dashboard": {
    workspaceId: "office",
    pageId: "of_dash"
  },
  "/console/office/pl": {
    workspaceId: "office",
    pageId: "of_pnl"
  },
  "/console/office/pnl": {
    workspaceId: "office",
    pageId: "of_pnl"
  },
  "/console/office/coa": {
    workspaceId: "office",
    pageId: "of_coa"
  },
  "/console/office/plan-comptable": {
    workspaceId: "office",
    pageId: "of_coa"
  },
  "/console/office/chart-of-accounts": {
    workspaceId: "office",
    pageId: "of_coa"
  },
  "/console/office/transactions": {
    workspaceId: "office",
    pageId: "of_tx"
  },
  "/console/office/imports": {
    workspaceId: "office",
    pageId: "of_imports"
  },
  "/console/office/reconciliation": {
    workspaceId: "office",
    pageId: "of_recon"
  },
  "/console/office/reconciliations": {
    workspaceId: "office",
    pageId: "of_recon"
  },
  "/console/office/pending": {
    workspaceId: "office",
    pageId: "of_pending"
  },
  "/console/office/cashflow": {
    workspaceId: "office",
    pageId: "of_cash"
  },
  "/console/office/clients": {
    workspaceId: "office"
  },
  "/console/office/suppliers": {
    workspaceId: "office"
  },
  "/console/office/projects": {
    workspaceId: "office"
  },
  "/console/office/monitoring": {
    workspaceId: "office"
  },
  "/console/office/integrity": {
    workspaceId: "office"
  },
  "/console/office/vat": {
    workspaceId: "office"
  },
  "/console/office/audit": {
    workspaceId: "office"
  },
  "/console/office/ceo": {
    workspaceId: "office"
  },
  "/console/office/bank": {
    workspaceId: "office"
  },
  "/console/office/settings": {
    workspaceId: "office"
  },
  "/console/office-dashboard": {
    workspaceId: "office",
    pageId: "of_dash"
  },
  "/console/office-pl": {
    workspaceId: "office",
    pageId: "of_pnl"
  },
  "/console/office-imports": {
    workspaceId: "office",
    pageId: "of_imports"
  },
  "/console/office-audit": {
    workspaceId: "office"
  },
  "/console/office-settings": {
    workspaceId: "office"
  },
  "/console/pl": {
    workspaceId: "office",
    pageId: "of_pnl"
  },
  "/console/pnl": {
    workspaceId: "office",
    pageId: "of_pnl"
  },
  "/console/coa": {
    workspaceId: "office",
    pageId: "of_coa"
  },
  "/console/chart-of-accounts": {
    workspaceId: "office",
    pageId: "of_coa"
  },
  "/console/plan-comptable": {
    workspaceId: "office",
    pageId: "of_coa"
  },
  "/console/transactions": {
    workspaceId: "office",
    pageId: "of_tx"
  },
  "/console/reconciliation": {
    workspaceId: "office",
    pageId: "of_recon"
  },
  "/console/reconciliations": {
    workspaceId: "office",
    pageId: "of_recon"
  },
  "/console/pending": {
    workspaceId: "office",
    pageId: "of_pending"
  },
  "/console/cashflow": {
    workspaceId: "office",
    pageId: "of_cash"
  },
  "/console/clients": {
    workspaceId: "office"
  },
  "/console/suppliers": {
    workspaceId: "office"
  },
  "/console/projects": {
    workspaceId: "office"
  },
  "/console/monitoring": {
    workspaceId: "office"
  },
  "/console/integrity": {
    workspaceId: "office"
  },
  "/console/vat": {
    workspaceId: "office"
  },
  "/console/bank": {
    workspaceId: "office"
  },
  "/console/ceo": {
    workspaceId: "office"
  }
};

const pageRoutes: Readonly<Record<PlatformPageId, string>> = {
  cc_dash: "/console/command-center/dashboard",
  cc_users: "/console/command-center/users",
  cc_integ: "/console/command-center/integrations",
  cc_settings: "/console/command-center/settings",
  of_dash: "/console/office/dashboard",
  of_pnl: "/console/office/pnl",
  of_coa: "/console/office/coa",
  of_tx: "/console/office/transactions",
  of_imports: "/console/office/imports",
  of_recon: "/console/office/reconciliation",
  of_pending: "/console/office/pending",
  of_cash: "/console/office/cashflow",
  di_dash: "/console/distribution/dashboard",
  di_imports: "/console/distribution/imports",
  di_mapping: "/console/distribution/mapping",
  di_catalog: "/console/distribution/catalog",
  di_contracts: "/console/distribution/contracts",
  di_alloc: "/console/distribution/allocations",
  di_suspense: "/console/distribution/suspense",
  di_state: "/console/distribution/statements",
  di_pay: "/console/distribution/payments",
  di_rev: "/console/distribution/revenue"
};

const workspaceRoutes: Readonly<Record<WorkspaceAppId, string>> = {
  "command-center": "/console/command-center/dashboard",
  office: "/console/office/dashboard",
  distribution: "/console/distribution/dashboard"
};

const bareWorkspaceRedirects: Readonly<Record<string, AppRoute>> = {
  "/command-center": "/console/command-center/dashboard",
  "/distribution": "/console/distribution/dashboard",
  "/office": "/console/office/dashboard"
};

export const resolveBareWorkspaceRedirect = (path: string): AppRoute | null => {
  return bareWorkspaceRedirects[normalizeRoutePath(path)] ?? null;
};

export const isProtectedRoute = (route: AppRoute): boolean => {
  return route === "/app" || route === "/console" || route.startsWith("/console/");
};

// URL (path + query) sent to the login page so it can return to the denied route
// after sign-in. The route itself stays "/login"; the query is read separately.
export const buildLoginRouteWithNext = (nextRoute: AppRoute): string => {
  return `/login?next=${encodeURIComponent(nextRoute)}`;
};

export const normalizeRoute = (path: string): AppRoute => {
  const normalizedPath = normalizeRoutePath(path);

  if (normalizedPath === "/login") {
    return "/login";
  }

  if (normalizedPath === "/app") {
    return "/app";
  }

  if (normalizedPath === "/design") {
    return "/design";
  }

  if (normalizedPath === "/console" || normalizedPath.startsWith("/console/")) {
    return normalizedPath as AppRoute;
  }

  return "/";
};

export const resolveConsoleTarget = (path: string): ConsoleTarget | null => {
  const exactMatch = exactConsoleTargets[normalizeRoutePath(path)];

  if (exactMatch !== undefined) {
    return exactMatch;
  }

  return null;
};

export const resolveConsoleRouteForPage = (pageId: PlatformPageId): string | null => {
  return pageRoutes[pageId] ?? null;
};

export const resolveConsoleRouteForWorkspace = (workspaceId: WorkspaceAppId): string => {
  return workspaceRoutes[workspaceId];
};
