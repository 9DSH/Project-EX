from sqlalchemy import Column, Integer, String, Boolean
from app.db.database import Base


class Network(Base):
    __tablename__ = "networks"

    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True)  # BEP20
    chain = Column(String)              # BSC

    is_active = Column(Boolean, default=True)