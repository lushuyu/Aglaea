"""Visibility allowlist tests (AC1.4).

Asserts that:
- Every PUBLIC_FIELDS_SERVICE name is declared on PublicService.
- No model declares a field not in its frozenset (module-load assertion in
  `schemas/public.py` already covers this; we sanity-check at test time).
- The frozensets are non-empty and immutable.
"""

from __future__ import annotations

from aglaea.schemas.public import (
    PublicHeartbeat,
    PublicIncidentPublished,
    PublicIncidentSkeleton,
    PublicService,
)
from aglaea.security.visibility import (
    LLM_CONTEXT_FIELDS_HEARTBEAT,
    LLM_CONTEXT_FIELDS_INCIDENT,
    LLM_CONTEXT_FIELDS_SERVICE,
    PUBLIC_FIELDS_HEARTBEAT,
    PUBLIC_FIELDS_INCIDENT_PUBLISHED,
    PUBLIC_FIELDS_INCIDENT_SKELETON,
    PUBLIC_FIELDS_SERVICE,
)


def test_seven_frozensets_present() -> None:
    sets = [
        PUBLIC_FIELDS_SERVICE,
        PUBLIC_FIELDS_INCIDENT_PUBLISHED,
        PUBLIC_FIELDS_INCIDENT_SKELETON,
        PUBLIC_FIELDS_HEARTBEAT,
        LLM_CONTEXT_FIELDS_HEARTBEAT,
        LLM_CONTEXT_FIELDS_INCIDENT,
        LLM_CONTEXT_FIELDS_SERVICE,
    ]
    assert len(sets) == 7
    for s in sets:
        assert isinstance(s, frozenset)
        assert len(s) > 0


def test_public_service_model_exact_match() -> None:
    declared = frozenset(PublicService.model_fields.keys())
    assert declared == PUBLIC_FIELDS_SERVICE


def test_public_incident_published_model_exact_match() -> None:
    declared = frozenset(PublicIncidentPublished.model_fields.keys())
    assert declared == PUBLIC_FIELDS_INCIDENT_PUBLISHED


def test_public_incident_skeleton_model_exact_match() -> None:
    declared = frozenset(PublicIncidentSkeleton.model_fields.keys())
    assert declared == PUBLIC_FIELDS_INCIDENT_SKELETON


def test_public_heartbeat_model_exact_match() -> None:
    declared = frozenset(PublicHeartbeat.model_fields.keys())
    assert declared == PUBLIC_FIELDS_HEARTBEAT


def test_skeleton_excludes_published_text() -> None:
    # Critical: ongoing-unpublished view must NOT include LLM-generated text.
    assert "published_text" not in PUBLIC_FIELDS_INCIDENT_SKELETON
    assert "report_text" not in PUBLIC_FIELDS_INCIDENT_SKELETON
    assert "published_text" in PUBLIC_FIELDS_INCIDENT_PUBLISHED


def test_llm_heartbeat_excludes_client_ts() -> None:
    # client_ts is diagnostic-only and could carry attacker-influenced values.
    assert "client_ts" not in LLM_CONTEXT_FIELDS_HEARTBEAT
    # source ('push' | 'probe') is meta-only — leave it out of LLM context.
    assert "source" not in LLM_CONTEXT_FIELDS_HEARTBEAT
