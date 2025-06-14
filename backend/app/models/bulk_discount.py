from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class BulkDiscount(Base):
    __tablename__ = "bulk_discounts"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    min_quantity = Column(Integer, nullable=False)
    discounted_unit_cost = Column(Float, nullable=False)

    product = relationship("Product", back_populates="bulk_discounts")
