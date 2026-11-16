"""add staged_imports table for two-step file import flow

Revision ID: 010
Revises: 009
Create Date: 2026-04-25

Replaces the in-memory _pending dict in imports.py with a DB-backed staging
table so that upload sessions survive server restarts and work correctly
across multiple uvicorn workers.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staged_imports",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("row_data", sa.Text(), nullable=False),
        sa.Column("headers", sa.Text(), nullable=False),
        sa.Column("filename", sa.String(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("staged_imports")
