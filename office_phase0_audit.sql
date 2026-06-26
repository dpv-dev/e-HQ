-- ============================================================================
-- ë • Office — B2 Phase 0: data-quality audit (READ-ONLY)
-- ----------------------------------------------------------------------------
-- SELECT-only. No INSERT/UPDATE/DELETE/DDL. Safe to run on the live DB.
-- Run in phpMyAdmin, the MySQL CLI, or hand to Codex (read-only connection).
--
-- PREFIX: these use `wp_eof_`. If your WordPress table prefix is not `wp_`,
-- replace `wp_` everywhere with your actual prefix (check wp-config.php
-- $table_prefix). The plugin tables are <prefix>eof_<name>.
--
-- Each block prints a COUNT first (the headline number), then a SAMPLE you can
-- eyeball. Send me the counts and I'll tell you what the ETL must clean and
-- whether any of it is a real problem vs cosmetic.
-- ============================================================================


-- ============================================================================
-- 0) SIZING — how big is the migration?
-- ============================================================================
SELECT 'departments'            AS table_name, COUNT(*) AS rows_total FROM wp_eof_departments
UNION ALL SELECT 'categories',            COUNT(*) FROM wp_eof_categories
UNION ALL SELECT 'partners',              COUNT(*) FROM wp_eof_partners
UNION ALL SELECT 'projects',              COUNT(*) FROM wp_eof_projects
UNION ALL SELECT 'transactions',          COUNT(*) FROM wp_eof_transactions
UNION ALL SELECT 'financial_allocations', COUNT(*) FROM wp_eof_financial_allocations
UNION ALL SELECT 'bank_raw_transactions', COUNT(*) FROM wp_eof_bank_raw_transactions
UNION ALL SELECT 'bank_reconciliations',  COUNT(*) FROM wp_eof_bank_reconciliations;

-- Validated money totals (the figures the ETL parity must reproduce):
SELECT
  COUNT(*)                                                                AS validated_tx,
  COALESCE(SUM(CASE WHEN type='income'  THEN amount_mur END), 0)          AS income_total,
  COALESCE(SUM(CASE WHEN type='expense' THEN amount_mur END), 0)          AS expense_total
FROM wp_eof_transactions
WHERE status = 'validated' AND is_active = 1;


-- ============================================================================
-- 1) INCONSISTENT CATEGORY DIMENSION
--    A category's division must sit under the category's department, i.e.
--    parent_id(division) == department_id. Where it doesn't (or either is
--    NULL on an active category), the old dept/division wiring is broken.
-- ============================================================================
SELECT COUNT(*) AS inconsistent_categories
FROM wp_eof_categories c
LEFT JOIN wp_eof_departments d ON d.id = c.division_id
WHERE c.is_active = 1
  AND ( c.department_id IS NULL
     OR c.division_id   IS NULL
     OR d.parent_id IS NULL
     OR d.parent_id <> c.department_id );

-- sample
SELECT c.id, c.name, c.department_id, c.division_id,
       d.name AS division_name, d.parent_id AS division_parent_dept
FROM wp_eof_categories c
LEFT JOIN wp_eof_departments d ON d.id = c.division_id
WHERE c.is_active = 1
  AND ( c.department_id IS NULL OR c.division_id IS NULL
     OR d.parent_id IS NULL OR d.parent_id <> c.department_id )
LIMIT 50;


-- ============================================================================
-- 2) EMPTY original_currency (botched imports treated as MUR but never cleaned)
-- ============================================================================
SELECT COUNT(*) AS empty_currency_rows
FROM wp_eof_transactions
WHERE original_currency = '';

-- sample
SELECT id, transaction_date, type, status, amount_mur, original_currency
FROM wp_eof_transactions
WHERE original_currency = ''
LIMIT 50;


-- ============================================================================
-- 3) ALLOCATION-SUM MISMATCH
--    Validated tx WITH allocations whose per-department slices don't add up to
--    the transaction amount (legacy rows predating the completeness rule).
-- ============================================================================
SELECT COUNT(*) AS mismatched_tx FROM (
  SELECT t.id
  FROM wp_eof_transactions t
  JOIN wp_eof_financial_allocations a ON a.transaction_id = t.id
  WHERE t.status = 'validated' AND t.is_active = 1
  GROUP BY t.id, t.amount_mur
  HAVING ABS(t.amount_mur - COALESCE(SUM(a.amount_mur), 0)) > 0.01
) x;

-- sample
SELECT t.id, t.amount_mur,
       COALESCE(SUM(a.amount_mur), 0)              AS alloc_sum,
       ROUND(t.amount_mur - COALESCE(SUM(a.amount_mur), 0), 2) AS diff
FROM wp_eof_transactions t
JOIN wp_eof_financial_allocations a ON a.transaction_id = t.id
WHERE t.status = 'validated' AND t.is_active = 1
GROUP BY t.id, t.amount_mur
HAVING ABS(t.amount_mur - COALESCE(SUM(a.amount_mur), 0)) > 0.01
LIMIT 50;


-- ============================================================================
-- 4) DENORMALIZED DIVISION DRIFT
--    allocation.division_name (snapshot) vs the category's actual division.
--    Ignores blank snapshots (legitimately "unallocated").
-- ============================================================================
SELECT COUNT(*) AS drifted_allocations
FROM wp_eof_financial_allocations a
JOIN wp_eof_transactions t ON t.id = a.transaction_id
LEFT JOIN wp_eof_categories  c    ON c.id   = t.category_id
LEFT JOIN wp_eof_departments divs ON divs.id = c.division_id
WHERE a.division_name <> ''
  AND a.division_name <> COALESCE(divs.name, '');

-- sample
SELECT a.id, a.transaction_id, a.division_name AS alloc_division,
       divs.name AS category_division, c.name AS category_name
FROM wp_eof_financial_allocations a
JOIN wp_eof_transactions t ON t.id = a.transaction_id
LEFT JOIN wp_eof_categories  c    ON c.id   = t.category_id
LEFT JOIN wp_eof_departments divs ON divs.id = c.division_id
WHERE a.division_name <> ''
  AND a.division_name <> COALESCE(divs.name, '')
LIMIT 50;


-- ============================================================================
-- 5) ORPHAN FOREIGN KEYS (pointers to rows that don't exist)
-- ============================================================================
SELECT 'tx.category_id -> categories' AS orphan, COUNT(*) AS n
FROM wp_eof_transactions t
WHERE t.category_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM wp_eof_categories c WHERE c.id = t.category_id)
UNION ALL
SELECT 'tx.partner_id -> partners', COUNT(*)
FROM wp_eof_transactions t
WHERE t.partner_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM wp_eof_partners p WHERE p.id = t.partner_id)
UNION ALL
SELECT 'tx.project_id -> projects', COUNT(*)
FROM wp_eof_transactions t
WHERE t.project_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM wp_eof_projects pr WHERE pr.id = t.project_id)
UNION ALL
SELECT 'alloc.department_id -> departments', COUNT(*)
FROM wp_eof_financial_allocations a
WHERE NOT EXISTS (SELECT 1 FROM wp_eof_departments d WHERE d.id = a.department_id)
UNION ALL
SELECT 'alloc.transaction_id -> transactions', COUNT(*)
FROM wp_eof_financial_allocations a
WHERE NOT EXISTS (SELECT 1 FROM wp_eof_transactions t WHERE t.id = a.transaction_id);

-- ============================================================================
-- End of Phase 0 audit. Nothing above modifies data.
-- ============================================================================
