"""Worker-loop invariants — Principle 3 layer (a), AC1.6.

`worker_loop()` wraps a coroutine factory in:
- `try/except Exception` inside the loop body — logs traceback, ntfys, sleeps
  with capped exponential backoff, continues. NEVER lets the task die from
  a recoverable exception.
- `asyncio.CancelledError` propagates (lifespan-driven shutdown).

Note: Python 3.12's `CancelledError` is NOT an `Exception` subclass, so
`except Exception` does NOT swallow cancellation.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from aglaea.ntfy import send_alert

log = logging.getLogger(__name__)

DEFAULT_BACKOFF_MAX_SECONDS = 60.0
INITIAL_BACKOFF_SECONDS = 1.0


async def worker_loop(
    name: str,
    body: Callable[[], Awaitable[None]],
    *,
    interval_seconds: float,
    backoff_max_seconds: float = DEFAULT_BACKOFF_MAX_SECONDS,
) -> None:
    """Run `body()` every `interval_seconds` with crash recovery.

    Behaviour:
    - Successful body() → sleep `interval_seconds`, repeat.
    - Recoverable exception → log + ntfy + capped exponential backoff sleep,
      then continue the loop. Backoff resets after a successful tick.
    - asyncio.CancelledError → propagates (lifespan shutdown).
    """
    backoff = INITIAL_BACKOFF_SECONDS
    log.info("worker.started", extra={"name": name, "interval": interval_seconds})
    while True:
        try:
            await body()
            backoff = INITIAL_BACKOFF_SECONDS
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            log.info("worker.cancelled_inside_loop", extra={"name": name})
            raise
        except Exception as exc:  # noqa: BLE001 — that's the point of this wrapper
            log.exception(
                "worker.tick.failed",
                extra={"name": name, "backoff": backoff},
            )
            await send_alert(
                title=f"Aglaea worker tick failed: {name}",
                message=(
                    f"{type(exc).__name__}: {exc}. "
                    f"Backing off {backoff:.1f}s then retrying."
                ),
                priority="high",
            )
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2.0, backoff_max_seconds)
