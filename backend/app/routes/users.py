from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import secrets
from datetime import timedelta
from app.core.database import get_db
from app.models.user import User, InviteToken
from app.schemas.user import UserCreate, UserOut, UserUpdate, InviteTokenOut
from app.core.security import get_current_user, require_role, hash_password, _utcnow
from app.core.config import settings
from app.core.email import send_invite_email

router = APIRouter(prefix="/api/users", tags=["Users"])


# Admin + supervisor: list all users (supervisors need it for course assignments)
@router.get("/", response_model=List[UserOut])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    return db.query(User).offset(skip).limit(limit).all()


# Admin only: get single user
@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# Admin only: create user (password optional — use invite flow if omitted)
@router.post("/", response_model=UserOut, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    # Use a placeholder hash when no password provided; invite flow will set the real one
    pw_hash = hash_password(data.password) if data.password else hash_password(secrets.token_hex(32))
    user = User(
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        role=data.role,
        password_hash=pw_hash,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _send_invite_safe(to_email: str, to_name: str, invite_link: str, is_reset: bool) -> None:
    """Background-task wrapper that swallows SMTP errors so they don't surface."""
    try:
        send_invite_email(to_email=to_email, to_name=to_name, invite_link=invite_link, is_reset=is_reset)
    except Exception:
        pass


# Admin only: generate a one-time invite link for a user and email it
@router.post("/{user_id}/invite", response_model=InviteTokenOut, status_code=201)
def create_invite(
    user_id: int,
    background_tasks: BackgroundTasks,
    reset: bool = False,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Invalidate any previous unused tokens for this user
    db.query(InviteToken).filter(InviteToken.user_id == user_id, InviteToken.used == False).delete()
    raw_token = secrets.token_urlsafe(32)
    invite = InviteToken(
        token=raw_token,
        user_id=user_id,
        expires_at=_utcnow() + (timedelta(hours=1) if reset else timedelta(days=7)),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    # Email is sent in the background so a slow/blocked SMTP can't hang the request.
    invite_link = f"{settings.FRONTEND_URL}/invite/{raw_token}"
    background_tasks.add_task(
        _send_invite_safe,
        user.email,
        f"{user.first_name} {user.last_name}",
        invite_link,
        reset,
    )

    return invite


# Admin only: update user
@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.first_name: user.first_name = data.first_name
    if data.last_name: user.last_name = data.last_name
    if data.email: user.email = data.email
    if data.role: user.role = data.role
    if data.password: user.password_hash = hash_password(data.password)
    db.commit()
    db.refresh(user)
    return user


# Admin only: delete user
@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(user)
    db.commit()
