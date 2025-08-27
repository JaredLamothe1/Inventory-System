# app/schemas/purchase_order.py  (your file was named purchase_order.py)
from pydantic import BaseModel
from typing import List
from datetime import datetime

class CategoryOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}

class ProductOut(BaseModel):
    id: int
    name: str
    category: CategoryOut

    model_config = {"from_attributes": True}

class PurchaseOrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float  # allow overrides or defaulted unit costs from FE/BE

class PurchaseOrderCreate(BaseModel):
    created_at: datetime
    shipping_cost: float = 0.0   # NEW
    handling_cost: float = 0.0   # NEW
    items: List[PurchaseOrderItemCreate]

class PurchaseOrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_cost: float
    product: ProductOut

    model_config = {"from_attributes": True}

class PurchaseOrderOut(BaseModel):
    id: int
    created_at: datetime
    user_id: int
    shipping_cost: float          # NEW
    handling_cost: float          # NEW
    items_subtotal: float         # NEW (from model @property)
    grand_total: float            # NEW (from model @property)
    items: List[PurchaseOrderItemOut]

    model_config = {"from_attributes": True}
