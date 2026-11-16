from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from pydantic import BaseModel
from app.core.database import get_db
from app.models.course import Course
from app.models.grade import GradeCategory
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryOut
from app.core.security import get_current_user, require_role


class CopyFromRequest(BaseModel):
    source_course_id: int

router = APIRouter(prefix="/api/courses/{course_id}/categories", tags=["Grade Categories"])


def _ensure_course_access(db: Session, course_id: int, current_user) -> Course:
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role == "teacher" and course.teacher_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")
    return course


@router.get("/", response_model=List[CategoryOut])
def list_categories(course_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _ensure_course_access(db, course_id, current_user)
    return (
        db.query(GradeCategory)
        .filter(GradeCategory.course_id == course_id)
        .order_by(GradeCategory.order_index, GradeCategory.id)
        .all()
    )


@router.post("/", response_model=CategoryOut, status_code=201)
def create_category(
    course_id: int,
    data: CategoryCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    if not db.query(Course).filter(Course.course_id == course_id).first():
        raise HTTPException(status_code=404, detail="Course not found")
    cat = GradeCategory(course_id=course_id, **data.model_dump())
    db.add(cat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A category with this name already exists for this course")
    db.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    course_id: int,
    category_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    cat = (
        db.query(GradeCategory)
        .filter(GradeCategory.id == category_id, GradeCategory.course_id == course_id)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A category with this name already exists for this course")
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
def delete_category(
    course_id: int,
    category_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    cat = (
        db.query(GradeCategory)
        .filter(GradeCategory.id == category_id, GradeCategory.course_id == course_id)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()


@router.post("/copy-from", response_model=List[CategoryOut])
def copy_categories_from(
    course_id: int,
    data: CopyFromRequest,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    """Clone categories from another course into this one. Skips names that already exist."""
    target = db.query(Course).filter(Course.course_id == course_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target course not found")
    source = db.query(Course).filter(Course.course_id == data.source_course_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source course not found")
    if source.course_id == course_id:
        raise HTTPException(status_code=400, detail="Source and target are the same course")

    src_cats = (
        db.query(GradeCategory)
        .filter(GradeCategory.course_id == data.source_course_id)
        .order_by(GradeCategory.order_index, GradeCategory.id)
        .all()
    )
    existing_names = {
        c.name for c in db.query(GradeCategory).filter(GradeCategory.course_id == course_id).all()
    }

    created: list[GradeCategory] = []
    for src in src_cats:
        if src.name in existing_names:
            continue
        clone = GradeCategory(
            course_id=course_id,
            name=src.name,
            max_value=src.max_value,
            kind=src.kind,
            order_index=src.order_index,
        )
        db.add(clone)
        created.append(clone)

    db.commit()
    for c in created:
        db.refresh(c)
    return created
