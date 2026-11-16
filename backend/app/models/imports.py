from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base


class StagedImport(Base):
    """Temporary staging table for the two-step CSV/Excel import flow.

    Row data is stored as a JSON string (df.to_json(orient='records')).
    Records expire after STAGING_TTL_MINUTES and are purged on next upload call.
    Using a DB table instead of an in-memory dict makes the staging survive
    server restarts and work correctly across multiple uvicorn workers.
    """
    __tablename__ = "staged_imports"

    id = Column(String, primary_key=True)       # UUID4 token returned to the client
    row_data = Column(Text, nullable=False)      # JSON-serialised list of row dicts
    headers = Column(Text, nullable=False)       # JSON-serialised list of column names
    filename = Column(String, nullable=True)
    row_count = Column(Integer, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
