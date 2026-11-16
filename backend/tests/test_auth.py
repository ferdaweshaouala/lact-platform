from tests.conftest import get_token


def test_login_success(client, admin_user):
    res = client.post("/api/auth/login", data={"username": "admin@test.com", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "admin"


def test_login_wrong_password(client, admin_user):
    res = client.post("/api/auth/login", data={"username": "admin@test.com", "password": "wrong"})
    assert res.status_code == 401


def test_login_unknown_email(client):
    res = client.post("/api/auth/login", data={"username": "nobody@test.com", "password": "pass"})
    assert res.status_code == 401


def test_login_sets_httponly_cookie(client, admin_user):
    res = client.post("/api/auth/login", data={"username": "admin@test.com", "password": "admin123"})
    assert res.status_code == 200
    assert "dtms_token" in res.cookies


def test_me_with_token(client, admin_user):
    token = get_token(client, "admin@test.com", "admin123")
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "admin@test.com"


def test_me_without_token(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_register_requires_admin(client, teacher_user):
    """Public registration is closed — must be admin."""
    teacher_token = get_token(client, "teacher@test.com", "teacher123")
    res = client.post(
        "/api/auth/register",
        json={"first_name": "New", "last_name": "User", "email": "new@test.com", "password": "pass1234", "role": "teacher"},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert res.status_code == 403


def test_register_unauthenticated_is_rejected(client):
    """Unauthenticated registration must fail."""
    res = client.post(
        "/api/auth/register",
        json={"first_name": "Hacker", "last_name": "X", "email": "hack@test.com", "password": "pass1234", "role": "admin"},
    )
    assert res.status_code == 401


def test_admin_can_register_user(client, admin_user):
    token = get_token(client, "admin@test.com", "admin123")
    res = client.post(
        "/api/auth/register",
        json={"first_name": "Jane", "last_name": "Doe", "email": "jane@test.com", "password": "pass1234", "role": "teacher"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    assert res.json()["email"] == "jane@test.com"


def test_logout_clears_cookie(client, admin_user):
    client.post("/api/auth/login", data={"username": "admin@test.com", "password": "admin123"})
    res = client.post("/api/auth/logout")
    assert res.status_code == 200
