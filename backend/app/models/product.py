from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship, column_property
from sqlalchemy.sql import select
from app.database import Base
from app.models.category import Category

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    unit_cost = Column(Float, nullable=False)
    reorder_threshold = Column(Integer, nullable=False)
    restock_target = Column(Integer, nullable=False, default=0)
    storage_space = Column(Float, nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    quantity_in_stock = Column(Integer, nullable=False, default=0)
    sale_price = Column(Float, nullable=False)

    # Relationships
    vendor = relationship("Vendor")
    category = relationship("Category", back_populates="products")
    bulk_discounts = relationship("BulkDiscount", back_populates="product")

    # ✅ Inject category name dynamically
    category_name = column_property(
        select(Category.name)
        .where(Category.id == category_id)
        .correlate_except(Category)
        .scalar_subquery()
    )
