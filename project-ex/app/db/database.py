from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os
from pathlib import Path


env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


DATABASE_URL = os.getenv("DATABASE_URL")
print("DATABASE_URL LOADED:", DATABASE_URL)

if not DATABASE_URL:
    raise Exception("DATABASE_URL is missing. Check .env loading.")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


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


def ensure_schema():
    with engine.begin() as conn:
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
            "wire_transfer_pairs",
            "exchange_orders",
            "wire_transfer_orders",
        ):
            _add_admin_id_column(conn, table_name)

        _backfill_admin_id_to_master(conn, "exchange_rates")
        _backfill_admin_id_to_master(conn, "wire_transfer_pairs")
        _backfill_admin_id_from_user(conn, "exchange_orders")
        _backfill_admin_id_from_user(conn, "wire_transfer_orders")

        _migrate_exchange_rate_history_changed_by(conn)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()