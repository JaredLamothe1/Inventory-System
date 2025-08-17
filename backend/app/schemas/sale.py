from __future__ import annotations

from datetime import datetime, date
from typing import List, Optional

from pydantic import BaseModel, Field, conlist


# --------- Incoming (request) models ---------

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, description="Units sold must be > 0")
    unit_price: float = Field(ge=0, description="Sale price per unit must be ≥ 0")


class SaleCreate(BaseModel):
    sale_date: Optional[date] = None
    notes: Optional[str] = None
    sale_type: Optional[str] = "individual"
    # Require at least one line item to prevent empty sales from being created
    items: conlist(SaleItemCreate, min_items=1)


# --------- Outgoing (response) models ---------

class ProductOut(BaseModel):
    id: int
    name: str
    category_name: Optional[str] = None

    model_config = {
        "from_attributes": True  # pydantic v2 replacement for orm_mode
    }


class SaleItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    product: ProductOut

    model_config = {
        "from_attributes": True
    }


class SaleOut(BaseModel):
    id: int
    created_at: datetime
    sale_date: Optional[date] = None
    sale_type: Optional[str] = "individual"
    notes: Optional[str] = None
    items: List[SaleItemOut]
    user_id: int  # user scoping

    model_config = {
        "from_attributes": True
    }
