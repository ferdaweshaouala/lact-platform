from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Detect Neon / any remote SSL-required PostgreSQL and pass sslmode accordingly.
_db_url = settings.DATABASE_URL
_connect_args = {"sslmode": "require"} if "neon.tech" in _db_url else {}

# pool_size=5  — connections kept alive permanently (baseline steady-state load)
# max_overflow=10 — extra connections allowed under burst traffic (total cap: 15)
# pool_timeout=30 — seconds to wait for a free connection before raising an error
# pool_pre_ping=True — issues a lightweight "SELECT 1" before handing out a stale
#                      connection; prevents "server closed the connection" errors after
#                      idle periods (e.g. overnight, Docker restart).
engine = create_engine(
    _db_url,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_pre_ping=True,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
