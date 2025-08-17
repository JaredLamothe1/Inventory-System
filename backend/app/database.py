# database.py
"""
Central SQLAlchemy setup:
- Reads DATABASE_URL from the environment.
- Forces sslmode=require for Render Postgres if missing.
- Exposes: engine, SessionLocal, Base, and get_db() for FastAPI deps.
"""

import os
from urllib.parse import urlparse, urlunparse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


def _require_ssl(url: str) -> str:
    """Ensure sslmode=require is present for Postgres connections (Render needs this)."""
    if not url or not url.startswith(("postgresql://", "postgresql+psycopg2://")):
        return url
    if "sslmode=" in url:
        return url
    return url + ("&sslmode=require" if "?" in url else "?sslmode=require")


def _mask_dsn(url: str) -> str:
    """Hide the password portion of the DSN for safe logging."""
    try:
        u = urlparse(url)
        if u.password:
            netloc = u.netloc.replace(f":{u.password}@", ":***@")
            u = u._replace(netloc=netloc)
        return urlunparse(u)
    except Exception:
        return "<unable to mask DSN>"


# ---- Load and validate DATABASE_URL -------------------------------------------------
DATABASE_URL = (
    os.getenv("DATABASE_URL")  # e.g. from Render
    or os.getenv("DB_URL")     # optional fallback
    or ""
)

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Provide a PostgreSQL DSN, e.g. "
        "postgresql://user:password@host/dbname?sslmode=require"
    )

DATABASE_URL = _require_ssl(DATABASE_URL)

# ---- Engine / Session / Base --------------------------------------------------------
# pool_pre_ping avoids stale connections on server restarts / network hiccups.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,  # SQLAlchemy 2.0-style
    # echo=True,  # uncomment for verbose SQL logging during local debugging
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    future=True,
)

# Single declarative base for all models. Import this Base in every model file.
Base = declarative_base()


# ---- FastAPI dependency --------------------------------------------------------------
def get_db():
    """
    Dependency that provides a DB session and ensures it's closed.
    Usage:
        from .database import get_db
        def endpoint(dep: Session = Depends(get_db)): ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---- Optional: lightweight startup log (safe; password masked) ----------------------
print(f"[database] Using DSN: { _mask_dsn(DATABASE_URL) }")

"""
NOTE:
- Do NOT import model modules here to avoid circular imports.
- To create tables on a fresh database, use a separate script (e.g. create_tables.py)
  that imports ALL your model modules (so they register on Base.metadata) and then calls:
      from database import Base, engine
      Base.metadata.create_all(bind=engine)
- 'create_all' only creates missing tables; it will NOT add new columns to existing tables.
  Use migrations (Alembic) or drop/recreate for schema changes.
"""
