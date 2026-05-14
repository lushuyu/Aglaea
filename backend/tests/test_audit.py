"""Audit log helper tests (AC1.16, AC5.8) — request_id contextvar injection."""

from __future__ import annotations

import pytest

from aglaea.middleware.request_id import _REQUEST_ID_VAR
from aglaea.security.audit import audit


class _Captor:
    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, obj: object) -> None:
        self.added.append(obj)


@pytest.mark.asyncio
async def test_audit_injects_request_id_from_contextvar() -> None:
    captor = _Captor()
    token = _REQUEST_ID_VAR.set("test-request-id-abc")
    try:
        await audit(captor, event="test.event", actor_type="test")  # type: ignore[arg-type]
    finally:
        _REQUEST_ID_VAR.reset(token)
    assert len(captor.added) == 1
    row = captor.added[0]
    assert row.event == "test.event"
    details = row.details or {}
    assert details.get("request_id") == "test-request-id-abc"


@pytest.mark.asyncio
async def test_audit_request_id_null_when_unset() -> None:
    captor = _Captor()
    # Default contextvar value is None.
    await audit(captor, event="test.no_request", actor_type="test")  # type: ignore[arg-type]
    assert len(captor.added) == 1
    row = captor.added[0]
    details = row.details or {}
    assert details.get("request_id") is None


@pytest.mark.asyncio
async def test_audit_caller_supplied_details_preserved() -> None:
    captor = _Captor()
    await audit(  # type: ignore[arg-type]
        captor,
        event="test.kv",
        actor_type="admin",
        details={"foo": "bar", "n": 42},
    )
    row = captor.added[0]
    details = row.details or {}
    assert details["foo"] == "bar"
    assert details["n"] == 42
    # request_id default still injected.
    assert "request_id" in details
