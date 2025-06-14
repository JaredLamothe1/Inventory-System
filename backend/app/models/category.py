from sqlalchemy import Column, Integer, String, Float, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    # ✅ Renamed for clarity
    default_sale_price = Column(Float, nullable=True)

    # 📦 Used for vendor restocking tiers
    price_tiers = Column(JSON, nullable=True)

    products = relationship("Product", back_populates="category")

