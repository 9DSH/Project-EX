-- Step 1 verification only (safe to re-run anytime)
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

SELECT COUNT(*) AS unresolved_history_changed_by
FROM exchange_rate_history
WHERE changed_by_user_id IS NULL
  AND COALESCE(changed_by_role, '') <> 'system'
  AND changed_by IS NOT NULL
  AND lower(changed_by) <> 'system';
