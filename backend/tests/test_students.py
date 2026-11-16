from tests.conftest import get_token


def _create_student(client, token, number="S001"):
    return client.post(
        "/api/students/",
        json={"first_name": "Alice", "last_name": "Smith", "student_number": number},
        headers={"Authorization": f"Bearer {token}"},
    )


def test_supervisor_can_create_student(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _create_student(client, token)
    assert res.status_code == 201
    assert res.json()["student_number"] == "S001"


def test_teacher_cannot_create_student(client, teacher_user):
    token = get_token(client, "teacher@test.com", "teacher123")
    res = _create_student(client, token)
    assert res.status_code == 403


def test_duplicate_student_number_rejected(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    _create_student(client, token, "S002")
    res = _create_student(client, token, "S002")
    assert res.status_code == 400


def test_list_students_requires_auth(client):
    res = client.get("/api/students/")
    assert res.status_code == 401


def _setup_course_and_enroll(client, token, supervisor_user, student_ids):
    """Create a course owned by supervisor_user and enroll the given student IDs."""
    course = client.post(
        "/api/courses/",
        json={"title": "Test Course", "supervisor_id": supervisor_user.user_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert course.status_code == 201
    course_id = course.json()["course_id"]
    for sid in student_ids:
        client.post(
            "/api/enrollments/",
            json={"student_id": sid, "course_id": course_id},
            headers={"Authorization": f"Bearer {token}"},
        )


def test_supervisor_sees_all_students(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    s1 = _create_student(client, token, "S010").json()
    s2 = _create_student(client, token, "S011").json()
    _setup_course_and_enroll(client, token, supervisor_user, [s1["student_id"], s2["student_id"]])
    res = client.get("/api/students/", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert len(res.json()["items"]) == 2


def test_pagination(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    student_ids = [
        _create_student(client, token, f"PAG{i:03d}").json()["student_id"]
        for i in range(5)
    ]
    _setup_course_and_enroll(client, token, supervisor_user, student_ids)
    res = client.get("/api/students/?skip=0&limit=2", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert len(res.json()["items"]) == 2


def test_supervisor_can_delete_student(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    created = _create_student(client, token, "S020").json()
    res = client.delete(f"/api/students/{created['student_id']}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 204
