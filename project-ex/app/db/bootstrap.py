import os
import psycopg2
from psycopg2 import sql
from urllib.parse import urlparse

def _parse_db_url(url: str):
    p = urlparse(url)
    return {
        "user": p.username,
        "password": p.password,
        "host": p.hostname,
        "port": p.port or 5432,
        "dbname": p.path.lstrip("/"),
    }

def ensure_database_and_role():
    """
    Runs once at startup, before the app connects with DATABASE_URL.
    Uses PG_SUPERUSER_URL (postgres superuser, maintenance db) to:
      1. create the app role if missing
      2. create the app database (owned by that role) if missing
    Safe to run every boot — all checks are idempotent.
    """
    superuser_url = os.getenv("PG_SUPERUSER_URL")
    app_url = os.getenv("DATABASE_URL")

    if not superuser_url or not app_url:
        print("[bootstrap] PG_SUPERUSER_URL or DATABASE_URL missing — skipping auto-provision")
        return

    app_conf = _parse_db_url(app_url)
    su_conf = _parse_db_url(superuser_url)

    conn = psycopg2.connect(
        dbname=su_conf["dbname"] or "postgres",
        user=su_conf["user"],
        password=su_conf["password"],
        host=su_conf["host"],
        port=su_conf["port"],
    )
    conn.autocommit = True
    cur = conn.cursor()

    # 1. Role
    cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (app_conf["user"],))
    if not cur.fetchone():
        cur.execute(
            sql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD %s").format(
                sql.Identifier(app_conf["user"])
            ),
            (app_conf["password"],),
        )
        print(f"[bootstrap] created role '{app_conf['user']}'")

    # 2. Database
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (app_conf["dbname"],))
    if not cur.fetchone():
        cur.execute(
            sql.SQL("CREATE DATABASE {} OWNER {}").format(
                sql.Identifier(app_conf["dbname"]),
                sql.Identifier(app_conf["user"]),
            )
        )
        print(f"[bootstrap] created database '{app_conf['dbname']}'")

    cur.close()
    conn.close()