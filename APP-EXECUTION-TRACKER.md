# Full App Execution Tracker (Office, Distribution, Command Center)

Last updated: 2026-07-11
Branch: theme/distribution-command
Main baseline: 146e25b
Current head: 18f730c

## Current Snapshot
- Repo health: clean working tree, green local gates.
- Frontend quality trend: shared request-state/request-status helpers are now centralized and tested.
- Deployment baseline: production last confirmed on commit 2411977 in this session.
- Parser ownership: parser logic currently exists in frontend files apps/hq/src/app/bank-parser.ts and apps/hq/src/app/pdf-extract.ts.

## Program Phases

### Phase 1 - Product Completion Baseline
Status: in-progress
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

Exit criteria:
- Every visible user action has one of: implemented, intentionally hidden, or explicitly out-of-scope.
- No ambiguous "maybe done" items remain.

### Phase 2 - Backend Truth and Functional Completeness
Status: in-progress
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

Exit criteria:
- No fake success states.
- No static operational metrics where real API state exists.
- All critical writes covered by idempotency and audit receipts.

### Phase 3 - Parser Ownership Migration
Status: in-progress (design started)
Owner: engineering
Goal: parsing authority moves to API; frontend parser becomes fallback then removable.

Deliverables:
- Parser migration architecture in PARSER-MIGRATION-DESIGN.md.
- API contracts for parse preview and normalized row output.
- Rollout and rollback plan with parity fixtures.

Exit criteria:
- Production parsing path uses backend parser endpoints.
- Frontend parser path disabled or removed from production flow.

### Phase 4 - Office Completion
Status: in-progress
Goal: complete all critical accounting workflows with stable UX states and API truth.

Done:
- Residual mutation consistency pass extended to low-frequency handlers (import confirm, reconcile-create, pending classify/validate) so dashboard analytics and reconciliation operations stay in sync after writes.

### Phase 5 - Distribution Completion
Status: in-progress
Goal: complete import-to-payment lifecycle with auditable, non-stub actions.

Done:
- Residual mutation consistency pass extended to low-frequency handlers (import reverse/confirm, mapping apply, allocation run start, payment actions) with suspense/revenue/reconciliation/audit refreshes.

### Phase 6 - Command Center Completion
Status: in-progress
Goal: real operational control tower fed by live API state.

### Phase 7 - E2E Quality Gate
Status: in-progress
Goal: full green gate + smoke evidence across all three apps.

Done:
- Added executable smoke script scripts/smoke-critical-routes.mjs.
- Added root command smoke:critical and validated it against live routes.

### Phase 8 - Final Deploy and Stabilization
Status: in-progress
Goal: production rollout with verification and short stabilization window.

Done:
- Added ordered Phase 8 execution checklist in PHASE4-8-IMPLEMENTATION.md.
- Production rollout executed (API + frontend artifacts uploaded and unpacked, API restart triggered).
- Post-deploy smoke checks passed after startup warm-up (healthz and critical app routes).
- Deployment evidence logged in DEPLOY-LOG-2026-07-11.md.

## Immediate Next Window (Now -> Next Commit Wave)
1. Expand PHASE1-ROUTE-ACTION-MATRIX.md from high-traffic rows to full visible action coverage.
2. Add focused UI tests for multi-surface post-mutation refresh expectations on the highest-risk handlers.
3. Decide/implement cross-surface refresh policy for plan-comptable writes if product requires immediate non-plan view propagation.
