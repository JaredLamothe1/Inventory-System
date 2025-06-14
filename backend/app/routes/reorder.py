from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.product import Product
from app.models.bulk_discount import BulkDiscount

router = APIRouter(prefix="/products", tags=["reorder-plan"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/reorder-plan")
def get_reorder_plan(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    plans = []

    for product in products:
        if product.quantity_in_stock >= product.reorder_threshold:
            continue  # Skip products with healthy stock

        needed_to_threshold = product.reorder_threshold - product.quantity_in_stock

        # Get all bulk discounts for this product
        discounts = (
            db.query(BulkDiscount)
            .filter(BulkDiscount.product_id == product.id)
            .order_by(BulkDiscount.min_quantity.asc())
            .all()
        )

        suggestion = {
            "product_id": product.id,
            "product_name": product.name,
            "current_stock": product.quantity_in_stock,
            "reorder_threshold": product.reorder_threshold,
            "min_suggestion": needed_to_threshold,
            "recommended_order_qty": None,
            "suggested_unit_cost": product.unit_cost,
            "estimated_total_cost": None
        }

        for d in discounts:
            qty_needed = d.min_quantity - product.quantity_in_stock
            if qty_needed > 0:
                suggestion["recommended_order_qty"] = qty_needed
                suggestion["suggested_unit_cost"] = d.discounted_unit_cost
                suggestion["estimated_total_cost"] = round(qty_needed * d.discounted_unit_cost, 2)
                break
        # If no discount tier was triggered, fall back to minimum suggestion
        if suggestion["recommended_order_qty"] is None:
             suggestion["recommended_order_qty"] = needed_to_threshold
             suggestion["estimated_total_cost"] = round(
                needed_to_threshold * product.unit_cost, 2
            )

        plans.append(suggestion)

    return plans
