from sqlalchemy import Column,Boolean, Text, Integer, String, DateTime, JSON, ForeignKey, UniqueConstraint
from datetime import datetime
from sqlalchemy.orm import relationship
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    # =========================
    # PRIMARY INFO
    # =========================
    user_id = Column(Integer, primary_key=True, index=True)

    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    telegram_id = Column(String, nullable=True, unique=True)

    # =========================
    # PROFILE (NEW)
    # =========================
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    email = Column(String, nullable=True)

    # who invited this user
    invited_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    inviter = relationship(
        "User",
        remote_side=[user_id],
        foreign_keys=[invited_by],
    )

    # =========================
    # ACCOUNT
    # =========================
    account_id = Column(String, unique=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    created_date = Column(DateTime, default=datetime.utcnow)

    status = Column(String, default="active")
    role = Column(String, default="user")

    # Owning admin (users.user_id). NULL = Global WIRES / unassigned.
    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=True, index=True)

    admin = relationship(
        "User",
        remote_side=[user_id],
        foreign_keys=[admin_id],
    )

    access_points = Column(JSON, nullable=False, default=list)


    # =========================
    # PREFERENCES (NEW)
    # =========================

    language = Column(String(2), nullable=False, default="en", server_default="en")

    # =========================
    # INVITATION RELATION (NEW)
    # =========================
    used_invitation_code = Column(String, nullable=True)


class UserWallet(Base):
    """Store user wallet addresses per currency/network pair"""
    __tablename__ = "user_wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    currency_id = Column(Integer, ForeignKey("currencies.id"), nullable=False)
    network_id = Column(Integer, ForeignKey("networks.id"), nullable=False)

    address = Column(String(255), nullable=False, unique=True, index=True)
    index = Column(Integer, nullable=False)  # Derivation index in BIP44 path

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="wallets")
    currency = relationship("Currency")
    network = relationship("Network")

    # Unique constraint: ensure each user has only one address per currency/network pair
    __table_args__ = (
        UniqueConstraint('user_id', 'currency_id', 'network_id', 
                        name='uq_user_wallet_pair'),
    )


class TelegramBotSettings(Base):
    __tablename__ = "telegram_bot_settings"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)

    # "admin" (per-admin personal bot) | "global_main" (platform-wide main bot,
    # owned by master) | "support" (platform-wide support bot, owned by master)
    bot_kind = Column(String(20), nullable=False, default="admin", server_default="admin")

    default_language = Column(String(2), nullable=False, default="en", server_default="en")

    main_bot_token = Column(String, nullable=True)
    is_active = Column(Boolean, default=False, server_default="false")
    bot_username = Column(String, nullable=True)          # @handle, read-only (from getMe)
    display_name = Column(String, nullable=True)           # settable via setMyName
    enabled_services = Column(JSON, nullable=True)  # list of access-point keys the admin has toggled ON in their bot; None = all permitted services are on
    last_validated_at = Column(DateTime, nullable=True)
    last_validation_error = Column(Text, nullable=True)

    is_running = Column(Boolean, default=False, server_default="false")
    last_restart_at = Column(DateTime, nullable=True)
    last_crash_error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    admin = relationship("User", backref="telegram_bot_settings", foreign_keys=[admin_id])

    __table_args__ = (
        UniqueConstraint("admin_id", "bot_kind", name="uq_telegram_bot_settings_admin_kind"),
    )