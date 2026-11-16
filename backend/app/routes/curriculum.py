"""Curriculum session management and curriculum-based attendance.

Curriculum sessions represent planned sessions drawn from the study plan (المخطط).
Each session is a lecture or workshop. Attendance is tracked per enrollment per session.
"""
from datetime import date as date_type
from typing import Literal, Optional
import json
import re
import io
import unicodedata
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from pydantic import BaseModel

from app.core.database import get_db
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.student import Student
from app.models.curriculum import CurriculumSession, CurriculumAttendance
from app.core.security import get_current_user, require_role
from app.services.attendance import recompute_from_curriculum

router = APIRouter(prefix="/api/courses/{course_id}/curriculum", tags=["Curriculum"])

# ── Template ──────────────────────────────────────────────────────────────────
# 12-week structure for دبلومة صناعة الطفل القرآني المستوى الأول
# 59 institutional lectures + 12 interactive workshops = 71 total sessions.

_TEMPLATE_PATH = Path(__file__).parent.parent / "data" / "diploma_template.json"

def _load_template_data() -> dict:
    with _TEMPLATE_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _build_diploma_template():
    data = _load_template_data()
    lectures_per_week: dict[str, int] = data["lectures_per_week"]
    known_lectures: dict[str, list[str]] = data["lectures"]
    known_workshops: dict[str, str] = data["workshops"]

    sessions = []
    order = 1
    lecture_counter = 1

    for week in range(1, 13):
        week_key = str(week)
        count = lectures_per_week.get(week_key, 5)
        known = known_lectures.get(week_key, [])

        for i in range(count):
            title = known[i] if i < len(known) else f"ح {lecture_counter}: محاضرة {lecture_counter}"
            sessions.append({
                "week_number": week,
                "session_type": "lecture",
                "title": title,
                "order_index": order,
            })
            lecture_counter += 1
            order += 1

        workshop_title = known_workshops.get(week_key, f"الورشة التفاعلية - الأسبوع {week}")
        sessions.append({
            "week_number": week,
            "session_type": "workshop",
            "title": workshop_title,
            "order_index": order,
        })
        order += 1

    return sessions

# Load template data once at module init.
# JSON keys are strings — normalise to int so existing code needs no changes.
_tpl = _load_template_data()
_KNOWN_LECTURES: dict[int, list[str]] = {int(k): v for k, v in _tpl["lectures"].items()}
_KNOWN_WORKSHOPS: dict[int, str]      = {int(k): v for k, v in _tpl["workshops"].items()}
del _tpl

DIPLOMA_TEMPLATE = _build_diploma_template()

# Build a flat lookup: lecture_number → (week_number, full_title)
# Used by the PDF parser to resolve scrambled text by lecture number alone.
_LECTURE_LOOKUP: dict[int, tuple[int, str]] = {}
for _week, _titles in _KNOWN_LECTURES.items():
    for _t in _titles:
        _m = re.match(r"ح\s*(\d+)", _t)
        if _m:
            _LECTURE_LOOKUP[int(_m.group(1))] = (_week, _t)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_access(db: Session, course_id: int, current_user) -> Course:
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role == "teacher" and course.teacher_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")
    if current_user.role == "supervisor" and course.supervisor_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")
    return course


def _session_out(s: CurriculumSession, has_records: bool = False):
    return {
        "id": s.id,
        "course_id": s.course_id,
        "week_number": s.week_number,
        "session_type": s.session_type,
        "title": s.title,
        "order_index": s.order_index,
        "has_records": has_records,
    }


# ── Schemas ───────────────────────────────────────────────────────────────────

class CurriculumSessionCreate(BaseModel):
    week_number: int
    session_type: Literal["lecture", "workshop"]
    title: str
    order_index: int = 0


class CurriculumSessionUpdate(BaseModel):
    title: Optional[str] = None
    week_number: Optional[int] = None
    session_type: Optional[Literal["lecture", "workshop"]] = None
    order_index: Optional[int] = None


class CurriculumAttendanceUpsert(BaseModel):
    enrollment_id: int
    status: Literal["present", "absent", "makeup"]
    notes: Optional[str] = None
    followed_up: Optional[bool] = None


class FollowUpToggle(BaseModel):
    followed_up: bool
    notes: Optional[str] = None


class CurriculumAttendanceBulk(BaseModel):
    date_recorded: Optional[date_type] = None
    records: list[CurriculumAttendanceUpsert]


# ── Session CRUD ──────────────────────────────────────────────────────────────

@router.get("/")
def list_curriculum(
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _ensure_access(db, course_id, current_user)
    sessions = (
        db.query(CurriculumSession)
        .filter(CurriculumSession.course_id == course_id)
        .order_by(CurriculumSession.order_index)
        .all()
    )
    # Determine which sessions already have attendance records
    session_ids = [s.id for s in sessions]
    recorded_ids: set[int] = set()
    if session_ids:
        rows = (
            db.query(CurriculumAttendance.curriculum_session_id)
            .filter(CurriculumAttendance.curriculum_session_id.in_(session_ids))
            .distinct()
            .all()
        )
        recorded_ids = {r[0] for r in rows}
    return [_session_out(s, has_records=s.id in recorded_ids) for s in sessions]


@router.post("/", status_code=201)
def create_curriculum_session(
    course_id: int,
    data: CurriculumSessionCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    s = CurriculumSession(course_id=course_id, **data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return _session_out(s)


@router.patch("/{session_id}")
def update_curriculum_session(
    course_id: int,
    session_id: int,
    data: CurriculumSessionUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    s = db.query(CurriculumSession).filter(
        CurriculumSession.id == session_id,
        CurriculumSession.course_id == course_id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return _session_out(s)


@router.delete("/{session_id}", status_code=204)
def delete_curriculum_session(
    course_id: int,
    session_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    s = db.query(CurriculumSession).filter(
        CurriculumSession.id == session_id,
        CurriculumSession.course_id == course_id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(s)
    db.commit()


@router.post("/import-template", status_code=201)
def import_diploma_template(
    course_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    """Apply the standard 12-week diploma مخطط template to this course.
    Clears any existing curriculum sessions first.
    """
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    db.query(CurriculumSession).filter(CurriculumSession.course_id == course_id).delete(synchronize_session=False)

    for item in DIPLOMA_TEMPLATE:
        db.add(CurriculumSession(course_id=course_id, **item))

    db.commit()
    return {"created": len(DIPLOMA_TEMPLATE)}


# ── Curriculum Attendance ─────────────────────────────────────────────────────

@router.get("/{session_id}/attendance")
def get_curriculum_attendance(
    course_id: int,
    session_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the full roster with each student's status for this curriculum session."""
    _ensure_access(db, course_id, current_user)

    s = db.query(CurriculumSession).filter(
        CurriculumSession.id == session_id,
        CurriculumSession.course_id == course_id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    enrollments = db.query(Enrollment).filter(Enrollment.course_id == course_id).all()
    student_ids = [e.student_id for e in enrollments]
    students = {
        st.student_id: st
        for st in db.query(Student).filter(Student.student_id.in_(student_ids)).all()
    } if student_ids else {}

    records = {
        r.enrollment_id: r
        for r in db.query(CurriculumAttendance).filter(
            CurriculumAttendance.curriculum_session_id == session_id,
            CurriculumAttendance.enrollment_id.in_([e.enrollment_id for e in enrollments]),
        ).all()
    }

    roster = []
    for e in enrollments:
        st = students.get(e.student_id)
        r = records.get(e.enrollment_id)
        roster.append({
            "enrollment_id": e.enrollment_id,
            "student_id": e.student_id,
            "first_name": st.first_name if st else "",
            "last_name": st.last_name if st else "",
            "student_number": st.student_number if st else "",
            "status": r.status if r else None,
            "notes": r.notes if r else None,
        })
    roster.sort(key=lambda x: (x["first_name"], x["last_name"]))
    return {"session": _session_out(s), "roster": roster}


def _update_completion_status(db: Session, course_id: int, enrollment_ids: list[int]) -> list[int]:
    """Auto-set enrollment status to Completed when a student has present/makeup
    for every curriculum session in the course.  Reverts to Ongoing if attendance
    is corrected downward after a previous auto-completion.

    Returns list of enrollment_ids that were changed to Completed.
    """
    total_sessions = (
        db.query(func.count(CurriculumSession.id))
        .filter(CurriculumSession.course_id == course_id)
        .scalar() or 0
    )
    if total_sessions == 0:
        return []

    newly_completed: list[int] = []
    for enrollment_id in enrollment_ids:
        attended = (
            db.query(func.count(CurriculumAttendance.id))
            .join(CurriculumSession, CurriculumSession.id == CurriculumAttendance.curriculum_session_id)
            .filter(
                CurriculumSession.course_id == course_id,
                CurriculumAttendance.enrollment_id == enrollment_id,
                CurriculumAttendance.status.in_(["present", "makeup"]),
            )
            .scalar() or 0
        )
        enr = db.query(Enrollment).filter(Enrollment.enrollment_id == enrollment_id).first()
        if not enr:
            continue
        if attended >= total_sessions and enr.completion_status != "Completed":
            enr.completion_status = "Completed"
            newly_completed.append(enrollment_id)
        elif attended < total_sessions and enr.completion_status == "Completed":
            # Attendance was corrected — revert to Ongoing
            enr.completion_status = "Ongoing"
    return newly_completed


@router.post("/{session_id}/attendance")
def save_curriculum_attendance(
    course_id: int,
    session_id: int,
    data: CurriculumAttendanceBulk,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor", "teacher")),
):
    """Bulk upsert attendance for one curriculum session."""
    s = db.query(CurriculumSession).filter(
        CurriculumSession.id == session_id,
        CurriculumSession.course_id == course_id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    valid_enrollment_ids = {
        e.enrollment_id
        for e in db.query(Enrollment).filter(Enrollment.course_id == course_id).all()
    }
    bad = [r.enrollment_id for r in data.records if r.enrollment_id not in valid_enrollment_ids]
    if bad:
        raise HTTPException(status_code=400, detail=f"Enrollment ids not in this course: {bad}")

    recorded_date = data.date_recorded or date_type.today()

    for r in data.records:
        existing = db.query(CurriculumAttendance).filter(
            CurriculumAttendance.enrollment_id == r.enrollment_id,
            CurriculumAttendance.curriculum_session_id == session_id,
        ).first()
        if existing:
            existing.status = r.status
            existing.notes = r.notes
            existing.date_recorded = recorded_date
            if r.followed_up is not None:
                existing.followed_up = r.followed_up
        else:
            db.add(CurriculumAttendance(
                enrollment_id=r.enrollment_id,
                curriculum_session_id=session_id,
                status=r.status,
                notes=r.notes,
                date_recorded=recorded_date,
                followed_up=r.followed_up or False,
            ))

    enrollment_ids = [r.enrollment_id for r in data.records]

    # Sync denormalised counters (absences / attendance_count / makeup_count)
    # from CurriculumAttendance so at-risk and other features see correct values.
    recompute_from_curriculum(db, enrollment_ids)

    # Auto-update enrollment completion status based on attendance
    newly_completed = _update_completion_status(db, course_id, enrollment_ids)

    db.commit()

    return {
        "saved": len(data.records),
        "session_id": session_id,
        "newly_completed": newly_completed,
    }


@router.patch("/{session_id}/attendance/{enrollment_id}/follow-up")
def toggle_follow_up(
    course_id: int,
    session_id: int,
    enrollment_id: int,
    data: FollowUpToggle,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    """Toggle the 'followed up' flag for one absent student in one session."""
    record = db.query(CurriculumAttendance).filter(
        CurriculumAttendance.curriculum_session_id == session_id,
        CurriculumAttendance.enrollment_id == enrollment_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    record.followed_up = data.followed_up
    if data.notes is not None:
        record.notes = data.notes
    db.commit()
    return {"enrollment_id": enrollment_id, "followed_up": record.followed_up}


@router.get("/weekly-suivi")
def get_weekly_suivi(
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Per-week tracking view for supervisors.

    Returns each week with:
    - sessions planned and how many have attendance records
    - for each week, list of absent students with follow-up status
    - overall week health: all_clear / needs_followup / not_started
    """
    from app.models.enrollment import Enrollment
    from app.models.student import Student
    _ensure_access(db, course_id, current_user)

    sessions = (
        db.query(CurriculumSession)
        .filter(CurriculumSession.course_id == course_id)
        .order_by(CurriculumSession.week_number, CurriculumSession.order_index)
        .all()
    )
    if not sessions:
        return {"weeks": []}

    # All attendance records for this course
    session_ids = [s.id for s in sessions]
    att_records = (
        db.query(CurriculumAttendance)
        .filter(CurriculumAttendance.curriculum_session_id.in_(session_ids))
        .all()
    )

    # Build lookup: session_id → set of enrollment_ids that have records
    recorded_sessions: set[int] = {r.curriculum_session_id for r in att_records}

    # Build lookup: (session_id, enrollment_id) → record
    att_map: dict[tuple[int, int], CurriculumAttendance] = {
        (r.curriculum_session_id, r.enrollment_id): r for r in att_records
    }

    # Students enrolled
    enrollments = db.query(Enrollment).filter(Enrollment.course_id == course_id).all()
    student_ids = [e.student_id for e in enrollments]
    students = {
        s.student_id: s
        for s in db.query(Student).filter(Student.student_id.in_(student_ids)).all()
    } if student_ids else {}
    enr_map = {e.enrollment_id: e for e in enrollments}

    # Group sessions by week
    from collections import defaultdict
    weeks_sessions: dict[int, list[CurriculumSession]] = defaultdict(list)
    for s in sessions:
        weeks_sessions[s.week_number].append(s)

    weeks = []
    for week_num in sorted(weeks_sessions.keys()):
        week_sessions = weeks_sessions[week_num]
        total = len(week_sessions)
        recorded = sum(1 for s in week_sessions if s.id in recorded_sessions)

        # Absent students this week (across all sessions in this week)
        absent_map: dict[int, dict] = {}  # enrollment_id → data
        for s in week_sessions:
            for enr in enrollments:
                rec = att_map.get((s.id, enr.enrollment_id))
                if rec and rec.status == "absent":
                    if enr.enrollment_id not in absent_map:
                        st = students.get(enr.student_id)
                        absent_map[enr.enrollment_id] = {
                            "enrollment_id": enr.enrollment_id,
                            "student_name": f"{st.first_name} {st.last_name}" if st else "—",
                            "student_number": st.student_number if st else "—",
                            "phone_number": getattr(st, "phone_number", None),
                            "absent_sessions": [],
                            "followed_up": True,   # will AND with all records
                        }
                    absent_map[enr.enrollment_id]["absent_sessions"].append({
                        "session_id": s.id,
                        "title": s.title,
                        "followed_up": rec.followed_up,
                        "notes": rec.notes,
                    })
                    # If ANY absence is not followed up, the student needs follow-up
                    if not rec.followed_up:
                        absent_map[enr.enrollment_id]["followed_up"] = False

        absent_students = list(absent_map.values())

        # Week status
        if recorded == 0:
            status = "not_started"
        elif len(absent_students) == 0:
            status = "all_clear"
        elif all(s["followed_up"] for s in absent_students):
            status = "followed_up"
        else:
            status = "needs_action"

        weeks.append({
            "week_number": week_num,
            "total_sessions": total,
            "recorded_sessions": recorded,
            "absent_students": absent_students,
            "status": status,   # not_started | all_clear | followed_up | needs_action
        })

    return {"weeks": weeks}


@router.get("/last-session")
def get_last_session(
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the most recently recorded curriculum session with its attendance summary.

    Used by the teacher dashboard to show "last session" info: title, week,
    date, present/absent/makeup counts, and list of absent students.
    Returns null if no attendance has been recorded yet.
    """
    from app.models.enrollment import Enrollment
    from app.models.student import Student

    _ensure_access(db, course_id, current_user)

    # Find the curriculum session whose attendance was most recently recorded
    last = (
        db.query(
            CurriculumAttendance.curriculum_session_id,
            func.max(CurriculumAttendance.date_recorded).label("last_date"),
        )
        .join(CurriculumSession, CurriculumSession.id == CurriculumAttendance.curriculum_session_id)
        .filter(CurriculumSession.course_id == course_id)
        .group_by(CurriculumAttendance.curriculum_session_id)
        .order_by(func.max(CurriculumAttendance.date_recorded).desc())
        .first()
    )

    if not last:
        return None

    session_id = last.curriculum_session_id
    session = db.query(CurriculumSession).filter(CurriculumSession.id == session_id).first()
    if not session:
        return None

    # Count attendance statuses for this session
    counts = (
        db.query(
            func.sum(case((CurriculumAttendance.status == "present", 1), else_=0)).label("present"),
            func.sum(case((CurriculumAttendance.status == "absent", 1), else_=0)).label("absent"),
            func.sum(case((CurriculumAttendance.status == "makeup", 1), else_=0)).label("makeup"),
        )
        .filter(CurriculumAttendance.curriculum_session_id == session_id)
        .first()
    )

    # Get the absent students by name
    absent_records = (
        db.query(CurriculumAttendance)
        .filter(
            CurriculumAttendance.curriculum_session_id == session_id,
            CurriculumAttendance.status == "absent",
        )
        .all()
    )
    enr_ids = [r.enrollment_id for r in absent_records]
    enrollments = (
        {e.enrollment_id: e for e in db.query(Enrollment).filter(Enrollment.enrollment_id.in_(enr_ids)).all()}
        if enr_ids else {}
    )
    student_ids = [e.student_id for e in enrollments.values()]
    students = (
        {s.student_id: s for s in db.query(Student).filter(Student.student_id.in_(student_ids)).all()}
        if student_ids else {}
    )

    absent_students = []
    for r in absent_records:
        enr = enrollments.get(r.enrollment_id)
        if enr:
            st = students.get(enr.student_id)
            if st:
                absent_students.append({
                    "name": f"{st.first_name} {st.last_name}",
                    "student_number": st.student_number,
                    "notes": r.notes,
                })

    return {
        "session_id": session_id,
        "week_number": session.week_number,
        "title": session.title,
        "session_type": session.session_type,
        "date_recorded": last.last_date.isoformat() if last.last_date else None,
        "present": int(counts.present or 0),
        "absent": int(counts.absent or 0),
        "makeup": int(counts.makeup or 0),
        "absent_students": absent_students,
    }


@router.get("/stats")
def get_curriculum_stats(
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Per-enrollment attendance stats: sessions attended / total sessions.

    Single GROUP BY query — replaces the previous 2-queries-per-enrollment loop.
    Also returns sessions_with_records and sessions_without_records counts.
    """
    _ensure_access(db, course_id, current_user)

    total_sessions = (
        db.query(func.count(CurriculumSession.id))
        .filter(CurriculumSession.course_id == course_id)
        .scalar() or 0
    )

    # Count sessions that have at least one attendance record
    sessions_with_records = (
        db.query(func.count(func.distinct(CurriculumAttendance.curriculum_session_id)))
        .join(CurriculumSession, CurriculumSession.id == CurriculumAttendance.curriculum_session_id)
        .filter(CurriculumSession.course_id == course_id)
        .scalar() or 0
    )

    # Aggregate attended/absent counts for every enrollment in one query
    agg_rows = (
        db.query(
            CurriculumAttendance.enrollment_id,
            func.sum(
                case((CurriculumAttendance.status.in_(["present", "makeup"]), 1), else_=0)
            ).label("attended"),
            func.sum(
                case((CurriculumAttendance.status == "absent", 1), else_=0)
            ).label("absent"),
        )
        .join(CurriculumSession, CurriculumSession.id == CurriculumAttendance.curriculum_session_id)
        .filter(CurriculumSession.course_id == course_id)
        .group_by(CurriculumAttendance.enrollment_id)
        .all()
    )
    agg_by_enrollment = {r.enrollment_id: r for r in agg_rows}

    enrollments = db.query(Enrollment).filter(Enrollment.course_id == course_id).all()
    student_ids = [e.student_id for e in enrollments]
    students = {
        st.student_id: st
        for st in db.query(Student).filter(Student.student_id.in_(student_ids)).all()
    } if student_ids else {}

    result = []
    for e in enrollments:
        st = students.get(e.student_id)
        agg = agg_by_enrollment.get(e.enrollment_id)
        attended = int(agg.attended) if agg else 0
        absent = int(agg.absent) if agg else 0
        pct = round(attended / total_sessions * 100, 1) if total_sessions else 0
        result.append({
            "enrollment_id": e.enrollment_id,
            "student_name": f"{st.first_name} {st.last_name}" if st else "—",
            "student_number": st.student_number if st else "—",
            "attended": attended,
            "absent": absent,
            "total": total_sessions,
            "attendance_pct": pct,
        })
    result.sort(key=lambda x: x["student_name"])
    return {
        "total_sessions": total_sessions,
        "sessions_with_records": sessions_with_records,
        "sessions_without_records": max(0, total_sessions - sessions_with_records),
        "stats": result,
    }


# ── PDF extraction ────────────────────────────────────────────────────────────

# Arabic ordinal week names → week number
_WEEK_NAMES = {
    "الأول": 1, "الثاني": 2, "الثالث": 3, "الرابع": 4,
    "الخامس": 5, "السادس": 6, "السابع": 7, "الثامن": 8,
    "التاسع": 9, "العاشر": 10, "الحادي عشر": 11, "الثاني عشر": 12,
}

# Match lecture entries like "ح 1 لماذا ؟" or "ح1 لماذا"
_LECTURE_RE = re.compile(r"ح\s*(\d+)\s+(.+?)(?=ح\s*\d+|$)", re.DOTALL)

# Match week header (standalone Arabic ordinal)
_WEEK_RE = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(_WEEK_NAMES, key=len, reverse=True)) + r")\b"
)

# Workshop column keywords
_WORKSHOP_KEYWORDS = [
    "الورشة التفاعلية",
    "الورشة",
    "كتيب ومحاضرة",
]


def _normalize_arabic(text: str) -> str:
    """Normalize Arabic text: NFC, collapse whitespace, strip zero-width chars."""
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"[​-‏‪-‮﻿]", "", text)  # strip bidi marks
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _extract_all_text(data: bytes) -> str:
    """Extract all text from a PDF using PyMuPDF with proper Arabic RTL support.

    PyMuPDF (fitz) reads text in correct Unicode order, preserving Arabic directionality.
    'sort=True' forces reading order (top→bottom, right→left) matching visual layout.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise HTTPException(status_code=500, detail="PyMuPDF (pymupdf) is not installed")

    doc = fitz.open(stream=data, filetype="pdf")
    pages_text = []
    for page in doc:
        # "text" mode with sort=True gives reading-order text, best for Arabic tables
        text = page.get_text("text", sort=True)
        pages_text.append(text)
    doc.close()
    return _normalize_arabic("\n".join(pages_text))


def _parse_pdf_bytes(data: bytes) -> list[dict]:
    """Extract curriculum sessions from a مخطط PDF — works with any well-structured Arabic PDF.

    Strategy:
    ─────────
    1. Use PyMuPDF (not pdfplumber) which handles Arabic RTL Unicode correctly.
    2. Extract ALL text from every page in reading order.
    3. Scan for lecture markers: "ح N" where N is 1-99.
    4. Resolve each found lecture number against _LECTURE_LOOKUP (exact title from template).
       This makes the parser independent of surrounding text order — only the number matters.
    5. Detect week markers (Arabic ordinals) to add the corresponding workshop per week.
    6. For future مخططات that don't match our known lectures, fall back to extracting
       the title text that follows "ح N" in the raw text.
    """
    all_text = _extract_all_text(data)

    if not all_text.strip():
        return []  # Scanned/image PDF — no text layer at all

    sessions: list[dict] = []
    order = 1
    found_lecture_nums: set[int] = set()
    found_weeks: set[int] = set()

    # ── Pass 1: find all "ح N" lecture numbers ────────────────────────────────
    # Matches: ح7 / ح 7 / ح  7  (with optional spaces, number 1-99)
    for m in re.finditer(r"ح\s*(\d{1,2})(?!\d|:)", all_text):
        num = int(m.group(1))
        if 1 <= num <= 99:
            found_lecture_nums.add(num)

    # ── Pass 2: find week markers ─────────────────────────────────────────────
    for m in _WEEK_RE.finditer(all_text):
        week_num = _WEEK_NAMES.get(m.group(1))
        if week_num:
            found_weeks.add(week_num)

    # Week 1 has no ح N markers — add it if its marker appears in the PDF
    # and add its known sessions directly (they are not in _LECTURE_LOOKUP)
    if 1 in found_weeks:
        for title in _KNOWN_LECTURES.get(1, []):
            sessions.append({
                "week_number": 1,
                "session_type": "lecture",
                "title": title,
                "order_index": 0,   # will be re-indexed at the end
            })

    # ── Pass 3: build session list ────────────────────────────────────────────
    # Sort lectures by number to get correct order
    for num in sorted(found_lecture_nums):
        if num in _LECTURE_LOOKUP:
            # Known lecture — use exact title from template
            week, title = _LECTURE_LOOKUP[num]
            found_weeks.add(week)
        else:
            # Unknown lecture number — try to pull title from surrounding text
            title_match = re.search(
                rf"ح\s*{num}(?!\d|:)\s*(.{{3,80}})(?=ح\s*\d|$)",
                all_text,
                re.DOTALL,
            )
            raw_title = title_match.group(1).strip() if title_match else ""
            raw_title = re.sub(r"\s+", " ", raw_title).rstrip("،,")
            title = f"ح {num}: {raw_title}" if raw_title else f"ح {num}"
            # Guess week from position in text
            week = 1

        sessions.append({
            "week_number": week,
            "session_type": "lecture",
            "title": title,
            "order_index": order,
        })
        order += 1

    # ── Pass 4: add one workshop per found week ───────────────────────────────
    for week in sorted(found_weeks):
        workshop_title = _KNOWN_WORKSHOPS.get(
            week, f"الورشة التفاعلية - الأسبوع {week}"
        )
        sessions.append({
            "week_number": week,
            "session_type": "workshop",
            "title": workshop_title,
            "order_index": order,
        })
        order += 1

    # ── Sort: lectures by number, workshops grouped after their week's lectures ─
    def _sort_key(s: dict):
        num_match = re.match(r"ح\s*(\d+)", s["title"])
        num = int(num_match.group(1)) if num_match else 999
        # workshops sort after the last lecture of their week
        type_rank = 0 if s["session_type"] == "lecture" else 1
        return (s["week_number"], type_rank, num)

    sessions.sort(key=_sort_key)

    # Re-assign order_index after sort
    for i, s in enumerate(sessions, 1):
        s["order_index"] = i

    return sessions



@router.post("/parse-pdf")
async def parse_curriculum_pdf(
    course_id: int,
    file: UploadFile = File(...),
    _=Depends(require_role("admin", "supervisor")),
):
    """Upload a مخطط PDF and extract sessions as a preview (no DB write).
    The frontend should display the result and let the admin confirm before importing.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:  # 20 MB guard
        raise HTTPException(status_code=400, detail="PDF too large (max 20 MB)")

    sessions = _parse_pdf_bytes(data)
    return {"sessions": sessions, "count": len(sessions)}


@router.post("/import-pdf", status_code=201)
async def import_from_pdf(
    course_id: int,
    file: UploadFile = File(...),
    _=Depends(require_role("admin", "supervisor")),
    db: Session = Depends(get_db),
):
    """Upload مخطط PDF, extract sessions, and immediately replace the course curriculum."""
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    data = await file.read()
    sessions = _parse_pdf_bytes(data)

    if not sessions:
        raise HTTPException(
            status_code=422,
            detail="No curriculum sessions could be extracted from this PDF. "
                   "Try the manual template or add sessions individually.",
        )

    db.query(CurriculumSession).filter(CurriculumSession.course_id == course_id).delete(synchronize_session=False)
    for item in sessions:
        db.add(CurriculumSession(course_id=course_id, **item))
    db.commit()

    return {"created": len(sessions)}
