from pydantic import BaseModel
from typing import List
from datetime import datetime


class CategoryOut(BaseModel):
    id: int
    name: str

    model_config = {
        "from_attributes": True
    }


class ProductOut(BaseModel):
    id: int
    name: str
    category: CategoryOut  # ✅ Added this

    model_config = {
        "from_attributes": True
    }


class PurchaseOrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float


class PurchaseOrderCreate(BaseModel):
    created_at: datetime
    items: List[PurchaseOrderItemCreate]


class PurchaseOrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_cost: float
    product: ProductOut

    model_config = {
        "from_attributes": True
    }


class PurchaseOrderOut(BaseModel):
    id: int
    created_at: datetime
    items: List[PurchaseOrderItemOut]

    model_config = {
        "from_attributes": True
    }
