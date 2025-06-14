import random
from datetime import datetime, timedelta
import requests

API_URL = "http://127.0.0.1:8000"

def random_date_within_last_6_months():
    days_ago = random.randint(0, 180)
    return (datetime.utcnow() - timedelta(days=days_ago)).isoformat()

def seed_purchase_orders(count=50):
    print("📦 Fetching product list...")
    try:
        response = requests.get(f"{API_URL}/products", params={"limit": 1000, "page": 0})
        response.raise_for_status()
        products = response.json().get("products", [])
    except Exception as e:
        print(f"❌ Failed to fetch products: {e}")
        return

    if not products:
        print("❌ No products found.")
        return

    print(f"✅ {len(products)} products available.")

    for i in range(count):
        selected_products = random.sample(products, k=random.randint(1, 5))
        order_items = []

        for p in selected_products:
            qty = random.randint(5, 100)
            unit_cost = round(random.uniform(10, 200), 2)
            order_items.append({
                "product_id": p["id"],
                "quantity": qty,
                "unit_cost": unit_cost
            })

        payload = {
            "created_at": random_date_within_last_6_months(),
            "items": order_items
        }

        try:
            res = requests.post(f"{API_URL}/purchase_orders/", json=payload)
            res.raise_for_status()
            print(f"✅ Seeded Purchase Order #{i + 1}")
        except Exception as err:
            print(f"❌ Error creating PO #{i + 1}: {res.status_code} - {res.text}")

    print("🎉 Done seeding purchase orders.")

if __name__ == "__main__":
    seed_purchase_orders()
