"""
Bot Instance Manager — runs embedded inside the FastAPI process.

Spawns/monitors/restarts one OS subprocess per bot: every admin's personal
bot (bot_kind="admin"), plus master's two platform-wide bots — the global
main bot (bot_kind="global_main", used for Wires/global product listing) and
the support bot (bot_kind="support"). All three kinds now live in the single
TelegramBotSettings table, keyed by (admin_id, bot_kind); master's global
bots are rows owned by master's own user_id.

Each subprocess is `python -m app.bot.bot` (or app.bot.support_bot for the
support bot), with BOT_TOKEN / BOT_ADMIN_ID / API_URL injected via env=,
isolating identity per process. No shared memory between bots — only the DB.
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
from app.models.user import TelegramBotSettings, User
from app.services.telegram_validation_service import validate_telegram_token

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("instance_manager")

POLL_INTERVAL_SECONDS = 15
API_URL = os.environ.get("API_URL", "http://127.0.0.1:8000")
PYTHON_BIN = sys.executable

CRASH_BACKOFF = [0, 30, 120]
MAX_CRASH_RETRIES = len(CRASH_BACKOFF)

GLOBAL_SUPPORT_KEY = "global_support"
GLOBAL_MAIN_KEY = "global_main"

# bot_kind -> registry key / spawn kind / module
KIND_TO_REGISTRY_KEY = {"global_main": GLOBAL_MAIN_KEY, "support": GLOBAL_SUPPORT_KEY}
KIND_TO_SPAWN_KIND = {"global_main": "main_global", "support": "support"}
KIND_TO_MODULE = {"global_main": "app.bot.bot", "support": "app.bot.support_bot"}

LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "logs", "bots")
os.makedirs(LOG_DIR, exist_ok=True)


@dataclass
class BotInstance:
    key: str                          # admin_id (str) for personal bots, or GLOBAL_MAIN_KEY/GLOBAL_SUPPORT_KEY
    kind: str                         # "admin" | "support" | "main_global"
    module: str                       # "app.bot.bot" | "app.bot.support_bot"
    token: str
    admin_id: Optional[int]           # owner in TelegramBotSettings.admin_id (master's id for global bots)
    process: Optional[subprocess.Popen] = None
    status: str = "stopped"
    last_restart_at: Optional[datetime] = None
    last_error: Optional[str] = None
    restart_attempts: int = 0
    intentional_stop: bool = False
    token_version: str = field(default="")
    log_file: Optional[object] = None


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
            "BOT_KIND": inst.kind,
            "PYTHONIOENCODING": "utf-8",
            "PYTHONUTF8": "1",
        }
        if inst.kind == "support":
            env["SUPPORT_BOT_TOKEN"] = inst.token
            env.pop("BOT_TOKEN", None)
        else:
            env["BOT_TOKEN"] = inst.token
            env.pop("SUPPORT_BOT_TOKEN", None)
        if inst.kind == "admin" and inst.admin_id is not None:
            env["BOT_ADMIN_ID"] = str(inst.admin_id)
        else:
            env.pop("BOT_ADMIN_ID", None)

        logger.info(f"Spawning {inst.kind} bot [{inst.key}] module={inst.module}")

        log_path = os.path.join(LOG_DIR, f"{inst.kind}_{inst.key}.log")
        log_file = open(log_path, "a", encoding="utf-8")

        popen_kwargs = dict(env=env, stdout=log_file, stderr=log_file)
        if os.name == "nt":
            popen_kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW

        try:
            proc = subprocess.Popen([PYTHON_BIN, "-m", inst.module], **popen_kwargs)
        except Exception as e:
            inst.status = "crashed"
            inst.last_error = f"Failed to spawn: {e}"
            self._persist_status(inst)
            logger.error(f"[{inst.key}] spawn failed: {e}")
            log_file.close()
            return

        inst.process = proc
        inst.log_file = log_file
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
            if inst.log_file:
                try:
                    inst.log_file.close()
                except Exception:
                    pass
                inst.log_file = None
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
    # DB STATUS SYNC — everything is TelegramBotSettings(admin_id, bot_kind)
    # ─────────────────────────────────────────────

    def _global_owner_id(self, db) -> Optional[int]:
        row = db.query(User).filter(User.role == "master").order_by(User.user_id).first()
        return row.user_id if row else None

    def _persist_status(self, inst: BotInstance):
        db = SessionLocal()
        try:
            bot_kind = {"admin": "admin", "support": "support", "main_global": "global_main"}[inst.kind]
            admin_id = inst.admin_id if inst.kind == "admin" else self._global_owner_id(db)
            if admin_id is None:
                return

            row = db.query(TelegramBotSettings).filter(
                TelegramBotSettings.admin_id == admin_id,
                TelegramBotSettings.bot_kind == bot_kind,
            ).first()
            if not row:
                return

            row.is_running = (inst.status == "running")
            if inst.status == "running":
                row.last_restart_at = inst.last_restart_at
            if inst.status == "crashed":
                row.last_crash_error = inst.last_error
            db.commit()
        except Exception as e:
            logger.error(f"Failed to persist status for [{inst.key}]: {e}")
            db.rollback()
        finally:
            db.close()

    # ─────────────────────────────────────────────
    # STARTUP — reads tokens from DB only
    # ─────────────────────────────────────────────

    def startup(self):
        db = SessionLocal()
        try:
            admin_rows = db.query(TelegramBotSettings).filter(
                TelegramBotSettings.bot_kind == "admin",
                TelegramBotSettings.is_active == True,
                TelegramBotSettings.main_bot_token.isnot(None),
            ).all()
            for row in admin_rows:
                key = str(row.admin_id)
                inst = BotInstance(key=key, kind="admin", module="app.bot.bot", token=row.main_bot_token, admin_id=row.admin_id)
                self.registry[key] = inst
                self._spawn(inst)

            for kind, registry_key in KIND_TO_REGISTRY_KEY.items():
                row = db.query(TelegramBotSettings).filter(
                    TelegramBotSettings.bot_kind == kind,
                    TelegramBotSettings.is_active == True,
                    TelegramBotSettings.main_bot_token.isnot(None),
                ).first()
                if row:
                    inst = BotInstance(
                        key=registry_key,
                        kind=KIND_TO_SPAWN_KIND[kind],
                        module=KIND_TO_MODULE[kind],
                        token=row.main_bot_token,
                        admin_id=row.admin_id,
                    )
                    self.registry[registry_key] = inst
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
                TelegramBotSettings.bot_kind == "admin",
                TelegramBotSettings.updated_at > since,
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
                    inst = BotInstance(key=key, kind="admin", module="app.bot.bot", token=row.main_bot_token, admin_id=row.admin_id)
                    self.registry[key] = inst
                    self._spawn(inst)
                    continue

                if existing.token_version != row.main_bot_token:
                    self._handle_token_change(existing, row.main_bot_token)
                elif existing.status != "running":
                    self._spawn(existing)

            for kind, registry_key in KIND_TO_REGISTRY_KEY.items():
                row = db.query(TelegramBotSettings).filter(
                    TelegramBotSettings.bot_kind == kind,
                    TelegramBotSettings.updated_at > since,
                ).first()
                if row:
                    self._sync_global_bot(
                        key=registry_key,
                        kind=KIND_TO_SPAWN_KIND[kind],
                        module=KIND_TO_MODULE[kind],
                        token=row.main_bot_token if row.is_active else None,
                        admin_id=row.admin_id,
                    )

        except Exception as e:
            logger.error(f"poll_changes error: {e}")
        finally:
            db.close()
            self.last_poll_ts = datetime.utcnow()

    def _sync_global_bot(self, key: str, kind: str, module: str, token: Optional[str], admin_id: Optional[int]):
        existing = self.registry.get(key)
        if not token:
            if existing and existing.status == "running":
                self._terminate(existing, reason="deactivated")
            return

        if not existing:
            inst = BotInstance(key=key, kind=kind, module=module, token=token, admin_id=admin_id)
            self.registry[key] = inst
            self._spawn(inst)
            return

        if existing.token_version != token:
            self._handle_token_change(existing, token)
        elif existing.status != "running":
            self._spawn(existing)

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
                continue

            if inst.intentional_stop:
                inst.status = "stopped"
                inst.intentional_stop = False
                continue

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
    # ASYNC LOOP
    # ─────────────────────────────────────────────

    async def start(self):
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
        logger.info("Instance Manager shutting down…")
        self._running = False
        if self._task:
            self._task.cancel()
        for inst in list(self.registry.values()):
            await asyncio.to_thread(self._terminate, inst, "app shutdown")

    # ─────────────────────────────────────────────
    # PER-ADMIN CONTROL
    # ─────────────────────────────────────────────

    def start_admin_bot(self, admin_id: int, token: str):
        key = str(admin_id)
        existing = self.registry.get(key)
        if existing and existing.status == "running":
            return {"ok": True, "message": "Already running"}

        if not existing:
            existing = BotInstance(key=key, kind="admin", module="app.bot.bot", token=token, admin_id=admin_id)
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
    # GLOBAL BOT CONTROL (master's global_main / support)
    # ─────────────────────────────────────────────

    def restart_global_bot(self, kind: str, token: str, admin_id: int):
        registry_key = KIND_TO_REGISTRY_KEY[kind]
        existing = self.registry.get(registry_key)
        if not existing:
            existing = BotInstance(
                key=registry_key,
                kind=KIND_TO_SPAWN_KIND[kind],
                module=KIND_TO_MODULE[kind],
                token=token,
                admin_id=admin_id,
            )
            self.registry[registry_key] = existing
            self._spawn(existing)
        else:
            self._restart(existing, new_token=token)
        return {"ok": existing.status == "running", "status": existing.status, "error": existing.last_error}

    def stop_global_bot(self, kind: str):
        registry_key = KIND_TO_REGISTRY_KEY[kind]
        inst = self.registry.get(registry_key)
        if not inst or inst.status != "running":
            return {"ok": True, "message": "Already stopped"}
        self._terminate(inst, reason="master requested stop")
        return {"ok": True, "status": inst.status}

    def get_global_status(self, kind: str):
        registry_key = KIND_TO_REGISTRY_KEY[kind]
        inst = self.registry.get(registry_key)
        if not inst:
            return {"status": "stopped", "running": False}
        return {
            "status": inst.status,
            "running": inst.status == "running",
            "last_restart_at": inst.last_restart_at,
            "last_error": inst.last_error,
            "restart_attempts": inst.restart_attempts,
        }


manager = InstanceManager()