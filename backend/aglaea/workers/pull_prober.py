"""Pull prober — HTTPS GET for kind=pull services (AC1.7, AC1.15, C42).

Per service: poll `probe_url` at `probe_interval_seconds`. Status mapping:
- HTTP status == `probe_expected_status` → `ok`
- Cert remaining validity < `CERT_WARN_DAYS` (14) AND not expired → `degraded`
  with `message='cert expires in N days'`
- Cert expired → `down`
- Connection refused / timeout / wrong status → `down`

Cert inspection uses `socket.create_connection` + `ssl.create_default_context`
+ `getpeercert()` — httpx-direct does not expose peercert. The blocking socket
call is wrapped in `asyncio.to_thread`.
"""

from __future__ import annotations

import logging
import socket
import ssl
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.config import CERT_WARN_DAYS
from aglaea.db import session_scope
from aglaea.models.heartbeat import HeartbeatEvent
from aglaea.models.services import Service, ServiceKind
from aglaea.workers._invariants import worker_loop

log = logging.getLogger(__name__)

CERT_DATE_FMT = "%b %d %H:%M:%S %Y %Z"


def _inspect_cert_sync(host: str, port: int, timeout: float) -> dict[str, Any] | None:
    """Blocking TLS handshake + peercert read. ONLY call from to_thread."""
    ctx = ssl.create_default_context()
    try:
        with (
            socket.create_connection((host, port), timeout=timeout) as raw,
            ctx.wrap_socket(raw, server_hostname=host) as tls,
        ):
            return tls.getpeercert()
    except (OSError, ssl.SSLError) as exc:
        log.warning("prober.cert.handshake_failed", extra={"host": host, "error": str(exc)})
        return None


async def _inspect_cert(host: str, port: int, timeout: float) -> dict[str, Any] | None:  # noqa: ASYNC109 — timeout is forwarded to the blocking socket call inside to_thread, not used for asyncio cancellation
    import asyncio

    return await asyncio.to_thread(_inspect_cert_sync, host, port, timeout)


def _cert_days_remaining(peercert: dict[str, Any], now: datetime) -> int | None:
    """Days until `notAfter`. Returns None if not parseable, negative if expired."""
    not_after = peercert.get("notAfter")
    if not isinstance(not_after, str):
        return None
    try:
        expires_at = datetime.strptime(not_after, CERT_DATE_FMT).replace(tzinfo=UTC)
    except ValueError:
        return None
    return (expires_at - now).days


async def _probe_one(
    session: AsyncSession,
    service: Service,
    *,
    http_get: Callable[[str], Awaitable[httpx.Response]] | None = None,
) -> None:
    """One probe pass. Inserts heartbeat_events + updates services.last_*."""
    if not service.probe_url:
        return
    now = datetime.now(UTC)
    status: str = "ok"
    message: str | None = None
    response_code: int | None = None

    timeout = float(service.probe_timeout_seconds or 10)
    try:
        if http_get is None:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
                response = await client.get(service.probe_url)
        else:
            response = await http_get(service.probe_url)
        response_code = response.status_code
        expected = service.probe_expected_status or 200
        if response.status_code != expected:
            status = "down"
            message = f"unexpected status {response.status_code}"
    except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPError) as exc:
        status = "down"
        message = f"{type(exc).__name__}: {exc}"

    if status == "ok":
        parsed = urlparse(service.probe_url)
        if parsed.scheme == "https" and parsed.hostname:
            port = parsed.port or 443
            peercert = await _inspect_cert(parsed.hostname, port, timeout)
            if peercert is not None:
                days = _cert_days_remaining(peercert, now)
                if days is not None:
                    if days < 0:
                        status = "down"
                        message = "cert expired"
                    elif days < CERT_WARN_DAYS:
                        status = "degraded"
                        message = f"cert expires in {days} days"

    subchecks: dict[str, Any] | None = None
    if response_code is not None:
        subchecks = {"http": {"status": status, "latency_ms": None, "message": message}}

    event = HeartbeatEvent(
        ts=now,
        service_id=service.id,
        status=status,
        subchecks=subchecks,
        metrics={"http_status": response_code} if response_code else None,
        message=message,
        source="probe",
    )
    session.add(event)

    service.last_heartbeat_at = now
    service.last_status = status
    service.last_subchecks = subchecks
    service.last_message = message
    session.add(service)

    log.info(
        "prober.tick",
        extra={
            "service_slug": service.slug,
            "status": status,
            "http_status": response_code,
        },
    )


async def _tick(session: AsyncSession) -> None:
    """Probe every kind=pull service whose probe_interval has elapsed."""
    now = datetime.now(UTC)
    stmt = select(Service).where(Service.kind == ServiceKind.pull)
    services = list((await session.execute(stmt)).scalars())
    for service in services:
        if not service.probe_url:
            continue
        if service.last_heartbeat_at is not None and service.probe_interval_seconds:
            elapsed = (now - service.last_heartbeat_at).total_seconds()
            if elapsed < service.probe_interval_seconds:
                continue
        await _probe_one(session, service)


async def pull_prober_loop() -> None:
    """Worker entry — ticks every 10s; per-service rate enforced inside."""

    async def _body() -> None:
        async with session_scope() as session:
            await _tick(session)

    await worker_loop(
        "pull_prober",
        _body,
        interval_seconds=10.0,
    )
