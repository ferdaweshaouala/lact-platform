"""025 – Sync DTMS schema with Telegram bot DB

Both systems now share the same PostgreSQL database.
This migration aligns all overlapping tables and adds every
bot-only table so the bot can be pointed at PostgreSQL directly.

Changes to existing tables (your side):
  courses               – add workshop_day
  students              – add last_active, streak
  submissions           – rename curriculum_session_id → content_id (FK → content),
                          add media_group_id
  compensation_requests – rename curriculum_session_id → content_id (FK → content),
                          add telegram_id

New tables (from bot, added to shared DB):
  content, user_progress, schedules, religious_content,
  questions, answers, transcripts,
  weekly_plans, tasks, task_progress,
  workshop_attendance, recommendation_feedback

Revision ID: 025
Revises: 024
Create Date: 2026-05-12
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ── 1. content (must be created first – FKs below reference it) ──────────
    op.create_table(
        "content",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "content_type", sa.String(), nullable=False,
            comment="lecture | article | audio | workshop",
        ),
        sa.Column(
            "course_id", sa.Integer(),
            sa.ForeignKey("courses.course_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("week", sa.Integer(), nullable=True),
        sa.Column("content_order", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "content_type IN ('lecture', 'article', 'audio', 'workshop')",
            name="ck_content_type",
        ),
        sa.UniqueConstraint(
            "course_id", "content_type", "content_order",
            name="uq_content_course_type_order",
        ),
    )
    op.create_index("idx_content_course_type", "content", ["course_id", "content_type"])

    # ── 2. courses: add workshop_day ──────────────────────────────────────────
    op.add_column("courses", sa.Column("workshop_day", sa.String(), nullable=True))

    # ── 3. students: add last_active, streak ─────────────────────────────────
    op.add_column("students", sa.Column("last_active", sa.Date(), nullable=True))
    op.add_column(
        "students",
        sa.Column("streak", sa.Integer(), server_default="0", nullable=False),
    )

    # ── 4. submissions: curriculum_session_id → content_id + media_group_id ──
    op.drop_constraint(
        "submissions_curriculum_session_id_fkey", "submissions", type_="foreignkey"
    )
    op.alter_column("submissions", "curriculum_session_id", new_column_name="content_id")
    op.create_foreign_key(
        "submissions_content_id_fkey",
        "submissions", "content",
        ["content_id"], ["id"],
        ondelete="SET NULL",
    )
    op.add_column("submissions", sa.Column("media_group_id", sa.String(), nullable=True))

    # ── 5. compensation_requests: curriculum_session_id → content_id + telegram_id ──
    op.drop_constraint(
        "compensation_requests_curriculum_session_id_fkey",
        "compensation_requests", type_="foreignkey",
    )
    op.alter_column(
        "compensation_requests", "curriculum_session_id", new_column_name="content_id"
    )
    op.create_foreign_key(
        "compensation_requests_content_id_fkey",
        "compensation_requests", "content",
        ["content_id"], ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "compensation_requests",
        sa.Column("telegram_id", sa.BigInteger(), nullable=True),
    )
    op.create_index(
        "idx_comp_requests_telegram_id", "compensation_requests", ["telegram_id"]
    )

    # ── 6. user_progress ─────────────────────────────────────────────────────
    op.create_table(
        "user_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "student_id", sa.Integer(),
            sa.ForeignKey("students.student_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "content_id", sa.Integer(),
            sa.ForeignKey("content.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("completed", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("completed_at", sa.String(), nullable=True),
        sa.UniqueConstraint(
            "student_id", "content_id", name="uq_user_progress_student_content"
        ),
    )
    op.create_index("idx_user_progress_student", "user_progress", ["student_id"])

    # ── 7. schedules ─────────────────────────────────────────────────────────
    op.create_table(
        "schedules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "course_id", sa.Integer(),
            sa.ForeignKey("courses.course_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "content_id", sa.Integer(),
            sa.ForeignKey("content.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("date", sa.Date(), nullable=True),
        sa.Column("start_time", sa.String(), nullable=True),
        sa.Column("link", sa.String(), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default="closed", nullable=False),
        sa.CheckConstraint("type IN ('exam', 'workshop')", name="ck_schedule_type"),
        sa.CheckConstraint("status IN ('closed', 'open')", name="ck_schedule_status"),
    )
    op.create_index("idx_schedules_course", "schedules", ["course_id"])

    # ── 8. religious_content ──────────────────────────────────────────────────
    op.create_table(
        "religious_content",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("text_ar", sa.Text(), nullable=False),
        sa.Column("reference", sa.String(), nullable=True),
        sa.Column("theme", sa.String(), nullable=False),
        sa.CheckConstraint(
            "theme IN ('patience', 'effort', 'reward', 'focus')",
            name="ck_religious_theme",
        ),
    )

    # ── 9. questions ─────────────────────────────────────────────────────────
    op.create_table(
        "questions",
        sa.Column("question_id", sa.Integer(), primary_key=True),
        sa.Column(
            "student_id", sa.Integer(),
            sa.ForeignKey("students.student_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id", sa.Integer(),
            sa.ForeignKey("courses.course_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), server_default="pending", nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending', 'answered')", name="ck_question_status"
        ),
    )
    op.create_index("idx_questions_student", "questions", ["student_id"])
    op.create_index("idx_questions_course", "questions", ["course_id"])

    # ── 10. answers ───────────────────────────────────────────────────────────
    op.create_table(
        "answers",
        sa.Column("answer_id", sa.Integer(), primary_key=True),
        sa.Column(
            "question_id", sa.Integer(),
            sa.ForeignKey("questions.question_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id", sa.Integer(),
            sa.ForeignKey("courses.course_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id", sa.Integer(),
            sa.ForeignKey("students.student_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "teacher_id", sa.Integer(),
            sa.ForeignKey("users.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("file_id", sa.String(), nullable=True),
        sa.Column("media_group_id", sa.String(), nullable=True),
        sa.Column("answered_at", sa.String(), nullable=False),
    )
    op.create_index("idx_answers_question", "answers", ["question_id"])

    # ── 11. transcripts ───────────────────────────────────────────────────────
    op.create_table(
        "transcripts",
        sa.Column("transcript_id", sa.Integer(), primary_key=True),
        sa.Column(
            "course_id", sa.Integer(),
            sa.ForeignKey("courses.course_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "content_id", sa.Integer(),
            sa.ForeignKey("content.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("file_path", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
    )
    op.create_index("idx_transcripts_course", "transcripts", ["course_id"])
    op.create_index("idx_transcripts_content", "transcripts", ["content_id"])

    # ── 12. weekly_plans ─────────────────────────────────────────────────────
    op.create_table(
        "weekly_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "student_id", sa.Integer(),
            sa.ForeignKey("students.student_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id", sa.Integer(),
            sa.ForeignKey("courses.course_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("expires_at", sa.Date(), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint(
            "student_id", "course_id", "week_start",
            name="uq_weekly_plans_student_course_week",
        ),
    )
    op.create_index(
        "idx_weekly_plans_student_course", "weekly_plans", ["student_id", "course_id"]
    )
    op.create_index(
        "idx_weekly_plans_active", "weekly_plans", ["student_id", "is_active"]
    )

    # ── 13. tasks ────────────────────────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "plan_id", sa.Integer(),
            sa.ForeignKey("weekly_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id", sa.Integer(),
            sa.ForeignKey("students.student_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id", sa.Integer(),
            sa.ForeignKey("courses.course_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("day", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default="pending", nullable=False),
        sa.Column("priority", sa.String(), server_default="medium", nullable=False),
        sa.Column("metadata", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "type IN ('lecture', 'homework', 'revision', 'exam', 'exercise')",
            name="ck_task_type",
        ),
        sa.CheckConstraint(
            "day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday','daily')",
            name="ck_task_day",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'in_progress', 'done', 'skipped')",
            name="ck_task_status",
        ),
        sa.CheckConstraint(
            "priority IN ('high', 'medium', 'low')", name="ck_task_priority"
        ),
    )
    op.create_index("idx_tasks_student_day", "tasks", ["student_id", "day", "status"])
    op.create_index("idx_tasks_plan", "tasks", ["plan_id"])

    # ── 14. task_progress ────────────────────────────────────────────────────
    op.create_table(
        "task_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "student_id", sa.Integer(),
            sa.ForeignKey("students.student_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "task_id", sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column(
            "timestamp", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "action IN ('started', 'completed', 'skipped', 'resumed')",
            name="ck_task_progress_action",
        ),
    )
    op.create_index(
        "idx_task_progress_student_task", "task_progress", ["student_id", "task_id"]
    )

    # ── 15. workshop_attendance ───────────────────────────────────────────────
    op.create_table(
        "workshop_attendance",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "schedule_id", sa.Integer(),
            sa.ForeignKey("schedules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id", sa.Integer(),
            sa.ForeignKey("students.student_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "attended_at", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint(
            "schedule_id", "student_id",
            name="uq_workshop_attendance_schedule_student",
        ),
    )

    # ── 16. recommendation_feedback ───────────────────────────────────────────
    op.create_table(
        "recommendation_feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "student_id", sa.Integer(),
            sa.ForeignKey("students.student_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "content_id", sa.Integer(),
            sa.ForeignKey("content.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id", sa.Integer(),
            sa.ForeignKey("courses.course_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("is_mandatory", sa.Integer(), server_default="1", nullable=False),
        sa.Column("reaction", sa.String(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "reaction IN ('shown', 'started', 'skipped', 'why_this')",
            name="ck_rec_reaction",
        ),
    )
    op.create_index(
        "idx_rec_feedback_student_course",
        "recommendation_feedback", ["student_id", "course_id"],
    )
    op.create_index(
        "idx_rec_feedback_created", "recommendation_feedback", ["created_at"]
    )


def downgrade() -> None:
    op.drop_table("recommendation_feedback")
    op.drop_table("workshop_attendance")
    op.drop_table("task_progress")
    op.drop_table("tasks")
    op.drop_table("weekly_plans")
    op.drop_table("transcripts")
    op.drop_table("answers")
    op.drop_table("questions")
    op.drop_table("religious_content")
    op.drop_table("schedules")
    op.drop_table("user_progress")

    # Revert submissions
    op.drop_column("submissions", "media_group_id")
    op.drop_constraint("submissions_content_id_fkey", "submissions", type_="foreignkey")
    op.alter_column("submissions", "content_id", new_column_name="curriculum_session_id")
    op.create_foreign_key(
        None, "submissions", "curriculum_sessions",
        ["curriculum_session_id"], ["id"], ondelete="SET NULL",
    )

    # Revert compensation_requests
    op.drop_index("idx_comp_requests_telegram_id", table_name="compensation_requests")
    op.drop_column("compensation_requests", "telegram_id")
    op.drop_constraint(
        "compensation_requests_content_id_fkey", "compensation_requests", type_="foreignkey"
    )
    op.alter_column(
        "compensation_requests", "content_id", new_column_name="curriculum_session_id"
    )
    op.create_foreign_key(
        None, "compensation_requests", "curriculum_sessions",
        ["curriculum_session_id"], ["id"], ondelete="SET NULL",
    )

    op.drop_column("students", "streak")
    op.drop_column("students", "last_active")
    op.drop_column("courses", "workshop_day")
    op.drop_table("content")
