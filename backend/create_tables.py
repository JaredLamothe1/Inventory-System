# backend/create_tables.py
from app.database import Base, engine
import app.models  # <-- ensure all models are imported

print(f"DB URL: {engine.url}")  # <-- shows exactly which database the engine targets
Base.metadata.create_all(bind=engine)
print("Tables created:", sorted(Base.metadata.tables))
