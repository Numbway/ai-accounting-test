from sqlalchemy import Column, String, DateTime, Text, Float, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
import enum

from .database import Base


class SourceType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    WECHAT = "wechat"
    ALIPAY = "alipay"
    CARD = "card"
    OTHER = "other"


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    date = Column(DateTime, default=datetime.utcnow)
    amount = Column(Float, nullable=False)
    category = Column(String(50), nullable=False)
    category_full = Column(String(100))
    detail = Column(Text)
    source_type = Column(String(20), default=SourceType.TEXT)
    raw_input = Column(Text)
    payment_method = Column(String(50), default=PaymentMethod.OTHER)
    merchant = Column(String(200))
    location = Column(String(200))
    notes = Column(Text)
    image_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    name_full = Column(String(100))
    icon = Column(String(20))
    color = Column(String(10))
    parent_id = Column(Integer, nullable=True)