"""Remove 'excused' attendance status — convert any existing rows to 'absent'.

Revision ID: 014
Revises: 013
Create Date: 2026-04-30
"""
from typing import Sequence, Union
from alembic import op

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE attendance_records SET status = 'absent' WHERE status = 'excused'")
    # Refresh denormalized absences counter on enrollments to match the new reality.
    op.execute(
        """
        UPDATE enrollments AS e
        SET absences = COALESCE((
            SELECT COUNT(*) FROM attendance_records
            WHERE attendance_records.enrollment_id = e.enrollment_id
              AND attendance_records.status = 'absent'
        ), 0)
        """
    )


def downgrade() -> None:
    # Cannot recover which rows were originally 'excused' vs 'absent' — no-op.
    pass
