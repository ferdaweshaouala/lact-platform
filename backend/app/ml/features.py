"""
Feature extractor for the DTMS dropout prediction model.

Queries real database tables (attendance_records, grades, enrollments,
submissions, compensation_requests) for a specific student-course enrollment
and returns the same 14 features used during training.

Usage:
    from app.ml.features import compute_features
    features = compute_features(student_id=5, course_id=3, db=db)
    # returns dict or None if not enough data
"""

import numpy as np
from datetime import date
from typing import Optional
from sqlalchemy.orm import Session

from app.models.enrollment import Enrollment
from app.models.attendance import AttendanceRecord
from app.models.grade import Grade, GradeCategory
from app.models.course import Course, Session as CourseSession
from app.models.telegram import Submission, CompensationRequest


# Minimum sessions required to compute trends reliably
MIN_SESSIONS = 2


def _slope(values: list[float]) -> float:
    """Linear regression slope over equally-spaced x = 1..N, normalised to [-1, 1]."""
    n = len(values)
    if n < 2:
        return 0.0
    x = np.arange(1, n + 1, dtype=float)
    x -= x.mean()
    y = np.array(values, dtype=float)
    denom = (x ** 2).sum()
    slope = float((x * y).sum() / denom) if denom != 0 else 0.0
    # clamp to [-1, 1]
    return float(np.clip(slope, -1.0, 1.0))


def compute_features(
    student_id: int,
    course_id: int,
    db: Session,
) -> Optional[dict]:
    """
    Compute the 14 model features from real DTMS data for one student-course pair.

    Returns a dict with all feature values, or None if the enrollment doesn't
    exist or there is not enough data to compute meaningful features.
    """

    # ── Enrollment ────────────────────────────────────────────────────────────
    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == student_id,
            Enrollment.course_id == course_id,
        )
        .first()
    )
    if not enrollment:
        return None

    course = db.query(Course).filter(Course.course_id == course_id).first()

    # ── Attendance ────────────────────────────────────────────────────────────
    attendance_records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.enrollment_id == enrollment.enrollment_id)
        .order_by(AttendanceRecord.session_date)
        .all()
    )

    total_sessions = len(attendance_records)
    if total_sessions < MIN_SESSIONS:
        return None

    present_statuses = {"present", "makeup"}
    present_flags = [
        1.0 if r.status in present_statuses else 0.0
        for r in attendance_records
    ]

    att_rate = float(np.mean(present_flags))
    att_trend = _slope(present_flags)

    # Consistency = std of a rolling 3-session window attendance; higher = more inconsistent
    if total_sessions >= 3:
        windows = [
            present_flags[i: i + 3]
            for i in range(total_sessions - 2)
        ]
        att_consistency = float(np.mean([np.std(w) for w in windows]))
    else:
        att_consistency = float(np.std(present_flags))

    att_consistency = float(np.clip(att_consistency, 0.0, 1.0))

    # Late attendance drop flag: last 3 sessions avg significantly below first half
    if total_sessions >= 4:
        first_half_avg = float(np.mean(present_flags[: total_sessions // 2]))
        last_3_avg = float(np.mean(present_flags[-3:]))
        late_att_drop = 1 if (first_half_avg - last_3_avg) > 0.25 else 0
    else:
        late_att_drop = 0

    # ── Weeks enrolled ────────────────────────────────────────────────────────
    if enrollment.enrollment_date:
        delta = (date.today() - enrollment.enrollment_date).days
        weeks_enrolled = max(1, delta // 7)
    else:
        weeks_enrolled = total_sessions  # fallback: 1 session ≈ 1 week

    # ── Grades (per-session hawsala) ──────────────────────────────────────────
    weekly_grades = (
        db.query(Grade)
        .join(GradeCategory, Grade.category_id == GradeCategory.id)
        .filter(
            Grade.enrollment_id == enrollment.enrollment_id,
            GradeCategory.kind == "weekly",
        )
        .order_by(Grade.session_number)
        .all()
    )

    if weekly_grades:
        # Normalise each grade to [0, 1] using its max_value
        norm_grades = []
        for g in weekly_grades:
            denom = g.max_value or (
                db.query(GradeCategory)
                .filter(GradeCategory.id == g.category_id)
                .first().max_value
            )
            norm_grades.append(float(np.clip(g.value / denom, 0.0, 1.0)) if denom else 0.0)

        grade_avg = float(np.mean(norm_grades))
        grade_trend = _slope(norm_grades)
        grade_variance = float(np.clip(np.std(norm_grades), 0.0, 1.0))
        early_grade = float(np.mean(norm_grades[:max(1, len(norm_grades) // 3)]))
    else:
        # No grades yet — use neutral values
        grade_avg = 0.5
        grade_trend = 0.0
        grade_variance = 0.0
        early_grade = 0.5

    # ── Submissions ───────────────────────────────────────────────────────────
    all_submissions = (
        db.query(Submission)
        .filter(
            Submission.student_id == student_id,
            Submission.course_id == course_id,
        )
        .all()
    )

    # Expected submissions = one per session
    expected_submissions = max(total_sessions, 1)
    submission_rate = float(np.clip(len(all_submissions) / expected_submissions, 0.0, 1.0))

    graded_submissions = [s for s in all_submissions if s.grade is not None]
    if graded_submissions:
        submission_avg_grade = float(np.clip(
            np.mean([s.grade for s in graded_submissions]) / 20.0,
            0.0, 1.0,
        ))
    else:
        submission_avg_grade = 0.0 if submission_rate < 0.1 else grade_avg * 0.88

    # ── Compensation requests ─────────────────────────────────────────────────
    comp_requests = (
        db.query(CompensationRequest)
        .filter(
            CompensationRequest.student_id == student_id,
            CompensationRequest.course_id == course_id,
        )
        .all()
    )

    comp_request_count = len(comp_requests)
    accepted = [r for r in comp_requests if r.status == "accepted"]
    makeup_rate = (
        float(len(accepted) / comp_request_count)
        if comp_request_count > 0 else 0.0
    )

    # ── Course type ───────────────────────────────────────────────────────────
    course_type = 1 if (course and course.course_type == "online") else 0

    # ── Assemble ──────────────────────────────────────────────────────────────
    return {
        "att_rate":             round(att_rate, 4),
        "att_trend":            round(att_trend, 4),
        "att_consistency":      round(att_consistency, 4),
        "grade_avg":            round(grade_avg, 4),
        "grade_trend":          round(grade_trend, 4),
        "grade_variance":       round(grade_variance, 4),
        "submission_rate":      round(submission_rate, 4),
        "submission_avg_grade": round(submission_avg_grade, 4),
        "comp_request_count":   comp_request_count,
        "makeup_rate":          round(makeup_rate, 4),
        "weeks_enrolled":       weeks_enrolled,
        "course_type":          course_type,
        "early_grade":          round(early_grade, 4),
        "late_att_drop":        late_att_drop,
    }
