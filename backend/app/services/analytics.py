"""Analytics service layer.

Contains all database query logic for the analytics endpoints. Routes import
these functions and handle only HTTP concerns (dependency injection, response
serialisation). This makes queries independently testable without FastAPI.
"""
from datetime import date, timedelta
from sqlalchemy.orm import Session, joinedload, aliased
from sqlalchemy import func, or_, case, distinct

from app.models.user import User
from app.models.student import Student
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.grade import Grade, GradeCategory
from app.models.attendance import AttendanceRecord
from app.services.grades import compute_total_pct


def fetch_summary(db: Session, current_user) -> dict:
    """Return the KPI summary dict, scoped to supervisor or global for admin."""
    if current_user.role == "supervisor":
        sid = current_user.user_id

        c = (
            db.query(
                func.count(Course.course_id).label("total_courses"),
                func.count(case((Course.status == "Active", Course.course_id))).label("active_courses"),
                func.count(distinct(Course.teacher_id)).label("total_teachers"),
            )
            .filter(Course.supervisor_id == sid)
            .one()
        )
        e = (
            db.query(
                func.count(Enrollment.enrollment_id).label("total_enrollments"),
                func.count(case((Enrollment.completion_status == "Completed", Enrollment.enrollment_id))).label("completed"),
                func.count(case((Enrollment.completion_status == "Ongoing", Enrollment.enrollment_id))).label("ongoing"),
                func.count(case((Enrollment.completion_status == "Dropped", Enrollment.enrollment_id))).label("dropped"),
                func.count(distinct(Enrollment.student_id)).label("total_students"),
            )
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(Course.supervisor_id == sid)
            .one()
        )
        avg_grade = (
            db.query(func.avg(Grade.value))
            .join(Enrollment, Enrollment.enrollment_id == Grade.enrollment_id)
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(Course.supervisor_id == sid)
            .scalar()
        )
        total_courses, active_courses, total_teachers = c.total_courses, c.active_courses, c.total_teachers
        total_enrollments, completed, ongoing, dropped, total_students = (
            e.total_enrollments, e.completed, e.ongoing, e.dropped, e.total_students
        )
    else:
        c = (
            db.query(
                func.count(Course.course_id).label("total_courses"),
                func.count(case((Course.status == "Active", Course.course_id))).label("active_courses"),
            )
            .one()
        )
        e = (
            db.query(
                func.count(Enrollment.enrollment_id).label("total_enrollments"),
                func.count(case((Enrollment.completion_status == "Completed", Enrollment.enrollment_id))).label("completed"),
                func.count(case((Enrollment.completion_status == "Ongoing", Enrollment.enrollment_id))).label("ongoing"),
                func.count(case((Enrollment.completion_status == "Dropped", Enrollment.enrollment_id))).label("dropped"),
            )
            .one()
        )
        total_students = db.query(func.count(Student.student_id)).scalar()
        total_teachers = db.query(func.count(User.user_id)).filter(User.role == "teacher").scalar()
        avg_grade = db.query(func.avg(Grade.value)).scalar()
        total_courses, active_courses = c.total_courses, c.active_courses
        total_enrollments, completed, ongoing, dropped = (
            e.total_enrollments, e.completed, e.ongoing, e.dropped
        )

    completion_rate = round((completed / total_enrollments * 100), 1) if total_enrollments else 0
    return {
        "total_students": total_students,
        "total_courses": total_courses,
        "active_courses": active_courses,
        "total_enrollments": total_enrollments,
        "total_completed": int(completed or 0),
        "total_ongoing": int(ongoing or 0),
        "total_dropped": int(dropped or 0),
        "completion_rate": completion_rate,
        "avg_grade": round(avg_grade, 1) if avg_grade else None,
        "total_teachers": total_teachers,
    }


def fetch_teacher_summary(db: Session, teacher_id: int) -> dict:
    """Return KPI summary for a single teacher (one query)."""
    row = (
        db.query(
            func.count(distinct(Course.course_id)).label("my_courses"),
            func.count(distinct(Enrollment.student_id)).label("my_students"),
            func.count(Enrollment.enrollment_id).label("total_enrollments"),
            func.count(case((Enrollment.completion_status == "Completed", Enrollment.enrollment_id))).label("completed"),
        )
        .select_from(Course)
        .outerjoin(Enrollment, Enrollment.course_id == Course.course_id)
        .filter(Course.teacher_id == teacher_id)
        .one()
    )
    total_enrollments = row.total_enrollments or 0
    completed = row.completed or 0
    completion_rate = round((completed / total_enrollments * 100), 1) if total_enrollments else 0
    return {
        "my_courses": row.my_courses or 0,
        "my_students": row.my_students or 0,
        "total_enrollments": total_enrollments,
        "completion_rate": completion_rate,
    }


def fetch_courses_breakdown(db: Session, current_user) -> list[dict]:
    """Per-course enrollment breakdown. Admins see all; supervisors see their own."""
    TeacherUser = aliased(User)
    SupervisorUser = aliased(User)

    avg_grade_sub = (
        db.query(
            Enrollment.course_id.label("course_id"),
            func.avg(Grade.value).label("avg_grade"),
        )
        .outerjoin(Grade, Grade.enrollment_id == Enrollment.enrollment_id)
        .group_by(Enrollment.course_id)
        .subquery()
    )

    query = (
        db.query(
            Course.course_id,
            Course.title,
            Course.status,
            Course.course_type,
            Course.total_sessions,
            TeacherUser.first_name.label("teacher_first"),
            TeacherUser.last_name.label("teacher_last"),
            SupervisorUser.first_name.label("supervisor_first"),
            SupervisorUser.last_name.label("supervisor_last"),
            func.count(distinct(Enrollment.enrollment_id)).label("total"),
            func.count(distinct(case((Enrollment.completion_status == "Completed", Enrollment.enrollment_id)))).label("completed"),
            func.count(distinct(case((Enrollment.completion_status == "Dropped", Enrollment.enrollment_id)))).label("dropped"),
            avg_grade_sub.c.avg_grade.label("avg_grade"),
        )
        .outerjoin(Enrollment, Enrollment.course_id == Course.course_id)
        .outerjoin(TeacherUser, TeacherUser.user_id == Course.teacher_id)
        .outerjoin(SupervisorUser, SupervisorUser.user_id == Course.supervisor_id)
        .outerjoin(avg_grade_sub, avg_grade_sub.c.course_id == Course.course_id)
        .group_by(
            Course.course_id, Course.title, Course.status, Course.course_type, Course.total_sessions,
            TeacherUser.first_name, TeacherUser.last_name,
            SupervisorUser.first_name, SupervisorUser.last_name,
            avg_grade_sub.c.avg_grade,
        )
        .order_by(Course.title)
    )
    if current_user.role == "supervisor":
        query = query.filter(Course.supervisor_id == current_user.user_id)

    result = []
    for r in query.all():
        total = r.total or 0
        completed = r.completed or 0
        dropped = r.dropped or 0
        ongoing = total - completed - dropped
        result.append({
            "course_id": r.course_id,
            "title": r.title,
            "status": r.status,
            "course_type": r.course_type or "onsite",
            "total_sessions": r.total_sessions,
            "teacher_name": f"{r.teacher_first} {r.teacher_last}".strip() if r.teacher_first else "Unassigned",
            "supervisor_name": f"{r.supervisor_first} {r.supervisor_last}".strip() if r.supervisor_first else "Unassigned",
            "total": total,
            "ongoing": max(ongoing, 0),
            "completed": completed,
            "dropped": dropped,
            "completion_rate": round(completed / total * 100, 1) if total else 0,
            "avg_grade": round(r.avg_grade, 1) if r.avg_grade else None,
        })
    return result


def fetch_teachers_breakdown(db: Session) -> list[dict]:
    """Per-teacher performance breakdown (admin only). Single GROUP BY query."""
    rows = (
        db.query(
            User.user_id,
            User.first_name,
            User.last_name,
            User.email,
            func.count(distinct(Course.course_id)).label("courses"),
            func.count(distinct(Enrollment.student_id)).label("students"),
            func.count(Enrollment.enrollment_id).label("total_enr"),
            func.sum(case((Enrollment.completion_status == "Completed", 1), else_=0)).label("completed"),
        )
        .filter(User.role == "teacher")
        .outerjoin(Course, Course.teacher_id == User.user_id)
        .outerjoin(Enrollment, Enrollment.course_id == Course.course_id)
        .group_by(User.user_id, User.first_name, User.last_name, User.email)
        .all()
    )
    result = []
    for r in rows:
        total = r.total_enr or 0
        completed = r.completed or 0
        result.append({
            "teacher_id": r.user_id,
            "name": f"{r.first_name} {r.last_name}",
            "email": r.email,
            "courses": r.courses or 0,
            "students": r.students or 0,
            "completed": completed,
            "completion_rate": round(completed / total * 100, 1) if total else 0,
        })
    return sorted(result, key=lambda x: x["completion_rate"], reverse=True)


def fetch_at_risk_students(db: Session, current_user, threshold: float, limit: int) -> list[dict]:
    """Return Ongoing enrollments below `threshold` % total grade.

    Uses 3 queries total regardless of enrollment count:
    1. Scoped ongoing enrollments (eager-loaded student + course)
    2. All grade categories for relevant courses
    3. All grades for those enrollments
    """
    base = (
        db.query(Enrollment)
        .options(joinedload(Enrollment.student), joinedload(Enrollment.course))
        .filter(Enrollment.completion_status == "Ongoing")
    )
    if current_user.role == "teacher":
        base = base.join(Course, Course.course_id == Enrollment.course_id).filter(
            Course.teacher_id == current_user.user_id
        )
    elif current_user.role == "supervisor":
        base = base.join(Course, Course.course_id == Enrollment.course_id).filter(
            Course.supervisor_id == current_user.user_id
        )

    enrollments = base.all()
    if not enrollments:
        return []

    enrollment_ids = [e.enrollment_id for e in enrollments]
    course_ids = list({e.course_id for e in enrollments})

    categories_by_course: dict[int, dict[int, GradeCategory]] = {}
    for cat in db.query(GradeCategory).filter(GradeCategory.course_id.in_(course_ids)).all():
        categories_by_course.setdefault(cat.course_id, {})[cat.id] = cat

    grades_idx: dict[int, dict] = {}
    for g in db.query(Grade).filter(Grade.enrollment_id.in_(enrollment_ids)).all():
        if g.category_id is None:
            continue
        grades_idx.setdefault(g.enrollment_id, {}).setdefault(g.category_id, []).append(g.value)

    out = []
    for e in enrollments:
        cats = categories_by_course.get(e.course_id, {})
        if not cats:
            continue
        grade_values = {cat_id: grades_idx.get(e.enrollment_id, {}).get(cat_id, []) for cat_id in cats}
        pct = compute_total_pct(grade_values, cats)
        if pct is None:
            continue
        if pct < threshold:
            out.append({
                "enrollment_id": e.enrollment_id,
                "student_id": e.student_id,
                "student_name": f"{e.student.first_name} {e.student.last_name}" if e.student else "—",
                "student_number": e.student.student_number if e.student else "—",
                "course_id": e.course_id,
                "course_title": e.course.title if e.course else "—",
                "absences": e.absences,
                "total_pct": pct,
            })

    out.sort(key=lambda r: r["total_pct"])
    return out[:limit]


def fetch_inactive_students(db: Session, supervisor_id: int, days: int) -> list[dict]:
    """Ongoing enrollments with no grade activity in the last N days, scoped to supervisor."""
    cutoff = date.today() - timedelta(days=days)

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
            Student.student_id,
            Student.first_name,
            Student.last_name,
            Student.student_number,
            Course.title.label("course_title"),
            Enrollment.enrollment_id,
            last_activity.c.last_activity,
        )
        .join(Enrollment, Enrollment.student_id == Student.student_id)
        .join(Course, Course.course_id == Enrollment.course_id)
        .join(last_activity, last_activity.c.enrollment_id == Enrollment.enrollment_id)
        .filter(
            Course.supervisor_id == supervisor_id,
            or_(
                last_activity.c.last_activity == None,  # noqa: E711
                last_activity.c.last_activity < cutoff,
            ),
        )
        .order_by(last_activity.c.last_activity.asc().nullsfirst())
        .all()
    )

    today = date.today()
    return [
        {
            "student_id": r.student_id,
            "name": f"{r.first_name} {r.last_name}",
            "student_number": r.student_number,
            "course_title": r.course_title,
            "enrollment_id": r.enrollment_id,
            "last_activity": r.last_activity.isoformat() if r.last_activity else None,
            "days_inactive": (today - r.last_activity).days if r.last_activity else None,
        }
        for r in rows
    ]


def fetch_absent_yesterday(db: Session, current_user) -> list[dict]:
    """Students absent in yesterday's sessions, scoped to supervisor or all for admin."""
    yesterday = date.today() - timedelta(days=1)

    query = (
        db.query(
            Student.student_id,
            Student.first_name,
            Student.last_name,
            Student.student_number,
            Student.phone_number,
            Course.course_id,
            Course.title.label("course_title"),
            AttendanceRecord.session_date,
        )
        .join(Enrollment, Enrollment.student_id == Student.student_id)
        .join(Course, Course.course_id == Enrollment.course_id)
        .join(AttendanceRecord, AttendanceRecord.enrollment_id == Enrollment.enrollment_id)
        .filter(AttendanceRecord.status == "absent", AttendanceRecord.session_date == yesterday)
    )
    if current_user.role == "supervisor":
        query = query.filter(Course.supervisor_id == current_user.user_id)

    return [
        {
            "student_id": r.student_id,
            "name": f"{r.first_name} {r.last_name}",
            "student_number": r.student_number,
            "phone_number": r.phone_number,
            "course_id": r.course_id,
            "course_title": r.course_title,
            "session_date": r.session_date.isoformat(),
        }
        for r in query.order_by(Course.title, Student.last_name).all()
    ]
