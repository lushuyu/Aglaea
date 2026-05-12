"""Self-ping worker (C35 / AC3.4).

Env-gated 60s POST to `$HEALTHCHECKS_SELFPING_URL`. Failure logs WARN; never
raises (Aglaea must never break the host's existing healthchecks.io pipeline).

`workers/__init__.py::start_workers()` only spawns this task if
`HEALTHCHECKS_SELFPING_URL` is set.
"""

from __future__ import annotations

import logging

import httpx

from aglaea.config import (
    HTTPX_DEFAULT_TIMEOUT_SECONDS,
    SELF_PING_INTERVAL_SECONDS,
    get_settings,
)
from aglaea.workers._invariants import worker_loop

log = logging.getLogger(__name__)


async def _ping_once() -> None:
    settings = get_settings()
    url = settings.healthchecks_selfping_url
    if not url:
        # Defensive — `start_workers` guards this, but if the env var is
        # cleared at runtime we still don't crash.
        return
    try:
        async with httpx.AsyncClient(timeout=HTTPX_DEFAULT_TIMEOUT_SECONDS) as client:
            response = await client.post(url, content=b"")
            if response.status_code >= 400:
                log.warning(
                    "self_ping.bad_status",
                    extra={"status": response.status_code},
                )
    except (httpx.HTTPError, OSError) as exc:
        log.warning("self_ping.failed", extra={"error": str(exc)})


async def self_ping_loop() -> None:
    """Worker entry — every 60s POST a heartbeat to healthchecks.io."""
    await worker_loop(
        "self_ping",
        _ping_once,
        interval_seconds=SELF_PING_INTERVAL_SECONDS,
    )
