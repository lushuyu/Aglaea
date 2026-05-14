"""Pull prober cert-helper tests (AC1.7, AC1.15)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from aglaea.config import CERT_WARN_DAYS
from aglaea.workers.pull_prober import _cert_days_remaining


def _format_not_after(when: datetime) -> str:
    return when.strftime("%b %d %H:%M:%S %Y GMT")


def test_days_remaining_far_future() -> None:
    now = datetime(2026, 5, 13, 12, 0, 0, tzinfo=UTC)
    cert = {"notAfter": _format_not_after(now + timedelta(days=365))}
    assert (_cert_days_remaining(cert, now) or 0) >= 360


def test_days_remaining_inside_warn_window() -> None:
    now = datetime(2026, 5, 13, 12, 0, 0, tzinfo=UTC)
    cert = {"notAfter": _format_not_after(now + timedelta(days=CERT_WARN_DAYS - 3))}
    days = _cert_days_remaining(cert, now)
    assert days is not None
    assert 0 <= days < CERT_WARN_DAYS


def test_days_remaining_expired_returns_negative() -> None:
    now = datetime(2026, 5, 13, 12, 0, 0, tzinfo=UTC)
    cert = {"notAfter": _format_not_after(now - timedelta(days=1))}
    days = _cert_days_remaining(cert, now)
    assert days is not None
    assert days < 0


def test_days_remaining_malformed_returns_none() -> None:
    now = datetime(2026, 5, 13, 12, 0, 0, tzinfo=UTC)
    assert _cert_days_remaining({}, now) is None
    assert _cert_days_remaining({"notAfter": "not-a-date"}, now) is None


def test_cert_warn_days_constant_is_14() -> None:
    # AC1.15 / C42 — global constant, NOT in .env.
    assert CERT_WARN_DAYS == 14
