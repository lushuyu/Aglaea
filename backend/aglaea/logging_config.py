"""JSON-structured logging via python-json-logger (C33, AC3.3).

Required fields per record: `timestamp`, `level`, `logger`, `message`,
`request_id`. `request_id` is injected from contextvar by RequestIDMiddleware
and is `null` for non-request contexts (worker ticks).

Idempotent — `configure_logging()` is safe to call more than once.
"""

from __future__ import annotations

import logging
import sys
from typing import Any

from pythonjsonlogger import jsonlogger

from aglaea.middleware.request_id import current_request_id

_CONFIGURED = False


class _RequestIdFilter(logging.Filter):
    """Injects `request_id` (from contextvar) onto every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = current_request_id() or None
        return True


class _AglaeaJsonFormatter(jsonlogger.JsonFormatter):  # type: ignore[misc]
    """python-json-logger formatter that always emits required keys."""

    def add_fields(
        self,
        log_record: dict[str, Any],
        record: logging.LogRecord,
        message_dict: dict[str, Any],
    ) -> None:
        super().add_fields(log_record, record, message_dict)
        # Mandatory fields per C33.
        log_record["timestamp"] = self.formatTime(record, self.datefmt)
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        log_record["message"] = record.getMessage()
        log_record["request_id"] = getattr(record, "request_id", None)


def configure_logging(level: str = "INFO") -> None:
    """Configure root + Aglaea loggers with the JSON formatter. Idempotent."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        _AglaeaJsonFormatter(
            fmt="%(timestamp)s %(level)s %(logger)s %(message)s %(request_id)s"
        )
    )
    handler.addFilter(_RequestIdFilter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

    # Quiet noisy third-party loggers; emit at WARN+.
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    _CONFIGURED = True
