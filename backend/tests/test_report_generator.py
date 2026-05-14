"""Report generator unit tests (AC1.11, AC1.12)."""

from __future__ import annotations

import pytest

from aglaea.workers.report_generator import ReportTrigger, run_trigger


def test_enum_priority_ordering_t3_t25_t0_t1_t2() -> None:
    assert ReportTrigger.FINAL.value > ReportTrigger.NEW_WORST.value
    assert ReportTrigger.NEW_WORST.value > ReportTrigger.INITIAL.value
    assert ReportTrigger.INITIAL.value > ReportTrigger.SUBCHECK_CHANGED.value
    assert ReportTrigger.SUBCHECK_CHANGED.value > ReportTrigger.PERIODIC.value


def test_enum_pick_chooses_highest_priority() -> None:
    chosen = ReportTrigger.pick(
        [ReportTrigger.PERIODIC, ReportTrigger.INITIAL, ReportTrigger.FINAL]
    )
    assert chosen is ReportTrigger.FINAL


def test_enum_pick_empty_returns_none() -> None:
    assert ReportTrigger.pick([]) is None


def test_enum_has_five_members() -> None:
    members = list(ReportTrigger)
    assert len(members) == 5
    names = {m.name for m in members}
    assert names == {"INITIAL", "SUBCHECK_CHANGED", "PERIODIC", "FINAL", "NEW_WORST"}


@pytest.mark.asyncio
async def test_t1_runtime_assert_fires() -> None:
    """AC1.12 strengthened: running with SUBCHECK_CHANGED must raise."""
    with pytest.raises(AssertionError, match="T1 dropped"):
        await run_trigger(None, incident_id=1, reason=ReportTrigger.SUBCHECK_CHANGED)  # type: ignore[arg-type]
