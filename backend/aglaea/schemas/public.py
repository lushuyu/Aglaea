"""Public response schemas — reference `security/visibility.py` frozensets.

Each model below pins its visible field set to the corresponding frozenset
constant via a module-load-time assertion. Adding a new public field is a
two-edit change (model + frozenset); the Phase 0.9 visibility lint enforces
the coupling.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from aglaea.security.visibility import (
    PUBLIC_FIELDS_HEARTBEAT,
    PUBLIC_FIELDS_INCIDENT_PUBLISHED,
    PUBLIC_FIELDS_INCIDENT_SKELETON,
    PUBLIC_FIELDS_INCIDENT_UPDATE,
    PUBLIC_FIELDS_SERVICE,
)


class PublicService(BaseModel):
    """Public-page service row."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    display_name: str
    description: str | None
    kind: Literal["push", "pull"]
    last_status: str | None
    last_subchecks: dict[str, Any] | None
    last_heartbeat_at: datetime | None
    public_visible: bool


class PublicIncidentUpdate(BaseModel):
    """Public per-row view of an incident update. Excludes author_id/audit_event_id."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    t: datetime
    kind: Literal["state_transition", "manual", "summary_update"]
    text: str | None
    status_snapshot: dict[str, Any] | None


class PublicIncidentPublished(BaseModel):
    """Published-narrative incident view."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    service_slug: str
    status: Literal["ongoing", "resolved"]
    started_at: datetime
    resolved_at: datetime | None
    affected_subchecks: list[str]
    published_text: str
    published_at: datetime
    summary: str | None
    updates: list[PublicIncidentUpdate]


class PublicIncidentSkeleton(BaseModel):
    """Bare-facts view during ongoing-unpublished — NO LLM-generated text."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    service_slug: str
    status: Literal["ongoing", "resolved"]
    started_at: datetime
    resolved_at: datetime | None
    affected_subchecks: list[str]


class PublicHeartbeat(BaseModel):
    """Public heartbeat timeline row."""

    model_config = ConfigDict(from_attributes=True)

    ts: datetime
    status: Literal["ok", "degraded", "down"]
    subchecks: dict[str, Any] | None
    message: str | None
    source: Literal["push", "probe"]


# === Visibility allowlist coupling (AC1.4) ===
# Module-load assertions ensure the response model field set is exactly the
# frozenset constant. Adding a field to either side without the other trips
# this at import time AND the Phase 0.9 lint at PR time.

_VISIBILITY_CONTRACTS: tuple[tuple[type[BaseModel], frozenset[str], str], ...] = (
    (PublicService, PUBLIC_FIELDS_SERVICE, "PUBLIC_FIELDS_SERVICE"),
    (
        PublicIncidentUpdate,
        PUBLIC_FIELDS_INCIDENT_UPDATE,
        "PUBLIC_FIELDS_INCIDENT_UPDATE",
    ),
    (
        PublicIncidentPublished,
        PUBLIC_FIELDS_INCIDENT_PUBLISHED,
        "PUBLIC_FIELDS_INCIDENT_PUBLISHED",
    ),
    (
        PublicIncidentSkeleton,
        PUBLIC_FIELDS_INCIDENT_SKELETON,
        "PUBLIC_FIELDS_INCIDENT_SKELETON",
    ),
    (PublicHeartbeat, PUBLIC_FIELDS_HEARTBEAT, "PUBLIC_FIELDS_HEARTBEAT"),
)


__all__ = [
    "PublicHeartbeat",
    "PublicIncidentPublished",
    "PublicIncidentSkeleton",
    "PublicIncidentUpdate",
    "PublicService",
]


def _verify_allowlist_coupling() -> None:
    for model_cls, allowlist, name in _VISIBILITY_CONTRACTS:
        declared = frozenset(model_cls.model_fields.keys())
        if declared != allowlist:
            missing = sorted(allowlist - declared)
            extra = sorted(declared - allowlist)
            raise RuntimeError(
                f"visibility drift: {model_cls.__name__} != {name} "
                f"missing={missing} extra={extra}"
            )


_verify_allowlist_coupling()
