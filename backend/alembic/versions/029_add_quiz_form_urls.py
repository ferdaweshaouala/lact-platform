"""029 - Add optional quiz form URLs to week items.

Revision ID: 029
Revises: 028
Create Date: 2026-09-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "029"
down_revision: Union[str, None] = "028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing_columns = {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns("week_items")
    }
    if "pre_quiz_form_url" not in existing_columns:
        op.add_column(
            "week_items",
            sa.Column("pre_quiz_form_url", sa.String(), nullable=True),
        )
    if "post_quiz_form_url" not in existing_columns:
        op.add_column(
            "week_items",
            sa.Column("post_quiz_form_url", sa.String(), nullable=True),
        )


def downgrade() -> None:
    # These columns may already be part of the 028 schema; preserve their data.
    pass
