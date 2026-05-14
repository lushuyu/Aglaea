"""`incident_updates` table — append-only timeline of state transitions and comments."""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import Enum

from aglaea.models.base import Base

if TYPE_CHECKING:
    from aglaea.models.incidents import Incident


class IncidentUpdateKind(enum.StrEnum):
    state_transition = "state_transition"
    summary_update = "summary_update"
    manual = "manual"


class IncidentUpdate(Base):
    __tablename__ = "incident_updates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    incident_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    t: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    kind: Mapped[IncidentUpdateKind] = mapped_column(
        Enum(IncidentUpdateKind, name="incident_update_kind", create_type=False),
        nullable=False,
    )
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    author_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True
    )
    audit_event_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    incident: Mapped[Incident] = relationship(back_populates="updates")
