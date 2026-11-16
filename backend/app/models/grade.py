from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class GradeCategory(Base):
    __tablename__ = "grade_categories"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.course_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    max_value = Column(Float, nullable=False)
    kind = Column(String, nullable=False, default="regular")    # regular | weekly | bonus
    order_index = Column(Integer, nullable=False, default=0)

    __table_args__ = (UniqueConstraint("course_id", "name", name="uq_grade_categories_course_name"),)

    course = relationship("Course")
    grades = relationship("Grade", back_populates="category")


class Grade(Base):
    __tablename__ = "grades"

    grade_id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.enrollment_id"), nullable=False, index=True)
    type = Column(String, nullable=True)        # legacy free-text label, kept for backwards-compat
    category_id = Column(Integer, ForeignKey("grade_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    value = Column(Float, nullable=False)
    max_value = Column(Float, nullable=True)    # denominator (e.g. 50, 25, 3)
    source = Column(String, default="manual")   # manual / excel
    session_number = Column(Integer, nullable=True)   # for weekly-kind: which iteration (1..N)
    date_recorded = Column(Date, nullable=True)

    enrollment = relationship("Enrollment", back_populates="grades")
    category = relationship("GradeCategory", back_populates="grades")
