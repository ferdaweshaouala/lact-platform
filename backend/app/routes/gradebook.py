from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.grade import Grade, GradeCategory
from app.models.student import Student
from app.core.security import get_current_user
from app.services.grades import compute_total_pct

router = APIRouter(prefix="/api/courses/{course_id}/gradebook", tags=["Gradebook"])


@router.get("/")
def get_gradebook(
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Matrix view: every enrolled student × every category for one course."""
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role == "teacher" and course.teacher_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")

    categories = (
        db.query(GradeCategory)
        .filter(GradeCategory.course_id == course_id)
        .order_by(GradeCategory.order_index, GradeCategory.id)
        .all()
    )

    enrollments = (
        db.query(Enrollment)
        .options(joinedload(Enrollment.student))
        .filter(Enrollment.course_id == course_id)
        .all()
    )

    enrollment_ids = [e.enrollment_id for e in enrollments]
    grades = (
        db.query(Grade)
        .filter(Grade.enrollment_id.in_(enrollment_ids))
        .all()
        if enrollment_ids else []
    )

    # Index grades: { enrollment_id: { category_id_or_None: [grades…] } }
    grades_idx: dict[int, dict] = {eid: {} for eid in enrollment_ids}
    for g in grades:
        key = g.category_id  # may be None for legacy grades
        grades_idx[g.enrollment_id].setdefault(key, []).append(g)

    rows = []
    for e in enrollments:
        s = e.student
        grades_by_cat: dict[str, list] = {}
        grade_values_by_category: dict[int, list[float]] = {}
        for cat in categories:
            entries = grades_idx.get(e.enrollment_id, {}).get(cat.id, [])
            cell_entries = [
                {
                    "grade_id": g.grade_id,
                    "value": g.value,
                    "session_number": g.session_number,
                }
                for g in sorted(entries, key=lambda x: (x.session_number or 0, x.grade_id))
            ]
            grades_by_cat[str(cat.id)] = cell_entries
            grade_values_by_category[cat.id] = [g.value for g in entries]

        cats_dict = {c.id: c for c in categories}
        total_pct = compute_total_pct(grade_values_by_category, cats_dict)

        rows.append({
            "enrollment_id": e.enrollment_id,
            "student_id": s.student_id if s else None,
            "first_name": s.first_name if s else "",
            "last_name": s.last_name if s else "",
            "student_number": s.student_number if s else "",
            "absences": e.absences,
            "attendance_count": e.attendance_count,
            "makeup_count": e.makeup_count,
            "completion_status": e.completion_status,
            "grades_by_category": grades_by_cat,
            "total_pct": total_pct,
        })

    # Sort rows by student name for stable display
    rows.sort(key=lambda r: (r["first_name"] or "", r["last_name"] or ""))

    return {
        "course": {"course_id": course.course_id, "title": course.title},
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "max_value": c.max_value,
                "kind": c.kind,
                "order_index": c.order_index,
            }
            for c in categories
        ],
        "rows": rows,
    }
