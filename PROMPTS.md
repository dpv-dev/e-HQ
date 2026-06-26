# PROMPTS.md — ë • HQ

Single, consolidated prompt log for this project. **Append** each new prompt as
a numbered section below — never create separate prompt files. The agent already
has `AGENTS.md` (rules) and `CODEX_BUILDING.md` (playbook) in context.

> **Mise à jour de décision (UI copy) :** la copie de l'interface est désormais
> en **anglais** — cela remplace « UI copy is French » du Prompt 01 (et d'AGENTS.md)
> pour tout le travail UI (Prompts 04→12).

---

## Prompt 01 — Kickoff: discovery + kernel scaffold

You are working on **ë • HQ**. First, read `AGENTS.md` and `CODEX_BUILDING.md`
in full and treat them as binding. Do **not** deploy, run destructive
operations, or mutate any existing database or any files outside the new
monorepo workspace. Connect to nothing in write mode.

**Objective:** create a clean new monorepo at `ehq-platform/` (lowercase ASCII,
no spaces/symbols — do not build inside any existing `ë • …` folder), stand up
its skeleton, and produce a written build plan for the first milestone —
extracting the **eHQ Financial Kernel** (`packages/domain-finance`) — wired
*conceptually* to the existing database through `services/api`. Stop for my
approval before implementing any engine logic.

Do this, in order:

1. **Confirm the ground truth.** Report: repo root, package manager + version,
   Node version, the location of the existing `e-royalties` code, and the
   existing DB target (identify it read-only — do **not** connect or write).
   List the legacy REST surfaces you can see: Office `eof/v1`, Distribution
   `erh/v1`.
2. **Read-only inventory.** Summarize the existing data model relevant to the
   kernel — the legacy tables behind ledger / transactions / contracts / splits
   / recoupments — and confirm the three adapter mappings from
   `CODEX_BUILDING.md`: `cost_terms`→Expense, `categories`→Department/Division/
   Category, `transactions`→Ledger Transaction. Flag anything ambiguous. Do
   **not** guess money semantics — list open questions instead.
3. **Scaffold only — no business logic.** Inside `ehq-platform/`, create the
   pnpm workspace and the `apps/ services/ packages/` structure from
   `AGENTS.md` §3 — `apps/` holds `hq`, `office`, `distribution`,
   `command-center`; scope packages under `@ehq/*`. TS-strict config, empty
   typed stubs. Add the **signatures** for the shared money utilities (integer
   micro-units; basis points for shares) and Zod schema placeholders, but leave
   every implementation as `TODO`.
4. **Write `PLAN.md`** for the kernel milestone: the modules inside
   `domain-finance`, the test list (integer invariants, largest-remainder
   allocation, allocation completeness, atomic reconciliation), and a smoke-test
   outline mirroring the one that passed for `e-royalties`.
5. **Stop and present:** the ground-truth report, the read-only inventory + open
   questions, the scaffold tree, and `PLAN.md`. Wait for my explicit go before
   writing any engine logic or touching data.

**Constraints you must confirm you've read before starting** (from `AGENTS.md`):
money is integer micro-units, never floats; shares in basis points; one owner
per fact; no app or frontend touches legacy tables directly; corrections are
audited override records, never in-place mutation; per-project skills/MCP only —
no enterprise context leak. *(UI copy: see the English update note at the top.)*

**Deliverable:** the scaffolded workspace + `PLAN.md`. No deployment, no DB
writes, no engine implementation yet.

---

## Prompt 02 — Kernel: money + allocation *(exécuté en direct)*

`domain-finance` : montants en **micro-unités entières** (6 dp), parts en
**basis points**, allocation par **plus-fort-reste** avec invariant de
conservation (somme exacte, zéro perte). Tests d'invariants entiers + smoke test
end-to-end **passés**.

---

## Prompt 03 — Recoupments + statements *(exécuté en direct)*

Recoupements / avances, dépenses par contrat, génération de relevés (résumé
financier d'abord, multi-devises gardées séparées). Validé en direct.

---

## Prompt 04 — Design system integration

Integrate `packages/ui` as the design system. Expose an entry point that makes
`tokens/visual-tokens.css` the global CSS import target, re-export `tokens.ts`,
and provide the `.ehq-*` classes. Wire each app (`hq`, `command-center`,
`office`, `distribution`) to consume these tokens rather than hardcoded colors.
Implement the `apps/hq` landing in Svelte from
`packages/ui/reference/hq-landing.html`: workspace cards by area, permission
routing through `packages/auth`, locked card = red cross plus
`Request access`. No hardcoded hex in app/component code.

> Règles dures pour tout l'UI (04→12) : aucun hex en dur (uniquement `--ehq-*`),
> accent `#FFB800`, **texte blanc**, **Inter + Space Mono**, fond `#050505`.
> Porte-d'entrée (landing/login) = **plein écran sans scroll** ; apps = shell
> avec **scroll interne**. Ne jamais toucher au moteur financier / allocations /
> migrations / DB / paiements / formules de relevés. Un écran = un commit ;
> `PAGES_PLAN.md` coché au fur et à mesure.

---

## Prompt 05 — UI: Svelte 5 component library (`@ehq/ui`)

Build the reusable primitives from `packages/ui/components/component-guidelines.md`
and the patterns in `packages/ui/reference/app.html` — all in `--ehq-*`, zero
hex: Button (primary/secondary/danger, mono uppercase label), Input, Select,
Card, KPI, Table (sort, status cell, action cell), Toolbar (filters), Panel,
Badge (ok/info/warn/err/active), Drawer, **yellow Loader**, and mini-charts
(bars / line / diverge / donut). Handle empty / loading / error / **locked (red
cross)** states and visible keyboard focus. Export from `@ehq/ui`. Plan, apply.

---

-

---

## Prompt 07 — UI: shared app shell + auth gate + workspace routing

Reference: `packages/ui/reference/app.html`.
- **Each app shows only its own menu**; a **workspace switcher** (Command Center
  · Office · Distribution) moves between the apps the user can access; the
  **Command Center menu never appears** inside Office/Distribution.
- An app the user cannot access shows **locked (red cross)**, never hidden.
- Topbar: breadcrumb, ⌘K search, bell, user. **Internal scroll**, never
  horizontal. Wire `packages/auth` as the access gate. Plan, apply.

---

## Prompt 08 — UI: Design System page (living reference)

A `/design` route (standalone or inside Command Center) rendering **every token
+ every Prompt 05 component in every state** (ref. screen `06 - Design System`).
Serves as visual QA + onboarding. Plan, apply.

---

## Prompt 09 — HQ: login + refresh landing

Reference: `packages/ui/reference/hq-login.html` and `hq-landing.html`.
- Build the **login** (split: command-center scene + form, email/password, **ë
  SSO**, forgot password) → on success, route to the workspaces the user can
  access.
- **Refresh** the `apps/hq` landing built in Prompt 04 to the latest reference:
  full-screen `100dvh` **no scroll**, responsive (mobile compact), real-photo
  cards with hover brighten, locked card red cross, English copy. Plan, apply.

---

## Prompt 10 — Office (`apps/office`) — all pages, via the `eof/v1` client

Reference: the Office views in `packages/ui/reference/app.html`. One commit per
page, in order: P&L (diverging bars by department, reads **validated
projections**), Chart of accounts (Department→Division→Category CRUD),
Transactions (filter by every dimension), Imports (bank MCB/SBI/CSV, cashflow,
PDF — `preview`→`confirm`), Reconciliation (match bank↔ledger, approve in
batch), Pending (classify + bulk-validate), Cash flow. **No financial logic in
the UI**; never call `maintenance/*`. App menu only (no Command Center). Plan,
apply page by page.

---

## Prompt 11 — Distribution (`apps/distribution`) — all pages, via `erh/v1`

References: the Distribution views in `app.html` +
`packages/ui/reference/DISTRIBUTION_VISUAL_IDENTITY_IMPLEMENTATION.md`. One
commit per page: Dashboard, Imports, Mapping, Catalog, Contracts
(splits/expenses), Allocations (**preview/post/unpost via cadenced runs +
lock**), Suspense (grouped by reason → exact fix path), Statements (**financial
summary first**) + PDF (A4, print-first), Payments (record/edit/void/reconcile),
Revenue. Allocations **only** via cadenced run + lock. App menu only. Plan,
apply page by page.

---

## Prompt 12 — Command Center (`apps/command-center`)

Reference: the Command Center views in `app.html`. Dashboard (KPIs, readiness,
health, action list), **Users & permissions** (allowed/denied per app → drives
HQ's locked cards), Integrations (WordPress / MCP / bank connector status),
Settings. Admin/supervision app, **its own workspace** (its menu never appears
elsewhere). Wire `packages/auth`. Plan, apply.

---

### Definition of Done (every screen)
Faithful to the mockup · 100% `--ehq-*` (zero hex) · Inter + Space Mono · white
text · responsive · empty/loading/error/**locked (red cross)** states · visible
keyboard focus · `prefers-reduced-motion` · no regression of the financial engine.

---

## Prompt 18 — Autonomous finishing run: wire all apps to live eof/v1 / erh/v1

OPERATING MODE — autonomous. Goal: FINISH the site = wire the four apps (hq, command-center,
office, distribution) to the REAL eof/v1 / erh/v1, remove preview-data, add real auth and
loading/error/empty states — WITHOUT regressing any invariant. Run the whole plan without
pausing for approval between steps. Self-validate after each unit. Only STOP at a genuine
blocker: log it, skip that unit, keep going with everything else you can do, and report at
the end. Go as far as possible.

PREREQ: API base URL + token are in env. If absent → stop, report "needs API credentials",
do nothing destructive.

PHASE 0 — Lock the contract (yourself). Hit the key READ routes and capture real response
shapes — eof/v1: transactions, pl/global, pl/department/{id}, pl/project/{id},
pl/partner/{id}, partners, projects, departments/divisions/categories, reference-taxonomy,
integrity/check-all, analytics/bank-quality, dashboard, bank/accounts, audit-log — erh/v1:
dashboard, allocations, statements, payments, payees, artists, releases, tracks, labels,
contracts. Reconcile each against the typed DTOs in @ehq/api-client; where live differs, FIX
THE DTO to match reality (live API is source of truth) while preserving the canonical model
(category is the single source of department/division/type; money = integer micro-units;
shares = basis points). Record every DTO change. Unreachable/forbidden/401 route → log as
blocked, do not fake, continue.

PHASE 1 — Real auth. Replace @ehq/auth preview sessions with the real flow (login → token →
authenticated requests, expiry/refresh, workspace-permission profile from the real session).
Keep the 3-layer access model (landing card / in-shell / route guard). No secrets in client.

PHASE 2 — Read paths (read-only first), replace preview-data with live @ehq/api-client calls,
per page: Office (P&L, Transactions, Chart of accounts, Clients, Suppliers, Projects,
Monitoring, Cash-flow), Distribution (dashboard, statements, allocations view, artists /
releases / tracks / labels / contracts), Command Center (dashboard, users & permissions read),
HQ (landing/workspace from real session). Add loading skeleton + error state + empty state to
EVERY async view.

PHASE 3 — Safe write paths only, each behind an explicit user action + confirmation, with the
specced idempotency keys: transaction create/validate/classify/category, allocations PREVIEW
(read), reconciliation propose+validate, import preview→confirm (Office bank/cashflow;
Distribution Kontor/RouteNote), pending classify + bulk validate.

NEVER TOUCH (refuse the unit, log it, continue): financial engine / allocation math / money
mutation, DB migrations or schema, eof maintenance/*, hard-delete / reset, payment EXECUTION
or transfers (payments are records only), commits, deployment.

PRESERVE (do not regress while wiring): canonical dimensional model; brand tokens (#050505 bg,
#FFFFFF text, #FFB800 yellow as rare signal — one primary CTA per view); the shared text-role
system (Inter for reading, Space Mono for micro-labels only, no font-weight 700 on data, muted
panel-title heading role); the ehq-edge-surface treatment everywhere incl. sidebar nav;
de-yellowed badges; English UI.

SELF-VALIDATION GATE after every unit: all @ehq/* checks for touched packages, root tsc -b,
builds, and the scans (hardcoded hex, destructive/maintenance routes, ad-hoc font-weight:700 /
font-family mono outside @ehq/ui). Plus a browser pass: loading/error/empty states present,
invariants intact, console clean, no horizontal overflow desktop/390px. Gate fails → fix and
re-run before moving on.

STOP/CHECKPOINT (log + continue, never block the whole run): missing creds or unreachable
route; a live shape that contradicts the canonical model and needs a business decision (leave
that view on a clearly-marked fallback); anything requiring a forbidden zone; any irreversible
action (mark "needs human").

END-OF-RUN REPORT: done / partial / blocked (each blocker with the exact reason and what you
need from David) + the full list of DTO changes. No commits. Structure the work so a re-run
resumes from this report.

Write REAL working code in the ë • Entreprise scaffold (the operator front). Do NOT paste, append, or write this prompt text into any file. Make only the front-end changes described below. All changes are display/navigation only — do NOT modify the API, do NOT change data fetching or filters, do NOT touch auth/Supabase/hooks, do NOT re-enable writes, and keep the preview banner and every disabled write/Generate button exactly as they are.

GLOBAL CONSTRAINTS (apply to every task):
- Front-only. Do not edit anything outside this scaffold. Do not modify src/lib/api/client.ts period/default logic, src/hooks.server.ts, src/lib/server/auth.ts, or any persistence/API code.
- Use only existing CSS custom properties from src/lib/styles/visual-tokens.css (the --ehq-* tokens). Do not introduce any new hardcoded hex/rgb colors.
- Desktop and tablet layout must remain visually unchanged. Mobile changes must not alter desktop/tablet rendering.
- npm run build must stay green and build/index.cjs must be produced.

TASK 1 — Mobile sidebar drawer (fix clipped labels at narrow widths)
Problem: at narrow viewports (~390px) the sidebar labels are clipped to single letters ("U.", "I.").
Implement: below a mobile breakpoint (~640px max-width), the left sidebar (src/lib/components/Sidebar.svelte) becomes a slide-in drawer instead of a fixed rail:
- Add a hamburger/menu toggle button in src/lib/components/Topbar.svelte, visible ONLY at the mobile breakpoint.
- The drawer slides in from the left over a semi-transparent backdrop, shows the FULL navigation labels (no clipping), and closes when: the backdrop is clicked, a nav link is selected, or Escape is pressed.
- Above the breakpoint, the sidebar and Topbar render exactly as today — no hamburger, no drawer, no layout shift.
- Manage open/closed state locally. Give the toggle button and drawer accessible attributes (aria-label, aria-expanded).
If converting to a drawer would require risky restructuring of the console layout, the acceptable fallback is: at the mobile breakpoint collapse the sidebar to an icon-only rail where each item keeps a title and aria-label with its full label (nothing clipped, labels stay accessible). Prefer the drawer.

TASK 2 — Gate the /components showcase route out of production
Problem: src/routes/components/+page.svelte (the component gallery) is publicly reachable in the deployed build.
Implement: add src/routes/components/+page.server.js that reads an env flag via $env/dynamic/private and throws error(404, 'Not found') unless the flag is enabled:
- Reachable only when ENABLE_COMPONENT_GALLERY === 'true'.
- Flag absent (default) → the route returns 404 in production.
- Do not change the gallery page content itself.

TASK 3 — Remove the hardcoded artist/83 link (derive from live data, or drop it)
Problem: the Revenue screen (src/routes/console/revenue/+page.svelte) and the Audit log (src/routes/console/audit-log/+page.svelte) link to /console/artist/83, a stale hardcoded id that resolves to "Payee not found".
Implement: search the whole src/ tree for any hardcoded 83 payee/artist id and any /console/artist/83 (or artist/83) link, and:
- Replace each with a link whose id is derived from the data the page already loads (the payee/artist id on that specific row or record). Per-row links point to that row's real id.
- If a hardcoded link has no natural per-row data source on its page (e.g. a standalone "view artist" demo button), REMOVE that link rather than point it at any id.
- Do NOT add new API parameters or fetch extra data to obtain an id — use only ids already present in the loaded data. The src/routes/console/artist/[id]/+page.svelte page stays as-is (it already renders by id).

TASK 4 — Make the global search box honest and functional (section navigator)
Problem: the global search input (in src/lib/components/Topbar.svelte) is not wired and does nothing.
Implement: turn it into a client-side section navigator over the known console destinations (no backend, no record search):
- As the user types, filter a static list of the real console sections (the existing left-nav destinations) by label.
- Show matches in a dropdown; pressing Enter or clicking a match navigates to that route via SvelteKit goto. Escape/blur closes the dropdown.
- The placeholder must communicate that this is navigation, not record search (e.g. "Jump to section…"). Do not fabricate or display any record/data results.

VERIFICATION (report back):
- npm run build green; build/index.cjs present.
- At ~390px: sidebar no longer clips labels (drawer with full labels, or icon-rail with accessible titles). At desktop width: layout unchanged.
- /components returns 404 in a production build with the flag unset; still reachable in dev when ENABLE_COMPONENT_GALLERY=true.
- No remaining /console/artist/83 (or hardcoded 83 id) in src/; Revenue/Audit links resolve to a real payee or were removed.
- The search box filters sections and navigates on Enter/click; no fake record results; preview banner and disabled write buttons unchanged.
- Browser console clean (no errors/warnings).