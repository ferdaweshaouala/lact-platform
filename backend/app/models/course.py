from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Course(Base):
    __tablename__ = "courses"

    course_id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String, default="Active")
    course_type = Column(String, default="onsite")
    total_sessions = Column(Integer, nullable=True)
    teacher_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    supervisor_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    workshop_day = Column(String, nullable=True)       # e.g. "Thursday" or "الخميس"
    workshop_time = Column(String, nullable=True)       # e.g. "19:00", optional
    program_id = Column(Integer, ForeignKey("programs.id", ondelete="SET NULL"), nullable=True)

    teacher = relationship("User", back_populates="courses", foreign_keys=[teacher_id])
    supervisor = relationship("User", back_populates="supervised_courses", foreign_keys=[supervisor_id])
    sessions = relationship("Session", back_populates="course")
    enrollments = relationship("Enrollment", back_populates="course")


class Session(Base):
    __tablename__ = "sessions"

    session_id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id"), nullable=False)
    session_date = Column(Date, nullable=True)
    duration = Column(String, nullable=True)
    teacher_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    course = relationship("Course", back_populates="sessions")
    teacher = relationship("User", back_populates="sessions")