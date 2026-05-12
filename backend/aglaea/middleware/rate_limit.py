"""Rate limiter — per-bearer-token + auth-failure storm detection (AC1.16, Phase 3.4).

In-memory fixed-window:
- Per bearer prefix: 60 req/min (`RATE_LIMIT_PER_TOKEN_PER_MIN`).
- Per source IP: >10 auth failures in 1 min → ntfy alert.

In-memory because v0.1 is single-container. Multi-container would need Redis.
The single-container assumption is C18; if v1.x splits to two containers,
this module becomes a Redis-backed token-bucket.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from aglaea.config import (
    AUTH_FAIL_ALERT_THRESHOLD_PER_MIN,
    RATE_LIMIT_PER_TOKEN_PER_MIN,
)
from aglaea.ntfy import send_alert

log = logging.getLogger(__name__)

WINDOW_SECONDS = 60.0
ALERT_COOLDOWN_SECONDS = 60.0
AUTH_FAIL_STATUS = {401, 403}
PROTECTED_PATH = "/api/v1/heartbeat"


class _Counter:
    """Rolling deque-based fixed-window counter."""

    def __init__(self, window: float) -> None:
        self._window = window
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def bump(self, key: str) -> int:
        async with self._lock:
            now = time.monotonic()
            dq = self._events[key]
            cutoff = now - self._window
            while dq and dq[0] < cutoff:
                dq.popleft()
            dq.append(now)
            return len(dq)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket + auth-fail alerting.

    Applied to /api/v1/heartbeat (the ingestion hot path). Other admin
    endpoints are intentionally not rate-limited in v0.1 — they sit behind
    session auth.
    """

    def __init__(self, app: object) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._token_counter = _Counter(WINDOW_SECONDS)
        self._fail_counter = _Counter(WINDOW_SECONDS)
        self._last_alert_at: dict[str, float] = {}
        self._alert_lock = asyncio.Lock()

    def _token_key(self, request: Request) -> str | None:
        auth = request.headers.get("Authorization") or ""
        if not auth.startswith("Bearer "):
            return None
        token = auth.removeprefix("Bearer ").strip()
        if len(token) < 8:
            return None
        return f"bearer:{token[:16]}"

    def _ip_key(self, request: Request) -> str:
        ip = request.client.host if request.client else "?"
        return f"ip:{ip}"

    async def _maybe_alert(self, ip_key: str, count: int) -> None:
        now = time.monotonic()
        async with self._alert_lock:
            last = self._last_alert_at.get(ip_key, 0.0)
            if now - last < ALERT_COOLDOWN_SECONDS:
                return
            self._last_alert_at[ip_key] = now
        await send_alert(
            title="Aglaea auth-fail storm",
            message=(
                f"{count} auth failures (401/403) in last 60s from {ip_key}. "
                f"Threshold {AUTH_FAIL_ALERT_THRESHOLD_PER_MIN}."
            ),
            priority="high",
        )

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.url.path == PROTECTED_PATH:
            key = self._token_key(request)
            if key is not None:
                count = await self._token_counter.bump(key)
                if count > RATE_LIMIT_PER_TOKEN_PER_MIN:
                    return JSONResponse(
                        {"detail": "rate limit exceeded"},
                        status_code=429,
                    )

        response = await call_next(request)

        if response.status_code in AUTH_FAIL_STATUS:
            ip_key = self._ip_key(request)
            count = await self._fail_counter.bump(ip_key)
            if count > AUTH_FAIL_ALERT_THRESHOLD_PER_MIN:
                await self._maybe_alert(ip_key, count)

        return response
