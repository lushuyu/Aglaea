"""Public read API — no auth, allowlist-projected responses (SPEC §6.1, AC5.5).

All responses go through Pydantic models in `aglaea.schemas.public` which are
pinned to the `PUBLIC_FIELDS_*` frozensets at module import time.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.config import HTTPX_DEFAULT_TIMEOUT_SECONDS, get_settings
from aglaea.db import get_session
from aglaea.models.incident_updates import IncidentUpdate
from aglaea.models.incidents import Incident, IncidentLifecycleState
from aglaea.models.services import Service
from aglaea.promql import ALLOWED_PUBLIC_METRICS, PUBLIC_QUERIES
from aglaea.schemas.public import (
    ActiveTimeRatio,
    ClaudeCodeMetrics,
    CommitDataPoint,
    CostDataPoint,
    LocDataPoint,
    ModelTokens,
    PublicClaudeCodeResponse,
    PublicIncidentFeedItem,
    PublicIncidentPublished,
    PublicIncidentSkeleton,
    PublicIncidentUpdate,
    PublicService,
    SessionDataPoint,
    TerminalShare,
    TokenDataPoint,
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


@router.get("/incidents")
async def list_all_incidents(
    limit: int = Query(default=20, ge=1, le=100),
    before_ts: datetime | None = Query(default=None),
    before_id: int | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> list[PublicIncidentFeedItem]:
    """Flat reverse-chronological incident feed across all publicly-visible
    services. Stable composite-key cursor `(started_at DESC, id DESC)` to
    survive same-millisecond ties.

    Visibility predicate `Service.public_visible` is reused from the existing
    per-service `/services/{slug}/incidents` endpoint above — same scope.
    """
    # Both cursor params must be provided together; otherwise ignore cursor.
    use_cursor = before_ts is not None and before_id is not None

    stmt = (
        select(Incident, Service.slug, Service.display_name)
        .join(Service, Service.id == Incident.service_id)
        .where(Service.public_visible)
    )
    if use_cursor:
        # Row-value tuple comparison expressed as a portable OR:
        # (started_at, id) < (before_ts, before_id)
        stmt = stmt.where(
            or_(
                Incident.started_at < before_ts,
                and_(Incident.started_at == before_ts, Incident.id < before_id),
            )
        )
    stmt = stmt.order_by(desc(Incident.started_at), desc(Incident.id)).limit(limit)

    rows = (await session.execute(stmt)).all()
    return [
        PublicIncidentFeedItem(
            id=inc.id,
            service_slug=slug,
            service_name=name,
            status=inc.status.value,
            started_at=inc.started_at,
            resolved_at=inc.resolved_at,
            affected_subchecks=list(inc.affected_subchecks or []),
            published_text=inc.published_text,
            published_at=inc.published_at,
            summary=inc.summary,
        )
        for inc, slug, name in rows
    ]


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
    timeline: list[dict[str, Any]] = []
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


# ── Claude Code analytics aggregator ──────────────────────────────────────


async def _vm_instant(client: httpx.AsyncClient, vm_url: str, query: str) -> list[dict[str, Any]]:
    """Run an instant VM query. Returns empty list on any failure (graceful)."""
    try:
        resp = await client.get(f"{vm_url}/api/v1/query", params={"query": query})
    except httpx.HTTPError:
        return []
    if resp.status_code >= 400:
        return []
    data = resp.json().get("data", {}) or {}
    return data.get("result", []) or []


async def _vm_range(
    client: httpx.AsyncClient,
    vm_url: str,
    query: str,
    start_ts: int,
    end_ts: int,
    step: str,
) -> list[dict[str, Any]]:
    """Run a range VM query. Returns empty list on any failure (graceful)."""
    try:
        resp = await client.get(
            f"{vm_url}/api/v1/query_range",
            params={
                "query": query,
                "start": str(start_ts),
                "end": str(end_ts),
                "step": step,
            },
        )
    except httpx.HTTPError:
        return []
    if resp.status_code >= 400:
        return []
    data = resp.json().get("data", {}) or {}
    return data.get("result", []) or []


def _instant_scalar(result: list[dict[str, Any]]) -> float:
    """First numeric value from an instant-query result, default 0.0."""
    for s in result:
        v = s.get("value")
        if isinstance(v, list) and len(v) >= 2:
            try:
                return float(v[1])
            except (TypeError, ValueError):
                return 0.0
    return 0.0


def _range_flatten_ts(result: list[dict[str, Any]]) -> dict[float, float]:
    """Matrix → ts→summed-value (collapse multiple series at same timestamp)."""
    out: dict[float, float] = {}
    for s in result:
        values = s.get("values", []) or []
        for tv in values:
            if not isinstance(tv, list) or len(tv) < 2:
                continue
            try:
                ts = float(tv[0])
                val = float(tv[1])
            except (TypeError, ValueError):
                continue
            out[ts] = out.get(ts, 0.0) + val
    return out


def _range_flatten_daily(result: list[dict[str, Any]]) -> dict[str, float]:
    """Matrix → ISO-date→summed-value."""
    out: dict[str, float] = {}
    for s in result:
        values = s.get("values", []) or []
        for tv in values:
            if not isinstance(tv, list) or len(tv) < 2:
                continue
            try:
                ts = float(tv[0])
                val = float(tv[1])
            except (TypeError, ValueError):
                continue
            d = datetime.fromtimestamp(ts, UTC).date().isoformat()
            out[d] = out.get(d, 0.0) + val
    return out


@router.get("/claude-code", response_model=PublicClaudeCodeResponse)
async def public_claude_code() -> PublicClaudeCodeResponse:
    """Aggregated 30-day Claude Code metrics for the public homepage panel.

    Fans out ~13 VM queries in parallel (range + instant), shapes the responses
    into the panel's expected structure. Empty arrays / zero scalars on no-data
    so the panel renders gracefully even before any device emits.
    """
    settings = get_settings()
    vm_url = settings.vm_url.rstrip("/")
    # Round UP to the next hour: rounding down would put end_ts before any data
    # point that arrived inside the current hour, causing increase()'s 1d
    # lookback window to miss it. Future-end is safe — VM has no data there.
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    now_ts = int(now.timestamp())
    day_ago_30_ts = int((now - timedelta(days=30)).timestamp())

    async with httpx.AsyncClient(timeout=HTTPX_DEFAULT_TIMEOUT_SECONDS) as client:
        (
            token_total_result,
            cost_trend_result,
            sessions_daily_result,
            commits_daily_result,
            loc_added_result,
            loc_removed_result,
            heatmap_result,
            token_by_model_result,
            cache_read_result,
            cache_create_result,
            active_cli_result,
            active_user_result,
            terminal_share_result,
        ) = await asyncio.gather(
            _vm_range(
                client,
                vm_url,
                'sum(increase(claude_code_token_usage_tokens_total{type=~"input|output"}[1d]))',
                day_ago_30_ts,
                now_ts,
                "1d",
            ),
            _vm_range(
                client,
                vm_url,
                "sum(increase(claude_code_cost_usage_USD_total[1d]))",
                day_ago_30_ts,
                now_ts,
                "1d",
            ),
            _vm_range(
                client,
                vm_url,
                "sum(increase(claude_code_session_count_total[1d]))",
                day_ago_30_ts,
                now_ts,
                "1d",
            ),
            _vm_range(
                client,
                vm_url,
                "sum(increase(claude_code_commit_count_total[1d]))",
                day_ago_30_ts,
                now_ts,
                "1d",
            ),
            _vm_range(
                client,
                vm_url,
                'sum(increase(claude_code_lines_of_code_count_total{type="added"}[1d]))',
                day_ago_30_ts,
                now_ts,
                "1d",
            ),
            _vm_range(
                client,
                vm_url,
                'sum(increase(claude_code_lines_of_code_count_total{type="removed"}[1d]))',
                day_ago_30_ts,
                now_ts,
                "1d",
            ),
            _vm_range(
                client,
                vm_url,
                'sum(increase(claude_code_active_time_seconds_total{type="user"}[1h]))',
                day_ago_30_ts,
                now_ts,
                "1h",
            ),
            _vm_instant(
                client,
                vm_url,
                "sum by (model) (increase("
                'claude_code_token_usage_tokens_total{type=~"input|output"}[30d]'
                "))",
            ),
            _vm_instant(
                client,
                vm_url,
                'sum(increase(claude_code_token_usage_tokens_total{type="cacheRead"}[7d]))',
            ),
            _vm_instant(
                client,
                vm_url,
                'sum(increase(claude_code_token_usage_tokens_total{type="cacheCreation"}[7d]))',
            ),
            _vm_instant(
                client,
                vm_url,
                'sum(increase(claude_code_active_time_seconds_total{type="cli"}[7d]))',
            ),
            _vm_instant(
                client,
                vm_url,
                'sum(increase(claude_code_active_time_seconds_total{type="user"}[7d]))',
            ),
            _vm_instant(
                client,
                vm_url,
                "sum by (terminal_type) (increase(claude_code_session_count_total[30d]))",
            ),
        )

    # Token total time series (30 daily points)
    token_pts = _range_flatten_ts(token_total_result)
    token_total_30d = [
        TokenDataPoint(ts=datetime.fromtimestamp(t, UTC).isoformat(), value=v)
        for t, v in sorted(token_pts.items())
    ]

    # Cost trend time series (30 daily points, USD)
    cost_pts = _range_flatten_ts(cost_trend_result)
    cost_trend_30d = [
        CostDataPoint(ts=datetime.fromtimestamp(t, UTC).isoformat(), usd=v)
        for t, v in sorted(cost_pts.items())
    ]

    # Sessions daily
    sessions_map = _range_flatten_daily(sessions_daily_result)
    sessions_daily_30d = [
        SessionDataPoint(date=d, count=int(round(v))) for d, v in sorted(sessions_map.items())
    ]

    # Commits daily
    commits_map = _range_flatten_daily(commits_daily_result)
    commits_daily_30d = [
        CommitDataPoint(date=d, count=int(round(v))) for d, v in sorted(commits_map.items())
    ]

    # LOC daily — merge added + removed by date
    added_map = _range_flatten_daily(loc_added_result)
    removed_map = _range_flatten_daily(loc_removed_result)
    all_loc_dates = sorted(set(added_map) | set(removed_map))
    loc_daily_30d = [
        LocDataPoint(
            date=d,
            added=int(round(added_map.get(d, 0.0))),
            removed=int(round(removed_map.get(d, 0.0))),
        )
        for d in all_loc_dates
    ]

    # Token by model (instant total over 30d, grouped by `model` label)
    token_by_model: list[ModelTokens] = []
    for s in token_by_model_result:
        metric = s.get("metric") or {}
        model_name = str(metric.get("model", "unknown"))
        v = s.get("value")
        val = 0.0
        if isinstance(v, list) and len(v) >= 2:
            try:
                val = float(v[1])
            except (TypeError, ValueError):
                val = 0.0
        token_by_model.append(ModelTokens(model=model_name, value=val))

    # Cache hit rate (7d): cacheRead / (cacheRead + cacheCreation)
    cache_read_val = _instant_scalar(cache_read_result)
    cache_create_val = _instant_scalar(cache_create_result)
    denom = cache_read_val + cache_create_val
    cache_hit_rate_7d = cache_read_val / denom if denom > 0 else 0.0

    # Active time ratio (7d): raw seconds for cli vs user; panel computes ratio
    active_time_ratio_7d = ActiveTimeRatio(
        cli=_instant_scalar(active_cli_result),
        user=_instant_scalar(active_user_result),
    )

    # Active hours heatmap (7 days-of-week × 24 hours-of-day, last 30d)
    heatmap_grid: list[list[float]] = [[0.0] * 24 for _ in range(7)]
    for s in heatmap_result:
        values = s.get("values", []) or []
        for tv in values:
            if not isinstance(tv, list) or len(tv) < 2:
                continue
            try:
                ts = float(tv[0])
                val = float(tv[1])
            except (TypeError, ValueError):
                continue
            dt = datetime.fromtimestamp(ts, UTC)
            heatmap_grid[dt.weekday()][dt.hour] += val

    # Terminal type share (30d session count by terminal_type label)
    terminal_type_share: list[TerminalShare] = []
    for s in terminal_share_result:
        metric = s.get("metric") or {}
        ttype = str(metric.get("terminal_type", "unknown"))
        v = s.get("value")
        val = 0.0
        if isinstance(v, list) and len(v) >= 2:
            try:
                val = float(v[1])
            except (TypeError, ValueError):
                val = 0.0
        terminal_type_share.append(TerminalShare(type=ttype, value=val))

    return PublicClaudeCodeResponse(
        metrics=ClaudeCodeMetrics(
            token_total_30d=token_total_30d,
            cost_trend_30d=cost_trend_30d,
            token_by_model=token_by_model,
            cache_hit_rate_7d=cache_hit_rate_7d,
            active_time_ratio_7d=active_time_ratio_7d,
            sessions_daily_30d=sessions_daily_30d,
            commits_daily_30d=commits_daily_30d,
            loc_daily_30d=loc_daily_30d,
            active_hours_heatmap=heatmap_grid,
            terminal_type_share=terminal_type_share,
        )
    )
