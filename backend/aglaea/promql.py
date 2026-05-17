"""Hardcoded PromQL constants per SPEC §6.1 / §6.3.

Public queries wrap with `sum without (host_name) (...)` (C8) so the
`host.name` dimension is aggregated away before reaching the public API.
Admin queries retain `host_name` for per-device drilldown.

Metric names follow the Claude Code SDK's OTel emission, with the
prometheusremotewrite exporter's name mangling:
  `claude_code.<group>.<name>` (with unit `<u>`) → `claude_code_<group>_<name>_<u>_total`

Verified real metric names in VM as of 2026-05-17:
  - claude_code_token_usage_tokens_total
      labels: model, type=input|output|cacheRead|cacheCreation, effort,
      query_source, terminal_type, session_id, …
  - claude_code_cost_usage_USD_total          (labels: model, effort, …)
  - claude_code_session_count_total           (labels: start_type, …)
  - claude_code_active_time_seconds_total     (labels: type=cli|user, …)
  - claude_code_commit_count_total            (emitted on git commits)
  - claude_code_lines_of_code_count_total     (labels: type=added|removed)

The public surface drops `host_name` via the `_public()` wrapper. With the
Aglaea-side otelcol PII processors, neither user.email nor user.account_uuid
ever reach VM in the first place — they are stripped at the collector.
"""

from __future__ import annotations

from typing import Final


def _public(q: str) -> str:
    """Wrap an admin query in `sum without (host_name)` for the public surface.

    Note: as of 2026-05-17 the Claude Code SDK does not emit `host_name` as a
    label — it lives in OTel resource attributes but the PRW translation drops
    it. The wrapper is kept for forward-compatibility and SPEC §6.3 contract.
    """
    return f"sum without (host_name) ({q})"


# Source admin queries (with host_name dimension intact when present).
ADMIN_QUERIES: Final[dict[str, str]] = {
    # ── 7-day totals / rates ─────────────────────────────────────────────
    "token-total": (
        'sum(increase(claude_code_token_usage_tokens_total{type=~"input|output"}[7d]))'
    ),
    "token-by-model": (
        'sum by (model) (increase(claude_code_token_usage_tokens_total{type=~"input|output"}[7d]))'
    ),
    "cost-trend": "sum(increase(claude_code_cost_usage_USD_total[7d]))",
    "cache-hit-rate": (
        'sum(increase(claude_code_token_usage_tokens_total{type="cacheRead"}[7d])) '
        "/ clamp_min("
        '  sum(increase(claude_code_token_usage_tokens_total{type="cacheRead"}[7d])) '
        '  + sum(increase(claude_code_token_usage_tokens_total{type="cacheCreation"}[7d])),'
        "  1"
        ")"
    ),
    "active-time-ratio": (
        'sum(increase(claude_code_active_time_seconds_total{type="user"}[7d])) '
        "/ clamp_min("
        '  sum(increase(claude_code_active_time_seconds_total{type="cli"}[7d])), 1)'
    ),
    "sessions-daily": "sum(increase(claude_code_session_count_total[1d]))",
    "commits-daily": "sum(increase(claude_code_commit_count_total[1d]))",
    "loc-daily": "sum(increase(claude_code_lines_of_code_count_total[1d]))",
    "active-hours-heatmap": ("sum(increase(claude_code_active_time_seconds_total[30d]))"),
    "terminal-type-share": (
        "sum by (terminal_type) (increase(claude_code_session_count_total[30d]))"
    ),
}

# Public-facing projection — host_name aggregated away (no-op today since SDK
# doesn't emit host_name as a label, but the wrapper is preserved per C8).
PUBLIC_QUERIES: Final[dict[str, str]] = {
    name: _public(query) for name, query in ADMIN_QUERIES.items()
}

ALLOWED_PUBLIC_METRICS: Final[frozenset[str]] = frozenset(PUBLIC_QUERIES.keys())
ALLOWED_ADMIN_METRICS: Final[frozenset[str]] = frozenset(ADMIN_QUERIES.keys())
