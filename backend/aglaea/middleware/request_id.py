"""RequestIDMiddleware — X-Request-ID propagation (C34, AC1.10, AC3.3).

Generates or passes through `X-Request-ID`. Preferred order:
1. Incoming header value if present and well-formed (1..64 chars, [A-Za-z0-9_-]).
2. Fallback to `uuid4().hex[:16]`.

Propagates into:
- Every log line for that request scope (via contextvar + logging filter).
- Response header `X-Request-ID`.
- `audit_log.details.request_id` (callers read `current_request_id()`).
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Awaitable, Callable
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_REQUEST_ID_VAR: ContextVar[str | None] = ContextVar("request_id", default=None)
_HEADER_NAME = "X-Request-ID"
_VALID = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")


def current_request_id() -> str | None:
    """Read the current request id from the contextvar."""
    return _REQUEST_ID_VAR.get()


def _generate() -> str:
    return uuid.uuid4().hex[:16]


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Sets request_id contextvar + X-Request-ID response header for every req."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        incoming = request.headers.get(_HEADER_NAME, "")
        rid = incoming if _VALID.match(incoming) else _generate()
        token = _REQUEST_ID_VAR.set(rid)
        try:
            response = await call_next(request)
        finally:
            _REQUEST_ID_VAR.reset(token)
        response.headers[_HEADER_NAME] = rid
        return response
