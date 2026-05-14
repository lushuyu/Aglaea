"""Admin incident endpoints — list, detail, regenerate, publish, reject, edit."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.db import get_session
from aglaea.llm.context import _sanitise_user_text
from aglaea.models.incident_updates import IncidentUpdate, IncidentUpdateKind
from aglaea.models.incidents import Incident, IncidentReportState, IncidentStatus
from aglaea.routers._deps import client_ip, require_admin_row
from aglaea.schemas.incident import (
    IncidentAdminOut,
    IncidentRegenerateRequest,
    IncidentReportEdit,
    IncidentSummaryEdit,
    IncidentUpdateCreate,
    IncidentUpdateOut,
)
from aglaea.security.audit import audit
from aglaea.services.timeline import build_admin_timeline
from aglaea.workers.report_generator import ReportTrigger, enqueue_report_trigger

router = APIRouter(prefix="/api/admin/incidents", tags=["admin-incidents"])


@router.get("")
async def list_incidents(
    request: Request,
    session: AsyncSession = Depends(get_session),
    status_filter: str | None = Query(default=None, alias="status"),
    service_id: int | None = Query(default=None),
) -> dict[str, list[IncidentAdminOut]]:
    await require_admin_row(request, session)
    stmt = select(Incident).order_by(desc(Incident.started_at)).limit(200)
    if status_filter:
        stmt = stmt.where(Incident.status == IncidentStatus(status_filter))
    if service_id is not None:
        stmt = stmt.where(Incident.service_id == service_id)
    rows = list((await session.execute(stmt)).scalars())
    return {"incidents": [IncidentAdminOut.model_validate(r) for r in rows]}


@router.get("/{incident_id}")
async def get_incident(
    incident_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    await require_admin_row(request, session)
    row = await session.get(Incident, incident_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    # Eagerly load updates so IncidentAdminOut.updates is populated.
    updates_stmt = (
        select(IncidentUpdate)
        .where(IncidentUpdate.incident_id == incident_id)
        .order_by(IncidentUpdate.t.desc())
    )
    updates_rows = list((await session.execute(updates_stmt)).scalars())
    # Timeline is derived at read-time from lifecycle + heartbeat transitions
    # + audit events (admin variant). heartbeats / similar remain empty for
    # v0.1 polish (plan §OOS — Phase 3 work). The frontend
    # (AdminIncidentResponse) expects all three keys to be iterable.
    timeline = await build_admin_timeline(session, row)
    incident_out = IncidentAdminOut.model_validate(row)
    # Override updates with the explicitly queried list (reverse-chronological).
    incident_out.updates = [IncidentUpdateOut.model_validate(u) for u in updates_rows]
    return {
        "incident": incident_out,
        "timeline": timeline,
        "heartbeats": [],
        "similar": [],
    }


@router.post("/{incident_id}/updates")
async def add_update(
    incident_id: int,
    payload: IncidentUpdateCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, IncidentUpdateOut]:
    admin = await require_admin_row(request, session)
    row = await session.get(Incident, incident_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    update = IncidentUpdate(
        incident_id=incident_id,
        kind=IncidentUpdateKind.manual,
        text=payload.text,
        status_snapshot=None,
        author_id=admin.id,
    )
    session.add(update)
    await session.flush()
    await audit(
        session,
        event="admin.incident.update_added",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={"incident_id": incident_id, "update_id": update.id},
    )
    await session.commit()
    await session.refresh(update)
    return {"update": IncidentUpdateOut.model_validate(update)}


@router.patch("/{incident_id}/summary")
async def edit_summary(
    incident_id: int,
    payload: IncidentSummaryEdit,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, IncidentAdminOut]:
    admin = await require_admin_row(request, session)
    row = await session.get(Incident, incident_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    row.summary = payload.summary
    session.add(row)
    await audit(
        session,
        event="admin.incident.summary_edited",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={"incident_id": incident_id},
    )
    await session.commit()
    await session.refresh(row)
    # Load updates for the response.
    updates_stmt = (
        select(IncidentUpdate)
        .where(IncidentUpdate.incident_id == incident_id)
        .order_by(IncidentUpdate.t.desc())
    )
    updates_rows = list((await session.execute(updates_stmt)).scalars())
    incident_out = IncidentAdminOut.model_validate(row)
    incident_out.updates = [IncidentUpdateOut.model_validate(u) for u in updates_rows]
    return {"incident": incident_out}


@router.post("/{incident_id}/regenerate")
async def regenerate(
    incident_id: int,
    payload: IncidentRegenerateRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, IncidentAdminOut]:
    admin = await require_admin_row(request, session)
    row = await session.get(Incident, incident_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")

    # Manual regenerate maps to T0 priority (initial) so it wins over T2.
    # CR-1: instruction travels through the `<admin_directive>` trusted slot.
    # CR-5 / AC (c) Path A: audit row records the full sanitised text under the
    # `instruction` key (SSOT — `None` means absent). Legacy `instruction_present`
    # bool is dropped: `details->>'instruction' IS NULL` is the new predicate.
    instruction_sanitised = (
        _sanitise_user_text(payload.instruction)
        if payload.instruction is not None
        else None
    )
    await enqueue_report_trigger(
        incident_id,
        ReportTrigger.INITIAL,
        instruction=instruction_sanitised,
    )
    await audit(
        session,
        event="admin.incident.regenerate_requested",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={
            "incident_id": incident_id,
            "instruction": instruction_sanitised,
        },
    )
    await session.commit()
    return {"incident": IncidentAdminOut.model_validate(row)}


@router.post("/{incident_id}/publish")
async def publish(
    incident_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, IncidentAdminOut]:
    admin = await require_admin_row(request, session)
    row = await session.get(Incident, incident_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    if not row.report_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="no draft to publish",
        )

    row.published_text = row.report_text
    row.published_at = datetime.now(timezone.utc)
    row.published_by = admin.id
    row.report_state = IncidentReportState.published
    session.add(row)

    await audit(
        session,
        event="admin.incident.published",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={"incident_id": incident_id},
    )
    await session.commit()
    return {"incident": IncidentAdminOut.model_validate(row)}


@router.post("/{incident_id}/reject")
async def reject(
    incident_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, IncidentAdminOut]:
    admin = await require_admin_row(request, session)
    row = await session.get(Incident, incident_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    row.report_state = IncidentReportState.rejected
    session.add(row)
    await audit(
        session,
        event="admin.incident.rejected",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={"incident_id": incident_id},
    )
    await session.commit()
    return {"incident": IncidentAdminOut.model_validate(row)}


@router.patch("/{incident_id}/report", response_model=IncidentAdminOut)
async def edit_report(
    incident_id: int,
    payload: IncidentReportEdit,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> IncidentAdminOut:
    admin = await require_admin_row(request, session)
    row = await session.get(Incident, incident_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    row.report_text = payload.report_text
    row.report_state = IncidentReportState.draft
    session.add(row)
    await audit(
        session,
        event="admin.incident.report_edited",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={"incident_id": incident_id, "length": len(payload.report_text)},
    )
    await session.commit()
    return IncidentAdminOut.model_validate(row)
