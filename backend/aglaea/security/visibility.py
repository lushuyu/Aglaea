"""Allowlist single source of truth (C19, AC1.4).

Every "what fields cross which boundary" decision lives here as a frozenset.
Pydantic response models reference these constants — NEVER hand-write field
lists. `llm/context.py` imports the same constants.

Phase 0.9 `scripts/lint_visibility.py` diffs router response models against
these constants and fails CI if drift exists.

Seven constants total (per the spec's C19 enumeration).
"""

from __future__ import annotations

from typing import Final

# Fields of Service that are safe to publish at the public boundary.
# Excludes deepseek_context (internal config), probe_url (hostname leak),
# probe_* internals (operator concern), last_message internals (may leak hosts).
PUBLIC_FIELDS_SERVICE: Final[frozenset[str]] = frozenset(
    {
        "slug",
        "display_name",
        "description",
        "kind",
        "last_status",
        "last_subchecks",
        "last_heartbeat_at",
        "public_visible",
    }
)

# Fields of Incident exposed publicly when a narrative is published.
PUBLIC_FIELDS_INCIDENT_PUBLISHED: Final[frozenset[str]] = frozenset(
    {
        "id",
        "service_slug",
        "status",
        "started_at",
        "resolved_at",
        "affected_subchecks",
        "published_text",
        "published_at",
        "summary",
        "updates",
    }
)

# Fields of IncidentUpdate exposed publicly (per-row allowlist).
# author_id and audit_event_id are admin-only and excluded here.
PUBLIC_FIELDS_INCIDENT_UPDATE: Final[frozenset[str]] = frozenset(
    {
        "id",
        "incident_id",
        "t",
        "kind",
        "text",
        "status_snapshot",
    }
)

# Fields of Incident exposed publicly while ongoing-unpublished (the
# "skeleton" view per SPEC §8.2 — bare facts only, NO LLM-generated text).
PUBLIC_FIELDS_INCIDENT_SKELETON: Final[frozenset[str]] = frozenset(
    {
        "id",
        "service_slug",
        "status",
        "started_at",
        "resolved_at",
        "affected_subchecks",
    }
)

# Fields of the flat incident feed row (denormalised join of Incident + Service).
PUBLIC_FIELDS_INCIDENT_FEED_ITEM: Final[frozenset[str]] = frozenset(
    {
        "id",
        "service_slug",
        "service_name",
        "status",
        "started_at",
        "resolved_at",
        "affected_subchecks",
        "published_text",
        "published_at",
        "summary",
    }
)

# Fields of HeartbeatEvent exposed publicly (timeline rendering).
# host_name / metrics that may carry host_name dimensions are excluded.
PUBLIC_FIELDS_HEARTBEAT: Final[frozenset[str]] = frozenset(
    {
        "ts",
        "status",
        "subchecks",
        "message",
        "source",
    }
)

# Fields permitted to be projected into the LLM context for narrative
# generation. Heartbeat side: never includes host_name, client_ts (could
# include user-supplied content), or internal metrics that aren't service-meta.
LLM_CONTEXT_FIELDS_HEARTBEAT: Final[frozenset[str]] = frozenset(
    {
        "ts",
        "status",
        "subchecks",
        "message",
    }
)

# Incident side for LLM context.
LLM_CONTEXT_FIELDS_INCIDENT: Final[frozenset[str]] = frozenset(
    {
        "id",
        "status",
        "started_at",
        "resolved_at",
        "affected_subchecks",
        "report_generation_count",
    }
)

# Service side for LLM context (the cached prefix portion).
LLM_CONTEXT_FIELDS_SERVICE: Final[frozenset[str]] = frozenset(
    {
        "slug",
        "display_name",
        "description",
        "kind",
        "deepseek_context",
    }
)


__all__ = [
    "LLM_CONTEXT_FIELDS_HEARTBEAT",
    "LLM_CONTEXT_FIELDS_INCIDENT",
    "LLM_CONTEXT_FIELDS_SERVICE",
    "PUBLIC_FIELDS_HEARTBEAT",
    "PUBLIC_FIELDS_INCIDENT_FEED_ITEM",
    "PUBLIC_FIELDS_INCIDENT_PUBLISHED",
    "PUBLIC_FIELDS_INCIDENT_SKELETON",
    "PUBLIC_FIELDS_INCIDENT_UPDATE",
    "PUBLIC_FIELDS_SERVICE",
]
