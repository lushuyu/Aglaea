"""Rate-limit + auth-fail storm middleware tests (AC1.16, Phase 3.4)."""

from __future__ import annotations

import pytest

from aglaea.config import (
    AUTH_FAIL_ALERT_THRESHOLD_PER_MIN,
    RATE_LIMIT_PER_TOKEN_PER_MIN,
)
from aglaea.middleware.rate_limit import _Counter


@pytest.mark.asyncio
async def test_counter_increments_within_window() -> None:
    counter = _Counter(window=10.0)
    for i in range(1, 6):
        n = await counter.bump("key-A")
        assert n == i


@pytest.mark.asyncio
async def test_counter_isolates_keys() -> None:
    counter = _Counter(window=10.0)
    await counter.bump("key-A")
    await counter.bump("key-A")
    n_b = await counter.bump("key-B")
    assert n_b == 1


def test_rate_limit_constants() -> None:
    # AC1.16: thresholds locked at 60/min per token, 10/min auth-fail alert.
    assert RATE_LIMIT_PER_TOKEN_PER_MIN == 60
    assert AUTH_FAIL_ALERT_THRESHOLD_PER_MIN == 10
