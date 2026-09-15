# init_db.py
from app.database import Base, engine
from app.models import user  # ensure models are imported so tables register

Base.metadata.create_all(bind=engine)
print("Tables created.")
