"""Tests for the two-step import pipeline (upload + commit).

Covers: file validation, encoding detection, column mapping,
student matching, grade writing, reimport overwrite, and RBAC.
"""
import io
import pytest
import pandas as pd

from tests.conftest import get_token
from app.models.course import Course
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.models.grade import Grade, GradeCategory


# ── Helpers ──────────────────────────────────────────────────────────────────

def _csv_bytes(rows: list[dict], encoding: str = "utf-8") -> bytes:
    df = pd.DataFrame(rows)
    return df.to_csv(index=False).encode(encoding)


def _xlsx_bytes(rows: list[dict]) -> bytes:
    buf = io.BytesIO()
    pd.DataFrame(rows).to_excel(buf, index=False)
    return buf.getvalue()


def _upload(client, token, content: bytes, filename: str = "data.csv"):
    return client.post(
        "/api/import/upload",
        files={"file": (filename, io.BytesIO(content), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )


def _commit(client, token, payload: dict):
    return client.post(
        "/api/import/commit",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def course(db, teacher_user, supervisor_user):
    c = Course(
        title="Import Test Course",
        status="Active",
        teacher_id=teacher_user.user_id,
        supervisor_id=supervisor_user.user_id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture
def category(db, course):
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


@pytest.fixture
def weekly_category(db, course):
    cat = GradeCategory(
        course_id=course.course_id,
        name="واجب أسبوعي",
        max_value=10.0,
        kind="weekly",
        order_index=1,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


SAMPLE_ROWS = [
    {"الاسم": "علي حسن", "رقم الطالب": "S001", "الدرجة": "85"},
    {"الاسم": "سارة محمد", "رقم الطالب": "S002", "الدرجة": "72"},
]


# ── Upload: happy path ────────────────────────────────────────────────────────

def test_upload_csv_returns_token(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _upload(client, token, _csv_bytes(SAMPLE_ROWS))
    assert res.status_code == 200
    body = res.json()
    assert "token" in body
    assert body["row_count"] == 2
    assert "الاسم" in body["headers"]


def test_upload_xlsx_returns_token(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _upload(client, token, _xlsx_bytes(SAMPLE_ROWS), filename="data.xlsx")
    assert res.status_code == 200
    assert res.json()["row_count"] == 2


def test_upload_returns_sample_rows(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _upload(client, token, _csv_bytes(SAMPLE_ROWS))
    assert len(res.json()["sample"]) == 2


def test_upload_teacher_allowed(client, teacher_user):
    token = get_token(client, "teacher@test.com", "teacher123")
    res = _upload(client, token, _csv_bytes(SAMPLE_ROWS))
    assert res.status_code == 200


def test_upload_admin_allowed(client, admin_user):
    token = get_token(client, "admin@test.com", "admin123")
    res = _upload(client, token, _csv_bytes(SAMPLE_ROWS))
    assert res.status_code == 200


# ── Upload: validation errors ─────────────────────────────────────────────────

def test_upload_requires_auth(client):
    res = client.post("/api/import/upload", files={"file": ("f.csv", io.BytesIO(b"a,b\n1,2"), "text/csv")})
    assert res.status_code == 401


def test_upload_empty_file_rejected(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _upload(client, token, b"")
    assert res.status_code == 400
    assert "empty" in res.json()["detail"].lower()


def test_upload_single_column_rejected(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _upload(client, token, b"name\nAli\nSara")
    assert res.status_code == 400
    assert "2 columns" in res.json()["detail"]


def test_upload_cp1256_arabic_csv(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    content = _csv_bytes(SAMPLE_ROWS, encoding="cp1256")
    res = _upload(client, token, content)
    assert res.status_code == 200


# ── Commit: happy path ────────────────────────────────────────────────────────

def _full_import(client, token_str, course, category):
    """Upload then commit — returns commit response."""
    rows = [
        {"الاسم": "علي حسن", "رقم الطالب": "S001", "الدرجة": "85"},
        {"الاسم": "سارة محمد", "رقم الطالب": "S002", "الدرجة": "72"},
    ]
    upload_res = _upload(client, token_str, _csv_bytes(rows))
    assert upload_res.status_code == 200, upload_res.text
    tok = upload_res.json()["token"]

    return _commit(client, token_str, {
        "token": tok,
        "course_id": course.course_id,
        "student_name_col": "الاسم",
        "student_number_col": "رقم الطالب",
        "grade_cols": [{"header": "الدرجة", "category_id": category.id}],
    })


def test_commit_creates_students_and_grades(client, db, supervisor_user, course, category):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _full_import(client, token, course, category)
    assert res.status_code == 200
    body = res.json()
    assert body["students_imported"] == 2
    assert body["grades_imported"] == 2
    assert body["failed_rows"] == 0
    assert body["errors"] == []


def test_commit_creates_students_in_db(client, db, supervisor_user, course, category):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    _full_import(client, token, course, category)
    db.expire_all()
    assert db.query(Student).filter(Student.student_number == "S001").first() is not None
    assert db.query(Student).filter(Student.student_number == "S002").first() is not None


def test_commit_enrolls_students(client, db, supervisor_user, course, category):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    _full_import(client, token, course, category)
    db.expire_all()
    count = db.query(Enrollment).filter(Enrollment.course_id == course.course_id).count()
    assert count == 2


def test_commit_writes_grades(client, db, supervisor_user, course, category):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    _full_import(client, token, course, category)
    db.expire_all()
    grades = db.query(Grade).filter(Grade.source == "excel").all()
    values = {g.value for g in grades}
    assert 85.0 in values
    assert 72.0 in values


def test_commit_deletes_staging_token_after_success(client, supervisor_user, course, category):
    from app.models.imports import StagedImport
    token = get_token(client, "supervisor@test.com", "supervisor123")
    upload_res = _upload(client, token, _csv_bytes(SAMPLE_ROWS))
    tok = upload_res.json()["token"]
    _commit(client, token, {
        "token": tok, "course_id": course.course_id,
        "student_name_col": "الاسم", "student_number_col": "رقم الطالب",
        "grade_cols": [{"header": "الدرجة", "category_id": category.id}],
    })
    # Token must be consumed — second use should fail
    res2 = _commit(client, token, {
        "token": tok, "course_id": course.course_id,
        "student_name_col": "الاسم",
        "grade_cols": [{"header": "الدرجة", "category_id": category.id}],
    })
    assert res2.status_code == 404


def test_commit_reimport_overwrites_excel_grades(client, db, supervisor_user, course, category):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    _full_import(client, token, course, category)

    rows2 = [{"الاسم": "علي حسن", "رقم الطالب": "S001", "الدرجة": "95"}]
    upload_res = _upload(client, token, _csv_bytes(rows2))
    tok = upload_res.json()["token"]
    _commit(client, token, {
        "token": tok, "course_id": course.course_id,
        "student_name_col": "الاسم", "student_number_col": "رقم الطالب",
        "grade_cols": [{"header": "الدرجة", "category_id": category.id}],
    })

    db.expire_all()
    s = db.query(Student).filter(Student.student_number == "S001").first()
    e = db.query(Enrollment).filter(
        Enrollment.student_id == s.student_id,
        Enrollment.course_id == course.course_id,
    ).first()
    grades = db.query(Grade).filter(Grade.enrollment_id == e.enrollment_id, Grade.source == "excel").all()
    assert len(grades) == 1
    assert grades[0].value == 95.0


def test_commit_weekly_category_with_session_number(client, db, supervisor_user, course, weekly_category):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    rows = [{"الاسم": "علي حسن", "رقم الطالب": "S001", "واجب 1": "8", "واجب 2": "9"}]
    upload_res = _upload(client, token, _csv_bytes(rows))
    tok = upload_res.json()["token"]
    res = _commit(client, token, {
        "token": tok, "course_id": course.course_id,
        "student_name_col": "الاسم", "student_number_col": "رقم الطالب",
        "grade_cols": [
            {"header": "واجب 1", "category_id": weekly_category.id, "session_number": 1},
            {"header": "واجب 2", "category_id": weekly_category.id, "session_number": 2},
        ],
    })
    assert res.status_code == 200
    assert res.json()["grades_imported"] == 2


# ── Commit: validation errors ─────────────────────────────────────────────────

def test_commit_invalid_token_returns_404(client, supervisor_user, course):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    res = _commit(client, token, {
        "token": "00000000-0000-0000-0000-000000000000",
        "course_id": course.course_id,
        "student_name_col": "name",
        "grade_cols": [],
    })
    assert res.status_code == 404


def test_commit_nonexistent_course_returns_404(client, supervisor_user):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    upload_res = _upload(client, token, _csv_bytes(SAMPLE_ROWS))
    tok = upload_res.json()["token"]
    res = _commit(client, token, {
        "token": tok,
        "course_id": 99999,
        "student_name_col": "الاسم",
        "grade_cols": [],
    })
    assert res.status_code == 404


def test_commit_missing_column_returns_400(client, supervisor_user, course, category):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    upload_res = _upload(client, token, _csv_bytes(SAMPLE_ROWS))
    tok = upload_res.json()["token"]
    res = _commit(client, token, {
        "token": tok,
        "course_id": course.course_id,
        "student_name_col": "DOES_NOT_EXIST",
        "grade_cols": [{"header": "الدرجة", "category_id": category.id}],
    })
    assert res.status_code == 400
    assert "not found in file" in res.json()["detail"].lower()


def test_commit_invalid_category_id_returns_400(client, supervisor_user, course):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    upload_res = _upload(client, token, _csv_bytes(SAMPLE_ROWS))
    tok = upload_res.json()["token"]
    res = _commit(client, token, {
        "token": tok,
        "course_id": course.course_id,
        "student_name_col": "الاسم",
        "grade_cols": [{"header": "الدرجة", "category_id": 99999}],
    })
    assert res.status_code == 400
    assert "unknown category" in res.json()["detail"].lower()


def test_commit_non_numeric_grade_returns_row_error(client, supervisor_user, course, category):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    rows = [{"الاسم": "علي حسن", "رقم الطالب": "S001", "الدرجة": "N/A"}]
    upload_res = _upload(client, token, _csv_bytes(rows))
    tok = upload_res.json()["token"]
    res = _commit(client, token, {
        "token": tok,
        "course_id": course.course_id,
        "student_name_col": "الاسم",
        "student_number_col": "رقم الطالب",
        "grade_cols": [{"header": "الدرجة", "category_id": category.id}],
    })
    assert res.status_code == 200
    body = res.json()
    assert body["failed_rows"] == 1
    assert "non-numeric" in body["errors"][0]["reason"].lower()


def test_commit_grade_exceeds_max_returns_row_error(client, supervisor_user, course, category):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    rows = [{"الاسم": "علي حسن", "رقم الطالب": "S001", "الدرجة": "150"}]  # max is 100
    upload_res = _upload(client, token, _csv_bytes(rows))
    tok = upload_res.json()["token"]
    res = _commit(client, token, {
        "token": tok,
        "course_id": course.course_id,
        "student_name_col": "الاسم",
        "student_number_col": "رقم الطالب",
        "grade_cols": [{"header": "الدرجة", "category_id": category.id}],
    })
    assert res.status_code == 200
    body = res.json()
    assert body["failed_rows"] == 1
    assert "exceeds max" in body["errors"][0]["reason"].lower()


def test_commit_duplicate_student_number_in_file_returns_error(client, supervisor_user, course, category):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    rows = [
        {"الاسم": "علي حسن", "رقم الطالب": "S001", "الدرجة": "80"},
        {"الاسم": "علي حسن مكرر", "رقم الطالب": "S001", "الدرجة": "90"},
    ]
    upload_res = _upload(client, token, _csv_bytes(rows))
    tok = upload_res.json()["token"]
    res = _commit(client, token, {
        "token": tok,
        "course_id": course.course_id,
        "student_name_col": "الاسم",
        "student_number_col": "رقم الطالب",
        "grade_cols": [{"header": "الدرجة", "category_id": category.id}],
    })
    assert res.status_code == 200
    body = res.json()
    assert body["failed_rows"] >= 1


def test_commit_missing_student_name_row_skipped(client, supervisor_user, course, category):
    token = get_token(client, "supervisor@test.com", "supervisor123")
    rows = [
        {"الاسم": "", "رقم الطالب": "S001", "الدرجة": "80"},
        {"الاسم": "سارة محمد", "رقم الطالب": "S002", "الدرجة": "70"},
    ]
    upload_res = _upload(client, token, _csv_bytes(rows))
    tok = upload_res.json()["token"]
    res = _commit(client, token, {
        "token": tok,
        "course_id": course.course_id,
        "student_name_col": "الاسم",
        "student_number_col": "رقم الطالب",
        "grade_cols": [{"header": "الدرجة", "category_id": category.id}],
    })
    assert res.status_code == 200
    body = res.json()
    assert body["failed_rows"] == 1
    assert "missing student name" in body["errors"][0]["reason"].lower()


def test_commit_non_regular_category_duplicate_mapping_rejected(client, supervisor_user, course, category):
    """Two grade_cols mapping to the same non-weekly category must be rejected."""
    token = get_token(client, "supervisor@test.com", "supervisor123")
    rows = [{"الاسم": "علي", "درجة1": "50", "درجة2": "30"}]
    upload_res = _upload(client, token, _csv_bytes(rows))
    tok = upload_res.json()["token"]
    res = _commit(client, token, {
        "token": tok,
        "course_id": course.course_id,
        "student_name_col": "الاسم",
        "grade_cols": [
            {"header": "درجة1", "category_id": category.id},
            {"header": "درجة2", "category_id": category.id},   # duplicate non-weekly
        ],
    })
    assert res.status_code == 400
