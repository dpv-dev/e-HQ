# Phase 1 Route and Action Truth Matrix

Last updated: 2026-07-11
Purpose: high-traffic action truth map across Office, Distribution, and Command Center.

Legend:
- Action status: implemented | partial | out-of-scope
- Audit receipt: yes means endpoint returns auditEventId in write receipt envelope

## Office

| Route | Action label | API method/path | Idempotency key | Audit receipt | Reload behavior | Guard behavior | Action status |
|---|---|---|---|---|---|---|---|
| /console/office/imports | Preview bank import | POST eof/v1/bank-import/preview | required | yes | Refresh import preview state | writesEnabled + workspace auth | implemented |
| /console/office/imports | Confirm bank import | POST eof/v1/bank-import/confirm | required | yes | Reload screen + transactions + dashboard | writesEnabled + workspace auth | implemented |
| /console/office/imports | Reverse import batch | POST eof/v1/bank-import/batches/:batchId/reverse | required | yes | Reload imports list + bank quality | writesEnabled + workspace auth + admin sensitive action | implemented |
| /console/office/imports | Delete import batch | POST eof/v1/bank-import/batches/:batchId/delete | required | yes | Reload imports list + bank quality | writesEnabled + workspace auth + admin sensitive action | implemented |
| /console/office/transactions | Create transaction | POST eof/v1/transactions | required | yes | Reload transactions + dashboard + pnl slices | writesEnabled + workspace auth | implemented |
| /console/office/transactions | Update transaction | PATCH eof/v1/transactions/:transactionId | required | yes | Reload transactions + reconciliation views | writesEnabled + workspace auth | implemented |
| /console/office/transactions | Validate transaction | POST eof/v1/transactions/:transactionId/validate | required | yes | Reload transactions + dashboard | writesEnabled + workspace auth | implemented |
| /console/office/reconciliation | Match line to transaction | POST eof/v1/reconciliations/match | required | yes | Reload reconciliations + operations | writesEnabled + workspace auth | implemented |
| /console/office/reconciliation | Create transaction from line | POST eof/v1/reconciliations/create-transaction | required | yes | Reload reconciliations + transactions + dashboard | writesEnabled + workspace auth | implemented |
| /console/office/reconciliation | Approve selected matches | POST eof/v1/reconciliations/approve | required | yes | Reload reconciliations + dashboard | writesEnabled + workspace auth | implemented |
| /console/office/reconciliation | Approve suggested matches | POST eof/v1/reconciliations/approve-suggested | required | yes | Reload reconciliations + dashboard | writesEnabled + workspace auth | implemented |

## Distribution

| Route | Action label | API method/path | Idempotency key | Audit receipt | Reload behavior | Guard behavior | Action status |
|---|---|---|---|---|---|---|---|
| /console/distribution/imports | Preview import | POST erh/v1/imports/preview | required | yes | Refresh preview/mapping sections | writesEnabled + workspace auth | implemented |
| /console/distribution/imports | Confirm import | POST erh/v1/imports/confirm | required | yes | Reload import batches + mapping rows | writesEnabled + workspace auth | implemented |
| /console/distribution/imports | Reverse batch | POST erh/v1/imports/batches/:batchId/reverse | required | yes | Reload import batches + downstream counters | writesEnabled + workspace auth + admin sensitive action | implemented |
| /console/distribution/mapping | Apply mapping rules | POST erh/v1/mapping/apply-rules | required | yes | Reload mapping rows + reconciliation | writesEnabled + workspace auth | implemented |
| /console/distribution/contracts | Create contract | POST erh/v1/contracts | required | yes | Reload contracts + expense filter lists | writesEnabled + workspace auth | implemented |
| /console/distribution/contracts | Update royalty rules | POST erh/v1/contracts/:contractId/rules | required | yes | Reload contracts + allocation preview context | writesEnabled + workspace auth | implemented |
| /console/distribution/contracts | Record expense | POST erh/v1/contracts/:contractId/expenses | required | yes | Reload contract expenses + open expense totals | writesEnabled + workspace auth | implemented |
| /console/distribution/allocations | Start allocation run | POST erh/v1/allocations/runs | required | yes | Reload run list + allocations summary | writesEnabled + workspace auth + workflow lock | implemented |
| /console/distribution/allocations | Unpost run | POST erh/v1/allocations/runs/:runId/unpost | required | yes | Reload run list + contract expenses | writesEnabled + workspace auth + workflow lock | implemented |
| /console/distribution/statements | Generate statements | POST erh/v1/statements/generate | required | yes | Reload statements + payment queue | writesEnabled + workspace auth | implemented |
| /console/distribution/statements | Void statement | POST erh/v1/statements/:statementId/void | required | yes | Reload statements + payments | writesEnabled + workspace auth + payment lock domain rule | implemented |
| /console/distribution/statements | Print statement | GET erh/v1/statements/:statementId/print | n/a | n/a | No mutation, local print flow only | workspace auth | implemented |
| /console/distribution/payments | Record payment | POST erh/v1/payments | required | yes | Reload payments + statements | writesEnabled + workspace auth | implemented |
| /console/distribution/payments | Update payment | PATCH erh/v1/payments/:paymentId | required | yes | Reload payments + reconciliation summaries | writesEnabled + workspace auth | implemented |
| /console/distribution/payments | Reconcile payment | POST erh/v1/payments/:paymentId/reconcile | required | yes | Reload payments + statements + recon view | writesEnabled + workspace auth | implemented |
| /console/distribution/payments | Void payment | POST erh/v1/payments/:paymentId/void | required | yes | Reload payments + statements | writesEnabled + workspace auth + statement-void guard | implemented |

## Command Center

| Route | Action label | API method/path | Idempotency key | Audit receipt | Reload behavior | Guard behavior | Action status |
|---|---|---|---|---|---|---|---|
| /console/command-center/dashboard | Load operational overview | GET cc/v1/overview | n/a | n/a | Refreshes readiness + integrations + settings in one payload | workspace auth + non-bot route guard | implemented |
| /console/command-center/dashboard | Load write gate | GET cc/v1/status | n/a | n/a | Refreshes write gate banner/toolbar mode | workspace auth + non-bot route guard | implemented |
| /console/command-center/users | Update user permissions | POST cc/v1/users/:userId/permissions | required | yes | Notice + subsequent overview/status refresh path | writesEnabled + workspace auth + sensitive action role gate | implemented |
| /console/command-center/settings | Update workspace setting | POST cc/v1/settings | required | yes | Notice + local state persistence | writesEnabled + workspace auth + sensitive action role gate | implemented |
| /console/command-center/integrations | Toggle integration state | POST cc/v1/integrations/:integrationId/toggle | required | yes | Refreshes overview payload (readiness/integrations/settings) after mutation | writesEnabled + workspace auth + sensitive action role gate | implemented |

## Remaining Phase 1 gaps
- Extend this matrix from high-traffic actions to all visible route actions before Phase 1 is marked complete.
- Add direct file references for each row (handler and API callsite) in next pass.
- Add explicit out-of-scope rows for intentionally hidden/disabled controls.
