from datetime import datetime, timedelta
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi_mail import MessageSchema
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils import verify_password, create_access_token, hash_password, sha256_hex
from app.models.user import User
from app.models.password_reset import PasswordReset
from app.config import settings
from app.email_config import get_fastmail

# ---------------------------------------------------------------------
# Config (fallbacks if not in .env/settings)
# ---------------------------------------------------------------------
FRONTEND_URL: str = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
TOKEN_EXPIRE_MIN: int = getattr(settings, "RESET_TOKEN_MINUTES", 15)
RATE_LIMIT_MAX: int = getattr(settings, "RESET_RATE_LIMIT_MAX", 3)
RATE_LIMIT_WINDOW: timedelta = timedelta(
    minutes=getattr(settings, "RESET_RATE_LIMIT_WINDOW_MIN", 60)
)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

# ---------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------
class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


class AdminResetPasswordIn(BaseModel):
    username: str
    new_password: str


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class ResetPasswordWithTokenIn(BaseModel):
    token: str
    new_password: str


class MeOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    is_admin: bool


class UpdateMeIn(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise unauthorized
    except JWTError:
        raise unauthorized

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise unauthorized
    return user


# ---------------------------------------------------------------------
# Auth & Account Endpoints
# ---------------------------------------------------------------------
@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=MeOut)
def read_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_admin": current_user.is_admin,
    }


@router.patch("/me", response_model=MeOut)
def update_me(
    payload: UpdateMeIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip() or None

    if payload.email is not None:
        new_email = payload.email.strip().lower()
        exists = (
            db.query(User)
            .filter(func.lower(User.email) == new_email, User.id != current_user.id)
            .first()
        )
        if exists:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = new_email

    db.commit()
    db.refresh(current_user)
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_admin": current_user.is_admin,
    }


@router.post("/change-password")
def change_password(
    data: ChangePasswordIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Old password is incorrect")

    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated successfully."}


@router.post("/admin-reset-password")
def admin_reset_password(
    data: AdminResetPasswordIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Only admin can reset other users' passwords")

    user = db.query(User).filter(User.username == data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": f"Password for {data.username} reset by admin."}


@router.post("/request-password-reset")
async def request_password_reset(
    payload: PasswordResetRequestIn,
    db: Session = Depends(get_db),
):
    clean_email = payload.email.strip().lower().strip("'\"")
    user = db.query(User).filter(func.lower(User.email) == clean_email).first()

    generic_msg = {"message": "If this email exists, a reset link was sent."}
    if not user:
        return generic_msg

    # Rate limit by user/email
    cutoff = datetime.utcnow() - RATE_LIMIT_WINDOW
    recent_count = (
        db.query(PasswordReset)
        .filter(PasswordReset.user_id == user.id)
        .filter(PasswordReset.created_at >= cutoff)
        .count()
    )
    if recent_count >= RATE_LIMIT_MAX:
        # same generic message to avoid enumeration
        raise HTTPException(status_code=429, detail=generic_msg["message"])

    # Create JWT with unique jti
    jti = str(uuid4())
    expires_delta = timedelta(minutes=TOKEN_EXPIRE_MIN)
    reset_token = create_access_token(
        data={"sub": user.username, "jti": jti},
        expires_delta=expires_delta,
    )

    # Store hashed token (single-use)
    pr = PasswordReset(
        user_id=user.id,
        token_hash=sha256_hex(reset_token),
        expires_at=datetime.utcnow() + expires_delta,
    )
    db.add(pr)
    db.commit()

    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"

    message = MessageSchema(
        subject="Password Reset Request - AcuTrack",
        recipients=[clean_email],
        body=(
            f"Click the link to reset your password:\n\n{reset_link}\n\n"
            f"This link expires in {TOKEN_EXPIRE_MIN} minutes."
        ),
        subtype="plain",
    )
    fm = get_fastmail()
    if fm:
      await fm.send_message(message)


    return generic_msg


@router.post("/reset-password-with-token")
def reset_password_with_token(data: ResetPasswordWithTokenIn, db: Session = Depends(get_db)):
    raw_token = (data.token or "").strip().strip("'\"").replace(" ", "+")

    try:
        payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str | None = payload.get("sub")
        jti: str | None = payload.get("jti")
        if not username or not jti:
            raise HTTPException(status_code=400, detail="Invalid token payload")
    except ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid token")

    token_hash = sha256_hex(raw_token)
    pr = (
        db.query(PasswordReset)
        .join(User, User.id == PasswordReset.user_id)
        .filter(User.username == username)
        .filter(PasswordReset.token_hash == token_hash)
        .first()
    )
    if not pr or pr.used or pr.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or already used token")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(data.new_password)
    pr.used = True
    db.commit()

    return {"message": "Password reset successfully."}


@router.get("/test-email")
async def test_email():
    message = MessageSchema(
        subject="Test Email from AcuTrack",
        recipients=["you@example.com"],
        body="This is a test email to confirm SMTP is set up correctly!",
        subtype="plain",
    )
    await fm.send_message(message)
    return {"message": "Test email sent. Check your inbox."}
