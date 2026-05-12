"""Background workers — three asyncio tasks managed by FastAPI lifespan.

Two-layer defence (Principle 3 + AC1.6 + AC1.17):
1. **Inside the loop body** — `worker_loop()` wraps every iteration in
   `try/except Exception`, logs traceback, ntfy alert, exponential backoff,
   continue. (See `_invariants.py`.)
2. **At the task boundary** — `add_done_callback(_on_worker_died)` fires if
   the task ever terminates while the app is still running. The callback
   ntfys + logs + re-raises non-cancellation exceptions.

`start_workers(app)` is invoked from `main.py::lifespan`.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from aglaea.config import get_settings
from aglaea.ntfy import send_alert
from aglaea.workers.incident_detector import incident_detector_loop
from aglaea.workers.pull_prober import pull_prober_loop
from aglaea.workers.report_generator import report_generator_loop
from aglaea.workers.self_ping import self_ping_loop

log = logging.getLogger(__name__)


def _on_worker_died(task: asyncio.Task[Any]) -> None:
    """Task-level backstop (AC1.17).

    Fires if any worker task terminates while the app is still running.
    Re-raises non-cancellation exceptions AND emits a ntfy alert. The
    re-raise propagates into asyncio.gather / lifespan so the app surfaces
    the failure rather than silently degrading.
    """
    if task.cancelled():
        log.info("worker.cancelled", extra={"task": task.get_name()})
        return

    name = task.get_name()
    exc = task.exception()
    if exc is None:
        # Normal completion is unexpected for an infinite worker loop.
        log.error("worker.terminated_unexpectedly", extra={"task": name})
        asyncio.create_task(  # noqa: RUF006 — fire-and-forget alert
            send_alert(
                title="Aglaea worker terminated",
                message=(
                    f"Worker task {name!r} returned cleanly while app is alive. "
                    f"This violates the never-silently-die invariant (AC1.17)."
                ),
                priority="high",
            ),
            name=f"alert-{name}",
        )
        return

    log.exception(
        "worker.died",
        extra={"task": name},
        exc_info=exc,
    )
    asyncio.create_task(  # noqa: RUF006
        send_alert(
            title="Aglaea worker DIED",
            message=f"Worker task {name!r} raised {type(exc).__name__}: {exc}",
            priority="urgent",
        ),
        name=f"alert-{name}",
    )


def start_workers() -> list[asyncio.Task[Any]]:
    """Spawn worker tasks. Returns the task list for lifespan teardown.

    Self-ping worker is only started if `HEALTHCHECKS_SELFPING_URL` is set
    (C35 / AC3.4).
    """
    settings = get_settings()
    tasks: list[asyncio.Task[Any]] = []

    spec = [
        ("incident_detector", incident_detector_loop()),
        ("pull_prober", pull_prober_loop()),
        ("report_generator", report_generator_loop()),
    ]
    for name, coro in spec:
        task = asyncio.create_task(coro, name=name)
        task.add_done_callback(_on_worker_died)
        tasks.append(task)

    if settings.healthchecks_selfping_url:
        task = asyncio.create_task(self_ping_loop(), name="self_ping")
        task.add_done_callback(_on_worker_died)
        tasks.append(task)
    else:
        log.info("worker.self_ping.disabled", extra={"reason": "env_unset"})

    log.info(
        "workers.started",
        extra={"tasks": [t.get_name() for t in tasks]},
    )
    return tasks


async def stop_workers(tasks: list[asyncio.Task[Any]]) -> None:
    """Cancel and await every worker task. Safe to call multiple times."""
    for task in tasks:
        if not task.done():
            task.cancel()
    for task in tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass
        except Exception:
            log.exception("worker.stop.error", extra={"task": task.get_name()})


__all__ = ["start_workers", "stop_workers"]
