# app/schemas/product.py
from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, Field, condecimal, model_validator

# ---------- Money helper ----------
Money = condecimal(max_digits=10, decimal_places=2)

# ---------- Mini types ----------
class CollectionMini(BaseModel):
    id: int
    name: str
    color: Optional[str] = None
    model_config = {"from_attributes": True}

# ---------- Base ----------
class ProductBase(BaseModel):
    name: str
    sku: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None  # Internal admin notes

    category_id: Optional[int] = None

    # IMPORTANT: allow negatives to support oversell/backorder workflows
    quantity_in_stock: int = 0

    # Purchase cost override (what you pay vendor). NULL => inherit category/tier
    unit_cost: Optional[Money] = None
    # Sale price override (what you charge customer). NULL => inherit category
    sale_price: Optional[Money] = None

# ---------- Create ----------
class ProductCreate(ProductBase):
    # Flags so FE can force inheritance without guessing
    use_category_purchase_cost: bool = True
    use_category_sale_price: bool = True
    # Collections to attach
    collection_ids: List[int] = Field(default_factory=list)

# ---------- Update (PATCH) ----------
class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None

    category_id: Optional[int] = None
    # Allow negatives on update as well
    quantity_in_stock: Optional[int] = None

    # If True → backend sets field to NULL (inherit). If False/None → ignore unless price provided
    use_category_purchase_cost: Optional[bool] = None
    use_category_sale_price: Optional[bool] = None

    # Only used when not inheriting
    unit_cost: Optional[Money] = None
    sale_price: Optional[Money] = None

    # Replace collections list completely (omit to leave unchanged)
    collection_ids: Optional[List[int]] = None

# ---------- Out ----------
class ProductOut(ProductBase):
    id: int
    user_id: int
    category_name: Optional[str] = None
    collections: List[CollectionMini] = Field(default_factory=list)

    # Computed on server
    resolved_price: Optional[Money] = Field(
        default=None,
        description="Effective SALE price (override or inherited).",
    )

    # Helpful booleans for the FE
    inherits_sale_price: bool = Field(
        default=True,
        description="True if product.sale_price is NULL and price comes from category.",
    )
    inherits_purchase_cost: bool = Field(
        default=True,
        description="True if product.unit_cost is NULL and cost comes from category/tiers.",
    )

    # Convenience flag so the UI can badge negative inventory
    is_negative: bool = Field(default=False, description="True if quantity_in_stock < 0")

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def _derive_flags(self):
        # Derive is_negative automatically
        self.is_negative = (self.quantity_in_stock or 0) < 0
        return self
