"""Heartbeat ingest — POST /api/v1/heartbeat (AC1.5, AC1.16, Critic W2).

Order of operations:
1. Body-size cap 64 KB (Critic W2) → 413 if exceeded.
2. Pydantic strict validation (extras → 400).
3. `X-Aglaea-Timestamp` ±300s window (AC1.5, AC5.11) → 401 + audit.
4. Bearer-token verify (argon2id in `asyncio.to_thread`) → 401 + audit on miss.
5. INSERT heartbeat_events + UPDATE services.last_*.
6. 202 Accepted.

All auth failures emit audit_log + count toward the AC1.16 rate-limit storm
threshold.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.config import HEARTBEAT_BODY_MAX_BYTES
from aglaea.db import get_session
from aglaea.models.heartbeat import HeartbeatEvent
from aglaea.models.services import Service
from aglaea.routers._deps import client_ip
from aglaea.schemas.heartbeat import HeartbeatIn
from aglaea.security.audit import audit
from aglaea.security.bearer import verify_bearer
from aglaea.security.timestamp import HEADER_NAME as TS_HEADER
from aglaea.security.timestamp import verify_x_aglaea_timestamp

router = APIRouter(prefix="/api/v1", tags=["service-push"])
log = logging.getLogger(__name__)


@router.post("/heartbeat", status_code=status.HTTP_202_ACCEPTED)
async def post_heartbeat(
    request: Request,
    authorization: str | None = Header(default=None),
    x_aglaea_timestamp: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    ip = client_ip(request)

    raw_body = await request.body()
    if len(raw_body) > HEARTBEAT_BODY_MAX_BYTES:
        await audit(
            session,
            event="auth.body_too_large",
            actor_type="service",
            ip=ip,
            details={"bytes": len(raw_body), "cap": HEARTBEAT_BODY_MAX_BYTES},
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"heartbeat body exceeds {HEARTBEAT_BODY_MAX_BYTES} bytes",
        )

    await verify_x_aglaea_timestamp(
        x_aglaea_timestamp, session=session, ip=ip
    )

    if not authorization or not authorization.startswith("Bearer "):
        await audit(
            session,
            event="auth.bearer_missing",
            actor_type="service",
            ip=ip,
            details={"reason": "no_authorization_header"},
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="bearer required"
        )

    plaintext = authorization.removeprefix("Bearer ").strip()
    api_key = await verify_bearer(session, plaintext_token=plaintext)
    if api_key is None:
        await audit(
            session,
            event="auth.bearer_invalid",
            actor_type="service",
            ip=ip,
            details={"prefix": plaintext[:8] if plaintext else None},
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid bearer"
        )

    try:
        parsed_body = json.loads(raw_body or b"{}")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid JSON: {exc}",
        ) from exc

    try:
        payload = HeartbeatIn.model_validate(parsed_body)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.errors(),
        ) from exc

    service_stmt = select(Service).where(Service.id == api_key.service_id)
    service = (await session.execute(service_stmt)).scalar_one_or_none()
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="service missing"
        )

    now = datetime.now(timezone.utc)
    subchecks_dict = (
        {k: v.model_dump(exclude_none=True) for k, v in payload.subchecks.items()}
        if payload.subchecks
        else None
    )
    event = HeartbeatEvent(
        ts=now,
        service_id=service.id,
        status=payload.status,
        subchecks=subchecks_dict,
        metrics=payload.metrics,
        message=payload.message,
        source="push",
        client_ts=payload.client_ts,
    )
    session.add(event)

    service.last_heartbeat_at = now
    service.last_status = payload.status
    service.last_subchecks = subchecks_dict
    service.last_message = payload.message
    session.add(service)

    await audit(
        session,
        event="heartbeat.accepted",
        actor_type="service",
        actor_id=str(service.id),
        ip=ip,
        details={"service_slug": service.slug, "status": payload.status},
    )
    await session.commit()

    log.info(
        "heartbeat.ingested",
        extra={"service_slug": service.slug, "status": payload.status},
    )
    return {"accepted": True, "service_slug": service.slug}
