# Functional Coverage — Office + Distribution

This file is the product contract for the visible console surfaces.

Rule: if a page is visible in the left menu, it must have a real UI path, a real
API path, a domain/data owner, and a validation path. Pages without those pieces
must stay hidden until they are implemented.

## Runtime Surfaces

```mermaid
flowchart TD
  home["app.eeee.mu"] --> console["/console"]
  console --> office["/console/office"]
  console --> distribution["/console/distribution"]

  office --> eof["api.eeee.mu/eof/v1/*"]
  distribution --> erh["api.eeee.mu/erh/v1/*"]

  eof --> officeDomain["packages/domain-office"]
  eof --> financeDomain["packages/domain-finance"]
  erh --> distributionDomain["packages/domain-distribution"]
  distributionDomain --> financeDomain

  eof --> db["Supabase Postgres"]
  erh --> db
```

## Status Legend

- `OK`: visible page, API client method, API route, and domain/read path exist.
- `Partial`: visible page and API exist, but engine/persistence/UX is incomplete.
- `Hidden`: should not appear in the menu until implemented.
- `TODO`: code explicitly contains a placeholder or intentional missing engine.

## Office Coverage

| Menu page | UI owner | API surface | Domain/data owner | Status | Next work |
| --- | --- | --- | --- | --- | --- |
| Dashboard | `apps/hq/src/app/canonical/office/App.svelte` | `GET /eof/v1/dashboard`, `GET /eof/v1/screen/office` | `packages/domain-office/src/analytics.ts`, `pl.ts` | OK | Verify live data freshness page-by-page. |
| CEO view | `CeoView.svelte` | Dashboard/P&L aggregate calls through Office client | `domain-office` analytics/P&L | Partial | Confirm all KPI cards trace to API values, not UI recompute. |
| P&L | `App.svelte` | `GET /eof/v1/pl/global`, `/pl/department/:id`, `/pl/division` | `domain-office/src/pl.ts` | OK | Add explicit category endpoint or document category derivation. |
| Chart of accounts | `App.svelte` | `GET/POST/PATCH /eof/v1/plan-comptable` | Office categories/departments/divisions | OK | Confirm writes persist to Postgres and audit event. |
| Transactions / Ledger | `App.svelte` | `GET/POST/PATCH /eof/v1/transactions`, validate/cancel | Office transactions + `domain-finance/src/ledger.ts` | Partial | Route Office transaction summaries through the finance ledger primitive. |
| Imports | `App.svelte` | `POST /eof/v1/bank-import/preview`, `/confirm`, reverse/delete | Office bank import persistence | Partial | API only accepts structured rows; raw PDF parsing remains browser-side. Confirm production upload/parse flow. |
| Reconciliation | `App.svelte`, `BankView.svelte` | `GET/POST /eof/v1/reconciliations/*` | Office bank matching + `domain-finance/src/reconciliation.ts` | Partial | Make API matching use the finance reconciliation primitive atomically. |
| Pending | `App.svelte` | `GET /transactions?status=pending`, transaction update/validate | Office transactions | Partial | Add a dedicated pending endpoint or document this as filtered transactions. |
| Cashflow | `App.svelte` | `GET /eof/v1/cashflow`, preview/confirm | `domain-office/src/analytics.ts` | OK | Confirm imported CSV rows are audited and reversible. |
| Bank | `BankView.svelte` | `GET/POST/PATCH/DELETE /eof/v1/bank/accounts`, `GET /bank/raw` | Office bank accounts/raw lines | OK | Verify delete safety and dependency counts on production data. |
| Clients | `PartnersView.svelte` | `/eof/v1/partners`, `/pl/partner/:id`, partner payee link | Office partners + Distribution payee link | OK | Verify client facet filtering is semantically correct. |
| Suppliers | `PartnersView.svelte` | `/eof/v1/partners`, `/pl/partner/:id`, partner payee link | Office partners + Distribution payee link | OK | Verify supplier facet filtering is semantically correct. |
| Projects | `ProjectsView.svelte` | `/eof/v1/projects`, `/pl/project/:id`, coherence violations | Office projects/P&L | OK | Verify project P&L differs from legacy BUG-M1 intentionally. |
| Monitoring | `MonitoringView.svelte` | `/integrity/check-all`, `/analytics/bank-quality`, audit/dashboard | Office integrity analytics | OK | Add pass/fail severity mapping if missing in live UI. |
| Audit | `App.svelte` | `GET /eof/v1/audit-log` | Office audit events | OK | Verify every write path emits an audit event. |
| VAT | `VatView.svelte` | `GET /eof/v1/vat` | Office VAT report + `domain-finance/src/vat.ts` | Partial | Route VAT report through the finance VAT primitive. |
| Settings | `SettingsView.svelte` | Office status/config calls | API status/config | Partial | Confirm settings are not only read-only diagnostics. |
| Wave invoices | Removed from visible menu | none | none | Hidden | Add only when API, data model, and UI workflow exist. |

## Distribution Coverage

| Menu page | UI owner | API surface | Domain/data owner | Status | Next work |
| --- | --- | --- | --- | --- | --- |
| Dashboard | `apps/hq/src/app/canonical/distribution/App.svelte` | `GET /erh/v1/dashboard` | `domain-distribution` reads | OK | Verify live KPIs against statements/allocation data. |
| Imports | `App.svelte` | `/erh/v1/imports/batches`, preview/confirm/reverse | Distribution imports | OK | Confirm RouteNote/Kontor formats in live browser flow. |
| Mapping | `App.svelte` | `/erh/v1/mapping/rows`, `/mapping/apply-rules` | Distribution import mapping | OK | Verify reusable rules persist and audit. |
| Aliases | `App.svelte` | `GET /erh/v1/aliases` | Distribution aliases | Partial | Add create/update alias actions if aliases are meant to be managed here. |
| Duplicates | `App.svelte` | `GET /erh/v1/duplicates` | Distribution diagnostics | Partial | Merge/resolve is still a maintenance action, not product workflow. |
| Catalog | `App.svelte` | `/erh/v1/releases`, `/tracks`, create release/track | Distribution catalog | OK | Add edit/override workflow if source records are immutable. |
| Contracts | `App.svelte` | `/contracts`, expenses, rules | Distribution contracts + recoupments | OK | Verify rule totals and recoupable expense audit. |
| Financial reconciliation | `App.svelte` | `GET /erh/v1/financial-reconciliation` | Distribution reconciliation diagnostics | Partial | Guarded actions need concrete write handlers or explicit maintenance-only labels. |
| Allocations | `App.svelte` | `/allocations/runs`, preview/post/unpost | `domain-distribution/src/allocation.ts` + finance allocation | OK | Confirm workflow lock behavior in production. |
| Suspense | `App.svelte` | `/suspense`, resolve | Distribution suspense | OK | Confirm resolve writes target canonical catalog records. |
| Statements | `App.svelte` | `/statements`, generate/print/void | Distribution statements | OK | Verify A4 print route and balance ledger. |
| Payments | `App.svelte` | `/payments`, record/update/reconcile/void | Distribution payments | OK | Verify payment reconciliation touches Office bank/ledger where expected. |
| Revenue | `App.svelte` | `GET /erh/v1/revenue` | Distribution revenue reads | OK | Verify group-by totals match allocation/statement totals. |
| Audit log | `App.svelte` | `GET /erh/v1/audit-log` | Shared/distribution audit events | Partial | Code notes Distribution has no dedicated audit fixture; verify production source. |
| Settings | `App.svelte` | `GET /erh/v1/settings` | Distribution workspace config | OK | Confirm settings are sufficient for operations. |

## Engine Integration Debt

These files/functions still need integration or removal before claiming the
visible product is fully backed by the shared engine:

| File | Current issue | Product impact |
| --- | --- | --- |
| `packages/domain-finance/src/ledger.ts` | Implemented primitive, not yet used broadly by Office API | Ledger calculations can still be duplicated outside the kernel. |
| `packages/domain-finance/src/reconciliation.ts` | Implemented primitive, not yet used by Office API writes | Bank-to-ledger matching still needs API-level atomic integration. |
| `packages/domain-finance/src/vat.ts` | Implemented primitive, not yet used by VAT API report | VAT reports can still diverge from the shared kernel. |
| `packages/domain-finance/src/fx.ts` | Implemented primitive, not yet wired into all FX paths | FX conversion can still be duplicated outside the kernel. |
| `packages/domain-finance/src/schemas.ts` | Implemented schemas, adoption incomplete | API validation still needs to consume shared finance schemas. |
| `packages/domain-office/src/index.ts` | Stable snapshot primitive exists, broader API adoption incomplete | Office still needs a real workbench snapshot wired to live data. |
| `packages/domain-distribution/src/index.ts` | Stable statement draft primitive exists, broader API adoption incomplete | Distribution statement drafting should be wired into statement generation paths where useful. |

## Implementation Order

1. Hide or mark non-functional menu entries.
2. Make every visible Office page pass: UI loads, API route responds, write path
   persists, audit event exists, and live route is verified.
3. Make every visible Distribution page pass the same gate.
4. Replace finance TODOs with domain functions used by the API, starting with
   ledger, reconciliation, VAT, and FX.
5. Add tests at the domain layer first, then API tests, then browser smoke.
