# app/routes/products.py
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.models.category import Category
from app.models.product import Product
from app.models.product_collection import ProductCollection
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.product import ProductCreate, ProductUpdate, ProductOut
from app.services.pricing import resolve_sale_price

router = APIRouter(prefix="/products", tags=["products"])

# -------------------------
# Dependencies
# -------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------------
# Enums & Response Models
# -------------------------
class SortBy(str, Enum):
    name = "name"
    quantity_in_stock = "quantity_in_stock"
    sku = "sku"

class Order(str, Enum):
    asc = "asc"
    desc = "desc"

class ProductListResponse(BaseModel):
    products: List[ProductOut]
    total_pages: int

# -------------------------
# Helpers
# -------------------------
def _safe_qty(n):
    # Guard any weirdness; keep int, never negative
    try:
        return max(0, int(n or 0))
    except Exception:
        return 0

def to_out(p: Product) -> ProductOut:
    # IMPORTANT: fix the value BEFORE calling from_orm()
    if getattr(p, "quantity_in_stock", None) is not None:
        fixed = _safe_qty(p.quantity_in_stock)
        if fixed != p.quantity_in_stock:
            p.quantity_in_stock = fixed

    out = ProductOut.from_orm(p)

    # computed fields
    out.inherits_sale_price = p.sale_price is None
    out.inherits_purchase_cost = p.unit_cost is None
    out.resolved_price = resolve_sale_price(p)
    out.collections = [
        {"id": c.id, "name": c.name, "color": c.color} for c in getattr(p, "collections", [])
    ]
    out.notes = p.notes
    return out  # type: ignore

def _attach_collections(
    product: Product, collection_ids: List[int], db: Session, user_id: int
):
    if collection_ids is None:
        return
    if not collection_ids:
        product.collections.clear()
        return

    cols = (
        db.query(ProductCollection)
        .filter(
            ProductCollection.user_id == user_id,
            ProductCollection.id.in_(collection_ids),
        )
        .all()
    )
    if len(cols) != len(set(collection_ids)):
        raise HTTPException(
            status_code=400,
            detail="One or more collections not found or not yours.",
        )
    product.collections = cols

# -------------------------
# Routes
# -------------------------
@router.get("/", response_model=ProductListResponse)
def list_products(
    page: int = Query(0, ge=0),
    limit: int = Query(25, le=1000),
    sort_by: SortBy = Query(SortBy.name),
    order: Order = Query(Order.asc),
    category_id: Optional[int] = None,
    collection_id: Optional[int] = Query(
        None, description="Filter by a single collection id"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skip = page * limit
    sort_column = getattr(Product, sort_by.value)
    ordering = asc(sort_column) if order == Order.asc else desc(sort_column)

    q = (
        db.query(Product)
        .options(selectinload(Product.collections), selectinload(Product.category))
        .filter(Product.user_id == current_user.id)
    )

    if category_id is not None:
        q = q.filter(Product.category_id == category_id)

    if collection_id is not None:
        q = q.join(Product.collections).filter(ProductCollection.id == collection_id)

    total_count = q.count()
    total_pages = (total_count + limit - 1) // limit

    products = q.order_by(ordering).offset(skip).limit(limit).all()
    # Ensure no negative leaks in the response list either
    safe = []
    for p in products:
        if getattr(p, "quantity_in_stock", None) is not None:
            fixed = _safe_qty(p.quantity_in_stock)
            if fixed != p.quantity_in_stock:
                p.quantity_in_stock = fixed
        safe.append(p)

    return {"products": [to_out(p) for p in safe], "total_pages": total_pages}

@router.post("/", response_model=ProductOut)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.category_id is not None:
        category = (
            db.query(Category)
            .filter(
                Category.id == payload.category_id,
                Category.user_id == current_user.id,
            )
            .first()
        )
        if not category:
            raise HTTPException(status_code=400, detail="Invalid category_id")

    unit_cost = None if payload.use_category_purchase_cost else payload.unit_cost
    sale_price = None if payload.use_category_sale_price else payload.sale_price

    new_product = Product(
        user_id=current_user.id,
        name=payload.name,
        sku=payload.sku,
        description=payload.description,
        notes=payload.notes,
        unit_cost=unit_cost,
        sale_price=sale_price,
        category_id=payload.category_id,
        quantity_in_stock=int(max(0, payload.quantity_in_stock or 0)),  # guard
    )

    db.add(new_product)
    db.flush()

    _attach_collections(new_product, payload.collection_ids, db, current_user.id)

    db.commit()
    db.refresh(new_product)
    return to_out(new_product)

@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = (
        db.query(Product)
        .options(selectinload(Product.collections))
        .filter(Product.id == product_id, Product.user_id == current_user.id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.category_id is not None:
        cat = (
            db.query(Category)
            .filter(
                Category.id == payload.category_id,
                Category.user_id == current_user.id,
            )
            .first()
        )
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category_id")
        p.category_id = payload.category_id

    if payload.name is not None:
        p.name = payload.name
    if payload.sku is not None:
        p.sku = payload.sku
    if payload.description is not None:
        p.description = payload.description
    if payload.notes is not None:
        p.notes = payload.notes
    if payload.quantity_in_stock is not None:
        p.quantity_in_stock = int(max(0, payload.quantity_in_stock))  # guard

    if payload.use_category_purchase_cost is True:
        p.unit_cost = None
    elif payload.unit_cost is not None:
        p.unit_cost = payload.unit_cost

    if payload.use_category_sale_price is True:
        p.sale_price = None
    elif payload.sale_price is not None:
        p.sale_price = payload.sale_price

    if payload.collection_ids is not None:
        _attach_collections(p, payload.collection_ids, db, current_user.id)

    # last guard before returning
    p.quantity_in_stock = _safe_qty(p.quantity_in_stock)

    db.commit()
    db.refresh(p)
    return to_out(p)

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = (
        db.query(Product)
        .filter(Product.id == product_id, Product.user_id == current_user.id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(p)
    db.commit()
    return {"message": "Product deleted successfully"}

@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = (
        db.query(Product)
        .options(selectinload(Product.collections), selectinload(Product.category))
        .filter(Product.id == product_id, Product.user_id == current_user.id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    p.quantity_in_stock = _safe_qty(p.quantity_in_stock)
    return to_out(p)
