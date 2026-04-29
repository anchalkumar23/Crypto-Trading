"""Async SQLAlchemy engine + session factory."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    """Base class for all ORM models."""


_settings = get_settings()

# echo=False so we don't spam logs; flip to True when debugging SQL.
engine = create_async_engine(
    _settings.database_url,
    echo=False,
    future=True,
    # SQLite specific: disable connection-pool's same-thread check.
    connect_args=(
        {"check_same_thread": False}
        if _settings.database_url.startswith("sqlite")
        else {}
    ),
)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create all tables. Demo-grade — replace with Alembic for prod."""
    # Import models so SQLAlchemy registers them on Base.metadata.
    from . import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def with_session(coro: Any) -> Any:
    """Run a coroutine inside a fresh session — handy for background tasks."""
    async with AsyncSessionLocal() as session:
        return await coro(session)
