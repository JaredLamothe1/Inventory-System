"""
Inventory reconciliation.

Expected inventory for normal products:

    total purchase-order units - total sold units

DEFAULT: DRY RUN
APPLY:   python scripts/reconcile_inventory.py --apply

IMPORTANT:
Products listed in EXCLUDED_PRODUCT_IDS are not modified because their
incoming inventory is not fully represented by purchase orders.
"""

from collections import defaultdict
from pathlib import Path
import argparse
import sys


BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app.database import SessionLocal
from app.models.product import Product
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.sale import Sale, SaleItem


# These products are purchased outside the normal PO workflow,
# so PO history is not sufficient to calculate their inventory.
EXCLUDED_PRODUCT_IDS = {
    225,  # trace minerals
    226,  # Trace Minerals
}


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually update product inventory.",
    )

    args = parser.parse_args()

    db = SessionLocal()

    try:
        print()
        print("=" * 100)
        print(
            "INVENTORY RECONCILIATION - "
            + ("APPLY MODE" if args.apply else "DRY RUN")
        )
        print("=" * 100)
        print()

        if args.apply:
            print("WARNING: INVENTORY VALUES WILL BE UPDATED.")
        else:
            print("NO DATABASE CHANGES WILL BE MADE.")

        print()

        # ---------------------------------------------------------
        # Load products
        # ---------------------------------------------------------

        products = (
            db.query(Product)
            .order_by(Product.name.asc())
            .all()
        )

        # ---------------------------------------------------------
        # Aggregate purchase-order quantities
        # ---------------------------------------------------------

        purchased_by_product = defaultdict(int)

        purchase_rows = (
            db.query(
                PurchaseOrder.user_id,
                PurchaseOrderItem.product_id,
                PurchaseOrderItem.quantity,
            )
            .join(
                PurchaseOrderItem,
                PurchaseOrderItem.order_id == PurchaseOrder.id,
            )
            .all()
        )

        for user_id, product_id, quantity in purchase_rows:
            purchased_by_product[
                (user_id, product_id)
            ] += int(quantity or 0)

        # ---------------------------------------------------------
        # Aggregate sale quantities
        # ---------------------------------------------------------

        sold_by_product = defaultdict(int)

        sale_rows = (
            db.query(
                Sale.user_id,
                SaleItem.product_id,
                SaleItem.quantity,
            )
            .join(
                SaleItem,
                SaleItem.sale_id == Sale.id,
            )
            .all()
        )

        for user_id, product_id, quantity in sale_rows:
            sold_by_product[
                (user_id, product_id)
            ] += int(quantity or 0)

        # ---------------------------------------------------------
        # Calculate expected inventory
        # ---------------------------------------------------------

        rows = []

        products_with_difference = 0
        products_to_update = 0
        excluded_products = 0

        current_total_reconcilable = 0
        expected_total_reconcilable = 0

        for product in products:

            key = (
                product.user_id,
                product.id,
            )

            current = int(
                product.quantity_in_stock or 0
            )

            purchased = purchased_by_product[key]
            sold = sold_by_product[key]

            expected = purchased - sold
            difference = expected - current

            excluded = (
                product.id in EXCLUDED_PRODUCT_IDS
            )

            if excluded:
                excluded_products += 1
            else:
                current_total_reconcilable += current
                expected_total_reconcilable += expected

                if difference != 0:
                    products_with_difference += 1
                    products_to_update += 1

            rows.append(
                {
                    "product": product,
                    "id": product.id,
                    "name": product.name,
                    "current": current,
                    "purchased": purchased,
                    "sold": sold,
                    "expected": expected,
                    "difference": difference,
                    "excluded": excluded,
                }
            )

        # ---------------------------------------------------------
        # Print report
        # ---------------------------------------------------------

        header = (
            f"{'ID':<6}"
            f"{'Product':<38}"
            f"{'Current':>10}"
            f"{'Purchased':>12}"
            f"{'Sold':>10}"
            f"{'Expected':>12}"
            f"{'Difference':>12}"
            f"{'Status':>14}"
        )

        print(header)
        print("-" * len(header))

        for row in rows:

            name = row["name"] or ""

            if len(name) > 35:
                name = name[:32] + "..."

            status = (
                "EXCLUDED"
                if row["excluded"]
                else (
                    "UPDATE"
                    if row["difference"] != 0
                    else "OK"
                )
            )

            print(
                f"{row['id']:<6}"
                f"{name:<38}"
                f"{row['current']:>10}"
                f"{row['purchased']:>12}"
                f"{row['sold']:>10}"
                f"{row['expected']:>12}"
                f"{row['difference']:>+12}"
                f"{status:>14}"
            )

        # ---------------------------------------------------------
        # Summary
        # ---------------------------------------------------------

        print()
        print("=" * 100)
        print("SUMMARY")
        print("=" * 100)

        print(
            f"Products checked:              {len(products)}"
        )

        print(
            f"Excluded products:             {excluded_products}"
        )

        print(
            f"Products needing correction:  "
            f"{products_with_difference}"
        )

        print()

        print(
            f"Reconcilable current total:    "
            f"{current_total_reconcilable}"
        )

        print(
            f"Reconcilable expected total:   "
            f"{expected_total_reconcilable}"
        )

        print(
            f"Reconcilable difference:       "
            f"{expected_total_reconcilable - current_total_reconcilable:+d}"
        )

        print()

        # ---------------------------------------------------------
        # Dry run ends here
        # ---------------------------------------------------------

        if not args.apply:

            print("=" * 100)
            print(
                "DRY RUN COMPLETE - "
                "NO DATABASE CHANGES WERE MADE"
            )
            print("=" * 100)

            print()
            print(
                "To apply these corrections:"
            )
            print()
            print(
                r"    python scripts\reconcile_inventory.py --apply"
            )
            print()

            return

        # ---------------------------------------------------------
        # APPLY
        # ---------------------------------------------------------

        print("=" * 100)
        print("APPLYING INVENTORY CORRECTIONS")
        print("=" * 100)
        print()

        updated = 0

        for row in rows:

            if row["excluded"]:
                continue

            if row["difference"] == 0:
                continue

            product = row["product"]

            print(
                f"{product.id} | "
                f"{product.name}: "
                f"{row['current']} -> "
                f"{row['expected']}"
            )

            # SET inventory to the calculated value.
            #
            # Do NOT add the difference. Setting the absolute
            # value makes this reconciliation idempotent.
            product.quantity_in_stock = row["expected"]

            updated += 1

        db.commit()

        print()
        print("=" * 100)
        print("RECONCILIATION COMPLETE")
        print("=" * 100)

        print()
        print(
            f"Products updated: {updated}"
        )

        print(
            f"Products excluded: {excluded_products}"
        )

        print()

    except Exception as exc:

        db.rollback()

        print()
        print("=" * 100)
        print("RECONCILIATION FAILED")
        print("=" * 100)

        print(
            f"{type(exc).__name__}: {exc}"
        )

        print()
        print(
            "TRANSACTION ROLLED BACK."
        )
        print()

        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()