# Distribution Visual Identity Implementation

Source of truth: `Template Previews/03 - Visual Language.png`.

This document defines how the e-HQ visual identity should be applied to the Distribution plugin without changing the financial engine, database logic, allocation logic, payment logic, statement logic, or migration safety layer.

## 1. Visual direction

Distribution should feel like a premium financial command center:

- Dark, calm, precise, and operational.
- Information hierarchy first: money, blockers, actions, and status must be instantly readable.
- Yellow accent is used for energy, focus, primary actions, and active states.
- Graphite surfaces and subtle borders create structure without heavy visual noise.
- Motion should be discreet and functional, never decorative for its own sake.

## 2. Official tokens

### Colors

```css
:root {
  --ehq-yellow: #FFD200;
  --ehq-black: #0D0F14;
  --ehq-surface: #171B22;
  --ehq-surface-high: #222831;
  --ehq-text: #F6F7F9;
  --ehq-text-muted: #8A8F98;
  --ehq-border: rgba(255, 255, 255, 0.10);
  --ehq-border-strong: rgba(255, 210, 0, 0.42);
  --ehq-success: #22C55E;
  --ehq-info: #3B82F6;
  --ehq-warning: #FBBF24;
  --ehq-error: #EF4444;
}
```

### Typography

Official direction: Open Sans.

Implementation rule:

- Use Open Sans for UI, brand labels, and short identity accents.
- Fönt remains an inactive legacy/fallback font, not the active brand font.
- Do not use visual identity work to block functional releases.

```css
--ehq-font: "Open Sans", "Fönt", "Aeonik", "Inter", "Helvetica Neue", Arial, sans-serif;
--ehq-brand-font: "Open Sans", "Fönt", "Aeonik", "Inter", "Helvetica Neue", Arial, sans-serif;
```

Type hierarchy:

- H1: 32px bold.
- H2: 24px semibold.
- H3: 18px semibold.
- Body: 16px regular.
- Small: 14px regular.
- Caption: 12px regular.
- Operational labels: uppercase, 11-12px, letter-spaced.

## 3. Components

### Page shell

Every Distribution page should use:

- Dark background.
- Top hero with logo block, page title, subtitle, and version badge.
- Maximum content width adapted to wp-admin and frontend contexts.
- Consistent vertical spacing between hero, toolbar, KPI cards, panels, and tables.

### Cards

Cards should use:

- Graphite gradient background.
- 1px subtle border.
- Rounded corners between 16px and 22px.
- Soft inner glow only when useful.
- No overly bright gray tables inside dark panels.

### KPI cards

KPI cards must be quick to scan:

- Label top.
- Value center.
- Detail bottom.
- Accent icon on the right.
- Large numbers should wrap cleanly by currency.
- Multiple currencies should be stacked, not comma-crammed.

### Buttons

Primary:

- Yellow background.
- Dark text.
- Clear hover lift and brighter glow.

Secondary:

- Dark transparent background.
- Subtle border.
- White text.
- Yellow border/glow on hover.

Danger:

- Dark red surface.
- Red border.
- White text.

Rules:

- Every action button must describe the exact action.
- Avoid generic labels like `Open` when the action can be `Open exact split`, `Fix contributors`, or `Reconcile payments`.
- Buttons inside tables must remain compact but readable.

### Inputs and filters

Inputs should use:

- Dark surface.
- Light text.
- Muted placeholder.
- Yellow focus outline.
- Consistent height with buttons.

Filters should be grouped as one toolbar instead of scattered controls.

### Tables

Tables are the operational core.

Rules:

- Header sticky when table scrolls internally.
- Dark header.
- Clear row separation.
- Hover state subtle yellow tint.
- Numbers aligned and tabular.
- Actions pinned or visually easy to find.
- Avoid making every page horizontally scroll unless truly required.
- Large datasets should use internal table scroll and pagination/filtering only where useful.

### Drawers and floating windows

Drawers should feel like command panels:

- Dark overlay with blur.
- Drawer surface using graphite gradient.
- Sticky header with exact item name.
- Sticky footer with primary action and cancel/delete.
- Context panel near the top: what is being fixed and why.
- Actions must target the exact issue, not generic page links.

### Badges

Badges should encode status quickly:

- Success: green.
- Warning/fix needed: yellow.
- Error/blocking: red.
- Info/neutral: blue or graphite.

Use concise labels: `OK`, `Fix`, `Clear`, `Blocked`, `Pending`, `Paid`, `Draft`, `Void`.

### Loaders

Loaders should be branded:

- Yellow accent.
- Minimal movement.
- Show current job/chunk when possible.
- Never hide server-safe allocation pacing.

## 4. Distribution page mapping

### Dashboard

Goal: command center overview.

Must include:

- KPI grid.
- Readiness cockpit.
- Health diagnostics.
- Top royalties.
- Revenue by quarter.
- Action list.

Design notes:

- Dashboard must not become a long wall of tables.
- Charts should be readable before exact.
- Exact figures can be in hover/title or secondary table.

### Imports

Goal: upload/import health and batch diagnostics.

Design notes:

- Batch rows should expose exact next action.
- Multi-currency totals should be summarized like dashboard, not stacked endlessly.

### Mapping

Goal: review imported rows, automate safe matches, apply reusable rules.

Design notes:

- Clarify `Automate` and `Apply rules` with helper text.
- Batch dropdown should not consume the page.
- Row review must be clear and editable.

### Catalog

Goal: canonical catalog and contributor review.

Design notes:

- Import artist and catalog contributors must be visibly separate.
- `Needs review` should lead to exact row/drawer correction.
- Artist source filters must be clear.

### Contracts

Goal: splits, payees, expenses, recoupments.

Design notes:

- KPI links should open exact query views.
- Track/release table must prioritize title, artist, ISRC, splits, expenses, status, action.
- Expenses/recoupments must stay linked to payee and category.

### Allocations

Goal: preview/post/unpost allocation batches safely.

Design notes:

- Never make `Run all pending` feel like an instant unrestricted action.
- Show safe wave pacing and server lock state.

### Suspense

Goal: resolve blockers by reason and exact fix path.

Design notes:

- Huge suspense counts should be grouped.
- Rows should expose exact action: catalog, split, mapping, retry, resolve.
- Avoid expecting line-by-line cleanup of all rows.

### Statements

Goal: generate artist/payee statement by period and currency.

Design notes:

- Financial summary first.
- Revenue, recoup, expenses, payments, total due.
- Multi-currency must stay separated.
- PDF must fit A4 and follow e-HQ identity.

### Payments

Goal: record, edit, void, and reconcile payments.

Design notes:

- Payment edit drawer must allow payee, amount, status, paid date, reference, and statement link edits.
- Reconciliation should show only actionable blockers.

### Revenue

Goal: financial view by payee, track, currency, store, period.

Design notes:

- Prioritize totals and filters.
- Avoid overlisting all transactions by default.

## 5. Implementation boundaries

Allowed in visual identity phase:

- CSS tokens.
- Layout CSS.
- Button labels.
- Component classes.
- Drawer structure polish.
- PDF CSS.
- Minor markup wrappers for layout only.

Not allowed unless explicitly requested:

- Financial calculation changes.
- Migration changes.
- Allocation algorithm changes.
- Payment persistence changes.
- Statement total formula changes.
- Database table changes.
- Bulk data cleanup.

## 6. Recommended implementation order

1. Add Distribution design tokens CSS.
2. Normalize buttons, inputs, cards, badges, tables.
3. Apply page shell polish to admin and frontend.
4. Apply drawer/floating-window polish.
5. Apply statement/PDF visual identity.
6. Review live page by page.
7. Rebuild `e-distribution.zip`.

## 7. Acceptance criteria

A Distribution visual identity release is acceptable when:

- All pages load fast.
- Admin and frontend have a consistent e-HQ look.
- Tables remain readable.
- No action points to the wrong place.
- Drawers are readable and action-oriented.
- Statement/PDF follows the same brand system.
- No financial engine behavior has changed.
