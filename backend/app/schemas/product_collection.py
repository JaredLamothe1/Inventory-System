# app/schemas/collection.py
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


# --------- Shared mini type for nesting ---------
class ProductMini(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


# --------- Collection Schemas ---------
class CollectionBase(BaseModel):
    name: str = Field(..., description="Display name of the group")
    description: Optional[str] = None
    color: Optional[str] = Field(
        default=None,
        description="Optional UI color (hex or token). Leave null if unused.",
    )


class CollectionCreate(CollectionBase):
    # Optional product ids to attach on create
    product_ids: List[int] = Field(default_factory=list)


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    # Full replacement list (simplest flow). Omit to leave unchanged.
    product_ids: Optional[List[int]] = None


class CollectionOut(CollectionBase):
    id: int
    user_id: int
    products: List[ProductMini] = Field(default_factory=list)

    class Config:
        from_attributes = True
