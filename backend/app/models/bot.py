"""Bot-side models that live in the shared PostgreSQL database.

These tables were originally in the Telegram bot's SQLite DB.
After the merge to a single shared DB, they are defined here as
SQLAlchemy models so Alembic can manage them alongside the DTMS tables.

All `user_id` references in the original bot schema are replaced with
`student_id` → students.student_id, since the DTMS `students` table
(bridged via students.telegram_id) is the canonical student record.
Teacher references use `users.user_id` as before.
"""
from sqlalchemy import (
    Column, Integer, BigInteger, String, Float, Boolean,
    Date, DateTime, Text, ForeignKey, UniqueConstraint, CheckConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Content(Base):
    """Learning material item: lecture, article, audio, or workshop.

    Equivalent to the bot's `content` table. This is the curriculum
    catalogue the bot serves to students (and that DTMS staff manage).
    """
    __tablename__ = "content"
    __table_args__ = (
        CheckConstraint(
            "content_type IN ('lecture', 'article', 'audio', 'workshop')",
            name="ck_content_type",
        ),
        UniqueConstraint("course_id", "content_type", "content_order",
                         name="uq_content_course_type_order"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    content_type = Column(String, nullable=False)   # lecture | article | audio | workshop
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, index=True)
    week = Column(Integer, nullable=True)
    content_order = Column(Integer, nullable=False)

    course = relationship("Course")


class UserProgress(Base):
    """Tracks which content items a student has completed."""
    __tablename__ = "user_progress"
    __table_args__ = (
        UniqueConstraint("student_id", "content_id", name="uq_user_progress_student_content"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False, index=True)
    content_id = Column(Integer, ForeignKey("content.id", ondelete="CASCADE"), nullable=False)
    completed = Column(Boolean, nullable=False, server_default="true")
    completed_at = Column(String, nullable=True)

    student = relationship("Student")
    content = relationship("Content")


class Schedule(Base):
    """Exam or workshop schedule entry with date, time, and join link."""
    __tablename__ = "schedules"
    __table_args__ = (
        CheckConstraint("type IN ('exam', 'workshop')", name="ck_schedule_type"),
        CheckConstraint("status IN ('closed', 'open')", name="ck_schedule_status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, index=True)
    content_id = Column(Integer, ForeignKey("content.id", ondelete="SET NULL"), nullable=True)
    date = Column(Date, nullable=True)
    start_time = Column(String, nullable=True)
    link = Column(String, nullable=True)
    type = Column(String, nullable=False)           # exam | workshop
    status = Column(String, nullable=False, server_default="closed")  # closed | open

    course = relationship("Course")
    content = relationship("Content")


class ReligiousContent(Base):
    """Islamic motivational content served by the bot (ayat, hadith, etc.)."""
    __tablename__ = "religious_content"
    __table_args__ = (
        CheckConstraint(
            "theme IN ('patience', 'effort', 'reward', 'focus')",
            name="ck_religious_theme",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    text_ar = Column(Text, nullable=False)
    reference = Column(String, nullable=True)
    theme = Column(String, nullable=False)          # patience | effort | reward | focus


class Question(Base):
    """A question asked by a student via the Telegram bot."""
    __tablename__ = "questions"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'answered')", name="ck_question_status"),
    )

    question_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, index=True)
    question_text = Column(Text, nullable=False)
    status = Column(String, nullable=False, server_default="pending")  # pending | answered
    created_at = Column(String, nullable=False)

    student = relationship("Student")
    course = relationship("Course")
    answers = relationship("Answer", back_populates="question")


class Answer(Base):
    """A teacher's answer to a student question."""
    __tablename__ = "answers"

    answer_id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.question_id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    answer_text = Column(Text, nullable=True)
    file_id = Column(String, nullable=True)
    media_group_id = Column(String, nullable=True)
    answered_at = Column(String, nullable=False)

    question = relationship("Question", back_populates="answers")
    course = relationship("Course")
    student = relationship("Student")
    teacher = relationship("User", foreign_keys=[teacher_id])


class Transcript(Base):
    """Transcript or summary for a content item (lecture, etc.)."""
    __tablename__ = "transcripts"

    transcript_id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, index=True)
    content_id = Column(Integer, ForeignKey("content.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=True)
    file_path = Column(String, nullable=True)
    created_at = Column(String, nullable=True)

    course = relationship("Course")
    content_item = relationship("Content")


class WeeklyPlan(Base):
    """AI-generated personalised weekly study plan for a student."""
    __tablename__ = "weekly_plans"
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", "week_start",
                         name="uq_weekly_plans_student_course_week"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    week_start = Column(Date, nullable=False)
    is_active = Column(Boolean, nullable=False, server_default="false")
    expires_at = Column(Date, nullable=True)
    raw_text = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    student = relationship("Student")
    course = relationship("Course")
    tasks = relationship("Task", back_populates="plan", cascade="all, delete-orphan")


class Task(Base):
    """A single task inside a weekly study plan."""
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "type IN ('lecture', 'homework', 'revision', 'exam', 'exercise')",
            name="ck_task_type",
        ),
        CheckConstraint(
            "day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday','daily')",
            name="ck_task_day",
        ),
        CheckConstraint(
            "status IN ('pending', 'in_progress', 'done', 'skipped')",
            name="ck_task_status",
        ),
        CheckConstraint("priority IN ('high', 'medium', 'low')", name="ck_task_priority"),
    )

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("weekly_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)           # lecture | homework | revision | exam | exercise
    day = Column(String, nullable=False)            # monday … sunday | daily
    status = Column(String, nullable=False, server_default="pending")
    priority = Column(String, nullable=False, server_default="medium")
    extra_data = Column("metadata", Text, nullable=True)   # JSON blob for extra bot data
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    completed_at = Column(DateTime, nullable=True)

    plan = relationship("WeeklyPlan", back_populates="tasks")
    student = relationship("Student")
    course = relationship("Course")


class TaskProgress(Base):
    """Timestamped log of every status action taken on a task."""
    __tablename__ = "task_progress"
    __table_args__ = (
        CheckConstraint(
            "action IN ('started', 'completed', 'skipped', 'resumed')",
            name="ck_task_progress_action",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String, nullable=False)         # started | completed | skipped | resumed
    timestamp = Column(DateTime, server_default=func.now(), nullable=False)
    notes = Column(Text, nullable=True)

    student = relationship("Student")
    task = relationship("Task")


class WorkshopAttendance(Base):
    """Records which students attended an online workshop (via bot check-in)."""
    __tablename__ = "workshop_attendance"
    __table_args__ = (
        UniqueConstraint("schedule_id", "student_id",
                         name="uq_workshop_attendance_schedule_student"),
    )

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False, index=True)
    attended_at = Column(DateTime, server_default=func.now(), nullable=False)

    schedule = relationship("Schedule")
    student = relationship("Student")


class RecommendationFeedback(Base):
    """Adaptive engine feedback: how a student reacted to a content recommendation."""
    __tablename__ = "recommendation_feedback"
    __table_args__ = (
        CheckConstraint(
            "reaction IN ('shown', 'started', 'skipped', 'why_this')",
            name="ck_rec_reaction",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False, index=True)
    content_id = Column(Integer, ForeignKey("content.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, index=True)
    content_type = Column(String, nullable=False)
    is_mandatory = Column(Integer, nullable=False, server_default="1")
    reaction = Column(String, nullable=False)       # shown | started | skipped | why_this
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    student = relationship("Student")
    content_item = relationship("Content")
    course = relationship("Course")
