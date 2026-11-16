"""021 – curriculum attendance follow-up flag

Adds:
  curriculum_attendance.followed_up  BOOLEAN NOT NULL DEFAULT FALSE
  course_notes table (if not already created by 020)

Revision ID: 021
Revises: 020
"""
from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "curriculum_attendance",
        sa.Column("followed_up", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("curriculum_attendance", "followed_up")
