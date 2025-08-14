# app/schemas/category.py
from __future__ import annotations

from typing import Optional, List, Dict
from pydantic import BaseModel, Field, PositiveInt, condecimal

# ---------- Common money type ----------
Money = condecimal(max_digits=10, decimal_places=2)


# ---------- Purchase Tier Schemas ----------
class PurchaseTierBase(BaseModel):
    threshold: PositiveInt = Field(
        ..., description="Quantity at/above which this purchase cost applies"
    )
    price: Money = Field(
        ..., description="Unit purchase cost when the threshold is met"
    )


class PurchaseTierCreate(PurchaseTierBase):
    """Client sends this when creating/replacing tiers (no id yet)."""
    pass


class PurchaseTierUpdate(BaseModel):
    """Optional PATCH-per-tier shape if you ever expose it."""
    threshold: Optional[PositiveInt] = None
    price: Optional[Money] = None


class PurchaseTierOut(PurchaseTierBase):
    id: int
    model_config = {"from_attributes": True}


# ---------- Category Schemas ----------
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

    # What you charge customers by default
    default_sale_price: Optional[Money] = None

    # DEPRECATED fields kept for backwards compatibility
    price_tiers: Optional[List[Dict[str, float]]] = Field(
        default=None, description="[DEPRECATED] Old sale tier structure"
    )
    parent_id: Optional[int] = Field(
        default=None, description="[DEPRECATED] We no longer use nested categories"
    )

    # What you pay the vendor by default
    base_purchase_price: Optional[Money] = None

    # Dynamic purchase tiers (for vendor pricing)
    purchase_tiers: List[PurchaseTierCreate] = Field(
        default_factory=list,
        description="Dynamic {threshold, price} purchase tiers (vendor cost)",
    )


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    # All optional for PATCH
    name: Optional[str] = None
    description: Optional[str] = None
    default_sale_price: Optional[Money] = None
    price_tiers: Optional[List[Dict[str, float]]] = None  # deprecated
    parent_id: Optional[int] = None                       # deprecated
    base_purchase_price: Optional[Money] = None

    # Replace-all tiers
    purchase_tiers: Optional[List[PurchaseTierCreate]] = None

    # Cascade flags
    propagate_prices: bool = False
    propagate_sale_price: bool = False
    propagate_purchase_cost: bool = False


class CategoryNodeOut(BaseModel):
    """Shape for /categories/tree."""
    id: int
    name: str
    default_sale_price: Optional[Money] = None
    parent_id: Optional[int] = None
    children: List["CategoryNodeOut"] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class CategoryOut(CategoryBase):
    id: int
    user_id: int
    purchase_tiers: List[PurchaseTierOut] = Field(default_factory=list)

    # NEW: number of products in this category (for list views / summaries)
    product_count: Optional[int] = Field(
        default=0,
        description="Number of products assigned to this category"
    )

    model_config = {"from_attributes": True}


# Recursive rebuild
CategoryNodeOut.model_rebuild()
