from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# ── Core user models ──────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
   CheckConstraint(
        "role IN ('admin', 'teacher', 'supervisor', 'student')",
        name="ck_user_role",
    ),
)

    user_id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    role = Column(String, nullable=False)           # admin / teacher / supervisor
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, server_default="true")
    courses = relationship("Course", back_populates="teacher", foreign_keys="Course.teacher_id")
    supervised_courses = relationship("Course", back_populates="supervisor", foreign_keys="Course.supervisor_id")
    sessions = relationship("Session", back_populates="teacher")


class InviteToken(Base):
    __tablename__ = "invite_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")


class RefreshTokenStore(Base):
    """Server-side refresh token registry for revocation support.

    Every issued refresh token has a UUID jti embedded in its JWT payload.
    On logout or token rotation, the jti is marked revoked here. The /refresh
    endpoint validates the jti against this table before issuing a new token pair.
    This prevents stolen refresh tokens from being used after logout or after
    the legitimate user has already rotated them (detect-on-use revocation).

    Expired rows are pruned by the weekly scheduler job to keep the table small.
    """
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String, unique=True, nullable=False, index=True)   # UUID4 embedded in JWT
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User")


__all__ = [
    "User", "InviteToken", "RefreshTokenStore",
]
