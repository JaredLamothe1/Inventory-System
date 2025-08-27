from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

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


# ----------------------------
# Helpers
# ----------------------------
def _get_sale(db: Session, sale_id: int, user_id: int) -> Sale | None:
    return (
        db.query(Sale)
        .options(joinedload(Sale.items))
        .filter(Sale.id == sale_id, Sale.user_id == user_id)
        .first()
    )


def _get_product(db: Session, product_id: int, user_id: int) -> Product | None:
    return (
        db.query(Product)
        .filter(Product.id == product_id, Product.user_id == user_id)
        .first()
    )


def _revert_inventory_for_items(
    db: Session, items: List[SaleItem], user_id: int, note_prefix: str
) -> None:
    """Return inventory for the provided items (used before edit/delete)."""
    for it in list(items):
        product = _get_product(db, it.product_id, user_id)
        if product:
            product.quantity_in_stock = (product.quantity_in_stock or 0) + it.quantity
            db.add(
                InventoryLog(
                    product_id=product.id,
                    change_type="revert_sale",
                    change_amount=it.quantity,
                    note=f"{note_prefix} {it.sale_id}",
                )
            )


def _items_subtotal(items: List[SaleItem]) -> float:
    """Compute subtotal from in-memory SaleItem rows (quantity * unit_price)."""
    return float(sum((it.quantity or 0) * (it.unit_price or 0.0) for it in items))


def _recalc_processing_fee(sale: Sale, fee_flat: float) -> None:
    """
    If payment_type is credit card, use flat dollar fee per sale.
    Otherwise set processing_fee = 0.0.
    """
    pt = (sale.payment_type or "").lower()
    if pt == "credit_card":
        sale.processing_fee = round(float(fee_flat or 0.0), 2)
    else:
        sale.processing_fee = 0.0



# ----------------------------
# Create
# ----------------------------
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
            payment_type=(sale_data.payment_type or "cash"),
            user_id=current_user.id,
        )
        db.add(new_sale)

        # Create items & apply inventory deltas
        for item in sale_data.items:
            product = _get_product(db, item.product_id, current_user.id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            # Allow oversell; just log it (inventory can go negative)
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

        # Compute processing fee based on user's configured percent
        _recalc_processing_fee(new_sale, float(getattr(current_user, "credit_card_fee_flat", 0.0) or 0.0))

        db.commit()
        db.refresh(new_sale)
        return new_sale
    except Exception:
        db.rollback()
        raise


# ----------------------------
# Update
# ----------------------------
@router.put("/{sale_id}", response_model=SaleOut)
def update_sale(
    sale_id: int,
    updated_data: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sale = _get_sale(db, sale_id, current_user.id)
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")

        # 1) Revert inventory from existing items
        _revert_inventory_for_items(db, sale.items, current_user.id, "Reverted previous quantity for sale")

        # 2) ORM-delete existing children (avoid bulk delete -> StaleDataError)
        for item in list(sale.items):
            db.delete(item)

        # 3) Update header
        sale.sale_date = updated_data.sale_date
        sale.notes = updated_data.notes
        sale.sale_type = updated_data.sale_type or sale.sale_type
        sale.payment_type = updated_data.payment_type or sale.payment_type

        # 4) Add new items & apply inventory deltas
        for upd in updated_data.items:
            product = _get_product(db, upd.product_id, current_user.id)
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

        # Recompute processing fee after rebuilding items
        _recalc_processing_fee(sale, float(getattr(current_user, "credit_card_fee_flat", 0.0) or 0.0))

        db.commit()
        db.refresh(sale)
        return sale
    except Exception:
        db.rollback()
        raise


# ----------------------------
# Read
# ----------------------------
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
        .filter(Sale.items.any())  # only show sales that actually have items
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


# ----------------------------
# Delete
# ----------------------------
@router.delete("/{sale_id}")
def delete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sale = _get_sale(db, sale_id, current_user.id)
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")

        # 1) Return inventory for existing items
        _revert_inventory_for_items(db, sale.items, current_user.id, "Sale deleted")

        # 2) ORM-delete children (NO bulk delete)
        for item in list(sale.items):
            db.delete(item)

        # 3) Delete parent
        db.delete(sale)

        db.commit()
        return {"message": f"Sale {sale_id} deleted and inventory reverted"}
    except Exception:
        db.rollback()
        raise
