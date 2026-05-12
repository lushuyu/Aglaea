"""Hardcoded PromQL constants per SPEC §6.1 / §6.3.

Public queries wrap with `sum without (host_name) (...)` (C8) so the
`host.name` dimension is aggregated away before reaching the public API.

Admin queries retain `host_name` for per-device drilldown.
"""

from __future__ import annotations

from typing import Final


def _public(q: str) -> str:
    """Wrap an admin query in `sum without (host_name)` for the public surface."""
    return f"sum without (host_name) ({q})"


# Source admin queries (with host_name dimension intact).
ADMIN_QUERIES: Final[dict[str, str]] = {
    "token-total": "sum by (model) (rate(claude_code_tokens_total[7d]))",
    "token-by-model": "sum by (model) (rate(claude_code_tokens_total[7d]))",
    "cost-trend": "sum by (host_name) (rate(claude_code_cost_usd_total[30d]))",
    "cache-hit-rate": (
        "sum(rate(claude_code_cache_hits_total[7d])) / "
        "sum(rate(claude_code_cache_requests_total[7d]))"
    ),
    "active-time-ratio": (
        "sum(rate(claude_code_active_seconds_total[7d])) / "
        "sum(rate(claude_code_cli_seconds_total[7d]))"
    ),
    "sessions-daily": "sum by (host_name) (claude_code_sessions_total)",
    "commits-daily": "sum by (host_name) (rate(claude_code_commits_total[1d]))",
    "loc-daily": "sum by (host_name) (rate(claude_code_loc_total[1d]))",
    "active-hours-heatmap": (
        "sum by (hour, weekday) (rate(claude_code_active_seconds_total[30d]))"
    ),
    "terminal-type-share": "sum by (terminal) (claude_code_sessions_total)",
}

# Public-facing projection — host_name aggregated away.
PUBLIC_QUERIES: Final[dict[str, str]] = {
    name: _public(query) for name, query in ADMIN_QUERIES.items()
}

ALLOWED_PUBLIC_METRICS: Final[frozenset[str]] = frozenset(PUBLIC_QUERIES.keys())
ALLOWED_ADMIN_METRICS: Final[frozenset[str]] = frozenset(ADMIN_QUERIES.keys())
