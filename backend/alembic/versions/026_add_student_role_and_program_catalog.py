"""026 – Add student role, link students to users, create program_catalog

Adds:
  - "student" to the users.role CHECK constraint
  - users.is_active (for future manual-approval flexibility)
  - students.user_id (nullable FK -> users.user_id, unique)
  - program_catalog table (extensible course/program list, seeded with
    the current "دبلومة العلم والعمل" curriculum courses)

Revision ID: 026
Revises: 025
Create Date: 2026-09-06
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Allow "student" as a valid role ────────────────────────────────
    op.drop_constraint("ck_user_role", "users", type_="check")
    op.create_check_constraint(
        "ck_user_role",
        "users",
        "role IN ('admin', 'teacher', 'supervisor', 'student')",
    )

    # ── 2. users.is_active — lets us switch to manual approval later
    #      without another migration (just flip the default / update rows)
    op.add_column(
        "users",
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )

    # ── 3. students.user_id — links a student record to a login account
    op.add_column(
        "students",
        sa.Column("user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_students_user_id_users",
        "students",
        "users",
        ["user_id"],
        ["user_id"],
        ondelete="SET NULL",
    )
    op.create_unique_constraint(
        "uq_students_user_id",
        "students",
        ["user_id"],
    )

    # ── 4. program_catalog — extensible list of courses/programs ──────────
    op.create_table(
        "program_catalog",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False, unique=True),
        sa.Column(
            "category", sa.String(), nullable=False, server_default="adult",
            comment="adult | children | youth",
        ),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "category IN ('adult', 'children', 'youth')",
            name="ck_program_catalog_category",
        ),
    )

    # Seed with current known programs (adult track)
    program_catalog = sa.table(
        "program_catalog",
        sa.column("name", sa.String),
        sa.column("category", sa.String),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(
        program_catalog,
        [
            {"name": "دبلومة العلم والعمل", "category": "adult", "sort_order": 1},
            {"name": "صناعة الطفل 1", "category": "adult", "sort_order": 2},
            {"name": "صناعة الطفل 2", "category": "adult", "sort_order": 3},
            {"name": "صناعة الطفل 3", "category": "adult", "sort_order": 4},
            {"name": "بناء الأبناء 1", "category": "adult", "sort_order": 5},
            {"name": "بناء الأبناء 2", "category": "adult", "sort_order": 6},
            {"name": "إمداد الفؤاد 1", "category": "adult", "sort_order": 7},
            {"name": "إمداد الفؤاد 2", "category": "adult", "sort_order": 8},
            {"name": "منهاج الطالب المسلم", "category": "adult", "sort_order": 9},
            {"name": "منجيات من فتن الشهوات", "category": "adult", "sort_order": 10},
            {"name": "إسعاد الأولاد", "category": "adult", "sort_order": 11},
        ],
    )


def downgrade() -> None:
    op.drop_table("program_catalog")

    op.drop_constraint("uq_students_user_id", "students", type_="unique")
    op.drop_constraint("fk_students_user_id_users", "students", type_="foreignkey")
    op.drop_column("students", "user_id")

    op.drop_column("users", "is_active")

    op.drop_constraint("ck_user_role", "users", type_="check")
    op.create_check_constraint(
        "ck_user_role",
        "users",
        "role IN ('admin', 'teacher', 'supervisor')",
    )