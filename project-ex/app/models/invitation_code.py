from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from datetime import datetime
from app.db.database import Base


class InvitationCode(Base):
    __tablename__ = "invitation_codes"

    id = Column(Integer, primary_key=True, index=True)

    # unique code string
    code = Column(String, unique=True, index=True, nullable=False)

    # who owns this code (host/admin/master)
    created_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    # who used this code
    used_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    is_used = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime, nullable=True)

    # optional safety
    is_active = Column(Boolean, default=True)