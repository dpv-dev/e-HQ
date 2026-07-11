# Full App Execution Tracker (Office, Distribution, Command Center)

Last updated: 2026-07-11
Branch: theme/distribution-command
Main baseline: 146e25b
Current head: 2d264ce

## Current Snapshot
- Repo health: clean working tree, green local gates.
- Frontend quality trend: shared request-state/request-status helpers are now centralized and tested.
- Deployment baseline: production API + frontend confirmed on commit b1200b9 in this session.
- Parser ownership: Office imports now use backend parse-preview path only; frontend statement parser fallback has been removed from production flow.
- Financial correctness hardening: deployed commit pair `4d5697d` + `2d264ce` to lock EUR reconciliation currency normalization and debit/credit-only direction ingestion.

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
