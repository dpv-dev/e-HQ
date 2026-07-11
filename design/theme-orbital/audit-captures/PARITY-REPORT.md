# Orbital Office Parity Report

Date: 2026-07-11
Scope: Visual parity audit between live Office routes and Orbital showcase mockups.
Inputs:
- Live captures: design/theme-orbital/audit-captures/live/*.png
- Showcase captures: design/theme-orbital/audit-captures/showcase/*.png

## Capture Coverage

Covered pages (18/18):
- dashboard
- reconciliation
- pnl
- coa
- transactions
- projects
- clients
- suppliers
- imports
- pending
- cashflow
- bank
- monitoring
- audit
- vat
- settings
- ceo
- wave-invoices

## High-Priority Residual Gaps

1. Topbar composition mismatch (all pages)
- Showcase has: status ticker + primary action button in top bar.
- Live has: search placeholder + user card.
- Impact: Largest visual identity gap above the fold.

2. Sidebar architecture mismatch (all pages)
- Showcase uses a floating rounded nav panel with grouped spacing and no standalone mark tile.
- Live uses full-height sidebar shell behavior from WorkspaceShell.
- Impact: Strong layout delta even when colors are close.

3. Header content model mismatch (all pages)
- Showcase uses compact page-head with period chip near title actions.
- Live includes platform PageHeader + separate period control block.
- Impact: Vertical rhythm and first-screen structure diverge.

4. Data/content fidelity mismatch (several pages)
- Showcase displays curated populated examples.
- Live can show loading placeholders, empty states, or production values.
- Impact: Visual comparison is noisy beyond pure styling.

## Route-Specific Notes

- wave-invoices: structural gap
  - Live route /console/office/wave-invoices currently renders Office Dashboard.
  - Showcase contains a dedicated Wave Invoices page.

- reconciliation: partial parity
  - Card/table skin and accent rails are close.
  - Main divergence remains shell/topbar/header composition.

- dashboard: partial parity
  - Orbital card language is close.
  - Header/period/topbar structure remains the major delta.

## CSS Actions Applied Locally During This Pass

Files updated:
- apps/hq/src/office-orbital-scope.css
- apps/hq/src/app/canonical/office/orbital-office.css

What was adjusted:
- Tightened token remap scope to the Office workspace shell root.
- Fixed root background scope to avoid applying workspace background treatment to inner header blocks.
- Added Office-only shell/nav/topbar visual refinements.
- Rebalanced page-header and period-control styling to align closer to mockup rhythm.
- Kept all changes style-only and Office-only.

Validation:
- HQ build passes with current local changes.

## Functional Gaps Explicitly Not Implemented

Per instruction, still not implemented in this parity pass:
- OfficeProjectPnl budget fields (budget_income, budget_expenses).
- Aged-balance aggregation endpoint for clients/suppliers.

## Recommended Next Step

Deploy current CSS refinements to staging/live, then regenerate the same capture set and produce a delta v2 focused on post-deploy visual changes only.
