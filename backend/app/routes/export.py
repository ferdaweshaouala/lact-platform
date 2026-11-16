import io
import csv
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.student import Student
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.grade import Grade
from app.core.security import require_role

router = APIRouter(prefix="/api/export", tags=["Export"])

_HEADERS = {
    'en': [
        "Student Name", "Student Number", "Course",
        "Enrollment Date", "Status", "Avg Grade", "Grade Count",
        "Present", "Absent", "Makeup", "Attendance %",
    ],
    'fr': [
        "Nom", "Numéro", "Cours",
        "Date d'inscription", "Statut", "Note moyenne", "Nb notes",
        "Présences", "Absences", "Rattrapage", "% Présences",
    ],
    'ar': [
        "اسم الطالبة", "الرقم", "الدورة",
        "تاريخ التسجيل", "الحالة", "متوسط الدرجة", "عدد الدرجات",
        "حضور", "غياب", "تعويض", "نسبة الحضور %",
    ],
}

_STATUS = {
    'en': {'Ongoing': 'Ongoing', 'Completed': 'Completed', 'Dropped': 'Dropped'},
    'fr': {'Ongoing': 'En cours', 'Completed': 'Terminé', 'Dropped': 'Abandonnée'},
    'ar': {'Ongoing': 'جارية', 'Completed': 'مكتملة', 'Dropped': 'منسحبة'},
}


@router.get("/enrollments")
def export_enrollments(
    course_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    lang: Optional[str] = Query("en", description="en | fr | ar"),
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    """
    Export enrollment records as CSV in the requested language.
    Columns: name, number, course, enrollment date, status, avg grade,
             grade count, present, absent, makeup, attendance %.
    """
    if lang not in _HEADERS:
        lang = "en"

    query = (
        db.query(
            Student.first_name,
            Student.last_name,
            Student.student_number,
            Course.title.label("course_title"),
            Enrollment.enrollment_date,
            Enrollment.completion_status,
            Enrollment.enrollment_id,
            Enrollment.attendance_count,
            Enrollment.absences,
            Enrollment.makeup_count,
        )
        .join(Enrollment, Enrollment.student_id == Student.student_id)
        .join(Course, Course.course_id == Enrollment.course_id)
    )

    if course_id:
        query = query.filter(Enrollment.course_id == course_id)
    if date_from:
        query = query.filter(Enrollment.enrollment_date >= date_from)
    if date_to:
        query = query.filter(Enrollment.enrollment_date <= date_to)

    rows = query.order_by(Course.title, Student.last_name, Student.first_name).all()

    grade_stats = dict(
        db.query(Enrollment.enrollment_id, func.avg(Grade.value))
        .join(Grade, Grade.enrollment_id == Enrollment.enrollment_id)
        .group_by(Enrollment.enrollment_id)
        .all()
    )
    grade_counts = dict(
        db.query(Enrollment.enrollment_id, func.count(Grade.grade_id))
        .join(Grade, Grade.enrollment_id == Enrollment.enrollment_id)
        .group_by(Enrollment.enrollment_id)
        .all()
    )

    output = io.StringIO()
    output.write('﻿')  # UTF-8 BOM so Excel auto-detects encoding
    writer = csv.writer(output)
    writer.writerow(_HEADERS[lang])

    status_map = _STATUS[lang]
    for r in rows:
        full_name = f"{r.first_name} {r.last_name}".strip()
        avg = grade_stats.get(r.enrollment_id)
        count = grade_counts.get(r.enrollment_id, 0)
        present = r.attendance_count or 0
        absent = r.absences or 0
        makeup = r.makeup_count or 0
        total = present + absent + makeup
        att_pct = f"{round((present + makeup) / total * 100, 1)}%" if total > 0 else ""
        writer.writerow([
            full_name,
            r.student_number,
            r.course_title,
            r.enrollment_date.isoformat() if r.enrollment_date else "",
            status_map.get(r.completion_status, r.completion_status),
            round(avg, 2) if avg is not None else "",
            count,
            present,
            absent,
            makeup,
            att_pct,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=enrollments_export.csv"},
    )
