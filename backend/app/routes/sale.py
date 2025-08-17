# app/routes/sale.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import SessionLocal
from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.models.inventory_log import InventoryLog
from app.schemas.sale import SaleCreate, SaleOut
from app.routes.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/sales", tags=["sales"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=SaleOut)
def create_sale(
    sale_data: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not sale_data.items:
        raise HTTPException(status_code=400, detail="Sale must include at least one item.")

    try:
        new_sale = Sale(
            sale_date=sale_data.sale_date,
            notes=sale_data.notes,
            sale_type=(sale_data.sale_type or "individual"),
            user_id=current_user.id,
        )
        db.add(new_sale)

        for item in sale_data.items:
            product = (
                db.query(Product)
                .filter(Product.id == item.product_id, Product.user_id == current_user.id)
                .first()
            )
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            if (product.quantity_in_stock or 0) < item.quantity:
                print(
                    f"⚠️ Oversell: '{product.name}' had {product.quantity_in_stock} in stock, "
                    f"{item.quantity} sold. Inventory will go negative."
                )

            db.add(
                SaleItem(
                    sale=new_sale,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                )
            )

            product.quantity_in_stock = (product.quantity_in_stock or 0) - item.quantity
            db.add(
                InventoryLog(
                    product_id=item.product_id,
                    change_type="sale",
                    change_amount=-item.quantity,
                    note="Sold via sale (new)",
                )
            )

        db.commit()
        db.refresh(new_sale)
        return new_sale
    except Exception:
        db.rollback()
        raise

@router.put("/{sale_id}", response_model=SaleOut)
def update_sale(
    sale_id: int,
    updated_data: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sale = (
            db.query(Sale)
            .options(joinedload(Sale.items))
            .filter(Sale.id == sale_id, Sale.user_id == current_user.id)
            .first()
        )
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")

        # revert inventory from existing items
        for item in sale.items:
            product = (
                db.query(Product)
                .filter(Product.id == item.product_id, Product.user_id == current_user.id)
                .first()
            )
            if product:
                product.quantity_in_stock = (product.quantity_in_stock or 0) + item.quantity
                db.add(
                    InventoryLog(
                        product_id=product.id,
                        change_type="revert_sale_edit",
                        change_amount=item.quantity,
                        note=f"Reverted previous quantity for sale {sale.id}",
                    )
                )

        # remove existing children with bulk delete,
        # THEN clear the in-session relationship to avoid stale sync
        db.query(SaleItem).filter(SaleItem.sale_id == sale_id).delete(synchronize_session=False)
        sale.items = []          # clear in-session collection
        db.flush()               # ensure state is consistent before adding new rows

        # header fields
        sale.sale_date = updated_data.sale_date
        sale.notes = updated_data.notes
        sale.sale_type = updated_data.sale_type or sale.sale_type

        # add new items and apply inventory changes
        for upd in updated_data.items:
            product = (
                db.query(Product)
                .filter(Product.id == upd.product_id, Product.user_id == current_user.id)
                .first()
            )
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {upd.product_id} not found")

            if (product.quantity_in_stock or 0) < upd.quantity:
                print(
                    f"⚠️ Oversell (update): '{product.name}' had {product.quantity_in_stock} in stock, "
                    f"{upd.quantity} sold. Inventory will go negative."
                )

            db.add(
                SaleItem(
                    sale_id=sale.id,
                    product_id=upd.product_id,
                    quantity=upd.quantity,
                    unit_price=upd.unit_price,
                )
            )
            product.quantity_in_stock = (product.quantity_in_stock or 0) - upd.quantity
            db.add(
                InventoryLog(
                    product_id=product.id,
                    change_type="sale",
                    change_amount=-upd.quantity,
                    note=f"Updated sale {sale.id}",
                )
            )

        db.commit()
        db.refresh(sale)
        return sale
    except Exception:
        db.rollback()
        raise

@router.get("/", response_model=List[SaleOut])
def get_all_sales(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Sale)
        .options(
            joinedload(Sale.items)
            .joinedload(SaleItem.product)
            .joinedload(Product.category)
        )
        .filter(Sale.user_id == current_user.id)
        .filter(Sale.items.any())
        .all()
    )

@router.get("/{sale_id}", response_model=SaleOut)
def get_sale_by_id(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = (
        db.query(Sale)
        .options(
            joinedload(Sale.items)
            .joinedload(SaleItem.product)
            .joinedload(Product.category)
        )
        .filter(Sale.id == sale_id, Sale.user_id == current_user.id)
        .first()
    )
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale

@router.delete("/{sale_id}")
def delete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sale = (
            db.query(Sale)
            .options(joinedload(Sale.items))
            .filter(Sale.id == sale_id, Sale.user_id == current_user.id)
            .first()
        )
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")

        # return inventory
        for item in list(sale.items):
            product = (
                db.query(Product)
                .filter(Product.id == item.product_id, Product.user_id == current_user.id)
                .first()
            )
            if product:
                product.quantity_in_stock = (product.quantity_in_stock or 0) + item.quantity
                db.add(
                    InventoryLog(
                        product_id=product.id,
                        change_type="revert_sale",
                        change_amount=item.quantity,
                        note=f"Sale {sale.id} deleted",
                    )
                )

        # bulk delete children, clear in-session relation, flush, then delete parent
        db.query(SaleItem).filter(SaleItem.sale_id == sale_id).delete(synchronize_session=False)
        sale.items = []
        db.flush()

        db.delete(sale)
        db.commit()
        return {"message": f"Sale {sale_id} deleted and inventory reverted"}
    except Exception:
        db.rollback()
        raise
