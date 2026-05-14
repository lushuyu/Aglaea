"""Incident schemas — admin views, draft edits, publish action."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

IncidentStatusLiteral = Literal["ongoing", "resolved"]
IncidentReportStateLiteral = Literal["none", "draft", "published", "rejected"]
IncidentUpdateKindLiteral = Literal["state_transition", "manual", "summary_update"]


class IncidentUpdateOut(BaseModel):
    """Admin-view incident update row — includes all columns."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    t: datetime
    kind: IncidentUpdateKindLiteral
    text: str | None
    status_snapshot: dict[str, Any] | None
    author_id: int | None
    audit_event_id: int | None


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
    summary: str | None
    lifecycle_state: str
    updates: list[IncidentUpdateOut]


class IncidentReportEdit(BaseModel):
    """Manual admin edit of report_text."""

    model_config = ConfigDict(extra="forbid", strict=True)

    report_text: str = Field(min_length=1, max_length=50_000)


class IncidentRegenerateRequest(BaseModel):
    """Optional admin instruction for manual regenerate."""

    model_config = ConfigDict(extra="forbid", strict=True)

    instruction: str | None = Field(default=None, max_length=2000)


class IncidentUpdateCreate(BaseModel):
    """Admin request body for POST /admin/incidents/{id}/updates."""

    model_config = ConfigDict(extra="forbid", strict=True)

    text: str = Field(min_length=1, max_length=2000)
    kind: Literal["manual"] = "manual"


class IncidentSummaryEdit(BaseModel):
    """Admin request body for PATCH /admin/incidents/{id}/summary."""

    model_config = ConfigDict(extra="forbid", strict=True)

    summary: str = Field(min_length=0, max_length=10000)
