"""Compensation requests — makeup requests submitted by students via the Telegram bot.

Supervisors and admins can list and review (accept / reject) requests.
Teachers can view requests for their courses.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.models.telegram import CompensationRequest
from app.models.course import Course
from app.core.security import get_current_user

router = APIRouter(tags=["Compensation Requests"])


def _out(r: CompensationRequest) -> dict:
    return {
        "id": r.id,
        "student_id": r.student_id,
        "student_name": f"{r.student.first_name} {r.student.last_name}" if r.student else "—",
        "course_id": r.course_id,
        "course_title": r.course.title if r.course else "—",
        "content_id": r.content_id,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        "notes": r.notes,
    }


@router.get("/api/compensation-requests/")
def list_requests(
    status: Optional[str] = None,   # filter by pending / accepted / rejected
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(CompensationRequest)

    if current_user.role == "teacher":
        q = q.join(Course).filter(Course.teacher_id == current_user.user_id)
    elif current_user.role == "supervisor":
        q = q.join(Course).filter(Course.supervisor_id == current_user.user_id)

    if status:
        q = q.filter(CompensationRequest.status == status)
    if course_id:
        q = q.filter(CompensationRequest.course_id == course_id)

    requests = q.order_by(CompensationRequest.created_at.desc()).limit(100).all()
    return [_out(r) for r in requests]


class ReviewRequest(BaseModel):
    status: str          # accepted / rejected
    notes: Optional[str] = None


@router.patch("/api/compensation-requests/{request_id}/review")
def review_request(
    request_id: int,
    data: ReviewRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if data.status not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'accepted' or 'rejected'")

    if current_user.role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="Only admins and supervisors can review requests")

    req = db.query(CompensationRequest).filter(CompensationRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if current_user.role == "supervisor":
        course = db.query(Course).filter(
            Course.course_id == req.course_id,
            Course.supervisor_id == current_user.user_id,
        ).first()
        if not course:
            raise HTTPException(status_code=403, detail="Not your course")

    req.status = data.status
    req.notes = data.notes
    req.reviewed_at = datetime.utcnow()
    req.reviewed_by = current_user.user_id
    db.commit()
    db.refresh(req)
    return _out(req)
