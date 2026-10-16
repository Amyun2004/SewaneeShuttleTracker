"""
establishes a connection to the PSQL database 
manages sessions 

SessionLocal used by seed.py ; for every request, it creates a new session 
and hands the session  to the end point

get_db used by deps.py; for every session, it opens the databse, 
hands it to user, rolls back and re-reaises 
the error, and closes when the request is finished .
"""

from app.config import settings
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from collections.abc import AsyncIterator

engine = create_async_engine(
    settings.database_url,
    echo = False,
    pool_pre_ping = True, 
    pool_size= 10, 
    max_overflow = 20
)

SessionLocal = async_sessionmaker(
    engine, class_= AsyncSession, expire_on_commit=False
)

async def get_db()-> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        try: 
            yield session 
        except Exception:
            await session.rollback()
            raise 
