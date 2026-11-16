"""Course notes — threaded messaging between teacher and supervisor.

Teacher posts session reports; supervisor replies with instructions or questions;
teacher can reply back. Admins see everything.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.note import CourseNote
from app.models.course import Course
from app.core.security import get_current_user

router = APIRouter(tags=["Notes"])


def _reply_out(n: CourseNote) -> dict:
    return {
        "id": n.id,
        "content": n.content,
        "parent_id": n.parent_id,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "author_name": f"{n.author.first_name} {n.author.last_name}" if n.author else "—",
        "author_role": n.author.role if n.author else "—",
    }


def _note_out(n: CourseNote, course_title: str = "") -> dict:
    return {
        "id": n.id,
        "course_id": n.course_id,
        "course_title": course_title,
        "content": n.content,
        "parent_id": n.parent_id,
        "curriculum_session_id": n.curriculum_session_id,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "author_name": f"{n.author.first_name} {n.author.last_name}" if n.author else "—",
        "author_role": n.author.role if n.author else "—",
        "replies": [_reply_out(r) for r in (n.replies or [])],
    }


def _check_access(db: Session, course_id: int, current_user):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role == "teacher" and course.teacher_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")
    if current_user.role == "supervisor" and course.supervisor_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")
    return course


class NoteCreate(BaseModel):
    content: str
    curriculum_session_id: Optional[int] = None
    parent_id: Optional[int] = None


class ReplyCreate(BaseModel):
    content: str


@router.get("/api/notes/recent")
def list_recent_notes(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return recent top-level notes (no replies) across all courses the user is linked to."""
    q = (
        db.query(CourseNote)
        .join(Course, Course.course_id == CourseNote.course_id)
        .filter(CourseNote.parent_id.is_(None))  # only top-level notes
    )

    if current_user.role == "teacher":
        q = q.filter(Course.teacher_id == current_user.user_id)
    elif current_user.role == "supervisor":
        q = q.filter(Course.supervisor_id == current_user.user_id)

    notes = q.order_by(CourseNote.created_at.desc()).limit(limit).all()
    course_ids = list({n.course_id for n in notes})
    courses = (
        {c.course_id: c for c in db.query(Course).filter(Course.course_id.in_(course_ids)).all()}
        if course_ids else {}
    )
    return [_note_out(n, courses.get(n.course_id, Course()).title or "") for n in notes]


@router.get("/api/courses/{course_id}/notes/")
def list_notes(
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    course = _check_access(db, course_id, current_user)
    notes = (
        db.query(CourseNote)
        .filter(CourseNote.course_id == course_id, CourseNote.parent_id.is_(None))
        .order_by(CourseNote.created_at.desc())
        .limit(50)
        .all()
    )
    return [_note_out(n, course.title) for n in notes]


@router.post("/api/courses/{course_id}/notes/", status_code=201)
def create_note(
    course_id: int,
    data: NoteCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    course = _check_access(db, course_id, current_user)
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Note content cannot be empty")

    # Validate parent belongs to this course
    if data.parent_id is not None:
        parent = db.query(CourseNote).filter(
            CourseNote.id == data.parent_id,
            CourseNote.course_id == course_id,
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent note not found")

    note = CourseNote(
        course_id=course_id,
        author_id=current_user.user_id,
        content=data.content.strip(),
        curriculum_session_id=data.curriculum_session_id,
        parent_id=data.parent_id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_out(note, course.title)


@router.post("/api/notes/{note_id}/reply", status_code=201)
def reply_to_note(
    note_id: int,
    data: ReplyCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Post a reply to a note. Accessible to the teacher or supervisor linked to that course."""
    parent = db.query(CourseNote).filter(CourseNote.id == note_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Note not found")

    course = _check_access(db, parent.course_id, current_user)

    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Reply cannot be empty")

    reply = CourseNote(
        course_id=parent.course_id,
        author_id=current_user.user_id,
        content=data.content.strip(),
        curriculum_session_id=parent.curriculum_session_id,
        parent_id=parent.id,
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return _reply_out(reply)


@router.delete("/api/courses/{course_id}/notes/{note_id}", status_code=204)
def delete_note(
    course_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    note = db.query(CourseNote).filter(
        CourseNote.id == note_id,
        CourseNote.course_id == course_id,
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Admins can delete anything.
    # Authors can delete their own notes.
    # Supervisors can delete any note in a course they supervise.
    is_admin = current_user.role == "admin"
    is_author = note.author_id == current_user.user_id
    is_course_supervisor = (
        current_user.role == "supervisor" and
        db.query(Course).filter(
            Course.course_id == course_id,
            Course.supervisor_id == current_user.user_id,
        ).first() is not None
    )

    if not (is_admin or is_author or is_course_supervisor):
        raise HTTPException(status_code=403, detail="Cannot delete someone else's note")

    db.delete(note)
    db.commit()
