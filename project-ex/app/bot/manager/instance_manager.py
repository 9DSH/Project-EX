"""
Bot Instance Manager — runs embedded inside the FastAPI process.

Spawns/monitors/restarts one OS subprocess per admin's Telegram bot token,
plus the two Global bots (support + main/Wires). Started from FastAPI's
startup event and stopped on shutdown — see app/main.py.

Each subprocess is `python -m app.bot.bot` (or app.bot.support_bot for the
support bot), with BOT_TOKEN / BOT_ADMIN_ID / API_URL injected via env=,
isolating identity per process. No shared memory between bots — only the DB.

Tokens are NEVER hardcoded or read from .env — they come from the DB
(TelegramBotSettings.main_bot_token / GlobalBotSettings.*_token), entered
by admins/master through the panel (Step 4 endpoints).
"""

import os
import sys
import subprocess
import time
import logging
import asyncio
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from app.db.database import SessionLocal
from app.models.user import TelegramBotSettings
from app.models.global_bot_settings import GlobalBotSettings
from app.services.telegram_validation_service import validate_telegram_token

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("instance_manager")

POLL_INTERVAL_SECONDS = 15
API_URL = os.environ.get("API_URL", "http://127.0.0.1:8000")
PYTHON_BIN = sys.executable

# backoff schedule in seconds between crash-retry attempts
CRASH_BACKOFF = [0, 30, 120]
MAX_CRASH_RETRIES = len(CRASH_BACKOFF)

# distinct sentinel keys for the two global bots in the registry
GLOBAL_SUPPORT_KEY = "global_support"
GLOBAL_MAIN_KEY = "global_main"


@dataclass
class BotInstance:
    key: str                          # admin_id (str) or GLOBAL_SUPPORT_KEY/GLOBAL_MAIN_KEY
    kind: str                         # "admin" | "support" | "main_global"
    module: str                       # "app.bot.bot" | "app.bot.support_bot"
    token: str
    admin_id: Optional[int]
    process: Optional[subprocess.Popen] = None
    status: str = "stopped"           # stopped | running | crashed | restarting
    last_restart_at: Optional[datetime] = None
    last_error: Optional[str] = None
    restart_attempts: int = 0
    intentional_stop: bool = False
    token_version: str = field(default="")  # last-known token, to detect changes


class InstanceManager:
    def __init__(self):
        self.registry: dict[str, BotInstance] = {}
        self.last_poll_ts = datetime.min
        self._running = False
        self._task = None

    # ─────────────────────────────────────────────
    # PROCESS LIFECYCLE
    # ─────────────────────────────────────────────

    def _spawn(self, inst: BotInstance):
        env = {
            **os.environ,
            "API_URL": API_URL,
        }
        if inst.kind == "support":
            env["SUPPORT_BOT_TOKEN"] = inst.token
            env.pop("BOT_TOKEN", None)
        else:
            env["BOT_TOKEN"] = inst.token
            env.pop("SUPPORT_BOT_TOKEN", None)
        if inst.admin_id is not None:
            env["BOT_ADMIN_ID"] = str(inst.admin_id)
        else:
            env.pop("BOT_ADMIN_ID", None)

        logger.info(f"Spawning {inst.kind} bot [{inst.key}] module={inst.module}")

        popen_kwargs = dict(
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if os.name == "nt":
            popen_kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW

        try:
            proc = subprocess.Popen([PYTHON_BIN, "-m", inst.module], **popen_kwargs)
        except Exception as e:
            inst.status = "crashed"
            inst.last_error = f"Failed to spawn: {e}"
            self._persist_status(inst)
            logger.error(f"[{inst.key}] spawn failed: {e}")
            return

        inst.process = proc
        inst.status = "running"
        inst.last_restart_at = datetime.utcnow()
        inst.last_error = None
        inst.restart_attempts = 0
        inst.intentional_stop = False
        inst.token_version = inst.token
        self._persist_status(inst)

    def _terminate(self, inst: BotInstance, reason: str = ""):
        if not inst.process or inst.process.poll() is not None:
            inst.status = "stopped"
            self._persist_status(inst)
            return

        inst.intentional_stop = True
        logger.info(f"Terminating {inst.kind} bot [{inst.key}] ({reason})")
        inst.process.terminate()
        try:
            inst.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            logger.warning(f"[{inst.key}] did not exit in time, killing")
            inst.process.kill()
            try:
                inst.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass

        inst.status = "stopped"
        self._persist_status(inst)

    def _restart(self, inst: BotInstance, new_token: Optional[str] = None):
        self._terminate(inst, reason="restart")
        if new_token:
            inst.token = new_token
        self._spawn(inst)

    # ─────────────────────────────────────────────
    # DB STATUS SYNC
    # ─────────────────────────────────────────────

    def _persist_status(self, inst: BotInstance):
        db = SessionLocal()
        try:
            if inst.kind == "admin":
                row = db.query(TelegramBotSettings).filter(
                    TelegramBotSettings.admin_id == inst.admin_id
                ).first()
                if not row:
                    return
                row.is_running = (inst.status == "running")
                if inst.status == "running":
                    row.last_restart_at = inst.last_restart_at
                if inst.status == "crashed":
                    row.last_crash_error = inst.last_error
                db.commit()

            elif inst.kind == "support":
                row = db.query(GlobalBotSettings).first()
                if not row:
                    return
                row.is_running_support = (inst.status == "running")
                if inst.status == "running":
                    row.support_last_restart_at = inst.last_restart_at
                if inst.status == "crashed":
                    row.support_last_crash_error = inst.last_error
                db.commit()

            elif inst.kind == "main_global":
                row = db.query(GlobalBotSettings).first()
                if not row:
                    return
                row.is_running_main = (inst.status == "running")
                if inst.status == "running":
                    row.main_last_restart_at = inst.last_restart_at
                if inst.status == "crashed":
                    row.main_last_crash_error = inst.last_error
                db.commit()
        except Exception as e:
            logger.error(f"Failed to persist status for [{inst.key}]: {e}")
            db.rollback()
        finally:
            db.close()

    # ─────────────────────────────────────────────
    # STARTUP — reads tokens from DB, never from env/.env
    # ─────────────────────────────────────────────

    def startup(self):
        db = SessionLocal()
        try:
            admin_rows = db.query(TelegramBotSettings).filter(
                TelegramBotSettings.is_active == True,
                TelegramBotSettings.main_bot_token.isnot(None),
            ).all()

            for row in admin_rows:
                key = str(row.admin_id)
                inst = BotInstance(
                    key=key,
                    kind="admin",
                    module="app.bot.bot",
                    token=row.main_bot_token,
                    admin_id=row.admin_id,
                )
                self.registry[key] = inst
                self._spawn(inst)

            global_row = db.query(GlobalBotSettings).first()
            if global_row and global_row.support_bot_token:
                inst = BotInstance(
                    key=GLOBAL_SUPPORT_KEY,
                    kind="support",
                    module="app.bot.support_bot",
                    token=global_row.support_bot_token,
                    admin_id=None,
                )
                self.registry[GLOBAL_SUPPORT_KEY] = inst
                self._spawn(inst)

            if global_row and global_row.main_bot_token:
                inst = BotInstance(
                    key=GLOBAL_MAIN_KEY,
                    kind="main_global",
                    module="app.bot.bot",
                    token=global_row.main_bot_token,
                    admin_id=None,
                )
                self.registry[GLOBAL_MAIN_KEY] = inst
                self._spawn(inst)

        finally:
            db.close()

        self.last_poll_ts = datetime.utcnow()

    # ─────────────────────────────────────────────
    # POLL LOOP — CHANGE DETECTION
    # ─────────────────────────────────────────────

    def poll_changes(self):
        db = SessionLocal()
        try:
            since = self.last_poll_ts

            admin_rows = db.query(TelegramBotSettings).filter(
                TelegramBotSettings.updated_at > since
            ).all()

            for row in admin_rows:
                key = str(row.admin_id)
                existing = self.registry.get(key)

                should_run = bool(row.is_active and row.main_bot_token)

                if not should_run:
                    if existing and existing.status == "running":
                        self._terminate(existing, reason="deactivated")
                    continue

                if not existing:
                    inst = BotInstance(
                        key=key, kind="admin", module="app.bot.bot",
                        token=row.main_bot_token, admin_id=row.admin_id,
                    )
                    self.registry[key] = inst
                    self._spawn(inst)
                    continue

                if existing.token_version != row.main_bot_token:
                    self._handle_token_change(existing, row.main_bot_token)
                elif existing.status != "running":
                    # was deactivated before, now flipped back to active
                    self._spawn(existing)

            global_row = db.query(GlobalBotSettings).first()
            if global_row and global_row.updated_at and global_row.updated_at > since:
                self._sync_global_bot(
                    key=GLOBAL_SUPPORT_KEY, kind="support", module="app.bot.support_bot",
                    token=global_row.support_bot_token,
                )
                self._sync_global_bot(
                    key=GLOBAL_MAIN_KEY, kind="main_global", module="app.bot.bot",
                    token=global_row.main_bot_token,
                )

        except Exception as e:
            logger.error(f"poll_changes error: {e}")
        finally:
            db.close()
            self.last_poll_ts = datetime.utcnow()

    def _sync_global_bot(self, key: str, kind: str, module: str, token: Optional[str]):
        existing = self.registry.get(key)
        if not token:
            if existing and existing.status == "running":
                self._terminate(existing, reason="token cleared")
            return

        if not existing:
            inst = BotInstance(key=key, kind=kind, module=module, token=token, admin_id=None)
            self.registry[key] = inst
            self._spawn(inst)
            return

        if existing.token_version != token:
            self._handle_token_change(existing, token)

    def _handle_token_change(self, inst: BotInstance, new_token: str):
        logger.info(f"[{inst.key}] token change detected, validating…")
        try:
            result = asyncio.run(validate_telegram_token(new_token))
        except Exception as e:
            logger.error(f"[{inst.key}] validation errored: {e}")
            return

        if not result.valid:
            logger.warning(f"[{inst.key}] new token failed validation: {result.error} — keeping old process running")
            return

        self._restart(inst, new_token=new_token)

    # ─────────────────────────────────────────────
    # CRASH DETECTION + BACKOFF RETRY
    # ─────────────────────────────────────────────

    def check_crashes(self):
        for inst in list(self.registry.values()):
            if inst.status != "running" or not inst.process:
                continue

            ret = inst.process.poll()
            if ret is None:
                continue  # still alive

            if inst.intentional_stop:
                inst.status = "stopped"
                inst.intentional_stop = False
                continue

            # unexpected exit
            logger.warning(f"[{inst.key}] process exited unexpectedly (code={ret})")
            inst.last_error = f"Process exited with code {ret}"

            if inst.restart_attempts >= MAX_CRASH_RETRIES:
                inst.status = "crashed"
                self._persist_status(inst)
                logger.error(f"[{inst.key}] gave up after {inst.restart_attempts} retries — manual restart required")
                continue

            delay = CRASH_BACKOFF[inst.restart_attempts]
            inst.restart_attempts += 1
            inst.status = "restarting"
            self._persist_status(inst)
            logger.info(f"[{inst.key}] retrying in {delay}s (attempt {inst.restart_attempts}/{MAX_CRASH_RETRIES})")
            time.sleep(delay)
            self._spawn(inst)

    # ─────────────────────────────────────────────
    # ASYNC LOOP — embedded in FastAPI process
    # ─────────────────────────────────────────────

    async def start(self):
        """Call once from FastAPI startup. Spawns everything, then returns
        immediately — the poll loop runs as a background asyncio task."""
        logger.info("Instance Manager starting…")
        await asyncio.to_thread(self.startup)
        self._running = True
        self._task = asyncio.create_task(self._loop())

    async def _loop(self):
        while self._running:
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            try:
                await asyncio.to_thread(self.check_crashes)
                await asyncio.to_thread(self.poll_changes)
            except Exception as e:
                logger.error(f"manager loop error: {e}")

    async def shutdown(self):
        """Call from FastAPI shutdown. Terminates every subprocess."""
        logger.info("Instance Manager shutting down…")
        self._running = False
        if self._task:
            self._task.cancel()
        for inst in list(self.registry.values()):
            await asyncio.to_thread(self._terminate, inst, "app shutdown")

    # ─────────────────────────────────────────────
    # PER-ADMIN CONTROL (called from API endpoints)
    # ─────────────────────────────────────────────

    def start_admin_bot(self, admin_id: int, token: str):
        key = str(admin_id)
        existing = self.registry.get(key)
        if existing and existing.status == "running":
            return {"ok": True, "message": "Already running"}

        if not existing:
            existing = BotInstance(
                key=key, kind="admin", module="app.bot.bot",
                token=token, admin_id=admin_id,
            )
            self.registry[key] = existing
        else:
            existing.token = token

        self._spawn(existing)
        return {"ok": existing.status == "running", "status": existing.status, "error": existing.last_error}

    def stop_admin_bot(self, admin_id: int):
        key = str(admin_id)
        inst = self.registry.get(key)
        if not inst or inst.status != "running":
            return {"ok": True, "message": "Already stopped"}
        self._terminate(inst, reason="admin requested stop")
        return {"ok": True, "status": inst.status}

    def restart_admin_bot(self, admin_id: int, token: Optional[str] = None):
        key = str(admin_id)
        inst = self.registry.get(key)
        if not inst:
            if not token:
                return {"ok": False, "error": "No running instance and no token supplied"}
            return self.start_admin_bot(admin_id, token)
        self._restart(inst, new_token=token)
        return {"ok": inst.status == "running", "status": inst.status, "error": inst.last_error}

    def get_status(self, admin_id: Optional[int] = None):
        if admin_id is not None:
            inst = self.registry.get(str(admin_id))
            if not inst:
                return {"status": "stopped", "running": False}
            return {
                "status": inst.status,
                "running": inst.status == "running",
                "last_restart_at": inst.last_restart_at,
                "last_error": inst.last_error,
                "restart_attempts": inst.restart_attempts,
            }
        return {
            key: {
                "status": inst.status,
                "running": inst.status == "running",
                "kind": inst.kind,
                "last_restart_at": inst.last_restart_at,
                "last_error": inst.last_error,
            }
            for key, inst in self.registry.items()
        }


# ─────────────────────────────────────────────
# SINGLETON — imported by main.py and routes
# ─────────────────────────────────────────────
manager = InstanceManager()