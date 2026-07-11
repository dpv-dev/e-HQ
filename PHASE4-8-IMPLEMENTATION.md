# Phase 4 to 8 Implementation Pack

Last updated: 2026-07-11
Execution mode: sequential with fast feedback loops.

## Phase 4 - Office Completion

Objective:
- Complete Office critical workflows with backend truth and stable state transitions.

Work packages:
- P4-01 Mutation reload audit for transactions, reconciliation, imports, plan comptable.
- P4-02 Ensure no stale-table regressions on write failure paths.
- P4-03 Verify dashboard KPI consistency under period changes.

Definition of done:
- All critical Office write handlers documented with explicit post-success reload behavior.
- No Office critical mutation path leaves stale primary list state.

## Phase 5 - Distribution Completion

Objective:
- Complete Distribution import-to-payment lifecycle with auditable, non-stub behaviors.

Work packages:
- P5-01 Verify imports/mapping/contracts/expenses/allocation/statements/payments chain with explicit smoke script coverage.
- P5-02 Confirm statement/payment guardrails (void/reconcile constraints) remain enforced.
- P5-03 Verify print and file flow resource cleanup remains stable.

Definition of done:
- Critical Distribution mutations verified with receipts and list refresh logic.
- No maintenance-only action masquerades as active business action.

## Phase 6 - Command Center Completion

Objective:
- Command Center operates as backend-fed control tower.

Work packages:
- P6-01 Done now: backend overview endpoint + frontend overview wiring.
- P6-02 Done now: overview integration/settings rows are read from command_center persistence tables with default fallbacks.
- P6-03 Done now: integration table actions call cc/v1/integrations/:integrationId/toggle and refresh overview.

Definition of done:
- No frontend hardcoded operational arrays for readiness/integration/settings.
- Command Center integrations actions are operational or explicitly marked read-only.

## Phase 7 - E2E Quality Gate

Objective:
- Repeatable quality gate with route smoke evidence.

Work packages:
- P7-01 Done now: scripts/smoke-critical-routes.mjs added and executed.
- P7-02 Done now: root script alias smoke:critical added and executed.
- P7-03 Embed in release sequence docs (pre-deploy and post-deploy checks).

Definition of done:
- Smoke script exits non-zero on failing critical route/health checks.
- Gate runbook references this script.

## Phase 8 - Final Deploy and Stabilization

Objective:
- Controlled production deploy with verification and stabilization loop.

Work packages:
- P8-01 Run canonical build gate (deploy-build.sh).
- P8-02 Deploy API/frontend artifacts per DEPLOY.md/DEPLOYMENT.md.
- P8-03 Run smoke route checks + targeted interaction checks.
- P8-04 Stabilization window: collect regressions, patch, redeploy if needed.

Definition of done:
- Production endpoints/routes healthy.
- Critical workflows validated after deploy.
- Tracker updated with deployed commit + evidence links.

## Ordered execution command set
1. Build + compile checks:
   - corepack pnpm --filter @ehq/api-client check
   - corepack pnpm --filter @ehq/api check
   - corepack pnpm --filter @ehq/hq check
2. Critical route smoke:
   - corepack pnpm smoke:critical
3. Full release gate:
   - ./deploy-build.sh
4. Deploy and verify using DEPLOY.md and DEPLOYMENT.md.
