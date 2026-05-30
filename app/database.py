"""Async SQLAlchemy engine + session factory.

Routes get a session by depending on `get_db` — FastAPI handles the
lifecycle (open per-request, rollback on exception, close at the end).
"""
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings

# `pool_pre_ping` runs a cheap SELECT before handing out a connection so
# we never hand back a stale one (e.g. after Postgres was restarted).
engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency. Yields one session per request."""
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

