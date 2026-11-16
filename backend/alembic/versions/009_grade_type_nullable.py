"""drop NOT NULL on grades.type — categories are now the source of truth

Revision ID: 009
Revises: 008
Create Date: 2026-04-25

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("grades", "type", existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    # Backfill any null types before re-adding the constraint, so the migration is reversible.
    op.execute("UPDATE grades SET type = 'unknown' WHERE type IS NULL;")
    op.alter_column("grades", "type", existing_type=sa.String(), nullable=False)
