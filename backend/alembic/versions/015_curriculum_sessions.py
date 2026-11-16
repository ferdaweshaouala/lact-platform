"""Add curriculum_sessions and curriculum_attendance tables for مخطط-based attendance.

Revision ID: 015
Revises: 014
Create Date: 2026-05-04
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "curriculum_sessions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("course_id", sa.Integer, sa.ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("week_number", sa.Integer, nullable=False),
        sa.Column("session_type", sa.String, nullable=False),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "curriculum_attendance",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("enrollment_id", sa.Integer, sa.ForeignKey("enrollments.enrollment_id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("curriculum_session_id", sa.Integer, sa.ForeignKey("curriculum_sessions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("status", sa.String, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("date_recorded", sa.Date, nullable=True),
        sa.UniqueConstraint("enrollment_id", "curriculum_session_id", name="uq_cur_att_enr_session"),
    )


def downgrade() -> None:
    op.drop_table("curriculum_attendance")
    op.drop_table("curriculum_sessions")
