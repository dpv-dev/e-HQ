# PLAN.md - eHQ Financial Kernel Milestone

## Stop line

This milestone stops at scaffolding and planning until explicit approval is
given for engine logic. No deployment, no destructive operation, no database
write, and no write-mode connection is part of this milestone.

## Binding constraints

- Money is integer micro-units in the new kernel. No floats.
- Shares and splits are basis points.
- Exactly one owner per fact: the existing WordPress / Office / Distribution DB
  remains source of truth until a table is formally migrated.
- Apps never touch legacy tables or legacy REST directly. All access goes
  through `services/api`.
- Imported financial and contract data is corrected through audited override
  records, never in-place mutation.
- UI copy is French.
- Project context stays scoped to this repository.

## Legacy boundary

The first kernel milestone uses read-only adapters behind `services/api`.
Adapters normalize legacy rows into domain inputs, then the pure
`packages/domain-finance` functions return decisions. Writes remain outside the
kernel and must later go through typed API handlers, idempotency keys, workflow
locks, and audit events.

Confirmed adapter mappings:

| Legacy source | Domain model | Owner |
| --- | --- | --- |
| `contract_cost_terms` / cost terms | Expense | Distribution |
| `departments` + `categories` | Department / Division / Category taxonomy | Office |
| `transactions` | Ledger Transaction | Office |

## packages/domain-finance modules

- `types`: branded money micro-unit, currency, basis-point, ledger, expense,
  allocation, and reconciliation types.
- `money`: constructors, decimal-to-micro-unit parsing, integer arithmetic, and
  basis-point allocation signatures.
- `ledger`: ledger summaries from typed transactions, with no database or UI
  access.
- `allocations`: largest-remainder allocation and allocation-completeness
  validation.
- `recoupments`: expense / advance recovery decisions, including payee-targeted
  recoupment.
- `reconciliation`: atomic reconciliation decisions over typed candidates.
- `fx`: explicit FX conversion using approved rates.
- `vat`: VAT breakdowns using basis-point rates.
- `schemas`: Zod placeholders for the public domain shapes.

## services/api wiring

`services/api` owns the compatibility layer:

- read legacy Office `eof/v1` and Distribution `erh/v1` surfaces only through
  typed repositories;
- translate `wp_eof_transactions` into `LedgerTransaction`;
- translate `wp_eof_departments` and `wp_eof_categories` into the taxonomy;
- translate `wp_erh_contract_cost_terms` into `Expense`;
- expose screen-specific endpoints with explicit permissions and max page size;
- write audit events for every later financial mutation.

No frontend package may import `@ehq/db` directly.

## Test list

- Integer money invariants: no float paths, exact micro-unit preservation, exact
  sum equality after arithmetic.
- Basis-point split validation: total must be exactly 10,000 bp per allocation
  scope before validation.
- Largest-remainder allocation: sum of allocated parts equals the source amount
  for positive, zero, and negative-compatible scenarios once semantics are
  approved.
- Allocation completeness: no partial validation when any source row is
  unmatched, under-specified, or over-specified.
- Recoupment correctness: payee-targeted advances never recover from another
  payee; shared costs remain shared only when explicitly modeled.
- Atomic reconciliation: all links commit as one decision or no decision is
  returned.
- Audit envelope: every mutation-producing decision carries enough context for
  the API layer to write `audit_event`.
- Adapter invariants: legacy decimal strings convert to approved micro-unit
  values without losing precision.

## Smoke-test outline

Mirror the proven e-royalties smoke shape without writing data:

1. Health: load the API service in read-only mode and confirm configured legacy
   namespaces are `eof/v1` and `erh/v1`.
2. Inventory: read adapter metadata for transactions, taxonomy, contracts,
   rules, cost terms, allocations, suspense, statements, and payments.
3. Transform: convert a frozen read-only fixture or approved snapshot into
   domain inputs.
4. Kernel: run ledger, allocation, recoupment, FX, VAT, and reconciliation
   checks against the snapshot.
5. Assert: integer invariants, largest-remainder sums, allocation completeness,
   and atomic reconciliation all pass.
6. Report: produce dashboard-style validated projections only from kernel
   outputs, never ad-hoc queries.

## Open questions

- What is the approved conversion rule from Office `DECIMAL(15,2)` MUR values
  to integer micro-units?
- What is the approved conversion rule from Distribution `DECIMAL(24,10)`
  royalty values to integer micro-units?
- Should legacy split percentages such as `DECIMAL(12,6)` be rounded, rejected,
  or explicitly overridden when they do not map cleanly to basis points?
- Are negative royalty carry-forward rows modeled as ledger transactions,
  statement adjustments, or a separate balance movement type?
- Which table owns the new canonical `audit_event` name: a new table later, or
  adapters over `wp_eof_audit_log` and `wp_erh_audit_logs` during phase 1?
- How should legacy hard-delete maintenance endpoints be fenced off from the
  new audited override model?
