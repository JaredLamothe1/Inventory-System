# app/models/category.py
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    JSON,
    ForeignKey,
    Boolean,
    UniqueConstraint,
    Index,
    Numeric,  # if you prefer decimals for money; keep even if unused
)
from sqlalchemy.orm import relationship, backref
from app.models.purchase_tier import PurchaseTier
from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    # ---- Pricing ----
    # What the business charges clients by default for items in this category
    default_sale_price = Column(Float, nullable=True)

    # (Existing) generic tiers JSON. Keep if you're still using it for SALE tiers.
    # Consider renaming to sale_price_tiers or removing after migration.
    price_tiers = Column(JSON, nullable=True)

    # NEW: what the business usually pays (base cost) to purchase stock in this category
    base_purchase_price = Column(Float, nullable=True)

    # Dynamic purchase tiers: (threshold qty, price). Stored in separate table.
    purchase_tiers = relationship(
        "PurchaseTier",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by=lambda: PurchaseTier.threshold,  # change from string
    )

    # ---- Hierarchy ----
    parent_id = Column(
        Integer,
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    children = relationship(
        "Category",
        backref=backref("parent", remote_side=[id]),
        cascade="all, delete-orphan",
    )

    # ---- Relations ----
    products = relationship("Product", back_populates="category")
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_categories_user_name"),
        Index("ix_categories_user_parent", "user_id", "parent_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<Category id={self.id} name={self.name!r} "
            f"user_id={self.user_id} base_purchase_price={self.base_purchase_price} "
            f"default_sale_price={self.default_sale_price}>"
        )
