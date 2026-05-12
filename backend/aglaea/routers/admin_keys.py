"""Per-service API key generation + revocation (Phase 3.2, C7).

Plaintext token returned EXACTLY ONCE at generation. argon2id hash stored.
All verify operations elsewhere wrap argon2 in `asyncio.to_thread`.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.db import get_session
from aglaea.models.api_keys import ApiKey
from aglaea.models.services import Service
from aglaea.routers._deps import client_ip, require_admin_row
from aglaea.schemas.service import ApiKeyCreate, ApiKeyCreatedOnce, ApiKeyOut
from aglaea.security.audit import audit
from aglaea.security.bearer import generate_key

router = APIRouter(prefix="/api/admin/services", tags=["admin-keys"])


@router.get("/{service_id}/keys", response_model=list[ApiKeyOut])
async def list_keys(
    service_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> list[ApiKeyOut]:
    await require_admin_row(request, session)
    stmt = (
        select(ApiKey)
        .where(ApiKey.service_id == service_id)
        .order_by(ApiKey.created_at.desc())
    )
    rows = list((await session.execute(stmt)).scalars())
    return [ApiKeyOut.model_validate(r) for r in rows]


@router.post(
    "/{service_id}/keys",
    response_model=ApiKeyCreatedOnce,
    status_code=status.HTTP_201_CREATED,
)
async def create_key(
    service_id: int,
    payload: ApiKeyCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> ApiKeyCreatedOnce:
    admin = await require_admin_row(request, session)
    service = await session.get(Service, service_id)
    if service is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="service not found"
        )

    minted = generate_key()
    row = ApiKey(
        service_id=service.id,
        label=payload.label,
        key_hash=minted.hash,
        key_prefix=minted.prefix,
    )
    session.add(row)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"key label already exists: {exc.orig}",
        ) from exc

    await audit(
        session,
        event="admin.key.created",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={
            "service_id": service.id,
            "service_slug": service.slug,
            "key_id": row.id,
            "key_prefix": row.key_prefix,
            "label": row.label,
        },
    )
    await session.commit()

    return ApiKeyCreatedOnce(
        id=row.id,
        label=row.label,
        key_prefix=row.key_prefix,
        plaintext=minted.plaintext,
    )


@router.delete(
    "/{service_id}/keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_key(
    service_id: int,
    key_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> None:
    admin = await require_admin_row(request, session)
    stmt = select(ApiKey).where(
        ApiKey.id == key_id, ApiKey.service_id == service_id
    )
    row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not found")
    if row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)
        session.add(row)
    await audit(
        session,
        event="admin.key.revoked",
        actor_type="admin",
        actor_id=str(admin.id),
        ip=client_ip(request),
        details={"service_id": service_id, "key_id": key_id, "label": row.label},
    )
    await session.commit()
