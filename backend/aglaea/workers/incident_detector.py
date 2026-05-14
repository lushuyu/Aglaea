"""Incident detector — 10s tick (C40, C41, AC1.13, AC1.14).

For each service:
- **Open**: push-loss (`now - last_heartbeat_at > expected_interval × 2`) OR
  `last_status != 'ok'`. Initial `affected_subchecks` from failing subchecks
  (or sentinel `_heartbeat_lost_` for push-loss).
- **Subcheck accumulation**: every tick, union new non-ok subcheck keys into
  `affected_subchecks` (monotone — never remove during the incident).
- **New-worst detection**: a subcheck transition to a strictly worse severity
  that hasn't been seen on this (incident, subcheck) pair before triggers
  NEW_WORST report generation, subject to a 5-minute per-key cooldown.
- **Close**: anchored 5-minute window — all heartbeats ok with continuous
  coverage and no gap > 2×expected_interval.

T1 (subcheck_changed) is DROPPED per C38 — the detector never enqueues
`ReportTrigger.SUBCHECK_CHANGED`. Only T0/T2/T2.5/T3 fire.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Any, Final

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.config import INCIDENT_DETECTOR_TICK_SECONDS
from aglaea.db import session_scope
from aglaea.models.heartbeat import HeartbeatEvent
from aglaea.models.incident_updates import IncidentUpdate, IncidentUpdateKind
from aglaea.models.incidents import Incident, IncidentLifecycleState, IncidentStatus
from aglaea.models.services import Service, ServiceKind
from aglaea.workers._invariants import worker_loop
from aglaea.workers.report_generator import ReportTrigger, enqueue_report_trigger

log = logging.getLogger(__name__)

PUSH_LOSS_SENTINEL = "_heartbeat_lost_"
CLOSE_RULE_HEARTBEAT_COUNT = 3

# Cooldown map: key = (incident_id, subcheck_name, severity_class)
# severity_class is one of "degraded" or "down"
# Value = datetime of last DeepSeek call for this key.
_DEEPSEEK_COOLDOWN: dict[tuple[int, str, str], datetime] = {}
_COOLDOWN_TTL_SECONDS: Final[int] = 300  # 5 minutes

# Severity ordering for new-worst detection.
_SEVERITY_ORDER = {"ok": 0, "degraded": 1, "down": 2}


def _severity_class(status: str) -> str:
    """Map a raw status string to 'degraded' or 'down' for cooldown key purposes."""
    if status == "down":
        return "down"
    return "degraded"


def _is_strictly_worse(new_status: str, prev_status: str) -> bool:
    """Return True iff new_status is strictly worse than prev_status per ok<degraded<down."""
    new_val = _SEVERITY_ORDER.get(new_status, 1)  # unknown → treat as degraded
    prev_val = _SEVERITY_ORDER.get(prev_status, 0)
    return new_val > prev_val


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
    # Emit state_transition update for the open event.
    open_update = IncidentUpdate(
        incident_id=incident.id,
        t=now,
        kind=IncidentUpdateKind.state_transition,
        text=None,
        status_snapshot={
            "subchecks": {
                k: {"status": (service.last_subchecks or {}).get(k, {}).get("status", "unknown")}
                for k in affected
                if k != PUSH_LOSS_SENTINEL
            },
            "service_status": service.last_status or "unknown",
            "ts": now.isoformat(),
        },
    )
    session.add(open_update)
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


async def _check_new_worst(
    session: AsyncSession,
    incident: Incident,
    service: Service,
    *,
    now: datetime,
) -> None:
    """Detect new-worst severity transitions and enqueue NEW_WORST report trigger.

    A transition on a subcheck is "new-worst" iff:
    1. The new status is strictly worse than the previous status (ok < degraded < down).
    2. The new severity class hasn't been seen on this (incident, subcheck) pair
       before (checked via incident_updates state_transition history).
    3. The per-key cooldown (5 min) has not elapsed since the last DeepSeek call.
    """
    subchecks = service.last_subchecks or {}
    if not subchecks:
        return

    for subcheck_name, sub_entry in subchecks.items():
        if not isinstance(sub_entry, dict):
            continue
        new_status = sub_entry.get("status", "ok")
        if new_status == "ok":
            continue

        # Determine what severity this is.
        sev_class = _severity_class(new_status)

        # Check if this severity class was already seen for (incident, subcheck)
        # by scanning affected_subchecks + existing state_transition updates.
        # Simpler approach: query incident_updates for prior state_transitions that
        # recorded this subcheck at this severity.
        seen_stmt = (
            select(IncidentUpdate)
            .where(
                IncidentUpdate.incident_id == incident.id,
                IncidentUpdate.kind == IncidentUpdateKind.state_transition,
            )
            .order_by(IncidentUpdate.t.asc())
        )
        prior_updates = list((await session.execute(seen_stmt)).scalars())

        already_seen_sev = False
        prev_status_for_subcheck = "ok"
        for upd in prior_updates:
            snap = upd.status_snapshot or {}
            sub_snap = (snap.get("subchecks") or {}).get(subcheck_name)
            if sub_snap is not None:
                upd_status = sub_snap.get("status", "ok")
                if _severity_class(upd_status) == sev_class and upd_status != "ok":
                    already_seen_sev = True
                prev_status_for_subcheck = upd_status

        if already_seen_sev:
            continue

        # Is new_status strictly worse than prev?
        if not _is_strictly_worse(new_status, prev_status_for_subcheck):
            continue

        # Cooldown check.
        key = (incident.id, subcheck_name, sev_class)
        cooldown_ts = _DEEPSEEK_COOLDOWN.get(key)
        if cooldown_ts is not None and (now - cooldown_ts).total_seconds() < _COOLDOWN_TTL_SECONDS:
            log.info(
                "deepseek.call.cooldown_skipped",
                extra={
                    "incident_id": incident.id,
                    "subcheck": subcheck_name,
                    "severity_class": sev_class,
                },
            )
            continue

        # Fire.
        _DEEPSEEK_COOLDOWN[key] = now
        await enqueue_report_trigger(incident.id, ReportTrigger.NEW_WORST, instruction=None)
        log.info(
            "deepseek.call.fired",
            extra={
                "incident_id": incident.id,
                "subcheck": subcheck_name,
                "severity_class": sev_class,
                "trigger": "new_worst",
            },
        )
        # Only fire once per tick (one NEW_WORST enqueue coalesces).
        break


async def _maybe_close(
    session: AsyncSession,
    incident: Incident,
) -> bool:
    """Auto-close when all relevant subchecks have been ok for 5 anchored minutes
    with continuous heartbeat coverage. Mirrors line 150 sentinel subtraction.
    Returns True if the incident was closed.
    """
    service = await session.get(Service, incident.service_id)
    if service is None:
        return False
    expected_interval = service.expected_interval_seconds or 60  # null-safe
    required_count = ceil(300 / expected_interval)
    gap_tolerance_seconds = 2 * expected_interval

    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(seconds=300)

    # Pull heartbeats in the anchored window, ordered.
    stmt = (
        select(HeartbeatEvent)
        .where(
            HeartbeatEvent.service_id == incident.service_id,
            HeartbeatEvent.ts >= window_start,
            HeartbeatEvent.ts <= window_end,
        )
        .order_by(HeartbeatEvent.ts.asc())
    )
    rows = list((await session.execute(stmt)).scalars())

    if len(rows) < required_count:
        return False  # insufficient coverage

    # Gap-tolerance check
    for prev, curr in zip(rows[:-1], rows[1:]):
        if (curr.ts - prev.ts).total_seconds() > gap_tolerance_seconds:
            return False  # gap too wide; reset window

    # Compute the affected subchecks minus the sentinel (mirror line 150)
    affected = set(incident.affected_subchecks or []) - {PUSH_LOSS_SENTINEL}

    # Every heartbeat row must be ok at top level AND ok at every affected subcheck
    for row in rows:
        if row.status != "ok":
            return False
        subchecks = row.subchecks or {}
        for sub_name in affected:
            sub_entry = subchecks.get(sub_name)
            if sub_entry is None:
                return False  # subcheck missing → not safe to close
            if sub_entry.get("status") != "ok":
                return False

    # Close it.
    incident.lifecycle_state = IncidentLifecycleState.resolved
    incident.status = IncidentStatus.resolved
    incident.resolved_at = window_end
    incident.final_recovery_payload = {
        "last_status": service.last_status,
        "last_subchecks": service.last_subchecks,
        "close_rule": "anchored_5min_window",
    }
    session.add(incident)
    # Emit kind='state_transition' update row capturing the close.
    close_update = IncidentUpdate(
        incident_id=incident.id,
        t=window_end,
        kind=IncidentUpdateKind.state_transition,
        text=None,
        status_snapshot={
            "subchecks": {s: {"status": "ok"} for s in affected},
            "service_status": "ok",
            "ts": window_end.isoformat(),
        },
    )
    session.add(close_update)
    log.info(
        "incident.resolved",
        extra={"incident_id": incident.id, "service_id": incident.service_id},
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

        # Check for new-worst severity transitions before attempting close.
        await _check_new_worst(session, ongoing, service, now=now)

        closed = await _maybe_close(session, ongoing)
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
