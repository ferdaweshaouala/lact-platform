"""Track the three lecture completion steps for each enrollment.

Revision ID: 032
Revises: 031
Create Date: 2026-11-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "032"
down_revision: Union[str, None] = "031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "student_item_progress",
        sa.Column("lecture_watched", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column(
        "student_item_progress",
        sa.Column("notes_written", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column(
        "student_item_progress",
        sa.Column("notes_sent_to_bot", sa.Boolean(), server_default=sa.false(), nullable=False),
    )

    # Preserve previously completed lectures as completed in the new checklist.
    op.execute(
        sa.text(
            """
            UPDATE student_item_progress
            SET lecture_watched = TRUE,
                notes_written = TRUE,
                notes_sent_to_bot = TRUE
            WHERE completed = TRUE
              AND item_id IN (
                  SELECT id FROM week_items WHERE item_type = 'lecture'
              )
            """
        )
    )


def downgrade() -> None:
    op.drop_column("student_item_progress", "notes_sent_to_bot")
    op.drop_column("student_item_progress", "notes_written")
    op.drop_column("student_item_progress", "lecture_watched")
