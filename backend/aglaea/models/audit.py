"""`audit_log` table — append-only audit trail."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from aglaea.models._portable import PortableINET, PortableJSONB
from aglaea.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    actor_type: Mapped[str] = mapped_column(Text, nullable=False)
    actor_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    event: Mapped[str] = mapped_column(Text, nullable=False)
    ip: Mapped[str | None] = mapped_column(PortableINET, nullable=True)
    details: Mapped[dict[str, Any] | None] = mapped_column(PortableJSONB, nullable=True)
