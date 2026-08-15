from sqlalchemy import Column, Integer, String
from app.db.database import Base

class SystemWallet(Base):
    __tablename__ = "system_wallet"

    id = Column(Integer, primary_key=True)
    xpub = Column(String, nullable=False)
    next_index = Column(Integer, default=0)