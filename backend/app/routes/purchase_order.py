from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import SessionLocal
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.product import Product
from app.models.inventory_log import InventoryLog
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderOut

router = APIRouter(prefix="/purchase_orders", tags=["purchase_orders"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=PurchaseOrderOut)
def create_order(order_data: PurchaseOrderCreate, db: Session = Depends(get_db)):
    new_order = PurchaseOrder(created_at=order_data.created_at)
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    for item in order_data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

        db_item = PurchaseOrderItem(
            order_id=new_order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_cost=item.unit_cost
        )
        db.add(db_item)

        product.quantity_in_stock += item.quantity

        log = InventoryLog(
            product_id=item.product_id,
            change_type="purchase",
            change_amount=item.quantity,
            note=f"Restocked via PO {new_order.id}"
        )
        db.add(log)

    db.commit()
    db.refresh(new_order)
    return new_order


@router.get("/", response_model=list[PurchaseOrderOut])
def get_all_orders(db: Session = Depends(get_db)):
    return db.query(PurchaseOrder).options(joinedload(PurchaseOrder.items)).all()


@router.get("/{order_id}", response_model=PurchaseOrderOut)
def get_order_by_id(order_id: int, db: Session = Depends(get_db)):
    order = db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.items)
        .joinedload(PurchaseOrderItem.product)
        .joinedload(Product.category)  # ✅ This enables .product.category.name on frontend
    ).filter(PurchaseOrder.id == order_id).first()

    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    return order

