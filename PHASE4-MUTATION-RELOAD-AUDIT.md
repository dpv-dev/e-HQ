# Phase 4 Mutation Reload Audit

Last updated: 2026-07-11
Scope: Office + Distribution critical mutations and post-write reload consistency.

## Implemented fixes in this pass

### Office
- classifySelectedPending now reloads pending list, transactions list, and dashboard after successful writes.
  - File: apps/hq/src/app/canonical/office/App.svelte
- bulkValidatePending now reloads pending list, transactions list, dashboard, and reconciliation views after successful writes.
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

## Verification
- API compile: passed
- HQ tests: 17/17 passed
- HQ build: passed

## Remaining audit work
- Review all remaining low-frequency write handlers for over-refresh or missing refresh.
- Add focused tests for multi-surface refresh expectations on key mutation handlers.
