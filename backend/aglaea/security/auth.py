"""GitHub OAuth admin auth + allowlist + bootstrap (C20, AC1.8, AC1.9, AC5.7, AC5.10).

Flow:
1. `/api/auth/github/login` issues OAuth redirect.
2. `/api/auth/github/callback` exchanges code, fetches user, runs
   `enforce_admin_allowlist(github_login)` — fails closed with 403 + audit.
3. If `BOOTSTRAP_GITHUB_LOGIN == github_login` and no row (active OR
   soft-deleted) exists, idempotent INSERT creates the row.
4. Session cookie set: HttpOnly + SameSite=Lax + Secure.

Soft-deleted rows DO NOT satisfy the allowlist (`deleted_at IS NULL`
constraint) — recovery is via `UPDATE admin_users SET deleted_at = NULL`
or restart (env-var-triggered idempotent INSERT recreates row if absent).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.config import get_settings
from aglaea.models.admin import AdminUser
from aglaea.security.audit import audit

log = logging.getLogger(__name__)


class AllowlistRejection(HTTPException):
    """Generic friendly error — no info leak per AC5.10."""

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not authorized to access the admin area.",
        )


async def find_active_admin(
    session: AsyncSession, *, github_login: str
) -> AdminUser | None:
    """Return the live row matching `github_login`, or None if absent / deleted."""
    stmt = select(AdminUser).where(
        AdminUser.github_login == github_login,
        AdminUser.deleted_at.is_(None),
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def find_any_row_by_login(
    session: AsyncSession, *, github_login: str
) -> AdminUser | None:
    """Return any row (including soft-deleted) for bootstrap idempotency."""
    stmt = select(AdminUser).where(AdminUser.github_login == github_login)
    return (await session.execute(stmt)).scalar_one_or_none()


async def maybe_bootstrap_admin(
    session: AsyncSession,
    *,
    github_login: str,
    github_id: int,
    ip: str | None = None,
) -> AdminUser | None:
    """Idempotent bootstrap INSERT (C20, AC1.9).

    Inserts a new admin_users row IFF:
    - `BOOTSTRAP_GITHUB_LOGIN` matches incoming login, AND
    - No existing row (active OR soft-deleted) matches the login.

    Already-present row (any state) → no-op, returns the row (if active) or
    None (if soft-deleted — caller still rejects).
    """
    settings = get_settings()
    bootstrap_login = settings.bootstrap_github_login.strip()
    if not bootstrap_login or bootstrap_login != github_login:
        return None

    existing = await find_any_row_by_login(session, github_login=github_login)
    if existing is not None:
        if existing.deleted_at is not None:
            log.info(
                "auth.bootstrap.skipped_soft_deleted",
                extra={"github_login": github_login},
            )
            return None
        return existing

    new_row = AdminUser(
        github_login=github_login,
        github_id=github_id,
        last_login_at=datetime.now(timezone.utc),
    )
    session.add(new_row)
    await session.flush()
    await audit(
        session,
        event="auth.bootstrap.admin_created",
        actor_type="admin",
        actor_id=str(new_row.id),
        ip=ip,
        details={"github_login": github_login, "github_id": github_id},
    )
    return new_row


async def enforce_admin_allowlist(
    session: AsyncSession,
    *,
    github_login: str,
    github_id: int,
    ip: str | None = None,
) -> AdminUser:
    """Allowlist gate. Tries bootstrap first; rejects soft-deleted; rejects
    non-allowlisted with generic 403 + audit.
    """
    bootstrapped = await maybe_bootstrap_admin(
        session, github_login=github_login, github_id=github_id, ip=ip
    )
    if bootstrapped is not None:
        return bootstrapped

    row = await find_active_admin(session, github_login=github_login)
    if row is None:
        await audit(
            session,
            event="auth.allowlist_rejected",
            actor_type="admin",
            ip=ip,
            details={"github_login": github_login, "github_id": github_id},
        )
        await session.commit()
        raise AllowlistRejection()

    row.last_login_at = datetime.now(timezone.utc)
    await audit(
        session,
        event="auth.login",
        actor_type="admin",
        actor_id=str(row.id),
        ip=ip,
        details={"github_login": github_login},
    )
    return row
