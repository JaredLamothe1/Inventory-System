# seed_categories.py
import os
import requests

API_URL = os.getenv("API_URL", "http://localhost:8000/categories/")
TOKEN   = os.getenv("API_TOKEN", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc1MzMwNTM5OH0.c_iZ5rGOr1MYhnA72G8GNvB8cXgjGnVy7nTNjPKIJOY")  # put your JWT here or export API_TOKEN

headers = {"Content-Type": "application/json"}
if TOKEN:
    headers["Authorization"] = f"Bearer {TOKEN}"

# ----- EDIT THIS LIST AS NEEDED -----
raw_categories = [
    {
        "name": "Sol Remedies",
        "default_sale_price": 90,
        "price_tiers": [
            {"min_qty": 1, "price": 45},
            {"min_qty": 50, "price": 42},
            {"min_qty": 100, "price": 37},
            {"min_qty": 150, "price": 32},
            {"min_qty": 200, "price": 27},
        ],
    },
    {
        "name": "CaSol Formulations",
        "default_sale_price": 100,
        "price_tiers": [
            {"min_qty": 1, "price": 55},
            {"min_qty": 50, "price": 52},
            {"min_qty": 100, "price": 47},
            {"min_qty": 150, "price": 42},
            {"min_qty": 200, "price": 37},
        ],
    },
    {
        "name": "Anti Formulations",
        "default_sale_price": 100,
        "price_tiers": [
            {"min_qty": 1, "price": 55},
            {"min_qty": 50, "price": 52},
            {"min_qty": 100, "price": 47},
            {"min_qty": 150, "price": 42},
            {"min_qty": 200, "price": 37},
        ],
    },
    {
        "name": "A Formulations",
        "default_sale_price": 125,
        "price_tiers": [
            {"min_qty": 1, "price": 78},
            {"min_qty": 50, "price": 73},
            {"min_qty": 100, "price": 63},
            {"min_qty": 150, "price": 55},
            {"min_qty": 200, "price": 45},
        ],
    },
    {
        "name": "ALG Formulations",
        "default_sale_price": 200,
        "price_tiers": [
            {"min_qty": 1, "price": 153},
            {"min_qty": 50, "price": 138},
            {"min_qty": 100, "price": 118},
            {"min_qty": 150, "price": 98},
            {"min_qty": 200, "price": 78},
        ],
    },
    {
        "name": "Other",
        "default_sale_price": 125,
        "price_tiers": [
            {"min_qty": 1, "price": 78},
            {"min_qty": 50, "price": 73},
            {"min_qty": 100, "price": 63},
            {"min_qty": 150, "price": 55},
            {"min_qty": 200, "price": 45},
        ],
    },
]

def normalize(cat: dict) -> dict:
    """Convert legacy keys -> current backend schema."""
    tiers_in = cat.get("price_tiers", [])
    purchase_tiers = [
        {"threshold": t["min_qty"], "price": t["price"]} for t in tiers_in
    ]

    base_purchase_price = cat.get("base_purchase_price")
    if base_purchase_price is None and purchase_tiers:
        base_purchase_price = purchase_tiers[0]["price"]

    return {
        "name": cat["name"],
        "description": cat.get("description"),
        "default_sale_price": cat.get("default_sale_price"),
        "base_purchase_price": base_purchase_price,
        "purchase_tiers": purchase_tiers,
    }

def main():
    for cat in raw_categories:
        payload = normalize(cat)
        try:
            resp = requests.post(API_URL, json=payload, headers=headers, timeout=10)
            print(f"{payload['name']}: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"{payload['name']}: ERROR - {e}")

if __name__ == "__main__":
    main()
