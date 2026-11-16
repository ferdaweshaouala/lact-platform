"""per-session attendance records

Revision ID: 008
Revises: 007
Create Date: 2026-04-25

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("enrollment_id", sa.Integer, sa.ForeignKey("enrollments.enrollment_id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_date", sa.Date, nullable=False),
        sa.Column("status", sa.String, nullable=False),  # present | absent | excused | makeup
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("recorded_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("enrollment_id", "session_date", name="uq_attendance_enrollment_date"),
    )
    op.create_index("ix_attendance_enrollment_id", "attendance_records", ["enrollment_id"])
    op.create_index("ix_attendance_session_date", "attendance_records", ["session_date"])


def downgrade() -> None:
    op.drop_index("ix_attendance_session_date", table_name="attendance_records")
    op.drop_index("ix_attendance_enrollment_id", table_name="attendance_records")
    op.drop_table("attendance_records")
