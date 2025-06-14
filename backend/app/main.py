from fastapi import FastAPI
from app.routes import vendor
from app.routes import product
from app.routes import purchase_order
from app.routes import bulk_discount
from app.routes import sale
from app.routes import reorder
from app.models import inventory_log
from app.routes import inventory_log
from fastapi.middleware.cors import CORSMiddleware
from app.routes import category




app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify the exact domain, e.g., ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(category.router)
app.include_router(vendor.router)
app.include_router(product.router)
app.include_router(purchase_order.router)
app.include_router(bulk_discount.router)
app.include_router(sale.router)
app.include_router(reorder.router)
app.include_router(inventory_log.router)

@app.get("/")
def read_root():
    return {"message": "Inventory backend is running!"}
from app.database import Base, engine
from app.models import vendor, product

Base.metadata.create_all(bind=engine)
