"""Tests for GET /api/public/incidents — flat reverse-chronological feed.

Covers:
  1. Private-service incidents are excluded (visibility predicate reuse).
  2. Same-millisecond pagination is stable across the composite cursor.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from aglaea.db import get_session
from aglaea.main import app
from aglaea.models.incidents import Incident, IncidentStatus
from aglaea.models.services import Service, ServiceKind

_SQLITE_DDL = [
    # Minimal `services` table — only the columns the public /incidents route
    # reads. Omits Postgres-only CHECK (slug ~ ...) and BigInteger PK issues by
    # using plain INTEGER PRIMARY KEY (SQLite native rowid autoincrement).
    """
    CREATE TABLE services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        description TEXT,
        kind TEXT NOT NULL,
        public_visible INTEGER NOT NULL DEFAULT 1,
        expected_interval_seconds INTEGER,
        probe_url TEXT,
        probe_interval_seconds INTEGER DEFAULT 60,
        probe_timeout_seconds INTEGER DEFAULT 10,
        probe_expected_status INTEGER DEFAULT 200,
        last_heartbeat_at TEXT,
        last_status TEXT,
        last_subchecks TEXT,
        last_message TEXT,
        deepseek_context TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
    """,
    # Minimal `incidents` table — replaces ARRAY(Text) with TEXT (JSON list)
    # and omits Postgres enum types.
    """
    CREATE TABLE incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL REFERENCES services(id),
        status TEXT NOT NULL DEFAULT 'ongoing',
        lifecycle_state TEXT NOT NULL DEFAULT 'investigating',
        started_at TEXT NOT NULL,
        resolved_at TEXT,
        initial_failure_payload TEXT,
        final_recovery_payload TEXT,
        affected_subchecks TEXT NOT NULL DEFAULT '[]',
        report_state TEXT NOT NULL DEFAULT 'none',
        report_text TEXT,
        report_generated_at TEXT,
        report_generation_count INTEGER NOT NULL DEFAULT 0,
        report_generation_reason TEXT,
        published_text TEXT,
        published_at TEXT,
        published_by INTEGER,
        summary TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
    """,
]


@pytest.fixture
async def db_and_client():
    """Async SQLite in-memory + httpx ASGI client with get_session overridden.

    Uses hand-rolled DDL instead of Base.metadata.create_all to avoid
    Postgres-only constructs (ARRAY type, `~` regex CHECK constraint).
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        for stmt in _SQLITE_DDL:
            await conn.execute(text(stmt))

    session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_session():
        async with session_factory() as s:
            yield s

    app.dependency_overrides[get_session] = _override_get_session
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield session_factory, client
    finally:
        app.dependency_overrides.pop(get_session, None)
        await engine.dispose()


@pytest.mark.asyncio
async def test_incidents_excludes_private_service_incidents(db_and_client) -> None:
    """A service with public_visible=False must NOT contribute incidents to
    the public flat feed — same visibility predicate as the per-service route.
    """
    session_factory, client = db_and_client

    async with session_factory() as s:
        public_svc = Service(
            slug="alpha-public",
            display_name="Alpha Public",
            kind=ServiceKind.push,
            public_visible=True,
            expected_interval_seconds=60,
        )
        private_svc = Service(
            slug="beta-private",
            display_name="Beta Private",
            kind=ServiceKind.push,
            public_visible=False,
            expected_interval_seconds=60,
        )
        s.add_all([public_svc, private_svc])
        await s.flush()

        t0 = datetime(2025, 1, 1, 12, 0, 0, tzinfo=UTC)
        s.add_all(
            [
                Incident(
                    service_id=public_svc.id,
                    status=IncidentStatus.resolved,
                    started_at=t0,
                    affected_subchecks=[],
                ),
                Incident(
                    service_id=private_svc.id,
                    status=IncidentStatus.resolved,
                    started_at=t0,
                    affected_subchecks=[],
                ),
            ]
        )
        await s.commit()

    resp = await client.get("/api/public/incidents")
    assert resp.status_code == 200, resp.text
    body = resp.json()

    slugs = {row["service_slug"] for row in body}
    assert slugs == {"alpha-public"}, f"private incident leaked: {slugs}"
    assert all(row["service_name"] == "Alpha Public" for row in body)


@pytest.mark.asyncio
async def test_incidents_same_millisecond_pagination(db_and_client) -> None:
    """Two incidents with identical started_at must paginate stably via the
    composite `(started_at, id)` cursor — no duplicates, no skips.
    """
    session_factory, client = db_and_client

    async with session_factory() as s:
        svc = Service(
            slug="gamma-public",
            display_name="Gamma Public",
            kind=ServiceKind.push,
            public_visible=True,
            expected_interval_seconds=60,
        )
        s.add(svc)
        await s.flush()

        same_ts = datetime(2025, 6, 1, 9, 0, 0, tzinfo=UTC)
        inc_a = Incident(
            service_id=svc.id,
            status=IncidentStatus.resolved,
            started_at=same_ts,
            affected_subchecks=[],
        )
        inc_b = Incident(
            service_id=svc.id,
            status=IncidentStatus.resolved,
            started_at=same_ts,
            affected_subchecks=[],
        )
        s.add_all([inc_a, inc_b])
        await s.commit()
        id_a, id_b = inc_a.id, inc_b.id

    higher_id = max(id_a, id_b)
    lower_id = min(id_a, id_b)

    # Page 1: limit=1 → the row with the greater id (desc id tie-break).
    resp1 = await client.get("/api/public/incidents", params={"limit": 1})
    assert resp1.status_code == 200, resp1.text
    page1 = resp1.json()
    assert len(page1) == 1
    assert page1[0]["id"] == higher_id

    # Page 2: cursor from page1's last row.
    cursor_ts = page1[0]["started_at"]
    cursor_id = page1[0]["id"]
    resp2 = await client.get(
        "/api/public/incidents",
        params={"limit": 1, "before_ts": cursor_ts, "before_id": cursor_id},
    )
    assert resp2.status_code == 200, resp2.text
    page2 = resp2.json()
    assert len(page2) == 1
    assert page2[0]["id"] == lower_id, "cursor must advance to the OTHER incident"

    # No duplicates, no skips across the two pages.
    seen = {page1[0]["id"], page2[0]["id"]}
    assert seen == {id_a, id_b}
