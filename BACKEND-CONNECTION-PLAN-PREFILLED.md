# Backend Connection Plan (Pre-filled)

Last updated: 2026-07-12
Scope: Office + Distribution + Command Center + shell-level cross-app checks.

## Legend

- OK: page/actions are connected to API routes and usable.
- WIRED-PARTIAL: page is connected but has at least one important function still missing or intentionally blocked.
- UI-ONLY: action exists in UI but has no API wiring.
- MISSING: feature expected in scope but not implemented.

## Source files used for this pre-fill

- UI page maps and handlers:
  - apps/hq/src/app/canonical/office/App.svelte
  - apps/hq/src/app/canonical/distribution/App.svelte
  - apps/hq/src/app/canonical/command-center/App.svelte
  - apps/hq/src/app/canonical/office/*View.svelte
- API client contracts:
  - packages/api-client/src/office.ts
  - packages/api-client/src/distribution.ts
- API routes:
  - services/api/src/index.ts
- Existing route-action matrix:
  - PHASE1-ROUTE-ACTION-MATRIX.md

## Office (page by page)

| Page | Route | Status | Connected functions | Missing functions to develop | Priority |
|---|---|---|---|---|---|
| Dashboard | /console/office/dashboard | OK | getScreen, getDashboard, getDashboardAnalytics, listAuditLog | None identified | - |
| CEO view | /console/office/ceo | OK | getDashboard, getGlobalPnl, getDivisionPnl | Source-level KPI wiring tests added to lock API-sourced values | - |
| P&L | /console/office/pnl | OK | getGlobalPnl, getDepartmentPnl, getDivisionPnl, getCategoryPnl | None identified | - |
| Cashflow | /console/office/cashflow | OK | getCashflow, previewCashflowImport, confirmCashflowImport | None identified | - |
| VAT | /console/office/vat | OK | getVatReport | None identified | - |
| Chart of accounts | /console/office/coa | OK | getPlanComptable, listPlanComptableNodes, create/update/delete plan node | None identified | - |
| Imports | /console/office/imports | OK | parseBankImportPreview, previewBankImport, confirmBankImport, reverse/delete import batch | None identified | - |
| Wave invoices | /console/office/wave-invoices | OK | Dedicated lane with navigation to imports/reconciliation/pending | Product decision locked: lane/orchestration page only for this release | - |
| Reconciliation | /console/office/reconciliation | OK | listReconciliations, approve/suggested approve, match, create transaction from bank line, unmatch, reject | None identified | - |
| Pending | /console/office/pending | OK | filtered listTransactions + bulk classify + bulk validate | Optional: dedicated pending endpoint for performance/clarity | P2 |
| Transactions | /console/office/transactions | OK | list/create/update/cancel/validate transaction, ledger bulk preview/confirm | None identified | - |
| Bank | /console/office/bank | OK | list/create/update/delete account, list raw lines, ignore/reassign/approve/unmatch/reject | None identified | - |
| Clients | /console/office/clients | OK | list/get/create/update partners, get PnL, payee link/unlink | None identified | - |
| Suppliers | /console/office/suppliers | OK | same partner APIs with supplier facet | None identified | - |
| Projects | /console/office/projects | OK | list/create/update projects, project PnL, coherence violations | None identified | - |
| Monitoring | /console/office/monitoring | OK | integrity checks, bank quality, pending transactions, audit and dashboard reads | None identified | - |
| Audit | /console/office/audit | OK | listAuditLog | None identified | - |
| Settings | /console/office/settings | OK | read-only operational settings (bank account and currency summaries) | Product decision locked: keep read-only diagnostics in this release | - |

## Distribution (page by page)

| Page | Route | Status | Connected functions | Missing functions to develop | Priority |
|---|---|---|---|---|---|
| Dashboard | /console/distribution/dashboard | OK | getScreen, getDashboard | None identified | - |
| Imports | /console/distribution/imports | OK | list batches, preview/confirm/reverse import | None identified | - |
| Mapping | /console/distribution/mapping | OK | list mapping rows, apply mapping rules | None identified | - |
| Aliases | /console/distribution/aliases | OK | list/create/update aliases | None identified | - |
| Duplicates | /console/distribution/duplicates | OK | list duplicates, resolve duplicate | None identified | - |
| Catalog | /console/distribution/catalog | OK | list releases/tracks, create release/track | Optional edit flows if needed by product scope | P2 |
| Contracts | /console/distribution/contracts | OK | list contracts, create contract, update rules, list/create expenses, create payee | None identified | - |
| Allocations | /console/distribution/allocations | OK | list runs/allocations, preview run, start run, unpost run | None identified | - |
| Suspense | /console/distribution/suspense | OK | list suspense, resolve suspense | None identified | - |
| Statements | /console/distribution/statements | OK | list/generate/print/void statements | None identified | - |
| Payments | /console/distribution/payments | OK | list/record/update/reconcile/void payments | None identified | - |
| Revenue | /console/distribution/revenue | OK | getRevenue, CSV export | None identified | - |
| Financial reconciliation | /console/distribution/financial-reconciliation | OK | read reconciliation + maintenance action endpoint + quick action flows | Recompute payee balance now wired through maintenance endpoint with post-action reloads | - |
| Audit log | /console/distribution/audit-log | OK | listAuditLog | None identified | - |
| Settings | /console/distribution/settings | OK | getSettings, listFxRates, saveFxRates | None identified | - |

## Command Center (page by page)

| Page | Route | Status | Connected functions | Missing functions to develop | Priority |
|---|---|---|---|---|---|
| Dashboard | /console/command-center/dashboard | OK | getOverview, getStatus, getNotifications | None identified | - |
| Users | /console/command-center/users | OK | permission update endpoint wired | None identified | - |
| Integrations | /console/command-center/integrations | OK | integration toggle endpoint wired | None identified | - |
| Settings | /console/command-center/settings | WIRED-PARTIAL | workspace setting update wired | Theme and release-gate controls are intentionally view-only; keep as out-of-scope or implement with explicit policy approval | P2 |

## Shell and cross-app checks

| Area | Status | Connected functions | Missing functions to develop | Priority |
|---|---|---|---|---|
| Module rail navigation (Office/Distribution/Command Center) | OK | route switching in WorkspaceShell and each app page map | None identified | - |
| Critical smoke routes | OK | /, /console/office/bank, /console/distribution/settings, /console/command-center/settings, /console/office/vat, /console/distribution/payments, /console/command-center/dashboard | Extended with additional write-safe read routes | - |

## P0 execution backlog (done)

1. Distribution financial reconciliation quick action parity
- Result: done. Recompute-payee-balance now uses POST /erh/v1/financial-reconciliation/actions/:actionId through the maintenance action flow with post-action reload on payments/revenue/reconciliation/audit.

2. Endpoint capability reconciliation gate
- Result: done. Added scripts/check-ui-api-connections.mjs and package script check:connections to assert UI-referenced API-client methods exist.

## P1 execution backlog (current decisions)

1. Office settings scope decision
- Decision locked for this release: keep as read-only diagnostics page.
- Next release option: if editable settings are required, introduce schema + endpoints + audited write handlers.

2. Wave invoices product decision
- Decision locked for this release: keep lane/orchestration behavior.
- Next release option: dedicated API-backed wave actions can be added behind explicit scope approval.

3. CEO KPI proof tests
- Result: done. Added source-level test assertions to keep KPI derivation tied to dashboard/global P&L API payloads.

## Verification checklist per page

- Read path returns live data for current workspace and period.
- Every visible write button triggers a real API call.
- Mutation path has idempotency key.
- Mutation response includes audit receipt where expected.
- Post-mutation reload covers dependent tables/cards.
- Error path preserves list state and surfaces actionable message.
- Page included in smoke or in deterministic integration tests.

## Recommended execution order

1. Complete all P0 items.
2. Re-run canonical gate: ./deploy-build.sh
3. Run smoke: corepack pnpm smoke:critical
4. Deploy and run post-deploy smoke twice (startup warm-up tolerance).
5. Close P1 policy decisions and either implement or lock as out-of-scope.
