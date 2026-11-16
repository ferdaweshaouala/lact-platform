from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime,
    ForeignKey, UniqueConstraint, CheckConstraint,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Program(Base):
    __tablename__ = "programs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="true")

    weeks = relationship("ProgramWeek", back_populates="program", order_by="ProgramWeek.week_number")


class ProgramWeek(Base):
    __tablename__ = "program_weeks"

    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(Integer, ForeignKey("programs.id", ondelete="CASCADE"), nullable=False)
    week_number = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    is_visible = Column(Boolean, nullable=False, server_default="true")

    __table_args__ = (
        UniqueConstraint("program_id", "week_number", name="uq_program_weeks_program_week"),
    )

    program = relationship("Program", back_populates="weeks")
    items = relationship("WeekItem", back_populates="week", order_by="WeekItem.order")


class WeekItem(Base):
    __tablename__ = "week_items"

    id = Column(Integer, primary_key=True, index=True)
    week_id = Column(Integer, ForeignKey("program_weeks.id", ondelete="CASCADE"), nullable=False)
    order = Column(Integer, nullable=False)
    item_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    video_url = Column(String, nullable=True)
    pre_quiz_form_url = Column(String, nullable=True)
    post_quiz_form_url = Column(String, nullable=True)
    is_required = Column(Boolean, nullable=False, server_default="true")

    __table_args__ = (
        CheckConstraint(
            "item_type IN ('lecture', 'reading', 'listening', 'mini_circle_exam')",
            name="ck_week_item_type",
        ),
    )

    week = relationship("ProgramWeek", back_populates="items")


class StudentItemProgress(Base):
    __tablename__ = "student_item_progress"

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.enrollment_id", ondelete="CASCADE"), nullable=False)
    item_id = Column(Integer, ForeignKey("week_items.id", ondelete="CASCADE"), nullable=False)
    completed = Column(Boolean, nullable=False, server_default="false")
    completed_at = Column(DateTime, nullable=True)
    lecture_watched = Column(Boolean, nullable=False, server_default="false")
    notes_written = Column(Boolean, nullable=False, server_default="false")
    notes_sent_to_bot = Column(Boolean, nullable=False, server_default="false")

    __table_args__ = (
        UniqueConstraint("enrollment_id", "item_id", name="uq_student_item_progress_enrollment_item"),
    )

    enrollment = relationship("Enrollment")
    item = relationship("WeekItem")
