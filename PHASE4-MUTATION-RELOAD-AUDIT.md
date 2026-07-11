# Phase 4 Mutation Reload Audit

Last updated: 2026-07-11
Scope: Office + Distribution critical mutations and post-write reload consistency.

## Implemented fixes in this pass

### Office
- classifySelectedPending now reloads pending list, transactions list, and dashboard after successful writes.
  - File: apps/hq/src/app/canonical/office/App.svelte
- bulkValidatePending now reloads pending list, transactions list, dashboard, and reconciliation views after successful writes.
  - File: apps/hq/src/app/canonical/office/App.svelte
- confirmImport now refreshes reconciliation list + operations together (refreshReconciliationViews) instead of only the list endpoint.
  - File: apps/hq/src/app/canonical/office/App.svelte
- submitReconcileCreate now refreshes dashboard and dashboard analytics in addition to reconciliation + ledger lists.
  - File: apps/hq/src/app/canonical/office/App.svelte
- classifySelectedPending now also refreshes dashboard analytics.
  - File: apps/hq/src/app/canonical/office/App.svelte
- bulkValidatePending now also refreshes dashboard analytics.
  - File: apps/hq/src/app/canonical/office/App.svelte

### Distribution
- reverseImportBatch now refreshes dashboard alongside imports and mapping views.
  - File: apps/hq/src/app/canonical/distribution/App.svelte
- confirmImport now refreshes import batches, mapping rows, and dashboard.
  - File: apps/hq/src/app/canonical/distribution/App.svelte
- editPayment now refreshes payments, statements, and reconciliation summaries.
  - File: apps/hq/src/app/canonical/distribution/App.svelte
- reconcilePayment now refreshes payments, statements, and reconciliation summaries.
  - File: apps/hq/src/app/canonical/distribution/App.svelte
- reverseImportBatch and confirmImport now also refresh suspense/revenue/reconciliation/audit views.
  - File: apps/hq/src/app/canonical/distribution/App.svelte
- applyMappingRules now refreshes mapping + suspense/revenue/reconciliation/audit views.
  - File: apps/hq/src/app/canonical/distribution/App.svelte
- startCadencedAllocationRun now refreshes runs + statements/payments/revenue/reconciliation/audit views.
  - File: apps/hq/src/app/canonical/distribution/App.svelte
- recordPayment now refreshes payments/statements/revenue/reconciliation/audit views.
  - File: apps/hq/src/app/canonical/distribution/App.svelte
- editPayment, reconcilePayment, and voidPayment now all refresh audit log after mutation.
  - File: apps/hq/src/app/canonical/distribution/App.svelte
- unpostAllocationRun now refreshes audit log in addition to allocation/payment/reconciliation surfaces.
  - File: apps/hq/src/app/canonical/distribution/App.svelte

### Focused regression tests
- Added source-level refresh-plan tests for Office key handlers.
  - File: apps/hq/src/app/canonical/office/mutation-refresh-plan.test.ts
- Added source-level refresh-plan tests for Distribution key handlers.
  - File: apps/hq/src/app/canonical/distribution/mutation-refresh-plan.test.ts

### Plan-comptable refresh policy decision
- Decision: keep plan-comptable writes scoped to reloading the plan tree only (no automatic cross-surface dashboard/ledger refresh on create/update/delete of plan nodes).
- Rationale: these writes occur on the dedicated plan page, and broad cross-surface invalidation adds noise and latency without immediate user value; non-plan views naturally reload on navigation or explicit refresh.
- Scope: createPlanNode, deactivateFirstCategory, togglePlanNodeActive, deletePlanNode.

## Verification
- API compile: passed
- HQ tests: 26/26 passed
- HQ build: passed

## Remaining audit work
- None for Phase 4 mutation reload scope.
