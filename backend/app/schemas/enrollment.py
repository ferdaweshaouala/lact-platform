from pydantic import BaseModel
from typing import Optional
from datetime import date


class EnrollmentCreate(BaseModel):
    student_id: int
    course_id: int
    enrollment_date: Optional[date] = None
class EnrollmentUpdate(BaseModel):
    completion_status: Optional[str] = None
    approval_status: Optional[str] = None
    absences: Optional[int] = None
    attendance_count: Optional[int] = None
    makeup_count: Optional[int] = None

class EnrollmentOut(BaseModel):
    enrollment_id: int
    student_id: int
    course_id: int
    enrollment_date: Optional[date] = None
    completion_status: str
    approval_status: str   # جديد
    absences: int = 0
    attendance_count: int = 0
    makeup_count: int = 0

    class Config:
        from_attributes = True
