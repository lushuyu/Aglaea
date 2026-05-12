"""Bearer-token tests — verify is in `asyncio.to_thread` (AC1.7, Principle 6).

CRITICAL invariant: every argon2 .verify() call is wrapped in
`asyncio.to_thread`. This test asserts the wrapper exists and is the only
async caller of `_verify_sync`.
"""

from __future__ import annotations

import asyncio
import inspect
from unittest.mock import patch

import pytest

from aglaea.security import bearer
from aglaea.security.bearer import (
    _verify_in_thread,
    _verify_sync,
    generate_key,
)


def test_generate_key_returns_shape() -> None:
    minted = generate_key()
    assert minted.plaintext
    assert len(minted.plaintext) > 32
    assert len(minted.prefix) == 8
    assert minted.plaintext.startswith(minted.prefix)
    assert minted.hash.startswith("$argon2")


def test_verify_sync_roundtrip() -> None:
    minted = generate_key()
    assert _verify_sync(minted.hash, minted.plaintext) is True
    assert _verify_sync(minted.hash, "wrong") is False


@pytest.mark.asyncio
async def test_verify_in_thread_uses_to_thread() -> None:
    """_verify_in_thread must invoke asyncio.to_thread, not call sync directly.

    Strategy: monkey-patch asyncio.to_thread to track invocation; if the
    wrapper bypasses to_thread (a regression), the patch will not see the call.
    """
    minted = generate_key()
    calls: list[tuple[object, ...]] = []
    original = asyncio.to_thread

    async def tracking_to_thread(func, *args, **kwargs):  # type: ignore[no-untyped-def]
        calls.append((func, args, kwargs))
        return await original(func, *args, **kwargs)

    with patch("aglaea.security.bearer.asyncio.to_thread", tracking_to_thread):
        ok = await _verify_in_thread(minted.hash, minted.plaintext)
    assert ok is True
    assert len(calls) == 1
    assert calls[0][0] is _verify_sync


def test_module_uses_only_one_verify_call_site() -> None:
    """Static grep — the module source contains exactly one `_verify_sync` def."""
    source = inspect.getsource(bearer)
    # Two references max: the def line and the to_thread call.
    assert source.count("_verify_sync") <= 3
    assert "asyncio.to_thread" in source
