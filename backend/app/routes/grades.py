from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.core.database import get_db
from app.models.grade import Grade, GradeCategory
from app.models.enrollment import Enrollment
from app.models.course import Course
from app.schemas.grade import GradeCreate, GradeOut
from app.core.security import get_current_user, require_role
from app.core.logging import get_logger

router = APIRouter(prefix="/api/grades", tags=["Grades"])
log = get_logger("dtms.grades")


def _to_out(g: Grade) -> dict:
    return {
        "grade_id": g.grade_id,
        "enrollment_id": g.enrollment_id,
        "type": g.type,
        "category_id": g.category_id,
        "category_name": g.category.name if g.category else None,
        "category_kind": g.category.kind if g.category else None,
        "value": g.value,
        "max_value": g.max_value if g.max_value is not None else (g.category.max_value if g.category else None),
        "session_number": g.session_number,
        "date_recorded": g.date_recorded,
    }


@router.get("/student/{student_id}", response_model=List[GradeOut])
def get_student_grades(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = (
        db.query(Grade)
        .options(joinedload(Grade.category))
        .join(Enrollment, Enrollment.enrollment_id == Grade.enrollment_id)
    )
    if current_user.role == "teacher":
        query = query.join(Course, Course.course_id == Enrollment.course_id).filter(
            Enrollment.student_id == student_id,
            Course.teacher_id == current_user.user_id,
        )
    else:
        query = query.filter(Enrollment.student_id == student_id)
    return [_to_out(g) for g in query.all()]


@router.post("/", response_model=GradeOut, status_code=201)
def create_grade(
    data: GradeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role not in ("teacher", "supervisor", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    enrollment = db.query(Enrollment).filter(Enrollment.enrollment_id == data.enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if current_user.role == "teacher":
        course = db.query(Course).filter(Course.course_id == enrollment.course_id).first()
        if not course or course.teacher_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Not your course")

    # If a category is supplied, validate it belongs to this enrollment's course and enforce its max
    category = None
    if data.category_id is not None:
        category = db.query(GradeCategory).filter(GradeCategory.id == data.category_id).first()
        if not category or category.course_id != enrollment.course_id:
            raise HTTPException(status_code=400, detail="Category does not belong to this enrollment's course")
        if data.value < 0 or data.value > category.max_value:
            raise HTTPException(status_code=400, detail=f"Grade must be between 0 and {category.max_value}")
    else:
        # Legacy free-text path: keep the old 0-100 sanity check
        if not (0 <= data.value <= 100):
            raise HTTPException(status_code=400, detail="Grade must be between 0 and 100")

    payload = data.model_dump()
    if category is not None and payload.get("max_value") is None:
        payload["max_value"] = category.max_value
    grade = Grade(**payload)
    db.add(grade)
    db.commit()
    db.refresh(grade)
    grade = db.query(Grade).options(joinedload(Grade.category)).filter(Grade.grade_id == grade.grade_id).first()
    log.info("grade_created", grade_id=grade.grade_id, enrollment_id=data.enrollment_id,
             category_id=data.category_id, value=data.value, actor=current_user.user_id)
    return _to_out(grade)


@router.delete("/{grade_id}", status_code=204)
def delete_grade(
    grade_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    grade = db.query(Grade).filter(Grade.grade_id == grade_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Grade not found")
    if current_user.role == "teacher":
        enrollment = db.query(Enrollment).filter(Enrollment.enrollment_id == grade.enrollment_id).first()
        course = db.query(Course).filter(Course.course_id == enrollment.course_id).first()
        if not course or course.teacher_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Not your course")
    elif current_user.role not in ("supervisor", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    db.delete(grade)
    db.commit()
