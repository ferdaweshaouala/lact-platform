from pydantic import BaseModel
from typing import Optional
from datetime import date


class AvailableCourseOut(BaseModel):
    course_id: int
    title: str
    description: Optional[str] = None
    course_type: str

    class Config:
        from_attributes = True


class StudentEnrollRequest(BaseModel):
    course_id: int


class StudentEnrollmentOut(BaseModel):
    enrollment_id: int
    course_id: int
    course_title: str
    approval_status: str
    enrollment_date: Optional[date] = None

    class Config:
        from_attributes = True