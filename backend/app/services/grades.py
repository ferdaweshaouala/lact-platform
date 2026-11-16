"""Grade computation service.

Contains the canonical algorithm for computing an enrollment's total grade
percentage. This logic was previously duplicated in:
  - routes/gradebook.py  (cell-by-cell display)
  - routes/analytics.py  (at-risk detection)

Both routes now call compute_total_pct() so a change to the algorithm
propagates consistently.
"""
from app.models.grade import GradeCategory


def compute_total_pct(
    grade_values_by_category: dict[int, list[float]],
    categories: dict[int, GradeCategory],
) -> float | None:
    """Return total grade as a percentage (0–100+), or None if no grades.

    Args:
        grade_values_by_category: { category_id: [grade_values] }
        categories:               { category_id: GradeCategory }

    Algorithm:
        - weekly  categories: contribution = average(values)
        - regular/bonus cats: contribution = sum(values)
        total_pct = Σ contribution / Σ category.max_value × 100
    """
    num = 0.0
    den = 0.0

    for cat_id, cat in categories.items():
        values = grade_values_by_category.get(cat_id, [])
        if not values:
            continue
        if cat.kind == "weekly":
            num += sum(values) / len(values)
        else:
            num += sum(values)
        den += cat.max_value

    if den == 0:
        return None

    return round(num / den * 1000) / 10
