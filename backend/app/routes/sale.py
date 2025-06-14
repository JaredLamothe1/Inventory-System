from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import SessionLocal
from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.models.inventory_log import InventoryLog
from app.schemas.sale import SaleCreate, SaleOut

router = APIRouter(prefix="/sales", tags=["sales"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=SaleOut)
def create_sale(sale_data: SaleCreate, db: Session = Depends(get_db)):
    new_sale = Sale(
        sale_date=sale_data.sale_date,
        notes=sale_data.notes,
        sale_type=sale_data.sale_type or "individual",
    )
    db.add(new_sale)
    db.commit()
    db.refresh(new_sale)

    for item in sale_data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

        if product.quantity_in_stock < item.quantity:
            print(f"⚠️ Warning: Sale for '{product.name}' exceeds inventory. "
                  f"{product.quantity_in_stock} in stock, {item.quantity} sold.")

        sale_item = SaleItem(
            sale_id=new_sale.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price
        )
        db.add(sale_item)

        product.quantity_in_stock -= item.quantity

        log = InventoryLog(
            product_id=item.product_id,
            change_type="sale",
            change_amount=-item.quantity,
            note=f"Sold via sale {new_sale.id}"
        )
        db.add(log)

    db.commit()
    db.refresh(new_sale)
    return new_sale

@router.get("/", response_model=List[SaleOut])
def get_all_sales(db: Session = Depends(get_db)):
    return db.query(Sale).options(
        joinedload(Sale.items).joinedload(SaleItem.product).joinedload(Product.category)
    ).all()

@router.get("/{sale_id}", response_model=SaleOut)
def get_sale_by_id(sale_id: int, db: Session = Depends(get_db)):
    sale = db.query(Sale).options(
        joinedload(Sale.items).joinedload(SaleItem.product).joinedload(Product.category)
    ).filter(Sale.id == sale_id).first()

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    return sale
