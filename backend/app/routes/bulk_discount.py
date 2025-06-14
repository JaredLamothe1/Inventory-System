from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.bulk_discount import BulkDiscount
from app.schemas.bulk_discount import BulkDiscountCreate, BulkDiscountOut

router = APIRouter(prefix="/bulk_discounts", tags=["bulk_discounts"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ✅ Create a new discount rule
@router.post("/", response_model=BulkDiscountOut)
def create_discount(discount: BulkDiscountCreate, db: Session = Depends(get_db)):
    new_discount = BulkDiscount(**discount.dict())
    db.add(new_discount)
    db.commit()
    db.refresh(new_discount)
    return new_discount

# ✅ Get all discounts for a specific product
@router.get("/product/{product_id}", response_model=list[BulkDiscountOut])
def get_discounts_for_product(product_id: int, db: Session = Depends(get_db)):
    return db.query(BulkDiscount).filter(BulkDiscount.product_id == product_id).all()

# ✅ Update a discount
@router.put("/{discount_id}", response_model=BulkDiscountOut)
def update_discount(discount_id: int, updated: BulkDiscountCreate, db: Session = Depends(get_db)):
    discount = db.query(BulkDiscount).filter(BulkDiscount.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    for key, value in updated.dict().items():
        setattr(discount, key, value)
    
    db.commit()
    db.refresh(discount)
    return discount

# ✅ Delete a discount
@router.delete("/{discount_id}")
def delete_discount(discount_id: int, db: Session = Depends(get_db)):
    discount = db.query(BulkDiscount).filter(BulkDiscount.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Discount not found")
    
    db.delete(discount)
    db.commit()
    return {"message": "Discount deleted"}
