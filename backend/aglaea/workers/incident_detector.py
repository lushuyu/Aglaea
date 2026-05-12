"""Incident detector — 10s tick (C40, C41, AC1.13, AC1.14).

For each service:
- **Open**: push-loss (`now - last_heartbeat_at > expected_interval × 2`) OR
  `last_status != 'ok'`. Initial `affected_subchecks` from failing subchecks
  (or sentinel `_heartbeat_lost_` for push-loss).
- **Subcheck accumulation**: every tick, union new non-ok subcheck keys into
  `affected_subchecks` (monotone — never remove during the incident).
- **Close**: last 3 heartbeats all `status=ok` AND every `affected_subchecks`
  key ok in each of those 3 heartbeats.

T1 (subcheck_changed) is DROPPED per C38 — the detector never enqueues
`ReportTrigger.SUBCHECK_CHANGED`. Only T0/T2/T3 fire.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.config import INCIDENT_DETECTOR_TICK_SECONDS
from aglaea.db import session_scope
from aglaea.models.heartbeat import HeartbeatEvent
from aglaea.models.incidents import Incident, IncidentStatus
from aglaea.models.services import Service, ServiceKind
from aglaea.workers._invariants import worker_loop
from aglaea.workers.report_generator import ReportTrigger, enqueue_report_trigger

log = logging.getLogger(__name__)

PUSH_LOSS_SENTINEL = "_heartbeat_lost_"
CLOSE_RULE_HEARTBEAT_COUNT = 3


def _failing_subchecks(subchecks: dict[str, Any] | None) -> list[str]:
    """Return subcheck keys with a non-ok status."""
    if not subchecks:
        return []
    out: list[str] = []
    for key, value in subchecks.items():
        if isinstance(value, dict) and value.get("status") not in ("ok", None):
            out.append(key)
    return sorted(out)


async def _open_incident_if_needed(
    session: AsyncSession,
    service: Service,
    *,
    now: datetime,
) -> Incident | None:
    """Return a newly-opened incident, or None if no open is required."""
    # Already ongoing? Skip.
    stmt = (
        select(Incident)
        .where(Incident.service_id == service.id, Incident.status == IncidentStatus.ongoing)
        .limit(1)
    )
    if (await session.execute(stmt)).scalar_one_or_none() is not None:
        return None

    is_push_lost = False
    if service.kind == ServiceKind.push and service.expected_interval_seconds:
        if service.last_heartbeat_at is None:
            return None
        threshold = timedelta(seconds=service.expected_interval_seconds * 2)
        if now - service.last_heartbeat_at > threshold:
            is_push_lost = True

    is_status_failing = service.last_status is not None and service.last_status != "ok"

    if not (is_push_lost or is_status_failing):
        return None

    if is_push_lost:
        affected = [PUSH_LOSS_SENTINEL]
    else:
        affected = _failing_subchecks(service.last_subchecks) or [service.last_status or "down"]

    incident = Incident(
        service_id=service.id,
        status=IncidentStatus.ongoing,
        started_at=now,
        affected_subchecks=affected,
        initial_failure_payload={
            "last_status": service.last_status,
            "last_message": service.last_message,
            "last_subchecks": service.last_subchecks,
        },
    )
    session.add(incident)
    await session.flush()
    log.info(
        "incident.opened",
        extra={
            "service_slug": service.slug,
            "incident_id": incident.id,
            "affected": affected,
            "is_push_lost": is_push_lost,
        },
    )
    return incident


async def _accumulate_subchecks(
    session: AsyncSession,
    incident: Incident,
    service: Service,
) -> None:
    """Monotone union of failing subchecks into `incident.affected_subchecks` (C40)."""
    new_failing = set(_failing_subchecks(service.last_subchecks))
    existing = set(incident.affected_subchecks)
    delta = new_failing - existing
    if not delta:
        return
    incident.affected_subchecks = sorted(existing | delta)
    session.add(incident)
    log.info(
        "incident.subchecks.accumulated",
        extra={
            "incident_id": incident.id,
            "added": sorted(delta),
            "total": incident.affected_subchecks,
        },
    )


async def _maybe_close(
    session: AsyncSession,
    incident: Incident,
    service: Service,
    *,
    now: datetime,
) -> bool:
    """Apply close rule (C41 / AC1.14). Returns True if incident transitioned."""
    stmt = (
        select(HeartbeatEvent)
        .where(HeartbeatEvent.service_id == service.id)
        .order_by(desc(HeartbeatEvent.ts))
        .limit(CLOSE_RULE_HEARTBEAT_COUNT)
    )
    recent = list((await session.execute(stmt)).scalars())
    if len(recent) < CLOSE_RULE_HEARTBEAT_COUNT:
        return False

    affected = set(incident.affected_subchecks) - {PUSH_LOSS_SENTINEL}
    for hb in recent:
        if hb.status != "ok":
            return False
        if affected:
            subchecks = hb.subchecks or {}
            for key in affected:
                value = subchecks.get(key)
                if not isinstance(value, dict) or value.get("status") != "ok":
                    return False

    incident.status = IncidentStatus.resolved
    incident.resolved_at = now
    incident.final_recovery_payload = {
        "last_status": service.last_status,
        "last_subchecks": service.last_subchecks,
        "heartbeats_checked": CLOSE_RULE_HEARTBEAT_COUNT,
    }
    session.add(incident)
    log.info(
        "incident.resolved",
        extra={"incident_id": incident.id, "service_slug": service.slug},
    )
    return True


async def _tick(session: AsyncSession) -> None:
    """One detector pass over every service."""
    now = datetime.now(timezone.utc)
    services = list((await session.execute(select(Service))).scalars())

    for service in services:
        newly_opened = await _open_incident_if_needed(session, service, now=now)
        if newly_opened is not None:
            await enqueue_report_trigger(newly_opened.id, ReportTrigger.INITIAL)
            continue

        ongoing_stmt = (
            select(Incident)
            .where(
                Incident.service_id == service.id,
                Incident.status == IncidentStatus.ongoing,
            )
            .limit(1)
        )
        ongoing = (await session.execute(ongoing_stmt)).scalar_one_or_none()
        if ongoing is None:
            continue

        await _accumulate_subchecks(session, ongoing, service)

        closed = await _maybe_close(session, ongoing, service, now=now)
        if closed:
            await enqueue_report_trigger(ongoing.id, ReportTrigger.FINAL)


async def incident_detector_loop() -> None:
    """Worker entry — ticks every 10s with crash recovery."""

    async def _body() -> None:
        async with session_scope() as session:
            await _tick(session)

    await worker_loop(
        "incident_detector",
        _body,
        interval_seconds=INCIDENT_DETECTOR_TICK_SECONDS,
    )
