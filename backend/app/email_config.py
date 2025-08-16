# app/email_config.py
from typing import Optional
from pydantic import EmailStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from fastapi_mail import FastMail, ConnectionConfig

class Settings(BaseSettings):
    # Local dev can still use .env in backend/
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Master switch — leave False on Render until you add SMTP envs
    EMAIL_ENABLED: bool = False

    MAIL_USERNAME: Optional[str] = None
    MAIL_PASSWORD: Optional[str] = None
    MAIL_FROM: Optional[EmailStr] = None
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_FROM_NAME: str = "Your App Name"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False

settings = Settings()

def get_fastmail() -> Optional[FastMail]:
    """Return a FastMail instance if email is enabled and fully configured; else None."""
    if not settings.EMAIL_ENABLED:
        return None
    if not (settings.MAIL_USERNAME and settings.MAIL_PASSWORD and settings.MAIL_FROM):
        return None

    conf = ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
        MAIL_STARTTLS=settings.MAIL_STARTTLS,
        MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )
    return FastMail(conf)
