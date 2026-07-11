# Orbital Office Parity Delta v3

Date: 2026-07-11
Scope: Post-deploy parity pass after v3 polish + dedicated Wave Invoices page.
Compared sets:
- Baseline live: design/theme-orbital/audit-captures/live-v2/*.png
- New live: design/theme-orbital/audit-captures/live-v3/*.png
- Reference: design/theme-orbital/audit-captures/showcase/*.png

## Deployment Status

- Frontend artifact rebuilt with canonical pipeline (`./deploy-build.sh`).
- Frontend zip deployed to `app.eeee.mu`.
- Live CSS hash now serving: `workspace-office-CGQXuD6E.css`.
- Smoke checks:
  - `/` -> 200
  - `/console/office/wave-invoices` -> 200

## Capture Status

- Recaptured 18/18 Office routes into `live-v3`.
- File set includes the dedicated `07-wave-invoices.png` capture.
- Route sweep result: `consoleErrorsCount = 0`, `pageErrorsCount = 0` on all 18 routes.

## Confirmed v3 Changes

1. Dedicated Wave Invoices route now exists in live
- `/console/office/wave-invoices` now renders `H1 = Wave invoices`.
- This route no longer falls back to Office Dashboard.

2. Topbar/header polish is live
- Dashboard computed styles after deploy:
  - Topbar min-height: `76px`
  - Topbar padding: `12px 24px`
  - Topbar border-bottom: `1px` (`rgba(255, 255, 255, 0.06)`)
  - Search field min-height: `46px`
  - Search radius: `999px`
  - User block border color: `rgba(255, 184, 0, 0.45)`
  - H1 remains large amber (`40.947px`, `rgb(255, 184, 0)`)

3. Office-only scoping remains intact
- Changes are constrained to Office workspace selectors and Office page routing.
- No domain/API financial behavior was modified in this pass.

## v2 Residual Gap Follow-up

Resolved:
- `wave-invoices` structural mismatch is now closed.

Still open:
- Topbar composition still differs from the showcase composition model (live shell primitives vs showcase custom action/ticker composition).
- Data parity still intentionally differs where showcase uses curated static examples and live uses runtime data.

## Explicitly Not Implemented (unchanged)

- Office project budget fields (`budget_income`, `budget_expenses`).
- Aged-balance aggregation endpoint for clients/suppliers.
