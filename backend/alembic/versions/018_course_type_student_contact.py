"""018 – course_type, total_sessions, student phone_number + city

Adds:
  courses.course_type       VARCHAR DEFAULT 'onsite'   (online / onsite)
  courses.total_sessions    INTEGER NULL               (planned curriculum sessions)
  students.phone_number     VARCHAR NULL
  students.city             VARCHAR NULL

Revision ID: 018
Revises: 017
"""
from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade():
    # ── courses ──────────────────────────────────────────────────────
    op.add_column("courses", sa.Column("course_type", sa.String(), nullable=True))
    op.add_column("courses", sa.Column("total_sessions", sa.Integer(), nullable=True))

    # Back-fill existing rows so they are not NULL
    op.execute("UPDATE courses SET course_type = 'onsite' WHERE course_type IS NULL")

    # Now tighten to NOT NULL with a default for future inserts
    op.alter_column("courses", "course_type", nullable=False, server_default="onsite")

    # ── students ─────────────────────────────────────────────────────
    op.add_column("students", sa.Column("phone_number", sa.String(), nullable=True))
    op.add_column("students", sa.Column("city", sa.String(), nullable=True))


def downgrade():
    op.drop_column("students", "city")
    op.drop_column("students", "phone_number")
    op.drop_column("courses", "total_sessions")
    op.drop_column("courses", "course_type")
