"""X-Aglaea-Timestamp validation (C17, AC1.5, AC5.11).

HMAC dropped in v0.1 — `X-Aglaea-Timestamp` is the mandatory replacement.
Window is ±300s (5 minutes); outside → 401 + audit_log write.

NTP assumption: this check assumes Cerydra and Aglaea hosts both run NTP.
Clock drift >5 minutes will reject otherwise-legitimate heartbeats; both
hosts are on the same VPS in v0.1, so skew = 0. When Hyacine (different
host) is wired up, verify `chrony` or `systemd-timesyncd` is enabled.
(Critic W1.)
"""

from __future__ import annotations

import time
from typing import Final

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.config import TIMESTAMP_WINDOW_SECONDS
from aglaea.security.audit import audit

HEADER_NAME: Final[str] = "X-Aglaea-Timestamp"


async def verify_x_aglaea_timestamp(
    raw_value: str | None,
    *,
    session: AsyncSession,
    ip: str | None = None,
    now_func: object | None = None,
) -> int:
    """Validate the header; raise 401 + write audit_log on rejection.

    Returns the parsed epoch-seconds value on success.
    """
    now_value = int(now_func() if callable(now_func) else time.time())

    if not raw_value:
        await audit(
            session,
            event="auth.timestamp_window_rejected",
            actor_type="service",
            ip=ip,
            details={
                "reason": "missing_header",
                "now": now_value,
            },
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"{HEADER_NAME} header is required",
        )

    try:
        ts = int(raw_value)
    except ValueError:
        await audit(
            session,
            event="auth.timestamp_window_rejected",
            actor_type="service",
            ip=ip,
            details={
                "reason": "malformed_value",
                "value": raw_value[:64],
                "now": now_value,
            },
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"{HEADER_NAME} must be unix epoch seconds",
        ) from None

    delta = abs(now_value - ts)
    if delta > TIMESTAMP_WINDOW_SECONDS:
        await audit(
            session,
            event="auth.timestamp_window_rejected",
            actor_type="service",
            ip=ip,
            details={
                "reason": "outside_window",
                "timestamp": ts,
                "now": now_value,
                "delta": delta,
                "window_seconds": TIMESTAMP_WINDOW_SECONDS,
            },
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"{HEADER_NAME} outside ±{TIMESTAMP_WINDOW_SECONDS}s window",
        )

    return ts
