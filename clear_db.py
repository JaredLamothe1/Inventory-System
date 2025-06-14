"""
Completely empties the public schema of the Render database.

Usage:
    $ python clear_db.py
"""

from sqlalchemy import create_engine, text, inspect

# Directly set your Render external database URL
DATABASE_URL = "postgresql://inventory_db_1p4a_user:SOfdcvtmx5H1V08LmmIRqQT2seMZeM0p@dpg-d16gfhgdl3ps739bqr00-a.oregon-postgres.render.com/inventory_db_1p4a"

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set! Aborting for safety.")

engine = create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT")

def truncate_everything():
    with engine.connect() as conn:
        # Temporarily disable foreign key checks
        conn.execute(text("SET session_replication_role = 'replica';"))

        inspector = inspect(conn)
        tables = inspector.get_table_names(schema="public")

        if not tables:
            print("✅ Database already empty.")
            return

        print(f"🔪 Truncating {len(tables)} tables …")
        for tbl in tables:
            conn.execute(
                text(
                    f'TRUNCATE TABLE public."{tbl}" RESTART IDENTITY CASCADE;'
                )
            )

        # Re-enable foreign key checks
        conn.execute(text("SET session_replication_role = 'origin';"))

    print("🎉 All data wiped and identity columns reset.")

if __name__ == "__main__":
    truncate_everything()
