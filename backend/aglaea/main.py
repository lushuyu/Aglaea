"""FastAPI application + lifespan worker bootstrap.

Lifespan responsibilities:
- Configure JSON logging.
- Spawn worker tasks (incident_detector, pull_prober, report_generator,
  optional self_ping). Each task gets `add_done_callback(_on_worker_died)`
  per AC1.17.
- On shutdown, cancel + await all workers.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import JSONResponse

from aglaea.config import get_settings
from aglaea.logging_config import configure_logging
from aglaea.middleware.rate_limit import RateLimitMiddleware
from aglaea.middleware.request_id import RequestIDMiddleware
from aglaea.routers import (
    admin,
    admin_audit,
    admin_cc,
    admin_incidents,
    admin_keys,
    auth,
    public,
    service_push,
)
from aglaea.workers import start_workers, stop_workers

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(level=settings.log_level)
    log.info("aglaea.startup", extra={"environment": settings.environment})

    tasks = start_workers()
    try:
        yield
    finally:
        await stop_workers(tasks)
        log.info("aglaea.shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="Aglaea",
        version="0.1.0",
        description="Personal SRE platform — public status + admin dashboard.",
        lifespan=lifespan,
    )

    # Middleware order matters: outermost first.
    application.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        session_cookie="aglaea_session",
        same_site="lax",
        https_only=settings.environment == "production",
        max_age=60 * 60 * 24 * 7,
    )
    application.add_middleware(RateLimitMiddleware)
    application.add_middleware(RequestIDMiddleware)

    application.include_router(public.router)
    application.include_router(auth.router)
    application.include_router(service_push.router)
    application.include_router(admin.router)
    application.include_router(admin_keys.router)
    application.include_router(admin_incidents.router)
    application.include_router(admin_cc.router)
    application.include_router(admin_audit.router)

    @application.get("/healthz")
    async def healthz() -> JSONResponse:
        return JSONResponse({"ok": True})

    return application


app = create_app()
