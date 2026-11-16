from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.models.program_content import Program, ProgramWeek, WeekItem
from app.schemas.program_content import ProgramWeekCreate, ProgramWeekOut, WeekItemCreate

router = APIRouter(prefix="/api/programs/{program_id}/weeks", tags=["Program Content"])


def _get_week_or_404(db: Session, program_id: int, week_id: int) -> ProgramWeek:
    week = (
        db.query(ProgramWeek)
        .filter(ProgramWeek.id == week_id, ProgramWeek.program_id == program_id)
        .first()
    )
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")
    return week


@router.get("/", response_model=list[ProgramWeekOut])
def list_weeks(
    program_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    return (
        db.query(ProgramWeek)
        .filter(ProgramWeek.program_id == program_id)
        .order_by(ProgramWeek.week_number)
        .all()
    )


@router.post("/", response_model=ProgramWeekOut, status_code=201)
def create_week(
    program_id: int,
    data: ProgramWeekCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    if not db.query(Program).filter(Program.id == program_id).first():
        raise HTTPException(status_code=404, detail="Program not found")

    existing = (
        db.query(ProgramWeek)
        .filter(ProgramWeek.program_id == program_id, ProgramWeek.week_number == data.week_number)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Week number already exists for this program")

    week = ProgramWeek(program_id=program_id, week_number=data.week_number, title=data.title)
    db.add(week)
    db.flush()

    for item_data in data.items:
        db.add(WeekItem(week_id=week.id, **item_data.model_dump()))

    db.commit()
    db.refresh(week)
    return week


@router.patch("/{week_id}/toggle-visibility", response_model=ProgramWeekOut)
def toggle_week_visibility(
    program_id: int,
    week_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    """Hides (or reveals) a whole week for every cohort of this program."""
    week = _get_week_or_404(db, program_id, week_id)
    week.is_visible = not week.is_visible
    db.commit()
    db.refresh(week)
    return week


@router.post("/{week_id}/items", response_model=ProgramWeekOut)
def add_item_to_week(
    program_id: int,
    week_id: int,
    data: WeekItemCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    week = _get_week_or_404(db, program_id, week_id)
    db.add(WeekItem(week_id=week.id, **data.model_dump()))
    db.commit()
    db.refresh(week)
    return week


@router.patch("/{week_id}/items/{item_id}", response_model=ProgramWeekOut)
def update_week_item(
    program_id: int,
    week_id: int,
    item_id: int,
    data: WeekItemCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    week = _get_week_or_404(db, program_id, week_id)
    item = db.query(WeekItem).filter(WeekItem.id == item_id, WeekItem.week_id == week.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for field, value in data.model_dump().items():
        setattr(item, field, value)

    db.commit()
    db.refresh(week)
    return week


@router.delete("/{week_id}/items/{item_id}", status_code=204)
def delete_week_item(
    program_id: int,
    week_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "supervisor")),
):
    week = _get_week_or_404(db, program_id, week_id)
    item = db.query(WeekItem).filter(WeekItem.id == item_id, WeekItem.week_id == week.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()