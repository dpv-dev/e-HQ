# Consolidation Plan - Phase 0 Current Structure

Read-only inventory for the "one app at `app.eeee.mu`" consolidation.
No code has been moved yet.

## Topology at a glance

- This is **one monorepo**, not three separate repos.
- The public front ends are implemented as **four separate workspace packages** under `apps/`:
  - `apps/hq`
  - `apps/office`
  - `apps/distribution`
  - `apps/command-center`
- Each workspace package has its **own entrypoint** (`src/main.ts`), its own Svelte app shell (`src/app/App.svelte`), its own Vite config, and its own `dist/` build output.
- There is **no shared runtime router** between the three workspace apps today. They are independent SPA builds that can be hosted on separate subdomains.
- `apps/hq` is the current hub app and already contains the internal console route map for Office, Distribution, and Command Center.
- Shared code already exists in `packages/ui`, `packages/auth`, and `packages/api-client`.

## Current deployment shape

- `app.eeee.mu` - hub / landing / console shell
- `office.eeee.mu` - standalone Office SPA deployment
- `distribution.eeee.mu` - standalone Distribution SPA deployment
- `command-center.eeee.mu` - standalone Command Center SPA deployment

## Workspace inventory

### 1) HQ - `apps/hq`

Current role:
- Front door, login, design system page, and the console router that dispatches into Office / Distribution / Command Center views.

Code locations:
- `apps/hq/src/app/App.svelte`
- `apps/hq/src/app/routes.ts`
- `apps/hq/src/app/PlatformShell.svelte`
- `apps/hq/src/app/LandingPage.svelte`
- `apps/hq/src/app/LoginPage.svelte`
- `apps/hq/src/app/DesignSystemPage.svelte`
- `apps/hq/src/app/platform-data.ts`
- `apps/hq/src/app/platform-page-data.ts`
- `apps/hq/src/app/supabase.ts`

Built public routes:
- `/` - landing
- `/login`
- `/design`
- `/app`
- `/console/*` - internal console routes resolved by `routes.ts`

Console pages already represented in the HQ route/page model:

Command Center pages:
- `cc_dash`
- `cc_users`
- `cc_integ`
- `cc_settings`

Office pages:
- `of_dash`
- `of_pnl`
- `of_coa`
- `of_tx`
- `of_imports`
- `of_recon`
- `of_pending`
- `of_cash`

Distribution pages:
- `di_dash`
- `di_imports`
- `di_mapping`
- `di_catalog`
- `di_contracts`
- `di_alloc`
- `di_suspense`
- `di_state`
- `di_pay`
- `di_rev`

Implementation note:
- The HQ console is **data-driven**: `routes.ts` maps paths to workspace/page ids, while `platform-data.ts` and `platform-page-data.ts` hold the page models rendered by `PlatformShell.svelte`.

Console route map in the current hub:

| Route | Page id | Workspace |
| --- | --- | --- |
| `/console/dashboard` | `cc_dash` | Command Center |
| `/console/office-dashboard` | `cc_users` | Command Center |
| `/console/integrity` | `cc_integ` | Command Center |
| `/console/command-center/settings` | `cc_settings` | Command Center |
| `/console/office-dashboard` | `of_dash` | Office |
| `/console/pl` | `of_pnl` | Office |
| `/console/office-coa` | `of_coa` | Office |
| `/console/transactions` | `of_tx` | Office |
| `/console/office-imports` | `of_imports` | Office |
| `/console/reconciliations` | `of_recon` | Office |
| `/console/pending` | `of_pending` | Office |
| `/console/cashflow` | `of_cash` | Office |
| `/console/dashboard` | `di_dash` | Distribution |
| `/console/office-imports` | `di_imports` | Distribution |
| `/console/mapping` | `di_mapping` | Distribution |
| `/console/catalog` | `di_catalog` | Distribution |
| `/console/contracts` | `di_contracts` | Distribution |
| `/console/allocations` | `di_alloc` | Distribution |
| `/console/action-needed` | `di_suspense` | Distribution |
| `/console/statements` | `di_state` | Distribution |
| `/console/revenue` | `di_pay` / `di_rev` | Distribution |

Note:
- The current hub intentionally reuses some routes for more than one page id; the active page depends on the current workspace context inside `PlatformShell.svelte`.

### 2) Office - `apps/office`

Current role:
- Standalone finance SPA for the Office workspace.

Code locations:
- `apps/office/src/app/App.svelte`
- `apps/office/src/app/office-preview-api.ts`
- `apps/office/src/app/MonitoringView.svelte`
- `apps/office/src/app/PartnersView.svelte`
- `apps/office/src/app/ProjectsView.svelte`
- `apps/office/src/main.ts`

Built internal sections inside the Office SPA:
- `pnl`
- `coa`
- `transactions`
- `imports`
- `reconciliation`
- `pending`
- `cashflow`
- `clients`
- `suppliers`
- `projects`
- `monitoring`

Implementation note:
- Office is currently a single SPA shell in `App.svelte` with internal page switching.
- Partner-related screens are factored into `PartnersView.svelte`.
- Project screens are factored into `ProjectsView.svelte`.
- Monitoring is factored into `MonitoringView.svelte`.
- The API surface is still a preview client in `office-preview-api.ts`.

### 3) Distribution - `apps/distribution`

Current role:
- Standalone royalties / distribution SPA.

Code locations:
- `apps/distribution/src/app/App.svelte`
- `apps/distribution/src/app/distribution-preview-api.ts`
- `apps/distribution/src/main.ts`

Built internal sections inside the Distribution SPA:
- `dashboard`
- `imports`
- `mapping`
- `catalog`
- `contracts`
- `allocations`
- `suspense`
- `statements`
- `payments`
- `revenue`

Implementation note:
- Distribution is also a single SPA shell in `App.svelte` with internal page switching.
- Its data access is still routed through the preview client in `distribution-preview-api.ts`.

### 4) Command Center - `apps/command-center`

Current role:
- Standalone admin / supervision SPA.

Code locations:
- `apps/command-center/src/app/App.svelte`
- `apps/command-center/src/app/DevSessionMenu.svelte`
- `apps/command-center/src/main.ts`

Built internal sections inside the Command Center SPA:
- `dashboard`
- `users`
- `integrations`
- `settings`

Implementation note:
- Command Center currently owns its own auth/session preview state in `App.svelte`.
- Session display controls are factored into `DevSessionMenu.svelte`.

## What this means for consolidation

- Nothing is split across separate repos.
- The split is currently **by workspace package and deployment target**.
- `app.eeee.mu` already contains the shared hub shell and route map.
- Office, Distribution, and Command Center each still exist as **their own app packages** with their own entrypoints and build outputs.
- The consolidation work is therefore a **re-hosting / routing consolidation**, not a rewrite of the pages themselves.

## Stop point

Phase 0 ends here. Do not move code yet.
