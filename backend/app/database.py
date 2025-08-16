# app/database.py
import os
from pathlib import Path
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# ---------------- Env ----------------
# Load .env sitting in backend/ (adjust if yours lives elsewhere)
BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")

APP_ENV = os.getenv("APP_ENV", os.getenv("ENV", "development")).lower()
DATABASE_URL = "postgresql://inventory_main_user:LsaUGSRqODVxHD64tnrOlJO06yaxUCue@dpg-d2f59ebuibrs73fa6qu0-a.virginia-postgres.render.com/inventory_main"

# Only used in dev if DATABASE_URL is blank
DEV_DB_PATH = os.getenv(
    "DEV_DB_PATH",
    r"C:/Users/JLamo/Documents/Inventory-System/test.db"  # <- change once, done
)

# Optional safety: ensure we don't silently create/use another sqlite file
DEV_GUARD = os.getenv("DEV_GUARD", "true").lower() == "true"

# ---------------- Pick the URL ----------------
if not DATABASE_URL:
    # Fall back to local sqlite file
    DATABASE_URL = f"sqlite:///{Path(DEV_DB_PATH).as_posix()}"

# ---------------- Engine ----------------
is_sqlite = DATABASE_URL.startswith("sqlite")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if is_sqlite else {},
    pool_pre_ping=True,
)

# ---------------- Debug / Guard ----------------
print(f"[DB] APP_ENV={APP_ENV}")
print(f"[DB] DATABASE_URL={DATABASE_URL}")

if is_sqlite:
    db_file = Path(DATABASE_URL.replace("sqlite:///", ""))
    resolved = db_file.resolve()
    print(f"[DB] RESOLVED SQLITE PATH={resolved}")

    if APP_ENV == "development" and DEV_GUARD:
        expected = Path(DEV_DB_PATH).resolve()
        if resolved != expected:
            raise RuntimeError(f"[DB] WRONG SQLITE FILE! {resolved} != {expected}\n"
                               f"Set DEV_DB_PATH correctly or disable DEV_GUARD.")

# ---------------- Session / Base ----------------
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
