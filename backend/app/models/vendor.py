# Import SQLAlchemy tools to define columns and data types
from sqlalchemy import Column, Integer, String, Text
# Import the Base class from our project to define models
from app.database import Base

# Define a Vendor class that represents the 'vendors' table in the database
class Vendor(Base):
    __tablename__ = "vendors"  # Set the table name to 'vendors'

    # Primary key column, automatically increases for each new vendor
    id = Column(Integer, primary_key=True, index=True)

    # Required vendor name, must be unique
    name = Column(String, unique=True, nullable=False)

    # Optional vendor contact info
    contact_email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    # Optional text field for notes or comments
    notes = Column(Text, nullable=True)
