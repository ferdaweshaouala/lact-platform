"""020 – course notes

Adds:
  course_notes   – teacher → supervisor per-session notes

Revision ID: 020
Revises: 019
"""
from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "course_notes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "course_id",
            sa.Integer(),
            sa.ForeignKey("courses.course_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            sa.Integer(),
            sa.ForeignKey("users.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "curriculum_session_id",
            sa.Integer(),
            sa.ForeignKey("curriculum_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_course_notes_course_id", "course_notes", ["course_id"])
    op.create_index("ix_course_notes_author_id", "course_notes", ["author_id"])


def downgrade():
    op.drop_index("ix_course_notes_author_id", table_name="course_notes")
    op.drop_index("ix_course_notes_course_id", table_name="course_notes")
    op.drop_table("course_notes")
