"""`services` table — service registry."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import Enum

from aglaea.models._portable import PortableJSONB
from aglaea.models.base import Base


class ServiceKind(enum.StrEnum):
    push = "push"
    pull = "pull"


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[ServiceKind] = mapped_column(
        Enum(ServiceKind, name="service_kind", create_type=False), nullable=False
    )
    public_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    expected_interval_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    probe_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    probe_interval_seconds: Mapped[int | None] = mapped_column(
        Integer, nullable=True, server_default="60"
    )
    probe_timeout_seconds: Mapped[int | None] = mapped_column(
        Integer, nullable=True, server_default="10"
    )
    probe_expected_status: Mapped[int | None] = mapped_column(
        Integer, nullable=True, server_default="200"
    )
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(nullable=True)
    last_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_subchecks: Mapped[dict[str, Any] | None] = mapped_column(PortableJSONB, nullable=True)
    last_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    deepseek_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("slug ~ '^[a-z][a-z0-9-]{1,30}$'", name="slug_format_check"),
        CheckConstraint(
            "kind != 'push' OR expected_interval_seconds IS NOT NULL",
            name="push_must_have_interval",
        ),
        CheckConstraint(
            "kind != 'pull' OR probe_url IS NOT NULL",
            name="pull_must_have_url",
        ),
    )
