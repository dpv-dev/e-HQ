# Command Room Svelte Components

Prototype Svelte 5 components for the Command Room Kit. They are intentionally
kept in this design folder until the visual direction is approved.

## Components

- `CommandRoomKpi.svelte` — KPI variants: `compact`, `ledger`, `orbit`, `risk`.
- `CommandRoomGraph.svelte` — graph variants: `line`, `area`, `bars`, `gauge`,
  `funnel`, `donut`.
- `CommandRoomPanel.svelte` — reusable glass panel with typed action slot.
- `CommandRoomShell.svelte` — Office, Distribution, or Command Center shell.

## Usage Notes

Import `../styles/tokens.css` before using these prototypes, then map stable
values into `packages/ui/tokens/visual-tokens.css` only after approval. The
landing page is not part of this component set and should stay unchanged.
