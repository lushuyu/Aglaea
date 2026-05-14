"""`admin_users` table — soft-delete via `deleted_at`."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from aglaea.models.base import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    github_login: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    github_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)
