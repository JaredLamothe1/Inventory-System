# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Make sure all SQLAlchemy mappers are registered
import app.models  # noqa: F401

# Routers
from app.routes import (
    product,
    purchase_order,
    bulk_discount,
    sale,
    reorder,
    category,
    inventory_log,
)
from app.routes.auth import router as auth_router
from app.routes.product_collection import router as product_collections_router

from app.database import Base, engine


app = FastAPI()

# CORS (tweak origins for prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(category.router)
app.include_router(product.router)
app.include_router(purchase_order.router)
app.include_router(bulk_discount.router)
app.include_router(sale.router)
app.include_router(reorder.router)
app.include_router(inventory_log.router)
app.include_router(auth_router)
app.include_router(product_collections_router)  # <-- collections router

@app.get("/")
def read_root():
    return {"message": "Inventory backend is running!"}

# Dev-only: create tables if they don't exist
Base.metadata.create_all(bind=engine)
