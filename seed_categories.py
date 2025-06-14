import requests

categories = [
    {
        "name": "Sol Remedies",
        "default_sale_price": 90,
        "price_tiers": [
            {"min_qty": 1, "price": 45},
            {"min_qty": 50, "price": 42},
            {"min_qty": 100, "price": 37},
            {"min_qty": 150, "price": 32},
            {"min_qty": 200, "price": 27}
        ]
    },
    {
        "name": "CaSol Formulations",
        "default_sale_price": 100,
        "price_tiers": [
            {"min_qty": 1, "price": 55},
            {"min_qty": 50, "price": 52},
            {"min_qty": 100, "price": 47},
            {"min_qty": 150, "price": 42},
            {"min_qty": 200, "price": 37}
        ]
    },
    {
        "name": "Anti Formulations",
        "default_sale_price": 100,
        "price_tiers": [
            {"min_qty": 1, "price": 55},
            {"min_qty": 50, "price": 52},
            {"min_qty": 100, "price": 47},
            {"min_qty": 150, "price": 42},
            {"min_qty": 200, "price": 37}
        ]
    },
    {
        "name": "A Formulations",
        "default_sale_price": 125,
        "price_tiers": [
            {"min_qty": 1, "price": 78},
            {"min_qty": 50, "price": 73},
            {"min_qty": 100, "price": 63},
            {"min_qty": 150, "price": 55},
            {"min_qty": 200, "price": 45}
        ]
    },
    {
        "name": "ALG Formulations",
        "default_sale_price": 200,
        "price_tiers": [
            {"min_qty": 1, "price": 153},
            {"min_qty": 50, "price": 138},
            {"min_qty": 100, "price": 118},
            {"min_qty": 150, "price": 98},
            {"min_qty": 200, "price": 78}
        ]
    },
    {
        "name": "Other",
        "default_sale_price": 125,
        "price_tiers": [
            {"min_qty": 1, "price": 78},
            {"min_qty": 50, "price": 73},
            {"min_qty": 100, "price": 63},
            {"min_qty": 150, "price": 55},
            {"min_qty": 200, "price": 45}
        ]
    }
    
]

for category in categories:
    res = requests.post("http://127.0.0.1:8000/categories/", json=category)
    print(f"{category['name']}: {res.status_code} - {res.text}")
