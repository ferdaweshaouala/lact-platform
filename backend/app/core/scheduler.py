"""Background job scheduler.

Uses APScheduler with a SQLAlchemy jobstore so that scheduled jobs are persisted
in the database. In a multi-worker deployment (multiple uvicorn workers or replicas)
only ONE worker acquires the database-level advisory lock and executes each job —
the others skip it. This prevents duplicate emails and double-processing.

Without a jobstore (the previous in-memory default), every worker would run the
same job independently, causing supervisors to receive N duplicate emails where N
is the number of workers.
"""
import logging
from datetime import date, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func, or_
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User, RefreshTokenStore
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.student import Student
from app.models.grade import Grade
from app.models.curriculum import CurriculumSession, CurriculumAttendance
from app.core.email import send_notification
from app.core.security import _utcnow

logger = logging.getLogger(__name__)

# SQLAlchemyJobStore stores job metadata (next_run_time, job state) in the DB.
# APScheduler uses a row-level lock on the job record so only one process/worker
# executes a due job — all other workers see the already-updated next_run_time
# and skip it.
#
# NullPool is intentional: the jobstore only needs a connection for the brief
# moment it checks/updates job state (a few ms, 3 times per day). A persistent
# pool would waste Neon's connection slots 24/7 for zero benefit.
_connect_args = {"sslmode": "require"} if "neon.tech" in settings.DATABASE_URL else {}
_jobstore = SQLAlchemyJobStore(
    url=settings.DATABASE_URL,
    engine_options={"poolclass": NullPool, "connect_args": _connect_args},
)
scheduler = BackgroundScheduler(jobstores={"default": _jobstore})


def _send_inactivity_digests(days: int = 7) -> None:
    """Weekly job: email each supervisor a digest of inactive students in their courses."""
    db = SessionLocal()
    try:
        cutoff = date.today() - timedelta(days=days)
        supervisors = db.query(User).filter(User.role == "supervisor").all()

        for sup in supervisors:
            if not sup.email:
                continue

            last_activity = (
                db.query(
                    Enrollment.enrollment_id,
                    func.max(Grade.date_recorded).label("last_activity"),
                )
                .outerjoin(Grade, Grade.enrollment_id == Enrollment.enrollment_id)
                .filter(Enrollment.completion_status == "Ongoing")
                .group_by(Enrollment.enrollment_id)
                .subquery()
            )

            rows = (
                db.query(
                    Student.first_name, Student.last_name, Student.student_number,
                    Course.title, last_activity.c.last_activity,
                )
                .join(Enrollment, Enrollment.student_id == Student.student_id)
                .join(Course, Course.course_id == Enrollment.course_id)
                .join(last_activity, last_activity.c.enrollment_id == Enrollment.enrollment_id)
                .filter(
                    Course.supervisor_id == sup.user_id,
                    or_(
                        last_activity.c.last_activity == None,  # noqa: E711
                        last_activity.c.last_activity < cutoff,
                    ),
                )
                .order_by(last_activity.c.last_activity.asc().nullsfirst())
                .all()
            )

            if not rows:
                continue

            list_html = "<ul style='padding-inline-start:18px;margin:0;'>"
            for r in rows:
                last = r.last_activity.isoformat() if r.last_activity else "—"
                list_html += (
                    f"<li style='margin-bottom:6px;'>"
                    f"<strong>{r.first_name} {r.last_name}</strong> "
                    f"<span style='color:#94A3B8;font-family:monospace;font-size:12px;'>({r.student_number})</span> · "
                    f"{r.title} · <span style='color:#F87171;'>last activity: {last}</span>"
                    f"</li>"
                )
            list_html += "</ul>"

            body = (
                f"<p>The following {len(rows)} student(s) in courses you supervise have had "
                f"no grade activity in the last {days} days:</p>" + list_html +
                "<p style='color:#64748B;font-size:12px;margin-top:18px;'>"
                "Open the dashboard to follow up.</p>"
            )

            try:
                send_notification(
                    sup.email,
                    f"Weekly inactivity report — {len(rows)} student(s)",
                    "Students inactive for over 7 days",
                    body,
                )
                logger.info(f"[scheduler] Inactivity digest sent to {sup.email} ({len(rows)} students).")
            except Exception as e:
                logger.error(f"[scheduler] Failed to send digest to {sup.email}: {e}")

    finally:
        db.close()


def _course_is_fully_complete(db, course: "Course") -> bool:
    """Return True if a course qualifies for auto-closure.

    Two independent triggers — either one is sufficient:
      A) end_date has passed AND every enrollment is Completed or Dropped.
      B) All curriculum sessions have at least one attendance record AND
         at least one student has a Final-category grade (proof the final
         exam / project has been graded).

    Empty courses (zero enrollments) are never auto-closed.
    """
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.course_id == course.course_id)
        .all()
    )
    if not enrollments:
        return False

    # ── Trigger A: past end_date + all students done ──────────────────
    today = date.today()
    if course.end_date and course.end_date < today:
        all_done = all(
            e.completion_status in ("Completed", "Dropped") for e in enrollments
        )
        if all_done:
            return True

    # ── Trigger B: all curriculum sessions recorded + final grade ─────
    curriculum_sessions = (
        db.query(CurriculumSession)
        .filter(CurriculumSession.course_id == course.course_id)
        .all()
    )
    if curriculum_sessions:
        session_ids = [s.id for s in curriculum_sessions]
        # A session counts as "recorded" if it has at least one attendance row
        recorded_session_ids = set(
            row[0] for row in
            db.query(CurriculumAttendance.curriculum_session_id)
            .filter(CurriculumAttendance.curriculum_session_id.in_(session_ids))
            .distinct()
            .all()
        )
        all_sessions_done = recorded_session_ids.issuperset(set(session_ids))

        # Check for at least one Final grade across all enrollments
        enrollment_ids = [e.enrollment_id for e in enrollments]
        has_final = db.query(Grade).filter(
            Grade.enrollment_id.in_(enrollment_ids),
            Grade.type == "final",
        ).first() is not None

        if all_sessions_done and has_final:
            return True

    return False


def _auto_complete_courses() -> None:
    """Nightly job: auto-close Active courses that have reached completion.

    A course is closed (status → Inactive) when EITHER:
      • Its end_date has passed and all students are Completed/Dropped, OR
      • Every curriculum session has attendance records AND a final grade exists.

    This prevents supervisors from having to manually close courses.
    """
    db = SessionLocal()
    try:
        active_courses = (
            db.query(Course)
            .filter(Course.status == "Active")
            .all()
        )
        closed = 0
        for course in active_courses:
            if _course_is_fully_complete(db, course):
                course.status = "Inactive"
                closed += 1
        if closed:
            db.commit()
            logger.info(f"[scheduler] Auto-closed {closed} course(s).")
    finally:
        db.close()


def _purge_expired_refresh_tokens() -> None:
    """Weekly cleanup: delete revoked or expired refresh tokens from the store.

    Keeps the refresh_tokens table from growing unboundedly.
    Runs alongside the inactivity digest so both are Monday-morning housekeeping.
    """
    db = SessionLocal()
    try:
        now = _utcnow()
        deleted = (
            db.query(RefreshTokenStore)
            .filter(
                (RefreshTokenStore.revoked == True) |  # noqa: E712
                (RefreshTokenStore.expires_at < now)
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        if deleted:
            logger.info(f"[scheduler] Purged {deleted} expired/revoked refresh tokens.")
    finally:
        db.close()


def start_scheduler() -> None:
    """Register scheduled jobs and start the scheduler."""
    scheduler.add_job(
        _send_inactivity_digests,
        trigger=CronTrigger(day_of_week="mon", hour=8, minute=0),
        id="weekly_inactivity_digest",
        replace_existing=True,
        misfire_grace_time=3600,   # allow up to 1h late if the server was down
    )
    scheduler.add_job(
        _purge_expired_refresh_tokens,
        trigger=CronTrigger(day_of_week="mon", hour=8, minute=5),
        id="weekly_refresh_token_purge",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        _auto_complete_courses,
        trigger=CronTrigger(hour=1, minute=0),   # runs nightly at 01:00
        id="nightly_auto_complete_courses",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    logger.info("[scheduler] Jobs scheduled (SQLAlchemy jobstore — multi-worker safe).")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
