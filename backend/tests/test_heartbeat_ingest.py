"""Heartbeat ingest schema tests (AC1.5, Critic W2 body cap)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from aglaea.config import HEARTBEAT_BODY_MAX_BYTES
from aglaea.schemas.heartbeat import HeartbeatIn


def test_strict_mode_rejects_unknown_fields() -> None:
    """Pydantic strict, extras → 400 (manifests as ValidationError)."""
    with pytest.raises(ValidationError):
        HeartbeatIn.model_validate({"status": "ok", "unknown_field": "boom"})


def test_accepts_minimal_payload() -> None:
    payload = HeartbeatIn.model_validate({"status": "ok"})
    assert payload.status == "ok"
    assert payload.subchecks is None
    assert payload.metrics is None


def test_accepts_six_subcheck_set() -> None:
    """C28: locked 6-key subcheck set."""
    payload = HeartbeatIn.model_validate(
        {
            "status": "degraded",
            "subchecks": {
                "jin10": {"status": "ok", "latency_ms": 100},
                "cls": {"status": "ok"},
                "wscn": {"status": "ok"},
                "moomoo": {"status": "degraded", "message": "slow"},
                "deepseek": {"status": "ok"},
                "discord": {"status": "ok"},
            },
        }
    )
    assert payload.subchecks is not None
    assert set(payload.subchecks.keys()) == {
        "jin10",
        "cls",
        "wscn",
        "moomoo",
        "deepseek",
        "discord",
    }


def test_subcheck_extras_rejected() -> None:
    with pytest.raises(ValidationError):
        HeartbeatIn.model_validate(
            {
                "status": "ok",
                "subchecks": {
                    "discord": {
                        "status": "ok",
                        "message": "fine",
                        "extra": "not allowed",
                    }
                },
            }
        )


def test_body_cap_constant_64kb() -> None:
    # Critic W2 — heartbeat body capped at 64 KB.
    assert HEARTBEAT_BODY_MAX_BYTES == 64 * 1024


def test_message_length_capped() -> None:
    long_msg = "x" * 5000
    with pytest.raises(ValidationError):
        HeartbeatIn.model_validate({"status": "ok", "message": long_msg})


def test_status_literal_enforced() -> None:
    with pytest.raises(ValidationError):
        HeartbeatIn.model_validate({"status": "exploded"})
