"""
Merge duplicate product HpaSold into HpaSol.

This script:
1. Finds HpaSol and HpaSold.
2. Shows exactly what will be changed.
3. Reassigns PurchaseOrderItem rows from HpaSold -> HpaSol.
4. Reassigns SaleItem rows from HpaSold -> HpaSol.
5. Reassigns InventoryLog rows from HpaSold -> HpaSol.
6. Deletes HpaSold.

DEFAULT = DRY RUN
Use --apply to actually make changes.

Run from backend:

    python scripts\merge_duplicate_product.py

Apply:

    python scripts\merge_duplicate_product.py --apply
"""

from pathlib import Path
import argparse
import sys

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal
from app.models.product import Product
from app.models.purchase_order import PurchaseOrderItem
from app.models.sale import SaleItem
from app.models.inventory_log import InventoryLog


KEEP_PRODUCT_NAME = "HpaSol"
DELETE_PRODUCT_NAME = "HpaSold"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually perform the merge.",
    )
    args = parser.parse_args()

    db = SessionLocal()

    try:
        print()
        print("=" * 80)
        print("DUPLICATE PRODUCT MERGE")
        print("=" * 80)

        keep_product = (
            db.query(Product)
            .filter(Product.name == KEEP_PRODUCT_NAME)
            .one_or_none()
        )

        duplicate_product = (
            db.query(Product)
            .filter(Product.name == DELETE_PRODUCT_NAME)
            .one_or_none()
        )

        if keep_product is None:
            raise RuntimeError(
                f'Could not find destination product "{KEEP_PRODUCT_NAME}".'
            )

        if duplicate_product is None:
            raise RuntimeError(
                f'Could not find duplicate product "{DELETE_PRODUCT_NAME}".'
            )

        if keep_product.id == duplicate_product.id:
            raise RuntimeError("Products unexpectedly have the same ID.")

        # Extra safety: don't accidentally merge products belonging
        # to different users/accounts.
        if keep_product.user_id != duplicate_product.user_id:
            raise RuntimeError(
                "Products belong to different users. Merge aborted."
            )

        print()
        print("KEEP:")
        print(
            f"  ID {keep_product.id} | "
            f"{keep_product.name} | "
            f"current inventory = {keep_product.quantity_in_stock}"
        )

        print()
        print("MERGE AND DELETE:")
        print(
            f"  ID {duplicate_product.id} | "
            f"{duplicate_product.name} | "
            f"current inventory = {duplicate_product.quantity_in_stock}"
        )

        # ---------------------------------------------------------
        # Find all references to the duplicate
        # ---------------------------------------------------------

        po_items = (
            db.query(PurchaseOrderItem)
            .filter(PurchaseOrderItem.product_id == duplicate_product.id)
            .all()
        )

        sale_items = (
            db.query(SaleItem)
            .filter(SaleItem.product_id == duplicate_product.id)
            .all()
        )

        inventory_logs = (
            db.query(InventoryLog)
            .filter(InventoryLog.product_id == duplicate_product.id)
            .all()
        )

        po_units = sum(int(item.quantity or 0) for item in po_items)
        sale_units = sum(int(item.quantity or 0) for item in sale_items)

        print()
        print("-" * 80)
        print("REFERENCES THAT WILL BE MOVED")
        print("-" * 80)

        print(
            f"Purchase order items: {len(po_items)} "
            f"({po_units} total units)"
        )

        for item in po_items:
            print(
                f"  PO item ID {item.id}: "
                f"order_id={item.order_id}, "
                f"quantity={item.quantity}, "
                f"unit_cost={item.unit_cost}"
            )

        print()
        print(
            f"Sale items:           {len(sale_items)} "
            f"({sale_units} total units)"
        )

        for item in sale_items:
            print(
                f"  Sale item ID {item.id}: "
                f"sale_id={item.sale_id}, "
                f"quantity={item.quantity}, "
                f"unit_price={item.unit_price}"
            )

        print()
        print(f"Inventory logs:       {len(inventory_logs)}")

        print()
        print("-" * 80)

        if not args.apply:
            print("DRY RUN ONLY")
            print("NO DATABASE CHANGES WERE MADE.")
            print()
            print("If everything above looks correct, run:")
            print()
            print("    python scripts\\merge_duplicate_product.py --apply")
            print()
            return

        # ---------------------------------------------------------
        # APPLY
        # ---------------------------------------------------------

        print("APPLY MODE")
        print()

        for item in po_items:
            item.product_id = keep_product.id

        for item in sale_items:
            item.product_id = keep_product.id

        for log in inventory_logs:
            log.product_id = keep_product.id

        # IMPORTANT:
        # Do NOT attempt to calculate inventory here.
        #
        # We're going to run the full inventory reconciliation after
        # duplicate cleanup, so that script will calculate HpaSol from
        # the complete combined PO/sale history.
        db.delete(duplicate_product)

        db.commit()

        print("MERGE COMPLETE.")
        print()
        print(
            f'All references to "{DELETE_PRODUCT_NAME}" '
            f'now point to "{KEEP_PRODUCT_NAME}".'
        )
        print(
            f'"{DELETE_PRODUCT_NAME}" was deleted.'
        )
        print()
        print(
            "Inventory was NOT recalculated by this script. "
            "Run the inventory reconciliation dry run next."
        )
        print()

    except Exception as exc:
        db.rollback()

        print()
        print("=" * 80)
        print("MERGE FAILED - TRANSACTION ROLLED BACK")
        print("=" * 80)
        print(f"{type(exc).__name__}: {exc}")
        print()

        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()