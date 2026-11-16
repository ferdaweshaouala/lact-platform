"""Remove NADI-specific tables and columns (books, student_groups, grades.book_id, students.group_id)

Revision ID: 012
Revises: 011
Create Date: 2026-04-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _exists(table: str) -> bool:
    return inspect(op.get_bind()).has_table(table)


def _col_exists(table: str, column: str) -> bool:
    cols = [c["name"] for c in inspect(op.get_bind()).get_columns(table)]
    return column in cols


def upgrade() -> None:
    # Drop FK column from grades first (references books)
    if _col_exists("grades", "book_id"):
        op.drop_column("grades", "book_id")

    # Drop FK column from students (references student_groups)
    if _col_exists("students", "group_id"):
        op.drop_column("students", "group_id")

    # Now safe to drop the referenced tables
    if _exists("books"):
        op.drop_table("books")

    if _exists("student_groups"):
        op.drop_table("student_groups")


def downgrade() -> None:
    if not _exists("student_groups"):
        op.create_table(
            "student_groups",
            sa.Column("group_id", sa.Integer(), primary_key=True, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("gender", sa.String(), nullable=True),
            sa.Column("age_range", sa.String(), nullable=True),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id"), nullable=True),
            sa.Column("google_sheet_id", sa.String(), nullable=True),
            sa.Column("google_sheet_gid", sa.String(), nullable=True),
        )

    if not _exists("books"):
        op.create_table(
            "books",
            sa.Column("book_id", sa.Integer(), primary_key=True, index=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("order_index", sa.Integer(), nullable=True),
            sa.Column("exam_max_score", sa.Float(), nullable=True),
            sa.Column("session_count", sa.Integer(), nullable=True),
            sa.Column("session_points", sa.Float(), default=3.0),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id"), nullable=True),
            sa.Column("google_form_sheet_id", sa.String(), nullable=True),
        )

    if not _col_exists("students", "group_id"):
        op.add_column(
            "students",
            sa.Column("group_id", sa.Integer(), sa.ForeignKey("student_groups.group_id"), nullable=True),
        )

    if not _col_exists("grades", "book_id"):
        op.add_column(
            "grades",
            sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.book_id"), nullable=True),
        )
