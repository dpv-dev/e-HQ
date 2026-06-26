# ENGINE_NOTES.md

## Write-Path Runtime Notes

- `services/api` mutating routes are gated by `WRITES_ENABLED`. Routes that are not implemented still return `501 action_not_enabled_yet` after auth, permission, and idempotency checks.
- Fix before cutover: import previews are process-local and non-persistent today. A confirm request whose `previewId` is missing or belongs to another workspace fails explicitly; it does not reconstruct rows from partial input. Before Postgres becomes canonical for live writes, preview rows must move to a Postgres staging table indexed by `previewId` so slot restarts or multi-instance routing cannot lose preview state.
- Migration note: `packages/db/migrations/0009_shiny_magneto.sql` is additive only; it creates `api_idempotency_keys` and does not alter certified read tables or certified values. Before live writes are enabled, this migration must be applied to live Postgres as part of the pre-cutover checklist.
- Distribution import confirm currently persists `import_batches`, `raw_import_rows`, and `import_issues`. Runtime source parsers for Kontor and RouteNote are not enabled in `services/api`, so the API does not fabricate `normalized_earnings`; `importedRoyaltyEventCount` stays `0` until a parser-backed normalization path is implemented.
- Office bank import confirm persists `office_bank_import_batches` and only those `office_bank_statement_lines` that can be parsed from structured JSON rows with deterministic date, amount, account, and description fields. Unparseable rows are retained in batch metadata instead of being invented as statement lines.
- Temporal workers are not active in the standalone API runtime. Future long-running allocation, recoupment, and statement writes must use a Postgres advisory-lock equivalent here until `services/workers` becomes the active Temporal owner.
