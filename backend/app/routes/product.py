from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc
from typing import List, Optional
from enum import Enum
from pydantic import BaseModel

from app.database import SessionLocal
from app.models.product import Product
from app.models.category import Category
from app.schemas.product import ProductCreate, ProductOut

router = APIRouter(prefix="/products", tags=["products"])

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Enum for sorting
class SortBy(str, Enum):
    name = "name"
    quantity_in_stock = "quantity_in_stock"

class Order(str, Enum):
    asc = "asc"
    desc = "desc"

# Pydantic Response Model
class ProductListResponse(BaseModel):
    products: List[ProductOut]
    total_pages: int

# Helper to convert DB model to schema
def product_to_product_out(product: Product) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=product.name,
        unit_cost=product.unit_cost,
        sale_price=product.sale_price,
        reorder_threshold=product.reorder_threshold,
        restock_target=product.restock_target,
        storage_space=product.storage_space,
        vendor_id=product.vendor_id,
        category_id=product.category_id,
        quantity_in_stock=product.quantity_in_stock,
        category_name=product.category.name if product.category else None
    )

# GET all products with pagination, filtering, sorting
@router.get("/", response_model=ProductListResponse)
def get_all_products(
    page: int = Query(0, ge=0),
    limit: int = Query(25, le=1000),
    sort_by: SortBy = Query(SortBy.name),
    order: Order = Query(Order.asc),
    category_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    skip = page * limit
    sort_column = getattr(Product, sort_by.value)
    ordering = asc(sort_column) if order == Order.asc else desc(sort_column)

    query = db.query(Product)
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    total_count = query.count()
    total_pages = (total_count + limit - 1) // limit
    products = query.order_by(ordering).offset(skip).limit(limit).all()

    return {
        "products": [product_to_product_out(p) for p in products],
        "total_pages": total_pages
    }

# POST create new product
@router.post("/", response_model=ProductOut)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    sale_price = product.sale_price

    if sale_price is None:
        category = db.query(Category).filter(Category.id == product.category_id).first()
        if not category or category.default_sale_price is None:
            raise HTTPException(
                status_code=400,
                detail="Sale price not provided and no default found in category."
            )
        sale_price = category.default_sale_price

    new_product = Product(
        name=product.name,
        unit_cost=product.unit_cost,
        sale_price=sale_price,
        reorder_threshold=product.reorder_threshold,
        restock_target=product.restock_target,
        storage_space=product.storage_space,
        vendor_id=product.vendor_id,
        category_id=product.category_id,
        quantity_in_stock=product.quantity_in_stock
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return product_to_product_out(new_product)

# PUT update product
@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, product: ProductCreate, db: Session = Depends(get_db)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    db_product.name = product.name
    db_product.unit_cost = product.unit_cost
    db_product.sale_price = product.sale_price
    db_product.reorder_threshold = product.reorder_threshold
    db_product.restock_target = product.restock_target
    db_product.storage_space = product.storage_space
    db_product.vendor_id = product.vendor_id
    db_product.category_id = product.category_id
    db_product.quantity_in_stock = product.quantity_in_stock

    db.commit()
    db.refresh(db_product)
    return product_to_product_out(db_product)

# DELETE product
@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()
    return {"message": "Product deleted successfully"}

# GET single product
@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_product_out(product)
