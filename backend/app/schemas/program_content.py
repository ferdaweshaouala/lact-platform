from pydantic import BaseModel
from typing import Optional, List, Literal


class WeekItemCreate(BaseModel):
    order: int
    item_type: str
    title: str
    description: Optional[str] = None
    video_url: Optional[str] = None
    pre_quiz_form_url: Optional[str] = None
    post_quiz_form_url: Optional[str] = None
    is_required: bool = True


class WeekItemOut(BaseModel):
    id: int
    order: int
    item_type: str
    title: str
    description: Optional[str] = None
    video_url: Optional[str] = None
    pre_quiz_form_url: Optional[str] = None
    post_quiz_form_url: Optional[str] = None
    is_required: bool

    class Config:
        from_attributes = True


class ProgramWeekCreate(BaseModel):
    week_number: int
    title: str
    items: List[WeekItemCreate] = []


class ProgramWeekOut(BaseModel):
    id: int
    week_number: int
    title: str
    is_visible: bool
    items: List[WeekItemOut] = []

    class Config:
        from_attributes = True


class LectureStepsOut(BaseModel):
    watched: bool = False
    notes_written: bool = False
    sent_to_bot: bool = False


class WeekItemProgressOut(BaseModel):
    item: WeekItemOut
    completed: bool
    steps: Optional[LectureStepsOut] = None

    class Config:
        from_attributes = True


class LectureStepUpdate(BaseModel):
    step: Literal["watched", "notes_written", "sent_to_bot", "all"]
    completed: bool = True


class ProgramCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProgramOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    course_ids: List[int] = []
