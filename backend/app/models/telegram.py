from sqlalchemy import Column, Integer, BigInteger, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class TelegramGroup(Base):
    """Maps a course to its Telegram group chat."""
    __tablename__ = "telegram_groups"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, unique=True)
    telegram_group_id = Column(BigInteger, nullable=False, unique=True)
    group_name = Column(String, nullable=True)

    course = relationship("Course")


class Submission(Base):
    """Homework / file submission received via the Telegram bot."""
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, index=True)
    content_id = Column(Integer, ForeignKey("content.id", ondelete="SET NULL"), nullable=True)
    file_id = Column(String, nullable=False)        # Telegram file_id
    file_name = Column(String, nullable=True)
    media_group_id = Column(String, nullable=True)  # groups multi-file submissions from Telegram
    submitted_at = Column(DateTime, nullable=False)
    grade = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    graded_at = Column(DateTime, nullable=True)

    student = relationship("Student")
    course = relationship("Course")


class CompensationRequest(Base):
    """Makeup / compensation request submitted by a student via the bot."""
    __tablename__ = "compensation_requests"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, index=True)
    content_id = Column(Integer, ForeignKey("content.id", ondelete="SET NULL"), nullable=True)
    telegram_id = Column(BigInteger, nullable=True, index=True)  # Telegram user id of requester
    status = Column(String, nullable=False, default="pending")   # pending / accepted / rejected
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)

    student = relationship("Student")
    course = relationship("Course")
