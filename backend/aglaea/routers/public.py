"""Public read API — no auth, allowlist-projected responses (SPEC §6.1, AC5.5).

All responses go through Pydantic models in `aglaea.schemas.public` which are
pinned to the `PUBLIC_FIELDS_*` frozensets at module import time.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.config import HTTPX_DEFAULT_TIMEOUT_SECONDS, get_settings
from aglaea.db import get_session
from aglaea.models.incident_updates import IncidentUpdate
from aglaea.models.incidents import Incident, IncidentLifecycleState
from aglaea.models.services import Service
from aglaea.promql import ALLOWED_PUBLIC_METRICS, PUBLIC_QUERIES
from aglaea.schemas.public import (
    PublicIncidentPublished,
    PublicIncidentSkeleton,
    PublicIncidentUpdate,
    PublicService,
)
from aglaea.services.timeline import build_public_timeline

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/services")
async def list_services(
    session: AsyncSession = Depends(get_session),
) -> dict[str, list[PublicService]]:
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
    return {"services": [PublicService.model_validate(r) for r in rows]}


@router.get("/services/{slug}")
async def get_service(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, PublicService]:
    stmt = select(Service).where(Service.slug == slug, Service.public_visible)
    row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    return {"service": PublicService.model_validate(row)}


@router.get("/services/{slug}/incidents")
async def list_incidents(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, list[PublicIncidentPublished | PublicIncidentSkeleton]]:
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
                    status=inc.status.value,
                    started_at=inc.started_at,
                    resolved_at=inc.resolved_at,
                    affected_subchecks=list(inc.affected_subchecks or []),
                    published_text=inc.published_text,
                    published_at=inc.published_at,
                    summary=inc.summary,
                    updates=[],
                )
            )
        else:
            out.append(
                PublicIncidentSkeleton(
                    id=inc.id,
                    service_slug=service.slug,
                    status=inc.status.value,
                    started_at=inc.started_at,
                    resolved_at=inc.resolved_at,
                    affected_subchecks=list(inc.affected_subchecks or []),
                )
            )
    return {"incidents": out}


@router.get("/services/{slug}/incidents/active")
async def list_active_incidents(
    slug: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, list[PublicIncidentPublished | PublicIncidentSkeleton]]:
    service_stmt = select(Service).where(Service.slug == slug, Service.public_visible)
    service = (await session.execute(service_stmt)).scalar_one_or_none()
    if service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")

    inc_stmt = (
        select(Incident)
        .where(
            Incident.service_id == service.id,
            Incident.lifecycle_state != IncidentLifecycleState.resolved,
        )
        .order_by(desc(Incident.started_at))
        .limit(10)
    )
    incidents = list((await session.execute(inc_stmt)).scalars())
    out: list[PublicIncidentPublished | PublicIncidentSkeleton] = []
    for inc in incidents:
        if inc.published_text and inc.published_at:
            # Load updates filtered to public-allowlist fields.
            upd_stmt = (
                select(IncidentUpdate)
                .where(IncidentUpdate.incident_id == inc.id)
                .order_by(IncidentUpdate.t.asc())
            )
            upd_rows = list((await session.execute(upd_stmt)).scalars())
            updates = [PublicIncidentUpdate.model_validate(u) for u in upd_rows]
            out.append(
                PublicIncidentPublished(
                    id=inc.id,
                    service_slug=service.slug,
                    status=inc.status.value,
                    started_at=inc.started_at,
                    resolved_at=inc.resolved_at,
                    affected_subchecks=list(inc.affected_subchecks or []),
                    published_text=inc.published_text,
                    published_at=inc.published_at,
                    summary=inc.summary,
                    updates=updates,
                )
            )
        else:
            out.append(
                PublicIncidentSkeleton(
                    id=inc.id,
                    service_slug=service.slug,
                    status=inc.status.value,
                    started_at=inc.started_at,
                    resolved_at=inc.resolved_at,
                    affected_subchecks=list(inc.affected_subchecks or []),
                )
            )
    return {"incidents": out}


@router.get("/services/{slug}/incidents/{incident_id}")
async def get_incident(
    slug: str,
    incident_id: int,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
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
    # CR-6 Path A: public timeline appears IFF the incident is published
    # (`published_text IS NOT NULL AND published_at IS NOT NULL`). Skeleton
    # responses keep `timeline: []` so PUBLIC_FIELDS_INCIDENT_SKELETON stays
    # unchanged for v0.1.
    timeline: list[dict[str, object]] = []
    if incident.published_text and incident.published_at:
        # Load updates filtered to public-allowlist fields.
        upd_stmt = (
            select(IncidentUpdate)
            .where(IncidentUpdate.incident_id == incident.id)
            .order_by(IncidentUpdate.t.asc())
        )
        upd_rows = list((await session.execute(upd_stmt)).scalars())
        updates = [PublicIncidentUpdate.model_validate(u) for u in upd_rows]
        inc_payload: PublicIncidentPublished | PublicIncidentSkeleton = PublicIncidentPublished(
            id=incident.id,
            service_slug=service.slug,
            status=incident.status.value,
            started_at=incident.started_at,
            resolved_at=incident.resolved_at,
            affected_subchecks=list(incident.affected_subchecks or []),
            published_text=incident.published_text,
            published_at=incident.published_at,
            summary=incident.summary,
            updates=updates,
        )
        timeline = list(await build_public_timeline(session, incident))
    else:
        inc_payload = PublicIncidentSkeleton(
            id=incident.id,
            service_slug=service.slug,
            status=incident.status.value,
            started_at=incident.started_at,
            resolved_at=incident.resolved_at,
            affected_subchecks=list(incident.affected_subchecks or []),
        )
    return {"incident": inc_payload, "timeline": timeline, "similar": []}


@router.get("/services/{slug}/uptime")
async def get_service_uptime(
    slug: str,
    days: int = Query(default=30, ge=1, le=90),
    session: AsyncSession = Depends(get_session),
) -> dict[str, list[dict[str, str]]]:
    service_stmt = select(Service).where(Service.slug == slug, Service.public_visible)
    service = (await session.execute(service_stmt)).scalar_one_or_none()
    if service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")

    rank_map = {1: "down", 2: "degraded", 3: "ok"}

    sql = text(
        """
        SELECT
          date_trunc('day', ts AT TIME ZONE 'UTC')::date AS day,
          MIN(
            CASE status
              WHEN 'down' THEN 1
              WHEN 'degraded' THEN 2
              WHEN 'ok' THEN 3
              ELSE 4
            END
          ) AS worst_status_rank
        FROM heartbeat_events
        WHERE service_id = :service_id
          AND ts >= (now() AT TIME ZONE 'UTC')::date - (:days - 1) * INTERVAL '1 day'
        GROUP BY date_trunc('day', ts AT TIME ZONE 'UTC')::date
        ORDER BY day ASC
        """
    )
    result = await session.execute(sql, {"service_id": service.id, "days": days})
    rows = result.fetchall()

    # Build a lookup: date string -> status
    by_date: dict[str, str] = {}
    for row in rows:
        day_str = row.day.isoformat()
        rank = row.worst_status_rank
        by_date[day_str] = rank_map.get(rank, "unknown")

    # Generate full date range (oldest → newest)
    import datetime

    today_utc = datetime.datetime.now(datetime.UTC).date()
    start = today_utc - datetime.timedelta(days=days - 1)
    output: list[dict[str, str]] = []
    for i in range(days):
        d = (start + datetime.timedelta(days=i)).isoformat()
        output.append({"date": d, "status": by_date.get(d, "unknown")})

    return {"days": output}


@router.get("/claude-code/series/{metric}")
async def claude_code_series(metric: str) -> dict[str, object]:
    """Pre-defined aggregated metric. `host.name` already stripped (C8)."""
    if metric not in ALLOWED_PUBLIC_METRICS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown metric")
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
