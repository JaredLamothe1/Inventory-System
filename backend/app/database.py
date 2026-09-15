# backend/app/database.py

"""
Central SQLAlchemy setup.

- Production / Render:
    Uses DATABASE_URL and requires SSL.

- Development / local:
    Uses DATABASE_URL from backend/.env.
    Example: local PostgreSQL inventory_test database.

- Legacy fallback:
    If no DATABASE_URL is provided in development,
    falls back to SQLite test.db.
"""

import os
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings


def _require_ssl(url: str) -> str:
    """Add sslmode=require to PostgreSQL URLs when needed."""
    if not url or not url.startswith(
        ("postgresql://", "postgresql+psycopg2://")
    ):
        return url

    if "sslmode=" in url:
        return url

    return url + ("&sslmode=require" if "?" in url else "?sslmode=require")


def _mask_dsn(url: str) -> str:
    """Hide database password when printing the connection URL."""
    try:
        u = urlparse(url)

        if u.password:
            netloc = u.netloc.replace(
                f":{u.password}@",
                ":***@",
            )
            u = u._replace(netloc=netloc)

        return urlunparse(u)

    except Exception:
        return "<unable to mask DSN>"


def _sqlite_url_from_repo_root(default_name: str = "test.db") -> str:
    """Legacy development fallback."""
    repo_root = Path(__file__).resolve().parents[2]
    db_path = repo_root / default_name

    return f"sqlite:///{db_path.as_posix()}"


# ---------------------------------------------------------
# Resolve environment
# ---------------------------------------------------------

app_env = (settings.APP_ENV or "development").lower()
is_production = app_env in ("production", "prod")


# ---------------------------------------------------------
# Resolve database URL
# ---------------------------------------------------------

dsn = (
    settings.DATABASE_URL
    or os.getenv("DATABASE_URL")
    or os.getenv("DB_URL")
)


# Development fallback if DATABASE_URL isn't configured
if not dsn:
    if not is_production:

        if settings.DEV_DB_PATH:
            dev_path = Path(
                settings.DEV_DB_PATH
            ).expanduser().resolve()

            dsn = f"sqlite:///{dev_path.as_posix()}"

        else:
            dsn = _sqlite_url_from_repo_root("test.db")

    else:
        raise RuntimeError(
            "DATABASE_URL must be set in production."
        )


# ---------------------------------------------------------
# Production PostgreSQL requires SSL.
# Local PostgreSQL does NOT force SSL.
# ---------------------------------------------------------

if is_production:
    dsn = _require_ssl(dsn)


# ---------------------------------------------------------
# SQLAlchemy
# ---------------------------------------------------------

is_sqlite = dsn.startswith("sqlite:///")

engine = create_engine(
    dsn,
    pool_pre_ping=True,
    future=True,
    connect_args={
        "check_same_thread": False
    } if is_sqlite else {},
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    future=True,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


print(
    f"[database] Environment: {app_env} | "
    f"Using DSN: {_mask_dsn(dsn)}"
)