"""`incidents` table — permanent record, has `affected_subchecks` monotone set."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import ARRAY, BigInteger, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import Enum

from aglaea.models._portable import PortableJSONB
from aglaea.models.base import Base

if TYPE_CHECKING:
    from aglaea.models.incident_updates import IncidentUpdate


class IncidentStatus(enum.StrEnum):
    ongoing = "ongoing"
    resolved = "resolved"


class IncidentReportState(enum.StrEnum):
    none = "none"
    draft = "draft"
    published = "published"
    rejected = "rejected"


class IncidentLifecycleState(enum.StrEnum):
    investigating = "investigating"
    identified = "identified"
    monitoring = "monitoring"
    resolved = "resolved"


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    service_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("services.id"), nullable=False)
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus, name="incident_status", create_type=False),
        nullable=False,
        server_default="ongoing",
    )
    started_at: Mapped[datetime] = mapped_column(nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)
    initial_failure_payload: Mapped[dict[str, Any] | None] = mapped_column(
        PortableJSONB, nullable=True
    )
    final_recovery_payload: Mapped[dict[str, Any] | None] = mapped_column(
        PortableJSONB, nullable=True
    )
    affected_subchecks: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    report_state: Mapped[IncidentReportState] = mapped_column(
        Enum(
            IncidentReportState,
            name="incident_report_state",
            create_type=False,
        ),
        nullable=False,
        server_default="none",
    )
    report_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_generated_at: Mapped[datetime | None] = mapped_column(nullable=True)
    report_generation_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    report_generation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(nullable=True)
    published_by: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("admin_users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    lifecycle_state: Mapped[IncidentLifecycleState] = mapped_column(
        Enum(IncidentLifecycleState, name="incident_lifecycle_state", create_type=False),
        nullable=False,
        server_default="investigating",
    )

    updates: Mapped[list[IncidentUpdate]] = relationship(
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentUpdate.t.asc()",
    )
