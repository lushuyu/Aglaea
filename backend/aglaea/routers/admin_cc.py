"""Admin Claude Code metrics + raw PromQL endpoint (Phase 5.2, 5.3).

`/series/{metric}` returns the host_name-dimensioned view.
`/raw-query` accepts admin-supplied PromQL — no confirmation per N15.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.config import HTTPX_DEFAULT_TIMEOUT_SECONDS, get_settings
from aglaea.db import get_session
from aglaea.promql import ADMIN_QUERIES, ALLOWED_ADMIN_METRICS
from aglaea.routers._deps import client_ip, require_admin_row
from aglaea.security.audit import audit

router = APIRouter(prefix="/api/admin/claude-code", tags=["admin-cc"])


async def _query_vm(query: str) -> dict[str, object]:
    settings = get_settings()
    url = f"{settings.vm_url.rstrip('/')}/api/v1/query"
    async with httpx.AsyncClient(timeout=HTTPX_DEFAULT_TIMEOUT_SECONDS) as client:
        response = await client.get(url, params={"query": query})
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"upstream {response.status_code}",
        )
    return dict(response.json())


@router.get("/series/{metric}")
async def admin_series(
    metric: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    await require_admin_row(request, session)
    if metric not in ALLOWED_ADMIN_METRICS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="unknown metric"
        )
    data = await _query_vm(ADMIN_QUERIES[metric])
    return {"metric": metric, "data": data}


@router.get("/raw-query")
async def raw_query(
    request: Request,
    promql: str = Query(min_length=1, max_length=5000),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    admin = await require_admin_row(request, session)
    await audit(
        session,
        event="admin.cc.raw_query",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={"promql": promql[:1000]},
    )
    await session.commit()
    data = await _query_vm(promql)
    return {"promql": promql, "data": data}
