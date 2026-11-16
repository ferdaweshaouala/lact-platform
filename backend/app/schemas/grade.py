from pydantic import BaseModel
from typing import Optional
from datetime import date


class GradeCreate(BaseModel):
    enrollment_id: int
    type: Optional[str] = None
    category_id: Optional[int] = None
    value: float
    max_value: Optional[float] = None
    session_number: Optional[int] = None
    date_recorded: Optional[date] = None


class GradeOut(BaseModel):
    grade_id: int
    enrollment_id: int
    type: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_kind: Optional[str] = None
    value: float
    max_value: Optional[float] = None
    session_number: Optional[int] = None
    date_recorded: Optional[date] = None

    class Config:
        from_attributes = True
