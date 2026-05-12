"""Async SQLAlchemy 2.x engine + session maker.

asyncpg-only per C13. The engine is process-wide; each request gets a session
via `get_session()` dependency.

`statement_timeout=5000ms` is set per Principle 3 to bound DB-side I/O.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from aglaea.config import STATEMENT_TIMEOUT_MS, get_settings


def _build_engine() -> AsyncEngine:
    settings = get_settings()
    # `statement_timeout` is set via asyncpg server-settings — applies to every
    # statement on every connection from this pool.
    return create_async_engine(
        settings.database_url,
        echo=False,
        pool_pre_ping=True,
        connect_args={
            "server_settings": {
                "statement_timeout": str(STATEMENT_TIMEOUT_MS),
                "application_name": "aglaea",
            },
        },
    )


engine: AsyncEngine = _build_engine()

async_session_maker: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a request-scoped AsyncSession."""
    async with async_session_maker() as session:
        yield session


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Context-manager session for worker tasks (outside request scope)."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
