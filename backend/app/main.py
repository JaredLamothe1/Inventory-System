# app/main.py
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load settings + DB
from app.config import settings
from app.database import Base, engine

# Ensure all SQLAlchemy models are registered before creating tables
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

app = FastAPI(title="Inventory Backend")

# ---------- CORS ----------
# Primary FE URL from env (e.g. https://yourapp.vercel.app or a custom domain)
frontend = (getattr(settings, "FRONTEND_URL", "") or "").strip().rstrip("/")

# Optional extra origins (comma-separated), e.g. "https://staging.example.com,https://foo.vercel.app"
extra_origins = [
    o.strip()
    for o in (os.getenv("CORS_ORIGINS") or "").split(",")
    if o.strip()
]

# Always allow local dev Vite ports
default_locals = ["http://localhost:5173", "http://127.0.0.1:5173"]

# Merge and de-dup
allow_origins = list({*(default_locals + ([frontend] if frontend else []) + extra_origins)})

# Allow any *.vercel.app (preview deployments etc.)
allow_origin_regex = r"^https://.*\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=False,  # using Bearer tokens, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Routers ----------
app.include_router(category.router)
app.include_router(product.router)
app.include_router(purchase_order.router)
app.include_router(bulk_discount.router)
app.include_router(sale.router)
app.include_router(reorder.router)
app.include_router(inventory_log.router)
app.include_router(auth_router)
app.include_router(product_collections_router)

# ---------- Health ----------
@app.get("/")
def read_root():
    return {"message": "Inventory backend is running!"}

# ---------- Dev-only table creation ----------
# (Safe for local SQLite; on Render you rely on Alembic)
db_url = (getattr(settings, "DATABASE_URL", "") or os.getenv("DATABASE_URL", "")).lower()
if db_url.startswith("sqlite"):
    Base.metadata.create_all(bind=engine)
