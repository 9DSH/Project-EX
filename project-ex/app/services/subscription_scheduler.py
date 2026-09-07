import asyncio
from datetime import datetime, timedelta

from app.db.database import SessionLocal, set_session_master
from app.models.subscription import AdminSubscription, AdminAddon
from app.models.user import User
from app.services.subscription_service import (
    attempt_renew_subscription,
    attempt_renew_addon,
    revoke_all_for_source,
    GRACE_PERIOD_DAYS,
    SOURCE_PLAN,
    SOURCE_ADDON,
)


def _notify(user: User, text: str):
    if not user or not user.telegram_id:
        return
    try:
        from app.services.telegram_service import send_telegram_message
        asyncio.create_task(send_telegram_message(chat_id=int(user.telegram_id), text=text))
    except Exception as e:
        print(f"❌ Failed to send subscription notification: {e}")


def _process_due_subscriptions(db):
    now = datetime.utcnow()

    due = db.query(AdminSubscription).filter(
        AdminSubscription.status == "active",
        AdminSubscription.forced_by_master == False,  # noqa: E712
        AdminSubscription.current_period_end.isnot(None),
        AdminSubscription.current_period_end <= now,
    ).all()

    for sub in due:
        user = db.query(User).filter(User.user_id == sub.admin_id).first()
        try:
            ok = attempt_renew_subscription(db, sub)
        except Exception as e:
            print(f"❌ Subscription renewal error (admin {sub.admin_id}): {e}")
            ok = False

        if ok:
            _notify(user, "✅ Your plan subscription was renewed successfully.")
        else:
            sub.status = "grace"
            sub.grace_started_at = now
            db.commit()
            _notify(
                user,
                "⚠️ Your plan renewal failed due to insufficient balance. "
                f"You have {GRACE_PERIOD_DAYS} days to top up before your plan access is revoked."
            )

    grace_expired = db.query(AdminSubscription).filter(
        AdminSubscription.status == "grace",
        AdminSubscription.grace_started_at.isnot(None),
        AdminSubscription.grace_started_at <= now - timedelta(days=GRACE_PERIOD_DAYS),
    ).all()

    for sub in grace_expired:
        user = db.query(User).filter(User.user_id == sub.admin_id).first()
        sub.status = "expired"
        sub.grace_started_at = None
        db.commit()
        revoke_all_for_source(db, sub.admin_id, source=SOURCE_PLAN, source_id=sub.id)
        _notify(user, "❌ Your plan's grace period ended and its access points have been revoked.")


def _process_due_addons(db):
    now = datetime.utcnow()

    due = db.query(AdminAddon).filter(
        AdminAddon.status == "active",
        AdminAddon.forced_by_master == False,  # noqa: E712
        AdminAddon.current_period_end.isnot(None),
        AdminAddon.current_period_end <= now,
    ).all()

    for addon in due:
        user = db.query(User).filter(User.user_id == addon.admin_id).first()
        try:
            ok = attempt_renew_addon(db, addon)
        except Exception as e:
            print(f"❌ Addon renewal error (admin {addon.admin_id}): {e}")
            ok = False

        if ok:
            _notify(user, "✅ Your add-on was renewed successfully.")
        else:
            addon.status = "grace"
            addon.grace_started_at = now
            db.commit()
            _notify(
                user,
                "⚠️ Your add-on renewal failed (insufficient balance or its required plan is no longer active). "
                f"You have {GRACE_PERIOD_DAYS} days before this add-on is revoked."
            )

    grace_expired = db.query(AdminAddon).filter(
        AdminAddon.status == "grace",
        AdminAddon.grace_started_at.isnot(None),
        AdminAddon.grace_started_at <= now - timedelta(days=GRACE_PERIOD_DAYS),
    ).all()

    for addon in grace_expired:
        user = db.query(User).filter(User.user_id == addon.admin_id).first()
        addon.status = "expired"
        addon.grace_started_at = None
        db.commit()
        revoke_all_for_source(db, addon.admin_id, source=SOURCE_ADDON, source_id=addon.id)
        _notify(user, "❌ Your add-on's grace period ended and it has been revoked.")


async def subscription_billing_loop(interval_seconds: int = 300):
    """
    Runs every 5 minutes: attempts renewals for subscriptions/addons past
    their period end, moves failed ones into a 7-day grace window, and
    revokes access for anything whose grace window has elapsed.

    Subscriptions/addons manually forced by master (forced_by_master=True)
    are skipped here entirely.
    """
    while True:
        db = SessionLocal()
        set_session_master(db)
        try:
            _process_due_subscriptions(db)
            _process_due_addons(db)
        except Exception as e:
            print("❌ SUBSCRIPTION BILLING LOOP ERROR:", str(e))
        finally:
            db.close()

        await asyncio.sleep(interval_seconds)