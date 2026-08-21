from sqlalchemy import Column, Integer,Boolean, String, Text, DateTime, ForeignKey
from datetime import datetime
from sqlalchemy.orm import relationship
from app.db.database import Base


class GlobalBotSettings(Base):
    __tablename__ = "global_bot_settings"

    id = Column(Integer, primary_key=True)

    support_bot_token = Column(String, nullable=True)
    main_bot_token = Column(String, nullable=True)

    support_bot_username = Column(String, nullable=True)
    main_bot_username = Column(String, nullable=True)

    support_last_validated_at = Column(DateTime, nullable=True)
    support_last_validation_error = Column(Text, nullable=True)

    main_last_validated_at = Column(DateTime, nullable=True)
    main_last_validation_error = Column(Text, nullable=True)

    is_running_support = Column(Boolean, default=False, server_default="false")
    is_running_main = Column(Boolean, default=False, server_default="false")
    support_last_restart_at = Column(DateTime, nullable=True)
    main_last_restart_at = Column(DateTime, nullable=True)
    support_last_crash_error = Column(Text, nullable=True)
    main_last_crash_error = Column(Text, nullable=True)

    updated_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    updater = relationship("User", foreign_keys=[updated_by])