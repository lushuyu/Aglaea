"""Public API smoke — uses schema-level checks since DB-backed tests need
Postgres+Timescale containers (covered by test_migrations.py).
"""

from __future__ import annotations

from datetime import datetime, timezone

from aglaea.schemas.public import (
    PublicHeartbeat,
    PublicIncidentPublished,
    PublicIncidentSkeleton,
    PublicService,
)


def test_public_service_excludes_internal_fields() -> None:
    """AC5.5 — public response never carries probe_url, deepseek_context."""
    fields = set(PublicService.model_fields.keys())
    assert "probe_url" not in fields
    assert "deepseek_context" not in fields
    assert "probe_interval_seconds" not in fields
    assert "probe_timeout_seconds" not in fields


def test_public_service_construct_minimal() -> None:
    row = PublicService(
        slug="hyacine",
        display_name="Hyacine",
        description=None,
        kind="push",
        last_status="ok",
        last_subchecks=None,
        last_heartbeat_at=datetime.now(timezone.utc),
        public_visible=True,
    )
    assert row.slug == "hyacine"


def test_public_incident_skeleton_has_no_text() -> None:
    """Skeleton view must NOT include LLM-generated text."""
    fields = set(PublicIncidentSkeleton.model_fields.keys())
    assert "report_text" not in fields
    assert "published_text" not in fields


def test_public_incident_published_has_text() -> None:
    fields = set(PublicIncidentPublished.model_fields.keys())
    assert "published_text" in fields


def test_public_heartbeat_excludes_metrics() -> None:
    """Metrics dict may carry host-meta — excluded from public timeline."""
    fields = set(PublicHeartbeat.model_fields.keys())
    assert "metrics" not in fields
    assert "client_ts" not in fields
