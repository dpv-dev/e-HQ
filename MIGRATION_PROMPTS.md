# ë • WordPress-Exit — Codex Prompts (single file for this workstream)

All migration build prompts live in THIS file, appended in order (Phase A, B, C…).
Do not create separate prompt files. Companion spec: `WORDPRESS_EXIT_MIGRATION.md`.
Build executor: OpenAI Codex CLI. Each prompt is self-contained and ends with a QA gate.

---

## AUTO-MODE GUARDRAILS (apply to EVERY prompt below, including unattended runs)

These prompts are safe to run with Codex in **Auto** — but only with these settings and stops.

- **Sandbox:** run the Auto preset `--sandbox workspace-write --ask-for-approval on-request`.
  Keep network access OFF (`[sandbox_workspace_write].network_access = false`, the default). The
  sandbox then physically confines Codex to this repo + temp dirs AND blocks all network — so it
  cannot reach WordPress, MySQL, or Supabase even by mistake. Never use
  `--dangerously-bypass-approvals-and-sandbox` / `--yolo` / `danger-full-access` for this work.
- **No commit, no push.** Every prompt ends by reporting a diff for human review. Codex must not
  `git commit`, `git push`, or `git reset --hard`. (Optionally enforce with an execpolicy `.rules`
  file that blocks those commands.)
- **One phase per run; stop at the gate.** Each prompt is a single brick that ends at its QA gate
  with "report and stop". Review the diff — ESPECIALLY any money/allocation logic — before launching
  the next prompt. Auto removes the babysitting, not the review.
- **Data + cutover phases are NOT unattended.** B2 (ETL) and E (deploy / cut WP) need network/live
  access, so the sandbox forces an approval there anyway. Drive those yourself, with the dump you
  exported (no credentials to the agent).

---

## PROMPT A — The money layer (do this first; everything depends on it)

### Goal
Build ONE money kernel in `ehq-platform` that faithfully reproduces BOTH legacy PHP money
engines, so every downstream number can be parity-checked against WordPress. This phase ships
**primitives + tests only** — no allocation, P&L, or statement logic yet.

### Where it lives
Inspect the repo first. There is already a `domain-finance` package with money/basis-point
utilities. EXTEND that package (or add a `@ehq/money` module it re-exports) — do not fork a second
money implementation. The kernel must become the single money path for the future Hono backend.
Keep all existing `domain-finance` exports working (or update call sites in the same commit).

### The kernel (target behaviour)
Integer arithmetic on `bigint` minor units at a **configurable scale**, with an explicit
**rounding mode**. No `number` floats anywhere in the money path. Two presets:

- `eofMoney` → scale **2** (MUR cents), rounding **HALF_UP**.
- `erhMoney` → scale **10** (royalty precision), rounding **TRUNCATE** (toward zero).

Required functions (names indicative; match repo conventions):

- `parse(value: string, scale, mode): bigint` — decimal string → minor units, parsed as TEXT
  (never via `Number()`/`parseFloat`). Reject malformed input.
- `format(units: bigint, scale): string` — minor units → fixed-`scale` decimal string, sign
  preserved, no float.
- `add(a, b)`, `sub(a, b)` — exact integer add/sub on minor units at a shared scale.
- `roundRatioHalfUp(n: bigint, d: bigint): bigint` — `sign(n) * floor((|n| + floor(d/2)) / d)`,
  `d > 0`. (This is EOF_Money::round_ratio.)
- `mulByRatio(units, num, den, mode)` — `units * num / den`, rounded per `mode`.
- `applyDecimalFactor(units, factorStr, mode)` and `percentage(units, pctStr, mode)` — see eof
  semantics below.
- `mulScaled(a, b, scale, mode)` / `divScaled(a, b, scale, mode)` — full decimal mul/div at
  `scale` (this is how erh multiplies/divides; with `TRUNCATE` it equals bcmath).
- `splitRemainderLast(total, weightsBp): bigint[]` — floor each non-last line, **last line absorbs
  the remainder** so the sum equals `total` exactly. (This is what eof shared-cost expansion does.)
- `splitLargestRemainder(total, weights): bigint[]` — distribute leftover minor units to the
  largest fractional remainders; sum equals `total` exactly. (Our preferred method for the NEW
  engine; available but NOT used to reproduce eof — see parity note.)

### Exact legacy semantics to reproduce

**EOF_Money (scale 2, HALF_UP).** Source of truth.
- `to_cents(s)`: `bcmul(s,'100',4)`, then `+0.5` if `>= 0` else `-0.5`, then truncate to integer.
  ⇒ HALF_UP to cents, symmetric on sign. Inputs with >2 decimals are ROUNDED (not truncated).
- `from_cents(c)`: integer → 2dp string, sign preserved, no float.
- `add/subtract`: via `to_cents` then `from_cents`.
- `round_ratio(n, d)`: `sign * intdiv(|n| + intdiv(d,2), d)`, `d > 0`.
- `percentage_to_amount(amount, pct)`: parse `pct` to `(units, scale)` where `pct = units/scale`
  (e.g. `"33.33"` → `units=3333, scale=100`); result cents = `round_ratio(to_cents(amount) *
  units, scale * 100)`.
- `multiply_by_decimal(amount, factor)`: parse `factor` to `(units, scale)`; result cents =
  `round_ratio(to_cents(amount) * units, scale)`.
- Decimal parse: strip `,`; validate `^[+-]?\d+(\.\d+)?$`; max 12 fractional places.

**ERH_Money (scale 10, TRUNCATE).** Source of truth.
- Uses bcmath at scale 10 ⇒ **truncation toward zero**, NOT rounding. `mul = (a*b)/10^10` trunc,
  `div = (a*10^10)/b` trunc. `to_units` truncates any fraction beyond 10 places.
- `add/sub` are exact at scale 10.

> PARITY NOTE — the #1 trap: eof rounds **HALF_UP**, erh **truncates**. They are different on
> purpose. Preserve both exactly. Do not unify them to one rounding rule, and do not assume the
> `splitLargestRemainder` kernel reproduces eof's shared-cost split — eof uses `splitRemainderLast`.

### Parity vectors (must all pass — computed from the PHP)

**eof — `to_cents`:** `"0"`→0 · `"1.99"`→199 · `"-1.99"`→-199 · `"1.005"`→101 · `"1.004"`→100 ·
`"2.675"`→268 · `"-1.005"`→-101 · `"0.05"`→5
**eof — `from_cents`:** 0→`"0.00"` · 199→`"1.99"` · -199→`"-1.99"` · 5→`"0.05"` · -5→`"-0.05"`
**eof — `round_ratio`:** (5,2)→3 · (7,2)→4 · (4,2)→2 · (-5,2)→-3 · (1,3)→0 · (2,3)→1
**eof — `add/subtract`:** add`("1.99","0.02")`→`"2.01"` · subtract`("1.00","1.99")`→`"-0.99"`
**eof — `percentage_to_amount`:** `("100.00","33.33")`→`"33.33"` · `("10.00","33.33")`→`"3.33"`
**eof — `multiply_by_decimal`:** `("100.00","0.1")`→`"10.00"` · `("3.33","3")`→`"9.99"`

**erh (scale 10):** add`("1.5","1.5")`→`"3.0000000000"` · mul`("1.5","1.5")`→`"2.2500000000"` ·
div`("1","3")`→`"0.3333333333"` · div`("2","3")`→`"0.6666666666"` · div`("1","7")`→`"0.1428571428"` ·
to_units/format`("1.12345678901234")`→`"1.1234567890"` (extra digits truncated) ·
mul`("0.0000000001","1")`→`"0.0000000001"`

**splits:** `splitRemainderLast(10000 cents, [3333bp, 3333bp, 3334bp])` → `[3333, 3333, 3334]`
(sum = 10000 exactly) · `splitRemainderLast(100 cents, [3333bp,3333bp,3334bp])` → first two floor,
last absorbs ⇒ sum = 100 exactly · `splitLargestRemainder(100, [1,1,1])` → `[34,33,33]` or the
deterministic largest-remainder order (sum = 100).

### Guardrails
- No `number` float in any money function. `bigint` + string only.
- Do not touch WordPress, MySQL, or any live system. This is pure local code + tests.
- No new dependencies beyond what `domain-finance` already uses, unless justified in the commit msg.

### QA gate (all must pass before this prompt is "done")
1. `pnpm --filter domain-finance test` (or the repo's test command) — the full parity vector
   suite above is green, including the eof HALF_UP and erh TRUNCATE cases and the split invariants.
2. `pnpm -r build` and `pnpm -r typecheck` (or repo equivalents) pass; no existing `domain-finance`
   consumer is broken.
3. A repo scan shows no `parseFloat`/`Number(`/`* 1.0` style float math inside the money module.
4. Print a short summary: files changed, test count, and any call sites updated.

Do not commit. Report the diff summary and the QA output for review.

---

## PROMPT B1 — Clean target schema (office / eof finance core)

### Goal
Define the **clean Postgres schema** (Drizzle) for the new backend's finance core, encoding the
dimensional fixes from the audit. This phase is **schema + generated types only** — NO data, NO ETL,
NO live access. The ETL (Prompt B2) maps the old MySQL data onto this schema later.

> SCOPE: this prompt covers the **office (eof) finance** tables only. The distribution (erh)
> royalty schema is a separate later prompt. Money columns must match the Prompt A kernel
> (`@ehq/domain-finance`): integer minor units, never `DECIMAL`/float at the app layer.

### Where it lives
Inspect the repo. Put the Drizzle schema in the backend/data package the Hono service will use
(e.g. a `@ehq/db` or `packages/api/src/schema` — follow existing conventions; if none exists yet,
create the package and wire `drizzle-kit` config). Generate and export the inferred TS types so the
future read engines (Prompt C) import them. Do not connect to any database; `drizzle-kit generate`
(migration SQL emission) is fine, `push`/`migrate` against a live DB is NOT.

### The model (one source of truth per dimension)
Hierarchy: **Department → Division → Category**, category is the single source of a transaction's
division+department. Allocations are at **department grain** (where money lands).

Tables (Postgres / Drizzle):

- **departments** — `id` pk, `name`, `slug` unique, `type`, `color` null, `is_active` bool default
  true, `created_at`. **Top-level only — no `parent_id`.**
- **divisions** — `id` pk, `department_id` → departments NOT NULL, `name`, `slug`, `is_active`,
  `created_at`. UNIQUE(`department_id`,`slug`). **First-class; a division belongs to one department.**
- **categories** — `id` pk, `name`, `type` `'income'|'expense'`, `division_id` → divisions NOT NULL,
  `is_active`, `created_at`. **No `department_id` column** — department is derived via division.
- **partners** — `id` pk, `name`, `type` default `'client'`, `email`/`phone`/`address`/`tax_id`/
  `notes` null, `is_active`, `created_at`.
- **projects** — `id` pk, `name`, `description` null, `status`, `state`, `state_changed_at` null,
  `is_active`, `owner_department_id` → departments null, `partner_id` → partners null,
  `event_start_date`/`event_end_date`/`venue` null, `created_at`, `updated_at`.
  (Drop the deprecated `budget_income`/`budget_expenses` — budgets live in project_budget_lines.)
- **project_departments** — `id` pk, `project_id`→projects, `department_id`→departments,
  `expected_bp` int null, UNIQUE(`project_id`,`department_id`).
- **project_budget_lines** — `id` pk, `project_id`→projects, `category_id`→categories,
  `type` `'income'|'expense'`, `planned_amount_minor` bigint default 0,
  UNIQUE(`project_id`,`category_id`,`type`).
- **project_members** — `id` pk, `project_id`→projects, `person_name`, `role` null,
  UNIQUE(`project_id`,`person_name`).
- **transactions** — `id` pk, `transaction_date` timestamptz, `type` `'income'|'expense'`,
  `status` default `'draft'`, `is_active`, `description` null, `category_id`→categories null,
  `partner_id`→partners null, `project_id`→projects null,
  `amount_minor` bigint NOT NULL (MUR cents, scale 2),
  `original_amount_minor` bigint null, `original_currency` char(3) null,
  `exchange_rate_e10` bigint null (scale 10),
  `vat_applicable` bool default false, `vat_rate_bp` int null, `vat_amount_minor` bigint default 0,
  `total_amount_minor` bigint default 0,
  `payment_method` null, `notes` null, `source` default `'manual'`, `external_id` null,
  audit cols (`created_by_user_id`, `approved_by_user_id`, `approved_at`, `is_fully_reconciled`),
  `created_at`, `updated_at`. Indexes on date/type/status/category_id/partner_id/project_id.
- **financial_allocations** — `id` pk, `transaction_id`→transactions NOT NULL,
  `department_id`→departments NOT NULL (real FK; **no `division_name`**),
  `role_slug` default `''`, `percentage_bp` int NOT NULL (basis points), `amount_minor` bigint
  NOT NULL (cents), `created_at`. Indexes on transaction_id, department_id.
- **shared_cost_rules** — `id` pk, `source_category_id`→categories, `target_department_id`→
  departments, `percentage_bp` int, `is_active`, UNIQUE(`source_category_id`,`target_department_id`).
- **exchange_rates** — `id` pk, `from_currency`, `to_currency` default `'MUR'`, `rate_e10` bigint
  NOT NULL (scale 10), `effective_date` date, UNIQUE(`from_currency`,`to_currency`,`effective_date`).

### Documented divergences from the old schema (the fixes — keep this list in a `SCHEMA_NOTES.md`)
1. `divisions` is first-class with an id (old: child rows in `departments` via `parent_id`).
2. `categories.division_id` is the single source; old `categories.department_id` is **dropped**
   (derive department via division). Fixes audit DIM-3.
3. `financial_allocations.division_name` is **dropped**; `department_id` is a real FK. Fixes DIM-1/DIM-2.
4. Money stored as integer minor units (bigint) at documented scale; percentages as basis points.
   No `DECIMAL`/float at the app layer. Matches the Prompt A kernel.
5. Allocation grain = department (matches how shared costs actually split, and is faithfully
   migratable from old top-level `department_id`).

### Guardrails
- No connection to any live database. Emit migration SQL with drizzle-kit `generate` only.
- No data, no seed beyond what's needed for typecheck.
- Money/percent columns are integer; if any reviewer sees `numeric`/`decimal` for an amount, it's wrong.

### QA gate
1. `pnpm -r typecheck` and `pnpm -r --if-present build` pass; the schema package exports inferred types.
2. `drizzle-kit generate` produces a clean migration SQL file (committed to the repo, not applied).
3. `SCHEMA_NOTES.md` lists the 5 divergences above.
4. Summary: tables created, types exported, path to the generated migration.

Do not commit. Report the diff summary and QA output for review.

> ASSUMPTION IN THIS PROMPT: allocations at **department grain** (the recommended model). If you
> want division-grain allocations instead, stop before running and say so — I'll revise B1.

---

## PROMPT C — Office P&L read engine (on the clean schema; fixtures now, live parity after B2)

### Goal
Port the eof P&L read surfaces to TypeScript on the `@ehq/db` schema (B1) using the
`@ehq/domain-finance` money kernel (A). This is the engine that finally COMPUTES the numbers the UI
already displays. Pure local code + **fixture-based** unit tests — no DB connection, no live access.
(Parity vs the live PHP comes after data lands in B2.)

### Where it lives
Inspect the repo. Put the read engine in the backend/domain layer the Hono service will call
(e.g. `packages/api/src/office/pl/` or a `@ehq/office-engine` package — follow conventions). It
takes a Drizzle db handle and returns plain objects matching the eof/v1 response shapes so the
existing `@ehq/api-client` contract holds.

### Source-per-view rules (THE dimensional model — keep consistent)
Allocations are at **department grain** (where money lands). Division/category are the transaction's
natural classification.
- **Global / project / partner totals, NO department filter** → aggregate **transactions** (ledger):
  `SUM(amount_minor)` split by `type`, profit = income − expense.
- **Any view filtered by department** (department P&L, project×dept, partner×dept) → aggregate
  **financial_allocations.amount_minor** joined to transactions (only place per-department money lives).
- **by_category** → from **transactions** joined `category → division → department` (1:1 to category).
- **by_division** → from **transactions** joined `category → division` (NOT allocations, NOT a name).
  One row per division id; department via `division.department_id`.
- **by_department** → from **financial_allocations** grouped by `department_id`;
  `COUNT(DISTINCT transaction_id)` for tx_count (a tx split across N depts = N rows).
- **monthly / by_partner / by_project** → transactions (ledger); department-filtered monthly → allocations.

### Filters (port EOF_FinanceEngine_Filters)
Base filter on every aggregate: `status = 'validated' AND is_active = true`, plus FX-valid (exclude
ONLY rows that are a real non-MUR currency with a NULL exchange rate; empty / `'MUR'` / NULL currency
= base, kept). Optional inclusive `date_from` / `date_to` (date_to to end-of-day). No aggregate adds a LIMIT.

### Response shapes (match eof/v1 — do NOT redesign the contract)
- totals: `{ income, expense, profit, tx_count, currency: 'MUR', view }` — money as the kernel's
  output, NEVER a JS float.
- department P&L: totals + `{ department: { id, name, color, type }, view: 'department_allocated' }`.
- project P&L: totals + `{ project, budget_income, budget_expenses, view: 'project_ledger' | 'project_department_allocated' }`.
- partner P&L: totals + `{ partner, view: 'partner_ledger' | 'partner_department_allocated' }`.
- by_category: `[{ category_id, category_name, category_type, division_id, division_name, department_id, department_name, income, expense, profit, tx_count }]`.
- by_division: `[{ division_id, division_name, department_id, department_name, income, expense, profit, tx_count }]`.
- by_department: `[{ department_id, department_name, department_type, income, expense, profit, tx_count }]` (no parent_id — departments are flat now).
- monthly: `[{ month: 'YYYY-MM', income, expense, profit }]`.

### Audit fixes to encode (list them in an `ENGINE_NOTES.md`)
1. **BUG-M1 fixed**: project P&L and partner P&L WITHOUT a department filter return the correct
   non-zero ledger totals (old PHP returned Rs 0 here from a missing table alias). A unit test must
   assert non-zero on fixture data.
2. **Division single source**: by_division derives from `category.division_id`; no denormalized name,
   no second division code path. (Old DIM-1 resolved.)
3. **Department grain**: by_department / department P&L read allocations; division / category read
   transactions. Document that department-sum and division-sum need not tie out for shared-cost
   transactions (by design).

### Fixtures + tests (no DB)
Build an in-memory fixture (pglite/SQLite or hand-built rows) conforming to the B1 schema with a
small, pointed dataset: a couple of departments, divisions, categories (income + expense); a few
validated transactions including one with multi-department allocations, one shared-cost split, one
foreign-currency row with a rate, one with empty `original_currency`; plus draft/cancelled rows that
MUST be excluded. Assert every view against hand-computed expected values, and assert the 3 audit
fixes. Money assertions use exact equality via the kernel.

### Guardrails
- No DB connection, no network, no live access. Tests run fully offline on fixtures.
- All money via `@ehq/domain-finance` (eofMoney, scale 2). No `numeric`/float in the engine.
- Same response shapes as eof/v1.

### QA gate
1. `pnpm --filter <engine pkg> test` — all view computations + the 3 audit-fix assertions green.
2. `pnpm -r typecheck`, `pnpm -r --if-present build`, `pnpm check` pass.
3. Scan: no float/numeric in the engine; no second division code path; no `LIMIT` in aggregates.
4. Summary: surfaces implemented, fixture coverage, audit fixes asserted.

Do not commit. Report the diff + QA output. Live parity vs PHP is a later step (after B2 data).

---

## PROMPT D — Office allocation + write engine (validation rules + allocation replace + shared-cost split)

### Goal
Port the eof **write-side** money logic to TypeScript on the `@ehq/db` schema (B1) + the
`@ehq/domain-finance` kernel (A): allocation replacement, shared-cost expansion, and the
transaction validation rules. This completes the Office vertical (read = C, write = D). Pure logic +
**fixture-based** tests — no DB connection, no live access. The PHP write path is robust; replicate
it faithfully, with invariants tightened only where explicitly noted.

### Where it lives
Same domain layer as C (e.g. `packages/domain-office/src/allocations.ts` + `validation.ts`).
Functions are pure where possible (validate + compute the rows to persist); a thin persistence
wrapper uses a Drizzle transaction. Inputs/outputs match the eof/v1 allocation + validate contract.

### Validation rules (port EOF_Financial_Rules — pure, fully tested)
`transactionCanBeValidated(transaction, allocations)` returns ok / failure-reason. Order of checks:
1. `amount_minor > 0` (else `amount_invalid`).
2. FX: if the row requires FX (real non-MUR currency) it must have the inputs + a matching rate
   (else `fx_missing`).
3. VAT cross-field: if `vat_applicable` then `vat_amount_minor > 0` (else `vat_missing`).
4. If `allocations` is empty: a non-zero transaction cannot validate (`allocations_missing`); a
   zero-amount one may. (This is eof fix #32 — without it, validated rows with no allocation are
   silently dropped by by_department.)
5. `allocationsAreComplete` (below) else `allocations_incomplete`.

`allocationsAreComplete(txAmountMinor, allocations)`:
- sum of `percentage_bp` within ±1 bp of 10000, AND
- sum of `amount_minor` within ±1 of `txAmountMinor` (integer minor units).
Both sums in integers (bp / minor units), never floats.

### Allocation replace (port EOF_Repositories::replace_allocations)
`replaceAllocations(txId, allocations)`:
1. Load the transaction. **Reject if status is validated or cancelled** (read-only → 409-equiv).
2. For each incoming line: resolve + validate `department_id` (must exist and be active — in the
   clean flat schema there is no top-level coercion, just FK validity); require `percentage_bp > 0`
   and `amount_minor > 0`; `percentage_bp ≤ 10000`; optional `role_slug` validated against the known
   roles if present. (No `division_name` — gone in the clean schema.)
3. **Shared-cost expansion** (port expand_shared_cost_allocations): if the transaction's category is
   a shared-cost source (has active `shared_cost_rules`), and the rules' `percentage_bp` sum to
   10000 (±1 bp), replace the lines with one per `target_department_id`, splitting `amount_minor`
   with the kernel's **`splitRemainderLast`** (floor each, last line absorbs the remainder) so the
   per-line sum equals the transaction total EXACTLY. Refuse silently-mutating overshoot (a negative
   line ⇒ abort, keep original).
4. Enforce server-side: `percentage_bp` sum = 10000 (±1 bp) AND `amount_minor` sum reconciles to the
   transaction (±1) — else reject. (Do not trust the client.)
5. Persist atomically: in ONE Drizzle transaction, DELETE existing allocations for the tx then INSERT
   the new set; any failure ⇒ rollback + explicit error (never a silent partial write).
6. Project auto-add side effect (port the v0.3.44 behaviour): if the tx has a project and a line
   points at a department not yet declared on that project, insert the (project, department) pair
   (idempotent) and record an `info` alert. Keep this, but model it as an explicit, testable step.
7. Audit-log the mutation (before/after), as the PHP does.

### Tightening vs the old engine (document in `ENGINE_NOTES.md`)
- Where WE generate splits (shared-cost), reconciliation is **exact** (remainder-last guarantees sum
  = total, 0 tolerance). The ±1 tolerance remains only for client-supplied line sets (audit HZ-M2).
- No `division_name` written anywhere (clean schema).

### Fixtures + tests (no DB; pglite or hand-built rows)
Cover: a clean 3-way split that reconciles; a set that fails the 100% check; a set that fails the
amount check; shared-cost expansion that sums EXACTLY to the total (incl. a remainder case like
100 minor units over 3 rules); a validated/cancelled transaction rejected as read-only; a non-zero
transaction with no allocations rejected at validation; VAT-applicable-but-zero rejected; FX-missing
rejected; a foreign-currency row with a rate accepted; the project auto-add path inserting a pair +
alert. Money assertions exact via the kernel.

### Guardrails
- No DB connection / network / live access; tests run offline on fixtures.
- All money via `@ehq/domain-finance` (eofMoney scale 2 + the split primitives). No float/`numeric`.
- Same write contract as eof/v1; do not touch `maintenance/*` (hard-delete/reset) — out of scope, forbidden.

### QA gate
1. `pnpm --filter @ehq/domain-office test` — all validation + replace + shared-cost + side-effect tests green.
2. `pnpm -r typecheck`, `pnpm -r --if-present build`, `pnpm check` pass.
3. Scans: no float/`numeric`/`Number(` in the engine; no `division_name`; no `maintenance` route; the
   shared-cost split is the remainder-last primitive (not an ad-hoc loop).
4. Summary: rules ported, reconciliation guarantees, fixture coverage.

Do not commit. Report the diff + QA output. Live parity vs PHP is a later step (after B2 data).

---

## PROMPT F1 — Distribution (erh) clean schema

### Goal
Define the clean Postgres schema (Drizzle) for the royalty/distribution domain in `@ehq/db`,
alongside the Office schema (B1). **Schema + generated types only** — no data, no ETL, no live access.
The erh schema is already reasonably sound, so this is a faithful port (not a re-modeling like
Office) with the money-representation and JSON fixes below.

### Money representation (DIFFERENT from Office — read carefully)
erh money is **scale 10** on `DECIMAL(24,10)` and percentages are **scale 6** on `DECIMAL(12,6)`.
Scale-10 amounts over many integer digits **overflow bigint**, so — unlike Office (bigint minor
units) — erh stores money as **exact Postgres `NUMERIC`**:
- amounts → `numeric(28,10)`, percentages → `numeric(12,6)`, quantity → `numeric(24,6)`.
- `NUMERIC` is exact (not float) and is the correct storage type here. ALL arithmetic still goes
  through `@ehq/domain-finance` `erhMoney` (scale 10) / scale-6 for percentages — never JS floats,
  never `bcmath`-less drift. Storage = exact NUMERIC; math = the kernel.
- Forbidden as before: `float` / `real` / `double precision` for any money/percent column.

### Tables (group → Drizzle, all FKs real, `created_at` timestamptz)
- **Ingestion:** import_batches, raw_import_rows, normalized_earnings (gross_amount numeric(28,10),
  quantity numeric(24,6), currency, isrc/upc, raw title/artist/label, mapping_status,
  calculation_status), mapping_stats_by_batch, import_issues.
- **Catalog / entities:** artists (aliases → `jsonb`, default_payee_id, default_split_contract_id),
  payees (linked_artist_ids → `jsonb`, preferred_currency, payment_method, tax_info → `jsonb`),
  labels (default_split_pct numeric(5,2), payee_id), releases (label_id + provenance label_name),
  tracks (isrc, release_id, version_title), track_contributors (track_id, artist_id, role).
- **Identity:** identity_link (payee_id ↔ Office partner_id, confidence, status) — cross-domain link.
- **Contracts:** contracts, contract_scopes (scope_type/scope_id/territory/dsp), contract_cost_terms
  (amount numeric(28,10), currency, **recoupable**, recovery_method, recovery_param numeric(12,6),
  status, scope), contract_extractions (raw_text, extracted_json → `jsonb`), royalty_rules
  (percentage numeric(12,6), scope, payee_id, priority, effective_from/to, recoupable, status).
- **Matching:** earning_track_matches, mapping_rules, catalog_aliases.
- **Calculation:** calculation_runs (reconciliation_json → `jsonb`), earning_allocations
  (gross_amount/original_gross_amount/fx_rate/gross_share/recoupment_applied/net_payable all
  numeric(28,10); split_percentage numeric(12,6); currency, original_currency; status; run id),
  suspense_items (amount numeric(28,10), reason_code, resolved).
- **Statements / payments:** statements (gross_total/recoupment_total/net_payable/**amount_due**
  numeric(28,10), version, locked_at), **payee_balances** (the negative-royalty carry-forward
  ledger: opening_balance/period_net/closing_balance numeric(28,10), movement_type, per payee+
  currency — append-only), statement_lines (gross_share/recoupment_applied/net_payable numeric,
  quantity numeric(24,6)), payments (amount numeric(28,10), exchange_rate, status, paid_at),
  statement_payment_links (amount_applied numeric), expense_applications (cost_term_id,
  amount_applied numeric, statement_id, calculation_run_id).
- **Audit / FX:** audit_logs (before/after/metadata → `jsonb`), fx_rates (rate numeric(24,10),
  from/to currency, effective_date, UNIQUE(from,to,effective_date)).

### Documented decisions (in `SCHEMA_NOTES.md`)
1. erh money stored as exact `NUMERIC` (scale 10 amounts, scale 6 percentages), NOT bigint minor
   units — scale-10 overflows bigint. All math via the `erhMoney` kernel. No float.
2. JSON/LONGTEXT blobs (aliases, linked_artist_ids, tax_info, *_json) → `jsonb`.
3. Provenance snapshots from imports (raw_* fields, releases.label_name) are kept on purpose — they
   record what the distributor sent; they are not a wiring bug.
4. The schema preserves recoupment (contract_cost_terms + expense_applications) and the negative-
   royalty carry-forward ledger (payee_balances) — real erh features, NOT deferred here.

### Guardrails
- No DB connection. `drizzle-kit generate` (SQL emission) only; no `push`/`migrate`.
- No data. Money/percent columns are `numeric` (exact); never `float`/`real`/`double`.

### QA gate
1. `pnpm -r typecheck`, `pnpm -r --if-present build`, `pnpm check` pass; types exported via `@ehq/db`.
2. `drizzle-kit generate` produces a clean migration SQL file (committed, not applied).
3. `SCHEMA_NOTES.md` lists the 4 decisions above.
4. Scan: no `float`/`real`/`double precision` on money/percent columns; no bigint used for scale-10 amounts.

Do not commit. Report the diff + QA output.

---

## PROMPT F3 — erh allocation + recoupment engine (royalty split + advance recovery)

### Goal
Port the erh allocation + recoupment money logic to TypeScript on the `@ehq/db` distribution schema
(F1) + the `@ehq/domain-finance` kernel (A, `erhMoney` scale 10 / percentages scale 6). Pure logic +
**fixture** tests — no DB, no network, no live. Like Office's D, this returns an executable PLAN
(allocations to insert, expense-application rows, cost-term status updates, suspense items) for the
API to persist atomically later. The erh write path is sound; replicate faithfully.

### Where it lives
Distribution domain layer (e.g. `packages/domain-distribution/src/allocation.ts` + `recoupment.ts`),
mirroring the Office split (`packages/domain-office`). All money via `erhMoney`; never JS floats.

### A. Royalty split (port preview_row)
Given an earning gross amount (native currency, scale 10) + its resolved `royalty_rules` (each:
contract_id, royalty_rule_id, payee_id, artist_id, role, percentage scale 6):
1. Sum `percentage` at scale 6; require **exactly `100.000000`** (strict equality) — else
   `invalid_split` (→ suspense). No tolerance here.
2. Order rules by `id` ascending.
3. Split the gross with the kernel's **remainder-last** at scale 10: each non-last share =
   `div(mul(gross, pct), 100)` at scale 10; the **last** share = `gross − Σ(previous shares)` so the
   shares sum to gross EXACTLY.
4. Emit one share per rule: `{ contract_id, royalty_rule_id, payee_id, artist_id, role,
   split_percentage, gross_share }`.

### B. Recoupment per share (port recoupment_for_share + distribute + close)
Recoupment runs in the earning's **native currency**. For each share:
- **Skip** recoupment if `role === 'label'` OR no `contract_id` → `recoupment_applied = 0`.
- **FX gate** (port ensure_recoupment_fx_available_for_share): if the contract has open/partially-
  recovered recoupable cost terms in a currency ≠ the earning currency AND no FX rate exists for that
  currency on the earning's reference date (sale_date → period_end → period_start → today), return
  `missing_fx_rate` → the whole row goes to suspense.
- `recoupableRemaining` = `Σ(contract_cost_terms.amount where recoupable, status≠deleted,
  currency = earning currency, payee scope matches)` − `Σ(expense_applications.amount_applied for
  those terms, same currency)`. Payee scope: a cost term with `payee_id = 0/NULL` applies to ALL
  payees on the contract; otherwise only the matching payee.
- `recoupment_applied` = `min(recoupableRemaining, gross_share)` when `recoupableRemaining > 0`, else
  `0`. `net_payable` = `gross_share − recoupment_applied`.
- **Distribution** (only when `recoupment_applied > 0`): FIFO over recoupable cost terms of the SAME
  currency, `ORDER BY expense_date ASC, id ASC`; for each, `chunk = min(globalRemaining,
  costRemaining)`; emit an `expense_applications` row `{ cost_term_id, amount_applied: chunk,
  currency, calculation_run_id }` and set the term status to `recovered` (applied ≥ amount) or
  `partially_recovered`; decrement globalRemaining.

### Faithful-but-flagged behaviours (document in `ENGINE_NOTES.md`, do NOT silently change)
1. **Cross-currency recoupment is gated but not performed.** The FX gate requires rates to exist for
   foreign cost currencies, yet distribution applies ONLY to same-currency cost terms. Replicate
   exactly (same-currency recoupment + FX gate). Add a clearly-named `// LIMITATION:` note — true
   cross-currency recoupment is a deferred domain decision (changes how much of an advance is
   recovered = real money).
2. **Negative earning shares** (refunds/chargebacks) on recoupable contracts: replicate the PHP
   result, but add a test that pins the current behaviour and a `// VERIFY:` note flagging it for
   domain review (do not invent new refund logic here). The negative carry-forward lives in F4.
3. Amounts stay in native currency at allocation (`fx_rate = 1`); FX-to-MUR is deferred.

### Output (plan, not persistence)
`buildAllocationPlan(earning, rules, costState)` returns either a suspense outcome
`{ suspense: { reason_code, message } }` or a plan:
`{ allocations: EarningAllocationInsert[], expenseApplications: ExpenseApplicationInsert[],
   costTermStatusUpdates: {id,status}[] }`. Pure — the API executes it in one transaction + manages
the calculation_run lifecycle.

### Fixtures + tests (no DB)
Cover: 60/40 split reconciling exactly incl. a remainder case; strict-100 rejection (`99.999999`);
recoupment cap (cost > gross ⇒ recoup = gross, net 0; cost < gross ⇒ recoup = cost, net = gross−cost);
FIFO distribution across two cost terms with a remainder; `role='label'` share NOT recouped;
payee-scoped cost (`payee_id=0` applies; a different payee's term does not); missing cross-currency FX
⇒ suspense `missing_fx_rate`; the negative-earning case (pinned + flagged). Money assertions exact via
the kernel.

### Guardrails
- No DB / network / live; fixtures only. All money via `erhMoney` (scale 10) / scale-6 percentages.
- No float / `Number(` on money; recoupment uses the kernel comparisons, not JS `<`/`>` on strings.
- Produce a plan; never write. No statement/carry-forward logic here (that's F4).

### QA gate
1. `pnpm --filter @ehq/domain-distribution test` — split + recoupment + FIFO + scope + suspense +
   flagged-edge tests green.
2. `pnpm -r typecheck`, `pnpm -r --if-present build`, `pnpm check` pass.
3. Scans: no float/`Number(` on money; split uses remainder-last; `ENGINE_NOTES.md` records the 2
   flagged behaviours.
4. Summary: split + recoupment ported, the 2 flags, fixture coverage.

Do not commit. Report the diff + QA output. Live parity vs PHP comes after B2-erh data.

---

## PROMPT F4 — erh statements + negative carry-forward + payments

### Goal
Port the erh statement generation, the negative-royalty carry-forward ledger, void/reversal, and the
payment-balance math to TypeScript on the F1 schema + `erhMoney` (scale 10). Pure logic + **fixture**
tests — no DB, no network, no live. Returns executable PLANs (statement + lines + ledger rows; void
reversal rows) for the API to persist atomically and manage locking. The PHP is sound; replicate
faithfully, fixing the one float leak below.

### Where it lives
Distribution domain layer (e.g. `packages/domain-distribution/src/statements.ts`), beside F3.

### A. Carry-forward core (port compute_carry) — THE invariant
`computeCarry(opening, periodNet)` at scale 10:
- `available = opening + periodNet`
- `amount_due = available > 0 ? available : 0` (payable this period)
- `closing  = available < 0 ? available : 0` (deficit carried; surplus is paid out, NOT carried)
Closing is therefore always ≤ 0. A negative balance never disappears — it is reduced by a later
positive period before any payout.

### B. Generate (port generate / generate_all_for_period)
A statement is per `(payee_id, period, currency)`. For the period's `earning_allocations` of that
payee+currency: `gross_total = Σ gross_share`, `recoupment_total = Σ recoupment_applied`,
`net = Σ net_payable` (net may be negative). Then:
- `opening = ` the `closing_balance` of the most recent `payee_balances` row for (payee, currency)
  (0 if none).
- `carry = computeCarry(opening, net)`.
- Plan: a `statements` insert `{ gross_total, recoupment_total, net_payable: net,
  amount_due: carry.amount_due, version, status:'generated' }`; one `statement_lines` insert per
  allocation; and one **appended** `payee_balances` row `{ opening_balance: opening, period_net: net,
  closing_balance: carry.closing, movement_type:'statement' }`.
- `generate_all_for_period` resolves the payee's active currencies for the period and produces one
  statement plan per currency.

### C. Void / reversal (port void) — append-only
Voiding a statement does NOT delete ledger history. It appends a compensating `payee_balances` row:
`reversal_net = -(period_net)`, `opening_balance = (current closing)`, `closing_balance =
(original opening)` — i.e. the balance returns to where it was before that statement. Plan only.

### D. Payments / balances (port period_payments, statement_group_totals)
- `statement_balance = amount_due − Σ(payments applied to the statement)` at scale 10.
- Group totals across statements: `Σ(amount_due − payments)` per currency.

### Faithful-but-FIX (document in `ENGINE_NOTES.md`)
- **Float leak:** the PHP `statement_group_totals` casts to `(float)` for the group subtraction.
  Port it through the kernel (exact scale-10), NOT JS floats. This is a fix, not a behaviour change
  (it only removes drift in the group summary).

### Output (plans, not persistence)
`buildStatementPlan(payee, period, currency, allocations, lastClosing)` →
`{ statement, lines, balanceLedgerRow }`. `buildVoidPlan(statement, ledgerRow)` →
`{ reversalLedgerRow, statementStatusUpdate }`. Pure; the API persists + enforces lock/version.

### Fixtures + tests (no DB)
- carry-forward, all four cases: positive available (amount_due>0, closing 0); negative net (amount_due
  0, closing<0); negative opening + small positive net (still negative closing, amount_due 0);
  negative opening + net that over-covers (amount_due = surplus, closing 0).
- generate: aggregates gross/recoupment/net correctly; opening read from the last ledger row; appends
  exactly one ledger row with the right closing.
- void: appends a reversal that restores the balance to the original opening; no history deleted.
- payments: `statement_balance = amount_due − payments`; group totals exact (assert NO float drift on
  a case engineered to drift under float).
Money assertions exact via the kernel.

### Guardrails
- No DB / network / live; fixtures only. All money via `erhMoney` (scale 10). NO float anywhere,
  including group totals (the fix above). Produce plans; never write; never delete ledger history.

### QA gate
1. `pnpm --filter @ehq/domain-distribution test` — carry-forward (4 cases) + generate + void + payments
   + exact-group-totals tests green.
2. `pnpm -r typecheck`, `pnpm -r --if-present build`, `pnpm check` pass.
3. Scans: no float/`Number(` on money ANYWHERE in the statements module (incl. group totals);
   carry-forward closing ≤ 0 invariant asserted; void is append-only.
4. Summary: carry-forward ported, the float fix, void reversal, fixture coverage.

Do not commit. Report the diff + QA output. Live parity vs PHP comes after B2-erh data.

> With F4 green, the erh COMPUTE side is complete: schema (F1) + allocation/recoupment (F3) +
> statements/carry-forward (F4). What remains is reads (F2), Office analytics (C2), the ETLs
> (B2 / B2-erh — need dumps), and wiring/deploy (E).

---

## PROMPT F2 — erh read engine (dashboard, allocations, suspense, statements, catalog)

### Goal
Port the erh **read** surfaces to TypeScript on the F1 schema, returning the `erh/v1` response shapes
so the existing `@ehq/api-client` contract holds. **Reads only** — query + shape already-computed
values; no recomputation of money, no writes, no live access. Pure functions over a Drizzle handle +
**fixture** tests.

### Where it lives
Distribution domain layer (e.g. `packages/domain-distribution/src/read.ts`), beside F3/F4.

### Surfaces (match erh/v1; inspect `@ehq/api-client` for exact shapes)
- **dashboard** — per-currency totals from `earning_allocations` (Σ gross_share, Σ recoupment_applied,
  Σ net_payable), suspense count + Σ amount from `suspense_items` (unresolved), statement counts by
  status, recent `calculation_runs`.
- **allocations** — list `earning_allocations` filtered by batch / payee / currency / status, joined to
  track, release, payee, contract for display names. Paginated; no LIMIT-less full scans in prod paths.
- **suspense** — list `suspense_items` (filter resolved / reason_code) joined to the earning for context.
- **statements** — list (by payee / period / status / currency) and detail (`statements` +
  `statement_lines` + linked `payments`); per-statement `balance = amount_due − Σ payments applied`
  (reuse the F4 helper — exact, via the kernel).
- **payees / artists / releases / tracks / labels** — catalog list + detail reads.
- **contracts** — list + detail incl. `contract_cost_terms` (with recovered/remaining per term computed
  from `expense_applications` — read the existing applied sums, do not re-run recoupment).
- **expenses** — `contract_cost_terms` view with applied/remaining.
- **fx-rates** — list `fx_rates`. **royalty rules** — list by contract/scope.

### Money handling
Read the stored exact `NUMERIC` values and format for output via `@ehq/domain-finance` (`erhMoney`
scale 10). Where a read needs a sum (dashboard totals, remaining balances), use the kernel — never JS
floats, never recompute splits/recoupment (those are F3's job; reads consume their results).

### Guardrails
- Reads only. No writes, no allocation/recoupment/statement-generation logic here.
- No DB connection / network / live; fixture (pglite/hand-built) tests. No float / `Number(` on money.
- Same `erh/v1` shapes; do not redesign the contract.

### QA gate
1. `pnpm --filter @ehq/domain-distribution test` — each surface's shape + filters + money pass-through
   asserted on fixtures.
2. `pnpm -r typecheck`, `pnpm -r --if-present build`, `pnpm check` pass.
3. Scans: no float/`Number(` on money; no recomputation of splits/recoupment in the read module;
   no LIMIT-less scans on the list endpoints.
4. Summary: surfaces implemented, fixture coverage.

Do not commit. Report the diff + QA output.

---

## PROMPT B1b — Office bank / ops schema (prerequisite for C2)

### Goal
Extend the Office schema (`@ehq/db`) with the bank / reconciliation / ops tables B1 didn't cover.
Schema + types + migration only — no DB, no data, no live. Money as **bigint minor units (cents,
scale 2)**, consistent with the rest of Office. (Wave + the PDF-import pipeline are deferred —
separate decisions; do NOT add them here.)

### Tables (Drizzle / Postgres)
- **bank_accounts** — id, name, institution, account_number, currency char(3) default `'MUR'`,
  is_active, created_at.
- **bank_raw_transactions** — id, import_id, account_id → bank_accounts, external_id,
  transaction_date timestamptz, description, direction (`'debit'|'credit'`), `amount_minor` bigint,
  `balance_minor` bigint null, status default `'unmatched'`, raw_payload `jsonb`, created_at. Indexes
  on account/import/external_id/status/date.
- **bank_reconciliations** — id, transaction_id → transactions, bank_raw_transaction_id →
  bank_raw_transactions, `amount_linked_minor` bigint, status default `'suggested'`
  (`suggested|validated|rejected`), created_by_user_id, validated_by_user_id, validated_at, created_at.
- **alerts** — id, type, severity default `'info'`, entity_type, entity_id, project_department_id null,
  message, status default `'open'`, data `jsonb`, ack/dismiss cols,
  UNIQUE(entity_type, entity_id, type, status).
- **audit_log** — id, actor_user_id, action, entity_type, entity_id, before_json/after_json `jsonb`,
  ip_address, created_at. (Append-only; never updated/deleted.)

### Decisions (add to `SCHEMA_NOTES.md`)
- Bank money is `bigint` minor units (cents, scale 2) — same as Office B1; no `numeric`/float.
- `raw_payload`, `alerts.data`, audit `before/after` → `jsonb`.
- Wave (`wave_invoices`) and `pdf_imports` are intentionally NOT included — deferred decisions.

### Guardrails / QA gate
- No DB connection; `drizzle-kit generate` only. No data.
- `pnpm -r typecheck` / `build` / `check` pass; types exported; clean migration emitted.
- Scan: bank money columns are `bigint` (cents), never float/`numeric`.
- Do not commit. Report diff + QA.

---

## PROMPT C2 — Office dashboard/full + cash analytics (compose C)

### Goal
Port the Office cash analytics + the composed `dashboard/full` payload to TypeScript on B1 + B1b +
the C read engine + `eofMoney`. Pure logic + **fixture** tests — no DB / network / live. Same eof/v1
shapes. Reuses C's P&L surfaces; adds the cash side.

### Where it lives
`packages/domain-office/src/analytics.ts` (+ compose in a `dashboard.ts`), beside C.

### Surfaces (port EOF_FinanceEngine_Cash + analytics_cash_runway + dashboard_full)
- **cash totals** — only **validated** `bank_reconciliations` count as cash (suggested ≠ cash,
  rejected excluded). `cash_income/expense` = Σ `amount_linked_minor` by the linked transaction's type
  (transaction validated + active); `cash_profit`; `reconciled_count`. Optional date range.
- **cash delta** — ledger (C global P&L) vs cash; `delta_* = ledger_* − cash_*`.
- **bank_quality** — from `bank_raw_transactions`: total; eligible (status ≠ `'ignored'`); matched
  (`matched`|`partially_matched`); unmatched; ignored; `match_rate_percent = matched/eligible*100`
  (a ratio % — rounding a percentage is fine; it is not money).
- **cash_runway** — 6-month window (validated + active tx): `income_6m`, `expense_6m`,
  `burn = (expense_6m − income_6m) / 6`; `current_balance` = Σ of the latest `balance_minor` per
  active account (max transaction_date per account where balance is set);
  `runway_months = current_balance / burn` (a derived month estimate; null when burn ≤ 0 →
  "cashflow positive / runway effectively infinite").
- **dashboard/full** — compose `{ generated_at, summary, monthly (C), cash_delta, bank_quality,
  recent_transactions (last 10 validated), cash_runway }`.

### Faithful-but-FIX (document in `ENGINE_NOTES.md`)
- **Float leak in cash_runway:** the PHP casts income/expense/balance/burn to `(float)`. Port all of
  those **money** sums through the kernel (exact cents). ONLY `runway_months` (a unitless
  balance ÷ burn month-count estimate) may be a rounded number — it is not a stored money value.
  Everything labelled in MUR (`current_balance`, `burn_rate_mur`, `income_6m_total`,
  `expense_6m_total`) must be exact kernel output, not float.

### Guardrails / QA gate
- No DB / network / live; fixtures only. Money via `eofMoney` (cents). The ONLY rounded float allowed
  is `runway_months` and the `match_rate_percent` ratio — both non-money; everything in MUR is exact.
- Tests: cash totals counts only validated reconciliations; delta = ledger − cash; bank_quality counts
  + rate; cash_runway with exact MUR sums + a months estimate (assert MUR fields exact, no drift);
  dashboard/full composition shape.
- `pnpm --filter @ehq/domain-office test` / `typecheck` / `build` / `check` green.
- Scan: no float on any MUR-labelled value; only `runway_months` / `match_rate_percent` are ratios.
- Do not commit. Report diff + QA.

---

<!-- STILL TO COME, appended in this same file:
PROMPT B2  — ETL MySQL→Supabase, Office (needs a DB dump; carries data-quality fixes). NOT unattended.
PROMPT B2-erh — ETL for the royalty tables (needs dump). NOT unattended.
PROMPT E   — wire Hono + deploy to the Hostinger Node slot + cut WordPress. NOT unattended.
DEFERRED (separate decisions, not yet prompts): Wave integration (port/drop), PDF-import pipeline,
bank import parsers (MCB/SBI) + distributor parsers (RouteNote/Kontor/DistroKid/Ditto). -->

## B2-load — Harnais de parité hors-ligne (Office d'abord, réutilisable erh)
But : prouver la parité golden master sur la VRAIE donnée du dump, sans toucher au live.

Garde-fou réseau : aucun egress externe (WP/Supabase/internet interdits). Services LOCAUX (127.0.0.1) OK.

Source :
  - Importer le dump dans un MySQL LOCAL jetable :
      mysql -u <local> <localdb> < data/dumps/u384688932_HZ0LD.sql
    (fidélité garantie : même moteur que l'export). Lire wp_eof_* en lecture seule via connexion localhost.
  - Alternative sans daemon : parser tolérant des INSERT pour les seules wp_eof_* (multi-row, NULL, échappements).
Cible :
  - Postgres LOCAL (ou pglite in-process) avec les migrations schéma propre @ehq/db office (0000–0004).
Run :
  1. Transform via @ehq/domain-office/etl.ts (déjà construit).
  2. GARDE D'INGESTION — abort si counts source ≠ :
     transactions 3107 · allocations 2832 · categories 551 · departments 93
     · partners 247 · projects 12 · bank_raw 3093 · bank_reconciliations 1568
  3. Charger dans le Postgres local.
  4. GATE DE PARITÉ (égalité EXACTE) :
     - SUM brute Postgres (validated + is_active) : revenus = 2 214 542 460 c · dépenses = 1 362 642 716 c · count = 2396
     - @ehq/domain-office P&L global == mêmes chiffres
     - Divergence ATTENDUE, consignée (pas un échec) : P&L projet/partenaire org-wide (BUG-M1, ancien = Rs 0)
  5. Émettre un rapport de parité (JSON + lisible).
Contraintes : aucune écriture live, pas de Supabase, pas d'identifiants. Réseau externe off.
Peut tourner en Auto (tout est local). Gate HUMAIN = relire le rapport de parité avant d'avancer.



## PROMPT E2-LOAD — Supabase data load + prod parity (real `postgres` target)

### Context / prerequisites (already done — do NOT redo)
- E2 Phase 0/0b/0c (pglite, legacy→UUIDv5 identity, `payee_id 0→NULL` sentinel) — green for office + erh.
- E2 Phase 1 — Drizzle migrations `0000→0008` applied to the live Supabase project (schema present).

### Goal
Add a real-`postgres` load target (driven by `DATABASE_URL`) to the existing B2 load harnesses, reusing **exactly** the Phase-0 transform / legacy→UUID mapping / checksums, so David can load the migrated data into Supabase and re-assert the golden masters **read back from the live DB**. Do **not** modify transform / money / checksums / golden values.

### Where it lives
- Extend `packages/migration-tools/bin/office-b2-load.mjs` and `packages/migration-tools/bin/erh-b2-load.mjs`, adding a `postgres` target **next to the existing `pglite` target**.
- Reuse `packages/migration-tools/src/legacy-uuid.ts` (UUIDv5 identity + on-the-fly FK remap), the existing transforms, and the same checksum assertions. Driver: `pg` + `drizzle-orm`. Schema source of truth: `@ehq/db`.

### Behaviour
1. **Schema already applied** (Phase 1): load into existing tables — must **not** create/migrate schema.
2. **Efficient streaming load:** batched inserts (COPY or multi-row, modest batch size compatible with the Supabase pooler); erh streamed (constant memory); **topological order** (parents before children) for FKs.
3. **Anti-double-load guard:** refuse if any target table is non-empty, unless an explicit `--force` flag is passed.
4. **Re-checksum from the real DB** (after load, read back and assert):
   - office: income `2 214 542 460` c / expense `1 362 642 716` c / `2 396` validated transactions;
   - erh: moneyGoldens EUR/USD per table, counts (earning_allocations 82 736, normalized_earnings 155 027, statement_lines 12 241, …);
   - common: orphan FKs `= 0`, split `= 28 560` groups, verbatim compared on `legacy_id` (not on the UUID PK).
   - Write report(s) to `reports/e2-phase2-*`.
5. **STOP & report** on any value divergence or constraint violation.

### Guardrails
- **Build + QA are offline and Auto-safe** (network OFF): the target is exercised **only against pglite** in tests; the real `postgres` target is **never** connected during build/QA.
- The live `postgres` run is **David-only**, at runtime, with **his** `DATABASE_URL` (from the local `.env`). **Never** hardcode or **log** the connection string. **STOP** clearly if `DATABASE_URL` is absent.
- No `git commit` / `push`; report a diff for human review. No writes to any live system from Codex.

### QA gate (all must pass before "done")
- `pnpm --filter @ehq/migration-tools check` + repo typecheck green.
- pglite run (office + erh) still green via the shared code path (no regression).
- The `postgres` target refuses to run without `DATABASE_URL`, and refuses non-empty tables without `--force` (covered by a test).
- Report the diff and the exact runtime commands David will use for the live load; then stop.

## PROMPT E2-LOAD-VISIBILITY — make the postgres load observable + fail-fast (no silent hang)

### Why
The `--target postgres` run produces NO output and can hang silently (likely a TLS/connection issue with the Supabase pooler, plus the dump path is resolved against the package dir instead of the user's cwd). Make the loader talk, fail fast with a clear message, and resolve paths predictably. Build + QA strictly offline (pglite only). Do NOT change transform / money / checksums / golden values.

### Fixes
1. **Path resolution:** resolve the dump-file and report-dir args against `process.cwd()`, and accept absolute paths unchanged (no re-rooting under `packages/migration-tools`). At startup print the resolved ABSOLUTE path of the dump and report dir. If the dump doesn't exist, exit immediately with a clear message naming the path tried.
2. **Connection (Supabase pooler):** when building the `pg` connection from `DATABASE_URL`, honour TLS — respect `sslmode` in the URL, otherwise enable `ssl: { rejectUnauthorized: false }` so pooler connections succeed instead of hanging. Add a connection timeout (~15 s) + statement timeout; on failure exit with a clear one-line error printing **host:port only** — never user/password/full URL.
3. **Progress output (flushed, line-buffered):**
   - `→ reading dump: <abs path> (<size>)`
   - `→ connecting to <host>:<port> …` then `✓ connected`
   - per table: `→ <table>: loading…` then `✓ <table> <n> rows`
   - `→ reading back from DB to verify…`
   - final summary with the asserted goldens (office: 2 396 validated, income 2 214 542 460 c, expense 1 362 642 716 c; erh: counts + moneyGoldens + split + orphan FKs 0).
4. Keep the existing anti-double-load guard (refuse non-empty tables unless `--force`) and the no-`DATABASE_URL` refusal.

### Guardrails
- Build + QA offline, network OFF, pglite only (no live DB in tests). Auto-safe.
- The `postgres` target runs ONLY by David at runtime with his `DATABASE_URL`. Never log the connection.

## PROMPT E2-VERIFY — read-only parity against the live Postgres (no load)

### Context (already true — do NOT redo)
- E2-LOAD `--target postgres` exists on both office + erh harnesses (load + post-load read-back).
- Supabase already holds a full-looking Office load (guard refused a re-load: transactions=3107, …).

### Goal
Add a `--verify-only` flag to BOTH `office-b2-load` and `erh-b2-load` that asserts parity by
**reading the live Postgres only** — no INSERT, no TRUNCATE, no schema change. Reuse EXACTLY the
existing post-load read-back + checksum code and the existing golden constants/fixtures.
Do NOT touch transforms / money / checksums / golden values.

### Behaviour
1. When `--verify-only` is passed: SKIP the dump load entirely and SKIP the anti-double-load guard.
2. Connect via `DATABASE_URL` (same TLS/pooler settings, ~15s connect timeout, statement timeout),
   and open the work as a READ ONLY transaction (`SET TRANSACTION READ ONLY`) — writes impossible.
3. Read back the target tables and run the SAME parity assertions already used after a load:
   - office: counts (incl. 2396 validated), income 2 214 542 460 c, expense 1 362 642 716 c;
   - erh: per-table counts (earning_allocations 82 736, normalized_earnings 155 027,
     statement_lines 12 241, …), moneyGoldens EUR/USD per table;
   - common: orphan FKs = 0, split = 28 560 groups.
4. Dump arg OPTIONAL under `--verify-only`. Parsing rule: the report dir is always the LAST
   positional; the dump (office) / dump+contract (erh) positionals before it may be omitted.
   - dump provided → also run the verbatim row comparison on `legacy_id`;
   - dump omitted  → run everything EXCEPT verbatim, comparing to the golden constants.
   State the mode (full / lite) in the report.
5. Visible logs: connection host:port, tables read, per-table counts, each golden PASS/FAIL.
6. Report → `reports/e2-phase2-<engine>-verify.md`. Exit non-zero on ANY mismatch.

### Guardrails
- READ ONLY everywhere; no maintenance/*; no float in money. Offline except the Supabase connection.
- New entry flag, NOT a new checksum implementation — reuse existing paths.
- QA offline: `pnpm --filter @ehq/migration-tools check` + `test`, then `pnpm check`.
- Do NOT run `--target postgres` or `--verify-only` against live yourself — David runs live calls.

## PROMPT E2-LOAD-HARDEN — fix EADDRNOTAVAIL on postgres load + add --reset

### Diagnosis (confirmed by a real run)
Loading raw_import_rows into Supabase failed at row 2249 with `read EADDRNOTAVAIL`:
client-side ephemeral-port exhaustion from opening too many short-lived connections/sockets
too fast against the pooler. Data + transforms are correct; this is purely the connection pattern.

### Goal
Make the `--target postgres` load use ONE durable pooled connection for the whole run, in batches,
and add a tooled `--reset`. Do NOT touch transforms / money / checksums / golden values / the
verify-only paths.

### Fix the connection pattern (root cause)
1. **Single client, whole load.** Open ONE `pg` connection (or a Pool with `max: 1`) at the start,
   reuse it for every table and every batch, close once at the end. Never per-row / per-batch connects.
   Use a **session pooler / transaction-aware** connection string.
2. **Bulk insert via `COPY`.** Use `pg-copy-streams` (`COPY <table> (cols...) FROM STDIN`) for the
   high-volume tables (raw_import_rows, normalized_earnings, earning_allocations, statement_lines).
   Fall back to multi-row INSERT (≤1000 rows/statement) only for small tables. No one-row-per-INSERT.
3. **Commit in chunks, not one mega-transaction.** For raw_import_rows (≈142 692) and the other large
   tables, commit every N rows (N≈5 000–10 000) so Supavisor can't kill an hours-long transaction and
   a mid-run failure stops at a known boundary. Keep FK topological order across tables.
4. **Socket resilience.** Set TCP keepalive (`keepalive: true`, `keepaliveInitialDelayMillis: 10000`)
   and a sane connect timeout; on a retryable network error (EADDRNOTAVAIL, ECONNRESET, ETIMEDOUT),
   retry the current batch up to 3× with backoff — never silently skip rows.

### Add `--reset` (tooled truncate, no manual SQL)
5. New `--reset` flag: before loading, TRUNCATE only the distribution B2-erh target tables in
   reverse-FK order (children → parents), `RESTART IDENTITY CASCADE`, inside one transaction.
   Scope it to the exact table list this harness owns — never touch office tables or anything else.
   Print each truncated table. `--reset` implies a load run; it must refuse unless `--target postgres`.
   Guard: `--reset` and `--verify-only` are mutually exclusive (error if both).

### Behaviour after fix
- A normal `--target postgres` run resumes from empty and loads end-to-end with the durable connection.
- The anti-double-load guard stays as-is for runs WITHOUT `--reset`.
- Cosmetic: stop printing "All target tables were empty before load" before the guard has actually
  checked — print the guard's real finding.

### QA (offline only — do NOT run live yourself)
- `pnpm --filter @ehq/migration-tools check` + `test` (add a unit test: batch chunking commits at the
  boundary; `--reset`+`--verify-only` rejected). Then `pnpm check`.
- Office + erh pglite must stay green (unchanged goldens).
- Do NOT run `--target postgres` / `--reset` / `--verify-only` against live — David runs live calls.

## PROMPT E2-FIX-READBACK — align payee_balances golden read-back to the real schema

### Diagnosis (confirmed against @ehq/db)
The postgres load of ERH succeeded for ALL tables (payee_balances = 3 rows written). The run then
failed in the golden read-back/verify pass with:
  `column payee_balances.period_end does not exist`
The real `payee_balances` columns are: id, legacy_id, payee_id, statement_id, currency,
opening_balance, period_net, closing_balance, movement_type, created_at. There is NO period column
on this table — period bounds live on the parent `statements` table. The read-back query references
a non-existent `period_end`; the data + transform + load are correct.

### Goal
Fix ONLY the read-back / parity assertion for payee_balances so it matches the real schema. Do NOT
change the load, the transforms, the money kernel, the golden VALUES, or any other table's logic.
Apply the same fix in BOTH the post-load read-back AND the `--verify-only` path (shared code if it
already is; otherwise both call sites).

### What to do
1. Find every reference to `payee_balances.period_end` (and any sibling like `period_start`) in the
   read-back/verify SQL or query builder.
2. Determine its role:
   - if it was a GROUP BY / filter key → re-anchor the assertion to the agreed golden:
     "latest closing_balance per (payee_id, currency)" computed from `payee_balances` as it really is
     (order/sequence by created_at or the existing row order; do NOT invent a period column). If a
     real period bound is genuinely needed, JOIN `statements` via `statement_id` and use the column
     that actually exists there — inspect `statements` first, do not assume its column name either.
   - if it was only selected/ordered for display → remove it from the read-back; it is not an invariant.
3. Keep the payee_balances golden semantics unchanged (latest closing_balance per payee+currency,
   continuity preserved). Keep all other golden assertions byte-for-byte as they are.

### Guardrails / QA (offline only — do NOT run live)
- READ-ONLY change to read-back logic; no transform/money/checksum/golden-value edits; no load change.
- Inspect `statements` real columns before any JOIN; never reference a column you have not confirmed.
- `pnpm --filter @ehq/migration-tools check` + `test`, then `pnpm check`. Office + ERH pglite stay green.
- Do NOT run `--target postgres` / `--reset` / `--verify-only` against live — David runs live calls.

## PROMPT E2-FIX-VERBATIM-DATES — date-aware verbatim compare (no data/load change)

### Diagnosis (confirmed by a real run)
Office `--verify-only` full passed raw + P&L parity (2396 validated, income 2214542460 c, expense
1362642716 c) but the verbatim legacy_id comparator failed on:
  `transactions.transaction_date legacy_id 7156: expected 2024-03-14 00:00:00, got 2024-03-14T00:00:00.000Z`
Same instant, two serializations: source dump text `YYYY-MM-DD HH:MM:SS` vs the `pg` driver's ISO
rendering of a Postgres timestamp. The stored data is correct; the verbatim oracle is comparing
date/time columns as raw strings instead of as temporal values.

### Goal
Make the verbatim comparator compare date/time columns by VALUE (same instant/day), not by string
form. Do NOT change transforms, money, checksums, golden values, the load, or any parity totals.
This is a fix to the COMPARISON logic only, shared by post-load read-back and `--verify-only`.

### What to do
1. In the verbatim compare path, detect columns whose source/target type is date / timestamp /
   timestamptz (use the schema/column metadata you already have; do not pattern-match on values).
2. For those columns, normalize BOTH sides to a canonical instant before comparing:
   - parse the source dump value (`YYYY-MM-DD HH:MM:SS`, and date-only `YYYY-MM-DD`) and the DB value
     (ISO `…Z`) into a comparable canonical form (e.g. epoch millis, or a single canonical UTC string),
   - treat `NULL`/empty and the legacy `0000-00-00 00:00:00` sentinel (already mapped to NULL on load)
     as equal to DB NULL — do not regress the existing zero-date→NULL rule.
   - date-only columns compare by calendar day; timestamps compare by instant.
3. Leave all NON-temporal columns compared exactly as today (verbatim string/byte equality). Money and
   numeric columns keep their current exact comparison — do NOT route them through date logic.
4. Do not change what counts as a mismatch for any non-date column; only date/time equality changes.

### Guardrails / QA (offline only — do NOT run live)
- Comparison-logic change only; zero edits to transform/money/checksum/golden/load code.
- Add unit tests: `2024-03-14 00:00:00` == `2024-03-14T00:00:00.000Z`; date-only `2024-03-14` ==
  `2024-03-14T00:00:00.000Z`; a genuinely different day/instant still FAILS; NULL/sentinel handling.
- `pnpm --filter @ehq/migration-tools check` + `test`, then `pnpm check`. Office + ERH pglite stay green.
- Re-run nothing live yourself — David runs `--target postgres` / `--verify-only`.

## PROMPT E — wire Hono to migrated Postgres, deploy shadow on Hostinger, then cut WordPress

### Context (already true)
- E2 Phase 2 complete: office + erh loaded into Supabase, verify-only FULL = pass (read back live).
- Secrets rotated by David (new DATABASE_URL, old revoked). Schema 0000→0008 applied.
- Hono backend (Drizzle, @ehq/db) exists in the monorepo. Legacy live system = WordPress eof/v1 + erh/v1.

### Goal
Stand up the Hono API against the migrated Postgres, deploy it to the Hostinger Node slot ALONGSIDE
WordPress (shadow, nothing cut), expose a parity path so David compares Hono vs WordPress on identical
requests, and prepare — but do NOT execute — the WordPress cutover. The cut is David-only, last step.

### Phase E1 — wire + run locally
1. Point the Hono app at the migrated DB via DATABASE_URL (same TLS/pooler, single durable pool).
   No schema change, no data write on boot.
2. Wire the read endpoints that mirror the live eof/v1 + erh/v1 surfaces David depends on (P&L,
   statements, balances, allocations, listings). Reuse existing domain services; do NOT recompute money.
3. `pnpm --filter <hono pkg> check` + `test`, then `pnpm check`. All green offline.

### Phase E2 — shadow deploy (nothing cut)
4. Build a deployable artifact for the Hostinger Node slot. Deploy it to a NON-production path/port
   (shadow), so WordPress at the current domain stays fully live and untouched.
5. Health check: Hono boots, connects to Postgres, serves a known read endpoint. Print the shadow URL.
6. Do NOT change DNS, do NOT touch the WordPress install, do NOT remove WP_BASE_URL / WP_APP_PASSWORD.

### Phase E3 — parity harness (Hono vs WordPress, read-only)
7. Add a script that hits the SAME read queries on BOTH the Hono shadow and the live WordPress eof/v1
   + erh/v1, on identical date filters, and diffs the JSON. Expected divergence: BUG-M1 (org-wide
   project/partner P&L — WordPress returns Rs 0, Hono returns real totals) — list it, do not fail on it.
8. Output `reports/phaseE-parity.md`: matches + the documented BUG-M1 divergence. READ-ONLY on both.

### Phase E4 — cutover plan (write it, DO NOT run it)
9. Produce `CUTOVER.md`: exact ordered steps to point the domain at the Hono slot, the rollback
   (revert to WordPress), and the post-cut env cleanup (remove WP_BASE_URL + WP_APP_PASSWORD). Include
   a one-line pre-cut checklist (parity green, secrets rotated, DB backup taken).
10. STOP. Do not change DNS, do not disable WordPress, do not run the cutover. David executes E4 by hand.

### Guardrails
- WordPress stays live through E1–E3; only E4 (David, manual) touches production.
- Read-only against both systems in the parity harness; no money recompute; no schema/data writes.
- Do NOT run live deploy/cutover commands yourself — David runs anything that touches the Hostinger
  slot or DNS. Codex builds, tests offline, and produces the artifacts + CUTOVER.md.

  ## PROMPT E2-OFFICE-RESET — add --reset to the Office loader (scoped to Office tables only)

### Diagnosis (confirmed by reports/e2-alloc-gap.md)
The Office transform is correct: dump=2832, transform emits=2832, pglite load=2832. But live Supabase
holds only financial_allocations=1986 — a PARTIAL Office load from an earlier session (the first live
load this evening already failed on duplicate departments_pkey against a non-empty table). 846
allocations are missing IN THE DATABASE. This is bad live state, not a code/oracle bug. Fix = clean
reset + full reload of Office, exactly as was done for ERH.

### Goal
Add a `--reset` flag to the OFFICE loader (office-b2-load), mirroring the ERH `--reset` already shipped,
scoped to the Office B2 target tables ONLY. Do NOT touch ERH/distribution tables, transforms, money,
checksums, golden values, or the verify logic.

### What to do
1. Add `--reset` to office-b2-load with the SAME semantics as the ERH one:
   - refuses unless `--target postgres`;
   - mutually exclusive with `--verify-only` (error if both);
   - before load, TRUNCATE only the Office B2 target tables in reverse-FK order, RESTART IDENTITY
     CASCADE, in one transaction; print each truncated table.
   - Scope = exactly the Office tables this harness owns: departments, divisions, categories, partners,
     projects, project_budget_lines, transactions, financial_allocations, office_bank_accounts,
     office_bank_import_batches, office_bank_statement_lines, office_bank_reconciliation_matches,
     office_cashflow_projection_rows. NEVER touch any distribution/erh table.
2. Reuse the durable single-connection + COPY/batch load path already hardened for ERH (no per-row
   connects; chunked commits; keepalive; retry on EADDRNOTAVAIL/ECONNRESET/ETIMEDOUT).
3. Anti-double-load guard stays as-is for runs WITHOUT `--reset`.

### QA (offline only — do NOT run live)
- `pnpm --filter @ehq/migration-tools check` + `test` (add a test: `--reset`+`--verify-only` rejected;
  truncate list contains only Office tables, no distribution tables). Then `pnpm check`.
- Office + ERH pglite stay green (unchanged goldens).
- Do NOT run `--target postgres` / `--reset` / `--verify-only` live — David runs live calls.

## PROMPT E — wire Hono to migrated Postgres, deploy shadow on Hostinger, then cut WordPress

### Context (already true)
- E2 Phase 2 complete: office + erh loaded into Supabase, verify-only FULL = pass (read back live).
- Secrets rotated by David (new DATABASE_URL, old revoked). Schema 0000→0008 applied.
- Hono backend (Drizzle, @ehq/db) exists in the monorepo. Legacy live system = WordPress eof/v1 + erh/v1.

### Goal
Stand up the Hono API against the migrated Postgres, deploy it to the Hostinger Node slot ALONGSIDE
WordPress (shadow, nothing cut), expose a parity path so David compares Hono vs WordPress on identical
requests, and prepare — but do NOT execute — the WordPress cutover. The cut is David-only, last step.

### Phase E1 — wire + run locally
1. Point the Hono app at the migrated DB via DATABASE_URL (same TLS/pooler, single durable pool).
   No schema change, no data write on boot.
2. Wire the read endpoints that mirror the live eof/v1 + erh/v1 surfaces David depends on (P&L,
   statements, balances, allocations, listings). Reuse existing domain services; do NOT recompute money.
3. `pnpm --filter <hono pkg> check` + `test`, then `pnpm check`. All green offline.

### Phase E2 — shadow deploy (nothing cut)
4. Build a deployable artifact for the Hostinger Node slot. Deploy it to a NON-production path/port
   (shadow), so WordPress at the current domain stays fully live and untouched.
5. Health check: Hono boots, connects to Postgres, serves a known read endpoint. Print the shadow URL.
6. Do NOT change DNS, do NOT touch the WordPress install, do NOT remove WP_BASE_URL / WP_APP_PASSWORD.

### Phase E3 — parity harness (Hono vs WordPress, read-only)
7. Add a script that hits the SAME read queries on BOTH the Hono shadow and the live WordPress eof/v1
   + erh/v1, on identical date filters, and diffs the JSON. Expected divergence: BUG-M1 (org-wide
   project/partner P&L — WordPress returns Rs 0, Hono returns real totals) — list it, do not fail on it.
8. Output `reports/phaseE-parity.md`: matches + the documented BUG-M1 divergence. READ-ONLY on both.

### Phase E4 — cutover plan (write it, DO NOT run it)
9. Produce `CUTOVER.md`: exact ordered steps to point the domain at the Hono slot, the rollback
   (revert to WordPress), and the post-cut env cleanup (remove WP_BASE_URL + WP_APP_PASSWORD). Include
   a one-line pre-cut checklist (parity green, secrets rotated, DB backup taken).
10. STOP. Do not change DNS, do not disable WordPress, do not run the cutover. David executes E4 by hand.

### Guardrails
- WordPress stays live through E1–E3; only E4 (David, manual) touches production.
- Read-only against both systems in the parity harness; no money recompute; no schema/data writes.
- Do NOT run live deploy/cutover commands yourself — David runs anything that touches the Hostinger
  slot or DNS. Codex builds, tests offline, and produces the artifacts + CUTOVER.md.

  ## PROMPT E1-FIX-ENV — load .env automatically in the shadow server (local only)

### Problem
`node dist/server.js` does NOT read the repo `.env`, so DATABASE_URL is undefined unless passed
inline on the command line. David should be able to run the shadow server without pasting the URL.

### Goal
Make the shadow server load `.env` automatically at startup. Local dev convenience only. Do NOT
change the Postgres read-only behaviour, the routes, the domain logic, money, or anything certified.

### What to do
1. At the very top of `services/api/src/server.ts` (before any DATABASE_URL read), load the repo-root
   `.env`. Prefer Node's built-in `--env-file` wired via the `start` script, OR `dotenv` if already in
   the tree; do not add a heavy dependency. The `.env` at the monorepo root must populate process.env.
2. Keep the explicit `DATABASE_URL=... pnpm start` override working (inline env still wins).
3. Keep the clear error if DATABASE_URL is genuinely absent.
4. Do NOT commit or print the .env contents or any secret. Do NOT touch postgres.ts read logic,
   routes, or the parity harness.

### QA (offline only — do NOT run live)
- `pnpm --filter @ehq/api check` + `build`, then `pnpm check`. All green.
- Do NOT run the live server, do NOT deploy, do NOT touch WordPress/DNS — David runs the live start.

### After Codex is done, David runs ONLY this:
  corepack pnpm --filter @ehq/api build
  corepack pnpm --filter @ehq/api start
  # then in another terminal:
  curl -s http://127.0.0.1:8787/healthz

  ## PROMPT E1-SMOKE — auto .env + one-command local shadow smoke test (local only)

### Problem
The shadow server does not read the repo `.env` (DATABASE_URL undefined unless passed inline), and
checking it requires several manual steps. Make it ONE command that returns a clear green/red verdict.

### Goal
(1) Load `.env` automatically at server startup. (2) Add a single script that boots the shadow server,
waits for readiness, hits /healthz and the global P&L route, asserts the known goldens, prints a clear
PASS/FAIL, and shuts the server down. Local convenience only. Do NOT change Postgres read-only
behaviour, routes, domain logic, money, checksums, or anything certified.

### What to do
1. Top of `services/api/src/server.ts`: load the monorepo-root `.env` into process.env before reading
   DATABASE_URL (Node `--env-file` via the script, or `dotenv` if already in the tree — no heavy dep).
   Inline `DATABASE_URL=... ` override must still win. Keep the clear error if DATABASE_URL is truly absent.
2. Add `services/api/src/smoke.ts` + a `smoke` script that:
   - starts the server on 127.0.0.1:8787 (reusing the .env-loaded DATABASE_URL),
   - polls GET /healthz until ready (timeout ~20s),
   - GETs /healthz and the global Office P&L endpoint,
   - asserts income == 2214542460 and expense == 1362642716 cents (the certified goldens),
   - prints "SMOKE PASS" with the figures, or "SMOKE FAIL" with the diff,
   - shuts the server down and exits non-zero on any failure.
   Read-only; no writes; no schema change.
3. Do NOT print or commit the .env contents or any secret. Do NOT deploy, do NOT touch WordPress/DNS.

### QA (offline only — do NOT run live)
- `pnpm --filter @ehq/api check` + `build`, then `pnpm check`. All green.
- Do NOT run the live smoke/server yourself — David runs it (it connects to live Supabase, read-only).

### After Codex is done, David runs ONLY this one line:
  corepack pnpm --filter @ehq/api smoke

  ## PROMPT E1-FIX-POOL — fix connect-timeout on the Postgres runtime loader (Promise.all vs max:1)

### Diagnosis (confirmed by a real run)
The shadow server now authenticates fine (URL + encoded password correct). It then fails with
`timeout exceeded when trying to connect` inside readDistributionDataset, at `Promise.all (index 5)`.
Cause: the runtime loader fires multiple table reads concurrently via Promise.all, but the pg pool is
`max: 1`. The parallel queries contend for the single connection and the waiters hit the connect
timeout. This is a loader concurrency bug, not infra, data, or auth.

### Goal
Make the read-only Postgres runtime loader work with the single durable connection. Do NOT change the
read-only behaviour, the routes, domain logic, money, checksums, goldens, or what the loader returns.

### What to do — pick the simpler that fits the code
Option A (preferred): keep `max: 1` and make the loader read tables SEQUENTIALLY — replace the
  `Promise.all([...])` table-read fan-outs in readOfficeDataset and readDistributionDataset with
  awaited sequential queries (or a small p-limit=1 helper). One connection, one query at a time.
Option B: if parallel reads are wanted, raise the pool to a modest `max` (e.g. 4–8, pooler-safe) AND
  add a sane `connectionTimeoutMillis` so a transient wait doesn't abort. Still no per-row connects.
Prefer Option A — it matches the max:1 intent and removes contention entirely; the read volume is
fine sequentially (this is a startup hydrate, not a hot path).

Also: raise/confirm a reasonable `connectionTimeoutMillis` (e.g. 15000) and keep `keepAlive: true`,
so a slow Supabase pooler handshake doesn't false-timeout.

### Guardrails / QA (offline only — do NOT run live)
- Loader concurrency change only; no edits to transforms/money/checksums/goldens/routes.
- `pnpm --filter @ehq/api check` + `build`, then `pnpm check`. Fixture API tests stay green.
- Do NOT run the live server/smoke yourself — David runs it (read-only against live Supabase).

### After Codex is done, David runs:
  corepack pnpm --filter @ehq/api build
  node services/api/dist/server.js     # should now stay up
  # then in another terminal:  curl -s http://127.0.0.1:8787/healthz

  ## PROMPT E2-BUNDLE — self-contained Hostinger shadow bundle + deploy runbook (no live deploy)

### Context
The API runs locally via `node services/api/dist/server.js` only because root `node_modules` (pnpm
workspace) and the `@ehq/*` workspace packages resolve from the monorepo. The Hostinger Node slot has
neither. A self-contained bundle is needed so the app runs standalone on the slot.

### Goal
Produce ONE self-contained deployable bundle for the Hostinger Node slot (SHADOW, non-prod), and write
exact deploy + rollback steps. Do NOT deploy, do NOT touch DNS or WordPress, do NOT print/commit secrets.

### What to do
1. Add an esbuild bundling step that compiles `services/api/src/server.ts` into a single file
   `services/api/deploy/server.bundle.mjs`:
   - `--bundle --platform=node --format=esm --target=node18`
   - inline ALL workspace packages (`@ehq/*`) AND npm deps (hono, pg, etc.). pg is pure-JS, bundles fine.
   - if anything genuinely cannot be bundled, externalize it and list it with exact version.
2. Make HOST/PORT slot-friendly at runtime (the slot injects PORT and needs 0.0.0.0):
   - `HOST` default `0.0.0.0` (NOT 127.0.0.1), `PORT` from `process.env.PORT` with fallback 8787.
   - keep `/healthz`. Keep loading `.env` if present, but env vars injected by the slot must win.
   - DATABASE_URL read from env at runtime (the slot provides it; never bake it into the bundle).
3. Create `services/api/deploy/` containing: `server.bundle.mjs`, a minimal `package.json`
   (`"type":"module"`, `"start":"node server.bundle.mjs"`, `"engines":{"node":">=18"}`), and a short
   `START.md`. If fully bundled, no node_modules needed; if anything was externalized, the package.json
   must list it so `npm install --omit=dev` works on the slot.
4. Write/extend `DEPLOY.md` (next to CUTOVER.md) with exact ordered steps for a NON-PROD shadow on
   Hostinger: upload `services/api/deploy/` to a non-prod path/subdomain (NOT the WordPress domain), set
   env vars (DATABASE_URL = the NEW rotated password, HOST, PORT), the start command, the health-check
   curl (`/healthz`), and rollback (stop the shadow; WordPress stays untouched). State clearly: this is
   shadow, WordPress stays live, cutover is a separate later step.

### Guardrails / QA (offline only — do NOT run live)
- No deploy, no DNS, no WordPress edits. Do not commit `.env` or any secret.
- Build the bundle; confirm `services/api/deploy/server.bundle.mjs` exists and is non-trivial.
- `pnpm --filter @ehq/api check`, then `pnpm check`. Fixture tests stay green.
- Do NOT run the bundle live yourself — David runs it on the slot.

### After Codex: David
  # sanity-run the bundle locally first (reads .env):
  node services/api/deploy/server.bundle.mjs   # then curl /healthz in another tab
  # then upload services/api/deploy/ to the Hostinger non-prod slot, set env, start, health-check.

  ## PROMPT E2-BUNDLE-FIX — fix "Dynamic require" by externalizing pg (CJS) from the ESM bundle

### Diagnosis (confirmed by a real local run)
`node services/api/deploy/server.bundle.mjs` fails at load:
  `Error: Dynamic require of "events" is not supported`
Cause: the bundle is ESM (.mjs) but `pg` (and its deps) use internal CommonJS `require()`. esbuild's
ESM output cannot satisfy those dynamic requires, so the bundle crashes when `pg` initializes.

### Goal
Make the deploy bundle actually run under `node server.bundle.mjs`. Externalize `pg` (and any other
CJS-only native-ish dep that breaks ESM bundling) and install it on the slot via npm. Bundle everything
else (hono, @ehq/*). Do NOT change runtime behaviour, routes, money, read-only logic.

### What to do
1. In the esbuild step, add `--external:pg` (and `--external:pg-*` if needed, e.g. pg-pool/pg-cloudflare
   are pulled by pg). Keep `--bundle --platform=node --format=esm --target=node18` for the rest.
   If other deps throw the same dynamic-require error, externalize them too and list them.
2. Update `services/api/deploy/package.json` so the externalized deps are real dependencies installed on
   the slot: add `"pg": "<exact version from the lockfile>"` (and any other externalized one). Keep
   `"type":"module"`, `"start":"node server.bundle.mjs"`, `"engines":{"node":">=18"}`.
3. Update `START.md`: the slot must run `npm install --omit=dev` (to fetch pg) BEFORE `npm start`.
4. Re-build the bundle. It must now load `pg` from node_modules at runtime, not from the bundle.

### Guardrails / QA (offline only — do NOT run live)
- No behaviour change; only the bundling/externalization + deploy package.json/START.md.
- `pnpm --filter @ehq/api check`, then `pnpm check`. Fixture tests stay green.
- Do NOT deploy. David runs the local bundle test and the slot deploy.

### After Codex: David re-tests locally FIRST
  cd <repo>
  (cd services/api/deploy && npm install --omit=dev)   # installs pg next to the bundle
  node services/api/deploy/server.bundle.mjs            # must print "listening", not crash
  # then curl /healthz in another tab

↳ APPEND THIS VERBATIM TO THE END OF MIGRATION_PROMPTS.md. Do NOT keep it as a separate
  prompt file. It is one block in the single canonical workstream file.

────────────────────────────────────────────────────────────────────────────────────────

## PROMPT G — Operator back: real Postgres read+write (finish EVERY write in one pass)

### Context (already true — do NOT redo, do NOT regress)
- The Hono API (`services/api`) is deployed read-only on `api.eeee.mu`, hydrating an in-memory
  `ApiFixtureStore` from migrated Supabase Postgres at boot via
  `services/api/src/postgres.ts` → `readApiFixtureStoreFromPostgres(pool)` → `createApiService({ fixtures })`.
- All READ endpoints are certified against live Postgres. The documented divergence **BUG-M1**
  (org-wide project/partner P&L: WordPress returns Rs 0, new returns real totals) is EXPECTED — never
  "fix" it to 0. Money math, checksums, and golden read-back values are certified — do NOT touch them.
- **The write business logic already exists, built and fixture-tested, in the domain packages**
  (PROMPTS D, F3, F4). Every endpoint below has a plan-builder already written. This prompt does NOT
  reimplement business logic — it WIRES the existing plans to real Drizzle transactions and adds the
  few missing reads. The plan-builders return executable PLANs precisely so the API persists them
  "atomically via a thin persistence wrapper using a Drizzle transaction" — that wrapper is what's
  missing and what you build here.
- Today every POST/PATCH handler in `services/api/src/index.ts` returns a fixture receipt
  (`createMutationReceipt` / `ApiMutationReceipt` / `ApiRunReceipt`) and each surface is hard-coded
  `accessMode: "read-only"`. There is currently NO Drizzle write client anywhere — only raw `pg`
  read queries.
- Auth exists: `services/api/src/auth.ts` (`createSupabaseJwtVerifier`, `createSupabaseAuthMiddleware`,
  env `SUPABASE_JWT_SECRET`, symmetric HS + asymmetric JWKS).

### Goal
Turn `services/api` into a real read+WRITE operator back in ONE pass: add a transactional Drizzle write
client over the existing pool; wire every operator write endpoint to its already-built domain
plan-builder and persist the plan atomically to the real Drizzle tables; add the missing read routes
the operator app needs; and make the API tolerant of the operator app's legacy request shape so the
front needs almost no change. Reads must reflect writes within the same running process. Offline build
+ tests only — **David runs every live command and the redeploy.**

### Where it lives
- New write client + transactional persistence wrappers: `services/api/src/persistence.ts` (new), built
  on `drizzle-orm/node-postgres` over the SAME `pg.Pool` created in `postgres.ts` (keep `max:1` reads as
  is; the write client may use the same pool or a second small pool — your call, but pooler-safe and no
  per-row connects).
- Reuse the schema in `@ehq/db` (`packages/db/src/office/schema.ts`, `.../distribution/schema.ts`) —
  table objects already exist: `transactions`, `financialAllocations`, `sharedCostRules`,
  `royaltyRules`, `earningAllocations`, `expenseApplications`, `contractCostTerms`, `suspenseItems`,
  `calculationRuns`, `statements`, `statementLines`, `payeeBalances`, `payments`,
  `statementPaymentLinks`, `fxRates`, `exchangeRates`, `identityLink`, `normalizedEarnings`,
  `rawImportRows`, `importBatches`, `importIssues`, `payees`, `partners`, `contracts`.
- Reuse the domain plan-builders (do NOT reimplement; import and call):
  - Office: `createReplaceAllocationsPlan(dataset: OfficeAllocationReplaceDataset, request)`,
    `transactionCanBeValidated(transaction, allocations)`, `allocationsAreComplete`.
  - Distribution: `buildAllocationPlan(earning, rules, costState)`, `splitRoyaltyShares`,
    `buildStatementPlan(payee, period, currency, allocations, lastClosing, version)`,
    `buildStatementsForPeriod(payees, period, allocations, lastClosings)`, `buildVoidPlan(statement, ledgerRow)`,
    `computeStatementBalance(statement, paymentLinks)`, `computeStatementGroupTotals(statements, paymentLinks)`.
  - Money: always via `@ehq/domain-finance` (`eofMoney` scale micro, `erhMoney` scale 10). NEVER JS floats.

────────────────────────────────────────────────────────────────────────────────────────
### PART 1 — Real read+write runtime (the flip)

1. **Drizzle write client + transaction helper** in `persistence.ts`: `withTx(fn)` that opens a Drizzle
   transaction on node-postgres, runs `fn(tx)`, commits, and rolls back on any throw. All writes below
   go through ONE `withTx` per request (atomic).
2. **Flip `accessMode`** for the mutating surfaces from `"read-only"` to a new `"read-write"` value
   (extend `LegacyAccessMode`). Read-only surfaces with no writes stay read-only. Do NOT remove the
   read path.
3. **Auth on writes:** every POST/PATCH that now persists MUST require a valid Supabase Bearer via the
   existing `createSupabaseAuthMiddleware`. Reject missing/invalid token with 401. Reads keep their
   current behaviour. Operator write actions that are admin-only in the front (allocations run,
   statements generate, payments, fx-rates, contract rules, imports) require `role` = administrator in
   the verified JWT; return 403 otherwise.
4. **Idempotency (no double-post):** honor an `Idempotency-Key` header on POST writes that create money
   movements (`/eof/v1/transactions`, `/erh/v1/payments`, `/erh/v1/statements/generate`,
   `/erh/v1/allocations/run-pending`). Persist the key + the resulting id; a repeat key returns the
   SAME result without re-writing. A double-click must never double-post.
5. **Read-after-write consistency (REQUIRED):** after a successful write, a subsequent read in the same
   process MUST reflect it. Office datasets are small (≤ ~3k tx) — after an Office write, re-hydrate the
   Office slice of the in-memory store from Postgres. Distribution tables are large (155k earnings) —
   do NOT full-re-hydrate distribution on every write; instead, for the mutated distribution surfaces
   (statements, payments, allocations, suspense, payee_balances) serve those specific reads live from
   Postgres (targeted queries), or apply an incremental in-memory patch. Never re-read 155k rows per
   write.
6. **Compatibility layer (so the front barely changes):** accept BOTH the operator app's legacy query
   names AND the new ones on every endpoint:
   - `month` ⇄ `period`, `payee_id` ⇄ `payeeId`, `partner_id` ⇄ `partnerId`, `offset`/`page` as the
     front sends them.
   - Make `workspaceId` OPTIONAL: when absent, default to the single migrated workspace (resolve the
     one workspace id present in the data; if a constant is cleaner, define `DEFAULT_WORKSPACE_ID` and
     document it in `ENGINE_NOTES.md`). Reads that today hard-require `workspaceId` must work without it.

────────────────────────────────────────────────────────────────────────────────────────
### PART 2 — Wire every write endpoint to its plan-builder + Drizzle transaction

Replace the receipt-only body of each handler with: parse → load the plan-builder's required inputs
from Postgres → call the plan-builder → persist its plan inside `withTx` → return the real result
(real ids, real persisted state), not a fixture receipt. Keep the legacy eof/v1 + erh/v1 response shapes.

**Office (eof/v1):**
- `POST /eof/v1/transactions`, `PATCH /eof/v1/transactions/:id` — validate with
  `transactionCanBeValidated`; on validate, enforce the rules (amount>0, fx, vat, allocations complete);
  persist the transaction row + status. Reject with the legacy failure-reason codes
  (`amount_invalid`, `fx_missing`, `vat_missing`, `allocations_missing`, `allocations_incomplete`).
- Allocation replace — load `OfficeAllocationReplaceDataset` (transactions, departments,
  existingAllocations, sharedCostRules, projectDepartments) for the target tx; call
  `createReplaceAllocationsPlan`; persist the plan: delete prior `financial_allocations` for the tx and
  insert the plan's rows (incl. shared-cost expansion) in one tx. (Wire it on the route the operator
  uses for allocations; if the operator posts allocations via the transaction PATCH/validate flow,
  attach it there. Match the eof/v1 allocation contract.)
- `POST /eof/v1/partners/:partnerId/payee-link`, `PATCH` same — persist the Office side of
  `identity_link` (office_partner_id ⇄ payee). Real upsert, not a receipt.
- Keep already-real-ish flows correct: `bank-import/preview`+`confirm`, `reconciliations/approve`,
  `plan-comptable` writes — persist to the real bank/reco/plan tables in a tx (preview stays
  non-persisting; confirm persists).

**Distribution (erh/v1):**
- `POST /erh/v1/allocations/run-pending` (NEW path; also keep `/allocations/runs`): for each pending
  `normalized_earnings` not yet allocated, load its `royalty_rules` and `DistributionCostState`
  (`costTerms` from `contract_cost_terms`, `expenseApplications`, `fxRates`); call `buildAllocationPlan`;
  persist per earning in one tx: insert `earning_allocations` (`EarningAllocationInsert`), insert
  `expense_applications` (`ExpenseApplicationInsert`), update `contract_cost_terms`
  (`CostTermStatusUpdate`), and on `invalid_split`/suspense outcome insert `suspense_items`
  (`DistributionSuspenseItemInsert`) — never silently drop. Create a `calculation_runs` row wrapping the
  batch (started/finished/status, counts). Strict split rule: percentages must sum to EXACTLY
  100.000000 (scale 6) else suspense.
- `POST /erh/v1/statements/generate`: the operator sends payee/period/currency (NOT a `lockKey`). Load
  the period's `earning_allocations` for the payee+currency + the latest `payee_balances` closing; call
  `buildStatementPlan` (or `buildStatementsForPeriod` for all-currencies). Persist in one tx: insert
  `statements` (`StatementInsertPlan`), insert `statement_lines` (`StatementLineInsertPlan`), append
  `payee_balances` (`PayeeBalanceInsertPlan`). **Locking:** make generation safe under concurrency —
  unique constraint on (payee, period, currency, version) with ON CONFLICT, or a Postgres advisory lock
  per (payee,period,currency); never produce two live statements for the same key.
- Statement void/reversal — call `buildVoidPlan(statement, ledgerRow)`; append the compensating
  `payee_balances` reversal row (append-only; never delete ledger history). Wire on the operator's void
  route if present; if not exposed yet, add `POST /erh/v1/statements/:id/void` (admin-only).
- `POST /erh/v1/payments`, `PATCH /erh/v1/payments/:id`, `POST /erh/v1/payments/:id/reconcile`: persist
  the `payments` row + `statement_payment_links`; recompute balances with `computeStatementBalance` /
  `computeStatementGroupTotals` (integer scale-10; honor the F4 fix — no float cast in group totals).
- `POST /erh/v1/contracts/:contractId/rules` (NEW): write the `royalty_rules` for the contract (the
  rows `buildAllocationPlan` later consumes). Validate the split sums to EXACTLY 100.000000 before
  persist; reject otherwise. One tx (replace-set semantics for the contract's rules).
- `POST /erh/v1/fx-rates` (NEW) + `GET /erh/v1/fx-rates` (NEW): upsert/read `fx_rates` (and/or
  `exchange_rates` per the schema's FX source of truth — pick the one the recoupment/statement path
  reads, document it). Upsert by (base,quote,as_of).
- `POST /erh/v1/payees/:payeeId/partner-link` (NEW) + `GET` same (NEW): persist/read the Distribution
  side of `identity_link` (payee ⇄ office_partner). This is the office↔distribution bridge.
- `POST /erh/v1/imports/upload` (NEW, multipart): accept the uploaded distributor file and route it
  through the EXISTING erh import normalization the API already has (`imports/preview` + `imports/confirm`
  logic) — do NOT invent new parsers. Persist `raw_import_rows` + an `import_batches` row; rows that the
  current normalization recognizes flow to `normalized_earnings`; rows it cannot parse go to
  `import_issues` and/or `suspense_items` — NEVER silently dropped, NEVER faked. **Honesty:** runtime
  per-distributor parsers (RouteNote/Kontor/DistroKid/Ditto) do NOT exist yet (only the one-shot ETL in
  `packages/migration-tools`). So for unknown formats this endpoint ingests-and-flags rather than
  fully-parsing; that is the correct behaviour until the parser chantier lands. Document this clearly in
  `ENGINE_NOTES.md` and return a structured result telling the operator how many rows normalized vs
  went to issues/suspense.

────────────────────────────────────────────────────────────────────────────────────────
### PART 3 — Add the missing READ routes the operator app needs

Add these reads (most are a query + a serializer; the datasets/domain reads largely exist — reuse
`readAllocationList`, `readStatementSummaries`, `readSuspense`, the office bank/PnL readers):
- EOF `GET /eof/v1/bank/accounts`, `GET /eof/v1/bank/raw`, `GET /eof/v1/pl/division`.
- ERH `GET /erh/v1/ping` (cheap liveness the WordPress-era front probes — return `{ ok: true }`),
  `GET /erh/v1/allocations` (legacy allocation rows via `readAllocationList`),
  `GET /erh/v1/allocations-by-currency`, `GET /erh/v1/payees/:payeeId`,
  `GET /erh/v1/contracts/:contractId` (the contract detail, not just `/expenses`),
  `GET /erh/v1/statements/:statementId/print` (printable statement payload),
  `GET /erh/v1/fx-rates` (see Part 2), `GET /erh/v1/payees/:payeeId/partner-link` (see Part 2).
All reads honor the Part 1 compatibility layer (legacy param names, optional workspaceId).

────────────────────────────────────────────────────────────────────────────────────────
### Guardrails (apply the file's AUTO-MODE GUARDRAILS too)
- Do NOT change read money math, checksums, golden read-back values, or the documented BUG-M1.
- Do NOT reimplement business logic — import and call the existing domain plan-builders. If a builder is
  missing an input you need, LOAD it from Postgres; do not recompute money in the API.
- All writes atomic via `withTx`; on any error, roll back and return a structured error — never a
  partial write. Append-only ledgers stay append-only (payee_balances, voids).
- Do NOT print or commit secrets. Do NOT deploy. Do NOT touch DNS or the WordPress install. Do NOT
  remove `WP_BASE_URL` / `WP_APP_PASSWORD`. **David runs every live command and the redeploy.**
- Keep the esbuild bundle constraint: `--external:pg` (and `pg-*` if pulled); `drizzle-orm` is pure-JS
  and bundles fine. Update `services/api/deploy/package.json` only if a NEW externalized dep appears.

### QA gate (offline only — all must pass before "done")
- `pnpm --filter @ehq/api check` + `build`, then `pnpm check`. All green.
- Existing fixture READ tests stay green (no read regressions).
- Add WRITE-path tests with pglite (or a transaction-rollback harness) for at least: office allocation
  replace (plan persisted = plan computed; shared-cost expansion lands), erh allocations run-pending
  (allocations + expense applications + cost-term updates + suspense on invalid_split), statements
  generate (statements + lines + appended payee_balances; carry-forward invariant; concurrency lock
  prevents duplicates), payments (balance recompute, no float drift), idempotency (repeat key = same
  result, single write), contract rules (rejects split ≠ 100.000000), fx-rates upsert, identity-link
  both sides. Each test asserts read-after-write reflects the change in-process.
- Rebuild the deploy bundle; confirm `services/api/deploy/server.bundle.mjs` exists and is non-trivial.
- Do NOT run the live server/smoke/deploy yourself.

### After Codex is done, David runs (live):
 corepack pnpm --filter @ehq/api check
  corepack pnpm --filter @ehq/api build
  node services/api/deploy/server.bundle.mjs        # boots, connects, /healthz ok (writes require Bearer)
  # then re-zip + redeploy to the api.eeee.mu Hostinger slot exactly as before:
  #   cd services/api/deploy && rm -f ../deploy-api.zip && zip -r ../deploy-api.zip . && cd ../../..
  #   Hostinger → upload new files → set env (DATABASE_URL, SUPABASE_JWT_SECRET) → restart → health-check
  # SUPABASE_JWT_SECRET must be set on the slot for write auth to verify.

### Honest caveats (state in ENGINE_NOTES.md, do not paper over)
- Recoupment + statement WRITES run the F3/F4 engines against real data for the first time. The engines
  are unit-tested but were never live-parity-validated (recoupment_applied=0 across migrated data).
  Validate on the first real closes; keep voids/append-only so any first-close error is reversible.
- imports/upload ingests-and-flags for distributor formats without a runtime parser (parsers are a
  separate later chantier). It must never fabricate normalized earnings.
- The operator front (`ë • Entreprise/scaffold`, a DIFFERENT repo, not in this monorepo) still needs a
  small adapter: point its base URL at `api.eeee.mu` and send a Supabase Bearer instead of WordPress
  Basic Auth. Part 1's compatibility layer (legacy param names + optional workspaceId) is what keeps
  that change small — it is the immediately-following prompt, not this one.
 
↳ APPEND THIS VERBATIM TO THE END OF MIGRATION_PROMPTS.md, after PROMPT G + its addendum.
  Do NOT keep it as a separate prompt file. Same workstream (WordPress exit) = same single file.
  NOTE: this prompt patches a SIBLING repo (the operator front), not ehq-platform. Codex has local
  access to it; ehq-platform's MIGRATION_PROMPTS.md remains the single workstream record.

────────────────────────────────────────────────────────────────────────────────────────

## PROMPT H — Re-point the ehq-entreprise operator front to the new API (Phase 1: reads-preview)

### Context (already true — do NOT regress)
- PROMPT G (+ its execution/conformance addendum) makes the Hono API at `api.eeee.mu` serve the
  migrated Postgres with a **legacy-compatibility layer**: it accepts the operator app's legacy query
  names (`month`, `payee_id`, `partner_id`, `offset`) and makes `workspaceId` optional. So the front
  does NOT need to rewrite every query — it needs base-URL + auth + honest-disable changes.
- The canonical operator front is the SvelteKit app at
  `/Users/poups/Documents/Codex/Projects/ë • Entreprise/scaffold` (per its own DEPLOY.md; other copies
  are deploy outputs/snapshots — ignore them). It uses `@sveltejs/adapter-node` → `build/index.cjs`.
- Today it talks to **WordPress**: `WP_BASE_URL=https://www.e-hq.eeee.mu` → `eof/v1` + `erh/v1`, auth =
  **WordPress Basic Auth**, plus a signed `ehq_session` cookie via `SESSION_SECRET`, and `/console/*`
  admin-gating in `+layout.server.ts`. Supabase env is present but UNUSED in code.
- This is **Phase 1 of the rewire: reads only.** Per the PROMPT G addendum, Part 2 writes are NOT live
  yet (cutover-gated, Q4 protection). So the operator front becomes a **real-data PREVIEW**: reads hit
  the new API and render migrated data; write actions are **visibly disabled** — NEVER a fake success.
- WordPress (`www.e-hq.eeee.mu`) stays live and canonical for Q4. This prompt does NOT touch WordPress,
  DNS, or deploy anything. **David builds and deploys.**

### Goal
Re-point the ehq-entreprise operator front from WordPress to the new Hono API for READS, swap its auth
from WordPress Basic Auth to Supabase, and put every write action into an honest disabled "preview"
state. After this, the real operator front renders real migrated data through `api.eeee.mu`, logged in
via Supabase, with no write going live and no fake success. Offline verification route-by-route only.

### Where it lives
The `scaffold` repo above (SIBLING to ehq-platform). **Do not edit ehq-platform for this prompt** except
to keep this record in MIGRATION_PROMPTS.md.

────────────────────────────────────────────────────────────────────────────────────────
### STEP 0 — Inventory first (Codex local; confirm before patching)
Before changing anything, locate and report (read-only):
- where the API base URL is set (env `WP_BASE_URL` usage, any `fetch`/client wrapper for `eof/v1` +
  `erh/v1`), and the full list of API call sites.
- where WordPress Basic Auth is constructed (the Authorization header / credentials), the WP login flow,
  and the `ehq_session` cookie signing (`SESSION_SECRET`).
- the `/console/*` route list and the admin-gating in `+layout.server.ts` (how role is currently
  derived from WordPress).
- the existing (unused) Supabase env names and any Supabase client already scaffolded.
- the build/start config (`svelte.config` adapter-node, `package.json` scripts, `preload-env.cjs`).
Produce a short inventory note (paths + line refs). Then patch per the parts below.

────────────────────────────────────────────────────────────────────────────────────────
### PART 1 — Base URL → the new API (env-driven)
- Introduce `PUBLIC_API_BASE_URL` (SvelteKit public env; equivalently `VITE_API_BASE_URL`) and route
  ALL `eof/v1` + `erh/v1` calls through it. Default to `https://api.eeee.mu`; never hardcode.
- Remove the use of `WP_BASE_URL` for API calls. (Keep no residual WordPress API base anywhere — grep
  must come back clean.)

### PART 2 — Auth swap: WordPress Basic Auth → Supabase (the meat)
- Add Supabase auth to the operator front using the SvelteKit-standard `@supabase/ssr`
  (`createServerClient` + `createBrowserClient`), env `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY`.
  Give the operator its OWN Supabase email/password login for now (true SSO/login-once-at-HQ is a later
  refinement — out of scope here).
- On EVERY `eof/v1` + `erh/v1` request, attach the Supabase **access_token as `Authorization: Bearer`**.
  Remove the WordPress Basic Auth header construction entirely.
- Replace the signed `ehq_session` cookie / `SESSION_SECRET` mechanism with the Supabase session managed
  by `@supabase/ssr` (server hooks + cookies). Retire `SESSION_SECRET` usage for the session.
- `/console/*` admin gating in `+layout.server.ts`: switch from the WordPress role check to the Supabase
  user's role — `role === "administrator"` from the verified JWT / `user_metadata`. No implicit access
  (AGENTS §5). Unauthenticated → redirect to login; authenticated-non-admin → 403, exactly as today but
  sourced from Supabase.
- Keep the liveness probe working: the old WordPress-era `erh/v1/ping` probe now hits the new Hono
  `GET /erh/v1/ping` (added by PROMPT G Part 3). Use it to confirm API reachability post-login.

### PART 3 — Honest-disable every write action (Phase 1 = no fake success)
- Introduce `PUBLIC_OPERATOR_MODE` with values `preview` | `live`, default `preview`.
- In `preview` mode, every `/console/*` write control (fx-rates save, statements/generate,
  allocations/run, payments record/reconcile, contracts/rules, imports/upload, identity-link) is
  rendered **disabled** with an explicit banner/label: "Preview — actions not enabled yet (read-only
  against the new API)". The SvelteKit form actions for these MUST NOT POST to the write endpoints in
  preview mode.
- Defense in depth: if any write is nonetheless attempted, the Hono side returns 501 (per the PROMPT G
  addendum). Handle that response with an honest error surface — NEVER a success toast, NEVER optimistic
  UI for money actions (AGENTS §4). When Part 2 writes go live post-cutover, `PUBLIC_OPERATOR_MODE=live`
  re-enables the controls; that flip is a later step.

### PART 4 — Reads (should "just work" via the Hono compat layer)
- Because PROMPT G's compat layer accepts the legacy query names and optional `workspaceId`, the
  existing read call sites should work after Parts 1–2 with minimal change. Where a specific read maps
  to a Hono route added in PROMPT G Part 3 (`bank/accounts`, `bank/raw`, `pl/division`, `payees/:id`,
  `contracts/:id`, `statements/:id/print`, `fx-rates` GET, `allocations`, `allocations-by-currency`),
  point the call at it. Do NOT invent client-side money math — render what the API returns
  (AGENTS §1 calculate-once).

────────────────────────────────────────────────────────────────────────────────────────
### Guardrails
- READS only go live in this phase. No write endpoint is enabled. No fake success anywhere.
- Do NOT touch WordPress, DNS, or the ehq-platform backend code. Do NOT deploy. Do NOT print/commit
  secrets. **David builds and deploys.**
- No residual WordPress Basic Auth / `WP_BASE_URL` API usage may remain (grep clean).
- Keep adapter-node output intact (`build/index.cjs`); do not change the deploy shape.

### QA gate (offline, route-by-route — all must pass before "done")
- The scaffold builds: `npm run build` (or its pnpm equivalent) → `build/index.cjs` produced.
- Lint/type-check green.
- Local run against `api.eeee.mu` (David runs the live part): after Supabase login, every `/console/*`
  READ page renders real migrated data; the `erh/v1/ping` probe succeeds; non-admin is blocked; every
  write control shows the disabled "preview" state and does not POST.
- Grep proof: no `Authorization: Basic`, no `WP_BASE_URL` API base, no `ehq_session`/`SESSION_SECRET`
  session signing left in the codebase.
- Codex does NOT run the live server/deploy — David does.

### After Codex is done, David runs (live):
- Set front env: `PUBLIC_API_BASE_URL=https://api.eeee.mu`, `PUBLIC_SUPABASE_URL=…`,
  `PUBLIC_SUPABASE_ANON_KEY=…`, `PUBLIC_OPERATOR_MODE=preview`.
- Supabase → Authentication → Providers → enable Email; add the admin user with
  `user_metadata {"role":"administrator"}` (same convention as the apps/hq login).
- Ensure `api.eeee.mu` slot has `SUPABASE_JWT_SECRET` set (PROMPT G needs it to verify the Bearer).
- Build (adapter-node) and deploy the operator front to the chosen slot. **Deploy-target decision is
  David's:** `app.eeee.mu` currently serves the apps/hq static front; the operator (adapter-node) either
  replaces it there or goes to its own subdomain. Codex does not decide this; it only produces the
  re-pointed build.
- Verify route-by-route in the browser: reads real data, login works, writes show preview-disabled.

### Honest notes (state in the scaffold's own notes / ENGINE_NOTES.md)
- This is reads-preview. Writes are built+tested on the Hono side (PROMPT G Phase 2) but enabled only at
  cutover (Q4 protection, AGENTS §2 no-split-brain).
- The operator gets its own Supabase login here; unifying login with apps/hq (login once at HQ, operator
  consumes the session) is a later refinement, not this prompt.

↳ APPEND THIS VERBATIM TO THE END OF MIGRATION_PROMPTS.md (after PROMPT G + addendum + PROMPT H).
  Same workstream = same single file. Patches ehq-platform/services/api only.

────────────────────────────────────────────────────────────────────────────────────────

## PROMPT I — Phase 2 / action 1: shared write infrastructure + imports & bank-import preview/confirm

### Context (already true — do NOT regress)
- Phase 1 shipped: `services/api` has the legacy-compat read layer + honest-disabled writes. Every write
  route currently requires `Idempotency-Key` then returns `501 {"error":"action_not_enabled_yet",...}`
  via `disabledWriteResponse`. Helpers exist: `requireCompatQuery`, `optionalCompatQuery`,
  `resolveWorkspaceId` (fallback `workspace_1`), `requirePositiveInteger`, `disabledWriteResponse`,
  `equalNames`, etc. Reads are served from the Postgres-hydrated in-memory store. Tests green (9/9),
  bundle builds.
- The domain plan-builders already exist (PROMPTS D/F3/F4) — this phase WIRES them, never reimplements.
- This is **Phase 2, action 1 of 6**, in the fixed order:
  **imports preview/confirm → allocation preview/run → statements generate → payment record/reconcile →
  contracts/rules → identity-link.** One action per run. This run ALSO builds the shared write
  infrastructure that every later action reuses.
- Contract gates (AGENTS §4/§5), enforced on every mutating route: idempotency key, audit_event,
  explicit permission, integer money (no floats), atomic `withTx`, append-only/override (never
  destructive), imports batch-based + reversible, concurrency lock, no-fake-success.

### THE WRITES_ENABLED GATE (read first — this is how Phase 2 stays cutover-safe)
- Add a runtime flag `WRITES_ENABLED` (env, default **false**). It reconciles "build writes now" with
  "enable only at cutover" (AGENTS §2 no-split-brain; WordPress stays canonical for Q4).
- When `WRITES_ENABLED=false` (the deployed `api.eeee.mu` slot, until cutover): a wired write route
  returns the SAME honest `disabledWriteResponse` (501, `action_not_enabled_yet`) AFTER enforcing
  `Idempotency-Key` + permission. No persistence happens. No fake success.
- When `WRITES_ENABLED=true` (tests, local, and eventually the cutover deploy): the route runs the real
  persistence path below.
- A route that is NOT yet wired in this phase keeps its current hardcoded `disabledWriteResponse`.
- David keeps `WRITES_ENABLED=false` on the deployed slot for the entire Phase 2. He flips it true only
  at cutover (after Q4), then redeploys.

### Goal
Stand up the shared write infrastructure once, then wire the first action (imports + bank-import
preview/confirm) on top of it, behind the gate. Offline build + pglite tests only. **David runs every
live command and the redeploy; David does NOT enable writes in prod in this phase.**

### Where it lives
- New: `services/api/src/persistence.ts` — the Drizzle write client + `withTx` + the shared write
  helpers (idempotency store, audit append, permission check, read-after-write). Built on
  `drizzle-orm/node-postgres` over the SAME pool created in `services/api/src/postgres.ts` (pooler-safe,
  no per-row connects). Reuse `@ehq/db` table objects.
- Wire the two action surfaces in `services/api/src/index.ts`, reusing the existing helpers David added.

────────────────────────────────────────────────────────────────────────────────────────
### PART A — Shared write infrastructure (built once, reused by all later actions)

1. **`withTx(fn)`** — opens a Drizzle transaction on node-postgres, runs `fn(tx)`, commits, rolls back
   on any throw. Every write is exactly one `withTx` (AGENTS §4 atomic: full success or full rollback).
2. **Idempotency store** — a table (or reuse one if the schema has it; else add a Drizzle migration for
   `api_idempotency_keys { key text pk, route text, request_hash text, response_json jsonb, created_at }`
   + helpers `beginIdempotent(key, route, requestHash)` / `completeIdempotent(...)`. Contract
   (AGENTS §4 "every mutation carries an idempotency key"): a repeated key returns the stored response
   WITHOUT re-writing; a key replayed with a different request body is a 409 conflict. A double-click
   never double-posts.
3. **Audit append** — `appendAuditEvent(tx, { actor, action, targetType, targetId, before, after,
   idempotencyKey })` writing one row to the audit table the schema defines (the one the existing
   `/audit-log` read serves). Called INSIDE the same `withTx` as the mutation (AGENTS §4 "every
   financial state change writes an audit_event"). No audit row → the write does not commit.
4. **Explicit permission** — `requirePermission(context, action)` that verifies the Supabase Bearer
   (reuse `auth.ts` `createSupabaseAuthMiddleware`/verifier) and checks an explicit allow for `action`.
   No implicit access (AGENTS §5). Sensitive actions (imports, allocations, statements, payments,
   fx-rates, contract rules) require `role==="administrator"`; this is ON TOP OF the explicit check.
5. **Read-after-write** — after a successful write, a subsequent read in the same process reflects it.
   Office surfaces (small): re-hydrate the affected Office slice from Postgres. Distribution surfaces
   (155k rows): serve the mutated surfaces (import batches, normalized earnings, etc.) via targeted live
   reads or an incremental in-memory patch — NEVER full-re-hydrate 155k rows per write.
6. **The gate** — a single guard used by every wired write: enforce `Idempotency-Key` presence +
   `requirePermission`, then if `WRITES_ENABLED!==true` return `disabledWriteResponse`; else run the
   real path. Keep `disabledWriteResponse`'s exact 501 shape.

### PART B — Wire action 1: imports & bank-import preview/confirm

**STEP 0 — inventory first (Codex local; my repo copy predates Phase 1):** read the CURRENT bodies of
`POST /erh/v1/imports/preview`, `POST /erh/v1/imports/confirm`, `POST /eof/v1/bank-import/preview`,
`POST /eof/v1/bank-import/confirm`, and determine what the operator front actually SENDS to confirm:
already-normalized rows, or raw rows needing parsing. Report it, then implement accordingly.

**Preview (dry-run, NO persistence):**
- `imports/preview` (erh) and `bank-import/preview` (eof): compute and return the preview — counts,
  would-be normalized rows, detected issues — and write NOTHING. Preview never touches the DB. Goes
  through permission but is exempt from the WRITES_ENABLED gate (it is read-only).

**Confirm (persist a batch — batch-based + reversible, AGENTS §4):**
- `imports/confirm` (erh): inside `withTx`, persist an `import_batches` row + `raw_import_rows`;
  recognized rows → `normalized_earnings`; unrecognized → `import_issues` (and/or `suspense_items`),
  NEVER dropped, NEVER faked. Append the audit_event. Make the batch **reversible**: a batch carries the
  ids it created so it can be voided/unposted later (add `POST /erh/v1/imports/batches/:batchId/reverse`
  if no reverse path exists — append-only reversal, not destructive delete of source rows).
- `bank-import/confirm` (eof): same pattern into `office_bank_import_batches` +
  `office_bank_statement_lines`, reversible, audited.
- **Honesty (runtime parsers):** per-distributor parsers (RouteNote/Kontor/DistroKid/Ditto) do NOT exist
  as runtime code (only the one-shot ETL in `packages/migration-tools`). If confirm receives raw rows in
  a format without a runtime parser, ingest-and-flag (`raw_import_rows` + `import_issues`), do NOT
  fabricate `normalized_earnings`. If confirm receives already-normalized rows from the front, persist
  them directly. Whatever the inventory shows, document the chosen contract in `ENGINE_NOTES.md` and
  return a structured result (counts: persisted vs issues/suspense).
- Both confirms run behind the gate: with `WRITES_ENABLED=false` they return the honest 501 after
  permission + idempotency; with `=true` they persist as above.

────────────────────────────────────────────────────────────────────────────────────────
### Guardrails (+ the file's AUTO-MODE GUARDRAILS)
- Import + call domain logic where it exists; never re-derive money in services/api (AGENTS §1).
- Integer micro-units / scale-10 only; no floats (AGENTS §4).
- Every write: one `withTx`, idempotency, audit_event, explicit permission — no exceptions.
- Imports are batch-based + reversible; source rows are append-only/override, never destructively
  edited (AGENTS §2/§4).
- Do NOT enable writes in prod. Do NOT print/commit secrets. Do NOT deploy, touch DNS, or WordPress.
  **David runs live + redeploy.**
- Do NOT regress Phase 1: reads, compat layer, the disabled-write shape, and the certified read money
  math / BUG-M1 stay intact. Keep the bundle's `pg` externalization (no "Dynamic require" regression).

### QA gate (offline only — all must pass before "done")
- `corepack pnpm --filter @ehq/api check` + `test` + `build` + `build:deploy`. All green.
- Phase 1 read tests stay green.
- New pglite (or tx-rollback harness) tests, run with `WRITES_ENABLED=true`:
  - preview writes NOTHING (DB unchanged) and returns the expected counts.
  - confirm persists a batch (import_batches/office_bank_import_batches + rows), appends exactly one
    audit_event, and read-after-write reflects the new batch in-process.
  - idempotency: same key replays the stored response with NO second write; same key + different body
    → 409.
  - permission: missing/invalid Bearer → 401; non-admin → 403.
  - atomic: an induced failure mid-confirm rolls back fully (no partial batch).
  - batch reverse: reversing a batch is append-only and audited; source rows are not destroyed.
  - unrecognized rows → import_issues/suspense, never normalized, never dropped.
- One test with `WRITES_ENABLED=false`: confirm returns the honest 501 `action_not_enabled_yet` AFTER
  enforcing idempotency + permission (i.e., 401/403 still precede the 501).
- Do NOT run the live server/deploy.

### After Codex is done, David runs (live):
- Offline: `corepack pnpm --filter @ehq/api check && test && build && build:deploy`.
- Redeploy the bundle to `api.eeee.mu` with **`WRITES_ENABLED=false`** (writes stay disabled in prod).
  Confirm `/healthz` + a couple of reads still work; confirm `pg` is installed/externalized on the slot.
- Do NOT set `WRITES_ENABLED=true` anywhere prod. (Optional: David may run a NON-prod API instance with
  `WRITES_ENABLED=true` against a throwaway DB to exercise confirm live — never the canonical data.)

### Next action after this (do not start yet)
Phase 2 / action 2 = **allocation preview/run** — reuse this infrastructure; wire `buildAllocationPlan`
(split + recoupment) → persist `earning_allocations` + `expense_applications` + `contract_cost_terms`
updates + `suspense_items`, wrapped in a `calculation_runs` row, behind the same gate, with the
concurrency lock. Separate prompt, one action per run.
