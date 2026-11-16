"""031 – Required/optional flag per item, optional workshop time

Revision ID: 031
Revises: 030
Create Date: 2026-09-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "031"
down_revision: Union[str, None] = "030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "week_items",
        sa.Column("is_required", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "courses",
        sa.Column("workshop_time", sa.String(), nullable=True),  # e.g. "19:00"
    )


def downgrade() -> None:
    op.drop_column("courses", "workshop_time")
    op.drop_column("week_items", "is_required")