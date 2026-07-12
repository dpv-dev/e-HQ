# Full App Execution Tracker (Office, Distribution, Command Center)

Last updated: 2026-07-12
Branch: theme/distribution-command
Main baseline: 146e25b
Current head: 2ba08a6

## Current Snapshot
- Repo health: canonical gate green on HEAD (API tests 98/98, HQ check/build, regression, SQL guard).
- Frontend quality trend: shared request-state/request-status helpers are now centralized and tested.
- Deployment baseline: production API + frontend confirmed on commit b1200b9 in this session.
- Parser ownership: Office imports now use backend parse-preview path only; frontend statement parser fallback has been removed from production flow.
- Financial correctness hardening: deployed commit pair `4d5697d` + `2d264ce` to lock EUR reconciliation currency normalization and debit/credit-only direction ingestion.
- Latest rollout: commit set `4515b53` + `afe14c2` deployed on 2026-07-12 with post-warmup smoke PASS.
- Follow-up production hotfixes deployed on 2026-07-12: `5cc869c` (allow Cache-Control in CORS preflight headers) and `30cceb1` (allow Pragma in CORS preflight headers).

## Workspace Scope Hardening - 2026-07-12

### Scope
- Remove cross-workspace leakage from Office read paths while preserving compatibility query aliasing.

### Changes
- Commit `152eb4f`: Office read routes now build a workspace-scoped dataset before domain reads.
- Added helper in `services/api/src/index.ts`: `officeDatasetForWorkspace(...)`.
- Applied scoped dataset reads to:
	- dashboard and analytics
	- global/department/division/category P&L
	- transactions, cashflow, projects, partners
	- integrity and bank-quality analytics
- Added API regression test in `services/api/test/api.test.ts` proving:
	- `workspaceId=eeee-mu` reads only canonical rows
	- `workspaceId=office` alias resolves to canonical rows
	- `workspaceId=workspace_1` remains isolated legacy scope

### Validation and rollout
- Canonical gate `./deploy-build.sh` passed (API tests `99/99`, HQ check/build, regression, SQL guard).
- Artifacts uploaded and deployed to Hostinger API/frontend targets.
- API restart executed via `tmp/restart.txt`.
- Post-deploy verification:
	- warm-up `503 {"status":"starting"}` observed immediately after restart
	- direct health recovered to `200`
	- `corepack pnpm smoke:critical` final run PASS across all critical routes
- Connected visual verification on `https://app.eeee.mu/console/office/pnl` succeeded (page renders and loads scoped P&L surfaces).

## Scoped Reads Regression Hardening - 2026-07-12

### Scope
- Follow-up patch to prevent regressions on Office reference routes after workspace scoping changes.

### Changes
- Commit `2ba08a6`: keep Office reference entities visible in scoped reads while preserving transaction-bound financial scoping.
- `officeDatasetForWorkspace(...)` now keeps:
	- `projects`
	- `projectBudgetLines`
	- `partners`
	as reference sets (current schema has no workspace_id on these rows), while still scoping:
	- transactions
	- allocations
	- bank accounts/imports/lines/reconciliation matches
	- cashflow projections
- Added regression test coverage:
	- `/eof/v1/projects?workspaceId=eeee-mu` still returns reference projects with zeroed scoped totals
	- `/eof/v1/partners/:partnerId?workspaceId=eeee-mu` remains available

### Validation and rollout
- Focused API regression run: pass.
- Canonical gate `./deploy-build.sh`: pass (API `100/100`, HQ check/build, regression, SQL guard).
- Deployment to Hostinger completed (API + frontend artifacts) with restart via `tmp/restart.txt`.
- Post-deploy checks:
	- `https://api.eeee.mu/healthz` -> 200
	- `corepack pnpm smoke:critical` -> PASS
	- Office route auth guards return expected `401` unauth (no startup `503` on API sanity checks).

## Program Phases

### Phase 1 - Product Completion Baseline
Status: complete
Owner: engineering
Goal: one truth board for what is done vs not done for each app route/action.

Deliverables:
- Route-by-route action matrix for Office, Distribution, Command Center.
- Must-have vs later scope lock for release target.
- Risk log with explicit blockers and decisions.

Done:
- Initial tracker created (this file).
- Initial prioritized execution backlog created in PHASE1-2-EXECUTION-BACKLOG.md.
- Route/action truth matrix created in PHASE1-ROUTE-ACTION-MATRIX.md.
- Must-have vs later scope lock created in RELEASE-SCOPE-LOCK.md.
- Route/action matrix expanded to full visible action coverage with handler/API references.
- Explicit out-of-scope rows added for intentionally locked/disabled controls.

Exit criteria:
- Every visible user action has one of: implemented, intentionally hidden, or explicitly out-of-scope.
- No ambiguous "maybe done" items remain.

### Phase 2 - Backend Truth and Functional Completeness
Status: complete
Owner: engineering
Goal: every business action is backend-truth, auditable, and reloaded from API state.

Deliverables:
- Command Center data truth upgrade (no static operational data arrays).
- End-to-end action verification matrix and smoke checks by app.
- Removal of stale/stub action paths.

Done:
- Added backend endpoint GET cc/v1/overview for readiness/integrations/settings aggregate.
- Added typed client contract and method in packages/api-client/src/command-center.ts.
- Command Center app now loads readiness/integrations/settings from backend overview payload.
- Command Center app now consumes cc/v1/notifications and surfaces unread alert count in dashboard KPIs.
- Added focused UI regression tests for high-risk post-mutation refresh plans (Office, Distribution, Command Center).

Exit criteria:
- No fake success states.
- No static operational metrics where real API state exists.
- All critical writes covered by idempotency and audit receipts.

### Phase 3 - Parser Ownership Migration
Status: complete
Owner: engineering
Goal: parsing authority moves to API; frontend parser becomes fallback then removable.

Deliverables:
- Parser migration architecture in PARSER-MIGRATION-DESIGN.md.
- API contracts for parse preview and normalized row output.
- Rollout and rollback plan with parity fixtures.

Done:
- Added API route POST eof/v1/bank-import/parse-preview with Office permission enforcement.
- Added backend parser module services/api/src/office-bank-parser.ts (CSV + extracted statement text to normalized rows).
- Added typed client contract/method (BankImportParsePreviewRequest/Response).
- Added HQ hidden switch VITE_OFFICE_BACKEND_PARSER for dual path (backend parse when enabled, frontend parser fallback when disabled).
- Added API regression test for parse-preview permissions and CSV parsing; canonical gate green.
- Added Stage C parity harness test file services/api/test/office-bank-parser-parity.test.ts that compares backend vs frontend normalized outputs for CSV, MCB text, and SBI text samples (green).
- Added Stage C fixture corpus at services/api/test/fixtures/parser-parity/cases.json and machine-readable parity report generation script services/api/scripts/parser-parity-report.mjs -> services/api/output/parser-parity-report.json.
- Expanded Stage C corpus with additional production-like rows (SBI COMM/KONTOR/EFT/CASH patterns, MCB reference-coded statement lines, and signed/quoted CSV variants); parity report now validates 10 fixture cases.
- Completed Stage D default flip in HQ: Office import defaulted to backend parser path.
- Completed Stage E cleanup in HQ Office import flow: removed runtime frontend parser fallback and env gate; statement upload now always goes through API parse-preview.

Exit criteria:
- Production parsing path uses backend parser endpoints.
- Frontend parser path disabled or removed from production flow.

### Phase 4 - Office Completion
Status: complete
Goal: complete all critical accounting workflows with stable UX states and API truth.

Done:
- Residual mutation consistency pass extended to low-frequency handlers (import confirm, reconcile-create, pending classify/validate) so dashboard analytics and reconciliation operations stay in sync after writes.
- Mutation reload audit finalized with no remaining Office critical-path stale-state gaps (see PHASE4-MUTATION-RELOAD-AUDIT.md).

### Phase 5 - Distribution Completion
Status: complete
Goal: complete import-to-payment lifecycle with auditable, non-stub actions.

Done:
- Residual mutation consistency pass extended to low-frequency handlers (import reverse/confirm, mapping apply, allocation run start, payment actions) with suspense/revenue/reconciliation/audit refreshes.
- Maintenance-only reconciliation actions remain explicitly labeled and disabled in UI; active business actions remain operational and API-backed.

### Phase 6 - Command Center Completion
Status: complete
Goal: real operational control tower fed by live API state.

Done:
- Removed remaining hardcoded integration/settings KPI literals on Command Center pages; KPI cards now derive from `cc/v1/overview` integration/setting rows in `apps/hq/src/app/canonical/command-center/App.svelte`.
- Added focused regression coverage in `apps/hq/src/app/canonical/command-center/kpi-derivation.test.ts` to prevent reintroduction of static KPI values for integrations/settings.

### Phase 7 - E2E Quality Gate
Status: complete
Goal: full green gate + smoke evidence across all three apps.

Done:
- Added executable smoke script scripts/smoke-critical-routes.mjs.
- Added root command smoke:critical and validated it against live routes.
- Embedded smoke gate usage in deploy runbooks DEPLOY.md and DEPLOYMENT.md (pre/post deploy checks).

### Phase 8 - Final Deploy and Stabilization
Status: complete
Goal: production rollout with verification and short stabilization window.

Done:
- Added ordered Phase 8 execution checklist in PHASE4-8-IMPLEMENTATION.md.
- Production rollout executed (API + frontend artifacts uploaded and unpacked, API restart triggered).
- Post-deploy smoke checks passed after startup warm-up (healthz and critical app routes).
- Deployment evidence logged in DEPLOY-LOG-2026-07-11.md.
- Fresh completion cycle executed on current branch head: ordered checks (`api-client`/`api`/`hq` check + smoke + canonical `./deploy-build.sh`) all green, artifacts redeployed, health warmed from 503 `starting` to 200, post-deploy smoke PASS, and targeted protected status routes returned expected 401 unauthenticated.

### Post-Plan Financial Correctness Hardening (2026-07-11)
Status: complete
Goal: eliminate false figures in Office bank import/reconciliation by enforcing explicit direction truth and consistent FX currency semantics.

Done:
- Commit `4d5697d`: reconciliation create-transaction now persists normalized currency (`MUR`) whenever the bank line already carries converted `amount_mur_minor`.
- Commit `2d264ce`: bank import parsing now accepts direction only from explicit debit/credit columns (no signed/generic amount fallback, no default direction fallback).
- Added API regressions for missing FX conversion rejection and EUR reconciliation-create normalization.
- Validation: API tests 91/91 pass and canonical `./deploy-build.sh` gate green.
- Rollout: API + frontend artifacts redeployed; post-restart health recovered to 200; critical smoke routes PASS.

## Immediate Next Window (Now -> Next Commit Wave)
1. Master plan phases and urgent financial correctness hardening are complete.
2. Optional: continue parser parity corpus enrichment from additional real extracted statement samples.

## Closed Execution Run - 2026-07-12 (Phase 0 -> 11)

### Phase 0 - Scope Freeze and Baseline
Status: complete
Evidence:
- Release scope frozen to current HEAD `4515b53` + previously shipped backend truth path.
- Baseline captured from canonical tracker + deployment logs before execution.

### Phase 1 - Technical Foundation Stability
Status: complete
Evidence:
- `./deploy-build.sh` passed on HEAD.
- Output gate summary: API tests `98/98` pass, HQ check/build pass, regression gate pass, SQL column check pass, artifacts regenerated.

### Phase 2 - Auth, Roles, Permission Guardrails
Status: complete
Evidence:
- Unauthenticated guard checks returned expected `401`:
	- `GET /eof/v1/status?workspaceId=eeee-mu`
	- `GET /cc/v1/status?workspaceId=eeee-mu`
	- `GET /auth/me`

### Phase 3 - API/UI Contract Connectivity
Status: complete
Evidence:
- Full gate + app build green on HEAD.
- Critical route smoke pre-deploy PASS (`/`, Office bank, Distribution settings, Command Center settings).

### Phase 4 - Data Integrity and Financial Invariants
Status: complete
Evidence:
- API suite `98/98` green including import/reconciliation/parity tests and FX-related regression paths.
- Anti-regression float-money + SQL-column guards PASS.

### Phase 5 - Office End-to-End Readiness
Status: complete
Evidence:
- Office critical route smoke PASS.
- Office protected API status remains auth-guarded (401 unauth), consistent with expected runtime posture.

### Phase 6 - Distribution End-to-End Readiness
Status: complete
Evidence:
- Distribution settings route smoke PASS.
- Distribution write-path coverage remains included in API suite (aliases/duplicates/reconciliation actions).

### Phase 7 - HQ Shell and Cross-App Navigation
Status: complete
Evidence:
- Frontend build PASS.
- HQ app root + app workspace routes available in smoke checks.

### Phase 8 - Command Center Operational Readiness
Status: complete
Evidence:
- Command Center settings route smoke PASS.
- Status endpoint remains auth-protected (401 unauth).

### Phase 9 - Long-Running Workflow and Concurrency Safety
Status: complete
Evidence:
- Existing lock/idempotency regression coverage remained green in canonical API suite.
- No new regression surfaced during full gate run.

### Phase 10 - Security, Performance, Observability
Status: complete
Evidence:
- Supabase advisors fetched (security/performance): informational findings only in current snapshot.
- Supabase postgres logs snapshot showed routine `LOG` entries only in sampled output (no release-blocking database ERROR in the sampled window).
- Auth logs include recurring `400: Invalid Refresh Token: Refresh Token Not Found` events (client/session hygiene item, non-blocking for current release).

### Phase 11 - Rollout and Verification
Status: complete
Evidence:
- Deployed `app-eeee-api-hostinger.zip` + `app-eeee-frontend.zip` built from HEAD `4515b53` to Hostinger targets.
- Restarted API via `tmp/restart.txt`.
- Warm-up window observed (`503 {"status":"starting"}`), then health recovered to `200`.
- Post-warmup `corepack pnpm smoke:critical` PASS and protected status routes still `401` unauth.

## Follow-up Stabilization - 2026-07-12 (Connected Live Validation)

### Scope
- Capture post-release live verification while authenticated and close residual cross-origin runtime blockers.

### Changes
- Commit `afe14c2`: added animated Office dashboard showcase artifact (`design/theme-orbital/showcase/office/dashboard-animated.html`).
- Commit `5cc869c`: added `Cache-Control` to CORS allow headers in both startup stub (`services/api/src/server.ts`) and main API middleware (`services/api/src/index.ts`).
- Commit `30cceb1`: added `Pragma` to CORS allow headers in both startup stub (`services/api/src/server.ts`) and main API middleware (`services/api/src/index.ts`).

### Validation
- Canonical gate green after each hotfix cycle: API tests `98/98`, HQ check/build, regression gate, SQL column check.
- Post-deploy critical smoke: PASS.
- Protected endpoints preserved: `/eof/v1/status`, `/cc/v1/status`, `/auth/me` returned `401` unauthenticated.

### Connected UI verification (app.eeee.mu)
- Authenticated session confirmed (`David administrator`).
- Office dashboard now loads KPI data without CORS preflight failures.
- Count-up behavior observed on period change (intermediate animated values, then stable final values):
	- Example final stable values observed after animation: `Receivables 2,403,889.38 Rs`, `Payables 14,033,987.78 Rs`.
- Non-numeric ratio value check: `4/4` in Command Center KPI remained exact across repeated time samples (no unintended animation/parsing).
