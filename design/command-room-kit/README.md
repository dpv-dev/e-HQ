# Command Room Kit

Design kit for the next visual layer of the ë • HQ app, derived from the attached
dark holographic command-room image and the generated design-board concept.

## Intent

Create a premium finance/admin interface language: black graphite rooms, cyan
holographic light, glass panels, reflective surfaces, a suspended orb motif, and
the existing ë accent yellow reserved for primary actions.

This folder is intentionally isolated from the production app. It can be used as
a source pack for a future Svelte implementation without changing current code.

## Contents

- `index.html` — complete design-system preview page.
- `styles/tokens.css` — CSS variables for color, type, spacing, radius, shadow,
  glass, and motion.
- `styles/components.css` — reusable HTML/CSS component classes.
- `tokens/tokens.json` — token export for Figma, Tokens Studio, or codegen.
- `templates/dashboard.html` — Office dashboard/page shell template.
- `templates/bank-workbench.html` — bank import/reconciliation template.
- `templates/kpi-graphs.html` — KPI wall with charts, gauges, bars, and trend
  cards.
- `templates/kpi-graph-variants.html` — variant catalogue for KPI and graph
  treatments.
- `templates/distribution.html` — Distribution contracts/royalties template.
- `templates/command-center.html` — Command Center diagnostics template.
- `svelte/` — typed Svelte component prototypes for KPI, graphs, panels, and
  shell primitives.
- `assets/backgrounds/` — vector backgrounds and orb motifs.
- `assets/icons/` — production-ready SVG icons using `currentColor`.
- `assets/reference/` — source image and generated concept board.

## Visual principles

1. Use black graphite as the page atmosphere, not flat black.
2. Use cyan as light, borders, states, and data glow.
3. Use `#FFB800` only for primary action, focus, active navigation, or key risk.
4. Keep panels translucent, but text must remain sharp and readable.
5. Prefer thin luminous geometry over heavy card grids.
6. Financial data stays code-native. Do not bake table text into images.
7. Motion should feel like calibration: slow reveal, scan, pulse, and hover lift.

## Recommended app mapping

- HQ landing: keep the current landing page unchanged. This kit does not replace
  its first screen or background.
- Office: use `dashboard.html` shell with cash/P&L panels and bank workbench.
- Distribution: reuse the same shell but swap table density and icon labels.
- Command Center: push contrast higher, show live diagnostics around the orb.
- KPI cockpit: use `kpi-graphs.html` for finance overview, P&L, runway, bank
  health, royalties, import status, and reconciliation quality.

## Implementation note

The tokens are namespaced as `--cr-*` so they can be tested without conflicting
with the existing `--ehq-*` production tokens. When integrating, map stable
values back into `packages/ui/tokens/visual-tokens.css` rather than hardcoding
component colors.
