# app/routes/collections.py
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.models.product import Product
from app.models.product_collection import ProductCollection
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.product_collection import (
    CollectionCreate,
    CollectionUpdate,
    CollectionOut,
)

router = APIRouter(prefix="/collections", tags=["collections"])


# ----------------- deps -----------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ----------------- helpers -----------------
def _attach_products(col: ProductCollection, product_ids: List[int], db: Session, user_id: int):
    """Replace collection.products with the given set (ownership-checked)."""
    if not product_ids:
        col.products.clear()
        return

    products = (
        db.query(Product)
        .filter(Product.user_id == user_id, Product.id.in_(product_ids))
        .all()
    )
    if len(products) != len(set(product_ids)):
        raise HTTPException(status_code=400, detail="One or more products not found or not yours.")
    col.products = products


# ----------------- routes -----------------
@router.get("/", response_model=List[CollectionOut])
def list_collections(
    include_products: bool = Query(False, description="Include product list for each collection"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ProductCollection).filter(ProductCollection.user_id == current_user.id)
    if include_products:
        q = q.options(selectinload(ProductCollection.products))
    cols = q.all()
    return cols


@router.get("/{collection_id}", response_model=CollectionOut)
def get_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    col = (
        db.query(ProductCollection)
        .options(selectinload(ProductCollection.products))
        .filter(ProductCollection.id == collection_id, ProductCollection.user_id == current_user.id)
        .first()
    )
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    return col


@router.post("/", response_model=CollectionOut, status_code=201)
def create_collection(
    payload: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # uniqueness
    dupe = (
        db.query(ProductCollection)
        .filter(ProductCollection.user_id == current_user.id, ProductCollection.name == payload.name)
        .first()
    )
    if dupe:
        raise HTTPException(status_code=400, detail="A collection with that name already exists.")

    col = ProductCollection(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        color=payload.color,
    )
    db.add(col)
    db.flush()  # need id before attaching M2M

    if payload.product_ids:
        _attach_products(col, payload.product_ids, db, current_user.id)

    db.commit()
    db.refresh(col)
    return col


@router.patch("/{collection_id}", response_model=CollectionOut)
def update_collection(
    collection_id: int,
    payload: CollectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    col = (
        db.query(ProductCollection)
        .options(selectinload(ProductCollection.products))
        .filter(ProductCollection.id == collection_id, ProductCollection.user_id == current_user.id)
        .first()
    )
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    # name uniqueness
    if payload.name and payload.name != col.name:
        dupe = (
            db.query(ProductCollection)
            .filter(ProductCollection.user_id == current_user.id, ProductCollection.name == payload.name)
            .first()
        )
        if dupe:
            raise HTTPException(status_code=400, detail="A collection with that name already exists.")

    if payload.name is not None:
        col.name = payload.name
    if payload.description is not None:
        col.description = payload.description
    if payload.color is not None:
        col.color = payload.color

    if payload.product_ids is not None:
        _attach_products(col, payload.product_ids, db, current_user.id)

    db.commit()
    db.refresh(col)
    return col


@router.delete("/{collection_id}", status_code=204)
def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    col = (
        db.query(ProductCollection)
        .filter(ProductCollection.id == collection_id, ProductCollection.user_id == current_user.id)
        .first()
    )
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    db.delete(col)
    db.commit()
    return
