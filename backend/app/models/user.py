# ... imports unchanged ...
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Legacy percent (keep if you already added it; safe to ignore in code)
    credit_card_fee_percent = Column(Float, nullable=False, server_default="0.0")

    # NEW: flat dollar amount per sale when using credit_card
    credit_card_fee_flat = Column(Float, nullable=False, server_default="0.0")

    password_resets = relationship(
        "PasswordReset",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
