"""Incident schemas — admin views, draft edits, publish action."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

IncidentStatusLiteral = Literal["ongoing", "resolved"]
IncidentReportStateLiteral = Literal["none", "draft", "published", "rejected"]


class IncidentAdminOut(BaseModel):
    """Admin-view incident (includes report_text, the latest LLM draft)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    service_id: int
    status: IncidentStatusLiteral
    started_at: datetime
    resolved_at: datetime | None
    initial_failure_payload: dict[str, Any] | None
    final_recovery_payload: dict[str, Any] | None
    affected_subchecks: list[str]
    report_state: IncidentReportStateLiteral
    report_text: str | None
    report_generated_at: datetime | None
    report_generation_count: int
    report_generation_reason: str | None
    published_text: str | None
    published_at: datetime | None
    published_by: int | None
    created_at: datetime
    updated_at: datetime


class IncidentReportEdit(BaseModel):
    """Manual admin edit of report_text."""

    model_config = ConfigDict(extra="forbid", strict=True)

    report_text: str = Field(min_length=1, max_length=50_000)


class IncidentRegenerateRequest(BaseModel):
    """Optional admin instruction for manual regenerate."""

    model_config = ConfigDict(extra="forbid", strict=True)

    instruction: str | None = Field(default=None, max_length=2000)
