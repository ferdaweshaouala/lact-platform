from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.models.course import Course
from app.models.program_content import Program
from app.schemas.program_content import ProgramCreate, ProgramOut

router = APIRouter(prefix="/api/programs", tags=["Programs"])


def _to_out(program: Program, db: Session) -> dict:
    course_ids = [
        c.course_id
        for c in db.query(Course).filter(Course.program_id == program.id).order_by(Course.course_id).all()
    ]
    return {
        "id": program.id,
        "name": program.name,
        "description": program.description,
        "is_active": program.is_active,
        "course_ids": course_ids,
    }


@router.get("/", response_model=list[ProgramOut])
def list_programs(
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    programs = db.query(Program).order_by(Program.id).all()
    return [_to_out(p, db) for p in programs]


@router.post("/", response_model=ProgramOut, status_code=201)
def create_program(
    data: ProgramCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    program = Program(name=data.name, description=data.description)
    db.add(program)
    db.commit()
    db.refresh(program)
    return _to_out(program, db)


@router.post("/{program_id}/courses/{course_id}", response_model=ProgramOut)
def link_course_to_program(
    program_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    """Make a course (cohort) follow this program's content."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course.program_id = program_id
    db.commit()
    return _to_out(program, db)


@router.delete("/{program_id}/courses/{course_id}", response_model=ProgramOut)
def unlink_course_from_program(
    program_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    course = db.query(Course).filter(Course.course_id == course_id, Course.program_id == program_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course is not linked to this program")

    course.program_id = None
    db.commit()
    return _to_out(program, db)