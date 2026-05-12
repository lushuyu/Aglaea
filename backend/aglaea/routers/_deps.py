"""Shared FastAPI dependencies — admin auth gate, IP extraction."""

from __future__ import annotations

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.models.admin import AdminUser
from aglaea.routers.auth import SESSION_USER_KEY
from aglaea.security.auth import find_active_admin


def client_ip(request: Request) -> str | None:
    """Return the request client IP. Trusts Starlette's proxy-aware client."""
    return request.client.host if request.client else None


async def require_admin(request: Request) -> dict[str, object]:
    """Header-only guard — verifies a session payload exists. Returns the payload.

    The admin-row liveness check (`deleted_at IS NULL`) happens via
    `require_admin_row` for endpoints that need the DB row.
    """
    payload = request.session.get(SESSION_USER_KEY)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="not signed in"
        )
    return dict(payload)


async def require_admin_row(
    request: Request,
    session: AsyncSession,
) -> AdminUser:
    """Resolve the admin row + re-check liveness. Raises 403 if soft-deleted."""
    payload = await require_admin(request)
    login = str(payload.get("github_login", ""))
    if not login:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="malformed session"
        )
    admin = await find_active_admin(session, github_login=login)
    if admin is None:
        request.session.pop(SESSION_USER_KEY, None)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="not authorized"
        )
    return admin
