from pydantic import BaseModel

# What the user sends to create or update a discount
class BulkDiscountCreate(BaseModel):
    product_id: int
    min_quantity: int
    discounted_unit_cost: float

# What we return to the user (includes ID)
class BulkDiscountOut(BulkDiscountCreate):
    id: int

    class Config:
        orm_mode = True
