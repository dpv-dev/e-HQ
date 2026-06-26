# CODEX_BUILDING.md — Build & Delivery Playbook (ë • HQ)

How to build and ship ë • HQ. This pairs with **AGENTS.md** (the permanent
rules). AGENTS.md is *what is true*; this file is *the order of operations and
the per-component recipes*.

---

## 0. Build philosophy

**Engine first, UI last. Strangler, never big-bang.**

The eHQ Financial Kernel comes before any screen. HQ, Office, Distribution, and
Command Center are thin clients of the domain packages. We migrate the old
system table-by-table, behind a stable API, never by ripping it out.

---

## 1. Build order

Build bottom-up so every layer rests on a proven one:

1. **`packages/db`** — schema, migrations, typed repositories over the existing
   tables.
2. **`packages/domain-finance`** — the **eHQ Financial Kernel**. Extract this
   *first*: ledger, allocations (largest-remainder), recoupments,
   reconciliation, FX, VAT. Pure functions, fully unit-tested.
3. **`packages/domain-office`** and **`packages/domain-distribution`** — built on
   the kernel; no duplicated money logic.
4. **`packages/api-contracts`** — OpenAPI shapes shared by services and apps.
5. **`services/api`**, **`services/workers`** (Temporal), **`services/realtime`**.
6. **`packages/ui`**, **`packages/auth`**.
7. **`apps/*`** — HQ, Office, Distribution, Command Center.

---

## 2. Database — phased plan (keep the data, upgrade the access)

**Phase 1 — Same DB.**
Existing tables are the source of truth. The new typed API reads and writes them
correctly. Immediate continuity, zero migration trauma.

**Phase 2 — Add clean read models.**
For heavy screens, build derived projections (regenerable, never canonical):
`pnl_monthly_by_department`, `cashflow_daily`, `bank_reconciliation_queue`,
`open_recoupments_by_contract`, `royalties_pending_by_artist`,
`distribution_batch_summary`.

**Phase 3 — Normalize via adapters.**
Where legacy tables are messy, do not break them. Wrap them in compatibility
adapters that map legacy → domain model:

| Legacy table   | New domain model                          |
|----------------|-------------------------------------------|
| `cost_terms`   | Expense                                   |
| `categories`   | Department → Division → Category taxonomy |
| `transactions` | Ledger Transaction                        |

**Phase 4 — Optional Postgres migration.**
Only later, only if needed, and only **table-by-table with a proven model** and
a controlled cutover. Read models move first (safe, derived); canonical tables
move last, each with audited backfill + override records.

---

## 3. Heavy-scale DB strategy

`canonical tables → projections → UI endpoints`. No screen ever scans millions
of raw rows.

| Table                  | Strategy                                  |
|------------------------|-------------------------------------------|
| `ledger_entries`       | Partition by tenant/company + fiscal period |
| `bank_raw_transactions`| Partition by account / date              |
| `audit_events`         | Monthly partitions + retention/archive    |
| `workflow_runs`        | Indexed by status, lock key, updated_at   |
| `royalty_events`       | Append-only, never destructive            |
| dashboard summaries    | Materialized views / read models          |

---

## 4. Per-app recipes

**Office — finance cockpit.** Bank workbench, reconciliation, P&L, VAT, cash
flow, invoices, PDF import. Consumes `domain-office` + `domain-finance`. Bank and
reconciliation screens are cursor-paginated and virtualized.

**Distribution — music business engine.** Contracts, catalog, splits,
recoupments, statements, allocations, royalty batches. Consumes
`domain-distribution` + `domain-finance`. Allocation/royalty batches run as
Temporal workflows with locks.

**Command Center — admin control tower.** Users, roles, system health, workflow
status, audit, integrations, deployments. Read-heavy; realtime status via SSE/WS.

**HQ — front door / hub.** Brand, login, onboarding, account/workspace
selection, and navigation into the products. Thin; delegates auth to
`packages/auth`.

---

## 5. Frontend fluidity playbook

The UI feels instant because it never asks for too much:

- Persistent app shell; route prefetching.
- Cursor pagination, **never** large-offset, for big tables.
- Virtualized tables (TanStack Virtual) for bank, transactions, audit, royalties.
- Optimistic UI **only where safe** (never for money-validating actions).
- Background refresh that does not block navigation.
- Local URL state for filters; saved views per user.
- Keyboard-first navigation + command palette.
- Realtime workflow status over WebSocket/SSE.
- Screen-specific endpoints, e.g.
  `/bank/workbench?account=sbi&period=2026-05&status=unmatched&cursor=...`.

---

## 6. Workflows (Temporal)

Durable, resumable, locked: allocation waves, imports, Wave sync, reconciliation
runs, PDF parsing, royalty-statement generation. A crash resumes; a re-run is
idempotent; concurrent runs on the same lock key are serialized.

---

## 7. Validation & Definition of Done

Before anything ships:

- [ ] Domain unit tests pass, including **integer invariants** and
      **largest-remainder** allocation correctness.
- [ ] Allocation-completeness and **atomic reconciliation** tests pass.
- [ ] End-to-end **smoke test** passes (as the e-royalties smoke test did).
- [ ] Implementation matches the OpenAPI contract.
- [ ] Every endpoint has explicit permissions and a max page size.
- [ ] No float money anywhere (enforced by lint/guard).
- [ ] An `audit_event` is emitted on every financial state change.
- [ ] Source tree and versions confirmed; exact live route verified (not just
      the homepage); deployment target confirmed before writing.

If any box is unchecked, it does not ship.

---

## 8. First milestone

Extract the **eHQ Financial Kernel** (`packages/domain-finance`) with a passing
test suite and a smoke test, wired to the existing DB through `services/api`.
Once the engine is trusted, HQ / Office / Distribution / Command Center
become clean clients of it — one screen at a time.
