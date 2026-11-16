"""
Synthetic data generator for the DTMS dropout prediction model.

Generates realistic student enrollment records following statistical
distributions derived from training organization research literature.
Dropout rate: ~22% (consistent with published online training studies).

Each record represents one student-course enrollment with:
- Attendance patterns
- Grade trajectories
- Submission behavior
- Compensation/makeup request patterns
"""

import numpy as np
import pandas as pd
from typing import Tuple

# ── Reproducibility ──────────────────────────────────────────────────────────
SEED = 42
rng  = np.random.default_rng(SEED)


def _clip(arr: np.ndarray, lo: float = 0.0, hi: float = 1.0) -> np.ndarray:
    return np.clip(arr, lo, hi)


def generate_dataset(n_samples: int = 1000) -> pd.DataFrame:
    """
    Generate a synthetic dataset of student enrollment records.

    Parameters
    ----------
    n_samples : int
        Number of enrollment records to generate (default 1000).

    Returns
    -------
    pd.DataFrame
        DataFrame with features and binary target 'dropout' (1=dropped, 0=completed).
    """

    # ── Target: ~22% dropout ─────────────────────────────────────────────────
    dropout_prob = 0.22
    dropout = rng.binomial(1, dropout_prob, n_samples).astype(int)
    n_drop = dropout.sum()
    n_comp = n_samples - n_drop

    # ── Helper: generate feature for two groups then merge ───────────────────
    def feature_for_groups(drop_params, comp_params, dist='normal', clip_range=(0, 1)):
        drop_vals = _generate(n_drop, drop_params, dist)
        comp_vals = _generate(n_comp, comp_params, dist)
        result = np.empty(n_samples)
        result[dropout == 1] = drop_vals
        result[dropout == 0] = comp_vals
        return _clip(result, *clip_range)

    def _generate(n, params, dist):
        if dist == 'normal':
            return rng.normal(params['mean'], params['std'], n)
        elif dist == 'beta':
            return rng.beta(params['a'], params['b'], n)
        elif dist == 'poisson':
            return rng.poisson(params['lam'], n).astype(float)

    # ── Feature 1: Attendance rate ───────────────────────────────────────────
    # Significant overlap: some dropouts attend well before quitting,
    # some completers have poor attendance but still finish
    att_rate = feature_for_groups(
        drop_params={'mean': 0.52, 'std': 0.22},
        comp_params={'mean': 0.76, 'std': 0.16},
    )

    # ── Feature 2: Attendance trend (slope over weeks, -1 to +1) ────────────
    att_trend = feature_for_groups(
        drop_params={'mean': -0.10, 'std': 0.18},
        comp_params={'mean': 0.03,  'std': 0.14},
        clip_range=(-1, 1),
    )

    # ── Feature 3: Attendance consistency ───────────────────────────────────
    att_consistency = feature_for_groups(
        drop_params={'mean': 0.26, 'std': 0.16},
        comp_params={'mean': 0.15, 'std': 0.10},
    )

    # ── Feature 4: Grade average (%) ────────────────────────────────────────
    # More overlap — some dropouts have decent grades, some completers struggle
    att_corr_noise = rng.normal(0, 0.14, n_samples)
    base_grade = att_rate * 0.55 + 0.25 + att_corr_noise
    grade_avg = _clip(
        np.where(
            dropout == 1,
            base_grade * rng.uniform(0.65, 1.05, n_samples),
            base_grade * rng.uniform(0.85, 1.20, n_samples),
        )
    )

    # ── Feature 5: Grade trend ───────────────────────────────────────────────
    grade_trend = feature_for_groups(
        drop_params={'mean': -0.08, 'std': 0.16},
        comp_params={'mean': 0.03,  'std': 0.12},
        clip_range=(-1, 1),
    )

    # ── Feature 6: Grade variance ────────────────────────────────────────────
    grade_variance = feature_for_groups(
        drop_params={'mean': 0.20, 'std': 0.13},
        comp_params={'mean': 0.12, 'std': 0.09},
    )

    # ── Feature 7: Submission rate ───────────────────────────────────────────
    # High overlap: many dropouts submit homework for a while
    submission_rate = feature_for_groups(
        drop_params={'mean': 0.48, 'std': 0.28},
        comp_params={'mean': 0.75, 'std': 0.20},
    )

    # ── Feature 8: Average submission grade ─────────────────────────────────
    sub_grade_noise = rng.normal(0, 0.12, n_samples)
    submission_avg_grade = _clip(grade_avg * 0.88 + sub_grade_noise)
    no_sub_mask = submission_rate < 0.1
    submission_avg_grade = np.where(no_sub_mask, 0.0, submission_avg_grade)

    # ── Feature 9: Compensation (makeup) request count ───────────────────────
    comp_request_count = feature_for_groups(
        drop_params={'lam': 2.5},
        comp_params={'lam': 1.2},
        dist='poisson',
        clip_range=(0, 20),
    )

    # ── Feature 10: Makeup success rate ─────────────────────────────────────
    makeup_rate = feature_for_groups(
        drop_params={'mean': 0.35, 'std': 0.25},
        comp_params={'mean': 0.60, 'std': 0.24},
    )

    # ── Feature 11: Weeks enrolled ──────────────────────────────────────────
    # More overlap in enrollment duration
    weeks_enrolled = np.where(
        dropout == 1,
        rng.integers(3, 12, n_samples),
        rng.integers(5, 16, n_samples),
    ).astype(float)

    # ── Feature 12: Course type (0=onsite, 1=online) ─────────────────────────
    course_type = rng.binomial(1, 0.45, n_samples).astype(float)

    # ── Feature 13: Early grade signal ───────────────────────────────────────
    early_grade = _clip(grade_avg + rng.normal(0, 0.10, n_samples))

    # ── Feature 14: Late attendance drop flag ────────────────────────────────
    late_att_drop = np.where(
        (dropout == 1) & (att_trend < -0.05),
        rng.binomial(1, 0.60, n_samples),
        rng.binomial(1, 0.15, n_samples),
    ).astype(float)

    # ── Add global noise: flip ~5% of labels to simulate real-world messiness ─
    flip_mask = rng.binomial(1, 0.05, n_samples).astype(bool)
    dropout = np.where(flip_mask, 1 - dropout, dropout)

    # ── Assemble DataFrame ───────────────────────────────────────────────────
    df = pd.DataFrame({
        'att_rate':              np.round(att_rate, 4),
        'att_trend':             np.round(att_trend, 4),
        'att_consistency':       np.round(att_consistency, 4),
        'grade_avg':             np.round(grade_avg, 4),
        'grade_trend':           np.round(grade_trend, 4),
        'grade_variance':        np.round(grade_variance, 4),
        'submission_rate':       np.round(submission_rate, 4),
        'submission_avg_grade':  np.round(submission_avg_grade, 4),
        'comp_request_count':    comp_request_count.astype(int),
        'makeup_rate':           np.round(makeup_rate, 4),
        'weeks_enrolled':        weeks_enrolled.astype(int),
        'course_type':           course_type.astype(int),
        'early_grade':           np.round(early_grade, 4),
        'late_att_drop':         late_att_drop.astype(int),
        'dropout':               dropout,
    })

    return df


def get_feature_names() -> list:
    return [
        'att_rate', 'att_trend', 'att_consistency',
        'grade_avg', 'grade_trend', 'grade_variance',
        'submission_rate', 'submission_avg_grade',
        'comp_request_count', 'makeup_rate',
        'weeks_enrolled', 'course_type',
        'early_grade', 'late_att_drop',
    ]


if __name__ == "__main__":
    df = generate_dataset(1000)
    print(f"Dataset shape: {df.shape}")
    print(f"Dropout rate: {df['dropout'].mean():.1%}")
    print(f"\nFeature stats:")
    print(df.describe().round(3))
