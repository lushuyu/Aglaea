# Deep Interview Spec: Claude Code Panel — Range Control + Drop Half-Finished

## Metadata
- Interview ID: cc-range-2026-05-17
- Rounds: 1 (early exit on user request — 继续)
- Final Ambiguity Score: ~25% (Goal clear after Round 1 brush-on-bar decision; remaining ambiguity on minor UX/cache details — judgement call)
- Type: brownfield
- Generated: 2026-05-17T08:25Z
- Threshold: 20% (user requested early termination; proceeding with judgement on remaining gaps)
- Status: BELOW_THRESHOLD_EARLY_EXIT (user-authorized)

## Topology

| Component | Status | Description | Coverage Note |
|-----------|--------|-------------|---------------|
| active-time-and-heatmap | active | Drop `active_time_ratio_7d` + `active_hours_heatmap` (both half-finished without proper SDK signals) | Removed from backend + schema + visibility allowlist + frontend |
| backend-range-params | active | `/api/public/claude-code` accepts `?start_ms=` / `?end_ms=`; returns `timeline` (always all-time, for brush) + `stats` (sub-range aggregates) | Existing field shape mostly preserved; two new fields added |
| frontend-range-control | active | Token daily bar chart with `<Brush>` as the range selector, plus chips 7d/30d/90d/All | New dep: `recharts`. Range state in ClaudeCodePanel. |
| panel-state-propagation | active | All sub-charts/stats consume the selected start/end via props; React Query cache key includes range so selection changes trigger refetch | Custom charts stay (LineChart/BarChart/Donut/Sparkline/StackedBars). Only new chart is the recharts bar-with-brush. |

## Goal

Replace the panel's hardcoded 30-day window with a user-driven range. Token usage is shown as a daily bar chart whose Brush handles double as the range selector; preset chips (7d / 30d / 90d / All) provide quick jumps. All other charts and scalar stats subscribe to the same range. Heatmap and active-time numbers are removed entirely — no half-finished views.

## Constraints

- recharts is the only new chart dep; existing custom components stay
- Brush must work on touch (mobile)
- `start_ms` / `end_ms` are millisecond UNIX timestamps; defaults to last 30d if omitted (back-compat)
- "All time" preset = earliest backfilled data point in VM (today: 2026-04-16; query VM lazily on mount to discover it)
- Backend rounds end_ms up to next hour (existing fix) regardless of input
- Public visibility allowlist updated to drop heatmap/active_time fields, add `timeline` if shape diverges

## Non-Goals

- Calendar-style date picker (rejected — user picked brush UX)
- Backfill of `claude_code_active_time_seconds_total` (rejected — would be half-finished)
- Heatmap (rejected — depends on active_time)
- Replacing existing custom charts with recharts (out of scope)
- Admin-page changes (only `/app/(public)/claude-code` and the homepage `<ClaudeCodePanel>` use)

## Acceptance Criteria

- [ ] `/api/public/claude-code?start_ms=X&end_ms=Y` returns stats over [X, Y]; without params, returns last 30d (back-compat)
- [ ] Response no longer contains `active_hours_heatmap` or `active_time_ratio_7d`; visibility allowlist + Pydantic model updated; lint passes
- [ ] Response contains a `timeline` field with all-time daily token totals (the brush data source)
- [ ] Frontend panel renders a recharts bar chart with Brush over the timeline; dragging brush handles updates start/end
- [ ] Preset chips 7d / 30d / 90d / All snap brush to that window
- [ ] All sub-charts/stats re-fetch and re-render when brush range changes
- [ ] React Query cache key includes start/end so changing range hits cache for revisits
- [ ] `pnpm typecheck`, `pnpm lint`, ruff/mypy backend pass
- [ ] Visual smoke test on `https://status.lushuyu.site/#claude-code` after deploy

## Technical Context

- Frontend: Next.js 15 App Router, React 18, Tailwind, Radix UI primitives, framer-motion, date-fns, @tanstack/react-query — no chart lib currently
- Panel: `frontend/components/ClaudeCodePanel.tsx` + custom charts in `frontend/components/` (LineChart, BarChart, Donut, Sparkline, StackedBars, Heatmap — last is to be removed)
- Backend: `backend/aglaea/routers/public.py::public_claude_code` (currently hardcodes `now` rounded + 30d back)
- Visibility allowlist: `backend/aglaea/security/visibility.py::PUBLIC_FIELDS_CLAUDE_CODE_METRICS`
- Response schema: `backend/aglaea/schemas/public.py::ClaudeCodeMetrics`
- Deploy: rsync to sg-server `/home/ubuntu/Aglaea/`, `docker compose up -d --build aglaea-backend`, frontend builds on host

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "slider" = literal range slider | User clarified: brush on bar chart (token bars are both data AND range selector) | recharts `<Brush>` |
| heatmap is salvageable | User said "no half-finished" + heatmap needs active_time which we can't accurately derive | Drop heatmap + active_time entirely |
| Range applies to timeline AND stats | Timeline always all-time (so brush has visual context), stats vary | Two fields: `timeline` (constant) + everything else (filtered) |
| "All time" has a hard floor | Earliest backfill data is 2026-04-16 | "All" preset = earliest VM data point, discovered at runtime |

## Implementation Plan

### Backend
1. `routers/public.py::public_claude_code` accept `start_ms`, `end_ms` query params; default behaviour preserved
2. Compute `start_ts`/`end_ts` from params (still round end up to next hour)
3. Add separate logic for "always all-time" `timeline` query (cacheable, separate VM query for daily totals back to earliest data)
4. Drop heatmap_result, active_cli_result, active_user_result fan-out queries
5. Drop heatmap + active_time_ratio fields from response
6. `schemas/public.py::ClaudeCodeMetrics`: remove `active_hours_heatmap`, `active_time_ratio_7d`, add `timeline: list[TokenDataPoint]`
7. `security/visibility.py::PUBLIC_FIELDS_CLAUDE_CODE_METRICS`: same removals + addition
8. mypy + ruff + visibility lint green

### Frontend
1. `pnpm add recharts` (~100KB gzipped)
2. New component `components/RangeBrush.tsx`: chips + recharts BarChart with Brush over `timeline` data; emits `{start_ms, end_ms}` on change
3. `ClaudeCodePanel.tsx`: hoist `range` state, pass to RangeBrush + all child queries
4. Update `useQuery` calls: cache key includes `range.start_ms`/`range.end_ms`; fetch URL appends those
5. Remove `<Heatmap>` usage from ClaudeCodePanel and any active_time_ratio display
6. Delete `components/Heatmap.tsx` if unused elsewhere (grep first)
7. Mobile: brush container scrolls horizontally if needed; chips wrap

### Deploy
- Backend: rsync + docker compose build (existing flow)
- Frontend: `pnpm build` on server (existing flow per CLAUDE.md) — verify path
