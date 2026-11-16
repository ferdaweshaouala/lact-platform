"""add unique constraint and FK indexes for enrollments and grades

Revision ID: 011
Revises: 010
Create Date: 2026-04-25

Adds:
- UNIQUE(student_id, course_id) on enrollments — prevents duplicate enrollments
  that the application layer alone cannot guard against under concurrent writes.
- Explicit indexes on FK columns that drive the most common query patterns
  (PostgreSQL does NOT auto-create indexes on FK columns).
"""
from typing import Sequence, Union
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Unique constraint: a student may only be enrolled in a course once
    op.create_unique_constraint(
        "uq_enrollment_student_course",
        "enrollments",
        ["student_id", "course_id"],
    )

    # FK indexes that PostgreSQL does not create automatically
    op.create_index("ix_enrollments_course_id", "enrollments", ["course_id"])
    op.create_index("ix_enrollments_student_id", "enrollments", ["student_id"])
    op.create_index("ix_grades_enrollment_id", "grades", ["enrollment_id"])


def downgrade() -> None:
    op.drop_index("ix_grades_enrollment_id", table_name="grades")
    op.drop_index("ix_enrollments_student_id", table_name="enrollments")
    op.drop_index("ix_enrollments_course_id", table_name="enrollments")
    op.drop_constraint("uq_enrollment_student_course", "enrollments", type_="unique")
