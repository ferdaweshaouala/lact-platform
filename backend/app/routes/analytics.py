from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, case
from app.core.database import get_db
from app.core.security import require_role
from app.services.analytics import (
    fetch_summary,
    fetch_teacher_summary,
    fetch_courses_breakdown,
    fetch_teachers_breakdown,
    fetch_at_risk_students,
    fetch_inactive_students,
    fetch_absent_yesterday,
)
from app.models.enrollment import Enrollment
from app.models.student import Student
from app.models.course import Course
from app.models.grade import Grade
from app.models.telegram import Submission, CompensationRequest
from app.models.curriculum import CurriculumSession, CurriculumAttendance

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "supervisor")),
):
    return fetch_summary(db, current_user)


@router.get("/inactive")
def get_inactive_students(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor")),
):
    """Ongoing enrollments with no grade activity in the last N days, scoped to supervisor."""
    return fetch_inactive_students(db, current_user.user_id, days)


@router.get("/courses")
def get_courses_breakdown(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "supervisor")),
):
    """Per-course enrollment breakdown. Admins see all courses; supervisors see their own."""
    return fetch_courses_breakdown(db, current_user)


@router.get("/teachers")
def get_teachers_breakdown(
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    """Per-teacher performance breakdown for the admin analytics page."""
    return fetch_teachers_breakdown(db)


@router.get("/report")
def get_enrollment_report(
    skip: int = Query(default=0, ge=0, description="Number of records to skip"),
    limit: int = Query(default=100, ge=1, le=500, description="Max records to return (1-500)"),
    course_id: int | None = Query(default=None, description="Filter by course"),
    status: str | None = Query(default=None, description="Filter by completion_status"),
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    """Paginated enriched enrollment list for the admin reports page."""
    base = (
        db.query(
            Enrollment.enrollment_id,
            Student.first_name,
            Student.last_name,
            Student.student_number,
            Course.title.label("course_title"),
            Enrollment.enrollment_date,
            Enrollment.completion_status,
            sqlfunc.avg(Grade.value).label("avg_grade"),
            sqlfunc.count(Grade.grade_id).label("grade_count"),
        )
        .join(Student, Student.student_id == Enrollment.student_id)
        .join(Course, Course.course_id == Enrollment.course_id)
        .outerjoin(Grade, Grade.enrollment_id == Enrollment.enrollment_id)
        .group_by(
            Enrollment.enrollment_id, Student.first_name, Student.last_name,
            Student.student_number, Course.title, Enrollment.enrollment_date,
            Enrollment.completion_status,
        )
    )
    if course_id is not None:
        base = base.filter(Enrollment.course_id == course_id)
    if status is not None:
        base = base.filter(Enrollment.completion_status == status)

    total = base.count()
    rows = base.order_by(Course.title, Student.last_name, Student.first_name).offset(skip).limit(limit).all()

    return {
        "total": total, "skip": skip, "limit": limit,
        "items": [
            {
                "enrollment_id": r.enrollment_id,
                "student_name": f"{r.first_name} {r.last_name}".strip(),
                "student_number": r.student_number,
                "course_title": r.course_title,
                "enrollment_date": r.enrollment_date.isoformat() if r.enrollment_date else None,
                "completion_status": r.completion_status,
                "avg_grade": round(r.avg_grade, 1) if r.avg_grade else None,
                "grade_count": r.grade_count or 0,
            }
            for r in rows
        ],
    }


@router.get("/teacher")
def get_teacher_summary(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("teacher", "admin", "supervisor")),
):
    return fetch_teacher_summary(db, current_user.user_id)


@router.get("/at-risk")
def get_at_risk_students(
    threshold: float = 50.0,
    limit: int = Query(default=200, ge=1, le=500, description="Max at-risk rows to return"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "supervisor", "teacher")),
):
    """Ongoing enrollments whose computed total grade % is below `threshold`."""
    return fetch_at_risk_students(db, current_user, threshold, limit)


@router.get("/absent-yesterday")
def get_absent_yesterday(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor", "admin")),
):
    """Students absent in yesterday's sessions, scoped to supervisor (admin sees all)."""
    return fetch_absent_yesterday(db, current_user)


# ── Bulk curriculum stats (replaces per-course N+1 fan-out) ──────────────────

@router.get("/curriculum-stats")
def get_curriculum_stats_bulk(
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    """Curriculum progress for all courses in 2 queries.

    Returns { course_id: { total_sessions, sessions_with_records } }
    """
    totals = (
        db.query(
            CurriculumSession.course_id,
            sqlfunc.count(CurriculumSession.id).label("total_sessions"),
        )
        .group_by(CurriculumSession.course_id)
        .all()
    )
    recorded = (
        db.query(
            CurriculumSession.course_id,
            sqlfunc.count(sqlfunc.distinct(CurriculumAttendance.curriculum_session_id)).label("sessions_with_records"),
        )
        .join(CurriculumAttendance, CurriculumAttendance.curriculum_session_id == CurriculumSession.id)
        .group_by(CurriculumSession.course_id)
        .all()
    )
    recorded_map = {r.course_id: r.sessions_with_records for r in recorded}
    return {
        r.course_id: {
            "total_sessions": r.total_sessions,
            "sessions_with_records": recorded_map.get(r.course_id, 0),
        }
        for r in totals
    }


# ── Bot integration analytics ─────────────────────────────────────────────────

@router.get("/bot/submissions")
def get_submissions_analytics(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "supervisor", "teacher")),
):
    """Submissions summary + per-course breakdown. Scoped by role."""
    q = (
        db.query(
            Course.course_id,
            Course.title,
            sqlfunc.count(Submission.id).label("total"),
            sqlfunc.count(case((Submission.grade.isnot(None), Submission.id))).label("graded"),
        )
        .join(Submission, Submission.course_id == Course.course_id)
        .group_by(Course.course_id, Course.title)
    )
    if current_user.role == "teacher":
        q = q.filter(Course.teacher_id == current_user.user_id)
    elif current_user.role == "supervisor":
        q = q.filter(Course.supervisor_id == current_user.user_id)

    rows = q.all()
    by_course = [
        {
            "course_id": r.course_id,
            "title": r.title,
            "total": r.total,
            "graded": r.graded,
            "ungraded": r.total - r.graded,
        }
        for r in rows
    ]
    total = sum(r.total for r in rows)
    graded = sum(r.graded for r in rows)
    return {"total": total, "graded": graded, "ungraded": total - graded, "by_course": by_course}


@router.get("/bot/compensation")
def get_compensation_analytics(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "supervisor", "teacher")),
):
    """Compensation requests summary + per-course breakdown. Scoped by role."""
    q = (
        db.query(
            Course.course_id,
            Course.title,
            sqlfunc.count(case((CompensationRequest.status == "pending",  CompensationRequest.id))).label("pending"),
            sqlfunc.count(case((CompensationRequest.status == "accepted", CompensationRequest.id))).label("accepted"),
            sqlfunc.count(case((CompensationRequest.status == "rejected", CompensationRequest.id))).label("rejected"),
        )
        .join(CompensationRequest, CompensationRequest.course_id == Course.course_id)
        .group_by(Course.course_id, Course.title)
    )
    if current_user.role == "teacher":
        q = q.filter(Course.teacher_id == current_user.user_id)
    elif current_user.role == "supervisor":
        q = q.filter(Course.supervisor_id == current_user.user_id)

    rows = q.all()
    by_course = [
        {
            "course_id": r.course_id,
            "title": r.title,
            "pending": r.pending,
            "accepted": r.accepted,
            "rejected": r.rejected,
        }
        for r in rows
    ]
    pending  = sum(r.pending  for r in rows)
    accepted = sum(r.accepted for r in rows)
    rejected = sum(r.rejected for r in rows)
    return {
        "total": pending + accepted + rejected,
        "pending": pending,
        "accepted": accepted,
        "rejected": rejected,
        "by_course": by_course,
    }

