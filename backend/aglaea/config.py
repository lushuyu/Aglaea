"""Application configuration — pydantic-settings driven, env-loaded.

The global constant `CERT_WARN_DAYS = 14` (C42) lives here, NOT in `.env` —
it is a code-level decision, not a deployment-time knob.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Final

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Global cert-expiry warning threshold (C42, deep-interview Round 6 Q4).
CERT_WARN_DAYS: Final[int] = 14

# Hard cap for incident report regenerations per AC1.* / SPEC §7.3.
REPORT_GENERATION_HARD_CAP: Final[int] = 12

# Heartbeat body size cap per Critic W2 (Phase 3.3).
HEARTBEAT_BODY_MAX_BYTES: Final[int] = 64 * 1024

# Timestamp window per AC1.5 / C17.
TIMESTAMP_WINDOW_SECONDS: Final[int] = 300

# Rate-limit per token per SPEC §9.4.
RATE_LIMIT_PER_TOKEN_PER_MIN: Final[int] = 60

# Auth-fail alert threshold per AC1.16 / SPEC §9.4.
AUTH_FAIL_ALERT_THRESHOLD_PER_MIN: Final[int] = 10

# Cerydra subcheck keys — locked per C28 (deep-interview Round 4 Q3).
CERYDRA_SUBCHECK_KEYS: Final[frozenset[str]] = frozenset(
    {"jin10", "cls", "wscn", "moomoo", "deepseek", "discord"}
)

# Worker tick intervals.
INCIDENT_DETECTOR_TICK_SECONDS: Final[int] = 10
SELF_PING_INTERVAL_SECONDS: Final[int] = 60
REPORT_PERIODIC_INTERVAL_SECONDS: Final[int] = 30 * 60  # T2 cadence

# I/O timeouts (Principle 3).
HTTPX_DEFAULT_TIMEOUT_SECONDS: Final[float] = 30.0
DEEPSEEK_TIMEOUT_SECONDS: Final[float] = 60.0
STATEMENT_TIMEOUT_MS: Final[int] = 5_000


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables.

    `.env.example` ships in repo with empty values. Real `.env` is gitignored
    and chmod 600 per AC3.5.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://aglaea:changeme@postgres:5432/aglaea",
        description="SQLAlchemy async URL using asyncpg driver.",
    )

    # VictoriaMetrics
    vm_url: str = Field(
        default="http://victoriametrics:8428",
        description="Read-only PromQL endpoint.",
    )

    # External services
    deepseek_api_key: str = Field(default="", description="DeepSeek V4 Pro key.")
    deepseek_base_url: str = Field(
        default="https://api.deepseek.com",
        description="DeepSeek HTTP base URL.",
    )

    # OAuth
    github_oauth_client_id: str = Field(default="")
    github_oauth_client_secret: str = Field(default="")
    github_oauth_redirect_uri: str = Field(
        default="https://status.lushuyu.site/api/auth/github/callback",
    )

    # Session
    session_secret: str = Field(default="dev-session-secret-change-me")

    # Self-ping (env-gated, C35 / AC3.4)
    healthchecks_selfping_url: str = Field(default="")

    # Bootstrap allowlist (C20 / AC1.9)
    bootstrap_github_login: str = Field(default="")

    # ntfy outbound (alerts for worker death, rate-limit storms)
    ntfy_topic_url: str = Field(default="")

    # Observability
    log_level: str = Field(default="INFO")
    environment: str = Field(default="production")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings instance — env reads happen exactly once."""
    return Settings()
