# app/routes/products.py
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import asc, desc, or_
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


# -------------------------------------------------------------------
# Dependencies
# -------------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------------------------------------------------------
# Enums / response models
# -------------------------------------------------------------------

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


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def to_out(p: Product) -> ProductOut:
    """
    Convert a Product ORM object into the API response model.

    quantity_in_stock is intentionally NOT clamped to zero.
    Negative inventory is valid and represents oversold/backordered stock.
    """
    out = ProductOut.model_validate(p)

    out.inherits_sale_price = p.sale_price is None
    out.inherits_purchase_cost = p.unit_cost is None
    out.resolved_price = resolve_sale_price(p)

    out.collections = [
        {
            "id": collection.id,
            "name": collection.name,
            "color": collection.color,
        }
        for collection in getattr(p, "collections", [])
    ]

    out.notes = p.notes

    return out


def _attach_collections(
    product: Product,
    collection_ids: List[int],
    db: Session,
    user_id: int,
):
    """
    Replace the product's collection memberships.

    Every requested collection must belong to the current user.
    """
    if collection_ids is None:
        return

    if not collection_ids:
        product.collections.clear()
        return

    unique_ids = set(collection_ids)

    collections = (
        db.query(ProductCollection)
        .filter(
            ProductCollection.user_id == user_id,
            ProductCollection.id.in_(unique_ids),
        )
        .all()
    )

    if len(collections) != len(unique_ids):
        raise HTTPException(
            status_code=400,
            detail="One or more collections not found or not yours.",
        )

    product.collections = collections


# -------------------------------------------------------------------
# List / search products
# -------------------------------------------------------------------

@router.get("/", response_model=ProductListResponse)
def list_products(
    page: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=1000),
    sort_by: SortBy = Query(SortBy.name),
    order: Order = Query(Order.asc),
    search: Optional[str] = Query(
        None,
        description="Search product name, SKU, or description.",
    ),
    category_id: Optional[int] = Query(None),
    collection_id: Optional[int] = Query(
        None,
        description="Filter by a single collection id.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return products for the current user.

    IMPORTANT:
    Search/filtering happens BEFORE pagination.

    Example:
        223 total products
        search='hpa'
        3 products match

    Result:
        page 1 contains those 3 products
        total_pages = 1

    We do NOT fetch 25 products first and then search those 25.
    """

    query = (
        db.query(Product)
        .options(
            selectinload(Product.collections),
            selectinload(Product.category),
        )
        .filter(Product.user_id == current_user.id)
    )

    # ---------------------------------------------------------------
    # Category filter
    # ---------------------------------------------------------------

    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    # ---------------------------------------------------------------
    # Collection filter
    # ---------------------------------------------------------------

    if collection_id is not None:
        query = (
            query.join(Product.collections)
            .filter(ProductCollection.id == collection_id)
        )

    # ---------------------------------------------------------------
    # Search
    #
    # This MUST happen before count(), offset(), and limit().
    # ---------------------------------------------------------------

    cleaned_search = search.strip() if search else ""

    if cleaned_search:
        search_pattern = f"%{cleaned_search}%"

        query = query.filter(
            or_(
                Product.name.ilike(search_pattern),
                Product.sku.ilike(search_pattern),
                Product.description.ilike(search_pattern),
            )
        )

    # ---------------------------------------------------------------
    # Count AFTER all search/filter conditions have been applied.
    # ---------------------------------------------------------------

    total_count = query.count()

    total_pages = (
        (total_count + limit - 1) // limit
        if total_count > 0
        else 0
    )

    # ---------------------------------------------------------------
    # Sort
    # ---------------------------------------------------------------

    sort_column = getattr(Product, sort_by.value)

    if order == Order.asc:
        ordering = asc(sort_column)
    else:
        ordering = desc(sort_column)

    # Add ID as a deterministic secondary sort.
    #
    # This prevents unstable pagination when two products have the
    # same name, stock quantity, or SKU.
    if order == Order.asc:
        secondary_order = asc(Product.id)
    else:
        secondary_order = desc(Product.id)

    # ---------------------------------------------------------------
    # Paginate LAST
    # ---------------------------------------------------------------

    skip = page * limit

    products = (
        query
        .order_by(ordering, secondary_order)
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "products": [to_out(product) for product in products],
        "total_pages": total_pages,
    }


# -------------------------------------------------------------------
# Create product
# -------------------------------------------------------------------

@router.post("/", response_model=ProductOut)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate category ownership.
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
            raise HTTPException(
                status_code=400,
                detail="Invalid category_id",
            )

    # None means inherit from the category/pricing system.
    unit_cost = (
        None
        if payload.use_category_purchase_cost
        else payload.unit_cost
    )

    sale_price = (
        None
        if payload.use_category_sale_price
        else payload.sale_price
    )

    new_product = Product(
        user_id=current_user.id,
        name=payload.name,
        sku=payload.sku,
        description=payload.description,
        notes=payload.notes,
        unit_cost=unit_cost,
        sale_price=sale_price,
        category_id=payload.category_id,

        # Preserve the quantity supplied by the schema.
        #
        # Negative quantities are intentionally supported by the
        # inventory model for oversell/backorder workflows.
        quantity_in_stock=int(payload.quantity_in_stock or 0),
    )

    db.add(new_product)
    db.flush()

    _attach_collections(
        new_product,
        payload.collection_ids,
        db,
        current_user.id,
    )

    db.commit()
    db.refresh(new_product)

    return to_out(new_product)


# -------------------------------------------------------------------
# Update product
# -------------------------------------------------------------------

@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = (
        db.query(Product)
        .options(
            selectinload(Product.collections),
            selectinload(Product.category),
        )
        .filter(
            Product.id == product_id,
            Product.user_id == current_user.id,
        )
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    # ---------------------------------------------------------------
    # Category
    # ---------------------------------------------------------------

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
            raise HTTPException(
                status_code=400,
                detail="Invalid category_id",
            )

        product.category_id = payload.category_id

    # ---------------------------------------------------------------
    # Basic fields
    # ---------------------------------------------------------------

    if payload.name is not None:
        product.name = payload.name

    if payload.sku is not None:
        product.sku = payload.sku

    if payload.description is not None:
        product.description = payload.description

    if payload.notes is not None:
        product.notes = payload.notes

    # Do NOT clamp inventory to zero.
    if payload.quantity_in_stock is not None:
        product.quantity_in_stock = int(payload.quantity_in_stock)

    # ---------------------------------------------------------------
    # Purchase cost
    # ---------------------------------------------------------------

    if payload.use_category_purchase_cost is True:
        product.unit_cost = None
    elif payload.unit_cost is not None:
        product.unit_cost = payload.unit_cost

    # ---------------------------------------------------------------
    # Sale price
    # ---------------------------------------------------------------

    if payload.use_category_sale_price is True:
        product.sale_price = None
    elif payload.sale_price is not None:
        product.sale_price = payload.sale_price

    # ---------------------------------------------------------------
    # Collections
    # ---------------------------------------------------------------

    if payload.collection_ids is not None:
        _attach_collections(
            product,
            payload.collection_ids,
            db,
            current_user.id,
        )

    db.commit()
    db.refresh(product)

    return to_out(product)


# -------------------------------------------------------------------
# Delete product
# -------------------------------------------------------------------

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.user_id == current_user.id,
        )
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    db.delete(product)
    db.commit()

    return {
        "message": "Product deleted successfully",
    }


# -------------------------------------------------------------------
# Get single product
# -------------------------------------------------------------------

@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = (
        db.query(Product)
        .options(
            selectinload(Product.collections),
            selectinload(Product.category),
        )
        .filter(
            Product.id == product_id,
            Product.user_id == current_user.id,
        )
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    return to_out(product)