from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.models.course import Course

router = APIRouter(prefix="/api/courses", tags=["Course Schedule"])


class WorkshopScheduleUpdate(BaseModel):
    workshop_day: Optional[str] = None   # "Thursday" أو "الخميس"
    workshop_time: Optional[str] = None  # "19:00"


@router.patch("/{course_id}/workshop-schedule")
def set_workshop_schedule(
    course_id: int,
    data: WorkshopScheduleUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if data.workshop_day is not None:
        course.workshop_day = data.workshop_day
    if data.workshop_time is not None:
        course.workshop_time = data.workshop_time

    db.commit()
    return {"course_id": course.course_id, "workshop_day": course.workshop_day, "workshop_time": course.workshop_time}