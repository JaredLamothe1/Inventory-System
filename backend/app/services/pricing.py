# app/services/pricing.py (or app/pricing.py – keep the same path you already use)
from __future__ import annotations

from decimal import Decimal
from typing import Optional, Sequence

from app.models.product import Product
from app.models.category import Category
from app.models.purchase_tier import PurchaseTier


# ---------------------------
# SALE PRICE (what clients pay)
# ---------------------------
def resolve_sale_price(product: Product) -> Optional[Decimal]:
    """
    Return the sale price to charge a client for THIS product.
    Priority:
      1) product.sale_price (if you store per-product sale overrides)
      2) climb category tree for default_sale_price
      3) None if nothing set
    """
    if getattr(product, "sale_price", None) is not None:
        return Decimal(product.sale_price)

    cat: Optional[Category] = product.category
    while cat:
        if cat.default_sale_price is not None:
            return Decimal(cat.default_sale_price)
        cat = cat.parent
    return None


# ---------------------------
# PURCHASE PRICE (what you pay vendor)
# ---------------------------
def resolve_purchase_price(
    *,
    qty: int,
    category: Category,
    product_override: Optional[Decimal] = None,
) -> Decimal:
    """
    Compute the unit *purchase* cost for a PO line.

    Priority:
      1) product_override (explicit per-line override)
      2) highest tier where threshold <= qty
      3) category.base_purchase_price

    Raises ValueError if nothing can be resolved.
    """
    if product_override is not None:
        return product_override

    tiers: Sequence[PurchaseTier] = sorted(category.purchase_tiers, key=lambda t: t.threshold)
    for tier in reversed(tiers):
        if qty >= tier.threshold:
            return Decimal(tier.price)

    if category.base_purchase_price is not None:
        return Decimal(category.base_purchase_price)

    raise ValueError(
        f"Category {category.id} has no base_purchase_price and no matching tier for qty={qty}."
    )


def resolve_purchase_price_for_product(
    *,
    product: Product,
    qty: int,
    override: Optional[Decimal] = None,
) -> Decimal:
    """
    Convenience wrapper if you start from a Product instead of Category.
    """
    if product.category is None:
        raise ValueError("Product has no category; cannot resolve purchase price.")
    return resolve_purchase_price(
        qty=qty,
        category=product.category,
        product_override=override,
    )
