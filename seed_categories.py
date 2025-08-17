# seed_categories.py
import os
import sys
import json
import requests

API_BASE = os.getenv("API_BASE", "http://localhost:8000").rstrip("/")
LOGIN_URL = f"{API_BASE}/login"
CATEGORIES_URL = f"{API_BASE}/categories/"

API_TOKEN = os.getenv("API_TOKEN")  # preferred: supply a token
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme")

def get_token_if_needed() -> str:
    """
    Return a JWT to authenticate requests.
    If API_TOKEN is already set, use it. Otherwise, login.
    """
    if API_TOKEN:
        return API_TOKEN
    try:
        resp = requests.post(
            LOGIN_URL,
            data={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        if resp.status_code != 200:
            print(f"Login failed: {resp.status_code} - {resp.text}")
            sys.exit(1)
        data = resp.json()
        return data["access_token"]
    except Exception as e:
        print(f"Login error: {e}")
        sys.exit(1)

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
    """
    Convert legacy keys -> backend schema:
      - price_tiers -> purchase_tiers[{threshold, price}]
      - base_purchase_price -> first tier price if missing
    """
    tiers_in = cat.get("price_tiers", [])
    purchase_tiers = [{"threshold": t["min_qty"], "price": t["price"]} for t in tiers_in]

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
    token = get_token_if_needed()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    for cat in raw_categories:
        payload = normalize(cat)
        try:
            resp = requests.post(CATEGORIES_URL, json=payload, headers=headers, timeout=15)
            if resp.headers.get("content-type", "").startswith("application/json"):
                body = resp.json()
            else:
                body = resp.text

            if resp.status_code in (200, 201):
                print(f"[OK] {payload['name']}")
            else:
                print(f"[{resp.status_code}] {payload['name']} -> {body}")
        except Exception as e:
            print(f"[ERROR] {payload['name']}: {e}")

if __name__ == "__main__":
    main()
