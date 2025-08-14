# app/models/purchase_tier.py
from __future__ import annotations

from decimal import Decimal
from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    ForeignKey,
    CheckConstraint,
    Index,
    DateTime,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class PurchaseTier(Base):
    __tablename__ = "category_purchase_tiers"

    id = Column(Integer, primary_key=True, index=True)

    category_id = Column(
        Integer,
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    threshold = Column(Integer, nullable=False)  # inclusive qty
    price = Column(Numeric(10, 2), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    category = relationship("Category", back_populates="purchase_tiers")
    user = relationship("User", backref="purchase_tiers")  # <-- no need to edit User model

    __table_args__ = (
        UniqueConstraint("category_id", "threshold", name="uq_category_threshold"),
        CheckConstraint("threshold >= 0", name="ck_threshold_nonnegative"),
        CheckConstraint("price >= 0", name="ck_price_nonnegative"),
        Index("ix_tier_category_threshold", "category_id", "threshold"),
    )

    def __repr__(self) -> str:
        return (
            f"<PurchaseTier id={self.id} category_id={self.category_id} "
            f"threshold={self.threshold} price={self.price}>"
        )
