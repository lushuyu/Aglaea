"""Worker lifespan tests (AC1.6, AC1.17).

Tests the two-layer defence:
1. Inside-loop `try/except` keeps the task alive across recoverable errors.
2. Task-level `add_done_callback` fires + ntfys if a task ever terminates.
"""

from __future__ import annotations

import asyncio
import contextlib
from unittest.mock import AsyncMock

import pytest

from aglaea.workers import _on_worker_died
from aglaea.workers._invariants import worker_loop


@pytest.mark.asyncio
async def test_worker_loop_survives_recoverable_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC1.6 — loop body raises once; next tick must still fire."""
    call_count = 0

    async def flaky_body() -> None:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RuntimeError("transient")

    fake_alert = AsyncMock()
    monkeypatch.setattr("aglaea.workers._invariants.send_alert", fake_alert)

    task = asyncio.create_task(
        worker_loop("test", flaky_body, interval_seconds=0.01, backoff_max_seconds=0.05)
    )
    await asyncio.sleep(0.2)
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task

    assert call_count >= 2, f"loop did not survive first exception (calls={call_count})"
    fake_alert.assert_awaited()


@pytest.mark.asyncio
async def test_on_worker_died_callback_fires_on_unexpected_termination(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC1.17 — done-callback ntfys when a task terminates while app alive."""
    alerts: list[tuple[str, str]] = []

    async def fake_send_alert(title: str, message: str, priority: str = "default") -> None:
        alerts.append((title, message))

    monkeypatch.setattr("aglaea.workers.send_alert", fake_send_alert)

    async def short_task() -> None:
        # Returns cleanly after 50ms — this is exactly the "unexpected
        # termination" the done-callback is supposed to catch.
        await asyncio.sleep(0.05)

    task = asyncio.create_task(short_task(), name="probe_worker")
    task.add_done_callback(_on_worker_died)

    await task
    # Give the fire-and-forget alert task a chance to run.
    await asyncio.sleep(0.2)

    assert any("probe_worker" in msg for _, msg in alerts), (
        f"done-callback did not fire ntfy; alerts={alerts}"
    )


@pytest.mark.asyncio
async def test_on_worker_died_callback_silent_on_cancellation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cancellation is normal shutdown — no ntfy."""
    alerts: list[str] = []

    async def fake_send_alert(title: str, message: str, priority: str = "default") -> None:
        alerts.append(title)

    monkeypatch.setattr("aglaea.workers.send_alert", fake_send_alert)

    async def cancellable() -> None:
        await asyncio.sleep(60)

    task = asyncio.create_task(cancellable(), name="cancellable_worker")
    task.add_done_callback(_on_worker_died)
    await asyncio.sleep(0.05)
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task

    await asyncio.sleep(0.1)
    assert alerts == [], f"cancellation should not ntfy; got {alerts}"
