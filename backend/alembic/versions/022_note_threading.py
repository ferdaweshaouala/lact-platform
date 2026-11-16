"""022 – note threading (parent_id for teacher ↔ supervisor replies)

Adds:
  course_notes.parent_id  INTEGER NULL FK → course_notes.id

Revision ID: 022
Revises: 021
"""
from alembic import op
import sqlalchemy as sa

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade():
    # Column may already exist if model was auto-created; skip gracefully
    from sqlalchemy import inspect
    from alembic import op as _op
    bind = _op.get_bind()
    inspector = inspect(bind)
    existing_cols = [c["name"] for c in inspector.get_columns("course_notes")]
    if "parent_id" not in existing_cols:
        op.add_column(
            "course_notes",
            sa.Column(
                "parent_id",
                sa.Integer(),
                sa.ForeignKey("course_notes.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )
    existing_indexes = [i["name"] for i in inspector.get_indexes("course_notes")]
    if "ix_course_notes_parent_id" not in existing_indexes:
        op.create_index("ix_course_notes_parent_id", "course_notes", ["parent_id"])


def downgrade():
    op.drop_index("ix_course_notes_parent_id", table_name="course_notes")
    op.drop_column("course_notes", "parent_id")
