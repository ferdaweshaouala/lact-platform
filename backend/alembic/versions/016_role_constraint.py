"""Add CHECK constraint on users.role to enforce valid values at DB level.

Revision ID: 016
Revises: 015
Create Date: 2026-05-04
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Sanitise any rows that might have a non-standard role value before adding
    # the constraint (makes the migration safe to run on existing data).
    op.execute(
        "UPDATE users SET role = 'admin' "
        "WHERE role NOT IN ('admin', 'teacher', 'supervisor')"
    )
    op.create_check_constraint(
        "ck_user_role",
        "users",
        "role IN ('admin', 'teacher', 'supervisor')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_user_role", "users", type_="check")
