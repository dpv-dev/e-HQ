# Phase 1 and 2 Execution Backlog

Last updated: 2026-07-11
Status legend: todo | in-progress | blocked | done

## Priority P0 (must ship first)

### P0-BASE-01 - Route and Action Truth Matrix
Status: done
Why: we need one exact map of every visible action to backend endpoint and expected state transitions.
Scope:
- apps/hq/src/app/canonical/office/
- apps/hq/src/app/canonical/distribution/
- apps/hq/src/app/canonical/command-center/
Output:
- New markdown matrix with columns: route, action label, API method/path, idempotency key, audit receipt, reload behavior, guard behavior.
Acceptance:
- All high-traffic routes captured.
- No action left with unknown backend mapping.

### P0-BASE-02 - Release Scope Lock (must-have vs later)
Status: done
Why: prevent drift and parallel contradictory priorities.
Scope:
- APP-EXECUTION-TRACKER.md
- Release checklist doc (to be added)
Acceptance:
- Explicit must-have list signed in repo docs.
- Out-of-scope list explicitly written.

## Priority P1 (backend truth risks)

### P1-CC-01 - Replace static integration/settings operational arrays with API-fed state
Status: in-progress
Evidence:
- apps/hq/src/app/canonical/command-center/App.svelte contains static integrations and settingRows arrays.
Goal:
- Replace static operational rows with fetched API state.
Work:
- Add API endpoint(s) or extend cc status endpoint with integrations/settings payload.
- Add typed client methods in packages/api-client.
- Wire Command Center tables/cards to fetched state.
Acceptance:
- No static integration operational rows in Command Center page logic.
- Loading/error states driven by API request state.

### P1-CC-02 - Promote readiness to backend aggregate contract
Status: in-progress
Evidence:
- Command Center readiness details are assembled in frontend from multiple request slices and static data assumptions.
Goal:
- Backend emits a single readiness summary contract for operational truth.
Work:
- Add cc readiness endpoint in services/api.
- Add typed contract in packages/api-client/src/types.ts and client call.
- Replace dashboard readiness composition with API response.
Acceptance:
- Readiness KPI and action list produced from API aggregate response.
- Frontend only formats, does not invent operational values.

### P1-ACTION-01 - Mutation reload consistency audit and fixes
Status: in-progress
Why: prevent stale optimistic UI after write success/error.
Scope:
- Office canonical screens.
- Distribution canonical screens.
Work:
- For each mutation handler, verify post-success reload behavior and error behavior keeps list state intact.
- Patch any outliers.
Acceptance:
- Every write either reloads source list(s) or documents deliberate local optimistic path with reconciliation.
- No write error path that destroys unrelated loaded data.

## Priority P2 (hardening and quality)

### P2-E2E-01 - Cross-app smoke script for critical routes/actions
Status: in-progress
Goal: repeatable smoke verification before every deploy.
Scope:
- scripts/ (new smoke script)
- route set for Office, Distribution, Command Center
Acceptance:
- Script exits non-zero on failed health/route/action checks.
- Included in release runbook.

### P2-API-01 - Endpoint capability reconciliation check
Status: todo
Goal: ensure client methods and UI actions fully match API capability.
Scope:
- services/api/src/index.ts
- packages/api-client/src/*.ts
- canonical UI handlers
Acceptance:
- No high-priority endpoint missing client method or UI mapping where feature is in-scope.

## Started under Phase 1 and 2 in this session
- Centralized ApiRequestState loading/label logic in apps/hq/src/app/canonical/request-state.ts.
- Added tests in apps/hq/src/app/canonical/request-state.test.ts.
- Unified canonical request-status aliases to shared type in Office/Distribution/Partners.
- Repeatedly validated via HQ tests, HQ build, and full deploy-build gate.
- Added Phase 1 action map in PHASE1-ROUTE-ACTION-MATRIX.md.
- Added release scope lock in RELEASE-SCOPE-LOCK.md.
- Added backend command-center overview endpoint (cc/v1/overview) and client method getOverview.
- Refactored command-center frontend to load readiness/integration/settings from backend overview payload.
- Added scripts/smoke-critical-routes.mjs and package script smoke:critical (live run passed).
- Added Phase 4 mutation reload consistency pass in Office/Distribution with concrete handler refresh fixes (documented in PHASE4-MUTATION-RELOAD-AUDIT.md).
