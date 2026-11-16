from pydantic import BaseModel, EmailStr
from typing import Optional


class StudentRegisterSimple(BaseModel):
    """Minimal self-registration payload — the full survey (previous
    courses, children, etc.) will be added in a later step."""
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    phone_number: Optional[str] = None
    city: Optional[str] = None


class StudentRegisterOut(BaseModel):
    user_id: int
    student_id: int
    first_name: str
    last_name: str
    email: str
    role: str

    class Config:
        from_attributes = True
class StudentCreateBySupervisor(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone_number: Optional[str] = None
    city: Optional[str] = None
    course_id: Optional[int] = None  # يسجَّل مباشرة كـ "موافق عليها" لو تم تحديد دورة


class StudentCreateBySupervisorOut(BaseModel):
    user_id: int
    student_id: int
    first_name: str
    last_name: str
    email: str
    generated_password: str  # تظهر مرة واحدة فقط، خزّنيها الآن
    enrollment_id: Optional[int] = None