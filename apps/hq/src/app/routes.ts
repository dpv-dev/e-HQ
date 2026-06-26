import type { PlatformPageId } from "./platform-data.js";
import type { WorkspaceAppId } from "@ehq/auth";

export type AppRoute = "/" | "/login" | "/app" | "/design" | `/console/${string}`;

export interface ConsoleTarget {
  readonly workspaceId: WorkspaceAppId;
  readonly pageId: PlatformPageId;
}

const exactConsoleTargets: Readonly<Record<string, ConsoleTarget>> = {
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
  "/console/distribution/mapping": {
    workspaceId: "distribution",
    pageId: "di_mapping"
  },
  "/console/distribution/catalog": {
    workspaceId: "distribution",
    pageId: "di_catalog"
  },
  "/console/distribution/aliases": {
    workspaceId: "distribution",
    pageId: "di_catalog"
  },
  "/console/distribution/contracts": {
    workspaceId: "distribution",
    pageId: "di_contracts"
  },
  "/console/distribution/contracts/duplicates": {
    workspaceId: "distribution",
    pageId: "di_contracts"
  },
  "/console/distribution/duplicates": {
    workspaceId: "distribution",
    pageId: "di_contracts"
  },
  "/console/distribution/settings": {
    workspaceId: "distribution",
    pageId: "di_dash"
  },
  "/console/distribution/allocations": {
    workspaceId: "distribution",
    pageId: "di_alloc"
  },
  "/console/distribution/suspense": {
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
    workspaceId: "distribution",
    pageId: "di_rev"
  },
  "/console/distribution/financial-reconciliation": {
    workspaceId: "distribution",
    pageId: "di_suspense"
  },
  "/console/office/dashboard": {
    workspaceId: "office",
    pageId: "of_dash"
  },
  "/console/office/pl": {
    workspaceId: "office",
    pageId: "of_pnl"
  },
  "/console/office/coa": {
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
  "/console/office/pending": {
    workspaceId: "office",
    pageId: "of_pending"
  },
  "/console/office/cashflow": {
    workspaceId: "office",
    pageId: "of_cash"
  },
  "/console/office/clients": {
    workspaceId: "office",
    pageId: "of_imports"
  },
  "/console/office/suppliers": {
    workspaceId: "office",
    pageId: "of_imports"
  },
  "/console/office/projects": {
    workspaceId: "office",
    pageId: "of_imports"
  },
  "/console/office/monitoring": {
    workspaceId: "office",
    pageId: "of_recon"
  },
  "/console/office/vat": {
    workspaceId: "office",
    pageId: "of_cash"
  },
  "/console/office/audit": {
    workspaceId: "office",
    pageId: "of_recon"
  },
  "/console/office/ceo": {
    workspaceId: "office",
    pageId: "of_dash"
  },
  "/console/office/bank": {
    workspaceId: "office",
    pageId: "of_recon"
  },
  "/console/office/settings": {
    workspaceId: "office",
    pageId: "of_dash"
  },
  "/console/office/wave-invoices": {
    workspaceId: "office",
    pageId: "of_imports"
  }
};

const pageRoutes: Readonly<Record<PlatformPageId, string>> = {
  cc_dash: "/console/command-center/dashboard",
  cc_users: "/console/command-center/users",
  cc_integ: "/console/command-center/integrations",
  cc_settings: "/console/command-center/settings",
  of_dash: "/console/office/dashboard",
  of_pnl: "/console/office/pl",
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
  return bareWorkspaceRedirects[path] ?? null;
};

export const normalizeRoute = (path: string): AppRoute => {
  if (path === "/login") {
    return "/login";
  }

  if (path === "/app") {
    return "/app";
  }

  if (path === "/design") {
    return "/design";
  }

  if (path.startsWith("/console/")) {
    return path as AppRoute;
  }

  return "/";
};

export const resolveConsoleTarget = (path: string): ConsoleTarget | null => {
  const exactMatch = exactConsoleTargets[path];

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
