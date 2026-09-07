from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Float,
    ForeignKey,
    DateTime,
    UniqueConstraint,
    Text,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.database import Base


# =========================================================
# ACCESS POINT CATALOG (root list — key/label + an optional
# required plan; pricing is per active currency/network pair
# via AccessPointPrice)
# =========================================================
class AccessPointCatalog(Base):
    __tablename__ = "access_point_catalog"

    id = Column(Integer, primary_key=True)

    key = Column(String, unique=True, nullable=False)      # e.g. "exchange.manage"
    label = Column(String, nullable=False)

    is_active = Column(Boolean, default=True)

    # If set, an admin must hold an active/grace subscription to THIS plan
    # before they're allowed to purchase this access point as an add-on.
    # NULL = purchasable by any admin regardless of plan. This relationship
    # IS the "Plan -> Available Add-ons" link (queried in reverse), so it
    # is never duplicated elsewhere.
    required_plan_id = Column(Integer, ForeignKey("plans.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    prices = relationship("AccessPointPrice", back_populates="access_point", cascade="all, delete-orphan")
    required_plan = relationship("Plan", foreign_keys=[required_plan_id])


class AccessPointPrice(Base):
    """
    Price of a single add-on access point, quoted in one currency/network
    pair, with an optional discount percentage. Master can set/update this
    any time an asset pair is active. Old rows are left in place (not
    deleted) if the underlying pair goes inactive, so historical invoices
    still resolve correctly.
    """
    __tablename__ = "access_point_prices"

    id = Column(Integer, primary_key=True)

    access_point_id = Column(Integer, ForeignKey("access_point_catalog.id"), nullable=False)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    network_id = Column(Integer, ForeignKey("networks.id"), nullable=False)

    price = Column(Float, nullable=False, default=0)
    discount_percent = Column(Float, nullable=False, default=0)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    access_point = relationship("AccessPointCatalog", back_populates="prices")
    currency = relationship("Currency")
    network = relationship("Network")

    __table_args__ = (
        UniqueConstraint("access_point_id", "currency_id", "network_id", name="uq_ap_price_pair"),
    )


# =========================================================
# PLANS
# =========================================================
class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True)

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)

    # Exactly one plan should be flagged as the default free/showcase plan
    # auto-assigned on admin signup. Enforced at the application layer.
    is_default = Column(Boolean, default=False)

    # Billing cycle length in days. Irrelevant for the default free plan
    # (it never renews / never expires).
    duration_days = Column(Integer, nullable=False, default=30)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    prices = relationship("PlanPrice", back_populates="plan", cascade="all, delete-orphan")
    access_points = relationship("PlanAccessPoint", back_populates="plan", cascade="all, delete-orphan")


class PlanPrice(Base):
    __tablename__ = "plan_prices"

    id = Column(Integer, primary_key=True)

    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    network_id = Column(Integer, ForeignKey("networks.id"), nullable=False)

    price = Column(Float, nullable=False, default=0)
    discount_percent = Column(Float, nullable=False, default=0)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan = relationship("Plan", back_populates="prices")
    currency = relationship("Currency")
    network = relationship("Network")

    __table_args__ = (
        UniqueConstraint("plan_id", "currency_id", "network_id", name="uq_plan_price_pair"),
    )


class PlanAccessPoint(Base):
    """
    Fixed/included access points bundled into a plan — automatically
    granted the moment an admin subscribes, no separate purchase needed.
    `choice_group` groups mutually-exclusive options — e.g. "platform" ->
    telegram_bot / website — where the subscribing admin must pick exactly
    one row within the group. NULL choice_group = always granted.

    Add-on access points are NOT stored here — see
    AccessPointCatalog.required_plan_id, which is the single source of
    truth for "which add-ons does this plan unlock".
    """
    __tablename__ = "plan_access_points"

    id = Column(Integer, primary_key=True)

    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    access_point_id = Column(Integer, ForeignKey("access_point_catalog.id"), nullable=False)

    choice_group = Column(String, nullable=True)

    plan = relationship("Plan", back_populates="access_points")
    access_point = relationship("AccessPointCatalog", foreign_keys=[access_point_id])

    __table_args__ = (
        UniqueConstraint("plan_id", "access_point_id", name="uq_plan_access_point"),
    )


# =========================================================
# SUBSCRIPTION STATE (per admin)
# =========================================================
SUBSCRIPTION_STATUSES = ("active", "grace", "expired")


class AdminSubscription(Base):
    """
    One row per admin (their current plan subscription). History of past
    plans/cycles lives in SubscriptionInvoice, not here — this row always
    reflects current state.
    """
    __tablename__ = "admin_subscriptions"

    id = Column(Integer, primary_key=True)

    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, unique=True, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)

    status = Column(String, default="active", nullable=False)  # active | grace | expired

    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    network_id = Column(Integer, ForeignKey("networks.id"), nullable=True)

    chosen_options = Column(Text, nullable=True)

    current_period_end = Column(DateTime, nullable=True)
    grace_started_at = Column(DateTime, nullable=True)

    forced_by_master = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    admin = relationship("User", foreign_keys=[admin_id])
    plan = relationship("Plan")
    currency = relationship("Currency")
    network = relationship("Network")


class AdminAddon(Base):
    """
    One row per (admin, access point) add-on purchase. An admin can hold
    multiple add-ons simultaneously, each billed/renewed independently.
    """
    __tablename__ = "admin_addons"

    id = Column(Integer, primary_key=True)

    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    access_point_id = Column(Integer, ForeignKey("access_point_catalog.id"), nullable=False)

    status = Column(String, default="active", nullable=False)  # active | grace | expired

    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    network_id = Column(Integer, ForeignKey("networks.id"), nullable=True)

    current_period_end = Column(DateTime, nullable=True)
    grace_started_at = Column(DateTime, nullable=True)

    forced_by_master = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    admin = relationship("User", foreign_keys=[admin_id])
    access_point = relationship("AccessPointCatalog", foreign_keys=[access_point_id])
    currency = relationship("Currency")
    network = relationship("Network")

    __table_args__ = (
        UniqueConstraint("admin_id", "access_point_id", name="uq_admin_addon"),
    )


# =========================================================
# ACCESS PROVENANCE — the source of truth. User.access_points
# is a derived cache recomputed from the union of these rows.
#
# source values: "master_granted" | "plan_included" | "addon_purchased"
# source_id: NULL for master_granted; AdminSubscription.id for
# plan_included; AdminAddon.id for addon_purchased.
# =========================================================
class AdminAccessGrant(Base):
    __tablename__ = "admin_access_grants"

    id = Column(Integer, primary_key=True)

    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    access_point_key = Column(String, nullable=False)

    source = Column(String, nullable=False)
    source_id = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    admin = relationship("User", foreign_keys=[admin_id])

    __table_args__ = (
        UniqueConstraint("admin_id", "access_point_key", "source", "source_id", name="uq_access_grant"),
    )


# =========================================================
# INVOICES / BILLING LEDGER
# =========================================================
class SubscriptionInvoice(Base):
    __tablename__ = "subscription_invoices"

    id = Column(Integer, primary_key=True)

    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)

    type = Column(String, nullable=False)  # plan | addon
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=True)
    access_point_id = Column(Integer, ForeignKey("access_point_catalog.id"), nullable=True)

    amount = Column(Float, nullable=False, default=0)
    discount_percent = Column(Float, nullable=False, default=0)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=True)
    network_id = Column(Integer, ForeignKey("networks.id"), nullable=True)

    status = Column(String, nullable=False, default="paid")  # paid | failed | free

    note = Column(Text, nullable=True)

    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    admin = relationship("User", foreign_keys=[admin_id])
    plan = relationship("Plan")
    access_point = relationship("AccessPointCatalog", foreign_keys=[access_point_id])
    currency = relationship("Currency")
    network = relationship("Network")
    transaction = relationship("Transaction")