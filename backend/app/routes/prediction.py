"""
Dropout risk prediction endpoint.

GET /api/students/{student_id}/dropout-risk?course_id={course_id}
    → returns risk score, label, and the features used

GET /api/courses/{course_id}/dropout-risk
    → returns risk scores for all enrolled students in a course
"""

try:
    import joblib
    _JOBLIB_AVAILABLE = True
except ImportError:
    _JOBLIB_AVAILABLE = False

import pandas as pd
from functools import lru_cache
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.enrollment import Enrollment
from app.models.student import Student
from app.ml.features import compute_features

router = APIRouter(tags=["Dropout Prediction"])

MODEL_PATH = Path(__file__).parent.parent / "ml" / "outputs" / "best_model.joblib"
OPTIMAL_THRESHOLD = 0.702  # from evaluation_report.json


@lru_cache(maxsize=1)
def _load_model():
    if not _JOBLIB_AVAILABLE:
        raise RuntimeError("ML dependencies not installed. Rebuild with ML packages enabled.")
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            "Model not found. Run: python -m app.ml.train"
        )
    return joblib.load(MODEL_PATH)


def _risk_label(prob: float, threshold: float) -> str:
    if prob >= threshold:
        return "high"
    elif prob >= threshold * 0.6:
        return "medium"
    return "low"


def _predict(features: dict) -> dict:
    try:
        model = _load_model()
    except (RuntimeError, FileNotFoundError) as e:
        raise HTTPException(status_code=503, detail=str(e))
    df = pd.DataFrame([features])
    prob = float(model.predict_proba(df)[0][1])
    label = _risk_label(prob, OPTIMAL_THRESHOLD)
    return {
        "dropout_probability": round(prob, 4),
        "risk_label":          label,
        "threshold_used":      OPTIMAL_THRESHOLD,
    }


# ── Single student ─────────────────────────────────────────────────────────────

@router.get("/api/students/{student_id}/dropout-risk")
def student_dropout_risk(
    student_id: int,
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Predict dropout risk for one student in a specific course.

    Query param: ?course_id=<id>

    Returns:
        dropout_probability  float  0–1
        risk_label           str    high / medium / low
        threshold_used       float  decision threshold from training
        features             dict   the 14 computed input features
    """
    if current_user.role not in ("admin", "supervisor", "teacher"):
        raise HTTPException(status_code=403, detail="Not authorized")

    features = compute_features(student_id, course_id, db)
    if features is None:
        raise HTTPException(
            status_code=422,
            detail="Not enough data to compute a prediction (minimum 2 sessions required).",
        )

    prediction = _predict(features)
    return {**prediction, "features": features}


# ── All students in a course ───────────────────────────────────────────────────

@router.get("/api/courses/{course_id}/dropout-risk")
def course_dropout_risk(
    course_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Predict dropout risk for every enrolled student in a course.

    Returns a list sorted by dropout_probability descending (highest risk first).
    Students with insufficient data are included with risk_label='insufficient_data'.
    """
    if current_user.role not in ("admin", "supervisor", "teacher"):
        raise HTTPException(status_code=403, detail="Not authorized")

    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.course_id == course_id,
            Enrollment.completion_status == "Ongoing",
        )
        .all()
    )

    if not enrollments:
        raise HTTPException(status_code=404, detail="No active enrollments for this course")

    results = []
    for enr in enrollments:
        student = db.query(Student).filter(Student.student_id == enr.student_id).first()
        features = compute_features(enr.student_id, course_id, db)

        if features is None:
            results.append({
                "student_id":          enr.student_id,
                "student_name":        f"{student.first_name} {student.last_name}" if student else "—",
                "dropout_probability": None,
                "risk_label":          "insufficient_data",
                "threshold_used":      OPTIMAL_THRESHOLD,
            })
            continue

        prediction = _predict(features)
        results.append({
            "student_id":   enr.student_id,
            "student_name": f"{student.first_name} {student.last_name}" if student else "—",
            **prediction,
            "features": features,
        })

    # Sort: high risk first, insufficient_data last
    label_order = {"high": 0, "medium": 1, "low": 2, "insufficient_data": 3}
    results.sort(key=lambda r: (
        label_order.get(r["risk_label"], 3),
        -(r["dropout_probability"] or 0),
    ))

    return results
