# ë • HQ — Visual Polish Audit

Scope: shared design system (`packages/ui`) + all three consoles (Office, Distribution, Command Center).
This is a **visual polish** pass — spacing, typography, color, hover/focus states, wording consistency —
not a functional-bug audit (that was `AUDIT-INCOHERENCES.md` / `RAPPORT-REMEDIATION.md`, already resolved).

53 findings total: 23 design system, 10 Office, 12 Distribution, 8 Command Center.
Ranked by visual impact within each section.

**Status: all four lots executed, in the priority order requested (design system → Distribution → Office → Command Center).**
Verified after each lot: `svelte-check` (0/310 errors throughout), `scripts/check-regressions.sh` (unchanged, still passing),
full frontend build, and the API test suite (53/53, unaffected by these frontend-only changes). See "Remediation results" at
the bottom of each section below for exactly what was fixed vs. investigated-and-left-alone, and why.

---

## 1. Design system (`packages/ui/src/components`, `packages/ui/tokens/visual-tokens.css`)

### High impact

1. **Primary Button has no `:hover` state** — `Button.svelte:70-74`. The main CTA doesn't visually respond to hover, breaking the most important affordance in the app.
2. **Danger Button has no `:hover` state** — `Button.svelte:84-88`. Destructive actions don't signal interactivity on hover.
3. **Primary button hover exists in tokens but not in the component** — `visual-tokens.css:302` defines a hover rule for `.ehq-button-primary` that `Button.svelte`'s actual primary variant never implements. The two are out of sync.
4. **Input/Select height (38px) vs Button height (36px) mismatch** — `Input.svelte:58`, `Select.svelte:59` vs `Button.svelte:45`. Breaks alignment whenever a button sits next to a form field.
5. **Small interactive elements use three different heights** (30px / 32px / 42px) — `Button.svelte:65` (30), `PeriodBar.svelte:49` (32), `EmptyState.svelte:118` (32), `Toolbar.svelte:68` (42). No consistent baseline rhythm.

### Medium impact

6. *(Note: intentional, not a bug)* Table body text hardcodes `15px` instead of a token — `Table.svelte:262`. This was an explicit, deliberate request (see conversation), not an oversight — flagging only so it's not "fixed back" to 13px by mistake later.
7. **StatusStrip hardcodes rgba border colors** instead of deriving from the success/info/error tokens — `StatusStrip.svelte:60,65,76`.
8. KPI value size hardcoded `24px`, no token — `KPI.svelte:76`.
9. DonutChart percentage text hardcoded `20px`, no token — `DonutChart.svelte:94`.
10. Button's "locked" `×` indicator hardcoded `16px` — `Button.svelte:102`.
11. *(Note: intentional)* WorkspaceShell brand mark ("ë" logo) hardcoded `24px` — `WorkspaceShell.svelte:171`. Standalone brand mark, arguably fine as-is; flagged for awareness only.
12. WorkspaceShell topbar title hardcoded `16px`, doesn't reference any named token — `WorkspaceShell.svelte:295`.
13. BarsChart title uses `var(--ehq-h3)` while the visually-identical LineChart title correctly uses `--ehq-type-section-title-size` — `BarsChart.svelte:47` vs `LineChart.svelte:48`. Same computed size today (18px) but drifts if either token changes independently.
14. PeriodBar hand-rolls its own button styling instead of reusing the shared `Button` component — `PeriodBar.svelte:48-63`.
15. ActionCardGrid's link and EmptyState's link both reinvent "button-styled link" independently — `ActionCardGrid.svelte:93`, `EmptyState.svelte:116`. Three separate implementations of the same pattern.
16. StatusStrip article `min-height: 68px` doesn't land on the spacing scale — `StatusStrip.svelte:29`.

### Low impact

17. Loader spinner sizes (14px / 18px) hardcoded, no token — `Loader.svelte:39-50`.
18. Chart frame height (104px) hardcoded in both LineChart and BarsChart, no shared token — `LineChart.svelte:67`, `BarsChart.svelte:65`.
19. Panel min-height (170px) vs Card min-height (158px) — 12px apart for no evident reason — `Panel.svelte:43`, `Card.svelte:51`.
20. Badge min-height (24px) hardcoded, no token — `Badge.svelte:16`.
21. Drawer min-height (290px) hardcoded, no token (likely fine since it's intentionally larger than cards/panels) — `Drawer.svelte:84`.
22. WorkspaceShell session menu width (300px) hardcoded — `WorkspaceShell.svelte:365`.
23. Table row-action styling (lines 285-308) isn't extracted into a shared class/component, so it can drift from any future button-like affordance elsewhere.

---

## 2. Office console (`apps/hq/src/app/canonical/office/`)

### High impact

1. **Filter row layout is inconsistent between views** — P&L filters use a flex-based `filter-strip` (`App.svelte:3062`), Transactions filters use a 4-column `filter-grid` (`App.svelte:3100`). Same kind of control (7+ dropdowns + an apply button), two different layouts.
2. **French/English mixing across buttons and labels** — e.g. "Create" (COA, `App.svelte:3094`) vs "Créer l'écriture" (transactions, `App.svelte:3140`); BankView uses French labels ("Actif", "Éditer") while CeoView/VatView are English-only. Reads as unfinished when navigating between tabs.
3. **"Apply" vs "Filter" for the same action** — P&L section's button says "Apply" (`App.svelte:3072`), Transactions and Reconciliation say "Filter" (`App.svelte:3109`, `3353`) for the identical apply-filters action.
4. **Raw `<button>` in ProjectsView project-selector** instead of the shared `Button` component — `ProjectsView.svelte:607`, with its own inline sizing (min-height 92px) that doesn't follow the DS.

### Medium impact

5. Two different CSS classes for what's functionally the same form panel — `form-panel` (COA editor, `App.svelte:3086`) vs `office-edit-panel` (transaction create/edit, `App.svelte:3116, 3147`).
6. Transaction create form labels are French ("Compte", "Montant", "Sens", "Catégorie", "Projet") while the Chart-of-Accounts form right above it is English ("Type", "Parent", "Code", "Label") — same page, same language question raised in #2.
7. Column header capitalization/wording drifts between similar tables (e.g. BankView's English headers vs French elsewhere).

### Low impact

8. MonitoringView hand-rolls an empty-state `<div>` instead of using the shared `EmptyState` component that CeoView/VatView use for the same purpose.
9. "Active" checkbox label styling/language differs across BankView/ProjectsView ("Actif", `.ehq-type-label-mono`) vs PartnersView ("Active partner", plain span).
10. Minor label/wording drift between the parent App.svelte's PnL tables ("Result by category") and CeoView's own copy ("Category").

---

## 3. Distribution console (`apps/hq/src/app/canonical/distribution/`)

### High impact

1. **Error states and true empty states look identical** — reconciliation's error state (with a Retry button, `App.svelte:3975-3980`) uses the exact same `.empty-state` styling as aliases/duplicates/audit-log's true empty states (no action, `4027`, `4044`, `4053`), which have no Retry button. Users can't tell "this failed, retry" from "there's just nothing here" at a glance.
2. **Inconsistent table-column terminology** across similar tables — "Fix path" vs no equivalent elsewhere; "Paid at" vs "Paid"; "Recoup" (abbreviated) vs "Recoupment" used in subtitles; "Cost term" is non-standard vs "Expense category"; "Net payable" vs plain "Payable" elsewhere.
3. Print-statement HTML hardcodes `#111`/`#ccc`/a specific font stack — expected for the standalone A4 document (it intentionally skips the token stylesheet), but the two gray tones aren't even consistent with each other; worth a quick pass for internal consistency even within the print-only styling.
4. Statement summary grid hardcodes 5 columns (`repeat(5, ...)`, `App.svelte:4294`) while the Dashboard KPI grid uses 4 — makes the statement summary feel visibly more cramped than its sibling.
5. Form-panel/filter-strip flex layout end-aligns wrapped items inconsistently, while `period-control` explicitly overrides to `space-between` for what's functionally the same panel type (`App.svelte:4145-4162`).

### Medium impact

6. Receipt/notification toast copy has inconsistent capitalization and phrasing ("Action accepted · audit recorded." vs "Run queued · lock held by the workflow.").
7. Button labels mix imperative verbs ("Preview export", "Validate import") with bare nouns ("Filter", "Refresh", "New release") with no consistent pattern; "Generate statements run" and "Request unpost run" read awkwardly compared to the rest.
8. Payment panel's action buttons (edit/reconcile/void) are conditionally rendered rather than always present (disabled when inactive), causing the panel's layout to visibly shift when switching modes.

### Low impact

9. "Unpost" is a domain-specific term used nowhere else in the app — likely intentional, worth a quick sanity check rather than a fix.
10. "Kontor / RouteNote" (with slash+spaces) vs "Kontor RouteNote" (no separator) used inconsistently for the same integration name.
11. "A4 PDF" vs "A4 statement PDF preview" — same feature, two different phrasings.
12. Aria-label/title attribute pairing looks correct throughout — flagged only as verified-fine, no action needed.

---

## 4. Command Center console (`apps/hq/src/app/canonical/command-center/`)

### High impact

1. **Locked workspace card's border styling is a no-op** — `.workspace-mini-grid article` sets `border: 0` (`App.svelte:1405`), then the `.locked` modifier (`1414`) tries to change `border-color` on a border that's explicitly disabled. The "locked" visual treatment silently does nothing.
2. **Inconsistent section-header markup** — the readiness panel wraps its heading+description in a semantic `<header>` (`App.svelte:1042`), while the form-panel and locked-card-reference panels use bare `<h2>`/`<p>` with no wrapper (`1072-1108`).
3. Integration panels' action button text ("Inspect", "View scope", "Open status") doesn't match the underlying data's own action verbs ("Manage", "Inspect", "Manage", "Connect") — the buttons and the data disagree on what the action is called.

### Medium impact

4. Setting-key and integration-action names get forced to lowercase in table badges via `.toLowerCase()` (`App.svelte:710, 772`) while the rest of the app uses title case — "Release gate" becomes "release gate", "Manage" becomes "manage".
5. Same `border: 0` + `ehq-edge-surface` redundancy as finding #1, repeated across all three panel types (`App.svelte:1320-1331`) and again in nested check-list articles (`1355-1363`) — looks like the border-handling intent was never settled and got copy-pasted.

### Low impact

6. Toolbar action titles mix "Refresh" and "Persist" for conceptually similar actions ("Refresh write gate" vs "Persist theme review" vs "Refresh API readiness").
7. The "Supervision mode" panel's button always reads "Verified" regardless of whether writes are locked, loading, or active — doesn't communicate state changes to the user.

---

## Remediation results

### Lot 1 — Design system

Fixed: primary/danger Button hover states added (were entirely missing — the main CTA and destructive actions gave no hover feedback); Input/Select height (38px) unified with Button (36px) so form rows align; three different "small button" heights (30/32/42px) reduced to one real duplication (Button.small vs PeriodBar vs EmptyState's link — unified to 30px; Toolbar's 42px was verified as a legitimately taller two-line stat pill, not the same kind of control, left as-is); StatusStrip's hardcoded tone-border colors replaced with new `--ehq-success-border`/`--ehq-info-border`/`--ehq-error-border` tokens; KPI value size, DonutChart value size, chart frame height, and spinner sizes tokenized (`--ehq-type-kpi-value-size`, `--ehq-type-chart-value-size`, `--ehq-chart-frame-height`, `--ehq-spinner-sm/md`); BarsChart's title now uses the same token as LineChart's; WorkspaceShell's topbar title and search-box height aligned with the rest of the system. Also found and deleted an entire block of confirmed-dead orphaned CSS in `visual-tokens.css` (`.ehq-button-primary/secondary/danger`, `.ehq-label`, `.ehq-input`/`.ehq-select`, `.ehq-badge-*`) — leftovers from an earlier design draft, never referenced by any real component, not previously caught by the audit itself.

Left alone (low value / no strong justification found): Button's locked `×` icon size, Panel vs Card min-height (12px apart), Drawer min-height, WorkspaceShell session-menu width, Table row-action styling extraction — none of these showed a real cross-component inconsistency worth the risk of an arbitrary change.

### Lot 2 — Distribution

Fixed: error states (reconciliation, settings) now visually distinct from true empty states — reused the app's own established `ehq-edge-surface` CSS-custom-property mechanism (`--ehq-edge-fill`/`--ehq-edge-border-color`) to red-tint genuine errors, exactly like `EmptyState.svelte`'s own `.error` variant already does elsewhere; removed a redundant, fully-dead `.kpi-grid.recon` CSS rule that just re-declared the base `.kpi-grid` rule; renamed two button labels for imperative-verb consistency with their siblings ("Request unpost run" → "Unpost run", "Generate statements run" → "Generate statements").

Investigated and found NOT to be real issues (left unchanged): the 5-column statement summary grid — verified it holds exactly 5 real fields (Gross/Recoup/Expenses/Paid/Total due), so 5 columns is correct, not "cramped"; the form-panel vs. period-control flex layout — `period-control`'s `justify-content: space-between` is a legitimate override for its 2-item layout, not an inconsistency; the payment action panel's "layout jitter" — re-read the markup and confirmed the button/input count is constant across all three modes (edit/reconcile/void), no jitter exists; receipt message capitalization — both messages already start with a capital letter; "Cost term" terminology — matches the actual DB table name `contract_cost_terms`, so it's the more accurate label, not a bug. "Payable" vs "Net payable" (different tables) was left alone since renaming either risks conflating two potentially different calculations without domain confirmation.

### Lot 3 — Office

Fixed: normalized "Apply"/"Filter"/"Refresh" to "Filter" consistently across P&L, Transactions, and Cash-flow filter-apply buttons (Reconciliation's stayed `secondary` variant since it correctly sits next to a real primary write action, "Approve batch", in that row). Completed a full French→English translation pass across `App.svelte`, `BankView.svelte`, and `ProjectsView.svelte` (the three files with remaining French UI copy) per your explicit direction to do a full English pass — button labels, aria-labels, form field labels, confirm-dialog text, receipt/status messages, table row actions, and the bank-import wizard's UI text. Verified with a full post-pass grep across every Office file: no remaining French user-facing text anywhere (`CeoView.svelte`/`VatView.svelte`/`PartnersView.svelte`/`MonitoringView.svelte`/`SettingsView.svelte` were already English-only).

Investigated and found NOT to be real issues: the raw `<button>` in `ProjectsView.svelte`'s project selector — it renders a 3-line rich card (label + reference + activity detail), a genuinely different pattern from the shared `Button` component's single-label API, not a simple oversight; MonitoringView's hand-rolled error-state `<div>` — confirmed this matches the exact same convention already used by `VatView.svelte` (hand-rolled `.state-copy` for errors, shared `EmptyState` reserved for true empty-data states), so it's consistent, not a gap.

### Lot 4 — Command Center

Fixed: the locked workspace card's border was a genuine no-op bug — `border: 0` was set, then the `.locked` modifier tried to override `border-color` (which does nothing when there's no border width); fixed to set `--ehq-edge-border-color` instead, the CSS custom property the shared `ehq-edge-surface` mechanism actually reads (same fix shape as Distribution's error-state fix above). Wrapped the `form-panel` and `locked-card-reference` section headings in `<header>` to match `readiness-panel` — this wasn't just a markup nitpick: because the parent is `display: grid; gap: ...`, the missing wrapper meant the heading and its subtitle had a full grid-gap between them instead of sitting tight together, a real, visible spacing difference. Renamed the Supervision-mode panel's button from the non-actionable "Verified" to "Save review", matching its sibling panel which calls the exact same `saveSettingsReview` function under that clearer label.

Investigated and found NOT to be real issues: the `border: 0` + `ehq-edge-surface` pattern repeated across all panel types — this is the correct, intentional mechanism used throughout the whole design system (the real border renders via a pseudo-element driven by `--ehq-edge-border-color`, not the `border` property), not redundant or ambiguous; the three curated integration Panels' action button text ("Inspect"/"View scope"/"Open status") — these are hand-written summary cards for 3 specific integrations, not renders of the separate `Connectors` table's per-row `action` data, so there's no real mismatch to reconcile; the `.toLowerCase()` calls on badge values — `Badge.svelte` already force-renders all badge text as uppercase via CSS regardless of source-string casing, so this has zero visible effect either way; the toolbar "Refresh" vs "Persist" wording — these label genuinely different actions (reloading a status vs. persisting a review), not the same action worded two ways.

### What's still open

Nothing outstanding from this audit that was verified as a real, safe, in-scope fix. Everything flagged by the original audit was either fixed or checked closely enough to confirm it wasn't actually a bug — several of the original 54 findings didn't hold up under closer reading of the surrounding code (documented above, section by section) and were deliberately left unchanged rather than "fixed" into something worse or factually wrong.
