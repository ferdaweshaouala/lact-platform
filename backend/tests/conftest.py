"""
Test configuration.

Each test gets a fresh in-memory SQLite database (StaticPool, one engine per
test). User fixtures create and immediately close their own sessions so the
StaticPool's single connection is free when HTTP requests start. Each HTTP
request gets its own fresh Session from the same engine; because StaticPool
reuses one underlying DBAPI connection, all sessions see the same committed
data without any cross-request snapshot bleed.

Run with: pytest tests/
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app
from app.core.security import hash_password
from app.core.limiter import limiter
from app.models.user import User
from app.models.student import Student


# ── Core engine fixture (one per test) ──────────────────────────────────────

@pytest.fixture
def _engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


# ── Test-side session for tests that need direct DB access ───────────────────

@pytest.fixture
def db(_engine):
    """General-purpose session for direct DB queries inside a test body.
    Do NOT use for fixture data-setup — use _engine directly there so the
    session is closed before any HTTP requests run."""
    _Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    session = _Session()
    try:
        yield session
    finally:
        session.close()


# ── Client: each request gets its own fresh session ──────────────────────────

@pytest.fixture
def client(_engine):
    """TestClient where every request receives a brand-new Session.

    Depends only on _engine (not db) so no long-lived session can hold the
    StaticPool connection open while HTTP requests are in flight. Each new
    Session autobegins on a clean connection, guaranteeing it sees all rows
    committed by previous requests.
    """
    _Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

    def _override_get_db():
        session = _Session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    # Reset rate-limiter memory so login calls don't hit the limit across tests.
    try:
        limiter._limiter.storage.reset()
    except Exception:
        pass
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── User fixtures: each creates and closes its own session ───────────────────
# Using _engine directly (not db) so the session is committed+closed before
# any HTTP requests run — avoids the StaticPool single-connection entanglement.

def _make_user(engine, **kwargs):
    """Insert a user, expunge it (detached but attrs loaded), close session."""
    _Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = _Session()
    try:
        user = User(**kwargs)
        session.add(user)
        session.commit()
        session.refresh(user)
        session.expunge(user)   # detach: keeps loaded attrs, no DB round-trip needed
        return user
    finally:
        session.close()


@pytest.fixture
def admin_user(_engine):
    return _make_user(
        _engine,
        first_name="Admin", last_name="Test",
        email="admin@test.com", role="admin",
        password_hash=hash_password("admin123"),
    )


@pytest.fixture
def teacher_user(_engine):
    return _make_user(
        _engine,
        first_name="Teacher", last_name="Test",
        email="teacher@test.com", role="teacher",
        password_hash=hash_password("teacher123"),
    )


@pytest.fixture
def supervisor_user(_engine):
    return _make_user(
        _engine,
        first_name="Supervisor", last_name="Test",
        email="supervisor@test.com", role="supervisor",
        password_hash=hash_password("supervisor123"),
    )


# ── Helpers ──────────────────────────────────────────────────────────────────

def get_token(client, email: str, password: str) -> str:
    res = client.post("/api/auth/login", data={"username": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]
