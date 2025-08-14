# app/models/product.py
from __future__ import annotations

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship, column_property
from sqlalchemy.sql import select

from app.database import Base
from app.models.category import Category
from app.models.user import User
from app.models.product_collection import product_collection_map

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String, nullable=False)
    sku = Column(String, nullable=True, index=True)
    description = Column(String, nullable=True)
    notes = Column(String, nullable=True)  # Internal admin notes

    # Deprecated as a "truth" field – actual costs are stamped on PO lines.
    unit_cost = Column(Float, nullable=True)

    reorder_threshold = Column(Integer, nullable=False, default=0)
    restock_target = Column(Integer, nullable=False, default=0)
    storage_space = Column(Float, nullable=True)
    quantity_in_stock = Column(Integer, nullable=False, default=0)

    # Per-product SALE price override (client price). Null => inherit from category.
    sale_price = Column(Float, nullable=True)

    category_id = Column(
        Integer,
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    category = relationship("Category", back_populates="products")

    # Many-to-many collections (organizational groups)
    collections = relationship(
        "ProductCollection",
        secondary=product_collection_map,
        back_populates="products",
    )

    # Keep if you still use it
    bulk_discounts = relationship("BulkDiscount", back_populates="product")

    user = relationship("User")

    # Convenience column so you don’t have to join for name constantly
    category_name = column_property(
        select(Category.name)
        .where(Category.id == category_id)
        .correlate_except(Category)
        .scalar_subquery()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_products_user_name"),
        Index("ix_products_user_category", "user_id", "category_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<Product id={self.id} name={self.name!r} user_id={self.user_id} "
            f"category_id={self.category_id} sale_price={self.sale_price} notes={self.notes!r}>"
        )
