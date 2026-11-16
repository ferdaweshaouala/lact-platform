"""030 - Separate the curriculum (programs) from cohorts (courses)

Before: program_weeks belonged directly to a course, so every new cohort
needed its content re-entered.
After: weeks belong to a program; several courses (cohorts) can point to the
same program and share its content.

Existing data: every course that already has weeks gets its own program
(named after the course), and both the course and its weeks are linked to it.

Revision ID: 030
Revises: 029
Create Date: 2026-09-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "030"
down_revision: Union[str, None] = "029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "programs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )

    op.add_column("courses", sa.Column("program_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_courses_program_id_programs",
        "courses", "programs", ["program_id"], ["id"], ondelete="SET NULL",
    )
    op.create_index("idx_courses_program", "courses", ["program_id"])

    op.add_column("program_weeks", sa.Column("program_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_program_weeks_program_id_programs",
        "program_weeks", "programs", ["program_id"], ["id"], ondelete="CASCADE",
    )

    conn = op.get_bind()
    rows = conn.execute(sa.text("""
        SELECT DISTINCT c.course_id, c.title
        FROM courses c
        JOIN program_weeks w ON w.course_id = c.course_id
        ORDER BY c.course_id
    """)).fetchall()

    for course_id, title in rows:
        program_id = conn.execute(
            sa.text("INSERT INTO programs (name) VALUES (:name) RETURNING id"),
            {"name": title},
        ).scalar()
        conn.execute(
            sa.text("UPDATE courses SET program_id = :pid WHERE course_id = :cid"),
            {"pid": program_id, "cid": course_id},
        )
        conn.execute(
            sa.text("UPDATE program_weeks SET program_id = :pid WHERE course_id = :cid"),
            {"pid": program_id, "cid": course_id},
        )

    op.drop_constraint("uq_program_weeks_course_week", "program_weeks", type_="unique")
    op.drop_index("idx_program_weeks_course", table_name="program_weeks")
    op.drop_column("program_weeks", "course_id")
    op.alter_column("program_weeks", "program_id", nullable=False)
    op.create_unique_constraint(
        "uq_program_weeks_program_week", "program_weeks", ["program_id", "week_number"]
    )
    op.create_index("idx_program_weeks_program", "program_weeks", ["program_id"])


def downgrade() -> None:
    op.add_column("program_weeks", sa.Column("course_id", sa.Integer(), nullable=True))
    op.execute("""
        UPDATE program_weeks
        SET course_id = (
            SELECT MIN(c.course_id) FROM courses c
            WHERE c.program_id = program_weeks.program_id
        )
    """)
    op.execute("DELETE FROM program_weeks WHERE course_id IS NULL")

    op.drop_index("idx_program_weeks_program", table_name="program_weeks")
    op.drop_constraint("uq_program_weeks_program_week", "program_weeks", type_="unique")
    op.drop_constraint("fk_program_weeks_program_id_programs", "program_weeks", type_="foreignkey")
    op.drop_column("program_weeks", "program_id")

    op.alter_column("program_weeks", "course_id", nullable=False)
    op.create_foreign_key(
        "fk_program_weeks_course_id_courses",
        "program_weeks", "courses", ["course_id"], ["course_id"], ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_program_weeks_course_week", "program_weeks", ["course_id", "week_number"]
    )
    op.create_index("idx_program_weeks_course", "program_weeks", ["course_id"])

    op.drop_index("idx_courses_program", table_name="courses")
    op.drop_constraint("fk_courses_program_id_programs", "courses", type_="foreignkey")
    op.drop_column("courses", "program_id")
    op.drop_table("programs")