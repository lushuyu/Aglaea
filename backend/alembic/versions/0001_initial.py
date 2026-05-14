"""Initial schema — services, api_keys, heartbeat_events (hypertable), incidents,
admin_users (soft-delete), audit_log.

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-13

TimescaleDB-specific DDL (hypertable, compression, retention) appears ONLY inside
raw-SQL blocks tagged `# === TimescaleDB-specific (manual) ===` per AC1.3.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE TYPE service_kind AS ENUM ('push', 'pull');")
    op.execute("CREATE TYPE incident_status AS ENUM ('ongoing', 'resolved');")
    op.execute(
        "CREATE TYPE incident_report_state AS ENUM ('none', 'draft', 'published', 'rejected');"
    )

    op.create_table(
        "admin_users",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("github_login", sa.Text(), nullable=False, unique=True),
        sa.Column("github_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("last_login_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    op.create_table(
        "services",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.Text(), nullable=False, unique=True),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "kind",
            postgresql.ENUM("push", "pull", name="service_kind", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "public_visible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("TRUE"),
        ),
        sa.Column("expected_interval_seconds", sa.Integer(), nullable=True),
        sa.Column("probe_url", sa.Text(), nullable=True),
        sa.Column(
            "probe_interval_seconds",
            sa.Integer(),
            nullable=True,
            server_default=sa.text("60"),
        ),
        sa.Column(
            "probe_timeout_seconds",
            sa.Integer(),
            nullable=True,
            server_default=sa.text("10"),
        ),
        sa.Column(
            "probe_expected_status",
            sa.Integer(),
            nullable=True,
            server_default=sa.text("200"),
        ),
        sa.Column("last_heartbeat_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_status", sa.Text(), nullable=True),
        sa.Column("last_subchecks", postgresql.JSONB(), nullable=True),
        sa.Column("last_message", sa.Text(), nullable=True),
        sa.Column("deepseek_context", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.CheckConstraint(
            "slug ~ '^[a-z][a-z0-9-]{1,30}$'",
            name="slug_format_check",
        ),
        sa.CheckConstraint(
            "kind != 'push' OR expected_interval_seconds IS NOT NULL",
            name="push_must_have_interval",
        ),
        sa.CheckConstraint(
            "kind != 'pull' OR probe_url IS NOT NULL",
            name="pull_must_have_url",
        ),
    )
    op.execute("CREATE INDEX idx_services_public ON services(public_visible) WHERE public_visible;")

    op.create_table(
        "api_keys",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "service_id",
            sa.BigInteger(),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("key_hash", sa.Text(), nullable=False),
        sa.Column("key_prefix", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("last_used_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.UniqueConstraint("service_id", "label", name="uq_api_keys_service_label"),
    )
    op.execute("CREATE INDEX idx_api_keys_active ON api_keys(service_id) WHERE revoked_at IS NULL;")
    op.execute("CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);")

    op.create_table(
        "heartbeat_events",
        sa.Column("ts", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "service_id",
            sa.BigInteger(),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("subchecks", postgresql.JSONB(), nullable=True),
        sa.Column("metrics", postgresql.JSONB(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("client_ts", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("service_id", "ts", name="pk_heartbeat_events"),
    )

    op.create_table(
        "incidents",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "service_id",
            sa.BigInteger(),
            sa.ForeignKey("services.id"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM("ongoing", "resolved", name="incident_status", create_type=False),
            nullable=False,
            server_default=sa.text("'ongoing'::incident_status"),
        ),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("initial_failure_payload", postgresql.JSONB(), nullable=True),
        sa.Column("final_recovery_payload", postgresql.JSONB(), nullable=True),
        sa.Column(
            "affected_subchecks",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column(
            "report_state",
            postgresql.ENUM(
                "none",
                "draft",
                "published",
                "rejected",
                name="incident_report_state",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'none'::incident_report_state"),
        ),
        sa.Column("report_text", sa.Text(), nullable=True),
        sa.Column("report_generated_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "report_generation_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("report_generation_reason", sa.Text(), nullable=True),
        sa.Column("published_text", sa.Text(), nullable=True),
        sa.Column("published_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "published_by",
            sa.BigInteger(),
            sa.ForeignKey("admin_users.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.execute(
        "CREATE INDEX idx_incidents_service_started ON incidents(service_id, started_at DESC);"
    )
    op.execute(
        "CREATE INDEX idx_incidents_ongoing "
        "ON incidents(service_id, started_at DESC) "
        "WHERE status = 'ongoing';"
    )
    op.execute(
        "CREATE INDEX idx_incidents_published "
        "ON incidents(service_id, started_at DESC) "
        "WHERE published_at IS NOT NULL;"
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "ts",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("actor_type", sa.Text(), nullable=False),
        sa.Column("actor_id", sa.Text(), nullable=True),
        sa.Column("event", sa.Text(), nullable=False),
        sa.Column("ip", postgresql.INET(), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=True),
    )
    op.execute("CREATE INDEX idx_audit_log_ts ON audit_log(ts DESC);")
    op.execute("CREATE INDEX idx_audit_log_event ON audit_log(event, ts DESC);")

    # === TimescaleDB-specific (manual) ===
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb;")
    op.execute("SELECT create_hypertable('heartbeat_events', 'ts');")
    op.execute(
        "ALTER TABLE heartbeat_events SET ("
        "timescaledb.compress, "
        "timescaledb.compress_segmentby='service_id'"
        ");"
    )
    op.execute("SELECT add_compression_policy('heartbeat_events', INTERVAL '7 days');")
    op.execute("SELECT add_retention_policy('heartbeat_events', INTERVAL '30 days');")


def downgrade() -> None:
    # === TimescaleDB-specific (manual) — reverse order ===
    op.execute("SELECT remove_retention_policy('heartbeat_events', if_exists => true);")
    op.execute("SELECT remove_compression_policy('heartbeat_events', if_exists => true);")
    op.execute("ALTER TABLE heartbeat_events SET (timescaledb.compress = false);")
    op.execute("DROP TABLE IF EXISTS heartbeat_events CASCADE;")

    op.execute("DROP INDEX IF EXISTS idx_audit_log_event;")
    op.execute("DROP INDEX IF EXISTS idx_audit_log_ts;")
    op.drop_table("audit_log")

    op.execute("DROP INDEX IF EXISTS idx_incidents_published;")
    op.execute("DROP INDEX IF EXISTS idx_incidents_ongoing;")
    op.execute("DROP INDEX IF EXISTS idx_incidents_service_started;")
    op.drop_table("incidents")

    op.execute("DROP INDEX IF EXISTS idx_api_keys_prefix;")
    op.execute("DROP INDEX IF EXISTS idx_api_keys_active;")
    op.drop_table("api_keys")

    op.execute("DROP INDEX IF EXISTS idx_services_public;")
    op.drop_table("services")

    op.drop_table("admin_users")

    op.execute("DROP TYPE IF EXISTS incident_report_state;")
    op.execute("DROP TYPE IF EXISTS incident_status;")
    op.execute("DROP TYPE IF EXISTS service_kind;")
