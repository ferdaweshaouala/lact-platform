"""
Demo seed: insert attendance sessions for every ongoing enrollment that has
fewer than MIN_SESSIONS records, so the ML model has enough data to predict.

Patterns are randomised per enrollment to produce a realistic spread:
  ~35 % high-risk   (low attendance, declining trend)
  ~35 % low-risk    (consistent high attendance)
  ~30 % medium-risk (moderate or erratic attendance)

Safe to re-run — skips enrollments that already have enough data.
Respects the unique constraint on (enrollment_id, session_date).

Usage:
    docker compose exec backend python -m app.ml.seed_demo
"""

import random
import sys
from datetime import date, timedelta

from app.core.database import SessionLocal
from app.models.enrollment import Enrollment
from app.models.attendance import AttendanceRecord

# Must match features.py MIN_SESSIONS
MIN_SESSIONS = 2
# How many sessions to seed per under-served enrollment
TARGET_SESSIONS = 8


def _build_pattern(kind: str, n: int) -> list[str]:
    """Return n attendance statuses matching the given pattern kind."""
    if kind == "high_risk":
        # Starts bad, gets worse
        weights_early = [("absent", 60), ("present", 35), ("makeup", 5)]
        weights_late  = [("absent", 75), ("present", 20), ("makeup", 5)]
    elif kind == "low_risk":
        # Consistently present
        weights_early = [("present", 85), ("makeup", 10), ("absent", 5)]
        weights_late  = [("present", 88), ("makeup", 8),  ("absent", 4)]
    else:  # medium / erratic
        weights_early = [("present", 60), ("absent", 30), ("makeup", 10)]
        weights_late  = [("present", 55), ("absent", 35), ("makeup", 10)]

    half = n // 2
    result = []
    for statuses, weights in [(weights_early, weights_early), (weights_late, weights_late)]:
        count = half if statuses is weights_early else (n - half)
        pool  = [s for s, w in weights for _ in range(w)]
        result += [random.choice(pool) for _ in range(count)]
    return result


def seed() -> None:
    db = SessionLocal()
    try:
        ongoing = (
            db.query(Enrollment)
            .filter(Enrollment.completion_status == "Ongoing")
            .all()
        )
        print(f"Found {len(ongoing)} ongoing enrollment(s).")

        seeded = skipped = 0

        for enr in ongoing:
            existing_dates: set[date] = {
                r.session_date
                for r in db.query(AttendanceRecord.session_date)
                .filter(AttendanceRecord.enrollment_id == enr.enrollment_id)
                .all()
            }

            if len(existing_dates) >= MIN_SESSIONS:
                skipped += 1
                continue

            # Pick a risk pattern — distribute across enrollments for variety
            kind = random.choices(
                ["high_risk", "low_risk", "medium"],
                weights=[35, 35, 30],
            )[0]

            statuses = _build_pattern(kind, TARGET_SESSIONS)

            # Build candidate dates: weekly back from today, skip already-used
            inserted = 0
            for i in range(1, TARGET_SESSIONS + 20):          # extra headroom for collisions
                if inserted >= TARGET_SESSIONS:
                    break
                candidate = date.today() - timedelta(weeks=i)
                if candidate in existing_dates:
                    continue
                db.add(AttendanceRecord(
                    enrollment_id=enr.enrollment_id,
                    session_date=candidate,
                    status=statuses[inserted],
                    notes=None,
                ))
                existing_dates.add(candidate)
                inserted += 1

            seeded += 1

        db.commit()
        print(f"Done — seeded {seeded} enrollment(s), skipped {skipped} (already had data).")

    except Exception as exc:
        db.rollback()
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
