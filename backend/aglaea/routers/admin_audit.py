"""Admin audit-log query endpoint (Phase 5.2)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.db import get_session
from aglaea.models.audit import AuditLog
from aglaea.routers._deps import require_admin_row

router = APIRouter(prefix="/api/admin/audit-log", tags=["admin-audit"])


@router.get("")
async def list_audit(
    request: Request,
    session: AsyncSession = Depends(get_session),
    event: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> dict[str, Any]:
    await require_admin_row(request, session)
    stmt = select(AuditLog).order_by(desc(AuditLog.ts)).limit(limit)
    if event:
        stmt = stmt.where(AuditLog.event == event)
    if since:
        stmt = stmt.where(AuditLog.ts >= since)
    rows = list((await session.execute(stmt)).scalars())
    entries = [
        {
            "t": r.ts.isoformat() if r.ts else None,
            "actor_type": r.actor_type,
            "actor": str(r.actor_id) if r.actor_id is not None else "",
            "event": r.event,
            "ip": r.ip or "",
            "details": r.details or {},
        }
        for r in rows
    ]
    return {"entries": entries, "total": len(entries)}
