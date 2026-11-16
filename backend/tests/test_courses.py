"""Tests for course CRUD, RBAC scoping, and assignment validation."""
import pytest
from tests.conftest import get_token
from app.models.course import Course


# ── Helper ──────────────────────────────────────────────────────────────────

def _create_course(client, token, title="Python Basics", teacher_id=None, supervisor_id=None):
    payload = {"title": title}
    if teacher_id:
        payload["teacher_id"] = teacher_id
    if supervisor_id:
        payload["supervisor_id"] = supervisor_id
    return client.post(
        "/api/courses/",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )


# ── Create ────────────────────────────────────────────────────────────────────

def test_admin_can_create_course(client, admin_user):
    token = get_token(client, "admin@test.com", "admin123")
    res = _create_course(client, token)
    assert res.status_code == 201
    assert res.json()["title"] == "Python Basics"
    assert res.json()["status"] == "Active"


def test_supervisor_can_create_course(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _create_course(client, token)
    assert res.status_code == 201


def test_teacher_cannot_create_course(client, teacher_user):
    token = get_token(client, "teacher@test.com", "teacher123")
    res = _create_course(client, token)
    assert res.status_code == 403


def test_unauthenticated_cannot_create_course(client):
    res = client.post("/api/courses/", json={"title": "Hack"})
    assert res.status_code == 401


def test_create_course_with_valid_teacher(client, admin_user, teacher_user):
    token = get_token(client, "admin@test.com", "admin123")
    res = _create_course(client, token, teacher_id=teacher_user.user_id)
    assert res.status_code == 201
    assert res.json()["teacher_id"] == teacher_user.user_id


def test_create_course_with_valid_supervisor(client, admin_user, supervisor_user):
    token = get_token(client, "admin@test.com", "admin123")
    res = _create_course(client, token, supervisor_id=supervisor_user.user_id)
    assert res.status_code == 201
    assert res.json()["supervisor_id"] == supervisor_user.user_id


def test_create_course_with_nonexistent_teacher_rejected(client, admin_user):
    token = get_token(client, "admin@test.com", "admin123")
    res = _create_course(client, token, teacher_id=99999)
    assert res.status_code == 400


def test_create_course_wrong_role_as_teacher_rejected(client, admin_user, supervisor_user):
    """Assigning a supervisor user as teacher should be rejected."""
    token = get_token(client, "admin@test.com", "admin123")
    res = _create_course(client, token, teacher_id=supervisor_user.user_id)
    assert res.status_code == 400


# ── List courses ──────────────────────────────────────────────────────────────

def test_list_requires_auth(client):
    res = client.get("/api/courses/")
    assert res.status_code == 401


def test_admin_sees_all_courses(client, admin_user, supervisor_user):
    admin_token = get_token(client, "admin@test.com", "admin123")
    sup_token = get_token(client, "supervisor@test.com", "supervisor123")
    _create_course(client, sup_token, "Course A")
    _create_course(client, sup_token, "Course B")

    res = client.get("/api/courses/", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_supervisor_sees_only_own_courses(client, admin_user, supervisor_user):
    admin_token = get_token(client, "admin@test.com", "admin123")
    sup_token = get_token(client, "supervisor@test.com", "supervisor123")

    # Admin creates a course not assigned to the supervisor
    _create_course(client, admin_token, "Unassigned Course")
    # Supervisor creates their own (supervisor_id must be set explicitly — the route
    # does not auto-assign it from the authenticated user)
    _create_course(client, sup_token, "My Course", supervisor_id=supervisor_user.user_id)

    res = client.get("/api/courses/", headers={"Authorization": f"Bearer {sup_token}"})
    assert res.status_code == 200
    # Supervisor only sees their own (supervisor_id matches)
    titles = [c["title"] for c in res.json()]
    assert "My Course" in titles
    # The unassigned course has no supervisor_id so supervisor can't see it
    assert "Unassigned Course" not in titles


def test_teacher_sees_only_assigned_courses(client, admin_user, teacher_user):
    admin_token = get_token(client, "admin@test.com", "admin123")
    tea_token = get_token(client, "teacher@test.com", "teacher123")

    _create_course(client, admin_token, "Not My Course")
    _create_course(client, admin_token, "My Course", teacher_id=teacher_user.user_id)

    res = client.get("/api/courses/", headers={"Authorization": f"Bearer {tea_token}"})
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["title"] == "My Course"


# ── Get single course ─────────────────────────────────────────────────────────

def test_get_course_not_found(client, admin_user):
    token = get_token(client, "admin@test.com", "admin123")
    res = client.get("/api/courses/99999", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 404


def test_teacher_cannot_access_other_teachers_course(client, admin_user, teacher_user, db):
    admin_token = get_token(client, "admin@test.com", "admin123")
    tea_token = get_token(client, "teacher@test.com", "teacher123")

    # Create course assigned to nobody (teacher_id=None)
    res = _create_course(client, admin_token, "Someone Else's Course")
    cid = res.json()["course_id"]

    res2 = client.get(f"/api/courses/{cid}", headers={"Authorization": f"Bearer {tea_token}"})
    assert res2.status_code == 403


def test_admin_can_access_any_course(client, admin_user, supervisor_user):
    sup_token = get_token(client, "supervisor@test.com", "supervisor123")
    admin_token = get_token(client, "admin@test.com", "admin123")

    cid = _create_course(client, sup_token, "Sup Course").json()["course_id"]
    res = client.get(f"/api/courses/{cid}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200


# ── Default values ────────────────────────────────────────────────────────────

def test_new_course_defaults_to_active(client, admin_user):
    token = get_token(client, "admin@test.com", "admin123")
    res = _create_course(client, token, "Default Status Course")
    assert res.json()["status"] == "Active"


def test_new_course_defaults_to_onsite(client, admin_user):
    token = get_token(client, "admin@test.com", "admin123")
    res = _create_course(client, token)
    assert res.json()["course_type"] == "onsite"
