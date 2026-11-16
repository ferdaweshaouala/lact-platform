from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class CourseNote(Base):
    """A session note written by a teacher and visible to the supervisor.

    After each session the teacher can record observations — absent students
    explanations, topics deferred to next session, general remarks — and the
    supervisor sees them in the course view.
    """
    __tablename__ = "course_notes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(
        Integer,
        ForeignKey("courses.course_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id = Column(
        Integer,
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    # Optional link to the curriculum session this note relates to
    curriculum_session_id = Column(
        Integer,
        ForeignKey("curriculum_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Threading: if set, this note is a reply to another note
    parent_id = Column(
        Integer,
        ForeignKey("course_notes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    author = relationship("User", foreign_keys=[author_id])

    # One-directional: parent → its replies. No backref needed.
    replies = relationship(
        "CourseNote",
        foreign_keys="[CourseNote.parent_id]",
        order_by="CourseNote.created_at",
        lazy="select",
    )
