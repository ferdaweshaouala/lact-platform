import re
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import date


_PHONE_RE = re.compile(r"^\+?[\d\s\-\(\)]{7,20}$")


class StudentCreate(BaseModel):
    first_name: str
    last_name: str
    student_number: str
    date_of_birth: Optional[date] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    city: Optional[str] = None
    profession: Optional[str] = None

    @field_validator("first_name", "last_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name fields cannot be empty")
        return v

    @field_validator("student_number")
    @classmethod
    def student_number_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Student number cannot be empty")
        return v

    @field_validator("phone_number")
    @classmethod
    def phone_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v and not _PHONE_RE.match(v):
                raise ValueError("Invalid phone number format")
        return v or None


class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    city: Optional[str] = None
    profession: Optional[str] = None

    @field_validator("first_name", "last_name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Name fields cannot be empty")
        return v

    @field_validator("phone_number")
    @classmethod
    def phone_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v and not _PHONE_RE.match(v):
                raise ValueError("Invalid phone number format")
        return v or None


class StudentOut(BaseModel):
    student_id: int
    first_name: str
    last_name: str
    student_number: str
    date_of_birth: Optional[date] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    city: Optional[str] = None
    profession: Optional[str] = None

    class Config:
        from_attributes = True
