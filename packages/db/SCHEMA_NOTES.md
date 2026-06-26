# Finance Schema Notes

This package defines clean Postgres targets for Office / EOF finance and
Distribution / ERH royalties. It contains schema and generated types only; data
migration and ETL are handled later.

## Office / EOF

1. `divisions` is first-class with an `id`; the old model used child rows in
   `departments` via `parent_id`.
2. `categories.division_id` is the single source for the dimensional path. The
   old `categories.department_id` is dropped, and department is derived through
   the category's division. This fixes audit DIM-3.
3. `financial_allocations.division_name` is dropped. Allocations now carry a
   real `department_id` foreign key. This fixes audit DIM-1 and DIM-2.
4. Money is stored as integer minor units at a documented scale, and
   percentages are stored as basis points. There is no app-layer DECIMAL or
   float money path, matching the Prompt A money kernel.
5. Allocation grain is department. This matches how shared costs actually split
   and is faithfully migratable from old top-level `department_id`.
6. Office bank/import tables are B1b read-model targets, not a second ledger:
   `office_bank_accounts`, `office_bank_import_batches`,
   `office_bank_statement_lines`, `office_bank_reconciliation_matches`, and
   `office_cashflow_projection_rows`. They keep bank source rows batch-based and
   reversible, with exact integer minor-unit money. Bank account and line
   currencies are `char(3)`, and any MUR analytics amount is stored as an exact
   `*_mur_minor` bigint produced by the money kernel or an audited FX boundary,
   never by app-layer decimal/float math.

## Distribution / ERH

1. ERH money is stored as exact Postgres `numeric`, not bigint minor units:
   scale-10 amounts use `numeric(28,10)`, scale-6 percentages use
   `numeric(12,6)`, and quantities use `numeric(24,6)`. Scale-10 royalty values
   can exceed bigint range. This is storage only; arithmetic must still run
   through the `erhMoney` kernel and never through JavaScript floats.
2. JSON and legacy long-text blobs are modeled as `jsonb`: aliases,
   linked artist ids, tax info, extraction JSON, reconciliation JSON, and audit
   snapshots.
3. Provenance snapshots from imports are intentionally retained, including
   `raw_*` fields and `releases.label_name`. They record what the distributor
   supplied and are not duplicate canonical wiring.
4. Recoupment and negative royalty carry-forward are first-class schema
   features here: `contract_cost_terms`, `expense_applications`, and the
   append-only `payee_balances` ledger are preserved in F1, not deferred.
