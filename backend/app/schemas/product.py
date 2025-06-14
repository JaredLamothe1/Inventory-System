from pydantic import BaseModel
from typing import Optional

class ProductCreate(BaseModel):
    name: str
    unit_cost: float
    reorder_threshold: int
    restock_target: int
    storage_space: int
    category_id: int
    quantity_in_stock: int
    sale_price: Optional[float] = None

class ProductOut(ProductCreate):
    id: int
    sale_price: float
    category_name: Optional[str]

    class Config:
        from_attributes = True  # replaces orm_mode in Pydantic v2
