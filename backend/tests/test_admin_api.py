"""Admin API schema smoke — DB-backed coverage lives in test_migrations.py."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from aglaea.schemas.incident import IncidentRegenerateRequest, IncidentReportEdit
from aglaea.schemas.service import ApiKeyCreate, ServiceCreate, ServiceUpdate


def test_service_create_slug_pattern() -> None:
    """Slug pattern matches DB CHECK constraint."""
    ServiceCreate.model_validate(
        {
            "slug": "valid-slug",
            "display_name": "OK",
            "kind": "push",
            "expected_interval_seconds": 60,
        }
    )
    with pytest.raises(ValidationError):
        ServiceCreate.model_validate(
            {
                "slug": "Invalid_Slug",
                "display_name": "Bad",
                "kind": "push",
                "expected_interval_seconds": 60,
            }
        )


def test_service_create_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        ServiceCreate.model_validate(
            {
                "slug": "ok",
                "display_name": "OK",
                "kind": "push",
                "expected_interval_seconds": 60,
                "secret_field": "boom",
            }
        )


def test_probe_url_must_be_http() -> None:
    with pytest.raises(ValidationError):
        ServiceCreate.model_validate(
            {
                "slug": "pull1",
                "display_name": "Pull",
                "kind": "pull",
                "probe_url": "ftp://example.com",
            }
        )


def test_service_update_all_optional() -> None:
    payload = ServiceUpdate.model_validate({})
    assert payload.display_name is None
    assert payload.deepseek_context is None


def test_api_key_create_requires_label() -> None:
    with pytest.raises(ValidationError):
        ApiKeyCreate.model_validate({})
    ok = ApiKeyCreate.model_validate({"label": "primary"})
    assert ok.label == "primary"


def test_incident_report_edit_requires_non_empty() -> None:
    with pytest.raises(ValidationError):
        IncidentReportEdit.model_validate({"report_text": ""})


def test_incident_regenerate_instruction_optional() -> None:
    a = IncidentRegenerateRequest.model_validate({})
    b = IncidentRegenerateRequest.model_validate({"instruction": "speak shorter"})
    assert a.instruction is None
    assert b.instruction == "speak shorter"
