# Release Scope Lock (Must Have vs Later)

Last updated: 2026-07-11
Target: full working app baseline for Office, Distribution, Command Center.

## Must Have (ship blocker)

### Platform
- All critical write actions must use idempotency keys and return typed receipts.
- No frontend-only fake success path on critical workflows.
- No hidden denied workspaces; denied cards remain visible and locked.

### Office
- Bank import preview/confirm/reverse/delete stable and auditable.
- Reconciliation core actions stable: match, create transaction from bank line, approve flows.
- Transactions create/update/validate stable with reload consistency.
- Dashboard and key KPI surfaces load from API without first-paint false empty states.

### Distribution
- Import to mapping to contract expense to allocation run to statements/payments flow stable.
- Payment lifecycle stable: record, update, reconcile, void.
- Statement lifecycle stable: generate, print, void with locks/guards.
- Reconciliation and suspense views load from API and mutate safely.

### Command Center
- Dashboard operational readiness from backend aggregate endpoint.
- Integrations/settings rows sourced from backend payload (not hardcoded in UI).
- Permission and setting writes guarded by write gate + audit receipt.

### Quality gate
- API check, API tests, HQ check/build, regression scripts all green.
- Critical smoke checks pass (health + key routes).

## Later (not ship blocker for this release)
- Advanced per-connector live integration telemetry beyond current status payload.
- Expanded alias/duplicate management UX in Distribution beyond current typed empty/read-only states.
- Additional Command Center settings controls currently marked view-only.
- Non-critical UI polish where behavior is already correct.

## Explicit out-of-scope for this release
- Reintroducing any direct legacy backend runtime dependency.
- Any second canonical datastore for runtime business truth.
- Destructive schema/data changes without explicit approved deploy path.

## Change control
- Any item moved from Later to Must Have requires a doc update in this file and APP-EXECUTION-TRACKER.md.
- Any scope cut from Must Have requires rationale and replacement mitigation in commit message + tracker notes.
