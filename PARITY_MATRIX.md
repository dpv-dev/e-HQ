# Parity Matrix

Source capture:
- Live crawl artifacts: `/Users/poups/Documents/Codex/Projects/ehq-platform/reference/e-hq/*`
- Route scan context from previous live scan in `/private/tmp/ehq-live-audit-20260625-170018`

Runtime rule:
- `e-hq.eeee.mu/office` and `e-hq.eeee.mu/distribution` define the product
  reference: pages, options, actions, templates, and expected UX.
- `app.eeee.mu` implements the same product with the new stack:
  Supabase Auth → Hono API → Supabase Postgres.
- e-hq is not an app backend for the new console.

Definition:
- **present** = equivalent screen exists and covers the function.
- **partial** = route exists but with reduced/shifted feature scope.
- **missing** = no equivalent app route implemented yet (to-create required).

| Live product route | Purpose (from rendered H1/title) | Interactive actions observed | Target route in app.eeee.mu | Status |
| --- | --- | --- | --- | --- |
| `wp-admin/index.php` | Dashboard | Toggle/collapse admin panels, screen options checkboxes, quick draft post fields/actions, widget links | N/A | missing |
| `wp-admin/edit.php` | Posts | Screen options form, search/filter, list row actions, bulk actions scaffold, pagination controls | N/A | missing |
| `wp-admin/edit.php?post_type=page` | Pages | Screen options form, page filtering/search, row actions, pagination | N/A | missing |
| `admin.php?page=erh-dashboard` | Distribution dashboard | Top Artists/Tracks/Stores selectors, prev/next paging, edit actions, money summary tables | `/console/dashboard` | present |
| `admin.php?page=erh-mapping` | Mapping | Mapping toolbar (load/reset/delete selection), batch actions, auto contributor tools, contributors rules | `/console/mapping` (to-create) | missing |
| `admin.php?page=erh-catalog` | Catalog | Massive filter toolbar (artist/source/status/date/search), catalog CRUD, contributor/fix actions, row exports | `/console/catalog` (to-create) | missing |
| `admin.php?page=erh-aliases` | Aliases | Alias add/filter/open and quick list actions | `/console/aliases` (to-create) | missing |
| `admin.php?page=erh-duplicates` | Duplicates | Merge action and row/table selection actions for duplicates | `/console/contracts/duplicates` (to-create) | missing |
| `admin.php?page=erh-contracts` | Contracts | New contract, split filters, apply splits on selected, split status tabs, edit interactions | `/console/contracts` | present |
| `admin.php?page=erh-allocations` | Allocations | Preview, post batch, run-safe wave actions, unpost, prepare operations, allocation lists/tables | `/console/allocations` | present |
| `admin.php?page=erh-suspense` | Suspense | Filter, run safe pending wave, export current CSV, resolve actions by row/reason | `/console/action-needed` | present |
| `admin.php?page=erh-statements` | Statements | Period/list actions, Generate statement action, statement table row actions/modals | `/console/statements` | present |
| `admin.php?page=erh-revenue` | Revenue | Date/payee filters, export current filter, revenue tables | `/console/revenue` | present |
| `admin.php?page=erh-audit` | Audit Log | Filter form and table navigation/paging, event listing | `/console/audit-log` | present |
| `admin.php?page=erh-settings` | Settings | Configure modules (general/imports/notifications), delete actions, rows/tables of settings, rate delete/add forms | `/console/command-center/settings` (distribution settings partial) | partial |
| `admin.php?page=erh-financial-reconciliation` | Financial Reconciliation | Batch action forms with confirmation, maintenance action run buttons, reconciliation result tables | `/console/financial-reconciliation` (to-create) | missing |
| `admin.php?page=eof-dashboard#/dashboard` | Office dashboard | Date-range filters, metrics cards/summary tables, close-dialog actions | `/console/office-dashboard` | present |
| `admin.php?page=eof-dashboard#/ceo` | CEO view | Period filters + close-modal action, report cards/list sections | `/console/office-dashboard` (mode equivalent) | partial |
| `admin.php?page=eof-dashboard#/transactions` | Transactions | New transaction, reset, column chooser, export CSV, row-level actions | `/console/transactions` | present |
| `admin.php?page=eof-dashboard#/pending` | Pending/drafts | View/Open/Acknowledge row actions, table filters, multi-table lists | `/console/pending` | present |
| `admin.php?page=eof-dashboard#/pl` | P&L | Period filters, export CSV/PDF, division P&L table pages | `/console/pl` | present |
| `admin.php?page=eof-dashboard#/clients` | Clients | Add new, edit/delete row actions, list+filter table | `/console/clients` | present |
| `admin.php?page=eof-dashboard#/suppliers` | Suppliers | Add new, edit/delete row actions, list+filter table | `/console/suppliers` | present |
| `admin.php?page=eof-dashboard#/projects` | Projects | Period filters, add new, edit row actions, project list table | `/console/projects` | present |
| `admin.php?page=eof-dashboard#/vat` | VAT reports | Period filters, export CSV, VAT report tables | `/console/vat` (to-create) | missing |
| `admin.php?page=eof-dashboard#/wave-invoices` | Wave invoices | Sync from Wave, expandable row actions, invoice view actions, tables | `/console/office-imports` (or `/console/office-imports#wave`) | partial |
| `admin.php?page=eof-dashboard#/bank` | Bank | Add/delete accounts, preview/account actions, raw/export flows, reconciliation tables | `/console/bank` | present |
| `admin.php?page=eof-dashboard#/pdf-import` | PDF import | Scan PDF action, modal close, import state panel/table | `/console/office-imports` | partial |
| `admin.php?page=eof-dashboard#/cashflow` | Cash flow | Preview action, dialog flow, summary output | `/console/cashflow` | present |
| `admin.php?page=eof-dashboard#/reconciliation` | Reconciliation | Link actions by row, list tables, multiple status/action buttons | `/console/reconciliations` | present |
| `admin.php?page=eof-dashboard#/monitoring` | Monitoring | Scan now, acknowledge/dismiss, view detail rows | `/console/integrity` | partial |
| `admin.php?page=eof-dashboard#/audit` | Office audit log | Reset/paging and close actions, office audit table | `/console/office-audit` | present |
| `admin.php?page=eof-dashboard#/settings` | Office settings | Exchange/Reference/Wave/Maintenance/API config switches, add-rate flow | `/console/office/settings` (to-create) | missing |

## Matrix status counts

- Present: 18
- Partial: 5
- Missing: 10
