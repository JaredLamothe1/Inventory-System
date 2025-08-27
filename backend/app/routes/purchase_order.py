# app/routes/purchase_order.py
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Product, PurchaseOrder, PurchaseOrderItem
from app.routes.auth import get_current_user  # provides the logged-in User

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
    # Keep both costs for now; you can send handling_cost=0 from the UI if
    # you're folding it into shipping_cost.
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
        # prefer relationship if present
        return getattr(getattr(prod, "category", None), "name", None)
    except Exception:
        # fall back to denormalized name if your model uses it
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

    # created_at might be a date column; normalize to datetime for the response model
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
        raise HTTPException(status_code=404, detail="Purchase order not found.")
    return po


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
        .filter(PurchaseOrder.id == po_id, PurchaseOrder.user_id == current_user.id)
        .first()
    )
    po = _ensure_owned(po, current_user.id)
    return _hydrate_po_out(db, po)


@router.post("/", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Build the PO
    po = PurchaseOrder(
        created_at=(
            datetime.combine(payload.created_at, datetime.min.time())
            if payload.created_at
            else datetime.utcnow()
        ),
        user_id=current_user.id,  # <<< FIX: ensure NOT NULL user_id
        shipping_cost=payload.shipping_cost,
        handling_cost=payload.handling_cost,
    )
    db.add(po)
    db.flush()  # ensure po.id

    # Insert items (use order_id, not purchase_order_id)
    for it in payload.items:
        db.add(
            PurchaseOrderItem(
                order_id=po.id,  # <<< FIX: correct FK column
                product_id=it.product_id,
                quantity=it.quantity,
                unit_cost=it.unit_cost,
            )
        )

    db.commit()
    db.refresh(po)
    return _hydrate_po_out(db, po)


@router.put("/{po_id}", response_model=PurchaseOrderOut)
def update_purchase_order(
    po_id: int,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    po = (
        db.query(PurchaseOrder)
        .options(joinedload(PurchaseOrder.items))
        .filter(PurchaseOrder.id == po_id, PurchaseOrder.user_id == current_user.id)
        .first()
    )
    po = _ensure_owned(po, current_user.id)

    # Update simple fields
    if payload.created_at is not None:
        po.created_at = datetime.combine(payload.created_at, datetime.min.time())
    po.shipping_cost = payload.shipping_cost
    po.handling_cost = payload.handling_cost

    # Replace items (delete by order_id!)
    db.query(PurchaseOrderItem).filter(PurchaseOrderItem.order_id == po.id).delete()
    for it in payload.items:
        db.add(
            PurchaseOrderItem(
                order_id=po.id,  # <<< FIX: correct FK column
                product_id=it.product_id,
                quantity=it.quantity,
                unit_cost=it.unit_cost,
            )
        )

    db.commit()
    db.refresh(po)
    return _hydrate_po_out(db, po)


@router.delete("/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    po = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.id == po_id, PurchaseOrder.user_id == current_user.id)
        .first()
    )
    po = _ensure_owned(po, current_user.id)

    # Delete children first to be explicit (some DBs require it)
    db.query(PurchaseOrderItem).filter(PurchaseOrderItem.order_id == po.id).delete()
    db.delete(po)
    db.commit()
    return None
