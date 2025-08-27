from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime, Date, Text, String
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    sale_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    notes = Column(Text, nullable=True)
    sale_type = Column(String, default="individual")
    payment_type = Column(String, default="cash")

    # NEW: fee charged for this sale (0 unless credit_card)
    processing_fee = Column(Float, nullable=False, default=0.0)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    items = relationship("SaleItem", back_populates="sale")
    user = relationship("User")

class SaleItem(Base):
    __tablename__ = "sale_items"
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")
