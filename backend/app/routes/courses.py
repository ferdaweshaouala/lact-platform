from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.user import User
from app.models.course import Course, Session
from app.models.enrollment import Enrollment
from app.models.grade import Grade
from app.schemas.course import CourseCreate, CourseUpdate, CourseOut
from app.core.security import get_current_user, require_role

router = APIRouter(prefix="/api/courses", tags=["Courses"])


@router.get("/", response_model=List[CourseOut])
def list_courses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == "teacher":
        return db.query(Course).filter(Course.teacher_id == current_user.user_id).offset(skip).limit(limit).all()
    if current_user.role == "supervisor":
        return db.query(Course).filter(Course.supervisor_id == current_user.user_id).offset(skip).limit(limit).all()
    return db.query(Course).offset(skip).limit(limit).all()


@router.get("/{course_id}", response_model=CourseOut)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if current_user.role == "teacher" and course.teacher_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")
    if current_user.role == "supervisor" and course.supervisor_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your course")
    return course


def _validate_assignments(db: Session, teacher_id: int | None, supervisor_id: int | None):
    if teacher_id:
        if not db.query(User).filter(User.user_id == teacher_id, User.role == "teacher").first():
            raise HTTPException(status_code=400, detail="Teacher not found")
    if supervisor_id:
        if not db.query(User).filter(User.user_id == supervisor_id, User.role == "supervisor").first():
            raise HTTPException(status_code=400, detail="Supervisor not found")


@router.post("/", response_model=CourseOut, status_code=201)
def create_course(
    data: CourseCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    _validate_assignments(db, data.teacher_id, data.supervisor_id)
    course = Course(**data.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.patch("/{course_id}", response_model=CourseOut)
def update_course(
    course_id: int,
    data: CourseUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    _validate_assignments(db, data.teacher_id, data.supervisor_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}", status_code=204)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Collect enrollment ids first (attendance_records and status_change_log
    # cascade from enrollment_id, but grades do not).
    enrollment_ids = [
        e.enrollment_id
        for e in db.query(Enrollment.enrollment_id)
        .filter(Enrollment.course_id == course_id)
        .all()
    ]

    if enrollment_ids:
        db.query(Grade).filter(Grade.enrollment_id.in_(enrollment_ids)).delete(synchronize_session=False)

    db.query(Enrollment).filter(Enrollment.course_id == course_id).delete(synchronize_session=False)
    db.query(Session).filter(Session.course_id == course_id).delete(synchronize_session=False)
    # GradeCategory.course_id has ondelete=CASCADE, so categories and their
    # grade links are cleaned up by the DB when the course row is deleted.
    db.delete(course)
    db.commit()
