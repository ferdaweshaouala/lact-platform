from pydantic import BaseModel, field_validator
from typing import Literal, Optional
from datetime import date


VALID_TYPES = {"online", "onsite"}
VALID_STATUSES = {"Active", "Inactive"}


class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    teacher_id: Optional[int] = None
    supervisor_id: Optional[int] = None
    course_type: Literal["online", "onsite"] = "onsite"
    total_sessions: Optional[int] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v

    @field_validator("total_sessions")
    @classmethod
    def sessions_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 1:
            raise ValueError("total_sessions must be a positive integer")
        return v

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: Optional[date], info) -> Optional[date]:
        start = info.data.get("start_date")
        if v and start and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    teacher_id: Optional[int] = None
    supervisor_id: Optional[int] = None
    status: Optional[Literal["Active", "Inactive"]] = None
    course_type: Optional[Literal["online", "onsite"]] = None
    total_sessions: Optional[int] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Title cannot be empty")
        return v

    @field_validator("total_sessions")
    @classmethod
    def sessions_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 1:
            raise ValueError("total_sessions must be a positive integer")
        return v


class CourseOut(BaseModel):
    course_id: int
    title: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str
    course_type: str = "onsite"
    total_sessions: Optional[int] = None
    teacher_id: Optional[int] = None
    supervisor_id: Optional[int] = None

    class Config:
        from_attributes = True
