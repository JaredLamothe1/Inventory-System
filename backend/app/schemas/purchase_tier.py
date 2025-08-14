# app/schemas/purchase_tier.py
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field, PositiveInt, condecimal

# Money type (adjust digits/places if needed)
Money = condecimal(max_digits=10, decimal_places=2)


class PurchaseTierBase(BaseModel):
    threshold: PositiveInt = Field(..., description="Quantity at/above which this price applies")
    price: Money = Field(..., description="Unit purchase price when the threshold is met")


class PurchaseTierCreate(PurchaseTierBase):
    pass


class PurchaseTierUpdate(BaseModel):
    threshold: Optional[PositiveInt] = None
    price: Optional[Money] = None


class PurchaseTierOut(PurchaseTierBase):
    id: int
    category_id: int

    class Config:
        from_attributes = True  # pydantic v2 ORM mode
