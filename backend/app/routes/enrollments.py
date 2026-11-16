from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from app.core.database import get_db
from app.models.user import User
from app.models.enrollment import Enrollment, StatusChangeLog
from app.models.student import Student
from app.models.course import Course
from app.schemas.enrollment import EnrollmentCreate, EnrollmentUpdate, EnrollmentOut
from app.core.security import get_current_user, require_role
from app.core.email import send_notification
from app.core.logging import get_logger

router = APIRouter(prefix="/api/enrollments", tags=["Enrollments"])
log = get_logger("dtms.enrollments")


@router.get("/", response_model=List[EnrollmentOut])
def list_enrollments(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == "teacher":
        return (
            db.query(Enrollment)
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(Course.teacher_id == current_user.user_id)
            .offset(skip).limit(limit).all()
        )
    if current_user.role == "supervisor":
        return (
            db.query(Enrollment)
            .join(Course, Course.course_id == Enrollment.course_id)
            .filter(Course.supervisor_id == current_user.user_id)
            .offset(skip).limit(limit).all()
        )
    return db.query(Enrollment).offset(skip).limit(limit).all()


@router.post("/", response_model=EnrollmentOut, status_code=201)
def create_enrollment(
    data: EnrollmentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("supervisor")),
):
    if not db.query(Student).filter(Student.student_id == data.student_id).first():
        raise HTTPException(status_code=404, detail="Student not found")
    if not db.query(Course).filter(Course.course_id == data.course_id).first():
        raise HTTPException(status_code=404, detail="Course not found")
    existing = db.query(Enrollment).filter(
        Enrollment.student_id == data.student_id,
        Enrollment.course_id == data.course_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already enrolled in this course")
    payload = data.model_dump()
    payload["enrollment_date"] = data.enrollment_date or date.today()
    payload["approval_status"] = "approved"   # ← هذا السطر الجديد فقط
    enrollment = Enrollment(**payload)
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    log.info("enrollment_created", enrollment_id=enrollment.enrollment_id,
             student_id=data.student_id, course_id=data.course_id)
    return enrollment


@router.patch("/{enrollment_id}", response_model=EnrollmentOut)
def update_enrollment(
    enrollment_id: int,
    data: EnrollmentUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("supervisor")),
):
    enrollment = db.query(Enrollment).filter(Enrollment.enrollment_id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    old_status = enrollment.completion_status
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(enrollment, field, value)
    status_changed = data.completion_status is not None and data.completion_status != old_status
    if status_changed:
        log.info("enrollment_status_changed", enrollment_id=enrollment_id,
                 old_status=old_status, new_status=data.completion_status,
                 changed_by=current_user.user_id)
        db.add(StatusChangeLog(
            enrollment_id=enrollment_id,
            old_status=old_status,
            new_status=data.completion_status,
            changed_by=current_user.user_id,
        ))
    db.commit()
    db.refresh(enrollment)

    # Notify on Drop — supervisor needs to know promptly. Done after commit so a failed email
    # never rolls back the actual status change.
    if status_changed and data.completion_status == "Dropped":
        course = db.query(Course).filter(Course.course_id == enrollment.course_id).first()
        student = db.query(Student).filter(Student.student_id == enrollment.student_id).first()
        if course and student and course.supervisor_id and course.supervisor_id != current_user.user_id:
            supervisor = db.query(User).filter(User.user_id == course.supervisor_id).first()
            if supervisor and supervisor.email:
                body = (
                    f"<p><strong>{student.first_name} {student.last_name}</strong> "
                    f"({student.student_number}) was marked as <strong>Dropped</strong> "
                    f"in the course <em>{course.title}</em>.</p>"
                    f"<p>Changed by: {current_user.first_name} {current_user.last_name}.</p>"
                )
                background_tasks.add_task(
                    send_notification,
                    supervisor.email,
                    f"Student dropped from {course.title}",
                    "A student dropped a course you supervise",
                    body,
                )

    return enrollment


@router.delete("/{enrollment_id}", status_code=204)
def delete_enrollment(
    enrollment_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("supervisor")),
):
    enrollment = db.query(Enrollment).filter(Enrollment.enrollment_id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    db.delete(enrollment)
    db.commit()
