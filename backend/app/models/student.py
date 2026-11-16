from sqlalchemy import Column, Integer, BigInteger, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Student(Base):
    __tablename__ = "students"

    student_id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    student_number = Column(String, unique=True, nullable=False)
    email = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    city = Column(String, nullable=True)
    profession = Column(String, nullable=True)
    telegram_id = Column(BigInteger, unique=True, nullable=True, index=True)
    last_active = Column(Date, nullable=True)           # updated by bot on each interaction
    streak = Column(Integer, nullable=False, default=0) # consecutive active days
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="SET NULL"), unique=True, nullable=True)
    user = relationship("User")
    enrollments = relationship("Enrollment", back_populates="student")
