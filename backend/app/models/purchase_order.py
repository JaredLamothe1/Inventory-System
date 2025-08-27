# app/models/purchase_order.py
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import Column, Integer, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship, Mapped
from app.database import Base
from app.models.user import User


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow, index=True)
    user_id: Mapped[int] = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # You actually use this:
    shipping_cost: Mapped[float] = Column(Float, nullable=False, default=0.0)

    # Keep for possible future use, but make harmless (nullable + default)
    # and do NOT include it in grand_total.
    handling_cost: Mapped[Optional[float]] = Column(Float, nullable=True, default=0.0)

    # Relationships
    items: Mapped[List["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
    )
    user: Mapped[User] = relationship("User")

    # -------- Convenience computed totals (not persisted) --------
    @property
    def items_subtotal(self) -> float:
        """Sum of quantity * unit_cost across all items."""
        return float(sum((it.quantity or 0) * (it.unit_cost or 0.0) for it in (self.items or [])))

    @property
    def grand_total(self) -> float:
        """
        Final total = items subtotal + shipping only.
        (handling_cost intentionally ignored per current business rules)
        """
        return float(self.items_subtotal + (self.shipping_cost or 0.0))

    def __repr__(self) -> str:
        return f"<PurchaseOrder id={self.id} user_id={self.user_id} total={self.grand_total:.2f}>"


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    # NOTE: FK column name is order_id (not purchase_order_id)
    order_id: Mapped[int] = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False, index=True)
    product_id: Mapped[int] = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity: Mapped[int] = Column(Integer, nullable=False)
    unit_cost: Mapped[float] = Column(Float, nullable=False)

    order: Mapped[PurchaseOrder] = relationship("PurchaseOrder", back_populates="items")
    product = relationship("Product")
