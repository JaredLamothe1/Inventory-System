from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: float

class SaleCreate(BaseModel):
    sale_date: Optional[date] = None
    notes: Optional[str] = None
    sale_type: Optional[str] = "individual"
    items: List[SaleItemCreate]

class ProductOut(BaseModel):
    id: int
    name: str
    category_name: Optional[str] = None

    class Config:
        orm_mode = True

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
    user_id: int  # Added for user scoping

    model_config = {
        "from_attributes": True
    }