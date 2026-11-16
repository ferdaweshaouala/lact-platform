from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Enrollment(Base):
    __tablename__ = "enrollments"

    enrollment_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.student_id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id"), nullable=False, index=True)
    enrollment_date = Column(Date, nullable=True)
    completion_status = Column(String, default="Ongoing")   # Completed / Ongoing / Dropped
    absences = Column(Integer, nullable=False, default=0)
    attendance_count = Column(Integer, nullable=False, default=0)
    makeup_count = Column(Integer, nullable=False, default=0)
    approval_status = Column(String, nullable=False, server_default="approved")  # pending / approved / rejected
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", name="uq_enrollment_student_course"),
    )

    student = relationship("Student", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")
    grades = relationship("Grade", back_populates="enrollment")


class StatusChangeLog(Base):
    """Append-only audit log of every enrollment status transition.

    The application DB user has UPDATE and DELETE revoked on this table
    (see migration 006), making the audit trail tamper-evident at DB level.
    """
    __tablename__ = "status_change_log"

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.enrollment_id", ondelete="CASCADE"), nullable=False)
    old_status = Column(String, nullable=True)
    new_status = Column(String, nullable=False)
    changed_by = Column(Integer, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    changed_at = Column(DateTime, server_default=func.now(), nullable=False)

    enrollment = relationship("Enrollment")
    user = relationship("User")
