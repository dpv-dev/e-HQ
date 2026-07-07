-- Repair: transaction.type independent from category (source by bank direction)
-- Scope: only transactions linked to bank statement lines.
-- Run this file in your PostgreSQL client connected to the target database.
--
-- Safety checks:
-- 1) Make sure no transaction is linked to both debit and credit directions.
-- 2) Review mismatch preview/sample before applying UPDATE.
-- 3) Keep the repair plan table for rollback in this session if needed.

BEGIN;

-- 0) Plan the repair set (one row per transaction).
CREATE TEMP TABLE tx_type_repair_plan AS
WITH tx_direction AS (
  SELECT
    t.id,
    t.type AS current_type,
    COUNT(*) FILTER (WHERE l.direction = 'credit')::int AS credit_lines,
    COUNT(*) FILTER (WHERE l.direction = 'debit')::int AS debit_lines,
    CASE
      WHEN COUNT(*) FILTER (WHERE l.direction = 'credit') > 0
           AND COUNT(*) FILTER (WHERE l.direction = 'debit') = 0
        THEN 'income'::financial_type
      WHEN COUNT(*) FILTER (WHERE l.direction = 'debit') > 0
           AND COUNT(*) FILTER (WHERE l.direction = 'credit') = 0
        THEN 'expense'::financial_type
      ELSE NULL::financial_type
    END AS corrected_type
  FROM transactions t
  JOIN office_bank_statement_lines l
    ON l.matched_transaction_id = t.id
  GROUP BY t.id, t.type
)
SELECT
  tx.id,
  tx.current_type,
  tx.credit_lines,
  tx.debit_lines,
  tx.corrected_type
FROM tx_direction tx
WHERE tx.corrected_type IS NOT NULL;

-- 1) Guardrail: transactions with both debit and credit matched lines.
--    If this is > 0, pause and investigate manually.
SELECT
  COUNT(*)::int AS ambiguous_tx_count
FROM tx_type_repair_plan
WHERE credit_lines > 0
  AND debit_lines > 0;

-- 2) Preview mismatches.
SELECT
  COUNT(*)::int AS mismatch_count
FROM tx_type_repair_plan p
JOIN transactions t
  ON t.id = p.id
WHERE t.type <> p.corrected_type;

SELECT
  p.id,
  t.description,
  p.current_type,
  p.corrected_type,
  p.credit_lines,
  p.debit_lines
FROM tx_type_repair_plan p
JOIN transactions t
  ON t.id = p.id
WHERE t.type <> p.corrected_type
ORDER BY p.id
LIMIT 200;

-- 3) Optional: full export for review.
-- COPY (
--   SELECT
--     p.id,
--     t.description,
--     p.current_type,
--     p.corrected_type,
--     p.credit_lines,
--     p.debit_lines
--   FROM tx_type_repair_plan p
--   JOIN transactions t
--     ON t.id = p.id
--   WHERE t.type <> p.corrected_type
--   ORDER BY p.id
-- ) TO STDOUT WITH CSV HEADER;

-- 4) Apply repair (uncomment only after validation).
-- UPDATE transactions t
-- SET type = p.corrected_type
-- FROM tx_type_repair_plan p
-- WHERE t.id = p.id
--   AND t.type <> p.corrected_type
--   AND p.credit_lines > 0
--   AND p.debit_lines = 0;
--
-- -- or keep one statement for both directions (same logic):
-- UPDATE transactions t
-- SET type = p.corrected_type
-- FROM tx_type_repair_plan p
-- WHERE t.id = p.id
--   AND t.type <> p.corrected_type;

-- 5) Post-check (after update): should return 0.
-- SELECT
--   COUNT(*)::int AS remaining_mismatch_count
-- FROM tx_type_repair_plan p
-- JOIN transactions t
--   ON t.id = p.id
-- WHERE t.type <> p.corrected_type;

-- Rollback (during same session, before commit):
-- UPDATE transactions t
-- SET type = p.current_type
-- FROM tx_type_repair_plan p
-- WHERE t.id = p.id
--   AND t.type <> p.current_type;

COMMIT;
