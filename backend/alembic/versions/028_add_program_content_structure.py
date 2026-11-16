"""028 – Program content structure: weeks, items, student progress

Adds the tables needed to run "دبلومة العلم والعمل" (and future programs)
as a structured, sequential curriculum:
  - program_weeks: weeks within a course, opened progressively, hidden as a whole once done
  - week_items: lectures / readings / listening / mini-circle exams within a week
  - student_item_progress: per-student completion + quiz scores (quizzes are
    external Google Forms for now — pre_quiz_form_url / post_quiz_form_url)

Revision ID: 028
Revises: 027
Create Date: 2026-09-08
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "028"
down_revision: Union[str, None] = "027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── program_weeks ──────────────────────────────────────────────────
    op.create_table(
        "program_weeks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "course_id", sa.Integer(),
            sa.ForeignKey("courses.course_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("week_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("is_visible", sa.Boolean(), server_default="true", nullable=False),
        sa.UniqueConstraint("course_id", "week_number", name="uq_program_weeks_course_week"),
    )
    op.create_index("idx_program_weeks_course", "program_weeks", ["course_id"])

    # ── week_items ─────────────────────────────────────────────────────
    op.create_table(
        "week_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "week_id", sa.Integer(),
            sa.ForeignKey("program_weeks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("item_type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("video_url", sa.String(), nullable=True),
        sa.Column("pre_quiz_form_url", sa.String(), nullable=True),
        sa.Column("post_quiz_form_url", sa.String(), nullable=True),
        sa.CheckConstraint(
            "item_type IN ('lecture', 'reading', 'listening', 'mini_circle_exam')",
            name="ck_week_item_type",
        ),
    )
    op.create_index("idx_week_items_week_order", "week_items", ["week_id", "order"])

    # ── student_item_progress ─────────────────────────────────────────
    op.create_table(
        "student_item_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "enrollment_id", sa.Integer(),
            sa.ForeignKey("enrollments.enrollment_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "item_id", sa.Integer(),
            sa.ForeignKey("week_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("completed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint(
            "enrollment_id", "item_id", name="uq_student_item_progress_enrollment_item"
        ),
    )
    op.create_index(
        "idx_student_item_progress_enrollment", "student_item_progress", ["enrollment_id"]
    )


def downgrade() -> None:
    op.drop_table("student_item_progress")
    op.drop_table("week_items")
    op.drop_table("program_weeks")