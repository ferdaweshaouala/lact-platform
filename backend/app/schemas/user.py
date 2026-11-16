from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum
from datetime import datetime


class RoleEnum(str, Enum):
    admin = "admin"
    teacher = "teacher"
    supervisor = "supervisor"
    student = "student"


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: Optional[str] = None
    role: RoleEnum


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[RoleEnum] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    email: str
    role: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str
    user_id: int


class InviteTokenOut(BaseModel):
    token: str
    expires_at: datetime

    class Config:
        from_attributes = True


class AcceptInvite(BaseModel):
    token: str
    password: str
