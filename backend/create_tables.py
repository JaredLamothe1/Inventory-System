# create_tables.py
from app.database import Base, engine
# import every model module
import app.models 

Base.metadata.create_all(bind=engine)
print("Tables created:", list(Base.metadata.tables))
