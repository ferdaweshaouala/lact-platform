from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.student import Student
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.schemas.student_enrollment import (
    AvailableCourseOut, StudentEnrollRequest, StudentEnrollmentOut,
)

router = APIRouter(prefix="/api/student", tags=["Student Enrollment"])


def _require_student_profile(current_user, db: Session) -> Student:
    """Every student-facing endpoint derives the Student row from the
    authenticated User — never from a client-supplied ID."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Student access only")
    student = db.query(Student).filter(Student.user_id == current_user.user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return student


@router.get("/available-courses", response_model=list[AvailableCourseOut])
def list_available_courses(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Active courses a student can request to join. Course content itself
    is not exposed here — just enough to pick one (name-only, per current step)."""
    _require_student_profile(current_user, db)
    return db.query(Course).filter(Course.status == "Active").all()


@router.get("/me/enrollment", response_model=StudentEnrollmentOut | None)
def get_my_enrollment(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Returns the student's current enrollment (any status), or null if
    they haven't requested a course yet."""
    student = _require_student_profile(current_user, db)
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == student.student_id)
        .order_by(Enrollment.enrollment_id.desc())
        .first()
    )
    if not enrollment:
        return None
    course = db.query(Course).filter(Course.course_id == enrollment.course_id).first()
    return {
        "enrollment_id": enrollment.enrollment_id,
        "course_id": enrollment.course_id,
        "course_title": course.title if course else "—",
        "approval_status": enrollment.approval_status,
        "enrollment_date": enrollment.enrollment_date,
    }


@router.post("/enroll", response_model=StudentEnrollmentOut, status_code=201)
def request_enrollment(
    data: StudentEnrollRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Self-service enrollment request. Starts as 'pending' — an admin or
    supervisor must approve it before course content becomes visible
    (that gate is enforced in a later step, not here)."""
    student = _require_student_profile(current_user, db)

    course = db.query(Course).filter(Course.course_id == data.course_id, Course.status == "Active").first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found or inactive")

    existing = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == student.student_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="You already have an enrollment request")

    enrollment = Enrollment(
        student_id=student.student_id,
        course_id=data.course_id,
        enrollment_date=date.today(),
        approval_status="pending",
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    return {
        "enrollment_id": enrollment.enrollment_id,
        "course_id": enrollment.course_id,
        "course_title": course.title,
        "approval_status": enrollment.approval_status,
        "enrollment_date": enrollment.enrollment_date,
    }