"""DeclarativeBase root for Aglaea ORM models."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base. Per-model metadata composes onto this.

    Mapped[datetime] is mapped to TIMESTAMPTZ here so every timestamp column in
    every ORM model is timezone-aware. Migration 0001 already declares
    TIMESTAMP(timezone=True) on the DB side — without this map, the ORM would
    send timezone-naive params to asyncpg and inserts would fail with
    "can't subtract offset-naive and offset-aware datetimes".
    """

    type_annotation_map = {  # noqa: RUF012 — SQLAlchemy reads this as class-level
        datetime: DateTime(timezone=True),
    }
