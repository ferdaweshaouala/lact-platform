from datetime import date as date_type
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case  # func: sessions query; case: trend aggregation
from pydantic import BaseModel

from app.core.database import get_db
from app.models.attendance import AttendanceRecord
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.student import Student
from app.core.security import get_current_user, require_role
from app.services.attendance import recompute_counters
from app.core.logging import get_logger

log = get_logger("dtms.attendance")

router = APIRouter(prefix="/api/courses/{course_id}/attendance", tags=["Attendance"])


Status = Literal["present", "absent", "makeup"]


class AttendanceUpsert(BaseModel):
    enrollment_id: int
    status: Status
    notes: Optional[str] = None


class AttendanceBulkRequest(BaseModel):
    session_date: date_type
    records: list[AttendanceUpsert]


def _ensure_course_access(db: Session, course_id: int, current_user) -> Course:
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role == "teacher" and course.teacher_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")
    if current_user.role == "supervisor" and course.supervisor_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")
    return course


@router.get("/")
def list_attendance(
    course_id: int,
    session_date: Optional[date_type] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns the roster for a course with each student's status for the given date
    (or `null` if no record exists yet). If session_date is omitted, returns ALL records
    for the course grouped by date.
    """
    _ensure_course_access(db, course_id, current_user)

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.course_id == course_id)
        .all()
    )
    student_ids = [e.student_id for e in enrollments]
    students = {s.student_id: s for s in db.query(Student).filter(Student.student_id.in_(student_ids)).all()} if student_ids else {}

    if session_date is not None:
        records = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.enrollment_id.in_([e.enrollment_id for e in enrollments]),
                AttendanceRecord.session_date == session_date,
            )
            .all()
        ) if enrollments else []
        rec_by_enrollment = {r.enrollment_id: r for r in records}
        roster = []
        for e in enrollments:
            s = students.get(e.student_id)
            r = rec_by_enrollment.get(e.enrollment_id)
            roster.append({
                "enrollment_id": e.enrollment_id,
                "student_id": e.student_id,
                "first_name": s.first_name if s else "",
                "last_name": s.last_name if s else "",
                "student_number": s.student_number if s else "",
                "status": r.status if r else None,
                "notes": r.notes if r else None,
            })
        roster.sort(key=lambda r: (r["first_name"], r["last_name"]))
        return {"session_date": session_date.isoformat(), "roster": roster}

    # No date — return list of all distinct session dates for this course
    dates = (
        db.query(AttendanceRecord.session_date, func.count(AttendanceRecord.id))
        .join(Enrollment, Enrollment.enrollment_id == AttendanceRecord.enrollment_id)
        .filter(Enrollment.course_id == course_id)
        .group_by(AttendanceRecord.session_date)
        .order_by(AttendanceRecord.session_date.desc())
        .all()
    )
    return {"sessions": [{"session_date": d.isoformat(), "records": int(n)} for d, n in dates]}


@router.get("/trend")
def get_attendance_trend(
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Per-session-date present/absent/makeup counts for a course (date-based attendance only).

    Used by the attendance trend line chart. Returns data sorted chronologically.
    Only includes dates that have at least one record.
    """
    _ensure_course_access(db, course_id, current_user)

    rows = (
        db.query(
            AttendanceRecord.session_date,
            func.sum(case((AttendanceRecord.status == "present", 1), else_=0)).label("present"),
            func.sum(case((AttendanceRecord.status == "absent", 1), else_=0)).label("absent"),
            func.sum(case((AttendanceRecord.status == "makeup", 1), else_=0)).label("makeup"),
        )
        .join(Enrollment, Enrollment.enrollment_id == AttendanceRecord.enrollment_id)
        .filter(Enrollment.course_id == course_id)
        .group_by(AttendanceRecord.session_date)
        .order_by(AttendanceRecord.session_date)
        .all()
    )

    return [
        {
            "date": r.session_date.isoformat(),
            "present": int(r.present or 0),
            "absent": int(r.absent or 0),
            "makeup": int(r.makeup or 0),
        }
        for r in rows
    ]


@router.post("/")
def upsert_attendance(
    course_id: int,
    data: AttendanceBulkRequest,
    db: Session = Depends(get_db),
    _=Depends(require_role("supervisor", "teacher")),
):
    """Atomic bulk upsert for one session_date. Recomputes per-enrollment counters."""
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    valid_enrollment_ids = {
        e.enrollment_id for e in db.query(Enrollment).filter(Enrollment.course_id == course_id).all()
    }
    bad = [r.enrollment_id for r in data.records if r.enrollment_id not in valid_enrollment_ids]
    if bad:
        raise HTTPException(status_code=400, detail=f"Enrollment ids not in this course: {bad}")

    try:
        for r in data.records:
            existing = (
                db.query(AttendanceRecord)
                .filter(
                    AttendanceRecord.enrollment_id == r.enrollment_id,
                    AttendanceRecord.session_date == data.session_date,
                )
                .first()
            )
            if existing:
                existing.status = r.status
                existing.notes = r.notes
            else:
                db.add(AttendanceRecord(
                    enrollment_id=r.enrollment_id,
                    session_date=data.session_date,
                    status=r.status,
                    notes=r.notes,
                ))

        db.flush()
        recompute_counters(db, [r.enrollment_id for r in data.records])
        db.commit()
    except Exception as e:
        db.rollback()
        log.error("attendance_save_failed", course_id=course_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to save attendance. Please try again.")

    return {"saved": len(data.records), "session_date": data.session_date.isoformat()}
