from __future__ import annotations
from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, Field

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    unit_price: float = Field(ge=0)

class SaleCreate(BaseModel):
    sale_date: Optional[date] = None
    notes: Optional[str] = None
    sale_type: Optional[str] = "individual"
    payment_type: Optional[str] = "cash"
    items: List[SaleItemCreate] = Field(min_length=1)

class ProductOut(BaseModel):
    id: int
    name: str
    category_name: Optional[str] = None
    model_config = {"from_attributes": True}

class SaleItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    product: ProductOut
    model_config = {"from_attributes": True}

class SaleOut(BaseModel):
    id: int
    created_at: datetime
    sale_date: Optional[date] = None
    sale_type: Optional[str] = "individual"
    payment_type: Optional[str] = "cash"
    processing_fee: float                    # NEW
    notes: Optional[str] = None
    items: List[SaleItemOut]
    user_id: int
    model_config = {"from_attributes": True}
