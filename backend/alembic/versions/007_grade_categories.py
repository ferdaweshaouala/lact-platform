"""per-course grade categories + enrollment tracking fields

Revision ID: 007
Revises: 006
Create Date: 2026-04-25

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "grade_categories",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("course_id", sa.Integer, sa.ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("max_value", sa.Float, nullable=False),
        sa.Column("kind", sa.String, nullable=False, server_default="regular"),  # regular | weekly | bonus
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("course_id", "name", name="uq_grade_categories_course_name"),
    )
    op.create_index("ix_grade_categories_course_id", "grade_categories", ["course_id"])

    op.add_column("enrollments", sa.Column("round", sa.String, nullable=True))
    op.add_column("enrollments", sa.Column("absences", sa.Integer, nullable=False, server_default="0"))
    op.add_column("enrollments", sa.Column("attendance_count", sa.Integer, nullable=False, server_default="0"))
    op.add_column("enrollments", sa.Column("makeup_count", sa.Integer, nullable=False, server_default="0"))

    op.add_column("grades", sa.Column("category_id", sa.Integer, sa.ForeignKey("grade_categories.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_grades_category_id", "grades", ["category_id"])

    # Backfill: create one category per (course_id, type) using the most-common max_value, then link grades.
    op.execute("""
        INSERT INTO grade_categories (course_id, name, max_value, kind, order_index)
        SELECT e.course_id, g.type, COALESCE(MAX(g.max_value), 100), 'regular', 0
        FROM grades g
        JOIN enrollments e ON e.enrollment_id = g.enrollment_id
        WHERE g.type IS NOT NULL
        GROUP BY e.course_id, g.type
        ON CONFLICT (course_id, name) DO NOTHING;
    """)

    op.execute("""
        UPDATE grades g
        SET category_id = gc.id
        FROM grade_categories gc, enrollments e
        WHERE g.enrollment_id = e.enrollment_id
          AND gc.course_id = e.course_id
          AND gc.name = g.type;
    """)


def downgrade() -> None:
    op.drop_index("ix_grades_category_id", table_name="grades")
    op.drop_column("grades", "category_id")

    op.drop_column("enrollments", "makeup_count")
    op.drop_column("enrollments", "attendance_count")
    op.drop_column("enrollments", "absences")
    op.drop_column("enrollments", "round")

    op.drop_index("ix_grade_categories_course_id", table_name="grade_categories")
    op.drop_table("grade_categories")
