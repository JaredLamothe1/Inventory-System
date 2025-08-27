# app/services/pricing.py
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


# ===========================
#  GLOBAL-TIER PURCHASE PRICING
#  (what YOU pay vendor per unit)
# ===========================

def _sorted_tiers(category: Category) -> Sequence[PurchaseTier]:
    """Return purchase tiers sorted by ascending threshold."""
    return tuple(sorted(category.purchase_tiers, key=lambda t: t.threshold))


def _tier_index_for_total_qty(total_qty: int, tiers: Sequence[PurchaseTier]) -> int:
    """
    Given the order-wide total quantity and a category's tiers, return the tier index (0-based)
    to use for pricing. If total_qty is below the first threshold, no tier applies.
    """
    idx = -1
    for i, t in enumerate(tiers):
        if total_qty >= t.threshold:
            idx = i
        else:
            break
    return idx  # -1 means "no tier threshold reached"


def resolve_purchase_price_global(
    *,
    total_order_qty: int,
    category: Category,
    product_override: Optional[Decimal] = None,
) -> Decimal:
    """
    Compute the unit *purchase* cost for a PO line **using a GLOBAL TIER** determined
    by the TOTAL units across the entire purchase order.

    Priority:
      1) product_override (explicit per-line override)
      2) category tier whose threshold <= total_order_qty (highest such tier)
      3) category.base_purchase_price
      4) ValueError if nothing can be resolved
    """
    if product_override is not None:
        return product_override

    tiers = _sorted_tiers(category)
    tier_idx = _tier_index_for_total_qty(total_order_qty, tiers)

    if tier_idx >= 0:
        return Decimal(tiers[tier_idx].price)

    if category.base_purchase_price is not None:
        return Decimal(category.base_purchase_price)

    raise ValueError(
        f"Category {category.id} has no base_purchase_price and no matching tier "
        f"for total_order_qty={total_order_qty}."
    )


def resolve_purchase_price_for_product_global(
    *,
    product: Product,
    total_order_qty: int,
    override: Optional[Decimal] = None,
) -> Decimal:
    """
    Convenience wrapper if you start from a Product instead of Category.
    Uses the GLOBAL tier based on the order-wide total units.
    """
    if product.category is None:
        raise ValueError("Product has no category; cannot resolve purchase price.")
    return resolve_purchase_price_global(
        total_order_qty=total_order_qty,
        category=product.category,
        product_override=override,
    )


# ---------------------------
#  LEGACY (per-line quantity) — kept for compatibility
#  Prefer the *_global variants above in new code.
# ---------------------------
def resolve_purchase_price(
    *,
    qty: int,
    category: Category,
    product_override: Optional[Decimal] = None,
) -> Decimal:
    """
    DEPRECATED: Per-line quantity tiering (old behavior).
    Keep for backwards compatibility with any untouched call sites.
    Prefer resolve_purchase_price_global(...).
    """
    if product_override is not None:
        return product_override

    tiers: Sequence[PurchaseTier] = _sorted_tiers(category)
    # Old rule: tier based on the item's own qty, not global total
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
    DEPRECATED: Per-line quantity variant (old behavior).
    Prefer resolve_purchase_price_for_product_global(...).
    """
    if product.category is None:
        raise ValueError("Product has no category; cannot resolve purchase price.")
    return resolve_purchase_price(
        qty=qty,
        category=product.category,
        product_override=override,
    )
