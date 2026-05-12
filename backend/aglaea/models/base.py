"""DeclarativeBase root for Aglaea ORM models."""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base. Per-model metadata composes onto this."""
