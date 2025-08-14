# app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # ---- Core auth / JWT ----
    SECRET_KEY: str = Field(..., min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ---- Env / URLs ----
    APP_ENV: str = "development"
    DEV_MODE: bool = True
    FRONTEND_URL: str = "http://localhost:5173"

    # ---- Database ----
    DATABASE_URL: str | None = None
    DEV_DB_PATH: str | None = None
    DEV_GUARD: bool = True

    # ---- Mail (FastAPI-Mail) ----
    MAIL_USERNAME: str | None = None
    MAIL_PASSWORD: str | None = None
    MAIL_FROM: str | None = None
    MAIL_FROM_NAME: str | None = None
    MAIL_SERVER: str | None = None
    MAIL_PORT: int = 587
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    MAIL_SUPPRESS_SEND: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True

    # Allow extra env vars silently
    model_config = SettingsConfigDict(
        env_file="backend/.env",
        case_sensitive=False,
        extra="ignore",   # or "allow"
    )

settings = Settings()
