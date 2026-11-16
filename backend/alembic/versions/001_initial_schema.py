"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-04-16
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _exists(table: str) -> bool:
    """Return True if the table already exists in the database."""
    return inspect(op.get_bind()).has_table(table)


def upgrade() -> None:
    if not _exists("users"):
        op.create_table(
            "users",
            sa.Column("user_id", sa.Integer(), primary_key=True, index=True),
            sa.Column("first_name", sa.String(), nullable=False),
            sa.Column("last_name", sa.String(), nullable=False),
            sa.Column("email", sa.String(), unique=True, nullable=False, index=True),
            sa.Column("role", sa.String(), nullable=False),
            sa.Column("password_hash", sa.String(), nullable=False),
        )

    if not _exists("students"):
        op.create_table(
            "students",
            sa.Column("student_id", sa.Integer(), primary_key=True, index=True),
            sa.Column("first_name", sa.String(), nullable=False),
            sa.Column("last_name", sa.String(), nullable=False),
            sa.Column("date_of_birth", sa.Date(), nullable=True),
            sa.Column("student_number", sa.String(), unique=True, nullable=False),
            sa.Column("email", sa.String(), nullable=True),
        )

    if not _exists("courses"):
        op.create_table(
            "courses",
            sa.Column("course_id", sa.Integer(), primary_key=True, index=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("start_date", sa.Date(), nullable=True),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(), server_default="Active"),
            sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=True),
            sa.Column("supervisor_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=True),
        )

    if not _exists("sessions"):
        op.create_table(
            "sessions",
            sa.Column("session_id", sa.Integer(), primary_key=True, index=True),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id"), nullable=False),
            sa.Column("session_date", sa.Date(), nullable=True),
            sa.Column("duration", sa.String(), nullable=True),
            sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=True),
        )

    if not _exists("enrollments"):
        op.create_table(
            "enrollments",
            sa.Column("enrollment_id", sa.Integer(), primary_key=True, index=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.student_id"), nullable=False),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id"), nullable=False),
            sa.Column("enrollment_date", sa.Date(), nullable=True),
            sa.Column("completion_status", sa.String(), server_default="Ongoing"),
        )

    if not _exists("grades"):
        op.create_table(
            "grades",
            sa.Column("grade_id", sa.Integer(), primary_key=True, index=True),
            sa.Column("enrollment_id", sa.Integer(), sa.ForeignKey("enrollments.enrollment_id"), nullable=False),
            sa.Column("type", sa.String(), nullable=False),
            sa.Column("value", sa.Float(), nullable=False),
            sa.Column("date_recorded", sa.Date(), nullable=True),
        )

    if not _exists("feedbacks"):
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

    if not _exists("analytics"):
        op.create_table(
            "analytics",
            sa.Column("analytics_id", sa.Integer(), primary_key=True, index=True),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id"), nullable=False),
            sa.Column("metric_name", sa.String(), nullable=False),
            sa.Column("metric_value", sa.Float(), nullable=False),
            sa.Column("calculated_at", sa.DateTime(), server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("analytics")
    op.drop_table("feedbacks")
    op.drop_table("grades")
    op.drop_table("enrollments")
    op.drop_table("sessions")
    op.drop_table("courses")
    op.drop_table("students")
    op.drop_table("users")
