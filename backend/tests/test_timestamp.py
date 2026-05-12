"""X-Aglaea-Timestamp tests (AC1.5, AC5.11)."""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from aglaea.config import TIMESTAMP_WINDOW_SECONDS
from aglaea.security.timestamp import verify_x_aglaea_timestamp


class _FakeSession:
    def __init__(self) -> None:
        self.committed = 0
        self.adds: list[object] = []

    def add(self, obj: object) -> None:
        self.adds.append(obj)

    async def commit(self) -> None:
        self.committed += 1


@pytest.mark.asyncio
async def test_missing_header_rejected() -> None:
    session = _FakeSession()
    with pytest.raises(HTTPException) as exc:
        await verify_x_aglaea_timestamp(None, session=session)  # type: ignore[arg-type]
    assert exc.value.status_code == 401
    assert session.committed == 1
    # Audit row inserted.
    assert len(session.adds) == 1


@pytest.mark.asyncio
async def test_malformed_value_rejected() -> None:
    session = _FakeSession()
    with pytest.raises(HTTPException) as exc:
        await verify_x_aglaea_timestamp("not-a-number", session=session)  # type: ignore[arg-type]
    assert exc.value.status_code == 401
    assert session.committed == 1


@pytest.mark.asyncio
async def test_outside_window_rejected_old() -> None:
    session = _FakeSession()
    now = int(time.time())
    old = now - TIMESTAMP_WINDOW_SECONDS - 10
    with pytest.raises(HTTPException) as exc:
        await verify_x_aglaea_timestamp(str(old), session=session)  # type: ignore[arg-type]
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_outside_window_rejected_future() -> None:
    session = _FakeSession()
    now = int(time.time())
    future = now + TIMESTAMP_WINDOW_SECONDS + 10
    with pytest.raises(HTTPException) as exc:
        await verify_x_aglaea_timestamp(str(future), session=session)  # type: ignore[arg-type]
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_inside_window_accepted() -> None:
    session = _FakeSession()
    now = int(time.time())
    accepted = await verify_x_aglaea_timestamp(
        str(now - 30), session=session  # type: ignore[arg-type]
    )
    assert accepted == now - 30
    # No audit / commit on success.
    assert session.committed == 0
    assert session.adds == []
