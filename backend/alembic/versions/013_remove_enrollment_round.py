"""Remove enrollments.round column

Revision ID: 013
Revises: 012
Create Date: 2026-04-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _col_exists(table: str, column: str) -> bool:
    cols = [c["name"] for c in inspect(op.get_bind()).get_columns(table)]
    return column in cols


def upgrade() -> None:
    if _col_exists("enrollments", "round"):
        op.drop_column("enrollments", "round")


def downgrade() -> None:
    if not _col_exists("enrollments", "round"):
        op.add_column("enrollments", sa.Column("round", sa.String(), nullable=True))
