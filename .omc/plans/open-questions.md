# Open Questions

## ralplan-aglaea-regenerate-timeline — 2026-05-13

- [ ] Track temporary `alias="focus"` removal as hard follow-up (self-destruct 7 days post-deploy) — Risk 1 mitigation depends on this; without it, the deprecated alias becomes permanent dead code.
- [ ] Confirm heartbeat transition de-dupe window of 30s + cap of 30 is acceptable for incident #1's traffic shape — if user wants more granularity, raise the cap to 60; if less noise, raise window to 60s.
- [ ] Decide whether Phase 2 stretch (synthetic `report.generated` / `report.published` timeline rows) ships in this PR or defers to v0.2 — depends on whether the user wants a true end-to-end story now.
- [ ] Verify Phase 1 prompt-injection regression passes on production DeepSeek model (not just staging) — the unwrapped `== Admin instruction ==` heading is a small but real surface area expansion.
