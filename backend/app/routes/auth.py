import uuid
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.models.user import User, InviteToken, RefreshTokenStore
from app.core.config import settings
from app.core.security import (
    verify_password, hash_password,
    create_access_token, create_refresh_token, decode_refresh_token,
    get_current_user, require_role, _utcnow,
)
from app.schemas.user import UserOut, TokenResponse, UserCreate, AcceptInvite
from app.core.email import send_invite_email
from app.core.limiter import limiter
from app.core.logging import get_logger
import secrets

router = APIRouter(prefix="/api/auth", tags=["Auth"])
log = get_logger("dtms.auth")


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set both auth cookies with consistent settings."""
    response.set_cookie(
        key="dtms_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="dtms_refresh",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        log.warning("login_failed", email=form_data.username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    token_data = {"sub": str(user.user_id), "role": user.role}
    access_token = create_access_token(token_data)

    # Create refresh token with a jti for server-side revocation
    jti = str(uuid.uuid4())
    refresh_token = create_refresh_token(token_data, jti)
    db.add(RefreshTokenStore(
        jti=jti,
        user_id=user.user_id,
        expires_at=_utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()

    _set_auth_cookies(response, access_token, refresh_token)

    log.info("login_success", user_id=user.user_id, role=user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "full_name": f"{user.first_name} {user.last_name}",
        "user_id": user.user_id,
    }


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Revoke the refresh token server-side before clearing cookies."""
    refresh_token = request.cookies.get("dtms_refresh")
    if refresh_token:
        try:
            payload = decode_refresh_token(refresh_token)
            jti = payload.get("jti")
            if jti:
                stored = db.query(RefreshTokenStore).filter(RefreshTokenStore.jti == jti).first()
                if stored:
                    stored.revoked = True
                    db.commit()
        except Exception:
            pass  # Invalid token — nothing to revoke, proceed with cookie clear

    response.delete_cookie("dtms_token")
    response.delete_cookie("dtms_refresh")
    return {"message": "Logged out"}


@router.post("/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """Issue a new access token + rotated refresh token from a valid refresh cookie.

    Rotation: the old jti is revoked and a new jti is minted. This means a stolen
    refresh token can only be used once before the legitimate user's next refresh
    invalidates it.
    """
    refresh_token = request.cookies.get("dtms_refresh")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_refresh_token(refresh_token)
    user_id = payload.get("sub")
    jti = payload.get("jti")

    if not user_id or not jti:
        raise HTTPException(status_code=401, detail="Invalid refresh token payload")

    # Validate jti exists in DB and is not revoked
    stored = db.query(RefreshTokenStore).filter(RefreshTokenStore.jti == jti).first()
    if not stored or stored.revoked or stored.expires_at < _utcnow():
        raise HTTPException(status_code=401, detail="Refresh token has been revoked or expired")

    user = db.query(User).filter(User.user_id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Rotate: revoke old jti, issue new one
    stored.revoked = True
    token_data = {"sub": str(user.user_id), "role": user.role}
    new_access = create_access_token(token_data)
    new_jti = str(uuid.uuid4())
    new_refresh = create_refresh_token(token_data, new_jti)
    db.add(RefreshTokenStore(
        jti=new_jti,
        user_id=user.user_id,
        expires_at=_utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()

    _set_auth_cookies(response, new_access, new_refresh)
    return {"message": "Token refreshed"}


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    data: UserCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    """Create a new user. Admin only — use /api/users/ for the same operation."""
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        role=data.role,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
def me(current_user=Depends(get_current_user)):
    return current_user


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


def _send_reset_safe(to_email: str, to_name: str, reset_link: str) -> None:
    try:
        send_invite_email(to_email=to_email, to_name=to_name, invite_link=reset_link, is_reset=True)
    except Exception:
        pass


@router.post("/forgot-password", status_code=200)
@limiter.limit("5/minute")
def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Self-service password reset. Always returns 200 to prevent email enumeration."""
    user = db.query(User).filter(User.email == data.email).first()
    if user:
        db.query(InviteToken).filter(
            InviteToken.user_id == user.user_id,
            InviteToken.used == False,  # noqa: E712
        ).delete()
        raw_token = secrets.token_urlsafe(32)
        invite = InviteToken(
            token=raw_token,
            user_id=user.user_id,
            expires_at=_utcnow() + timedelta(hours=1),
        )
        db.add(invite)
        db.commit()
        reset_link = f"{settings.FRONTEND_URL}/invite/{raw_token}"
        background_tasks.add_task(
            _send_reset_safe,
            user.email,
            f"{user.first_name} {user.last_name}",
            reset_link,
        )
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/accept-invite", response_model=UserOut)
def accept_invite(data: AcceptInvite, db: Session = Depends(get_db)):
    invite = db.query(InviteToken).filter(InviteToken.token == data.token).first()
    if not invite or invite.used or invite.expires_at < _utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired invite token")
    user = db.query(User).filter(User.user_id == invite.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(data.password)
    invite.used = True
    db.commit()
    db.refresh(user)
    return user
