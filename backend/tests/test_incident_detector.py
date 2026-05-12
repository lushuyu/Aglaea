"""Incident detector unit tests — pure helpers (AC1.13, AC1.14)."""

from __future__ import annotations

from aglaea.workers.incident_detector import (
    CLOSE_RULE_HEARTBEAT_COUNT,
    PUSH_LOSS_SENTINEL,
    _failing_subchecks,
)


def test_failing_subchecks_extracts_non_ok() -> None:
    subchecks = {
        "jin10": {"status": "ok", "latency_ms": 100},
        "cls": {"status": "degraded", "message": "slow"},
        "discord": {"status": "down"},
        "wscn": {"status": "ok"},
    }
    failing = _failing_subchecks(subchecks)
    assert failing == ["cls", "discord"]


def test_failing_subchecks_empty_returns_empty() -> None:
    assert _failing_subchecks(None) == []
    assert _failing_subchecks({}) == []


def test_failing_subchecks_ignores_malformed_entries() -> None:
    # Non-dict subcheck values are silently ignored.
    subchecks = {"jin10": "ok", "cls": 123, "moomoo": {"status": "down"}}
    assert _failing_subchecks(subchecks) == ["moomoo"]


def test_push_loss_sentinel_constant() -> None:
    assert PUSH_LOSS_SENTINEL == "_heartbeat_lost_"


def test_close_rule_heartbeat_count_constant() -> None:
    # AC1.14: close rule requires LAST 3 heartbeats.
    assert CLOSE_RULE_HEARTBEAT_COUNT == 3
