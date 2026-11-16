"""027 – Add approval_status to enrollments (student self-registration)

Existing enrollments (created by supervisors) are auto-approved.
New self-service student enrollments start as "pending" until an
admin/supervisor approves them.

Revision ID: 027
Revises: 026
Create Date: 2026-09-06
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "enrollments",
        sa.Column("approval_status", sa.String(), server_default="approved", nullable=False),
    )
    op.create_check_constraint(
        "ck_enrollment_approval_status",
        "enrollments",
        "approval_status IN ('pending', 'approved', 'rejected')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_enrollment_approval_status", "enrollments", type_="check")
    op.drop_column("enrollments", "approval_status")