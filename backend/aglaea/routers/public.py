"""Public read API — no auth, allowlist-projected responses (SPEC §6.1, AC5.5).

All responses go through Pydantic models in `aglaea.schemas.public` which are
pinned to the `PUBLIC_FIELDS_*` frozensets at module import time.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.config import HTTPX_DEFAULT_TIMEOUT_SECONDS, get_settings
from aglaea.db import get_session
from aglaea.models.incidents import Incident, IncidentStatus
from aglaea.models.services import Service
from aglaea.promql import ALLOWED_PUBLIC_METRICS, PUBLIC_QUERIES
from aglaea.schemas.public import (
    PublicIncidentPublished,
    PublicIncidentSkeleton,
    PublicService,
)

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/services", response_model=list[PublicService])
async def list_services(
    session: AsyncSession = Depends(get_session),
) -> list[PublicService]:
    stmt = (
        select(Service)
        .where(Service.public_visible)
        .order_by(
            # Worst-first: down > degraded > ok > NULL.
            (Service.last_status == "down").desc(),
            (Service.last_status == "degraded").desc(),
            Service.display_name.asc(),
        )
    )
    rows = list((await session.execute(stmt)).scalars())
    return [PublicService.model_validate(r) for r in rows]


@router.get("/services/{slug}", response_model=PublicService)
async def get_service(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> PublicService:
    stmt = select(Service).where(Service.slug == slug, Service.public_visible)
    row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    return PublicService.model_validate(row)


@router.get(
    "/services/{slug}/incidents",
    response_model=list[PublicIncidentPublished | PublicIncidentSkeleton],
)
async def list_incidents(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> list[PublicIncidentPublished | PublicIncidentSkeleton]:
    service_stmt = select(Service).where(Service.slug == slug, Service.public_visible)
    service = (await session.execute(service_stmt)).scalar_one_or_none()
    if service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")

    inc_stmt = (
        select(Incident)
        .where(Incident.service_id == service.id)
        .order_by(desc(Incident.started_at))
        .limit(50)
    )
    incidents = list((await session.execute(inc_stmt)).scalars())
    out: list[PublicIncidentPublished | PublicIncidentSkeleton] = []
    for inc in incidents:
        if inc.published_text and inc.published_at:
            out.append(
                PublicIncidentPublished(
                    id=inc.id,
                    service_slug=service.slug,
                    status=inc.status.value,  # type: ignore[arg-type]
                    started_at=inc.started_at,
                    resolved_at=inc.resolved_at,
                    affected_subchecks=list(inc.affected_subchecks or []),
                    published_text=inc.published_text,
                    published_at=inc.published_at,
                )
            )
        else:
            out.append(
                PublicIncidentSkeleton(
                    id=inc.id,
                    service_slug=service.slug,
                    status=inc.status.value,  # type: ignore[arg-type]
                    started_at=inc.started_at,
                    resolved_at=inc.resolved_at,
                    affected_subchecks=list(inc.affected_subchecks or []),
                )
            )
    return out


@router.get(
    "/services/{slug}/incidents/{incident_id}",
    response_model=PublicIncidentPublished | PublicIncidentSkeleton,
)
async def get_incident(
    slug: str,
    incident_id: int,
    session: AsyncSession = Depends(get_session),
) -> PublicIncidentPublished | PublicIncidentSkeleton:
    stmt = (
        select(Incident, Service)
        .join(Service, Service.id == Incident.service_id)
        .where(
            Service.slug == slug,
            Service.public_visible,
            Incident.id == incident_id,
        )
    )
    row = (await session.execute(stmt)).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    incident, service = row
    if incident.published_text and incident.published_at:
        return PublicIncidentPublished(
            id=incident.id,
            service_slug=service.slug,
            status=incident.status.value,  # type: ignore[arg-type]
            started_at=incident.started_at,
            resolved_at=incident.resolved_at,
            affected_subchecks=list(incident.affected_subchecks or []),
            published_text=incident.published_text,
            published_at=incident.published_at,
        )
    return PublicIncidentSkeleton(
        id=incident.id,
        service_slug=service.slug,
        status=incident.status.value,  # type: ignore[arg-type]
        started_at=incident.started_at,
        resolved_at=incident.resolved_at,
        affected_subchecks=list(incident.affected_subchecks or []),
    )


@router.get("/claude-code/series/{metric}")
async def claude_code_series(metric: str) -> dict[str, object]:
    """Pre-defined aggregated metric. `host.name` already stripped (C8)."""
    if metric not in ALLOWED_PUBLIC_METRICS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="unknown metric"
        )
    query = PUBLIC_QUERIES[metric]
    settings = get_settings()
    url = f"{settings.vm_url.rstrip('/')}/api/v1/query"
    async with httpx.AsyncClient(timeout=HTTPX_DEFAULT_TIMEOUT_SECONDS) as client:
        response = await client.get(url, params={"query": query})
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"upstream {response.status_code}",
        )
    return {"metric": metric, "data": response.json()}
