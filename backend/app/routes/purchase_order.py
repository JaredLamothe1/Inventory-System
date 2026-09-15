# app/routes/purchase_order.py
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Product, PurchaseOrder, PurchaseOrderItem
from app.models.inventory_log import InventoryLog
from app.routes.auth import get_current_user

router = APIRouter(prefix="/purchase_orders", tags=["purchase_orders"])


# -----------------------------
# Pydantic Schemas
# -----------------------------
class POItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(ge=0)
    unit_cost: float = Field(ge=0)


class PurchaseOrderCreate(BaseModel):
    created_at: Optional[date] = None
    shipping_cost: float = 0.0
    handling_cost: float = 0.0
    items: List[POItemCreate]


class PurchaseOrderUpdate(PurchaseOrderCreate):
    pass


class POItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    category_name: Optional[str] = None
    quantity: int
    unit_cost: float

    class Config:
        from_attributes = True


class PurchaseOrderOut(BaseModel):
    id: int
    created_at: datetime
    shipping_cost: float
    handling_cost: float
    items_subtotal: float
    grand_total: float
    items: List[POItemOut]

    class Config:
        from_attributes = True


# -----------------------------
# Helpers
# -----------------------------
def _category_name_of(prod: Optional[Product]) -> Optional[str]:
    try:
        return getattr(getattr(prod, "category", None), "name", None)
    except Exception:
        return getattr(prod, "category_name", None) if prod else None


def _hydrate_po_out(db: Session, po: PurchaseOrder) -> PurchaseOrderOut:
    items: List[POItemOut] = []
    subtotal = 0.0

    for it in po.items:
        prod = db.get(Product, it.product_id)

        items.append(
            POItemOut(
                id=it.id,
                product_id=it.product_id,
                product_name=prod.name if prod else f"Product {it.product_id}",
                category_name=_category_name_of(prod),
                quantity=it.quantity,
                unit_cost=it.unit_cost,
            )
        )

        subtotal += it.quantity * it.unit_cost

    grand = subtotal + float(getattr(po, "shipping_cost", 0.0)) + float(
        getattr(po, "handling_cost", 0.0)
    )

    created = po.created_at

    if isinstance(created, date) and not isinstance(created, datetime):
        created = datetime.combine(created, datetime.min.time())

    return PurchaseOrderOut(
        id=po.id,
        created_at=created,
        shipping_cost=float(getattr(po, "shipping_cost", 0.0)),
        handling_cost=float(getattr(po, "handling_cost", 0.0)),
        items_subtotal=round(subtotal, 2),
        grand_total=round(grand, 2),
        items=items,
    )


def _ensure_owned(po: Optional[PurchaseOrder], user_id: int) -> PurchaseOrder:
    if not po or po.user_id != user_id:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found.",
        )

    return po


def _get_owned_product(
    db: Session,
    product_id: int,
    user_id: int,
) -> Product:
    """
    Fetch a product and ensure that it belongs to the logged-in user.
    """
    product = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.user_id == user_id,
        )
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product {product_id} not found.",
        )

    return product


def _adjust_inventory(
    db: Session,
    product: Product,
    amount: int,
    change_type: str,
    note: str,
):
    """
    Apply an inventory change and record it in InventoryLog.

    Positive amount -> inventory increases
    Negative amount -> inventory decreases
    """
    if amount == 0:
        return

    current_quantity = int(product.quantity_in_stock or 0)

    product.quantity_in_stock = current_quantity + amount

    db.add(
        InventoryLog(
            product_id=product.id,
            change_type=change_type,
            change_amount=amount,
            note=note,
        )
    )


# -----------------------------
# Routes
# -----------------------------
@router.get("/", response_model=List[PurchaseOrderOut])
def list_purchase_orders(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    pos = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.items))
        .filter(PurchaseOrder.user_id == current_user.id)
        .order_by(PurchaseOrder.created_at.desc())
        .all()
    )

    return [_hydrate_po_out(db, po) for po in pos]


@router.get("/{po_id}", response_model=PurchaseOrderOut)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    po = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.items))
        .filter(
            PurchaseOrder.id == po_id,
            PurchaseOrder.user_id == current_user.id,
        )
        .first()
    )

    po = _ensure_owned(po, current_user.id)

    return _hydrate_po_out(db, po)


# -----------------------------
# CREATE PURCHASE ORDER
# -----------------------------
@router.post(
    "/",
    response_model=PurchaseOrderOut,
    status_code=status.HTTP_201_CREATED,
)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        po = PurchaseOrder(
            created_at=(
                datetime.combine(payload.created_at, datetime.min.time())
                if payload.created_at
                else datetime.utcnow()
            ),
            user_id=current_user.id,
            shipping_cost=payload.shipping_cost,
            handling_cost=payload.handling_cost,
        )

        db.add(po)

        # Flush so po.id exists before adding items/logs.
        db.flush()

        for it in payload.items:
            product = _get_owned_product(
                db,
                it.product_id,
                current_user.id,
            )

            # Add PO line
            po_item = PurchaseOrderItem(
                order_id=po.id,
                product_id=it.product_id,
                quantity=it.quantity,
                unit_cost=it.unit_cost,
            )

            db.add(po_item)

            # Purchase order represents received inventory,
            # so immediately add quantity to stock.
            _adjust_inventory(
                db=db,
                product=product,
                amount=it.quantity,
                change_type="purchase",
                note=f"Purchase order #{po.id} created",
            )

        db.commit()

        # Reload with items after commit
        po = (
            db.query(PurchaseOrder)
            .options(joinedload(PurchaseOrder.items))
            .filter(PurchaseOrder.id == po.id)
            .first()
        )

        return _hydrate_po_out(db, po)

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to create purchase order.",
        )


# -----------------------------
# UPDATE PURCHASE ORDER
# -----------------------------
@router.put("/{po_id}", response_model=PurchaseOrderOut)
def update_purchase_order(
    po_id: int,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        po = (
            db.query(PurchaseOrder)
            .options(joinedload(PurchaseOrder.items))
            .filter(
                PurchaseOrder.id == po_id,
                PurchaseOrder.user_id == current_user.id,
            )
            .first()
        )

        po = _ensure_owned(po, current_user.id)

        # -------------------------------------------------
        # STEP 1:
        # Reverse inventory effects of the OLD PO items.
        # -------------------------------------------------
        old_items = list(po.items)

        for old_item in old_items:
            product = _get_owned_product(
                db,
                old_item.product_id,
                current_user.id,
            )

            _adjust_inventory(
                db=db,
                product=product,
                amount=-old_item.quantity,
                change_type="revert_purchase",
                note=f"Purchase order #{po.id} edited - old quantity removed",
            )

        # -------------------------------------------------
        # STEP 2:
        # Remove OLD PO item records.
        # -------------------------------------------------
        for old_item in old_items:
            db.delete(old_item)

        # -------------------------------------------------
        # STEP 3:
        # Update PO header information.
        # -------------------------------------------------
        if payload.created_at is not None:
            po.created_at = datetime.combine(
                payload.created_at,
                datetime.min.time(),
            )

        po.shipping_cost = payload.shipping_cost
        po.handling_cost = payload.handling_cost

        # -------------------------------------------------
        # STEP 4:
        # Add NEW PO items and apply their inventory.
        # -------------------------------------------------
        for it in payload.items:
            product = _get_owned_product(
                db,
                it.product_id,
                current_user.id,
            )

            db.add(
                PurchaseOrderItem(
                    order_id=po.id,
                    product_id=it.product_id,
                    quantity=it.quantity,
                    unit_cost=it.unit_cost,
                )
            )

            _adjust_inventory(
                db=db,
                product=product,
                amount=it.quantity,
                change_type="purchase",
                note=f"Purchase order #{po.id} edited - new quantity added",
            )

        db.commit()

        # Reload clean relationship state
        po = (
            db.query(PurchaseOrder)
            .options(joinedload(PurchaseOrder.items))
            .filter(PurchaseOrder.id == po.id)
            .first()
        )

        return _hydrate_po_out(db, po)

    except HTTPException:
        db.rollback()
        raise

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Failed to update purchase order.",
        )


# -----------------------------
# DELETE PURCHASE ORDER
# -----------------------------
@router.delete(
    "/{po_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        po = (
            db.query(PurchaseOrder)
            .options(joinedload(PurchaseOrder.items))
            .filter(
                PurchaseOrder.id == po_id,
                PurchaseOrder.user_id == current_user.id,
            )
            .first()
        )

        po = _ensure_owned(po, current_user.id)

        # Reverse inventory originally added by this PO.
        for item in list(po.items):
            product = _get_owned_product(
                db,
                item.product_id,
                current_user.id,
            )

            _adjust_inventory(
                db=db,
                product=product,
                amount=-item.quantity,
                change_type="revert_purchase",
                note=f"Purchase order #{po.id} deleted",
            )

        # PurchaseOrder.items has delete-orphan cascade.
        db.delete(po)

        db.commit()

        return None

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()

        print(
            f"[DELETE PO ERROR] PO #{po_id}: "
            f"{type(e).__name__}: {e}"
        )

        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete purchase order: {str(e)}",
        )