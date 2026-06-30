# Live App Action / Backend Gap Scan

Date: 2026-06-30T15:50:37.756Z
Target: https://app.eeee.mu
Evidence: screenshots + interactives captured in `output/live-app-scan/`.
Scope: Home, Login, Command Center, Office, Distribution. Scanned as administrator.

## Legend

- Connected: visible action calls a real API endpoint or local navigation and is usable.
- Partial: visible action is wired, but the workflow is not complete enough for normal business use.
- Missing UI: backend/API exists, but the page does not expose the expected workflow.
- Missing backend: visible/expected workflow needs new API + persistence/domain behavior.

## Executive Summary

The app is not “zero connected”. Core read paths are live, writes are enabled, and many mutation endpoints exist. The main gap is workflow completeness: several buttons call demo/default payloads, review/status persistence, or first-row shortcuts instead of asking the user what to do. Office is much closer to usable than Distribution. Command Center persists reviews/statuses but does not yet administer real Supabase users. Distribution has many write endpoints live, but several pages still need forms, row-level actions, and real import file parsing.

Top gaps to implement first:

1. Office Imports: make monthly statement import idiot-proof: file -> preview rows -> confirm selected rows -> pending classification -> reconciliation. Add CSV/PDF row table, validation errors, duplicate handling, and clear account detection.
2. Office Pending/Reconciliation: add selection, row-level classification/matching, batch validate/match only selected items.
3. Command Center Users: turn “Prepare review” into real user invite/role management through Supabase Admin or a role table + token hook.
4. Distribution Imports/Mapping: replace sample rows with real file upload/parser, preview table, confirm selected rows, mapping assignment UI.
5. Distribution Payments/Statements: add forms and row actions; current buttons use first record/default references.
6. Catalog/Contracts: add create/edit release, track, payee, contract, royalty rules, contributor splits, aliases/duplicates merge flows.

## Page-by-page Matrix

### Home / workspace picker

Visible actions: profile menu, notification badge, Enter HQ, Enter Office, Enter Distribution.
Connected: workspace navigation works; profile menu/sign-out is present.
Missing / should implement: notification badge should open the real Command Center notifications panel everywhere, not just be a count. Add read/unread state and action links via `GET /cc/v1/notifications` plus `PATCH /cc/v1/notifications/:id/read`.

### Login

Visible actions: email/password sign in, remember checkbox, forgot password, continue with e SSO.
Connected: email/password sign-in works.
Partial/missing: remember checkbox appears local only; forgot password and SSO need real Supabase reset/OAuth flows or should be hidden until ready.
Backend needed: password reset request/confirm pages; optional SSO provider configuration; audit auth events.

## Command Center

### Dashboard

Visible actions: Scope, Mode, Period chips.
Connected: Mode refreshes write gate/readiness locally.
Partial/missing: Scope and Period are more explanatory than operational; no drilldown on action list.
Backend needed: read aggregated readiness from live checks, not static/local arrays; add action-list endpoints with status, owner, due date, and deep links.

### Users & permissions

Visible actions: Source / Denied cards / Hidden apps chips, email + role, Prepare review.
Connected: Prepare review writes to `POST /cc/v1/users/:userId/permissions` with idempotency/audit.
Partial/missing: it does not actually invite a user, update Supabase `auth.users`, or force new JWT claims. It stores a review record.
Backend needed: Supabase Admin invite/create user, role assignment source of truth, token hook or role table, revoke/disable user, resend invite, reset password, audit trail, list real users.

### Integrations

Visible actions: Scope/Writes/Network chips, Inspect, View scope, Open status.
Connected: panel actions call `POST /cc/v1/integrations/:id/toggle` and persist review/status.
Partial/missing: actions do not open connector details, run health tests, configure credentials, or show logs.
Backend needed: `GET /cc/v1/integrations`, connector detail/health check, credential status (no secrets returned), bank connector test, Supabase/API health details, retry logs.

### Settings

Visible actions: Workspace/Theme/Release gate chips, workspace name input, Save review, Verified.
Connected: Save review writes `POST /cc/v1/settings`.
Partial/missing: page loads mostly static settings; no `GET /cc/v1/settings`, no real editable config set.
Backend needed: settings read endpoint, typed setting registry, update validation, release gate mode, theme/user preference persistence.

## Office

### Dashboard

Visible actions: period selector.
Connected: live dashboard, bank quality, cashflow, projects, reconciliation reads.
Missing: dashboard cards/table rows should deep-link into Reconciliation, Cash-flow, Monitoring, Imports.
Backend needed: no major backend missing; add UI navigation actions and maybe dashboard alert acknowledgements.

### CEO view

Visible actions: period selector.
Connected: reads validated dashboard/P&L data.
Missing: export/share report, drill into department/category/division, choose board period pack.
Backend needed: PDF/CSV executive report endpoint or frontend export; saved report snapshots if needed.

### P&L

Visible actions: period selector, department selector, Apply.
Connected: filters call live P&L APIs.
Missing: export CSV/PDF, drilldown row -> transactions, compare period, budget/forecast overlay.
Backend needed: transaction drill endpoint already mostly available via `/transactions`; add export/report endpoint if server-side export wanted.

### Chart of accounts

Visible actions: create node, deactivate category, row activate/deactivate.
Connected: `POST/PATCH /eof/v1/plan-comptable` works with idempotency/audit.
Partial/missing: no inline edit form per row, no search, no safe “move category” flow, no archive reason.
Backend needed: existing PATCH covers active/edit; add move/re-parent audit rules if re-parenting must be controlled.

### Transactions

Visible actions: filters, New entry, Export CSV, edit/save/validate/cancel row actions when rows exist.
Connected: create/update/validate/cancel endpoints exist.
Partial/missing: Export CSV is disabled when no rows; when rows exist it is frontend-only. New entry creates a draft with default values, not a guided entry form. No attachment/invoice link.
Backend needed: optional server-side export; transaction attachments; proper create transaction drawer with validation and account/category/project pickers.

### Imports

Visible actions: account select, file upload, Analyse, Importer en base, Correction source, Annuler l'import rows.
Connected: bank account list, preview, confirm, reverse batch endpoints exist. PDF parsing runs client-side then API preview/confirm.
Partial/missing: no preview table of detected rows/ rejected rows; confirm is all-or-nothing accepted IDs; no manual correction per rejected row; account detection is still confusing; CSV flow is not visibly first-class.
Backend needed: accepted/rejected row detail persistence, duplicate review endpoint, per-row accept/reject/correct, import batch detail endpoint, account auto-detection/hash management.

### Reconciliation

Visible actions: filters, Approve batch, row accept when rows exist.
Connected: list and approve reconciliation endpoints exist.
Partial/missing: Approve batch uses all suggested rows, not a user-selected set; no manual match/reject/split/create ledger transaction from bank line.
Backend needed: manual match endpoint, reject/ignore candidate, split bank line, create ledger transaction from bank line, undo reconciliation.

### Pending

Visible actions: period selector, Validate selection, selectable pending cards when rows exist.
Connected: bulk validate calls transaction validate endpoint.
Partial/missing: no classification UI on this page; pending rows must be edited elsewhere or rely on pre-existing category. Validate selection can be meaningless on empty/no category rows.
Backend needed: batch classify endpoint, suggestions endpoint is partner-scoped only; add pending queue endpoint with suggested category/project and batch update/validate transaction.

### Cash-flow

Visible actions: account filter, Refresh, file upload, Importer en base.
Connected: cashflow reads; cashflow preview/confirm endpoints exist.
Partial/missing: upload parsing/preview is minimal; no preview table, no duplicate/reverse batch, no source templates.
Backend needed: cashflow import batch model (or reuse import_batches with source), preview detail, confirm selected rows, reverse cashflow import.

### Bank

Visible actions: account create/edit form, raw bank lines, reconciliation candidates.
Connected: `GET/POST/PATCH /eof/v1/bank/accounts`, raw lines, quality, reconciliation reads.
Partial/missing: no deactivate/archive reason, no opening balance adjustment audit, no account reference/hash editor, no row actions on raw bank lines.
Backend needed: bank account balance adjustment endpoint, account reference management, raw line duplicate mark/ignore, line-to-transaction action.

### Clients

Visible actions: Create partner, Refresh, partner rows open drawer.
Connected: list/create/update partner, detail, suggestions, payee link/unlink endpoints exist.
Partial/missing: drawer actions require knowing raw payee id; no search/select payee picker; no partner merge/archive flow.
Backend needed: payee search endpoint or reuse Distribution payees with a UI picker; partner merge/archive; partner transaction history endpoint.

### Suppliers

Same as Clients, expense-side lens.
Extra missing: supplier onboarding details such as bank/payment terms/tax docs are not modeled.
Backend needed: partner payment details/tax profile if this app is meant to run supplier ops.

### Projects

Visible actions: Refresh, create project, select project, edit project.
Connected: `GET/POST/PATCH /eof/v1/projects`, project P&L, coherence violations.
Partial/missing: project create has only name/status; description field exists in request but not visible in live form; no budget lines/members/departments UI despite DB tables.
Backend needed: project budget line endpoints, project members/departments endpoints, project archive/complete audit action, project transaction assignment flow.

### Monitoring

Visible actions: period selector, Refresh.
Connected: integrity, bank quality, pending, imports, audit reads.
Missing: no action buttons for failed checks; no “open exact fix path” links.
Backend needed: operational check registry with fixPath/deepLink, acknowledge/snooze check, rerun integrity check.

### Audit log

Visible actions: none beyond profile.
Connected: `GET /eof/v1/audit-log`.
Missing: filters by actor/action/entity/date; export.
Backend needed: query params supported partly by list endpoint may need frontend controls; export endpoint optional.

### VAT

Visible actions: period selector.
Connected: `GET /eof/v1/vat`.
Missing: VAT return workflow, CSV/PDF export, mark filed/paid, adjustments.
Backend needed: VAT filing entity/table, adjustment records, export/report endpoint.

### Settings

Visible actions: none beyond profile.
Connected: read-only values from existing config/data.
Missing: editable reference currency, maintenance mode, period close/open, import settings.
Backend needed: Office settings table + typed GET/PATCH, period close locks, FX policy settings.

### Wave invoices

Visible actions: none.
Status: explicitly coming soon.
Backend needed: Wave OAuth/connector, invoice sync, invoice-to-transaction matching, webhook/import jobs.

## Distribution

### Dashboard

Visible actions: period selector.
Connected: live dashboard reads.
Missing: action-list rows should navigate to mapping/statements/payments and run exact workflow.
Backend needed: no major missing for read; add dashboard action deep links/acknowledgements.

### Allocations

Visible actions: Preview locked run, Post cadence wave, Request unpost run.
Connected: `POST /allocations/runs/preview`, `POST /allocations/runs`, `POST /allocations/runs/:id/unpost` exist.
Partial/missing: buttons use current period/default lock/run, not a wizard with selected earnings/batch/cadence/reason. No allocation detail drilldown.
Backend needed: allocation run detail is present; add filtered earnings preview endpoint if operator must select scope before run.

### Suspense

Visible actions: status filter, Resolve first exact path.
Connected: `GET /suspense`, `POST /suspense/:id/resolve`.
Partial/missing: only resolves first item with hardcoded target `track_alma`; no row-level resolution form.
Backend needed: target search endpoints for release/track/payee/contract; row-level resolve with exact payload; bulk resolve.

### Statements

Visible actions: Generate statements run.
Connected: list/generate/void statement APIs exist; print endpoint exists.
Partial/missing: no payee selection, no period preview, no print/download button exposed in table, no row void action visible.
Backend needed: statement preview endpoint before generate; PDF download integration from existing print route.

### Payments

Visible actions: filter, Record payment, Edit reference, Reconcile payment, Void payment.
Connected: payment record/update/reconcile endpoints exist.
Partial/missing: actions use first statement/payment and default references; no payment form, bank transaction selector, or row-level actions. “Void payment” is implemented as update amount 0, not a proper void endpoint.
Backend needed: payment void endpoint with audit/reversal semantics; bank transaction picker/search; payment form validation.

### Revenue

Visible actions: group selector, Refresh.
Connected: `GET /erh/v1/revenue`.
Missing: export, drilldown by payee/track/store/currency, compare periods.
Backend needed: revenue detail endpoint or query extension; export endpoint optional.

### Imports

Visible actions: source/file/status chips, source select, file name text, Preview export, Validate import, filter.
Connected: preview/confirm/import batches endpoints exist.
Partial/missing: page uses sample rows/file name, not real file upload; Validate import only enables after preview and confirms fixed row IDs. No uploaded file parser.
Backend needed: real upload/parse for Kontor/RouteNote XLSX/CSV, preview row detail, selected row confirm, reverse batch UI/API already exists but not exposed.

### Mapping

Visible actions: status filter, Apply reusable rules.
Connected: list mapping rows, apply mapping rules endpoint exists.
Partial/missing: no manual mapping editor, no alias creation from row, no rule builder; applies all visible rows.
Backend needed: create/update mapping rule, manual map row to release/track/payee, alias upsert, batch apply selected rows.

### Aliases

Visible actions: none.
Connected: read aliases endpoint.
Missing: create/edit/delete alias, attach alias from mapping row.
Backend needed: alias CRUD with idempotency/audit; conflict detection.

### Duplicates

Visible actions: none.
Connected: read duplicates endpoint.
Missing: merge/ignore/mark-not-duplicate workflow.
Backend needed: duplicate resolution endpoints, merge plan preview, audited merge/ignore records.

### Catalog

Visible actions: Fix contributor mapping.
Connected: reads releases/tracks/payees; button is local/no clear backend mutation.
Missing: create/edit release, track, contributor split, ISRC/UPC management, row-level fix contributor.
Backend needed: release CRUD, track CRUD, contributor/split CRUD with 10,000bp invariant, contributor mapping endpoint, catalog import/link endpoints.

### Contracts

Visible actions: Record recoupable expense.
Connected: record contract expense endpoint exists.
Partial/missing: records first contract/default expense only; no contract create/edit UI, payee selector, royalty rule editor, expense edit/status actions.
Backend needed: contract CRUD exists partly in API but client/UI lacks createContract/updateContract methods; expose them. Add royalty-rule editor UI over existing endpoint, expense edit/waive/recoup status UI.

### Financial reconciliation

Visible actions: Run guarded action x5, Maintenance only x2.
Connected: some actions call existing payment/expense/allocation/statement APIs.
Partial/missing: labels are generic; payloads choose first available records/default refs; maintenance actions disabled; no row-specific context.
Backend needed: dedicated reconciliation action endpoints or typed action dispatcher with preview + confirm, plus row-level action buttons carrying exact entity IDs.

### Audit log

Visible actions: none.
Connected: `GET /erh/v1/audit-log`.
Missing: filters/export/entity drilldown.
Backend needed: query controls + export optional.

### Settings

Visible actions: none.
Connected: `GET /erh/v1/settings`.
Missing: editable workspace settings, FX policy, statement/payment settings, import mappings.
Backend needed: Distribution settings PATCH endpoint, typed settings table, audit.

## Implementation Order Proposal

### P0: Make Office monthly bank import actually usable

- Office Imports: preview table, rejected-row table, account detection explanation, manual row correction, confirm selected rows, import batch detail, reverse flow confirmation.
- Office Pending: category/project assignment controls, batch classify + validate selected rows.
- Office Reconciliation: manual match/reject/create-ledger-from-bank-line and undo match.

### P1: Turn Command Center into real admin

- Real users list from Supabase/auth-role source.
- Invite/create/disable users, assign roles, force refresh claims through token hook/role table.
- Integration detail pages with health checks and config status.
- GET/PATCH settings for Command Center.

### P1: Distribution import-to-statement workflow

- Real Kontor/RouteNote upload parser.
- Mapping editor/rule builder/alias creation.
- Allocation run wizard with selected period/batch/payees.
- Statement preview -> generate -> print/download -> void.

### P2: Payments and contracts

- Payment form, bank transaction selector, proper void endpoint.
- Contract create/edit, royalty rules editor, expenses edit/waive/recoup actions.
- Catalog release/track/contributor split editor.

### P3: Reporting/settings polish

- P&L/VAT/revenue/audit exports.
- Settings pages writable with typed schemas.
- Monitoring fix-path links and acknowledgements.

## Evidence Files

- Screenshots: `output/live-app-scan/*.png`
- First pass DOM: `output/live-app-scan/scan-results.json`
- Stable controls pass: `output/live-app-scan/stable-interactives.json`
