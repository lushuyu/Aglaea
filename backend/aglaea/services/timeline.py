"""Timeline assembly for incident detail pages.

Two sibling public entry points share private helpers but live in separate
call paths so the public variant CANNOT leak admin-only audit rows:

- ``build_admin_timeline``  → lifecycle + heartbeats + audit
- ``build_public_timeline`` → lifecycle + heartbeats (audit helper is NOT
  imported or invoked from this code path; structural separation is the
  load-bearing leak prevention per plan ADR / CR-8).

Returned shape matches ``frontend/types/api.ts::TimelineEvent``:
    {"t": ISO8601 str, "sub": str, "status": str, "note": str | None}

All timestamps are TIMESTAMPTZ in Postgres; we normalise to UTC ISO8601 on
the wire.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import asc, bindparam, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from aglaea.models.audit import AuditLog
from aglaea.models.heartbeat import HeartbeatEvent
from aglaea.models.incidents import Incident

# Tunables (mirror plan §Risk 4 + executor task spec):
_HEARTBEAT_TRANSITION_CAP = 30  # newest-30 retained on overflow
_HEARTBEAT_DEDUPE_WINDOW_SECONDS = 30  # per-subcheck transition coalesce window


def _iso(dt: datetime) -> str:
    """Normalise to UTC ISO8601 string for the wire."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).isoformat()


async def _incident_lifecycle_events(incident: Incident) -> list[dict[str, Any]]:
    """Emit ``incident.started`` and (if resolved) ``incident.resolved`` rows.

    sub="incident", status="started"|"resolved", note=None.
    """
    rows: list[dict[str, Any]] = [
        {
            "t": _iso(incident.started_at),
            "sub": "incident",
            "status": "started",
            "note": None,
        }
    ]
    if incident.resolved_at is not None:
        rows.append(
            {
                "t": _iso(incident.resolved_at),
                "sub": "incident",
                "status": "resolved",
                "note": None,
            }
        )
    return rows


async def _heartbeat_transitions(
    session: AsyncSession, incident: Incident
) -> list[dict[str, Any]]:
    """Emit one row per per-subcheck status flip inside the incident window.

    Window: ``incident.started_at <= ts <= COALESCE(resolved_at, now())``.
    Walks heartbeats chronologically; the first heartbeat after the start is
    the baseline (no row emitted). For each subsequent heartbeat, each
    subcheck whose status differs from the last-emitted state emits a row.
    A 30-second per-subcheck coalesce window suppresses repeated flips for
    the same subcheck within 30s of its previous emitted transition.
    Capped at the most recent 30 transitions across all subchecks.
    """
    upper = incident.resolved_at if incident.resolved_at is not None else func.now()
    stmt = (
        select(HeartbeatEvent)
        .where(HeartbeatEvent.service_id == incident.service_id)
        .where(HeartbeatEvent.ts >= incident.started_at)
        .where(HeartbeatEvent.ts <= upper)
        .order_by(asc(HeartbeatEvent.ts))
    )
    heartbeats = list((await session.execute(stmt)).scalars())

    # last-emitted (or baseline) state per subcheck name → (status, ts)
    last_state: dict[str, tuple[str, datetime]] = {}
    rows: list[dict[str, Any]] = []

    for hb in heartbeats:
        subchecks = hb.subchecks or {}
        if not isinstance(subchecks, dict):
            continue
        for sub_name, sub_data in subchecks.items():
            if not isinstance(sub_data, dict):
                continue
            sub_status = sub_data.get("status")
            if not isinstance(sub_status, str):
                continue
            prev = last_state.get(sub_name)
            if prev is None:
                # Baseline: record but do not emit a transition row.
                last_state[sub_name] = (sub_status, hb.ts)
                continue
            prev_status, prev_ts = prev
            if sub_status == prev_status:
                continue
            # De-dupe: skip if within 30s of the previous emitted transition
            # for this subcheck.
            delta = (hb.ts - prev_ts).total_seconds()
            if delta < _HEARTBEAT_DEDUPE_WINDOW_SECONDS:
                # Suppress but DO advance the last-seen timestamp so a
                # subsequent flip is measured from the suppressed event.
                last_state[sub_name] = (sub_status, hb.ts)
                continue
            note_val = sub_data.get("message")
            rows.append(
                {
                    "t": _iso(hb.ts),
                    "sub": sub_name,
                    "status": sub_status,
                    "note": note_val if isinstance(note_val, str) else None,
                }
            )
            last_state[sub_name] = (sub_status, hb.ts)

    # Cap at the most recent 30 transitions (newest tail).
    if len(rows) > _HEARTBEAT_TRANSITION_CAP:
        rows = rows[-_HEARTBEAT_TRANSITION_CAP:]
    return rows


async def _audit_events(
    session: AsyncSession, incident_id: int
) -> list[dict[str, Any]]:
    """ADMIN-ONLY. Query audit_log rows scoped to this incident.

    Predicate: ``audit_log.details ->> 'incident_id' = :iid``.
    Maps known events to timeline rows; skips unrelated events.
    NEVER called by ``build_public_timeline``.
    """
    # JSONB ->> '<key>' returns text; bind incident_id as text.
    predicate = AuditLog.details.op("->>")("incident_id") == bindparam(
        "iid", value=str(incident_id), type_=None
    )
    stmt = (
        select(AuditLog)
        .where(predicate)
        .order_by(asc(AuditLog.ts))
    )
    audit_rows = list((await session.execute(stmt)).scalars())

    out: list[dict[str, Any]] = []
    for r in audit_rows:
        event = r.event
        if event == "admin.incident.regenerate_requested":
            instr = ""
            if isinstance(r.details, dict):
                raw = r.details.get("instruction")
                if isinstance(raw, str):
                    # Snippet only — full text lives in audit_log.
                    instr = raw[:200]
            row = {
                "t": _iso(r.ts),
                "sub": "admin",
                "status": "regenerate_requested",
                "note": instr,
            }
        elif event == "admin.incident.published":
            row = {
                "t": _iso(r.ts),
                "sub": "admin",
                "status": "published",
                "note": None,
            }
        elif event == "admin.incident.rejected":
            row = {
                "t": _iso(r.ts),
                "sub": "admin",
                "status": "rejected",
                "note": None,
            }
        elif event == "admin.incident.report_edited":
            row = {
                "t": _iso(r.ts),
                "sub": "admin",
                "status": "report_edited",
                "note": None,
            }
        else:
            # Skip event types not part of the curated admin timeline surface.
            continue
        out.append(row)
    return out


async def build_admin_timeline(
    session: AsyncSession, incident: Incident
) -> list[dict[str, Any]]:
    """Admin variant: lifecycle + heartbeat transitions + audit events.

    Returns rows sorted ascending by ``t``.
    """
    lifecycle = await _incident_lifecycle_events(incident)
    transitions = await _heartbeat_transitions(session, incident)
    audit = await _audit_events(session, incident.id)
    merged: list[dict[str, Any]] = []
    merged.extend(lifecycle)
    merged.extend(transitions)
    merged.extend(audit)
    merged.sort(key=lambda row: row["t"])
    return merged


async def build_public_timeline(
    session: AsyncSession, incident: Incident
) -> list[dict[str, Any]]:
    """Public variant: lifecycle + heartbeat transitions ONLY.

    Intentionally NEVER touches the admin-only audit helper — structural
    separation is the load-bearing leak prevention (plan ADR / CR-8).
    Returns rows sorted ascending by ``t``.
    """
    lifecycle = await _incident_lifecycle_events(incident)
    transitions = await _heartbeat_transitions(session, incident)
    merged: list[dict[str, Any]] = []
    merged.extend(lifecycle)
    merged.extend(transitions)
    merged.sort(key=lambda row: row["t"])
    return merged
