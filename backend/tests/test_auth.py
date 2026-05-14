"""Admin OAuth + allowlist + bootstrap tests (AC1.8, AC1.9, AC5.7, AC5.10)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from aglaea.security.auth import AllowlistRejection

# ---------------------------------------------------------------------------
# Minimal in-memory SQLite session fixture for AC1.8 / AC1.9 DB tests
# ---------------------------------------------------------------------------


@pytest.fixture
async def async_session():
    """Async SQLite in-memory session — no external DB required."""
    # Ensure all model tables are registered on Base.metadata by importing them.
    import aglaea.models.admin  # noqa: F401
    import aglaea.models.audit  # noqa: F401
    from aglaea.models.base import Base

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session_factory() as session:
        yield session

    await engine.dispose()


@pytest.mark.asyncio
async def test_allowlist_rejection_is_generic_403() -> None:
    """AC5.10 — non-allowlist login returns generic friendly error, no info leak."""
    exc = AllowlistRejection()
    assert exc.status_code == 403
    # Message must NOT reference the specific github_login or admin_users
    # table — that would leak info about who IS allowed.
    assert "github" not in str(exc.detail).lower()
    assert "admin_users" not in str(exc.detail).lower()
    assert "authorized" in str(exc.detail).lower()


def test_bootstrap_env_default_is_lushuyu() -> None:
    """C20 — BOOTSTRAP_GITHUB_LOGIN drives the idempotent INSERT trigger."""
    from aglaea.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    assert settings.bootstrap_github_login == "lushuyu"


@pytest.mark.asyncio
async def test_soft_deleted_admin_row_rejects_signin(async_session: AsyncSession) -> None:
    """AC1.8: a soft-deleted admin_users row MUST NOT satisfy the OAuth allowlist check."""
    from aglaea.models.admin import AdminUser
    from aglaea.security.auth import find_active_admin

    active = AdminUser(github_login="active_user", github_id=1)
    deleted = AdminUser(
        github_login="deleted_user",
        github_id=2,
        deleted_at=datetime.now(UTC),
    )
    async_session.add(active)
    async_session.add(deleted)
    await async_session.commit()

    found_active = await find_active_admin(async_session, github_login="active_user")
    found_deleted = await find_active_admin(async_session, github_login="deleted_user")

    assert found_active is not None and found_active.github_login == "active_user"
    assert found_deleted is None, "Soft-deleted admin row must NOT satisfy allowlist"


@pytest.mark.asyncio
async def test_bootstrap_does_not_insert_duplicate(async_session: AsyncSession) -> None:
    """AC1.9: when admin_users already has a matching row, bootstrap is a no-op."""
    from sqlalchemy import func, select

    from aglaea.models.admin import AdminUser
    from aglaea.security.auth import maybe_bootstrap_admin

    # Seed the bootstrap login already present
    existing = AdminUser(github_login="lushuyu", github_id=100)
    async_session.add(existing)
    await async_session.commit()

    # Trigger bootstrap with the same login — should be a no-op
    await maybe_bootstrap_admin(async_session, github_login="lushuyu", github_id=100)
    await async_session.commit()

    count_q = await async_session.execute(
        select(func.count()).select_from(AdminUser).where(AdminUser.github_login == "lushuyu")
    )
    count = count_q.scalar_one()
    assert count == 1, f"Bootstrap MUST be idempotent — found {count} rows for github_login=lushuyu"
