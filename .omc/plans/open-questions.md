# Open Questions

## ralplan-aglaea-regenerate-timeline — 2026-05-13

- [ ] Track temporary `alias="focus"` removal as hard follow-up (self-destruct 7 days post-deploy) — Risk 1 mitigation depends on this; without it, the deprecated alias becomes permanent dead code.
- [ ] Confirm heartbeat transition de-dupe window of 30s + cap of 30 is acceptable for incident #1's traffic shape — if user wants more granularity, raise the cap to 60; if less noise, raise window to 60s.
- [ ] Decide whether Phase 2 stretch (synthetic `report.generated` / `report.published` timeline rows) ships in this PR or defers to v0.2 — depends on whether the user wants a true end-to-end story now.
- [ ] Verify Phase 1 prompt-injection regression passes on production DeepSeek model (not just staging) — the unwrapped `== Admin instruction ==` heading is a small but real surface area expansion.

## ralplan-aglaea-ux-polish — 2026-05-14 (iteration 2)

- [x] **CLOSED iteration 2 (A2 defended).** C3 `summary` vs `report_text` duality — dual-write retained for one release cycle, drop-by trigger explicit: drop in v0.1.2 once all `incidents.summary IS NOT NULL` and one full deploy cycle of green telemetry passes. Rollback path is the §P2a `downgrade()` preservation INSERT.
- [ ] Decide Active Incidents card data source — new `GET /api/public/services/{slug}/incidents/active` endpoint (plan's pick, simpler) vs. client-side derivation from existing `getPublicServices` filtering on `last_status != "ok"` (zero backend change but couples to per-service status, not per-incident lifecycle_state). Critic may push back.
- [x] **CLOSED iteration 2 (M2 hard-gate).** `@tanstack/react-table` styling parity now a hard PASS/FAIL gate at §Phase 4 P4-pre-flight, not an open question. Outcome path explicit: PASS → AC §5.6 ships; FAIL → AC §5.6 moves to v0.1.1, other Phase 4 items proceed.
- [ ] Confirm `heartbeats[]` + `similar[]` arrays on admin incident endpoint stay deferred (inherit predecessor plan's OOS) — they remain `[]` as in `admin_incidents.py:62-63`. If Architect wants to re-open, a separate plan is required.
- [ ] Confirm inline `fontSize` audit scope in Phase 1 covers ALL values in {12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30} — spec AC §1.3 names {12, 13, 14} explicitly but spec AC §1.2 mandates proportional bump on the full scale; executor should not silently narrow the audit scope.
- [ ] Decide whether to introduce a Timescale continuous aggregate (`services_uptime_daily` materialized view) for the 30-day uptime query — Risk 4 mitigation defers this unless the `EXPLAIN ANALYZE` benchmark exceeds 200ms per service; pre-deploy benchmark on cerydra is the gate.
- [ ] **NEW iteration 2 (B3 follow-up).** `backend/scripts/replay_preserved_summaries.py` ownership — planner defers to v0.1.2 conditional on rollback ever being exercised in production. Architect/Critic to accept the deferral OR demand a runbook .md in this plan instead.
