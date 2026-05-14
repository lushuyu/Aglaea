"""Incident updates table + lifecycle_state + summary columns.

Adds the two-layer incident model:
  - incidents.summary (TEXT, nullable)
  - incidents.lifecycle_state (ENUM: investigating|identified|monitoring|resolved)
  - incident_updates table (append-only timeline)
  - incident_update_kind ENUM

Downgrade preserves data into audit_log before dropping (blocker B3 fix).

Revision ID: 0002_incident_updates
Revises: 0001_initial
Create Date: 2026-05-14
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002_incident_updates"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- New ENUM types ---
    op.execute(
        "CREATE TYPE incident_lifecycle_state AS ENUM "
        "('investigating', 'identified', 'monitoring', 'resolved');"
    )
    op.execute(
        "CREATE TYPE incident_update_kind AS ENUM ('state_transition', 'summary_update', 'manual');"
    )

    # --- New columns on incidents ---
    op.add_column("incidents", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column(
        "incidents",
        sa.Column(
            "lifecycle_state",
            postgresql.ENUM(
                "investigating",
                "identified",
                "monitoring",
                "resolved",
                name="incident_lifecycle_state",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'investigating'::incident_lifecycle_state"),
        ),
    )

    # --- New table: incident_updates ---
    op.create_table(
        "incident_updates",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "incident_id",
            sa.BigInteger(),
            sa.ForeignKey("incidents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "t",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "kind",
            postgresql.ENUM(
                "state_transition",
                "summary_update",
                "manual",
                name="incident_update_kind",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("status_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column(
            "author_id",
            sa.BigInteger(),
            sa.ForeignKey("admin_users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("audit_event_id", sa.BigInteger(), nullable=True),
    )
    op.execute("CREATE INDEX ix_incident_updates_incident_t ON incident_updates (incident_id, t);")


def downgrade() -> None:
    # Preserve incident data into audit_log BEFORE dropping anything (blocker B3).
    op.execute("""
        INSERT INTO audit_log (event, details, actor_type, ts)
        SELECT
          'rollback.incident_summary_preserved',
          jsonb_build_object(
            'incident_id', i.id,
            'summary', i.summary,
            'lifecycle_state', i.lifecycle_state::text,
            'updates', COALESCE(
              (SELECT jsonb_agg(
                jsonb_build_object(
                  't', u.t,
                  'kind', u.kind::text,
                  'text', u.text,
                  'status_snapshot', u.status_snapshot,
                  'author_id', u.author_id
                ) ORDER BY u.t ASC
              ) FROM incident_updates u WHERE u.incident_id = i.id),
              '[]'::jsonb
            )
          ),
          'system',
          now()
        FROM incidents i
        WHERE i.summary IS NOT NULL
           OR EXISTS (SELECT 1 FROM incident_updates u WHERE u.incident_id = i.id)
    """)

    op.drop_index("ix_incident_updates_incident_t", table_name="incident_updates")
    op.drop_table("incident_updates")
    op.execute("DROP TYPE incident_update_kind")
    op.drop_column("incidents", "lifecycle_state")
    op.drop_column("incidents", "summary")
    op.execute("DROP TYPE incident_lifecycle_state")
