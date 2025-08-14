# app/models/product_collection.py
from __future__ import annotations

from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Table,
    UniqueConstraint,
    DateTime,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base

# Junction table (no model class needed)
product_collection_map = Table(
    "product_collection_map",
    Base.metadata,
    Column("product_id", Integer, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
    Column("collection_id", Integer, ForeignKey("product_collections.id", ondelete="CASCADE"), primary_key=True),
)

class ProductCollection(Base):
    __tablename__ = "product_collections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    color = Column(String, nullable=True)  # optional UI nicety (hex or tailwind token)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # M2M to products
    products = relationship(
        "Product",
        secondary=product_collection_map,
        back_populates="collections",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_collection_user_name"),
    )

    def __repr__(self) -> str:
        return f"<ProductCollection id={self.id} name={self.name!r} user_id={self.user_id}>"
