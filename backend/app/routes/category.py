# app/routes/category.py
from typing import Optional, Iterable
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.models.category import Category
from app.models.product import Product
from app.models.purchase_tier import PurchaseTier
from app.models.user import User
from app.routes.auth import get_current_user
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryOut,
    CategoryNodeOut,
)
from app.schemas.purchase_tier import PurchaseTierCreate

router = APIRouter(prefix="/categories", tags=["categories"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------- internal helpers ---------------- #

def _ensure_unique_thresholds(tiers: Optional[Iterable[PurchaseTierCreate]]):
    if not tiers:
        return
    seen = set()
    for t in tiers:
        if t.threshold in seen:
            raise HTTPException(400, f"Duplicate threshold '{t.threshold}'")
        seen.add(t.threshold)


def _apply_purchase_tiers(cat: Category, tiers: list[PurchaseTierCreate], user_id: int):
    cat.purchase_tiers.clear()
    for t in sorted(tiers, key=lambda x: x.threshold):
        cat.purchase_tiers.append(
            PurchaseTier(user_id=user_id, threshold=t.threshold, price=t.price)
        )


def _replace_purchase_tiers(db: Session, cat: Category, tiers: list[PurchaseTierCreate], user_id: int):
    db.query(PurchaseTier).filter(PurchaseTier.category_id == cat.id).delete(synchronize_session=False)
    db.flush()
    for t in sorted(tiers, key=lambda x: x.threshold):
        db.add(
            PurchaseTier(
                category_id=cat.id,
                user_id=user_id,
                threshold=t.threshold,
                price=t.price,
            )
        )


def _cascade_prices(
    db: Session,
    cat: Category,
    *,
    update_sale: bool,
    update_purchase: bool,
    new_sale: Optional[float],
    new_purchase: Optional[float],
    force: bool,
):
    """
    If force=True, overwrite ALL products in this category.
    Else, only overwrite those where the product field is NULL (i.e., inheriting).
    """
    q = db.query(Product).filter(Product.category_id == cat.id)

    if update_sale and new_sale is not None:
        if force:
            q.update({Product.sale_price: new_sale}, synchronize_session=False)
        else:
            q.filter(Product.sale_price == None).update(  # noqa: E711
                {Product.sale_price: new_sale}, synchronize_session=False
            )

    if update_purchase and new_purchase is not None:
        if force:
            q.update({Product.unit_cost: new_purchase}, synchronize_session=False)
        else:
            q.filter(Product.unit_cost == None).update(  # noqa: E711
                {Product.unit_cost: new_purchase}, synchronize_session=False
            )


# ---------------- routes ---------------- #

@router.get("/", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Returns categories for the current user, including:
      - purchase_tiers (selectinload)
      - children (selectinload)
      - product_count: number of products in each category (LEFT JOIN aggregate)
    """
    # Subquery: product counts per category
    counts_sq = (
        db.query(
            Product.category_id.label("cid"),
            func.count(Product.id).label("product_count"),
        )
        .group_by(Product.category_id)
        .subquery()
    )

    # Main query: categories + joined counts (keeps eager loads)
    rows = (
        db.query(Category, counts_sq.c.product_count)
        .outerjoin(counts_sq, counts_sq.c.cid == Category.id)
        .options(
            selectinload(Category.purchase_tiers),
            selectinload(Category.children),
        )
        .filter(Category.user_id == current_user.id)
        .all()
    )

    # Attach product_count dynamically so Pydantic can serialize it
    out: list[Category] = []
    for cat, count in rows:
        setattr(cat, "product_count", int(count or 0))  # matches CategoryOut.product_count
        out.append(cat)
    return out


@router.get("/tree", response_model=list[CategoryNodeOut])
def get_category_tree(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cats = (
        db.query(Category)
        .options(selectinload(Category.children))
        .filter(Category.user_id == current_user.id)
        .all()
    )
    roots = [c for c in cats if c.parent_id is None]

    def serialize(cat: Category) -> CategoryNodeOut:
        return CategoryNodeOut(
            id=cat.id,
            name=cat.name,
            default_sale_price=cat.default_sale_price,
            parent_id=cat.parent_id,
            children=[serialize(ch) for ch in cat.children],
        )

    return [serialize(root) for root in roots]


@router.get("/{cat_id}", response_model=CategoryOut)
def get_category(cat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cat = (
        db.query(Category)
        .options(selectinload(Category.purchase_tiers), selectinload(Category.children))
        .filter(Category.id == cat_id, Category.user_id == current_user.id)
        .first()
    )
    if not cat:
        raise HTTPException(404, "Category not found")

    # Optionally attach product_count for detail view as well
    count = (
        db.query(func.count(Product.id))
        .filter(Product.category_id == cat.id)
        .scalar()
    ) or 0
    setattr(cat, "product_count", int(count))
    return cat


@router.post("/", response_model=CategoryOut)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(Category).filter(Category.user_id == current_user.id, Category.name == payload.name).first():
        raise HTTPException(400, "Category name already used")

    parent = None
    if getattr(payload, "parent_id", None):
        parent = (
            db.query(Category)
            .filter(Category.id == payload.parent_id, Category.user_id == current_user.id)
            .first()
        )
        if not parent:
            raise HTTPException(400, "Invalid parent_id")

    _ensure_unique_thresholds(payload.purchase_tiers)
    cat = Category(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        default_sale_price=payload.default_sale_price,
        base_purchase_price=payload.base_purchase_price,
        parent=parent,
    )

    db.add(cat)
    db.flush()

    if payload.purchase_tiers:
        _apply_purchase_tiers(cat, payload.purchase_tiers, current_user.id)

    db.commit()
    db.refresh(cat)

    # Attach product_count = 0 for newly created category
    setattr(cat, "product_count", 0)
    return cat


@router.patch("/{cat_id}", response_model=CategoryOut)
def update_category(payload: CategoryUpdate, cat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cat = (
        db.query(Category)
        .options(selectinload(Category.purchase_tiers))
        .filter(Category.id == cat_id, Category.user_id == current_user.id)
        .first()
    )
    if not cat:
        raise HTTPException(404, "Category not found")

    # track old values
    old_sale = cat.default_sale_price
    old_purchase = cat.base_purchase_price

    # update fields
    if payload.name is not None:
        cat.name = payload.name
    if payload.description is not None:
        cat.description = payload.description
    if payload.default_sale_price is not None:
        cat.default_sale_price = payload.default_sale_price
    if payload.base_purchase_price is not None:
        cat.base_purchase_price = payload.base_purchase_price

    # purchase tiers (replace-all semantics)
    if payload.purchase_tiers is not None:
        _ensure_unique_thresholds(payload.purchase_tiers)
        _replace_purchase_tiers(db, cat, payload.purchase_tiers, current_user.id)

    # cascade
    force = bool(payload.propagate_prices)
    update_sale = (
        (force or payload.propagate_sale_price)
        and payload.default_sale_price is not None
        and payload.default_sale_price != old_sale
    )
    update_purchase = (
        (force or payload.propagate_purchase_cost)
        and payload.base_purchase_price is not None
        and payload.base_purchase_price != old_purchase
    )
    if update_sale or update_purchase:
        _cascade_prices(
            db,
            cat,
            update_sale=update_sale,
            update_purchase=update_purchase,
            new_sale=payload.default_sale_price,
            new_purchase=payload.base_purchase_price,
            force=force,
        )

    db.commit()
    db.refresh(cat)

    # Attach current product_count for parity with GET
    count = (
        db.query(func.count(Product.id))
        .filter(Product.category_id == cat.id)
        .scalar()
    ) or 0
    setattr(cat, "product_count", int(count))
    return cat


@router.delete("/{cat_id}")
def delete_category(cat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cat = db.query(Category).filter(Category.id == cat_id, Category.user_id == current_user.id).first()
    if not cat:
        raise HTTPException(404, "Category not found")
    if cat.products:
        raise HTTPException(400, "Category has products; move or delete them first")
    db.delete(cat)
    db.commit()
    return {"message": "Deleted"}
