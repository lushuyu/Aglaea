"""Services CRUD — admin only (Phase 3.1)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.db import get_session
from aglaea.models.api_keys import ApiKey
from aglaea.models.incidents import Incident
from aglaea.models.services import Service, ServiceKind
from aglaea.routers._deps import client_ip, require_admin_row
from aglaea.schemas.incident import IncidentAdminOut
from aglaea.schemas.service import (
    ApiKeyOut,
    ServiceAdminOut,
    ServiceCreate,
    ServiceUpdate,
)
from aglaea.security.audit import audit

router = APIRouter(prefix="/api/admin/services", tags=["admin-services"])


@router.get("")
async def list_services(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, list[ServiceAdminOut]]:
    await require_admin_row(request, session)
    rows = list(
        (await session.execute(select(Service).order_by(Service.display_name))).scalars()
    )
    return {"services": [ServiceAdminOut.model_validate(r) for r in rows]}


@router.post("", response_model=ServiceAdminOut, status_code=status.HTTP_201_CREATED)
async def create_service(
    payload: ServiceCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ServiceAdminOut:
    admin = await require_admin_row(request, session)
    service = Service(
        slug=payload.slug,
        display_name=payload.display_name,
        description=payload.description,
        kind=ServiceKind(payload.kind),
        public_visible=payload.public_visible,
        expected_interval_seconds=payload.expected_interval_seconds,
        probe_url=payload.probe_url,
        probe_interval_seconds=payload.probe_interval_seconds,
        probe_timeout_seconds=payload.probe_timeout_seconds,
        probe_expected_status=payload.probe_expected_status,
        deepseek_context=payload.deepseek_context,
    )
    session.add(service)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"slug already exists or constraint violated: {exc.orig}",
        ) from exc

    await audit(
        session,
        event="admin.service.created",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={"service_slug": service.slug, "kind": payload.kind},
    )
    await session.commit()
    return ServiceAdminOut.model_validate(service)


async def _get_service_by_slug(session: AsyncSession, slug: str) -> Service:
    row = (
        await session.execute(select(Service).where(Service.slug == slug))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    return row


@router.get("/{slug}")
async def get_service(
    slug: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    await require_admin_row(request, session)
    service = await _get_service_by_slug(session, slug)
    api_keys = list(
        (
            await session.execute(
                select(ApiKey).where(ApiKey.service_id == service.id)
            )
        ).scalars()
    )
    incidents = list(
        (
            await session.execute(
                select(Incident)
                .where(Incident.service_id == service.id)
                .order_by(Incident.started_at.desc())
                .limit(50)
            )
        ).scalars()
    )
    return {
        "service": ServiceAdminOut.model_validate(service),
        "api_keys": [ApiKeyOut.model_validate(k) for k in api_keys],
        "incidents": [IncidentAdminOut.model_validate(i) for i in incidents],
    }


@router.patch("/{slug}")
async def update_service(
    slug: str,
    payload: ServiceUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, ServiceAdminOut]:
    admin = await require_admin_row(request, session)
    service = await _get_service_by_slug(session, slug)

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(service, key, value)
    service.updated_at = datetime.now(timezone.utc)
    session.add(service)

    await audit(
        session,
        event="admin.service.updated",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={"service_slug": slug, "fields": sorted(updates.keys())},
    )
    await session.commit()
    return {"service": ServiceAdminOut.model_validate(service)}


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    slug: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> None:
    admin = await require_admin_row(request, session)
    service = await _get_service_by_slug(session, slug)
    # Hard delete (CASCADE handles api_keys + heartbeats). Audit before delete.
    service_id = service.id
    await session.delete(service)
    await audit(
        session,
        event="admin.service.deleted",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={"service_id": service_id, "service_slug": slug},
    )
    await session.commit()
