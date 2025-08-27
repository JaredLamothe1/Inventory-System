# backend/scripts/patch_flat_fee.py
from sqlalchemy import text
from app.database import engine

def is_sqlite(conn): return conn.dialect.name == "sqlite"

def col_exists(conn, table, col):
    if is_sqlite(conn):
        return any(r[1] == col for r in conn.execute(text(f"PRAGMA table_info({table})")).fetchall())
    return False

def add_col(conn, table, col, ddl_sqlite):
    if not col_exists(conn, table, col):
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl_sqlite}"))
        print(f"✅ Added {table}.{col}")
    else:
        print(f"ℹ️  {table}.{col} already exists")

if __name__ == "__main__":
    with engine.begin() as c:
        print("Dialect:", c.dialect.name)
        print("DB URL:", engine.url)
        if not is_sqlite(c):
            raise SystemExit("This script is for local SQLite only.")

        # Add the new flat fee column on users
        add_col(c, "users", "credit_card_fee_flat",
                "credit_card_fee_flat REAL NOT NULL DEFAULT 0.0")

        # Ensure sales.processing_fee exists too
        add_col(c, "sales", "processing_fee",
                "processing_fee REAL NOT NULL DEFAULT 0.0")

        # Belt & suspenders: no NULLs
        c.execute(text("UPDATE users SET credit_card_fee_flat = 0.0 WHERE credit_card_fee_flat IS NULL"))
        c.execute(text("UPDATE sales SET processing_fee = 0.0 WHERE processing_fee IS NULL"))
