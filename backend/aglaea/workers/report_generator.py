"""Report generator — DeepSeek narrative drafts on T0/T2/T3 (C38, C39, AC1.11, AC1.12).

Trigger precedence (C39): T3 > T0 > T1 > T2 — single enum + `max()` site.

T1 (subcheck_changed) is DROPPED in v0.1 per C38. The enum value is RESERVED
with `.priority` so a v1.x revival is zero-reshape. A runtime assert at
`run_trigger()` entry catches any contributor who accidentally enqueues T1
(AC1.12 strengthened).

Decision LOCKED (per plan Phase 4.5): **in-memory queue + idempotent
re-derivation on startup.** No `report_triggers` table.

Re-derivation on lifespan startup: scan ongoing incidents; for each, compute
the highest-priority trigger that would currently apply (T2 if
`now - report_generated_at > 30 min`, else nothing) and enqueue it.

Coalesce per-incident per-tick via `max(triggers, key=lambda t: t.priority)`.

DeepSeek failure retry semantics (Critic W3): on a single failed call, log +
WARN, do NOT immediately retry; wait for the next natural trigger (T2 at
+30 min, or T3 if incident resolves). Hard cap of 12 generations remains.
"""

from __future__ import annotations

import asyncio
import enum
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.config import (
    REPORT_GENERATION_HARD_CAP,
    REPORT_PERIODIC_INTERVAL_SECONDS,
    get_settings,
)
from aglaea.db import session_scope
from aglaea.llm.context import build_incident_context
from aglaea.llm.deepseek import DeepSeekClient, DeepSeekError
from aglaea.llm.prompts import build_messages
from aglaea.models.incidents import Incident, IncidentReportState, IncidentStatus
from aglaea.models.services import Service
from aglaea.ntfy import send_alert
from aglaea.workers._invariants import worker_loop

log = logging.getLogger(__name__)


class ReportTrigger(enum.Enum):
    """T1 reserved but never enqueued in v0.1 (AC1.12)."""

    PERIODIC = 10  # T2
    SUBCHECK_CHANGED = 20  # T1 — RESERVED in v0.1; enum kept for v1.x revival
    INITIAL = 30  # T0
    FINAL = 40  # T3

    @classmethod
    def pick(cls, triggers: list[ReportTrigger]) -> ReportTrigger | None:
        """Return the highest-priority trigger (single enforcement site)."""
        if not triggers:
            return None
        return max(triggers, key=lambda t: t.value)


# Per-incident pending trigger queue (in-memory; re-derived on startup).
_pending: dict[int, list[ReportTrigger]] = defaultdict(list)
_pending_lock = asyncio.Lock()


async def enqueue_report_trigger(incident_id: int, trigger: ReportTrigger) -> None:
    """Used by incident_detector to enqueue a coalescing trigger."""
    async with _pending_lock:
        _pending[incident_id].append(trigger)
    log.info(
        "report.trigger.enqueued",
        extra={"incident_id": incident_id, "trigger": trigger.name},
    )


async def _drain_one() -> tuple[int, ReportTrigger] | None:
    """Pop one (incident_id, highest-priority-trigger) pair, or None if empty."""
    async with _pending_lock:
        if not _pending:
            return None
        # Pick a deterministic incident.
        incident_id = next(iter(_pending.keys()))
        triggers = _pending.pop(incident_id)
    chosen = ReportTrigger.pick(triggers)
    if chosen is None:
        return None
    return incident_id, chosen


async def _scan_periodic_re_derivation(session: AsyncSession) -> None:
    """Lifespan-startup re-derivation: enqueue T2 for ongoing incidents
    whose `report_generated_at` is older than the periodic window.
    """
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(seconds=REPORT_PERIODIC_INTERVAL_SECONDS)
    stmt = select(Incident).where(
        Incident.status == IncidentStatus.ongoing,
        (Incident.report_generated_at.is_(None))
        | (Incident.report_generated_at < threshold),
    )
    incidents = list((await session.execute(stmt)).scalars())
    for incident in incidents:
        await enqueue_report_trigger(incident.id, ReportTrigger.PERIODIC)


async def run_trigger(
    session: AsyncSession,
    *,
    incident_id: int,
    reason: ReportTrigger,
) -> None:
    """Generate (or skip) a draft for one incident.

    Runtime assertion (AC1.12 strengthened): T1 must NEVER reach this site.
    A future contributor who accidentally enqueues T1 trips a loud failure
    rather than a silent extra LLM call.
    """
    assert reason != ReportTrigger.SUBCHECK_CHANGED, (
        "T1 dropped in v0.1 per C38 — enum value reserved but never fired"
    )

    incident = await session.get(Incident, incident_id)
    if incident is None:
        log.warning("report.incident.missing", extra={"incident_id": incident_id})
        return

    # Once published, do not silently regenerate on automatic triggers;
    # admin must explicitly invoke /admin/incidents/{id}/regenerate (INITIAL path).
    if incident.report_state == IncidentReportState.published:
        if reason != ReportTrigger.INITIAL:
            log.info(
                "report.published.skipping_regen",
                extra={"incident_id": incident_id, "reason": reason.name},
            )
            return

    if incident.report_generation_count >= REPORT_GENERATION_HARD_CAP:
        log.warning(
            "report.hard_cap.reached",
            extra={
                "incident_id": incident_id,
                "count": incident.report_generation_count,
            },
        )
        await send_alert(
            title="Aglaea report-gen hard cap reached",
            message=(
                f"Incident #{incident_id} has reached the "
                f"{REPORT_GENERATION_HARD_CAP}-generation hard cap."
            ),
            priority="high",
        )
        return

    service = await session.get(Service, incident.service_id)
    if service is None:
        log.warning("report.service.missing", extra={"service_id": incident.service_id})
        return

    context = await build_incident_context(
        session,
        service=service,
        incident=incident,
        reason=reason.name,
    )
    messages = build_messages(context)

    settings = get_settings()
    if not settings.deepseek_api_key:
        log.warning("report.deepseek.api_key_missing")
        return

    client = DeepSeekClient(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )
    try:
        narrative = await client.generate(messages=messages)
    except DeepSeekError as exc:
        # Per Critic W3: log + WARN, do NOT immediately retry. Next natural
        # trigger (T2 / T3) will pick it up.
        log.warning(
            "report.deepseek.failed",
            extra={"incident_id": incident_id, "error": str(exc)},
        )
        return

    incident.report_text = narrative
    incident.report_state = (
        IncidentReportState.draft
        if incident.report_state != IncidentReportState.published
        else IncidentReportState.published
    )
    incident.report_generated_at = datetime.now(timezone.utc)
    incident.report_generation_count = incident.report_generation_count + 1
    incident.report_generation_reason = reason.name
    session.add(incident)
    log.info(
        "report.generated",
        extra={
            "incident_id": incident_id,
            "reason": reason.name,
            "count": incident.report_generation_count,
        },
    )


async def report_generator_loop() -> None:
    """Worker entry — drain pending triggers; sleep on empty."""

    # One-shot startup re-derivation.
    async with session_scope() as session:
        await _scan_periodic_re_derivation(session)

    async def _body() -> None:
        pair = await _drain_one()
        if pair is None:
            return
        incident_id, reason = pair
        async with session_scope() as session:
            await run_trigger(session, incident_id=incident_id, reason=reason)

    await worker_loop(
        "report_generator",
        _body,
        interval_seconds=5.0,
    )
