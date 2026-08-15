-- ============================================================
-- Step 1 — Schema foundation: admin_id migration
-- Run in pgAdmin against the app database.
--
-- Backfill rules confirmed from code:
--   users.created_by / products.created_by  → username string
--   exchange_rate_history.changed_by        → user_id as string, or "system"
--   exchange/wire orders                    → from users.admin_id
--   exchange_rates / wire_transfer_pairs    → assign leftover rows to master
--
-- Columns stay NULLABLE in Step 1 so existing writes keep working.
-- NOT NULL enforcement is Step 2 (after app always sets admin_id).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────
-- 0) Helper: master user_id used as fallback owner
-- ─────────────────────────────────────────────
-- (used inline via subqueries below)

-- ─────────────────────────────────────────────
-- 1) users.created_by (username) → admin_id
-- ─────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_id INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_by'
  ) THEN
    UPDATE users u
    SET admin_id = a.user_id
    FROM users a
    WHERE u.admin_id IS NULL
      AND u.created_by IS NOT NULL
      AND u.created_by <> 'system'
      AND u.created_by = a.username;

    ALTER TABLE users DROP COLUMN created_by;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_users_admin_id ON users (admin_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'fk_users_admin_id'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_admin_id
      FOREIGN KEY (admin_id) REFERENCES users(user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 2) products.created_by (username) → admin_id
-- ─────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS admin_id INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'created_by'
  ) THEN
    UPDATE products p
    SET admin_id = a.user_id
    FROM users a
    WHERE p.admin_id IS NULL
      AND p.created_by IS NOT NULL
      AND p.created_by = a.username;

    ALTER TABLE products DROP COLUMN created_by;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_products_admin_id ON products (admin_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'fk_products_admin_id'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT fk_products_admin_id
      FOREIGN KEY (admin_id) REFERENCES users(user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 3) exchange_rates.admin_id
-- ─────────────────────────────────────────────
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS admin_id INTEGER;

UPDATE exchange_rates
SET admin_id = (SELECT user_id FROM users WHERE role = 'master' ORDER BY user_id LIMIT 1)
WHERE admin_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_exchange_rates_admin_id ON exchange_rates (admin_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'fk_exchange_rates_admin_id'
  ) THEN
    ALTER TABLE exchange_rates
      ADD CONSTRAINT fk_exchange_rates_admin_id
      FOREIGN KEY (admin_id) REFERENCES users(user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 4) wire_transfer_pairs.admin_id
-- ─────────────────────────────────────────────
ALTER TABLE wire_transfer_pairs ADD COLUMN IF NOT EXISTS admin_id INTEGER;

UPDATE wire_transfer_pairs
SET admin_id = (SELECT user_id FROM users WHERE role = 'master' ORDER BY user_id LIMIT 1)
WHERE admin_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_wire_transfer_pairs_admin_id ON wire_transfer_pairs (admin_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'fk_wire_transfer_pairs_admin_id'
  ) THEN
    ALTER TABLE wire_transfer_pairs
      ADD CONSTRAINT fk_wire_transfer_pairs_admin_id
      FOREIGN KEY (admin_id) REFERENCES users(user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 5) exchange_orders.admin_id ← users.admin_id
-- ─────────────────────────────────────────────
ALTER TABLE exchange_orders ADD COLUMN IF NOT EXISTS admin_id INTEGER;

UPDATE exchange_orders eo
SET admin_id = u.admin_id
FROM users u
WHERE eo.user_id = u.user_id
  AND eo.admin_id IS NULL
  AND u.admin_id IS NOT NULL;

-- Fallback: orders whose user has no admin → master
UPDATE exchange_orders
SET admin_id = (SELECT user_id FROM users WHERE role = 'master' ORDER BY user_id LIMIT 1)
WHERE admin_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_exchange_orders_admin_id ON exchange_orders (admin_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'fk_exchange_orders_admin_id'
  ) THEN
    ALTER TABLE exchange_orders
      ADD CONSTRAINT fk_exchange_orders_admin_id
      FOREIGN KEY (admin_id) REFERENCES users(user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 6) wire_transfer_orders.admin_id ← users.admin_id
-- ─────────────────────────────────────────────
ALTER TABLE wire_transfer_orders ADD COLUMN IF NOT EXISTS admin_id INTEGER;

UPDATE wire_transfer_orders wo
SET admin_id = u.admin_id
FROM users u
WHERE wo.user_id = u.user_id
  AND wo.admin_id IS NULL
  AND u.admin_id IS NOT NULL;

UPDATE wire_transfer_orders
SET admin_id = (SELECT user_id FROM users WHERE role = 'master' ORDER BY user_id LIMIT 1)
WHERE admin_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_wire_transfer_orders_admin_id ON wire_transfer_orders (admin_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'fk_wire_transfer_orders_admin_id'
  ) THEN
    ALTER TABLE wire_transfer_orders
      ADD CONSTRAINT fk_wire_transfer_orders_admin_id
      FOREIGN KEY (admin_id) REFERENCES users(user_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────
-- 7) exchange_rate_history: structured changed_by
--    Existing changed_by values are user_id strings or "system"
-- ─────────────────────────────────────────────
ALTER TABLE exchange_rate_history
  ADD COLUMN IF NOT EXISTS changed_by_user_id INTEGER;

ALTER TABLE exchange_rate_history
  ADD COLUMN IF NOT EXISTS changed_by_role VARCHAR(20);

-- Numeric string → user_id
UPDATE exchange_rate_history h
SET changed_by_user_id = u.user_id,
    changed_by_role = COALESCE(u.role, 'admin')
FROM users u
WHERE h.changed_by_user_id IS NULL
  AND h.changed_by IS NOT NULL
  AND h.changed_by ~ '^[0-9]+$'
  AND u.user_id = h.changed_by::INTEGER;

-- Explicit "system"
UPDATE exchange_rate_history
SET changed_by_role = 'system'
WHERE changed_by_role IS NULL
  AND (changed_by IS NULL OR lower(changed_by) = 'system');

-- Username leftover (if any)
UPDATE exchange_rate_history h
SET changed_by_user_id = u.user_id,
    changed_by_role = COALESCE(u.role, 'admin')
FROM users u
WHERE h.changed_by_user_id IS NULL
  AND h.changed_by IS NOT NULL
  AND lower(h.changed_by) <> 'system'
  AND h.changed_by !~ '^[0-9]+$'
  AND u.username = h.changed_by;

CREATE INDEX IF NOT EXISTS ix_exchange_rate_history_changed_by_user_id
  ON exchange_rate_history (changed_by_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND constraint_name = 'fk_exchange_rate_history_changed_by_user_id'
  ) THEN
    ALTER TABLE exchange_rate_history
      ADD CONSTRAINT fk_exchange_rate_history_changed_by_user_id
      FOREIGN KEY (changed_by_user_id) REFERENCES users(user_id);
  END IF;
END $$;

-- Keep legacy changed_by column for audit continuity (do NOT drop in Step 1).

COMMIT;

-- ============================================================
-- VERIFICATION REPORT (run after COMMIT)
-- Expect: null_admin_id = 0 for rates/pairs/orders
-- users.admin_id may legitimately be NULL (global/unassigned)
-- ============================================================

SELECT 'users' AS table_name,
       COUNT(*) AS total,
       COUNT(admin_id) AS with_admin_id,
       COUNT(*) FILTER (WHERE admin_id IS NULL) AS null_admin_id
FROM users
UNION ALL
SELECT 'products', COUNT(*), COUNT(admin_id), COUNT(*) FILTER (WHERE admin_id IS NULL)
FROM products
UNION ALL
SELECT 'exchange_rates', COUNT(*), COUNT(admin_id), COUNT(*) FILTER (WHERE admin_id IS NULL)
FROM exchange_rates
UNION ALL
SELECT 'wire_transfer_pairs', COUNT(*), COUNT(admin_id), COUNT(*) FILTER (WHERE admin_id IS NULL)
FROM wire_transfer_pairs
UNION ALL
SELECT 'exchange_orders', COUNT(*), COUNT(admin_id), COUNT(*) FILTER (WHERE admin_id IS NULL)
FROM exchange_orders
UNION ALL
SELECT 'wire_transfer_orders', COUNT(*), COUNT(admin_id), COUNT(*) FILTER (WHERE admin_id IS NULL)
FROM wire_transfer_orders;

SELECT 'exchange_rate_history' AS table_name,
       COUNT(*) AS total,
       COUNT(changed_by_user_id) AS with_user_id,
       COUNT(*) FILTER (WHERE changed_by_role = 'system') AS system_rows,
       COUNT(*) FILTER (
         WHERE changed_by_user_id IS NULL
           AND COALESCE(changed_by_role, '') <> 'system'
           AND changed_by IS NOT NULL
           AND lower(changed_by) <> 'system'
       ) AS unresolved_changed_by
FROM exchange_rate_history;

-- Orphan FK check (should return 0 rows)
SELECT 'users.admin_id orphan' AS issue, u.user_id, u.admin_id
FROM users u
LEFT JOIN users a ON a.user_id = u.admin_id
WHERE u.admin_id IS NOT NULL AND a.user_id IS NULL
UNION ALL
SELECT 'exchange_rates.admin_id orphan', r.id, r.admin_id
FROM exchange_rates r
LEFT JOIN users a ON a.user_id = r.admin_id
WHERE r.admin_id IS NOT NULL AND a.user_id IS NULL
UNION ALL
SELECT 'wire_transfer_pairs.admin_id orphan', p.id, p.admin_id
FROM wire_transfer_pairs p
LEFT JOIN users a ON a.user_id = p.admin_id
WHERE p.admin_id IS NOT NULL AND a.user_id IS NULL
UNION ALL
SELECT 'exchange_orders.admin_id orphan', o.id, o.admin_id
FROM exchange_orders o
LEFT JOIN users a ON a.user_id = o.admin_id
WHERE o.admin_id IS NOT NULL AND a.user_id IS NULL
UNION ALL
SELECT 'wire_transfer_orders.admin_id orphan', o.id, o.admin_id
FROM wire_transfer_orders o
LEFT JOIN users a ON a.user_id = o.admin_id
WHERE o.admin_id IS NOT NULL AND a.user_id IS NULL;
