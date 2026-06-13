"""Synchronous database session for Celery workers.

Celery workers run synchronous Python, so they cannot use the async
SQLAlchemy engine. This module provides a sync engine + session maker
using psycopg2 instead of asyncpg.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import get_settings

settings = get_settings()

# Use the standard postgresql:// URL (psycopg2 is sync)
# Strip any async driver suffix if present
sync_url = settings.DATABASE_URL.replace(
    "postgresql+asyncpg://", "postgresql://"
).replace(
    "postgresql+aiopg://", "postgresql://"
)

sync_engine = create_engine(
    sync_url,
    echo=False,
    pool_size=5,
    max_overflow=10,
)

SyncSession = sessionmaker(
    bind=sync_engine,
    class_=Session,
    expire_on_commit=False,
)


def get_sync_db() -> Session:
    """Get a synchronous database session for use in Celery workers."""
    return SyncSession()
