import requests
import random
from faker import Faker
from tqdm import tqdm
from datetime import date

BASE_URL = "http://127.0.0.1:8000"
fake = Faker()

# Get products
products_res = requests.get(f"{BASE_URL}/products/?limit=1000")
products = products_res.json().get("products", [])

if not isinstance(products, list) or not products:
    raise ValueError("No products found to generate sales from.")

def generate_fake_sale():
    num_items = random.randint(1, 4)
    chosen_products = random.sample(products, k=min(num_items, len(products)))

    items = []
    for p in chosen_products:
        items.append({
            "product_id": p["id"],
            "quantity": random.randint(1, 5),
            "unit_price": p.get("sale_price") or 15.0,
        })

    payload = {
        "sale_date": fake.date_between(start_date="-6M", end_date="today").isoformat(),
        "notes": fake.sentence(nb_words=6),
        "sale_type": random.choice(["daily", "weekly", "individual"]),
        "payment_method": random.choice(["cash", "card"]),
        "items": items
    }
    return payload

# Seed sales
for _ in tqdm(range(100), desc="Seeding sales"):
    payload = generate_fake_sale()
    res = requests.post(f"{BASE_URL}/sales/", json=payload)
    if res.status_code != 200:
        print(f"❌ Failed to create sale: {res.status_code}, {res.text}")
