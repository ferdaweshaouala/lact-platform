"""Add groups, books, extend grades with source/max_value/book

Revision ID: 003
Revises: 002
Create Date: 2026-04-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _exists(table: str) -> bool:
    return inspect(op.get_bind()).has_table(table)


def _col_exists(table: str, column: str) -> bool:
    cols = [c["name"] for c in inspect(op.get_bind()).get_columns(table)]
    return column in cols


def upgrade() -> None:
    # ── student_groups ────────────────────────────────────────────────────────
    # One row per group (e.g. "الغاليات 9-10 سنوات")
    if not _exists("student_groups"):
        op.create_table(
            "student_groups",
            sa.Column("group_id", sa.Integer(), primary_key=True, index=True),
            sa.Column("name", sa.String(), nullable=False),          # display name
            sa.Column("gender", sa.String(), nullable=True),         # girls / boys
            sa.Column("age_range", sa.String(), nullable=True),      # 7-8 / 9-10 / 11+
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id"), nullable=True),
            sa.Column("google_sheet_id", sa.String(), nullable=True),  # tracking sheet ID
        )

    # ── books ─────────────────────────────────────────────────────────────────
    # One row per book (10 books in نادي القارئ الصغير)
    if not _exists("books"):
        op.create_table(
            "books",
            sa.Column("book_id", sa.Integer(), primary_key=True, index=True),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("order_index", sa.Integer(), nullable=True),     # 0 = اللقاء التعريفي
            sa.Column("exam_max_score", sa.Float(), nullable=True),    # 50 / 25 / 30 …
            sa.Column("session_count", sa.Integer(), nullable=True),   # number of حصص
            sa.Column("session_points", sa.Float(), default=3.0),      # points per حصة
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.course_id"), nullable=True),
            sa.Column("google_form_sheet_id", sa.String(), nullable=True),  # form response sheet ID
        )

    # ── extend students: add group_id (nullable — only used for نادي) ─────────
    if _exists("students") and not _col_exists("students", "group_id"):
        op.add_column(
            "students",
            sa.Column("group_id", sa.Integer(), sa.ForeignKey("student_groups.group_id"), nullable=True),
        )

    # ── extend grades: max_value, source, book_id, session_number ────────────
    if _exists("grades"):
        if not _col_exists("grades", "max_value"):
            op.add_column("grades", sa.Column("max_value", sa.Float(), nullable=True))
        if not _col_exists("grades", "source"):
            op.add_column("grades", sa.Column("source", sa.String(), server_default="manual"))
        if not _col_exists("grades", "book_id"):
            op.add_column(
                "grades",
                sa.Column("book_id", sa.Integer(), sa.ForeignKey("books.book_id"), nullable=True),
            )
        if not _col_exists("grades", "session_number"):
            op.add_column("grades", sa.Column("session_number", sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove added columns from grades
    for col in ("session_number", "book_id", "source", "max_value"):
        if _col_exists("grades", col):
            op.drop_column("grades", col)

    if _col_exists("students", "group_id"):
        op.drop_column("students", "group_id")

    if _exists("books"):
        op.drop_table("books")

    if _exists("student_groups"):
        op.drop_table("student_groups")
