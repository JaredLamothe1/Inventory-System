from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database import Base

class InventoryLog(Base):
    __tablename__ = "inventory_logs"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    change_type = Column(String, nullable=False)  # "sale", "purchase", "manual"
    change_amount = Column(Integer, nullable=False)
    note = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
