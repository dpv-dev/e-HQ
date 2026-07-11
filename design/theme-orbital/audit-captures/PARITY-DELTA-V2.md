# Orbital Office Parity Delta v2

Date: 2026-07-11
Scope: Post-deploy visual delta after Office-only Orbital CSS refinements.
Compared sets:
- Baseline live: design/theme-orbital/audit-captures/live/*.png
- New live: design/theme-orbital/audit-captures/live-v2/*.png
- Reference: design/theme-orbital/audit-captures/showcase/*.png

## Deployment Status

- Frontend artifact rebuilt with canonical pipeline.
- Frontend zip deployed to app.eeee.mu.
- Live hash now serving: workspace-office-BDxMBKN7.css.
- Smoke checks: app root 200, /console/office/dashboard 200, /console/office/pnl 200.

## Capture Status

- Recaptured 18/18 Office routes into live-v2.
- Route sweep result: consoleErrorsCount = 0, pageErrorsCount = 0 on all 18 routes.

## Measured Visual Changes (Dashboard)

Baseline -> v2:
- Page header min-height: 110px -> 0px
- Page header padding: 16px 0 12px -> 2px 0 0
- Page header bottom border: 1px -> 0px
- H1 size: 27.27px -> 40.95px
- Sidebar padding: 16px -> 22px 18px 22px 24px
- Sidebar background: dark tinted panel -> transparent
- Topbar min-height: 72px -> 74px
- Topbar padding: 0 24px -> 14px 24px 12px
- Topbar bottom border: 1px -> 0px
- Nav container: flat shell -> rounded panel (18px radius, elevated)
- Period selector: standard select -> pill select (48px min-height, radius 999px)

## v2 Improvements Confirmed

1. Shell now visually closer to Orbital mockup
- Floating nav panel, spacing, and elevated left rail are now present.

2. Header rhythm now closer to showcase
- Large amber title treatment and reduced header chrome match the intended page-head style better.

3. Office-only scope remains intact
- Changes are constrained to Office workspace selectors; no functional API/domain changes.

4. Runtime quality remains clean
- No console errors and no page errors across full Office route sweep.

## Residual Gaps After v2

1. Topbar composition still differs from showcase
- Live keeps shell search + user menu.
- Showcase uses ticker + explicit primary action in the top bar.

2. Header model still differs structurally
- Live still uses PageHeader + separate period-control section.
- Showcase composes a single page-head action row.

3. Data-layer parity remains intentionally imperfect
- Showcase uses curated static examples.
- Live reflects real runtime data, loaders, and empty/partial states.

4. wave-invoices route remains a structural mismatch
- Live /console/office/wave-invoices still renders Office Dashboard.
- Showcase has a dedicated Wave Invoices page.

## Explicitly Not Implemented (unchanged)

- OfficeProjectPnl budget fields (budget_income, budget_expenses).
- Aged-balance aggregation endpoint for clients/suppliers.
