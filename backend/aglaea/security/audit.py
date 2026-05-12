"""Audit-log helper (C19, AC1.16, AC5.8).

`audit(...)` writes a row to `audit_log` and auto-injects `request_id` from
the contextvar. Callers pass `event`, `actor_type`, `actor_id`, `ip`, and
any extra `details`.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.middleware.request_id import current_request_id
from aglaea.models.audit import AuditLog

log = logging.getLogger(__name__)


async def audit(
    session: AsyncSession,
    *,
    event: str,
    actor_type: str,
    actor_id: str | None = None,
    ip: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Append a row to `audit_log` with the current request_id injected."""
    payload: dict[str, Any] = dict(details or {})
    payload.setdefault("request_id", current_request_id())
    row = AuditLog(
        actor_type=actor_type,
        actor_id=actor_id,
        event=event,
        ip=ip,
        details=payload,
    )
    session.add(row)
    # We intentionally do NOT commit here — caller controls transaction scope.
    # For worker/contextual writes use `db.session_scope()` which commits on
    # exit.
    log.info("audit.write", extra={"event": event, "actor_type": actor_type})
