"""024 – Telegram bot integration tables

Adds:
  - students.telegram_id          : links a DTMS student to their Telegram account
  - telegram_groups               : maps a course to its Telegram group
  - submissions                   : homework/file submissions received via the bot
  - compensation_requests         : makeup requests submitted via the bot

Revision ID: 024
Revises: 023
Create Date: 2026-05-11
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Link students to Telegram
    op.add_column(
        "students",
        sa.Column("telegram_id", sa.BigInteger(), nullable=True, unique=True),
    )
    op.create_index("idx_students_telegram_id", "students", ["telegram_id"])

    # 2. Telegram groups — one group per course
    op.create_table(
        "telegram_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("telegram_group_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("group_name", sa.String(), nullable=True),
    )
    op.create_index("idx_telegram_groups_course", "telegram_groups", ["course_id"])

    # 3. Submissions — files/homework sent via bot
    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False),
        sa.Column("curriculum_session_id", sa.Integer(), sa.ForeignKey("curriculum_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("file_id", sa.String(), nullable=False),       # Telegram file_id
        sa.Column("file_name", sa.String(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=False),
        sa.Column("grade", sa.Float(), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("graded_at", sa.DateTime(), nullable=True),
    )
    op.create_index("idx_submissions_student", "submissions", ["student_id"])
    op.create_index("idx_submissions_course", "submissions", ["course_id"])

    # 4. Compensation requests — makeup requests submitted via bot
    op.create_table(
        "compensation_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False),
        sa.Column("curriculum_session_id", sa.Integer(), sa.ForeignKey("curriculum_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),  # pending / accepted / rejected
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("idx_comp_requests_student", "compensation_requests", ["student_id"])
    op.create_index("idx_comp_requests_course", "compensation_requests", ["course_id"])
    op.create_index("idx_comp_requests_status", "compensation_requests", ["status"])


def downgrade() -> None:
    op.drop_table("compensation_requests")
    op.drop_table("submissions")
    op.drop_table("telegram_groups")
    op.drop_index("idx_students_telegram_id", table_name="students")
    op.drop_column("students", "telegram_id")
