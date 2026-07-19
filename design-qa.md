# Distribution page parity — design QA

Date: 2026-07-19

Scope: functional page parity with the WordPress Distribution reference while
retaining the consolidated app's existing Orbital shell, shared tokens, and
component system. Office payment/accounting integration is intentionally out of
scope.

## Evidence

- WordPress captures: `/private/tmp/ehq-distribution-audit-2026-07-19/01-dashboard.png`,
  `03-contracts.png`, and `05-payments-record-form.png`
- Local production build captures: `/private/tmp/ehq-distribution-audit-2026-07-19/local-dashboard.png`,
  `local-contracts.png`, and `local-payments.png`
- Combined comparison: `/private/tmp/ehq-distribution-audit-2026-07-19/distribution-parity-comparison.png`
- Viewport: 1280 × 720

## Findings

### P0

None.

### P1

None after correction. The first Payments check exposed a mixed-version runtime
crash because the production API still returned the previous payment shape.
The frontend now normalizes the previous and current response shapes during a
rolling deploy. A second local production-build pass completed with no new
browser errors.

### P2 — accepted product-shell differences

- WordPress uses a horizontal module navigation strip; the consolidated app
  keeps its persistent left workspace navigation.
- WordPress opens payment and expense actions in a right-side modal; the app
  exposes the same fields and actions in inline command panels.
- Typography, surfaces, spacing, and gold accent follow the shared Orbital
  design tokens rather than copying legacy WordPress CSS.

These differences do not remove a page, field, action, filter, table, export,
or financial invariant. They preserve the app-wide design system while the
business workflow and backend behavior match the reference.

## Runtime result

- Dashboard: live API values rendered.
- Contracts: live contracts/payees rendered; payee, contract, and categorized
  shared/targeted expense forms are present.
- Payments: standalone Distribution subledger form, filters, export, statement
  linking queue, and ledger rendered; Office boundary notice is visible.
- Browser console: no new errors or warnings after the compatibility fix.
