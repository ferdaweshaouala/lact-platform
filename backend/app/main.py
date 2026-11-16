from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import Base, engine, SessionLocal, get_db
from app.routes import auth, users, students, courses, enrollments, grades, analytics, imports, export, categories, gradebook, attendance, curriculum, notes, submissions, compensation, prediction, student_auth, student_enrollment, program_content, student_content, programs, course_schedule
from app.models.user import User, InviteToken, RefreshTokenStore  # noqa
from app.models.student import Student  # noqa
from app.models.program_content import Program, ProgramWeek, WeekItem, StudentItemProgress  # noqa
from app.models.course import Course, Session  # noqa
from app.models.enrollment import Enrollment, StatusChangeLog  # noqa
from app.models.grade import Grade, GradeCategory  # noqa
from app.models.attendance import AttendanceRecord  # noqa
from app.models.imports import StagedImport  # noqa
from app.models.curriculum import CurriculumSession, CurriculumAttendance  # noqa
from app.models.note import CourseNote  # noqa
from app.models.telegram import TelegramGroup, Submission, CompensationRequest  # noqa
from app.core.config import settings
from app.core.security import hash_password
from app.core.scheduler import start_scheduler, stop_scheduler
from app.core.limiter import limiter
from app.core.logging import configure_logging, get_logger

configure_logging()
log = get_logger("dtms.main")


def seed_first_admin():
    db = SessionLocal()
    try:
        if not db.query(User).first():
            admin = User(
                first_name=settings.FIRST_ADMIN_FIRST_NAME,
                last_name=settings.FIRST_ADMIN_LAST_NAME,
                email=settings.FIRST_ADMIN_EMAIL,
                role="admin",
                password_hash=hash_password(settings.FIRST_ADMIN_PASSWORD),
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_first_admin()
    start_scheduler()
    log.info("dtms_startup", message="DTMS API started")
    yield
    stop_scheduler()
    log.info("dtms_shutdown", message="DTMS API stopped")


app = FastAPI(
    title="Digital Training Management System",
    description="API for DTMS — role-based access for Admin, Teacher, Supervisor",
    version="1.0.0",
    lifespan=lifespan,
    # Disable Starlette's built-in slash redirect: it builds the redirect URL
    # from the request's Host header, which through the Next.js Docker proxy
    # is "backend:8000" (internal hostname the browser can't resolve).
    # We handle slash matching ourselves via the middleware below.
    redirect_slashes=False,
)


from starlette.routing import Match


@app.middleware("http")
async def normalize_api_trailing_slash(request, call_next):
    """Match /api/foo against routes registered as /api/foo/ without redirecting.
    Next.js's proxy strips trailing slashes en route to the backend, so this
    keeps collection endpoints (registered with prefix + "/") reachable.
    Uses the real Starlette route matcher so parameterized routes like
    /api/courses/{course_id}/gradebook/ also resolve correctly."""
    path = request.scope.get("path", "")
    if path.startswith("/api/") and not path.endswith("/"):
        # Try matching the bare path first; if no route matches, try with slash.
        bare_match = any(
            r.matches(request.scope)[0] == Match.FULL for r in app.routes
        )
        if not bare_match:
            slashed_scope = dict(request.scope)
            slashed_scope["path"] = path + "/"
            slashed_match = any(
                r.matches(slashed_scope)[0] == Match.FULL for r in app.routes
            )
            if slashed_match:
                request.scope["path"] = path + "/"
                raw = request.scope.get("raw_path") or path.encode()
                request.scope["raw_path"] = (
                    raw + b"/" if not raw.endswith(b"/") else raw
                )
    return await call_next(request)


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(student_auth.router)
app.include_router(student_enrollment.router)
app.include_router(users.router)
app.include_router(students.router)
app.include_router(courses.router)
app.include_router(categories.router)
app.include_router(gradebook.router)
app.include_router(attendance.router)
app.include_router(enrollments.router)
app.include_router(grades.router)
app.include_router(analytics.router)
app.include_router(imports.router)
app.include_router(export.router)
app.include_router(curriculum.router)
app.include_router(notes.router)
app.include_router(submissions.router)
app.include_router(compensation.router)
app.include_router(prediction.router)
app.include_router(program_content.router)
app.include_router(student_content.router)
app.include_router(programs.router)
app.include_router(course_schedule.router)

@app.get("/")
def root():
    return {"message": "DTMS API is running"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok"}
