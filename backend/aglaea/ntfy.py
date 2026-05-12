"""Outbound ntfy alerts.

Aglaea is purely additive (C10) — ntfy is used here only for:
- Worker death alerts (Principle 3 / AC1.6 / AC1.17).
- >10 auth failures/min from single IP (AC1.16, SPEC §9.4).
- Report-generation hard cap reached (SPEC §7.3).

If `NTFY_TOPIC_URL` is unset, alerts are silently logged at WARN instead of
posted — Aglaea must never break the host's existing ntfy / healthchecks.io
pipeline.
"""

from __future__ import annotations

import logging

import httpx

from aglaea.config import HTTPX_DEFAULT_TIMEOUT_SECONDS, get_settings

log = logging.getLogger(__name__)


async def send_alert(title: str, message: str, priority: str = "default") -> None:
    """POST an ntfy alert. Never raises — logs WARN on failure."""
    settings = get_settings()
    url = settings.ntfy_topic_url
    if not url:
        log.warning(
            "ntfy.skipped",
            extra={"title": title, "preview": message[:200]},
        )
        return

    headers = {
        "Title": title,
        "Priority": priority,
        "Tags": "aglaea",
    }
    try:
        async with httpx.AsyncClient(timeout=HTTPX_DEFAULT_TIMEOUT_SECONDS) as client:
            response = await client.post(url, content=message.encode("utf-8"), headers=headers)
            if response.status_code >= 400:
                log.warning(
                    "ntfy.bad_status",
                    extra={"status": response.status_code, "title": title},
                )
    except (httpx.HTTPError, OSError) as exc:
        log.warning("ntfy.failed", extra={"error": str(exc), "title": title})
