import io
import json
import uuid
from datetime import timedelta
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.grade import Grade, GradeCategory
from app.models.imports import StagedImport
from app.models.student import Student
from app.core.security import require_role, _utcnow
from app.core.logging import get_logger

router = APIRouter(prefix="/api/import", tags=["Import"])
log = get_logger("dtms.imports")

STAGING_TTL_MINUTES = 30

# 50 MB — large enough for real-world grade sheets with hundreds of students and
# many weekly columns (tested up to ~40 MB xlsx), while still protecting against
# accidental or malicious oversized uploads that would OOM the container.
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


# ── Schemas ───────────────────────────────────────────────────────────────────

class GradeColMapping(BaseModel):
    header: str
    category_id: int
    session_number: Optional[int] = None    # required for weekly-kind categories


class CommitRequest(BaseModel):
    token: str
    course_id: int
    student_name_col: str
    student_number_col: Optional[str] = None
    grade_cols: list[GradeColMapping]


class RowError(BaseModel):
    row: int
    student: str
    reason: str


class CommitResult(BaseModel):
    students_imported: int
    grades_imported: int
    failed_rows: int
    errors: list[RowError]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _read_file(content: bytes, filename: str) -> pd.DataFrame:
    if filename.endswith((".xlsx", ".xls")):
        return pd.read_excel(io.BytesIO(content), dtype=str)
    for enc in ("utf-8", "utf-8-sig", "cp1256", "latin-1"):
        try:
            return pd.read_csv(io.StringIO(content.decode(enc)), dtype=str)
        except (UnicodeDecodeError, Exception):
            continue
    raise HTTPException(
        status_code=400,
        detail="Could not decode file. Save as UTF-8 CSV or .xlsx and try again.",
    )


def _purge_expired(db: Session) -> None:
    """Delete expired staging rows. Called on every upload to keep the table clean."""
    db.query(StagedImport).filter(StagedImport.expires_at < _utcnow()).delete()
    db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor", "teacher")),
):
    """
    Step 1 — upload a CSV or Excel file.
    Returns detected headers, row count, sample rows, and a session token
    that must be passed to /commit. Token expires in 30 minutes.
    """
    _purge_expired(db)

    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    try:
        df = _read_file(content, file.filename or "")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all")

    if len(df.columns) < 2:
        raise HTTPException(status_code=400, detail="File must have at least 2 columns.")

    token = str(uuid.uuid4())
    staged = StagedImport(
        id=token,
        row_data=df.to_json(orient="records", force_ascii=False),
        headers=json.dumps(list(df.columns), ensure_ascii=False),
        filename=file.filename,
        row_count=len(df),
        expires_at=_utcnow() + timedelta(minutes=STAGING_TTL_MINUTES),
    )
    db.add(staged)
    db.commit()

    return {
        "token": token,
        "headers": list(df.columns),
        "row_count": len(df),
        "sample": df.head(3).fillna("").to_dict(orient="records"),
    }


@router.post("/commit", response_model=CommitResult)
def commit_import(
    data: CommitRequest,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor", "teacher")),
):
    """
    Step 2 — apply the column mapping and write to the database.
    Returns how many students and grades were imported plus a per-row error list.
    """
    staged = db.query(StagedImport).filter(StagedImport.id == data.token).first()
    if staged is None or staged.expires_at < _utcnow():
        if staged:
            db.delete(staged)
            db.commit()
        raise HTTPException(
            status_code=404,
            detail="Upload session not found or expired. Please re-upload the file.",
        )

    df: pd.DataFrame = pd.read_json(  # type: ignore[call-overload]
        staged.row_data, orient="records", dtype=str
    )
    df.columns = [str(c).strip() for c in df.columns]

    course = db.query(Course).filter(Course.course_id == data.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    # Validate all mapped columns exist in the file
    expected = [data.student_name_col] + [g.header for g in data.grade_cols]
    if data.student_number_col:
        expected.append(data.student_number_col)
    missing = [c for c in expected if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Columns not found in file: {missing}")

    # Load all categories for this course so we can validate mappings
    categories = {
        c.id: c for c in db.query(GradeCategory).filter(GradeCategory.course_id == data.course_id).all()
    }
    bad_cat_ids = [g.category_id for g in data.grade_cols if g.category_id not in categories]
    if bad_cat_ids:
        raise HTTPException(status_code=400, detail=f"Unknown category ids for this course: {bad_cat_ids}")

    # For non-weekly categories, only one column may map to a single category
    seen_non_weekly: set[int] = set()
    for g in data.grade_cols:
        cat = categories[g.category_id]
        if cat.kind != "weekly":
            if g.category_id in seen_non_weekly:
                raise HTTPException(
                    status_code=400,
                    detail=f"Category '{cat.name}' is mapped by more than one column but is not 'weekly'.",
                )
            seen_non_weekly.add(g.category_id)

    # ── Phase 1: validate every row without touching the DB ──────────────────
    errors: list[RowError] = []
    seen_numbers: set[str] = set()

    class ValidatedRow:
        def __init__(self, name: str, student_number: Optional[str], parsed_grades: list[dict]):
            self.name = name
            self.student_number = student_number
            self.parsed_grades = parsed_grades

    validated: list[ValidatedRow] = []

    for idx, row in df.iterrows():
        row_num = int(idx) + 2  # type: ignore[arg-type]
        name = str(row[data.student_name_col]).strip()

        if not name or name.lower() in ("nan", "none"):
            errors.append(RowError(row=row_num, student="", reason="Missing student name"))
            continue

        student_number: Optional[str] = None
        if data.student_number_col:
            raw = str(row[data.student_number_col]).strip()
            if raw and raw.lower() not in ("nan", "none"):
                student_number = raw
                if student_number in seen_numbers:
                    errors.append(RowError(
                        row=row_num, student=name,
                        reason=f"Duplicate student number '{student_number}' in this import",
                    ))
                    continue
                seen_numbers.add(student_number)

        row_grade_errors: list[str] = []
        parsed_grades: list[dict] = []
        for col_map in data.grade_cols:
            raw_val = str(row.get(col_map.header, "")).strip()
            if not raw_val or raw_val.lower() in ("nan", "none"):
                continue
            try:
                val = float(raw_val.replace(",", "."))
            except ValueError:
                row_grade_errors.append(f"Non-numeric value '{raw_val}' in column '{col_map.header}'")
                continue
            cat = categories[col_map.category_id]
            if val > cat.max_value:
                row_grade_errors.append(f"Value {val} exceeds max {cat.max_value} in '{col_map.header}' ({cat.name})")
                continue
            parsed_grades.append({
                "category_id": col_map.category_id,
                "value": val,
                "max_value": cat.max_value,
                "session_number": col_map.session_number,
                "category_name": cat.name,
            })

        if row_grade_errors:
            errors.append(RowError(row=row_num, student=name, reason="; ".join(row_grade_errors)))
            continue

        validated.append(ValidatedRow(name, student_number, parsed_grades))

    # If any row failed validation, abort — delete staging record and return errors
    if errors:
        db.delete(staged)
        db.commit()
        return CommitResult(students_imported=0, grades_imported=0, failed_rows=len(errors), errors=errors)

    # ── Phase 2: write all rows in a single atomic transaction ────────────────
    students_imported = 0
    grades_imported = 0
    try:
        for vrow in validated:
            student = None
            if vrow.student_number:
                student = db.query(Student).filter(Student.student_number == vrow.student_number).first()
            if not student:
                student = (
                    db.query(Student)
                    .join(Enrollment, Enrollment.student_id == Student.student_id)
                    .filter(Enrollment.course_id == data.course_id, Student.first_name == vrow.name)
                    .first()
                )
            if not student:
                parts = vrow.name.split(" ", 1)
                student = Student(
                    first_name=parts[0],
                    last_name=parts[1] if len(parts) > 1 else "",
                    student_number=vrow.student_number or f"IMP-{uuid.uuid4().hex[:8].upper()}",
                )
                db.add(student)
                db.flush()

            enrollment = db.query(Enrollment).filter(
                Enrollment.student_id == student.student_id,
                Enrollment.course_id == data.course_id,
            ).first()
            if not enrollment:
                enrollment = Enrollment(student_id=student.student_id, course_id=data.course_id)
                db.add(enrollment)
                db.flush()

            db.query(Grade).filter(
                Grade.enrollment_id == enrollment.enrollment_id,
                Grade.source == "excel",
            ).delete()

            for g in vrow.parsed_grades:
                db.add(Grade(
                    enrollment_id=enrollment.enrollment_id,
                    category_id=g["category_id"],
                    type=g["category_name"],
                    value=g["value"],
                    max_value=g["max_value"],
                    session_number=g["session_number"],
                    source="excel",
                ))
                grades_imported += 1

            students_imported += 1

        db.delete(staged)
        db.commit()
    except Exception as e:
        db.rollback()
        log.error("import_commit_failed", error=str(e), course_id=data.course_id)
        raise HTTPException(status_code=500, detail="Import failed, no changes were saved. Please try again.")

    log.info("import_committed", course_id=data.course_id,
             students_imported=students_imported, grades_imported=grades_imported)
    return CommitResult(
        students_imported=students_imported,
        grades_imported=grades_imported,
        failed_rows=0,
        errors=[],
    )
