"""Heartbeat ingress schema — Pydantic strict, rejects unknown fields → 400."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SubcheckStatus = Literal["ok", "degraded", "down"]
HeartbeatStatus = Literal["ok", "degraded", "down"]


class SubcheckIn(BaseModel):
    """Per-subcheck payload — strict, extras → 400."""

    model_config = ConfigDict(extra="forbid", strict=True)

    status: SubcheckStatus
    latency_ms: int | None = Field(default=None, ge=0)
    message: str | None = Field(default=None, max_length=500)


class HeartbeatIn(BaseModel):
    """Inbound heartbeat body (SPEC §6.2). Pydantic strict — unknown → 400."""

    model_config = ConfigDict(extra="forbid", strict=True)

    status: HeartbeatStatus
    subchecks: dict[str, SubcheckIn] | None = Field(default=None)
    metrics: dict[str, str | int | float | bool | None] | None = Field(default=None)
    message: str | None = Field(default=None, max_length=2000)
    client_ts: datetime | None = Field(default=None)
