from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class CurriculumSession(Base):
    """A planned session (lecture or workshop) drawn from the study plan (المخطط)."""
    __tablename__ = "curriculum_sessions"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, index=True)
    week_number = Column(Integer, nullable=False)
    session_type = Column(String, nullable=False)   # "lecture" | "workshop"
    title = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    attendance_records = relationship(
        "CurriculumAttendance",
        back_populates="curriculum_session",
        cascade="all, delete-orphan",
    )


class CurriculumAttendance(Base):
    """Per-enrollment attendance record for a specific curriculum session."""
    __tablename__ = "curriculum_attendance"

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(
        Integer,
        ForeignKey("enrollments.enrollment_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    curriculum_session_id = Column(
        Integer,
        ForeignKey("curriculum_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String, nullable=False)         # present | absent | makeup
    notes = Column(Text, nullable=True)
    date_recorded = Column(Date, nullable=True)
    followed_up = Column(Boolean, default=False, nullable=False, server_default="false")

    __table_args__ = (
        UniqueConstraint("enrollment_id", "curriculum_session_id", name="uq_cur_att_enr_session"),
    )

    curriculum_session = relationship("CurriculumSession", back_populates="attendance_records")
    enrollment = relationship("Enrollment")
