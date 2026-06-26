# Canonical Map - Phase 0.5

Read-only comparison of the HQ console implementation versus each standalone workspace app.

## Comparison rule

- **Canonical** means the implementation a user would experience as the real page: a bespoke Svelte view with the fuller UI and actions, not a generic data-driven shell.
- **HQ** here means the `app.eeee.mu` hub console route map plus `PlatformShell`.
- **Standalone** means the separate workspace app package under `apps/`.

## Data-layer summary

- **HQ console** uses the live typed API client (`@ehq/api-client`) plus Supabase SSR auth.
- **Office standalone** uses `office-preview-api.ts`.
- **Distribution standalone** uses `distribution-preview-api.ts`.
- **Command Center standalone** uses preview auth/session state and local data; it does not yet have the same live typed API layer as HQ.

## Office

| Page | Exists in HQ? | Exists in standalone? | HQ impl type | Standalone impl type | Canonical | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard (`of_dash` / `dashboard`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | HQ is the generic console dashboard; standalone is the richer finance cockpit. |
| P&L (`of_pnl` / `pnl`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone contains the dedicated P&L workspace UI. |
| Chart of accounts (`of_coa` / `coa`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone has the full tree/CRUD layout for the account hierarchy. |
| Transactions (`of_tx` / `transactions`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone has the detailed ledger actions and filters. |
| Imports (`of_imports` / `imports`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone is the import workbench; HQ is the simplified console projection. |
| Reconciliation (`of_recon` / `reconciliation`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone has the live match workflow. |
| Pending (`of_pending` / `pending`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone includes the draft queue and bulk validation flow. |
| Cash flow (`of_cash` / `cashflow`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone is the dedicated treasury view. |
| Clients (`clients`) | No | Yes | Missing | Bespoke Svelte view + preview API client | Standalone | Standalone-only page; lives in `PartnersView.svelte`. |
| Suppliers (`suppliers`) | No | Yes | Missing | Bespoke Svelte view + preview API client | Standalone | Standalone-only page; lives in `PartnersView.svelte`. |
| Projects (`projects`) | No | Yes | Missing | Bespoke Svelte view + preview API client | Standalone | Standalone-only page; lives in `ProjectsView.svelte`. |
| Monitoring (`monitoring`) | No | Yes | Missing | Bespoke Svelte view + preview API client | Standalone | Standalone-only page; lives in `MonitoringView.svelte`. |

### Office-only standalone pages

- `clients`
- `suppliers`
- `projects`
- `monitoring`

## Distribution

| Page | Exists in HQ? | Exists in standalone? | HQ impl type | Standalone impl type | Canonical | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard (`di_dash` / `dashboard`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | HQ is the generic console version; standalone is the full royalty cockpit. |
| Imports (`di_imports` / `imports`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone import page has the richer batch workbench. |
| Mapping (`di_mapping` / `mapping`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone has the row-level mapping actions. |
| Catalog (`di_catalog` / `catalog`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone has the catalog review UI. |
| Contracts (`di_contracts` / `contracts`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone contains the split / recoupment contract workspace. |
| Allocations (`di_alloc` / `allocations`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone includes preview/post/unpost and lock handling UI. |
| Suspense (`di_suspense` / `suspense`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone has the grouped blockers and exact fix paths. |
| Statements (`di_state` / `statements`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | Standalone is the full statement workflow and print-first view. |
| Payments (`di_pay` / `payments`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | HQ currently aliases this through the shared revenue route; standalone has the dedicated page. |
| Revenue (`di_rev` / `revenue`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview API client | Standalone | HQ currently aliases this through `/console/revenue`; standalone is the actual revenue lens. |

### Distribution-only standalone pages

- None

## Command Center

| Page | Exists in HQ? | Exists in standalone? | HQ impl type | Standalone impl type | Canonical | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard (`cc_dash` / `dashboard`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview auth/session and local data | Standalone | HQ is the generic console dashboard; standalone is the actual admin workspace. |
| Users & permissions (`cc_users` / `users`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview auth/session and local data | Standalone | HQ currently routes this through `/console/office-dashboard`; standalone is clearer and more complete. |
| Integrations (`cc_integ` / `integrations`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview auth/session and local data | Standalone | HQ uses a generic console page; standalone has the admin integration page. |
| Settings (`cc_settings` / `settings`) | Yes | Yes | Generic data-driven shell | Bespoke Svelte view + preview auth/session and local data | Standalone | HQ is generic; standalone is the active command-center settings page. |

### Command Center-only standalone pages

- None

## HQ route-map collisions

These are the current route collisions in `apps/hq/src/app/routes.ts`. They need distinct routes before everything can live cleanly under one app.

| Current route | Colliding page ids | Why it is a problem | Proposed distinct routes |
| --- | --- | --- | --- |
| `/console/dashboard` | `cc_dash`, `di_dash` | One route can only mean one page without workspace context tricks. | `/console/command-center/dashboard`, `/console/distribution/dashboard` |
| `/console/office-dashboard` | `cc_users`, `of_dash` | Command Center users and Office dashboard should not share a path. | `/console/command-center/users`, `/console/office/dashboard` |
| `/console/office-imports` | `of_imports`, `di_imports` | Office imports and Distribution imports are different workspaces. | `/console/office/imports`, `/console/distribution/imports` |
| `/console/revenue` | `di_pay`, `di_rev` | Payments and revenue are different pages and need separate URLs. | `/console/distribution/payments`, `/console/distribution/revenue` |

## Canonical decision summary

- **Office**: standalone app is canonical for every page, including the four pages not present in HQ (`clients`, `suppliers`, `projects`, `monitoring`).
- **Distribution**: standalone app is canonical for every page.
- **Command Center**: standalone app is canonical for every page.
- **HQ** remains the hub shell / landing / shared auth surface, but its workspace pages are the generic data-driven versions that should be re-hosted into the single app as canonical pages.

## Stop point

Phase 0.5 ends here. Do not move or delete anything yet.
