"""Submissions — homework/files sent by students via the Telegram bot.

Teachers can list and grade submissions for their courses.
Admins can see everything.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.models.telegram import Submission
from app.models.course import Course
from app.models.student import Student
from app.core.security import get_current_user

router = APIRouter(tags=["Submissions"])


def _out(s: Submission) -> dict:
    return {
        "id": s.id,
        "student_id": s.student_id,
        "student_name": f"{s.student.first_name} {s.student.last_name}" if s.student else "—",
        "course_id": s.course_id,
        "content_id": s.content_id,
        "file_id": s.file_id,
        "file_name": s.file_name,
        "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
        "grade": s.grade,
        "feedback": s.feedback,
        "graded_at": s.graded_at.isoformat() if s.graded_at else None,
    }


@router.get("/api/courses/{course_id}/submissions/")
def list_submissions(
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role == "teacher" and course.teacher_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")

    submissions = (
        db.query(Submission)
        .filter(Submission.course_id == course_id)
        .order_by(Submission.submitted_at.desc())
        .all()
    )
    return [_out(s) for s in submissions]


class GradeSubmission(BaseModel):
    grade: float
    feedback: Optional[str] = None


@router.get("/api/students/{student_id}/submissions/")
def list_student_submissions(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """All submissions for a specific student, across all courses."""
    submissions = (
        db.query(Submission)
        .filter(Submission.student_id == student_id)
        .order_by(Submission.submitted_at.desc())
        .all()
    )
    return [_out(s) for s in submissions]


@router.patch("/api/submissions/{submission_id}/grade")
def grade_submission(
    submission_id: int,
    data: GradeSubmission,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    course = db.query(Course).filter(Course.course_id == sub.course_id).first()
    if current_user.role == "teacher" and course.teacher_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")

    sub.grade = data.grade
    sub.feedback = data.feedback
    sub.graded_at = datetime.utcnow()
    db.commit()
    db.refresh(sub)
    return _out(sub)
