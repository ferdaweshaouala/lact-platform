"""Tests for enrollment CRUD, RBAC, uniqueness, and status audit log."""
import pytest
from tests.conftest import get_token
from app.models.course import Course
from app.models.student import Student
from app.models.enrollment import Enrollment, StatusChangeLog
from datetime import date


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def course(db, teacher_user, supervisor_user):
    c = Course(
        title="Test Course",
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
    s = Student(first_name="Test", last_name="Student", student_number="TST001")
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture
def student2(db):
    s = Student(first_name="Second", last_name="Student", student_number="TST002")
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _enroll(client, token, student_id, course_id):
    return client.post(
        "/api/enrollments/",
        json={"student_id": student_id, "course_id": course_id},
        headers={"Authorization": f"Bearer {token}"},
    )


# ── Create enrollment ────────────────────────────────────────────────────────

def test_supervisor_can_enroll_student(client, supervisor_user, student, course):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _enroll(client, token, student.student_id, course.course_id)
    assert res.status_code == 201
    body = res.json()
    assert body["student_id"] == student.student_id
    assert body["course_id"] == course.course_id
    assert body["completion_status"] == "Ongoing"


def test_teacher_cannot_enroll_student(client, teacher_user, student, course):
    token = get_token(client, "teacher@test.com", "teacher123")
    res = _enroll(client, token, student.student_id, course.course_id)
    assert res.status_code == 403


def test_admin_cannot_enroll_student(client, admin_user, student, course):
    """Only supervisors enroll students; admin is not in the allowed roles."""
    token = get_token(client, "admin@test.com", "admin123")
    res = _enroll(client, token, student.student_id, course.course_id)
    assert res.status_code == 403


def test_duplicate_enrollment_rejected(client, supervisor_user, student, course):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    _enroll(client, token, student.student_id, course.course_id)
    res = _enroll(client, token, student.student_id, course.course_id)
    assert res.status_code == 400
    assert "already enrolled" in res.json()["detail"].lower()


def test_enrollment_with_nonexistent_student(client, supervisor_user, course):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _enroll(client, token, 99999, course.course_id)
    assert res.status_code == 404


def test_enrollment_with_nonexistent_course(client, supervisor_user, student):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _enroll(client, token, student.student_id, 99999)
    assert res.status_code == 404


def test_enrollment_sets_date_today(client, supervisor_user, student, course):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _enroll(client, token, student.student_id, course.course_id)
    assert res.status_code == 201
    assert res.json()["enrollment_date"] == date.today().isoformat()


# ── List enrollments ─────────────────────────────────────────────────────────

def test_list_requires_auth(client):
    res = client.get("/api/enrollments/")
    assert res.status_code == 401


def test_supervisor_sees_own_course_enrollments(client, supervisor_user, student, student2, course):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    _enroll(client, token, student.student_id, course.course_id)
    _enroll(client, token, student2.student_id, course.course_id)
    res = client.get("/api/enrollments/", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_teacher_sees_only_their_course_enrollments(client, teacher_user, supervisor_user, student, course, db):
    # Enroll via supervisor
    sup_token = get_token(client, "supervisor@test.com", "supervisor123")
    _enroll(client, sup_token, student.student_id, course.course_id)

    # Teacher sees that enrollment
    tea_token = get_token(client, "teacher@test.com", "teacher123")
    res = client.get("/api/enrollments/", headers={"Authorization": f"Bearer {tea_token}"})
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_admin_sees_all_enrollments(client, admin_user, supervisor_user, student, student2, course):
    sup_token = get_token(client, "supervisor@test.com", "supervisor123")
    _enroll(client, sup_token, student.student_id, course.course_id)
    _enroll(client, sup_token, student2.student_id, course.course_id)

    admin_token = get_token(client, "admin@test.com", "admin123")
    res = client.get("/api/enrollments/", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert len(res.json()) == 2


# ── Update enrollment (status change) ────────────────────────────────────────

def test_supervisor_can_update_completion_status(client, supervisor_user, student, course):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    created = _enroll(client, token, student.student_id, course.course_id).json()
    eid = created["enrollment_id"]

    res = client.patch(
        f"/api/enrollments/{eid}",
        json={"completion_status": "Completed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["completion_status"] == "Completed"


def test_teacher_cannot_update_enrollment(client, teacher_user, supervisor_user, student, course):
    sup_token = get_token(client, "supervisor@test.com", "supervisor123")
    created = _enroll(client, sup_token, student.student_id, course.course_id).json()

    tea_token = get_token(client, "teacher@test.com", "teacher123")
    res = client.patch(
        f"/api/enrollments/{created['enrollment_id']}",
        json={"completion_status": "Completed"},
        headers={"Authorization": f"Bearer {tea_token}"},
    )
    assert res.status_code == 403


def test_update_nonexistent_enrollment_returns_404(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = client.patch(
        "/api/enrollments/99999",
        json={"completion_status": "Completed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


def test_status_change_writes_audit_log(client, db, supervisor_user, student, course):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    created = _enroll(client, token, student.student_id, course.course_id).json()
    eid = created["enrollment_id"]

    client.patch(
        f"/api/enrollments/{eid}",
        json={"completion_status": "Dropped"},
        headers={"Authorization": f"Bearer {token}"},
    )

    db.expire_all()
    log_entry = db.query(StatusChangeLog).filter(StatusChangeLog.enrollment_id == eid).first()
    assert log_entry is not None
    assert log_entry.old_status == "Ongoing"
    assert log_entry.new_status == "Dropped"
    assert log_entry.changed_by == supervisor_user.user_id


def test_no_audit_log_when_status_unchanged(client, db, supervisor_user, student, course):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    created = _enroll(client, token, student.student_id, course.course_id).json()
    eid = created["enrollment_id"]

    client.patch(
        f"/api/enrollments/{eid}",
        json={"absences": 2},
        headers={"Authorization": f"Bearer {token}"},
    )

    db.expire_all()
    count = db.query(StatusChangeLog).filter(StatusChangeLog.enrollment_id == eid).count()
    assert count == 0


# ── Delete enrollment ────────────────────────────────────────────────────────

def test_supervisor_can_delete_enrollment(client, supervisor_user, student, course):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    created = _enroll(client, token, student.student_id, course.course_id).json()
    res = client.delete(
        f"/api/enrollments/{created['enrollment_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 204


def test_delete_nonexistent_enrollment_returns_404(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = client.delete("/api/enrollments/99999", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 404
