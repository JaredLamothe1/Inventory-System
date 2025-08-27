# backend/app/database.py
"""
Central SQLAlchemy setup with smart env switching:
- Prod/Render: use DATABASE_URL (Postgres), ensure sslmode=require.
- Dev/local:   fall back to SQLite test.db at repo root (or DEV_DB_PATH).
"""
import os
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

def _require_ssl(url: str) -> str:
    if not url or not url.startswith(("postgresql://", "postgresql+psycopg2://")):
        return url
    if "sslmode=" in url:
        return url
    return url + ("&sslmode=require" if "?" in url else "?sslmode=require")

def _mask_dsn(url: str) -> str:
    try:
        u = urlparse(url)
        if u.password:
            netloc = u.netloc.replace(f":{u.password}@", ":***@")
            u = u._replace(netloc=netloc)
        return urlunparse(u)
    except Exception:
        return "<unable to mask DSN>"

def _sqlite_url_from_repo_root(default_name: str = "test.db") -> str:
    # this file is repo/backend/app/database.py -> repo root is parents[2]
    repo_root = Path(__file__).resolve().parents[2]
    db_path = repo_root / default_name
    return f"sqlite:///{db_path.as_posix()}"

# Resolve DSN
dsn = settings.DATABASE_URL or os.getenv("DATABASE_URL") or os.getenv("DB_URL")

if not dsn:
    if (settings.APP_ENV or "").lower().startswith("dev"):
        if settings.DEV_DB_PATH:
            dev_path = Path(settings.DEV_DB_PATH).expanduser().resolve()
            dsn = f"sqlite:///{dev_path.as_posix()}"
        else:
            dsn = _sqlite_url_from_repo_root("test.db")
    else:
        raise RuntimeError(
            "DATABASE_URL is not set. For local dev, set APP_ENV=development "
            "and optionally DEV_DB_PATH, or provide DATABASE_URL."
        )

dsn = _require_ssl(dsn)
is_sqlite = dsn.startswith("sqlite:///")

engine = create_engine(
    dsn,
    pool_pre_ping=True,
    future=True,
    connect_args={"check_same_thread": False} if is_sqlite else {},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

print(f"[database] Using DSN: { _mask_dsn(dsn) }")
