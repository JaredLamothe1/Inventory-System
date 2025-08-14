# app/models/password_reset.py
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(128), nullable=False, index=True)  # sha256 hex of the JWT
    expires_at = Column(DateTime, nullable=False, index=True)
    used = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="password_resets")

    def __repr__(self) -> str:  # optional, handy for debugging
        return f"<PasswordReset id={self.id} user_id={self.user_id} used={self.used}>"

# Optional composite index to speed up rate-limit lookups
Index("ix_password_resets_user_recent", PasswordReset.user_id, PasswordReset.created_at)
