from datetime import datetime, date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.models.course import Course
from app.models.program_content import ProgramWeek, WeekItem, StudentItemProgress
from app.schemas.program_content import LectureStepUpdate, WeekItemProgressOut

router = APIRouter(prefix="/api/student", tags=["Student Content"])

WEEKDAY_MAP = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
    "الاثنين": 0, "الإثنين": 0, "الثلاثاء": 1, "الأربعاء": 2, "الاربعاء": 2,
    "الخميس": 3, "الجمعة": 4, "السبت": 5, "الأحد": 6, "الاحد": 6,
}

LECTURE_STEP_FIELDS = {
    "watched": "lecture_watched",
    "notes_written": "notes_written",
    "sent_to_bot": "notes_sent_to_bot",
}


def _lecture_steps(progress):
    if not progress:
        return {"watched": False, "notes_written": False, "sent_to_bot": False}
    return {
        "watched": progress.lecture_watched,
        "notes_written": progress.notes_written,
        "sent_to_bot": progress.notes_sent_to_bot,
    }


def _require_approved_enrollment(current_user, db: Session) -> Enrollment:
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Student access only")
    student = db.query(Student).filter(Student.user_id == current_user.user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == student.student_id)
        .order_by(Enrollment.enrollment_id.desc())
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="No enrollment found")
    if enrollment.approval_status != "approved":
        raise HTTPException(status_code=403, detail="Enrollment not yet approved")
    return enrollment


def _get_course(enrollment: Enrollment, db: Session):
    return db.query(Course).filter(Course.course_id == enrollment.course_id).first()


def _get_program_id(enrollment: Enrollment, db: Session):
    course = _get_course(enrollment, db)
    return course.program_id if course else None


def _get_item_for_student(item_id: int, enrollment: Enrollment, db: Session) -> WeekItem:
    item = db.query(WeekItem).filter(WeekItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    week = db.query(ProgramWeek).filter(ProgramWeek.id == item.week_id).first()
    program_id = _get_program_id(enrollment, db)
    if not week or program_id is None or week.program_id != program_id:
        raise HTTPException(status_code=403, detail="Item does not belong to your program")
    return item


def _next_workshop_countdown(course: Course):
    """Days remaining until the course's weekly workshop, based on
    workshop_day (and optional workshop_time). Returns None if the day
    isn't set or isn't recognized."""
    if not course or not course.workshop_day:
        return None
    target = WEEKDAY_MAP.get(course.workshop_day.strip().lower()) \
        if course.workshop_day.strip().lower() in WEEKDAY_MAP \
        else WEEKDAY_MAP.get(course.workshop_day.strip())
    if target is None:
        return None

    today = date.today()
    days_ahead = (target - today.weekday()) % 7
    next_date = today + timedelta(days=days_ahead)

    return {
        "weekday": course.workshop_day,
        "time": course.workshop_time,
        "date": next_date.isoformat(),
        "days_remaining": days_ahead,
    }


def _weeks_with_unlock(program_id: int, enrollment: Enrollment, db: Session):
    """Same unlock logic as list_my_weeks, returned as a list of
    (ProgramWeek, is_unlocked, completed_item_ids_of_this_week)."""
    weeks = (
        db.query(ProgramWeek)
        .filter(ProgramWeek.program_id == program_id, ProgramWeek.is_visible == True)  # noqa: E712
        .order_by(ProgramWeek.week_number)
        .all()
    )
    completed_item_ids = {
        p.item_id
        for p in db.query(StudentItemProgress)
        .filter(
            StudentItemProgress.enrollment_id == enrollment.enrollment_id,
            StudentItemProgress.completed == True,  # noqa: E712
        )
        .all()
    }

    result = []
    previous_required_done = True
    for week in weeks:
        required_ids = [i.id for i in week.items if i.is_required]
        all_required_done = len(required_ids) == 0 or all(iid in completed_item_ids for iid in required_ids)
        result.append((week, previous_required_done, completed_item_ids))
        previous_required_done = all_required_done
    return result


@router.get("/weeks")
def list_my_weeks(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    enrollment = _require_approved_enrollment(current_user, db)
    program_id = _get_program_id(enrollment, db)
    if program_id is None:
        return []

    rows = _weeks_with_unlock(program_id, enrollment, db)
    result = []
    for week, is_unlocked, completed_item_ids in rows:
        result.append({
            "id": week.id,
            "week_number": week.week_number,
            "title": week.title,
            "is_visible": week.is_visible,
            "is_unlocked": is_unlocked,
            "items": week.items,
        })
    return result


@router.get("/weeks/{week_id}/progress", response_model=list[WeekItemProgressOut])
def get_week_progress(
    week_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    enrollment = _require_approved_enrollment(current_user, db)
    program_id = _get_program_id(enrollment, db)
    if program_id is None:
        raise HTTPException(status_code=404, detail="Week not found")

    week = (
        db.query(ProgramWeek)
        .filter(
            ProgramWeek.id == week_id,
            ProgramWeek.program_id == program_id,
            ProgramWeek.is_visible == True,  # noqa: E712
        )
        .first()
    )
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    progress_map = {
        p.item_id: p
        for p in db.query(StudentItemProgress)
        .filter(StudentItemProgress.enrollment_id == enrollment.enrollment_id)
        .all()
    }

    return [
        {
            "item": item,
            "completed": bool(progress_map.get(item.id) and progress_map[item.id].completed),
            "steps": _lecture_steps(progress_map.get(item.id)) if item.item_type == "lecture" else None,
        }
        for item in week.items
    ]


@router.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Summary for the student's home screen: this week's required items
    with progress, anything overdue from earlier unlocked weeks, and a
    countdown to the next weekly workshop."""
    enrollment = _require_approved_enrollment(current_user, db)
    course = _get_course(enrollment, db)
    program_id = course.program_id if course else None

    if program_id is None:
        return {
            "course_title": course.title if course else None,
            "current_week": None,
            "overdue_items": [],
            "next_workshop": _next_workshop_countdown(course),
        }

    rows = _weeks_with_unlock(program_id, enrollment, db)
    progress_by_item = {
        p.item_id: p
        for p in db.query(StudentItemProgress)
        .filter(StudentItemProgress.enrollment_id == enrollment.enrollment_id)
        .all()
    }
    unlocked_rows = [r for r in rows if r[1]]

    current_week_row = None
    overdue_items = []

    for idx, (week, is_unlocked, completed_item_ids) in enumerate(unlocked_rows):
        required_items = [i for i in week.items if i.is_required]
        all_required_done = all(i.id in completed_item_ids for i in required_items)
        is_last_unlocked = idx == len(unlocked_rows) - 1

        if not all_required_done:
            current_week_row = (week, completed_item_ids)
            # weeks before this one that still have undone required items
            for prev_week, _, prev_completed in unlocked_rows[:idx]:
                for item in prev_week.items:
                    if item.is_required and item.id not in prev_completed:
                        overdue_items.append({
                            "week_number": prev_week.week_number,
                            "week_title": prev_week.title,
                            "item": item,
                        })
            break
        if is_last_unlocked:
            current_week_row = (week, completed_item_ids)

    current_week_out = None
    if current_week_row:
        week, completed_item_ids = current_week_row
        required_items = [i for i in week.items if i.is_required]
        required_total = len(required_items)
        required_done = sum(1 for i in required_items if i.id in completed_item_ids)
        percent = round((required_done / required_total) * 100) if required_total else 100

        current_week_out = {
            "id": week.id,
            "week_number": week.week_number,
            "title": week.title,
            "required_total": required_total,
            "required_done": required_done,
            "percent": percent,
            "items": [
                {
                    "item": item,
                    "completed": item.id in completed_item_ids,
                    "steps": _lecture_steps(progress_by_item.get(item.id))
                    if item.item_type == "lecture" else None,
                }
                for item in week.items
            ],
        }

    return {
        "course_title": course.title if course else None,
        "current_week": current_week_out,
        "overdue_items": overdue_items,
        "next_workshop": _next_workshop_countdown(course),
    }


@router.patch("/items/{item_id}/steps")
def update_lecture_steps(
    item_id: int,
    update: LectureStepUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    enrollment = _require_approved_enrollment(current_user, db)
    item = _get_item_for_student(item_id, enrollment, db)
    if item.item_type != "lecture":
        raise HTTPException(status_code=400, detail="Checklist steps are only available for lectures")

    progress = (
        db.query(StudentItemProgress)
        .filter(
            StudentItemProgress.enrollment_id == enrollment.enrollment_id,
            StudentItemProgress.item_id == item_id,
        )
        .first()
    )
    if not progress:
        progress = StudentItemProgress(enrollment_id=enrollment.enrollment_id, item_id=item_id)
        db.add(progress)
        db.flush()

    if update.step == "all":
        for field in LECTURE_STEP_FIELDS.values():
            setattr(progress, field, update.completed)
    else:
        setattr(progress, LECTURE_STEP_FIELDS[update.step], update.completed)

    progress.completed = all(getattr(progress, field) for field in LECTURE_STEP_FIELDS.values())
    progress.completed_at = datetime.utcnow() if progress.completed else None
    db.commit()
    return {"completed": progress.completed, "steps": _lecture_steps(progress)}


@router.post("/items/{item_id}/complete")
def mark_item_complete(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    enrollment = _require_approved_enrollment(current_user, db)
    item = _get_item_for_student(item_id, enrollment, db)

    progress = (
        db.query(StudentItemProgress)
        .filter(
            StudentItemProgress.enrollment_id == enrollment.enrollment_id,
            StudentItemProgress.item_id == item_id,
        )
        .first()
    )
    if progress:
        progress.completed = True
        progress.completed_at = datetime.utcnow()
    else:
        progress = StudentItemProgress(
            enrollment_id=enrollment.enrollment_id,
            item_id=item_id,
            completed=True,
            completed_at=datetime.utcnow(),
        )
        db.add(progress)
    if item.item_type == "lecture":
        for field in LECTURE_STEP_FIELDS.values():
            setattr(progress, field, True)
    db.commit()
    return {"message": "Marked as completed"}


@router.post("/items/{item_id}/uncomplete")
def mark_item_uncomplete(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    enrollment = _require_approved_enrollment(current_user, db)
    item = _get_item_for_student(item_id, enrollment, db)

    progress = (
        db.query(StudentItemProgress)
        .filter(
            StudentItemProgress.enrollment_id == enrollment.enrollment_id,
            StudentItemProgress.item_id == item_id,
        )
        .first()
    )
    if progress:
        progress.completed = False
        progress.completed_at = None
        if item.item_type == "lecture":
            for field in LECTURE_STEP_FIELDS.values():
                setattr(progress, field, False)
        db.commit()
    return {"message": "Marked as not completed"}
