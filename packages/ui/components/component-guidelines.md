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
Official font direction: Open Sans.

Font files included for Distribution UI:

- Fönt/Fönt-Regular.otf
- Fönt/Fönt-Regular.ttf
- Open Sans/open-sans.regular.ttf
- Open Sans/open-sans.semibold.ttf
- Open Sans/open-sans.bold.ttf

Active usage:

- Open Sans for Distribution UI readability.
- Open Sans for brand accents and short identity labels.
- Fönt remains bundled as an inactive legacy/fallback font.

Fallback stack:

```css
font-family: "Open Sans", "Fönt", "Aeonik", "Inter", "Helvetica Neue", Arial, sans-serif;
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
