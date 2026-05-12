"""Self-ping worker tests (AC3.4, AC1.6)."""

from __future__ import annotations

import os

import pytest

from aglaea.config import Settings
from aglaea.workers.self_ping import _ping_once


@pytest.mark.asyncio
async def test_ping_noop_when_env_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HEALTHCHECKS_SELFPING_URL", "")
    # Re-build settings via get_settings cache miss — easiest is to call
    # `_ping_once` directly; with empty URL it should return cleanly without
    # raising and without making any HTTP call.
    from aglaea.config import get_settings

    get_settings.cache_clear()
    await _ping_once()


@pytest.mark.asyncio
async def test_ping_never_raises_on_network_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "HEALTHCHECKS_SELFPING_URL",
        "http://127.0.0.1:1/never-listens",
    )
    from aglaea.config import get_settings

    get_settings.cache_clear()
    # Should swallow connection errors and log WARN.
    await _ping_once()
    # Reset for downstream tests.
    monkeypatch.setenv("HEALTHCHECKS_SELFPING_URL", "")
    get_settings.cache_clear()
