"""Attendance counter service.

Two attendance systems exist in this codebase:
  • AttendanceRecord  — date-based records for regular (non-curriculum) courses.
  • CurriculumAttendance — session-based records for diploma courses.

Both write to the same denormalised counters on Enrollment
(attendance_count / absences / makeup_count).  Call the appropriate
recompute function after every write so counters stay in sync:

  • recompute_counters()          → reads AttendanceRecord
  • recompute_from_curriculum()   → reads CurriculumAttendance
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.attendance import AttendanceRecord
from app.models.enrollment import Enrollment


def recompute_counters(db: Session, enrollment_ids: list[int]) -> None:
    """Refresh attendance_count / absences / makeup_count from attendance_records."""
    if not enrollment_ids:
        return

    rows = (
        db.query(
            AttendanceRecord.enrollment_id,
            AttendanceRecord.status,
            func.count(AttendanceRecord.id),
        )
        .filter(AttendanceRecord.enrollment_id.in_(enrollment_ids))
        .group_by(AttendanceRecord.enrollment_id, AttendanceRecord.status)
        .all()
    )

    counts: dict[int, dict[str, int]] = {eid: {} for eid in enrollment_ids}
    for eid, status, n in rows:
        counts[eid][status] = n

    # Bulk-fetch all target enrollments in one query instead of N queries
    enrollments = {
        e.enrollment_id: e
        for e in db.query(Enrollment).filter(Enrollment.enrollment_id.in_(enrollment_ids)).all()
    }
    for eid in enrollment_ids:
        enr = enrollments.get(eid)
        if not enr:
            continue
        c = counts[eid]
        enr.attendance_count = c.get("present", 0)
        enr.absences = c.get("absent", 0)
        enr.makeup_count = c.get("makeup", 0)


def recompute_from_curriculum(db: Session, enrollment_ids: list[int]) -> None:
    """Refresh attendance_count / absences / makeup_count from CurriculumAttendance.

    Call this after every write to curriculum_attendance so enrollment counters
    stay accurate for diploma (curriculum-based) courses.  Without this call,
    enrollment.absences always shows 0 for curriculum courses because
    AttendanceRecord is never written for those courses.
    """
    from app.models.curriculum import CurriculumAttendance  # local import avoids circular

    if not enrollment_ids:
        return

    rows = (
        db.query(
            CurriculumAttendance.enrollment_id,
            CurriculumAttendance.status,
            func.count(CurriculumAttendance.id),
        )
        .filter(CurriculumAttendance.enrollment_id.in_(enrollment_ids))
        .group_by(CurriculumAttendance.enrollment_id, CurriculumAttendance.status)
        .all()
    )

    counts: dict[int, dict[str, int]] = {eid: {} for eid in enrollment_ids}
    for eid, status, n in rows:
        counts[eid][status] = n

    # Bulk-fetch all target enrollments in one query instead of N queries
    enrollments = {
        e.enrollment_id: e
        for e in db.query(Enrollment).filter(Enrollment.enrollment_id.in_(enrollment_ids)).all()
    }
    for eid in enrollment_ids:
        enr = enrollments.get(eid)
        if not enr:
            continue
        c = counts[eid]
        enr.attendance_count = c.get("present", 0)
        enr.absences = c.get("absent", 0)
        enr.makeup_count = c.get("makeup", 0)
