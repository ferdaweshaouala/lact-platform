import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.models.course import Course
from app.schemas.student import StudentCreate, StudentUpdate, StudentOut
from app.core.security import get_current_user, require_role

router = APIRouter(prefix="/api/students", tags=["Students"])


@router.get("/search")
def search_students(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Search students by name or student number, scoped by role."""
    term = f"%{q}%"
    base = (
        db.query(Student)
        .filter(
            or_(
                Student.first_name.ilike(term),
                Student.last_name.ilike(term),
                Student.student_number.ilike(term),
            )
        )
    )
    if current_user.role == "teacher":
        base = (
            base
            .join(Enrollment, Enrollment.student_id == Student.student_id)
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(Course.teacher_id == current_user.user_id)
            .distinct()
        )
    elif current_user.role == "supervisor":
        supervised_ids = (
            db.query(Course.course_id)
            .filter(Course.supervisor_id == current_user.user_id)
            .subquery()
        )
        base = (
            base
            .join(Enrollment, Enrollment.student_id == Student.student_id)
            .filter(Enrollment.course_id.in_(supervised_ids))
            .distinct()
        )

    students = base.limit(10).all()

    results = []
    for s in students:
        enrollments = (
            db.query(Enrollment.enrollment_id, Course.title, Enrollment.completion_status)
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(Enrollment.student_id == s.student_id)
            .all()
        )
        results.append({
            "student_id": s.student_id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "student_number": s.student_number,
            "enrollments": [
                {"enrollment_id": e[0], "course_title": e[1], "status": e[2]}
                for e in enrollments
            ],
        })

    return results


@router.get("/")
def list_students(
    skip: int = 0,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return a paginated student list with a total count.

    Response: { total: int, skip: int, limit: int, items: StudentOut[] }
    The `total` field lets the frontend detect truncation and render pagination
    controls without issuing a separate count request.
    """
    if current_user.role == "teacher":
        base = (
            db.query(Student)
            .join(Enrollment, Enrollment.student_id == Student.student_id)
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(Course.teacher_id == current_user.user_id)
            .distinct()
        )
    elif current_user.role == "supervisor":
        base = (
            db.query(Student)
            .join(Enrollment, Enrollment.student_id == Student.student_id)
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(Course.supervisor_id == current_user.user_id)
            .distinct()
        )
    else:
        base = db.query(Student)

    total = base.count()
    items = base.offset(skip).limit(limit).all()
    return {"total": total, "skip": skip, "limit": limit, "items": items}


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if current_user.role == "teacher":
        is_assigned = (
            db.query(Enrollment)
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(
                Enrollment.student_id == student_id,
                Course.teacher_id == current_user.user_id,
            )
            .first()
        )
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Not your student")
    elif current_user.role == "supervisor":
        is_assigned = (
            db.query(Enrollment)
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(
                Enrollment.student_id == student_id,
                Course.supervisor_id == current_user.user_id,
            )
            .first()
        )
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Not your student")
    return student


@router.post("/", response_model=StudentOut, status_code=201)
def create_student(
    data: StudentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("supervisor")),
):
    if db.query(Student).filter(Student.student_number == data.student_number).first():
        raise HTTPException(status_code=400, detail="Student number already exists")
    student = Student(**data.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    data: StudentUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role("supervisor")),
):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(student, field, value)
    db.commit()
    db.refresh(student)
    return student


@router.post("/import-csv", status_code=200)
async def import_students_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_role("supervisor", "admin")),
):
    """Bulk-import students from a CSV file.

    Expected columns (header row required, order does not matter):
      last_name, first_name, student_number,
      phone_number (opt), city (opt), profession (opt),
      date_of_birth (opt, YYYY-MM-DD), email (opt)

    Returns:
      { created, skipped, errors: [{ row, student_number, reason }] }
    """
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")   # handles BOM from Excel
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty or has no header row.")

    # Normalise header names (strip whitespace, lowercase)
    reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]

    REQUIRED = {"last_name", "first_name", "student_number"}
    missing = REQUIRED - set(reader.fieldnames)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(sorted(missing))}. "
                   f"Found: {', '.join(reader.fieldnames)}"
        )

    created = 0
    skipped = 0
    errors = []

    for row_num, row in enumerate(reader, start=2):   # start=2 because row 1 is header
        row = {k.strip(): (v.strip() if v else "") for k, v in row.items()}

        student_number = row.get("student_number", "").strip()
        first_name     = row.get("first_name", "").strip()
        last_name      = row.get("last_name", "").strip()

        if not student_number or not first_name or not last_name:
            errors.append({
                "row": row_num,
                "student_number": student_number or "—",
                "reason": "last_name, first_name and student_number are required",
            })
            continue

        # Skip duplicates
        if db.query(Student).filter(Student.student_number == student_number).first():
            skipped += 1
            continue

        # Parse optional date
        dob = None
        raw_dob = row.get("date_of_birth", "").strip()
        if raw_dob:
            from datetime import date as date_type
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                try:
                    dob = date_type.fromisoformat(raw_dob) if fmt == "%Y-%m-%d" else \
                          date_type.strptime(raw_dob, fmt).date() if hasattr(date_type, "strptime") else None
                    break
                except Exception:
                    continue

        email_val = row.get("email", "").strip() or None

        try:
            student = Student(
                first_name=first_name,
                last_name=last_name,
                student_number=student_number,
                email=email_val,
                phone_number=row.get("phone_number", "").strip() or None,
                city=row.get("city", "").strip() or None,
                profession=row.get("profession", "").strip() or None,
                date_of_birth=dob,
            )
            db.add(student)
            db.flush()   # get the ID without committing yet
            created += 1
        except Exception as exc:
            db.rollback()
            errors.append({
                "row": row_num,
                "student_number": student_number,
                "reason": str(exc),
            })
            continue

    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


@router.get("/{student_id}/attendance-summary")
def get_student_attendance_summary(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return per-course attendance breakdown + recent session history for a student."""
    from app.models.attendance import AttendanceRecord
    from app.models.curriculum import CurriculumSession, CurriculumAttendance

    # --- access check ---
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if current_user.role == "teacher":
        ok = (
            db.query(Enrollment)
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(Enrollment.student_id == student_id, Course.teacher_id == current_user.user_id)
            .first()
        )
        if not ok:
            raise HTTPException(status_code=403, detail="Not your student")
    elif current_user.role == "supervisor":
        ok = (
            db.query(Enrollment)
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(Enrollment.student_id == student_id, Course.supervisor_id == current_user.user_id)
            .first()
        )
        if not ok:
            raise HTTPException(status_code=403, detail="Not your student")

    # --- data ---
    enrollments = db.query(Enrollment).filter(Enrollment.student_id == student_id).all()
    enrollment_ids = [e.enrollment_id for e in enrollments]
    enrollment_map = {e.enrollment_id: e for e in enrollments}
    course_ids = list({e.course_id for e in enrollments})
    courses = {c.course_id: c for c in db.query(Course).filter(Course.course_id.in_(course_ids)).all()} if course_ids else {}

    # per-course counters
    course_summary: dict = {}
    for e in enrollments:
        c = courses.get(e.course_id)
        course_summary[e.course_id] = {
            "course_id": e.course_id,
            "course_title": c.title if c else f"Course #{e.course_id}",
            "present": 0, "absent": 0, "makeup": 0,
        }

    recent = []

    # curriculum-based attendance
    if enrollment_ids:
        cur_rows = (
            db.query(CurriculumAttendance, CurriculumSession)
            .join(CurriculumSession, CurriculumSession.id == CurriculumAttendance.curriculum_session_id)
            .filter(CurriculumAttendance.enrollment_id.in_(enrollment_ids))
            .all()
        )
        for ca, cs in cur_rows:
            enr = enrollment_map.get(ca.enrollment_id)
            if not enr:
                continue
            cid = enr.course_id
            if cid in course_summary:
                course_summary[cid][ca.status] = course_summary[cid].get(ca.status, 0) + 1
            c = courses.get(cid)
            date_str = ca.date_recorded.isoformat() if ca.date_recorded else None
            recent.append({
                "source": "curriculum",
                "date": date_str,
                "label": f"Sem. {cs.week_number} — {cs.title}",
                "week_number": cs.week_number,
                "session_type": cs.session_type,
                "course_title": c.title if c else f"Course #{cid}",
                "status": ca.status,
            })

        # date-based attendance
        date_rows = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.enrollment_id.in_(enrollment_ids))
            .all()
        )
        for ar in date_rows:
            enr = enrollment_map.get(ar.enrollment_id)
            if not enr:
                continue
            cid = enr.course_id
            if cid in course_summary:
                course_summary[cid][ar.status] = course_summary[cid].get(ar.status, 0) + 1
            c = courses.get(cid)
            date_str = ar.session_date.isoformat() if ar.session_date else None
            recent.append({
                "source": "date",
                "date": date_str,
                "label": date_str or "—",
                "week_number": None,
                "session_type": None,
                "course_title": c.title if c else f"Course #{cid}",
                "status": ar.status,
            })

    # sort recent by date desc, keep last 15
    recent.sort(key=lambda x: x.get("date") or "", reverse=True)
    recent = recent[:15]

    summaries = []
    for cid, s in course_summary.items():
        total = s["present"] + s["absent"] + s["makeup"]
        pct = round((s["present"] / total) * 100) if total > 0 else None
        summaries.append({**s, "total": total, "attendance_pct": pct})

    return {"course_summaries": summaries, "recent_sessions": recent}


@router.delete("/{student_id}", status_code=204)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("supervisor")),
):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(student)
    db.commit()
