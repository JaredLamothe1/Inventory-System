from pydantic import BaseModel
from typing import Optional, List, Dict

class CategoryBase(BaseModel):
    name: str
    default_sale_price: Optional[float] = None  # ✅ sale price customers pay
    price_tiers: Optional[List[Dict[str, float]]] = None  # 📦 vendor restocking prices

class CategoryCreate(CategoryBase):
    pass

class CategoryOut(CategoryBase):
    id: int

    class Config:
        orm_mode = True