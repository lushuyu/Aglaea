"""Admin incident endpoints — list, detail, regenerate, publish, reject, edit."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.db import get_session
from aglaea.models.incidents import Incident, IncidentReportState, IncidentStatus
from aglaea.routers._deps import client_ip, require_admin_row
from aglaea.schemas.incident import (
    IncidentAdminOut,
    IncidentRegenerateRequest,
    IncidentReportEdit,
)
from aglaea.security.audit import audit
from aglaea.workers.report_generator import ReportTrigger, enqueue_report_trigger

router = APIRouter(prefix="/api/admin/incidents", tags=["admin-incidents"])


@router.get("", response_model=list[IncidentAdminOut])
async def list_incidents(
    request: Request,
    session: AsyncSession = Depends(get_session),
    status_filter: str | None = Query(default=None, alias="status"),
    service_id: int | None = Query(default=None),
) -> list[IncidentAdminOut]:
    await require_admin_row(request, session)
    stmt = select(Incident).order_by(desc(Incident.started_at)).limit(200)
    if status_filter:
        stmt = stmt.where(Incident.status == IncidentStatus(status_filter))
    if service_id is not None:
        stmt = stmt.where(Incident.service_id == service_id)
    rows = list((await session.execute(stmt)).scalars())
    return [IncidentAdminOut.model_validate(r) for r in rows]


@router.get("/{incident_id}", response_model=IncidentAdminOut)
async def get_incident(
    incident_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> IncidentAdminOut:
    await require_admin_row(request, session)
    row = await session.get(Incident, incident_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    return IncidentAdminOut.model_validate(row)


@router.post("/{incident_id}/regenerate", response_model=IncidentAdminOut)
async def regenerate(
    incident_id: int,
    payload: IncidentRegenerateRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> IncidentAdminOut:
    admin = await require_admin_row(request, session)
    row = await session.get(Incident, incident_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")

    # Manual regenerate maps to T0 priority (initial) so it wins over T2.
    await enqueue_report_trigger(incident_id, ReportTrigger.INITIAL)
    await audit(
        session,
        event="admin.incident.regenerate_requested",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={
            "incident_id": incident_id,
            "instruction_present": payload.instruction is not None,
        },
    )
    await session.commit()
    return IncidentAdminOut.model_validate(row)


@router.post("/{incident_id}/publish", response_model=IncidentAdminOut)
async def publish(
    incident_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> IncidentAdminOut:
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
    return IncidentAdminOut.model_validate(row)


@router.post("/{incident_id}/reject", response_model=IncidentAdminOut)
async def reject(
    incident_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> IncidentAdminOut:
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
    return IncidentAdminOut.model_validate(row)


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
