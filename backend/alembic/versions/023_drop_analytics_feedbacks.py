"""023 – drop unused analytics and feedbacks tables

These tables were created by the initial schema (001) but correspond to
Analytics and Feedback models that were never used in production queries
and have since been removed from the Python codebase.  Dropping them
keeps the DB schema in sync with the models.

Revision ID: 023
Revises: 022
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing = inspect(op.get_bind()).get_table_names()
    # feedbacks first — it has no dependents
    if "feedbacks" in existing:
        op.drop_table("feedbacks")
    if "analytics" in existing:
        op.drop_table("analytics")


def downgrade() -> None:
    """Recreate the tables so the migration is fully reversible."""
    op.create_table(
        "feedbacks",
        sa.Column("feedback_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.student_id"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_table(
        "analytics",
        sa.Column("analytics_id", sa.Integer(), primary_key=True, index=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id"), nullable=False),
        sa.Column("metric_name", sa.String(), nullable=False),
        sa.Column("metric_value", sa.Float(), nullable=False),
        sa.Column("calculated_at", sa.DateTime(), server_default=sa.func.now()),
    )
