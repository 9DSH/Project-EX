from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os
from pathlib import Path
from app.db.bootstrap import ensure_database_and_role


env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


DATABASE_URL = os.getenv("DATABASE_URL")
print("DATABASE_URL LOADED:", DATABASE_URL)

if not DATABASE_URL:
    raise Exception("DATABASE_URL is missing. Check .env loading.")

ensure_database_and_role()
engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()



# =========================
# RLS BUCKETS
# =========================

# Bucket A: direct admin_id column
_BUCKET_A_TABLES = [
    "users",
    "products",
    "exchange_pairs",
    "wire_transfer_pairs",
    "exchange_orders",
    "wire_transfer_orders",
    "platform_bank_accounts",
]

# Bucket B: scoped via user_id -> users.admin_id
_BUCKET_B_TABLES = [
    "user_balances",
    "transactions",
    "user_wallets",
    "external_wallets",
    "user_bank_info",
    "withdrawals",
    "failed_sweeps",
    "conversations",
]

# Bucket D — deliberately no RLS. Access is controlled entirely by
# access_points at the application layer:
#   currencies, networks, currency_networks, categories, system_wallet



def _table_exists(conn, table_name: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :table"
            ),
            {"table": table_name},
        ).scalar()
    )


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = 'public' "
                "AND table_name = :table AND column_name = :column"
            ),
            {"table": table_name, "column": column_name},
        ).scalar()
    )


def _constraint_exists(conn, constraint_name: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT 1 FROM information_schema.table_constraints "
                "WHERE table_schema = 'public' AND constraint_name = :name"
            ),
            {"name": constraint_name},
        ).scalar()
    )


def _migrate_created_by_to_admin_id(conn, table_name: str) -> None:
    """Replace username created_by with integer admin_id FK on one table."""
    if not _table_exists(conn, table_name):
        print(f"[ensure_schema] skip {table_name}: table does not exist")
        return

    has_created_by = _column_exists(conn, table_name, "created_by")
    has_admin_id = _column_exists(conn, table_name, "admin_id")

    if has_created_by and not has_admin_id:
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN admin_id INTEGER"))
        has_admin_id = True

    if has_created_by and has_admin_id:
        conn.execute(
            text(
                f"""
                UPDATE {table_name} t
                SET admin_id = a.user_id
                FROM users a
                WHERE t.admin_id IS NULL
                  AND t.created_by IS NOT NULL
                  AND t.created_by <> 'system'
                  AND t.created_by = a.username
                """
            )
        )
        conn.execute(text(f"ALTER TABLE {table_name} DROP COLUMN created_by"))
    elif not has_admin_id:
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN admin_id INTEGER"))

    # Index / FK: check first — never use bare try/except on Postgres
    # (a failed statement aborts the whole transaction).
    conn.execute(
        text(
            f"CREATE INDEX IF NOT EXISTS ix_{table_name}_admin_id "
            f"ON {table_name} (admin_id)"
        )
    )

    fk_name = f"fk_{table_name}_admin_id"
    if not _constraint_exists(conn, fk_name):
        # SAVEPOINT: invalid orphan admin_id values must not abort the whole migration.
        conn.execute(text(f"SAVEPOINT sp_{fk_name}"))
        try:
            conn.execute(
                text(
                    f"ALTER TABLE {table_name} "
                    f"ADD CONSTRAINT {fk_name} "
                    f"FOREIGN KEY (admin_id) REFERENCES users(user_id)"
                )
            )
            conn.execute(text(f"RELEASE SAVEPOINT sp_{fk_name}"))
        except Exception as e:
            conn.execute(text(f"ROLLBACK TO SAVEPOINT sp_{fk_name}"))
            print(f"[ensure_schema] skip FK {fk_name}: {e}")


def _add_admin_id_column(conn, table_name: str) -> None:
    """Add nullable admin_id + index + FK if missing (Step 1, no write-path changes)."""
    if not _table_exists(conn, table_name):
        print(f"[ensure_schema] skip {table_name}: table does not exist")
        return

    if not _column_exists(conn, table_name, "admin_id"):
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN admin_id INTEGER"))

    conn.execute(
        text(
            f"CREATE INDEX IF NOT EXISTS ix_{table_name}_admin_id "
            f"ON {table_name} (admin_id)"
        )
    )

    fk_name = f"fk_{table_name}_admin_id"
    if not _constraint_exists(conn, fk_name):
        conn.execute(text(f"SAVEPOINT sp_{fk_name}"))
        try:
            conn.execute(
                text(
                    f"ALTER TABLE {table_name} "
                    f"ADD CONSTRAINT {fk_name} "
                    f"FOREIGN KEY (admin_id) REFERENCES users(user_id)"
                )
            )
            conn.execute(text(f"RELEASE SAVEPOINT sp_{fk_name}"))
        except Exception as e:
            conn.execute(text(f"ROLLBACK TO SAVEPOINT sp_{fk_name}"))
            print(f"[ensure_schema] skip FK {fk_name}: {e}")


def _backfill_admin_id_from_user(conn, table_name: str) -> None:
    """Copy users.admin_id onto order rows; leftover → master."""
    if not _table_exists(conn, table_name):
        print(f"[ensure_schema] skip {table_name}: table does not exist")
        return

    conn.execute(
        text(
            f"""
            UPDATE {table_name} t
            SET admin_id = u.admin_id
            FROM users u
            WHERE t.user_id = u.user_id
              AND t.admin_id IS NULL
              AND u.admin_id IS NOT NULL
            """
        )
    )
    conn.execute(
        text(
            f"""
            UPDATE {table_name}
            SET admin_id = (
                SELECT user_id FROM users WHERE role = 'master' ORDER BY user_id LIMIT 1
            )
            WHERE admin_id IS NULL
            """
        )
    )


def _backfill_admin_id_to_master(conn, table_name: str) -> None:
    if not _table_exists(conn, table_name):
        print(f"[ensure_schema] skip {table_name}: table does not exist")
        return

    conn.execute(
        text(
            f"""
            UPDATE {table_name}
            SET admin_id = (
                SELECT user_id FROM users WHERE role = 'master' ORDER BY user_id LIMIT 1
            )
            WHERE admin_id IS NULL
            """
        )
    )


def _migrate_exchange_rate_history_changed_by(conn) -> None:
    if not _table_exists(conn, "exchange_rate_history"):
        print("[ensure_schema] skip exchange_rate_history: table does not exist")
        return

    if not _column_exists(conn, "exchange_rate_history", "changed_by_user_id"):
        conn.execute(
            text(
                "ALTER TABLE exchange_rate_history "
                "ADD COLUMN changed_by_user_id INTEGER"
            )
        )
    if not _column_exists(conn, "exchange_rate_history", "changed_by_role"):
        conn.execute(
            text(
                "ALTER TABLE exchange_rate_history "
                "ADD COLUMN changed_by_role VARCHAR(20)"
            )
        )

    conn.execute(
        text(
            """
            UPDATE exchange_rate_history h
            SET changed_by_user_id = u.user_id,
                changed_by_role = COALESCE(u.role, 'admin')
            FROM users u
            WHERE h.changed_by_user_id IS NULL
              AND h.changed_by IS NOT NULL
              AND h.changed_by ~ '^[0-9]+$'
              AND u.user_id = h.changed_by::INTEGER
            """
        )
    )
    conn.execute(
        text(
            """
            UPDATE exchange_rate_history
            SET changed_by_role = 'system'
            WHERE changed_by_role IS NULL
              AND (changed_by IS NULL OR lower(changed_by) = 'system')
            """
        )
    )
    conn.execute(
        text(
            """
            UPDATE exchange_rate_history h
            SET changed_by_user_id = u.user_id,
                changed_by_role = COALESCE(u.role, 'admin')
            FROM users u
            WHERE h.changed_by_user_id IS NULL
              AND h.changed_by IS NOT NULL
              AND lower(h.changed_by) <> 'system'
              AND h.changed_by !~ '^[0-9]+$'
              AND u.username = h.changed_by
            """
        )
    )

    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_exchange_rate_history_changed_by_user_id "
            "ON exchange_rate_history (changed_by_user_id)"
        )
    )

    fk_name = "fk_exchange_rate_history_changed_by_user_id"
    if not _constraint_exists(conn, fk_name):
        conn.execute(text(f"SAVEPOINT sp_{fk_name}"))
        try:
            conn.execute(
                text(
                    "ALTER TABLE exchange_rate_history "
                    f"ADD CONSTRAINT {fk_name} "
                    "FOREIGN KEY (changed_by_user_id) REFERENCES users(user_id)"
                )
            )
            conn.execute(text(f"RELEASE SAVEPOINT sp_{fk_name}"))
        except Exception as e:
            conn.execute(text(f"ROLLBACK TO SAVEPOINT sp_{fk_name}"))
            print(f"[ensure_schema] skip FK {fk_name}: {e}")

def _migrate_conversations_kind(conn) -> None:
    """
    Adds Conversation.kind (default 'support') and swaps the old
    single-column UNIQUE(user_id) for UNIQUE(user_id, kind), so a user can
    have both a Telegram support conversation and an internal admin<->master
    conversation without colliding.
    """
    if not _table_exists(conn, "conversations"):
        print("[ensure_schema] skip conversations.kind: table does not exist")
        return

    if not _column_exists(conn, "conversations", "kind"):
        conn.execute(
            text(
                "ALTER TABLE conversations ADD COLUMN kind VARCHAR(20) "
                "NOT NULL DEFAULT 'support'"
            )
        )

    # Drop the old single-column unique constraint if present. Postgres
    # names auto-generated unique constraints like "<table>_<column>_key".
    old_uq_candidates = ["conversations_user_id_key"]
    for name in old_uq_candidates:
        if _constraint_exists(conn, name):
            conn.execute(text(f"ALTER TABLE conversations DROP CONSTRAINT {name}"))

    new_uq = "uq_conversation_user_kind"
    if not _constraint_exists(conn, new_uq):
        conn.execute(text(f"SAVEPOINT sp_{new_uq}"))
        try:
            conn.execute(
                text(
                    f"ALTER TABLE conversations ADD CONSTRAINT {new_uq} "
                    f"UNIQUE (user_id, kind)"
                )
            )
            conn.execute(text(f"RELEASE SAVEPOINT sp_{new_uq}"))
        except Exception as e:
            conn.execute(text(f"ROLLBACK TO SAVEPOINT sp_{new_uq}"))
            print(f"[ensure_schema] skip {new_uq}: {e}")


def set_session_master(db):
    """
    For standalone SessionLocal() sessions in background jobs/workers that
    aren't wrapped in the per-request RLS dependency. Uses session-level SET
    (not SET LOCAL) since these sessions commit multiple times across a long
    loop body and SET LOCAL would be wiped after the first commit.
    """
    db.execute(text("SET app.is_master = 'true'"))

def ensure_schema():
    with engine.begin() as conn:
        _ensure_global_eligibility_function(conn)
        if _table_exists(conn, "transactions") and not _column_exists(conn, "transactions", "platform_bank_account_id"):
            conn.execute(
                text(
                    "ALTER TABLE transactions ADD COLUMN platform_bank_account_id INTEGER"
                )
            )
            if _table_exists(conn, "platform_bank_accounts") and not _constraint_exists(conn, "fk_transactions_platform_bank_account"):
                conn.execute(
                    text(
                        "ALTER TABLE transactions ADD CONSTRAINT fk_transactions_platform_bank_account "
                        "FOREIGN KEY (platform_bank_account_id) REFERENCES platform_bank_accounts(id)"
                    )
                )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_transactions_platform_bank_account_id "
                    "ON transactions (platform_bank_account_id)"
                )
            )

        telegram_bot_settings_columns = [
            ("telegram_bot_settings", "main_bot_token", "VARCHAR"),
            ("telegram_bot_settings", "is_active", "BOOLEAN DEFAULT FALSE"),
            ("telegram_bot_settings", "bot_username", "VARCHAR"),
            ("telegram_bot_settings", "display_name", "VARCHAR"),
            ("telegram_bot_settings", "last_validated_at", "TIMESTAMP"),
            ("telegram_bot_settings", "last_validation_error", "TEXT"),
            ("telegram_bot_settings", "created_at", "TIMESTAMP DEFAULT NOW()"),
            ("telegram_bot_settings", "is_running", "BOOLEAN DEFAULT FALSE"),
            ("telegram_bot_settings", "last_restart_at", "TIMESTAMP"),
            ("telegram_bot_settings", "last_crash_error", "TEXT"),
            ("telegram_bot_settings", "bot_kind", "VARCHAR(20) DEFAULT 'admin'"),
            ("telegram_bot_settings", "enabled_services", "JSON"),
        ]
        for table_name, column_name, column_type in telegram_bot_settings_columns:
            if not _table_exists(conn, table_name):
                continue
            if _column_exists(conn, table_name, column_name):
                continue
            conn.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
            )

        # backfill bot_kind for any pre-existing rows (all were per-admin bots)
        if _table_exists(conn, "telegram_bot_settings"):
            conn.execute(text(
                "UPDATE telegram_bot_settings SET bot_kind = 'admin' WHERE bot_kind IS NULL"
            ))

        # swap the old single-column unique constraint for (admin_id, bot_kind)
        if _table_exists(conn, "telegram_bot_settings"):
            old_uq_names = [
                        "telegram_bot_settings_admin_id_key",
                    ]

            for name in old_uq_names:
                        if _constraint_exists(conn, name):
                            conn.execute(
                                text(
                                    f"ALTER TABLE telegram_bot_settings "
                                    f"DROP CONSTRAINT {name}"
                                )
                            )
            conn.execute(
                text(
                    "DROP INDEX IF EXISTS ix_telegram_bot_settings_admin_id"
                )
            )

            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS "
                    "ix_telegram_bot_settings_admin_id "
                    "ON telegram_bot_settings (admin_id)"
                )
            )

            new_uq = "uq_telegram_bot_settings_admin_kind"
            if not _constraint_exists(conn, new_uq):
                conn.execute(text(f"SAVEPOINT sp_{new_uq}"))
                try:
                    conn.execute(text(
                        f"ALTER TABLE telegram_bot_settings ADD CONSTRAINT {new_uq} "
                        f"UNIQUE (admin_id, bot_kind)"
                    ))
                    conn.execute(text(f"RELEASE SAVEPOINT sp_{new_uq}"))
                except Exception as e:
                    conn.execute(text(f"ROLLBACK TO SAVEPOINT sp_{new_uq}"))
                    print(f"[ensure_schema] skip {new_uq}: {e}")

        # one-time data migration: fold global_bot_settings into telegram_bot_settings
        # as the master's global_main / support rows, then the old table can be dropped.
        if _table_exists(conn, "global_bot_settings") and _table_exists(conn, "telegram_bot_settings"):
            master_row = conn.execute(
                text("SELECT user_id FROM users WHERE role = 'master' ORDER BY user_id LIMIT 1")
            ).first()
            if master_row:
                master_id = master_row[0]
                old = conn.execute(text("SELECT * FROM global_bot_settings LIMIT 1")).mappings().first()
                if old:
                    for kind, token_col, uname_col, running_col, restart_col, crash_col in [
                        ("global_main", "main_bot_token", "main_bot_username",
                         "is_running_main", "main_last_restart_at", "main_last_crash_error"),
                        ("support", "support_bot_token", "support_bot_username",
                         "is_running_support", "support_last_restart_at", "support_last_crash_error"),
                    ]:
                        token = old.get(token_col)
                        exists = conn.execute(
                            text(
                                "SELECT 1 FROM telegram_bot_settings "
                                "WHERE admin_id = :aid AND bot_kind = :kind"
                            ),
                            {"aid": master_id, "kind": kind},
                        ).first()
                        if not exists and token:
                            conn.execute(
                                text(
                                    "INSERT INTO telegram_bot_settings "
                                    "(admin_id, bot_kind, main_bot_token, bot_username, "
                                    " is_active, is_running, last_restart_at, last_crash_error, default_language) "
                                    "VALUES (:aid, :kind, :token, :uname, :active, :running, :restart, :crash, 'en')"
                                ),
                                {
                                    "aid": master_id, "kind": kind, "token": token,
                                    "uname": old.get(uname_col), "active": bool(token),
                                    "running": bool(old.get(running_col)), "restart": old.get(restart_col),
                                    "crash": old.get(crash_col),
                                },
                            )
                conn.execute(text("DROP TABLE global_bot_settings"))
                
        order_items_columns = [
            ("order_items", "original_price", "NUMERIC(18,8)"),
            ("order_items", "discount_percent", "NUMERIC(5,2)"),
            ("order_items", "approved_at", "TIMESTAMP"),
            ("order_items", "approved_by", "VARCHAR(255)"),
            ("order_items", "rejected_at", "TIMESTAMP"),
            ("order_items", "rejected_by", "VARCHAR(255)"),
            ("order_items", "rejection_reason", "TEXT"),
            ("order_items", "delivered_by", "VARCHAR(255)"),
            ("order_items", "failed_at", "TIMESTAMP"),
            ("order_items", "failed_by", "VARCHAR(255)"),
            ("order_items", "fail_reason", "TEXT"),
        ]

        for table_name, column_name, column_type in order_items_columns:
            if not _table_exists(conn, table_name):
                print(f"[ensure_schema] skip {table_name}.{column_name}: table does not exist")
                continue
            if _column_exists(conn, table_name, column_name):
                continue
            conn.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
            )

        # backfill original_price for pre-existing rows so old orders don't
        # show a bogus "discount" once the frontend starts reading these fields
        if _table_exists(conn, "order_items"):
            conn.execute(
                text(
                    "UPDATE order_items SET original_price = price "
                    "WHERE original_price IS NULL"
                )
            )

        wire_order_columns = [
            ("wire_transfer_orders", "approved_at", "TIMESTAMP"),
            ("wire_transfer_orders", "rejected_at", "TIMESTAMP"),
            ("wire_transfer_orders", "delivered_at", "TIMESTAMP"),
            ("wire_transfer_orders", "failed_at", "TIMESTAMP"),
            ("wire_transfer_orders", "expired_at", "TIMESTAMP"),
            ("wire_transfer_orders", "approved_by", "VARCHAR(255)"),
            ("wire_transfer_orders", "rejected_by", "VARCHAR(255)"),
            ("wire_transfer_orders", "delivered_by", "VARCHAR(255)"),
            ("wire_transfer_orders", "failed_by", "VARCHAR(255)"),
            ("wire_transfer_orders", "delivery_message", "TEXT"),
            ("wire_transfer_orders", "balance_was_insufficient", "BOOLEAN DEFAULT FALSE"),
            ("transactions", "wire_transfer_order_id", "INTEGER"),
            ("platform_bank_accounts", "platform_kind", "VARCHAR(20) DEFAULT 'telegram_bot'"),
        ]

        for table_name, column_name, column_type in wire_order_columns:
            if not _table_exists(conn, table_name):
                print(f"[ensure_schema] skip {table_name}.{column_name}: table does not exist")
                continue
            if _column_exists(conn, table_name, column_name):
                continue
            conn.execute(
                text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
            )

        # --- Step 1: created_by → admin_id on users/products ---
        for table_name in ("users", "products"):
            _migrate_created_by_to_admin_id(conn, table_name)

        # --- Step 1: admin_id on rates / pairs / orders ---
        for table_name in (
            "exchange_rates",
            "exchange_pairs",
            "wire_transfer_pairs",
            "exchange_orders",
            "wire_transfer_orders",
        ):
            _add_admin_id_column(conn, table_name)

        _backfill_admin_id_to_master(conn, "exchange_rates")
        _backfill_admin_id_to_master(conn, "wire_transfer_pairs")
        _backfill_admin_id_to_master(conn, "exchange_pairs")
        _recompute_exchange_order_admin_from_pair(conn)
        _backfill_admin_id_from_user(conn, "exchange_orders")
        _backfill_admin_id_from_user(conn, "wire_transfer_orders")
        _recompute_wire_order_admin_from_pair(conn)

        _migrate_exchange_rate_history_changed_by(conn)
        _migrate_conversations_kind(conn)
        _migrate_subscription_columns(conn)
        _migrate_access_point_required_plans(conn)

def _rls_enabled(conn, table_name: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT relrowsecurity FROM pg_class "
                "WHERE relname = :t AND relnamespace = 'public'::regnamespace"
            ),
            {"t": table_name},
        ).scalar()
    )


def _policy_exists(conn, table_name: str, policy_name: str) -> bool:
    return bool(
        conn.execute(
            text(
                "SELECT 1 FROM pg_policies "
                "WHERE schemaname = 'public' AND tablename = :t AND policyname = :p"
            ),
            {"t": table_name, "p": policy_name},
        ).scalar()
    )


def _apply_rls(conn, table_name: str, using_sql: str, policy_name: str | None = None):
    if not _table_exists(conn, table_name):
        print(f"[ensure_rls] skip {table_name}: table does not exist")
        return

    policy_name = policy_name or f"rls_{table_name}"

    conn.execute(text(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY"))
    # Without FORCE, the table owner (usually the app's own DB role) bypasses
    # RLS entirely, silently making every policy below a no-op.
    conn.execute(text(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY"))

    if not _policy_exists(conn, table_name, policy_name):
        conn.execute(text(f"CREATE POLICY {policy_name} ON {table_name} USING ({using_sql})"))



def ensure_rls_policies():
    with engine.begin() as conn:
        is_master = "COALESCE(NULLIF(current_setting('app.is_master', true), ''), 'false')::boolean IS TRUE"
        is_global_bot = "COALESCE(NULLIF(current_setting('app.is_global_bot', true), ''), 'false')::boolean IS TRUE"
        cur_admin = "NULLIF(current_setting('app.current_admin_id', true), '')::int"

        GLOBAL_BOT_TABLES = {"products", "exchange_pairs", "wire_transfer_pairs"}

        for table in _BUCKET_A_TABLES:
                # admin_id may be NULL for master/top-level admin rows —
                # fall back to checking the row's own user_id in that case.
            if table == "users":
                using_sql = (
                    f"{is_master} OR admin_id = {cur_admin} OR user_id = {cur_admin} "
                    f"OR ({is_global_bot} AND is_admin_global_eligible(COALESCE(admin_id, user_id)))"
                )
            elif table in GLOBAL_BOT_TABLES:
                using_sql = (
                    f"{is_master} OR admin_id = {cur_admin} "
                    f"OR ({is_global_bot} AND is_admin_global_eligible(admin_id))"
                )
            else:
                using_sql = f"{is_master} OR admin_id = {cur_admin}"
            _apply_rls(conn, table, using_sql)

        # ── Bucket B (unchanged) ──────────────────────────────
        for table in _BUCKET_B_TABLES:
            _apply_rls(
                conn, table,
                f"{is_master} OR user_id = {cur_admin} "
                f"OR user_id IN (SELECT user_id FROM users WHERE admin_id = {cur_admin})"
            )

        # ── messages: two-hop via conversation_id -> conversations.user_id -> users.admin_id
        _apply_rls(
            conn, "messages",
            f"{is_master} OR conversation_id IN ("
            f"SELECT c.id FROM conversations c JOIN users u ON u.user_id = c.user_id "
            f"WHERE u.admin_id = {cur_admin} OR c.user_id = {cur_admin})"
        )

        # ── Bucket C — special cases ────────────────────────────
        _apply_rls(
            conn, "order_items",
            f"{is_master} OR product_id IN (SELECT id FROM products WHERE admin_id = {cur_admin})"
        )
        _apply_rls(
            conn, "exchange_inventory_ledger",
            f"{is_master} OR order_id IN (SELECT id FROM exchange_orders WHERE admin_id = {cur_admin})"
        )
        _apply_rls(
            conn, "exchange_rate_history",
            f"{is_master} OR pair_id IN (SELECT id FROM exchange_pairs WHERE admin_id = {cur_admin})"
        )
        _apply_rls(
            conn, "invitation_codes",
            f"{is_master} OR created_by_user_id = {cur_admin} OR created_by_user_id IS NULL"
        )

        print("[ensure_rls] RLS policies applied")

        
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _ensure_global_eligibility_function(conn):
    # check_function_bodies must be off here: with FORCE RLS already applied
    # to "users" from a previous boot, Postgres validates this function's
    # SQL body against the current (contextless) session at CREATE time —
    # not against the function's own `SET row_security = off`, which only
    # takes effect when the function actually runs. Without this, every
    # restart after RLS has been applied once fails with an RLS permission
    # error during CREATE OR REPLACE FUNCTION itself.
    conn.execute(text("SET LOCAL check_function_bodies = off"))
    conn.execute(text("""
        CREATE OR REPLACE FUNCTION is_admin_global_eligible(check_admin_id integer)
        RETURNS boolean
        LANGUAGE sql
        STABLE
        SECURITY DEFINER
        SET row_security = off
        AS $$
          SELECT EXISTS (
            SELECT 1 FROM users
            WHERE user_id = check_admin_id
              AND (
                role = 'master'
                OR access_points::jsonb @> '["telegram.global.bot"]'::jsonb
              )
          );
        $$;
    """))

def _recompute_exchange_order_admin_from_pair(conn) -> None:
    """
    exchange_orders.admin_id was originally backfilled from the buyer's
    User.admin_id (Step 1, before ExchangePair.admin_id existed). Now that
    pairs carry their true owner, re-derive admin_id from the matching
    ExchangePair (same from/to currency + admin) wherever the match is
    unambiguous. Orders whose currency pair no longer resolves to exactly
    one pair are left untouched (fresh orders created after this fix
    already carry the correct value from the application code).
    """
    if not _table_exists(conn, "exchange_orders") or not _table_exists(conn, "exchange_pairs"):
        print("[ensure_schema] skip exchange_orders admin recompute: table(s) missing")
        return

    conn.execute(
        text(
            """
            UPDATE exchange_orders eo
            SET admin_id = matched.admin_id
            FROM (
                SELECT from_currency_id, to_currency_id, admin_id
                FROM exchange_pairs
                GROUP BY from_currency_id, to_currency_id, admin_id
                HAVING COUNT(*) = (
                    SELECT COUNT(*) FROM exchange_pairs ep2
                    WHERE ep2.from_currency_id = exchange_pairs.from_currency_id
                      AND ep2.to_currency_id = exchange_pairs.to_currency_id
                )
            ) matched
            WHERE eo.from_currency_id = matched.from_currency_id
              AND eo.to_currency_id = matched.to_currency_id
              AND eo.admin_id IS DISTINCT FROM matched.admin_id
              AND (
                  SELECT COUNT(*) FROM exchange_pairs ep3
                  WHERE ep3.from_currency_id = eo.from_currency_id
                    AND ep3.to_currency_id = eo.to_currency_id
              ) = 1
            """
        )
    )


def _recompute_wire_order_admin_from_pair(conn) -> None:
    """
    Same rationale as _recompute_exchange_order_admin_from_pair: wire_transfer_orders.admin_id
    was originally backfilled from the buyer's User.admin_id before pairs had
    a real owner concept enforced at creation. Re-derive from the unambiguous
    matching pair.
    """
    if not _table_exists(conn, "wire_transfer_orders") or not _table_exists(conn, "wire_transfer_pairs"):
        print("[ensure_schema] skip wire_transfer_orders admin recompute: table(s) missing")
        return

    conn.execute(
        text(
            """
            UPDATE wire_transfer_orders wto
            SET admin_id = wtp.admin_id
            FROM wire_transfer_pairs wtp
            WHERE wto.pair_id = wtp.id
              AND wto.admin_id IS DISTINCT FROM wtp.admin_id
            """
        )
    )

def _migrate_subscription_columns(conn) -> None:
    """
    Adds the v2 subscription columns (discount_percent on both price
    tables, duration_days on plans) to tables that may already exist from
    an earlier deployment of this feature, without touching any existing
    rows/history. required_plan_id is handled separately by
    _migrate_access_point_required_plans, which migrates it into a
    many-to-many table instead of re-adding the old single-FK column.
    """
    targets = [
        ("access_point_prices", "discount_percent", "NUMERIC(5,2) DEFAULT 0"),
        ("plans", "duration_days", "INTEGER DEFAULT 30"),
        ("plan_prices", "discount_percent", "NUMERIC(5,2) DEFAULT 0"),
        ("subscription_invoices", "discount_percent", "NUMERIC(5,2) DEFAULT 0"),
    ]

    for table_name, column_name, column_type in targets:
        if not _table_exists(conn, table_name):
            print(f"[ensure_schema] skip {table_name}.{column_name}: table does not exist")
            continue
        if _column_exists(conn, table_name, column_name):
            continue
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))


def _migrate_access_point_required_plans(conn) -> None:
    """
    v3 of the access-point plan-gating feature: replaces the single
    access_point_catalog.required_plan_id column with a many-to-many
    access_point_required_plans join table, so one access point can be
    unlocked by several plans at once (e.g. "Starter OR Business" for a
    Global Bot add-on). Any existing single-plan links are copied into
    the join table before the legacy column + its FK are dropped, so no
    prior gating configuration is lost.
    """
    if not _table_exists(conn, "access_point_catalog") or not _table_exists(conn, "plans"):
        print("[ensure_schema] skip access_point_required_plans: base tables missing")
        return

    if not _table_exists(conn, "access_point_required_plans"):
        conn.execute(text(
            """
            CREATE TABLE access_point_required_plans (
                access_point_id INTEGER NOT NULL REFERENCES access_point_catalog(id) ON DELETE CASCADE,
                plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
                PRIMARY KEY (access_point_id, plan_id)
            )
            """
        ))
        print("[ensure_schema] created access_point_required_plans")

    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_access_point_required_plans_plan_id "
            "ON access_point_required_plans (plan_id)"
        )
    )

    # Legacy single-plan column may still be present from an earlier
    # deployment (or from _migrate_subscription_columns runs prior to
    # this function existing) — backfill it into the join table, then
    # drop it so the app's model (which no longer declares the column)
    # stays in sync with the schema.
    if _column_exists(conn, "access_point_catalog", "required_plan_id"):
        conn.execute(text(
            """
            INSERT INTO access_point_required_plans (access_point_id, plan_id)
            SELECT id, required_plan_id FROM access_point_catalog
            WHERE required_plan_id IS NOT NULL
            ON CONFLICT DO NOTHING
            """
        ))

        fk_name = "fk_access_point_catalog_required_plan"
        if _constraint_exists(conn, fk_name):
            conn.execute(text(f"SAVEPOINT sp_drop_{fk_name}"))
            try:
                conn.execute(text(f"ALTER TABLE access_point_catalog DROP CONSTRAINT {fk_name}"))
                conn.execute(text(f"RELEASE SAVEPOINT sp_drop_{fk_name}"))
            except Exception as e:
                conn.execute(text(f"ROLLBACK TO SAVEPOINT sp_drop_{fk_name}"))
                print(f"[ensure_schema] skip dropping FK {fk_name}: {e}")

        conn.execute(text("SAVEPOINT sp_drop_required_plan_id"))
        try:
            conn.execute(text("ALTER TABLE access_point_catalog DROP COLUMN required_plan_id"))
            conn.execute(text("RELEASE SAVEPOINT sp_drop_required_plan_id"))
            print("[ensure_schema] migrated access_point_catalog.required_plan_id -> access_point_required_plans")
        except Exception as e:
            conn.execute(text("ROLLBACK TO SAVEPOINT sp_drop_required_plan_id"))
            print(f"[ensure_schema] skip dropping access_point_catalog.required_plan_id: {e}")