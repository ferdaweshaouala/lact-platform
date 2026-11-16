"""
DTMS — Dropout Risk Prediction (Inference)

Loads the trained model and generates risk scores for students.
Falls back to rule-based scoring if no trained model exists yet.
"""

import json
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from typing import Optional

BASE_DIR   = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "outputs"
MODEL_PATH = OUTPUT_DIR / "best_model.joblib"
REPORT_PATH = OUTPUT_DIR / "evaluation_report.json"

FEATURE_NAMES = [
    'att_rate', 'att_trend', 'att_consistency',
    'grade_avg', 'grade_trend', 'grade_variance',
    'submission_rate', 'submission_avg_grade',
    'comp_request_count', 'makeup_rate',
    'weeks_enrolled', 'course_type',
    'early_grade', 'late_att_drop',
]

_model = None


def load_model():
    global _model
    if _model is None and MODEL_PATH.exists():
        _model = joblib.load(MODEL_PATH)
    return _model


def rule_based_score(features: dict) -> float:
    """
    Fallback rule-based risk score when no trained model exists.
    Weights: attendance 40%, grades 35%, submissions 15%, compensation 10%
    """
    att_risk  = max(0, 1 - features.get('att_rate', 0.8))
    att_risk += max(0, -features.get('att_trend', 0)) * 0.5

    grade_avg = features.get('grade_avg', 0.7)
    grade_risk = max(0, 1 - grade_avg)
    grade_risk += max(0, -features.get('grade_trend', 0)) * 0.3

    sub_risk = max(0, 1 - features.get('submission_rate', 0.8))

    comp_count = features.get('comp_request_count', 0)
    comp_risk  = min(1, comp_count / 3)

    score = (att_risk * 0.40 + grade_risk * 0.35 + sub_risk * 0.15 + comp_risk * 0.10)
    return round(float(np.clip(score, 0, 1)), 4)


def predict_risk(features: dict) -> dict:
    """
    Predict dropout risk for a single student-enrollment.

    Parameters
    ----------
    features : dict  — keys matching FEATURE_NAMES

    Returns
    -------
    dict with:
        risk_score   float  0.0 – 1.0
        risk_level   str    'low' | 'medium' | 'high'
        top_factors  list   top 3 contributing factors (human readable)
        model_used   str    'ml_model' | 'rule_based'
    """
    model = load_model()

    if model is not None:
        row = pd.DataFrame([{f: features.get(f, 0) for f in FEATURE_NAMES}])
        score = float(model.predict_proba(row)[0, 1])
        model_used = 'ml_model'
    else:
        score = rule_based_score(features)
        model_used = 'rule_based'

    level = 'high' if score >= 0.65 else 'medium' if score >= 0.35 else 'low'
    factors = _top_factors(features, score)

    return {
        'risk_score':  round(score * 100, 1),   # return as 0-100
        'risk_level':  level,
        'top_factors': factors,
        'model_used':  model_used,
    }


def _top_factors(features: dict, score: float) -> list:
    """Generate human-readable risk factors."""
    factors = []

    att_rate = features.get('att_rate', 1.0)
    if att_rate < 0.5:
        factors.append(f"Attendance rate: {att_rate:.0%} (critical)")
    elif att_rate < 0.75:
        factors.append(f"Attendance rate: {att_rate:.0%} (below threshold)")

    att_trend = features.get('att_trend', 0)
    if att_trend < -0.1:
        factors.append(f"Attendance declining ({att_trend:+.0%} trend)")

    grade_avg = features.get('grade_avg', 1.0)
    if grade_avg < 0.5:
        factors.append(f"Grade average: {grade_avg:.0%} (failing)")
    elif grade_avg < 0.65:
        factors.append(f"Grade average: {grade_avg:.0%} (below average)")

    grade_trend = features.get('grade_trend', 0)
    if grade_trend < -0.1:
        factors.append(f"Grade trend declining ({grade_trend:+.0%})")

    sub_rate = features.get('submission_rate', 1.0)
    if sub_rate < 0.4:
        factors.append(f"Only {sub_rate:.0%} of assignments submitted")

    comp_count = features.get('comp_request_count', 0)
    if comp_count >= 3:
        factors.append(f"{int(comp_count)} makeup requests filed")

    late_drop = features.get('late_att_drop', 0)
    if late_drop:
        factors.append("Significant attendance drop in recent weeks")

    return factors[:3] if factors else ["No significant risk factors detected"]


def get_model_info() -> dict:
    """Return metadata about the currently loaded model."""
    if REPORT_PATH.exists():
        with open(REPORT_PATH) as f:
            report = json.load(f)
        return {
            'model_available': True,
            'best_model':      report.get('best_model'),
            'roc_auc':         report.get('test_results', {}).get('roc_auc'),
            'generated_at':    report.get('generated_at'),
        }
    return {'model_available': False, 'best_model': None, 'roc_auc': None}
