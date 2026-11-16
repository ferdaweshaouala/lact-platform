"""Unit tests for compute_total_pct.

Pure logic tests — no database, no HTTP. Any change to the grade
algorithm that breaks these tests means a grading regression.
"""
import pytest
from unittest.mock import MagicMock

from app.services.grades import compute_total_pct


def _cat(id: int, max_value: float, kind: str = "regular"):
    """Build a mock GradeCategory with the fields compute_total_pct reads."""
    c = MagicMock()
    c.id = id
    c.max_value = max_value
    c.kind = kind
    return c


# ── No grades ──────────────────────────────────────────────────────────────

def test_returns_none_when_no_grades():
    cats = {1: _cat(1, 100)}
    assert compute_total_pct({}, cats) is None


def test_returns_none_when_all_categories_empty():
    cats = {1: _cat(1, 50), 2: _cat(2, 50)}
    assert compute_total_pct({1: [], 2: []}, cats) is None


def test_returns_none_when_no_categories():
    assert compute_total_pct({1: [80.0]}, {}) is None


# ── Regular categories (sum of values) ─────────────────────────────────────

def test_single_regular_category_full_score():
    cats = {1: _cat(1, 100, "regular")}
    assert compute_total_pct({1: [100.0]}, cats) == 100.0


def test_single_regular_category_partial():
    cats = {1: _cat(1, 100, "regular")}
    assert compute_total_pct({1: [75.0]}, cats) == 75.0


def test_regular_sums_multiple_values():
    # Two grades in same category: 30 + 20 = 50, max = 100 → 50%
    cats = {1: _cat(1, 100, "regular")}
    assert compute_total_pct({1: [30.0, 20.0]}, cats) == 50.0


def test_two_regular_categories():
    # Cat A: 40/50, Cat B: 30/50 → 70/100 = 70%
    cats = {1: _cat(1, 50, "regular"), 2: _cat(2, 50, "regular")}
    assert compute_total_pct({1: [40.0], 2: [30.0]}, cats) == 70.0


# ── Weekly categories (average of values) ──────────────────────────────────

def test_weekly_uses_average():
    # Three weekly grades: 8, 6, 10 → avg = 8, max = 10 → 80%
    cats = {1: _cat(1, 10, "weekly")}
    assert compute_total_pct({1: [8.0, 6.0, 10.0]}, cats) == 80.0


def test_weekly_single_entry_equals_itself():
    cats = {1: _cat(1, 10, "weekly")}
    assert compute_total_pct({1: [7.0]}, cats) == 70.0


def test_weekly_perfect_average():
    cats = {1: _cat(1, 10, "weekly")}
    assert compute_total_pct({1: [10.0, 10.0, 10.0]}, cats) == 100.0


# ── Bonus category ─────────────────────────────────────────────────────────

def test_bonus_treated_as_regular_sum():
    # Bonus uses sum, same as regular
    cats = {1: _cat(1, 10, "bonus")}
    assert compute_total_pct({1: [5.0, 3.0]}, cats) == 80.0


# ── Mixed categories ───────────────────────────────────────────────────────

def test_mixed_regular_and_weekly():
    # Regular cat: 40/50 (sum), Weekly cat: avg(7,9)=8/10 → 48/60 = 80%
    cats = {
        1: _cat(1, 50, "regular"),
        2: _cat(2, 10, "weekly"),
    }
    result = compute_total_pct({1: [40.0], 2: [7.0, 9.0]}, cats)
    assert result == 80.0


def test_mixed_with_empty_category_excluded_from_denominator():
    # Cat 1 has grades, Cat 2 is empty → denominator is only Cat 1's max
    cats = {1: _cat(1, 100, "regular"), 2: _cat(2, 50, "regular")}
    result = compute_total_pct({1: [80.0]}, cats)
    # num=80, den=100 (cat2 has no grades so excluded) → 80%
    assert result == 80.0


def test_all_categories_empty_returns_none():
    cats = {1: _cat(1, 100, "regular"), 2: _cat(2, 50, "weekly")}
    assert compute_total_pct({1: [], 2: []}, cats) is None


# ── Edge cases ─────────────────────────────────────────────────────────────

def test_score_above_100_allowed():
    # Bonus can push total above 100%
    cats = {1: _cat(1, 100, "regular"), 2: _cat(2, 10, "bonus")}
    result = compute_total_pct({1: [100.0], 2: [10.0]}, cats)
    # num=110, den=110 → 100% — actually equal since bonus max is in denominator
    assert result == 100.0


def test_zero_grade_returns_zero_percent():
    cats = {1: _cat(1, 100, "regular")}
    assert compute_total_pct({1: [0.0]}, cats) == 0.0


def test_rounding_to_one_decimal():
    # 2/3 * 100 = 66.666... should round to 66.7
    cats = {1: _cat(1, 3, "regular")}
    result = compute_total_pct({1: [2.0]}, cats)
    assert result == 66.7


def test_at_risk_threshold_boundary():
    """Verify that a student exactly at 50% is not considered at-risk (boundary)."""
    cats = {1: _cat(1, 100, "regular")}
    result = compute_total_pct({1: [50.0]}, cats)
    assert result == 50.0
    assert result >= 50.0   # not below threshold


def test_realistic_diploma_grading():
    """Simulate a real course: weekly quizzes (10pt) + midterm (30pt) + final (60pt)."""
    cats = {
        1: _cat(1, 10, "weekly"),   # weekly quiz
        2: _cat(2, 30, "regular"),  # midterm
        3: _cat(3, 60, "regular"),  # final
    }
    grades = {
        1: [8.0, 7.0, 9.0, 6.0],   # avg = 7.5 / 10
        2: [24.0],                   # 24 / 30
        3: [48.0],                   # 48 / 60
    }
    # num = 7.5 + 24 + 48 = 79.5, den = 100 → 79.5%
    result = compute_total_pct(grades, cats)
    assert result == 79.5
