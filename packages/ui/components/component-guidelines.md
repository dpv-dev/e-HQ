# e-HQ Component Guidelines

## Source
Validated visual source: `00 - Visual Identity.png`.

## Scope
These assets apply the e-HQ identity as a UI/CSS layer over the existing WordPress theme and Distribution plugin.

Do not modify:
- financial engine
- calculations
- allocations
- payments
- statements formulas
- migrations
- database schema
- import normalization
- mapping engine

## Typography
Active font direction: Inter for body/display and Space Mono for technical
labels. Legacy fonts remain archived only.

Use the token variables from `packages/ui/tokens/visual-tokens.css`:

```css
font-family: var(--ehq-font);
font-family: var(--ehq-display);
font-family: var(--ehq-mono);
```

## Yellow usage
Use yellow for:
- primary action
- active navigation
- focus ring
- selected state
- high priority warning/fix-needed state
- subtle charts primary series

Do not use yellow for every decorative surface.

## Buttons
Primary: yellow background, dark text.  
Secondary: dark transparent, subtle border.  
Danger: red surface/border only for destructive actions.  
Use exact labels: `Resolve item`, `Generate PDF`, `Post payment`, `Retry import`.

## Inputs / Selects / Search
Dark surfaces, muted placeholders, yellow focus ring.
Filters should be grouped into one toolbar.

## Cards / KPI
Dark graphite surface, subtle border, strong value hierarchy, muted labels.
Multiple currencies should stack vertically, not comma-cram.

## Tables
Compact, readable, tabular numeric alignment, sticky header where useful.
Avoid WordPress admin `widefat`, `wp-list-table`, `button-primary` appearance.

## Badges / Status
Success: green.  
Info: blue.  
Warning/Fix: yellow/orange.  
Error/Blocked: red.  
Active/Current: yellow.

## Drawers / Floating windows
Dark command panels:
- sticky header
- item name
- status
- context summary
- sticky footer with exact actions

## Loaders
Minimal, yellow accent, never blocking background processes unnecessarily.

## Charts
Dark cards, yellow primary series, muted secondary series, semantic colors only when status-based.

## PDF Statements
PDF is print-first:
- white background
- yellow accent
- label/artist/payee/period
- revenue
- expenses/advances/recoup
- total due
