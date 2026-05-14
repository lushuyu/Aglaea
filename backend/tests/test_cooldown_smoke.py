"""Cooldown map and anchored-window auto-close smoke tests (Phase 2b)."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from aglaea.workers.incident_detector import (
    _DEEPSEEK_COOLDOWN,
    _COOLDOWN_TTL_SECONDS,
    _maybe_close,
    PUSH_LOSS_SENTINEL,
)
from aglaea.models.incidents import IncidentLifecycleState


def test_cooldown_ttl_constant() -> None:
    assert _COOLDOWN_TTL_SECONDS == 300


def test_cooldown_map_is_dict() -> None:
    assert isinstance(_DEEPSEEK_COOLDOWN, dict)


# ---------------------------------------------------------------------------
# Helpers to build mock objects for _maybe_close
# ---------------------------------------------------------------------------

def _make_service(interval: int = 60) -> MagicMock:
    svc = MagicMock()
    svc.expected_interval_seconds = interval
    svc.last_status = "ok"
    svc.last_subchecks = {"moomoo": {"status": "ok"}}
    return svc


def _make_incident(affected: list[str] | None = None) -> MagicMock:
    inc = MagicMock()
    inc.id = 1
    inc.service_id = 42
    inc.affected_subchecks = affected if affected is not None else ["moomoo"]
    # Allow attribute assignment (MagicMock allows this by default)
    return inc


def _make_heartbeat(ts: datetime, status: str = "ok", subchecks: dict | None = None) -> MagicMock:
    hb = MagicMock()
    hb.ts = ts
    hb.status = status
    hb.subchecks = subchecks if subchecks is not None else {"moomoo": {"status": "ok"}}
    return hb


# ---------------------------------------------------------------------------
# Test: 6 evenly-spaced ok heartbeats → should close
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_maybe_close_returns_true_when_all_ok() -> None:
    """6 heartbeats evenly spaced over 5 min, all ok → close."""
    now = datetime.now(timezone.utc)
    # 6 heartbeats, one every 60s, covering the last 5 minutes.
    heartbeats = [
        _make_heartbeat(now - timedelta(seconds=300 - i * 60))
        for i in range(6)
    ]

    service = _make_service(interval=60)
    incident = _make_incident(affected=["moomoo"])

    session = AsyncMock()
    # session.get(Service, ...) returns the mock service.
    session.get = AsyncMock(return_value=service)
    # session.execute(...).scalars() returns the heartbeat list.
    execute_result = MagicMock()
    execute_result.scalars.return_value = heartbeats
    session.execute = AsyncMock(return_value=execute_result)

    result = await _maybe_close(session, incident)

    assert result is True
    assert incident.lifecycle_state == IncidentLifecycleState.resolved
    # session.add should have been called at least twice (incident + update row).
    assert session.add.call_count >= 2


# ---------------------------------------------------------------------------
# Test: gap > 2×interval in middle → should NOT close
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_maybe_close_returns_false_on_gap() -> None:
    """Heartbeats with a gap > 2×60=120s in the middle → returns False."""
    now = datetime.now(timezone.utc)
    # 6 heartbeats in ascending order with a 130s gap between index 2 and 3.
    # Positions (seconds before now): 290, 230, 170, 40, 20, 0
    # Gap between 170s-ago and 40s-ago = 130s > 120s (2×60).
    times = [
        now - timedelta(seconds=290),
        now - timedelta(seconds=230),
        now - timedelta(seconds=170),
        now - timedelta(seconds=40),   # 130s gap from previous → exceeds tolerance
        now - timedelta(seconds=20),
        now - timedelta(seconds=0),
    ]
    heartbeats = [_make_heartbeat(t) for t in times]

    service = _make_service(interval=60)
    incident = _make_incident(affected=["moomoo"])

    session = AsyncMock()
    session.get = AsyncMock(return_value=service)
    execute_result = MagicMock()
    execute_result.scalars.return_value = heartbeats
    session.execute = AsyncMock(return_value=execute_result)

    result = await _maybe_close(session, incident)

    assert result is False


# ---------------------------------------------------------------------------
# Test: affected empty after sentinel strip → vacuously closes (no failing subchecks)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_maybe_close_empty_affected_closes() -> None:
    """Incident with only the push-loss sentinel → affected empty after strip → closes."""
    now = datetime.now(timezone.utc)
    heartbeats = [
        _make_heartbeat(now - timedelta(seconds=300 - i * 60), subchecks={})
        for i in range(6)
    ]

    service = _make_service(interval=60)
    incident = _make_incident(affected=[PUSH_LOSS_SENTINEL])

    session = AsyncMock()
    session.get = AsyncMock(return_value=service)
    execute_result = MagicMock()
    execute_result.scalars.return_value = heartbeats
    session.execute = AsyncMock(return_value=execute_result)

    result = await _maybe_close(session, incident)

    assert result is True
