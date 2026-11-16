"""Tests for analytics service layer.

Tests the database query functions directly — no HTTP, no FastAPI.
This validates the business logic (at-risk detection, summary aggregates,
inactive student queries) independently from the routing layer.
"""
import pytest
from datetime import date, timedelta

from app.models.course import Course
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.models.grade import Grade, GradeCategory
from app.services.analytics import (
    fetch_summary,
    fetch_at_risk_students,
    fetch_inactive_students,
    fetch_teacher_summary,
    fetch_courses_breakdown,
)


# ── Shared fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def course(db, teacher_user, supervisor_user):
    c = Course(
        title="Analytics Test Course",
        status="Active",
        teacher_id=teacher_user.user_id,
        supervisor_id=supervisor_user.user_id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture
def student(db):
    s = Student(first_name="Ali", last_name="Hassan", student_number="AH001")
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture
def student2(db):
    s = Student(first_name="Sara", last_name="Ali", student_number="SA002")
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture
def enrollment(db, student, course):
    e = Enrollment(
        student_id=student.student_id,
        course_id=course.course_id,
        completion_status="Ongoing",
        enrollment_date=date.today(),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@pytest.fixture
def enrollment2(db, student2, course):
    e = Enrollment(
        student_id=student2.student_id,
        course_id=course.course_id,
        completion_status="Ongoing",
        enrollment_date=date.today(),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@pytest.fixture
def grade_category(db, course):
    cat = GradeCategory(
        course_id=course.course_id,
        name="امتحان",
        max_value=100.0,
        kind="regular",
        order_index=0,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def _add_grade(db, enrollment_id, category_id, value, days_ago=0):
    g = Grade(
        enrollment_id=enrollment_id,
        category_id=category_id,
        value=value,
        date_recorded=date.today() - timedelta(days=days_ago),
    )
    db.add(g)
    db.commit()
    return g


# ── fetch_summary ────────────────────────────────────────────────────────────

def test_summary_empty_db(db, admin_user):
    result = fetch_summary(db, admin_user)
    assert result["total_students"] == 0
    assert result["total_courses"] == 0
    assert result["total_enrollments"] == 0
    assert result["completion_rate"] == 0


def test_summary_counts_students_and_courses(db, admin_user, student, student2, course):
    result = fetch_summary(db, admin_user)
    assert result["total_students"] == 2
    assert result["total_courses"] == 1
    assert result["active_courses"] == 1


def test_summary_counts_enrollments(db, admin_user, enrollment, enrollment2):
    result = fetch_summary(db, admin_user)
    assert result["total_enrollments"] == 2
    assert result["total_ongoing"] == 2
    assert result["total_completed"] == 0
    assert result["total_dropped"] == 0


def test_summary_completion_rate(db, admin_user, enrollment, enrollment2):
    enrollment.completion_status = "Completed"
    db.commit()
    result = fetch_summary(db, admin_user)
    assert result["completion_rate"] == 50.0


def test_summary_supervisor_scoped_to_own_courses(db, supervisor_user, enrollment, enrollment2):
    result = fetch_summary(db, supervisor_user)
    assert result["total_enrollments"] == 2
    assert result["total_courses"] == 1


def test_summary_counts_teachers(db, admin_user, course, teacher_user):
    result = fetch_summary(db, admin_user)
    assert result["total_teachers"] == 1


# ── fetch_at_risk_students ───────────────────────────────────────────────────

def test_at_risk_returns_empty_when_no_enrollments(db, admin_user):
    result = fetch_at_risk_students(db, admin_user, threshold=50.0, limit=100)
    assert result == []


def test_at_risk_returns_empty_when_no_grades(db, admin_user, enrollment, grade_category):
    # Enrollment exists but has no grades → pct is None → excluded
    result = fetch_at_risk_students(db, admin_user, threshold=50.0, limit=100)
    assert result == []


def test_at_risk_detects_low_grade(db, admin_user, enrollment, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 30.0)
    result = fetch_at_risk_students(db, admin_user, threshold=50.0, limit=100)
    assert len(result) == 1
    assert result[0]["enrollment_id"] == enrollment.enrollment_id
    assert result[0]["total_pct"] == 30.0


def test_at_risk_excludes_passing_student(db, admin_user, enrollment, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 75.0)
    result = fetch_at_risk_students(db, admin_user, threshold=50.0, limit=100)
    assert result == []


def test_at_risk_boundary_at_threshold_is_not_at_risk(db, admin_user, enrollment, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 50.0)
    result = fetch_at_risk_students(db, admin_user, threshold=50.0, limit=100)
    assert result == []


def test_at_risk_sorted_ascending_by_grade(db, admin_user, enrollment, enrollment2, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 40.0)
    _add_grade(db, enrollment2.enrollment_id, grade_category.id, 20.0)
    result = fetch_at_risk_students(db, admin_user, threshold=50.0, limit=100)
    assert len(result) == 2
    assert result[0]["total_pct"] < result[1]["total_pct"]
    assert result[0]["total_pct"] == 20.0


def test_at_risk_excludes_completed_enrollments(db, admin_user, enrollment, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 10.0)
    enrollment.completion_status = "Completed"
    db.commit()
    result = fetch_at_risk_students(db, admin_user, threshold=50.0, limit=100)
    assert result == []


def test_at_risk_excludes_dropped_enrollments(db, admin_user, enrollment, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 10.0)
    enrollment.completion_status = "Dropped"
    db.commit()
    result = fetch_at_risk_students(db, admin_user, threshold=50.0, limit=100)
    assert result == []


def test_at_risk_teacher_scoped_to_own_courses(db, teacher_user, enrollment, enrollment2, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 20.0)
    _add_grade(db, enrollment2.enrollment_id, grade_category.id, 15.0)
    result = fetch_at_risk_students(db, teacher_user, threshold=50.0, limit=100)
    assert len(result) == 2  # both enrollments are in teacher's course


def test_at_risk_supervisor_scoped_to_own_courses(db, supervisor_user, enrollment, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 25.0)
    result = fetch_at_risk_students(db, supervisor_user, threshold=50.0, limit=100)
    assert len(result) == 1


def test_at_risk_limit_respected(db, admin_user, enrollment, enrollment2, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 10.0)
    _add_grade(db, enrollment2.enrollment_id, grade_category.id, 15.0)
    result = fetch_at_risk_students(db, admin_user, threshold=50.0, limit=1)
    assert len(result) <= 1


def test_at_risk_includes_student_info(db, admin_user, enrollment, student, course, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 30.0)
    result = fetch_at_risk_students(db, admin_user, threshold=50.0, limit=100)
    assert len(result) == 1
    r = result[0]
    assert r["student_id"] == student.student_id
    assert r["student_number"] == "AH001"
    assert "Ali" in r["student_name"]
    assert r["course_title"] == "Analytics Test Course"


# ── fetch_inactive_students ───────────────────────────────────────────────────

def test_inactive_empty_when_no_enrollments(db, supervisor_user):
    result = fetch_inactive_students(db, supervisor_user.user_id, days=7)
    assert result == []


def test_inactive_student_with_no_grades(db, supervisor_user, enrollment, student, course):
    # No grades at all → last_activity is NULL → always inactive
    result = fetch_inactive_students(db, supervisor_user.user_id, days=7)
    assert len(result) == 1
    assert result[0]["student_number"] == "AH001"
    assert result[0]["last_activity"] is None


def test_active_student_excluded(db, supervisor_user, enrollment, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 80.0, days_ago=2)
    result = fetch_inactive_students(db, supervisor_user.user_id, days=7)
    assert result == []


def test_inactive_student_with_old_grade(db, supervisor_user, enrollment, grade_category):
    _add_grade(db, enrollment.enrollment_id, grade_category.id, 80.0, days_ago=10)
    result = fetch_inactive_students(db, supervisor_user.user_id, days=7)
    assert len(result) == 1
    assert result[0]["days_inactive"] == 10


def test_inactive_only_from_supervisor_courses(db, supervisor_user, enrollment, enrollment2, grade_category, db_second_supervisor=None):
    # Both enrollments belong to supervisor's course
    result = fetch_inactive_students(db, supervisor_user.user_id, days=7)
    assert len(result) == 2


def test_inactive_completed_enrollment_excluded(db, supervisor_user, enrollment):
    enrollment.completion_status = "Completed"
    db.commit()
    result = fetch_inactive_students(db, supervisor_user.user_id, days=7)
    assert result == []


# ── fetch_teacher_summary ────────────────────────────────────────────────────

def test_teacher_summary_empty(db, teacher_user):
    result = fetch_teacher_summary(db, teacher_user.user_id)
    assert result["my_courses"] == 0
    assert result["my_students"] == 0
    assert result["completion_rate"] == 0


def test_teacher_summary_counts(db, teacher_user, course, enrollment, enrollment2):
    result = fetch_teacher_summary(db, teacher_user.user_id)
    assert result["my_courses"] == 1
    assert result["my_students"] == 2
    assert result["total_enrollments"] == 2


def test_teacher_summary_completion_rate(db, teacher_user, course, enrollment, enrollment2):
    enrollment.completion_status = "Completed"
    db.commit()
    result = fetch_teacher_summary(db, teacher_user.user_id)
    assert result["completion_rate"] == 50.0


# ── fetch_courses_breakdown ───────────────────────────────────────────────────

def test_courses_breakdown_empty(db, admin_user):
    result = fetch_courses_breakdown(db, admin_user)
    assert result == []


def test_courses_breakdown_includes_course(db, admin_user, course):
    result = fetch_courses_breakdown(db, admin_user)
    assert len(result) == 1
    assert result[0]["title"] == "Analytics Test Course"
    assert result[0]["status"] == "Active"


def test_courses_breakdown_enrollment_counts(db, admin_user, course, enrollment, enrollment2):
    result = fetch_courses_breakdown(db, admin_user)
    assert result[0]["total"] == 2
    assert result[0]["ongoing"] == 2
    assert result[0]["completed"] == 0


def test_courses_breakdown_supervisor_scoped(db, supervisor_user, course, enrollment):
    result = fetch_courses_breakdown(db, supervisor_user)
    assert len(result) == 1
    assert result[0]["total"] == 1
