import uuid
import secrets
import string
from datetime import date
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.core.security import require_role
from app.schemas.student_auth import StudentCreateBySupervisor, StudentCreateBySupervisorOut
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, RefreshTokenStore
from app.models.student import Student
from app.core.config import settings
from app.core.security import (
    hash_password, create_access_token, create_refresh_token, _utcnow,
)
from app.schemas.student_auth import StudentRegisterSimple, StudentRegisterOut
from app.core.limiter import limiter
from fastapi import Request
from app.core.logging import get_logger

router = APIRouter(prefix="/api/student", tags=["Student Registration"])
log = get_logger("dtms.student_auth")


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key="dtms_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="dtms_refresh",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


@router.post("/register", response_model=StudentRegisterOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register_student(
    request: Request,
    response: Response,
    data: StudentRegisterSimple,
    db: Session = Depends(get_db),
):
    """Public self-registration for students. Creates a User(role=student)
    linked to a new Student record, then logs them in immediately
    (sets auth cookies) since activation is immediate for now."""

    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        role="student",
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    student = Student(
        first_name=data.first_name,
        last_name=data.last_name,
        student_number=f"STU{user.user_id:06d}",
        email=data.email,
        phone_number=data.phone_number,
        city=data.city,
        user_id=user.user_id,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    token_data = {"sub": str(user.user_id), "role": user.role}
    access_token = create_access_token(token_data)
    jti = str(uuid.uuid4())
    refresh_token = create_refresh_token(token_data, jti)
    db.add(RefreshTokenStore(
        jti=jti,
        user_id=user.user_id,
        expires_at=_utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()

    _set_auth_cookies(response, access_token, refresh_token)

    log.info("student_register_success", user_id=user.user_id, student_id=student.student_id)

    return {
        "user_id": user.user_id,
        "student_id": student.student_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
    }
def _generate_password(length: int = 10) -> str:
    """Random password: letters, digits, and one symbol — readable enough to
    copy/paste or dictate over the phone."""
    alphabet = string.ascii_letters + string.digits
    password = "".join(secrets.choice(alphabet) for _ in range(length - 1))
    symbol = secrets.choice("!@#$%")
    return password + symbol


@router.post("/create-by-supervisor", response_model=StudentCreateBySupervisorOut, status_code=201)
def create_student_by_supervisor(
    data: StudentCreateBySupervisor,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "supervisor")),
):
    """Supervisor/admin creates a student account directly. The enrollment
    (if a course is given) is approved immediately — no pending step, since
    a staff member is doing the registration herself."""
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    generated_password = _generate_password()

    user = User(
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        role="student",
        password_hash=hash_password(generated_password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    student = Student(
        first_name=data.first_name,
        last_name=data.last_name,
        student_number=f"STU{user.user_id:06d}",
        email=data.email,
        phone_number=data.phone_number,
        city=data.city,
        user_id=user.user_id,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    enrollment_id = None
    if data.course_id is not None:
        course = db.query(Course).filter(Course.course_id == data.course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        enrollment = Enrollment(
            student_id=student.student_id,
            course_id=data.course_id,
            enrollment_date=date.today(),
            approval_status="approved",
        )
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)
        enrollment_id = enrollment.enrollment_id

    log.info("student_created_by_supervisor", user_id=user.user_id, student_id=student.student_id,
              created_by=current_user.user_id)

    return {
        "user_id": user.user_id,
        "student_id": student.student_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "generated_password": generated_password,
        "enrollment_id": enrollment_id,
    }
    
    
@router.post("/{user_id}/reset-password", status_code=200)
def reset_student_password(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "supervisor")),
):
    user = db.query(User).filter(User.user_id == user_id, User.role == "student").first()
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")
    new_password = _generate_password()
    user.password_hash = hash_password(new_password)
    db.commit()
    return {"user_id": user.user_id, "email": user.email, "generated_password": new_password}
   