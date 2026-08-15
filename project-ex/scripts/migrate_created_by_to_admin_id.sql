-- ============================================================
-- pgAdmin: migrate created_by (username string) → admin_id (int)
-- Run once against your app database.
-- ============================================================

BEGIN;

-- ---------- users ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_id INTEGER;

UPDATE users u
SET admin_id = a.user_id
FROM users a
WHERE u.created_by IS NOT NULL
  AND u.created_by <> 'system'
  AND u.created_by = a.username
  AND u.admin_id IS NULL;

ALTER TABLE users DROP COLUMN IF EXISTS created_by;

ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_admin_id;
ALTER TABLE users
  ADD CONSTRAINT fk_users_admin_id
  FOREIGN KEY (admin_id) REFERENCES users(user_id);

CREATE INDEX IF NOT EXISTS ix_users_admin_id ON users(admin_id);

-- ---------- products ----------
ALTER TABLE products ADD COLUMN IF NOT EXISTS admin_id INTEGER;

UPDATE products p
SET admin_id = a.user_id
FROM users a
WHERE p.created_by IS NOT NULL
  AND p.created_by = a.username
  AND p.admin_id IS NULL;

ALTER TABLE products DROP COLUMN IF EXISTS created_by;

ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_admin_id;
ALTER TABLE products
  ADD CONSTRAINT fk_products_admin_id
  FOREIGN KEY (admin_id) REFERENCES users(user_id);

CREATE INDEX IF NOT EXISTS ix_products_admin_id ON products(admin_id);

COMMIT;
