# Deep Interview Spec: Aglaea Public Homepage Revamp (2026-05)

## Metadata
- Interview ID: `agla-frontend-revamp-2026-05-14`
- Rounds: 8 (Round 0 topology + 8 Socratic rounds)
- Final Ambiguity Score: **16.5%** (threshold: 20%)
- Type: **brownfield**
- Generated: 2026-05-14
- Threshold: 0.20
- Initial Context Summarized: no (initial idea was compact)
- Status: **PASSED** — pending approval

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.90 | 0.35 | 0.315 |
| Constraint Clarity | 0.80 | 0.25 | 0.200 |
| Success Criteria | 0.85 | 0.25 | 0.213 |
| Context Clarity | 0.85 | 0.15 | 0.128 |
| **Total Clarity** | | | **0.835** |
| **Ambiguity** | | | **0.165** |

## Topology
All four top-level components confirmed in Round 0 and below threshold. No deferrals.

| Component | Status | Description | Coverage Note |
|-----------|--------|-------------|---------------|
| #1 TabBar restructure | active | Drop PubTabBar; lift Status / Claude Code into in-page switcher cards | AC-1.x |
| #2 Service row reorder + badge alignment | active | Swap uptime to right of mid; unify status badge sizing | AC-2.x |
| #3 Cross-service incident feed | active | New aggregated chronological feed on homepage bottom | AC-3.x |
| #4 Animation pass (framer-motion, Tier A) | active | Add motion only to switcher, layout transitions, and hover | AC-4.x |

## Goal

Restructure the Aglaea public homepage (`frontend/app/(public)/page.tsx`) so the two core surfaces — **Status** and **Claude Code analytics** — become first-class, in-body switchable panels driven by framer-motion `AnimatePresence`; reorder each service row so uptime sits to the right of subchecks with a fixed-width, right-aligned status badge that is visually identical across all rows; add a new bottom-half cross-service chronological incident feed with infinite scroll and 60-second auto-refresh of new incidents at the top; and introduce a minimal, deliberate animation language (Tier A: switcher cross-fade, layout transitions on service status change, hover lift) using framer-motion as the single animation primitive.

## Constraints

- **Animation library:** framer-motion (`motion` package). Only one motion library — no react-spring, no auto-animate.
- **Animation tier:** **Tier A only** for v1. Tier B/C entrance staggers and live-numeric tweens are explicitly out of scope. We can escalate later, but not now.
- **PubTabBar component:** delete entirely (`frontend/components/PubTabBar.tsx` removed). About is already in the site header, so it stops appearing in the tab strip.
- **/claude-code route:** the existing `frontend/app/(public)/claude-code/page.tsx` becomes a Next.js redirect to `/#claude-code`. Bookmarks and external links keep working; the homepage reads the hash on mount and preselects the corresponding switcher panel.
- **Switcher interaction:** in-page toggle, **not** routed. URL stays at `/` while switching, but the hash fragment updates (`/#status`, `/#claude-code`) so deep linking and back/forward work.
- **Service row grid:** fixed 4-column grid `[name 1fr | mid auto/min 280px | uptime 280px | badge fixed 110px]`. Mid column collapses when a service has no subchecks; uptime and badge keep their fixed slots so the badge always sits at the same right edge across all rows.
- **Status badge:** unified single size (drop the `sm` variant in this context). Same font-size, padding, fixed 110px width, text right-aligned. Operational, Degraded, Down, Unknown, and incident-lifecycle variants all use the same dimensions.
- **Incident feed:** `useInfiniteQuery` from TanStack Query (v5, already installed). Page size 20. No hard time floor. Each row is a Link to `/services/[slug]/incidents`.
- **Auto-refresh:** poll the head of the feed every 60 seconds; new incidents prepend with framer-motion fade+slide-down. Existing rows do not re-animate.
- **Hover motion:** scale 1.01 + shadow lift, 120ms ease-out. Applies to switcher cards and service rows.
- **Layout motion:** framer-motion `layout` prop on `ServiceRow` so when a service's `status` changes (e.g., Operational → Degraded), the badge color and any row reordering tween 250ms instead of snapping.
- **Reduced motion:** respect `prefers-reduced-motion`. All framer-motion components must use `useReducedMotion` hook or `MotionConfig reducedMotion="user"` at the layout root.
- **Backend data source:** spec is endpoint-agnostic — the aggregated feed may read from existing per-service `/api/public/services/:slug/incidents` endpoints (client-side fanout) OR a new flat `/api/public/incidents?limit=20&before=<cursor>` endpoint. Architect consensus (iteration 2) prefers the new flat endpoint with: (a) **reuse** of the exact same service-visibility predicate the per-service endpoint already enforces, (b) a **composite cursor `(started_at, id)`** to disambiguate same-millisecond incidents, (c) a unit test asserting incidents of private services are excluded.
- **No removal** of `/services/[slug]/incidents` per-service history page. The new homepage feed is additive.

## Non-Goals

- No live SSE / WebSocket push for incidents (polling only).
- No incident filter UI (service / severity / date range chips) in v1.
- No calendar heatmap, no analytics dashboards (MTTR, incident counts per service).
- No entrance/staggered animations for service rows or feed items on page load.
- No tweened numeric transitions for uptime % or duration values.
- No mobile-stacked layout for service rows (the existing horizontal grid is the only layout; narrow widths inherit current overflow behavior).
- No redesign of the site header. About link stays where it is.
- No changes to the admin pages or admin auth.
- No backend schema changes to the `Incident` model.

## Acceptance Criteria

### #1 TabBar restructure
- [ ] AC-1.1 `frontend/components/PubTabBar.tsx` is deleted; no remaining imports reference it.
- [ ] AC-1.2 Two large rounded-rectangle switcher cards render inside `frontend/app/(public)/page.tsx`, positioned above the existing `<StatusBanner>` and active-incidents card.
- [ ] AC-1.3 Clicking a card toggles which panel is visible below without navigating (URL stays `/`); hash updates to `/#status` or `/#claude-code`.
- [ ] AC-1.4 The transition between panels uses `<AnimatePresence mode="wait">` with fade+slide (~180ms).
- [ ] AC-1.5 Navigating directly to `/claude-code` redirects to `/#claude-code` and the Claude Code panel is preselected on mount.
- [ ] AC-1.6 Browser back/forward navigates between hash states.
- [ ] AC-1.7 The Status card carries the `◎ live` glyph + sublabel; the Claude Code card carries `⟡ analytics`. Active card has accent-colored border and elevated shadow.
- [ ] AC-1.8 About **does not** appear anywhere in the body switcher (it remains only in the header).

### #2 Service row reorder + badge alignment
- [ ] AC-2.1 `frontend/app/(public)/page.tsx` service-row grid is 4 columns: `[name 1fr | mid auto/min 280px | uptime 280px | badge 110px]`.
- [ ] AC-2.2 `<UptimeStrip>` renders in the third column (was second).
- [ ] AC-2.3 `<SubcheckStrip>` renders in the second column (was third).
- [ ] AC-2.4 When a service has no subchecks, the mid column collapses to 0 width and renders nothing; uptime and badge stay in their fixed slots so the badge right edge is consistent across all rows.
- [ ] AC-2.5 `<StatusBadge>` renders at fixed 110px width, text right-aligned, with identical font-size and padding for every variant (Operational, Degraded, Down, Unknown, incident lifecycle states).
- [ ] AC-2.6 Visual diff: the badge text baseline is aligned across rows when stacked.
- [ ] AC-2.7 The `sm` size variant on `<StatusBadge>` continues to exist for other call sites but is not used inside the homepage service rows.

### #3 Cross-service incident feed
- [ ] AC-3.1 A new `<IncidentFeed>` component renders below the service list on the homepage.
- [ ] AC-3.2 The feed shows the latest 20 incidents across **all** services on initial load, newest first.
- [ ] AC-3.3 Each feed row shows: service-name chip, incident status pill ("ongoing" / "resolved"), duration (or "ongoing" if unresolved), and the started_at timestamp.
- [ ] AC-3.4 Each row is a Next.js `<Link>` to `/services/[slug]/incidents`.
- [ ] AC-3.5 Scrolling to the bottom triggers `useInfiniteQuery` to fetch the next 20 older incidents.
- [ ] AC-3.6 Every 60 seconds, the feed re-queries the head; any new incidents prepend at the top with framer-motion fade+slide-down (~250ms).
- [ ] AC-3.7 Existing rows do not re-animate when new rows prepend.
- [ ] AC-3.8 A loading skeleton renders for the initial fetch and for "load more"; the head-poll refresh is silent (no spinner).
- [ ] AC-3.9 If there are zero incidents ever, render a friendly empty state ("No incidents recorded.") rather than an empty list.

### #4 Animation pass (Tier A)
- [ ] AC-4.1 `framer-motion` is added to `frontend/package.json` (current major version).
- [ ] AC-4.2 `<MotionConfig reducedMotion="user">` wraps the public layout root so `prefers-reduced-motion: reduce` disables non-essential motion automatically.
- [ ] AC-4.3 Switcher panel transition (AC-1.4) is the only AnimatePresence usage in the public homepage; both panels share a `<motion.div>` wrapper with `key={panel}`.
- [ ] AC-4.4 `<ServiceRow>` uses `layout` prop so badge color + any reorder shift tweens 250ms when status changes.
- [ ] AC-4.5 Switcher cards and service rows have a hover variant: scale 1.01 + box-shadow lift, 120ms ease-out.
- [ ] AC-4.6 Incident feed prepend (AC-3.6) is the only other motion surface; no entrance stagger anywhere else.
- [ ] AC-4.7 No new CSS `@keyframes` added in this revamp; the existing tokens.css keyframes stay untouched.

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "TanStack has an animation library" | Contrarian check: TanStack ships data/router/table/form, not motion. | Chose framer-motion as the single animation primitive. |
| "Just add more animations" | Contrarian: more animation often makes a status page feel busy and slower. | Picked Tier A (3 surfaces) over Tier B/C; explicit tier choice with room to escalate. |
| Cards are routed links | Simplifier: do users actually need two URLs, or one URL with a panel toggle? | In-page toggle with hash deep-link. /claude-code becomes a redirect. |
| Incident aggregation might need analytics, calendar, filters | Simplifier: smallest version that delivers the "pulse" feel. | Chronological infinite-scroll feed only; no analytics, no filters, no heatmap in v1. |
| Service rows always have mid (subchecks) | Layout edge case: some monitored items have no subchecks. | Mid column collapses; fixed 4-col grid keeps uptime/badge anchored so badges line up. |
| Live updates require SSE / WebSocket | Simplifier: polling is already supported by TanStack Query. | 60s head-poll with framer-motion enter animation. SSE explicitly out of scope. |
| The PubTabBar bar should stay (just edited) | Why keep redundant chrome if Status/CC become body cards and About is already in the header? | Delete PubTabBar entirely. |

## Technical Context

### Current files & components (from brownfield exploration)
- Tab bar: `frontend/components/PubTabBar.tsx:7-11` — three tabs (Status, Claude Code, About) as Next.js `<Link>`s with sticky/scroll-hide behavior in `frontend/styles/screens/public-overview.css:15`.
- Public homepage: `frontend/app/(public)/page.tsx` — server component. Top half: `<StatusBanner>` + active-incidents card. Bottom half: 4-col service-row grid.
- Service row grid CSS: `frontend/styles/screens/public-overview.css:84-97`.
- Status badge: `frontend/components/StatusBadge.tsx:62-98` — has `md` + `sm` variants and lifecycle variants.
- Uptime: `<UptimeStrip>` (30-day strip).
- Subchecks: `<SubcheckStrip>` (6-key set, wraps narrow).
- Incidents API: `frontend/lib/api.ts:82-90` (per-service history), `frontend/lib/api.ts:341-349` (per-service active).
- Per-service incident page: `frontend/app/(public)/services/[slug]/incidents/page.tsx`.
- Claude Code page: `frontend/app/(public)/claude-code/page.tsx` (will become a redirect).
- TanStack Query v5 already installed (`frontend/package.json:17`).

### New files expected
- `frontend/components/SwitcherCard.tsx` — large rounded-rectangle card with active state, icon, label, sublabel.
- `frontend/components/HomePanels.tsx` (client component) — owns `activePanel` state (`'status' | 'cc'`), reads/writes hash, renders AnimatePresence and either the status section or the CC section as children.
- `frontend/components/IncidentFeed.tsx` (client component) — `useInfiniteQuery` + 60s head poll, renders prepend animation.
- Possibly `frontend/app/api/public/incidents/route.ts` (Next.js route handler) or a new backend endpoint, depending on Phase 1 architectural decision.

### Files expected to be deleted
- `frontend/components/PubTabBar.tsx`
- `frontend/app/(public)/claude-code/page.tsx` (replaced with a redirect route)

### Files expected to be modified
- `frontend/app/(public)/page.tsx` — drop PubTabBar import, add SwitcherCard/HomePanels, add IncidentFeed, restructure service-row grid usage.
- `frontend/styles/screens/public-overview.css:84-97` — change grid template, drop tab-bar styles.
- `frontend/components/StatusBadge.tsx` — make the homepage variant fixed-width 110px right-aligned, unify sizing tokens.
- `frontend/package.json` — add `framer-motion`.
- `frontend/app/layout.tsx` or `frontend/app/(public)/layout.tsx` — wrap with `<MotionConfig reducedMotion="user">`.

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| SwitcherCard | UI component (new) | label, icon, sublabel, active, onClick | renders inside HomePanels; 2 instances (Status, CC) |
| HomePanels | UI component (new) | activePanel, setActivePanel | owns hash state, contains AnimatePresence + SwitcherCard×2 |
| PubTabBar | UI component (removed) | — | deleted |
| ServiceRow | UI component (modified) | service, status, uptime, subchecks | renders in 4-col grid; uses framer `layout` |
| UptimeStrip | UI component (moved) | days | renders in column 3 (was column 2) |
| SubcheckStrip | UI component (moved) | subchecks | renders in column 2 (was column 3); collapses when empty |
| StatusBadge | UI component (modified) | status, lifecycle? | fixed 110px width on homepage; same dims across variants |
| IncidentFeed | UI component (new) | limit, refreshInterval | infinite-query + head-poll; renders below service list |
| FeedItem | UI component (new) | incident, serviceName | Link to /services/[slug]/incidents |
| Incident | Data entity (existing) | id, service_slug, status, started_at, resolved_at?, affected_subchecks[], report_state, published_text?, published_at? | aggregated across services in IncidentFeed |
| MotionConfig | Animation primitive | reducedMotion | wraps public layout root |
| AnimatePresence | Animation primitive | mode | wraps switcher panels and feed item enters |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|-----------------|
| 1 (animation lib pick) | 4 | 4 | 0 | — | N/A |
| 2 (incident display) | 5 | 1 | 0 | 4 | 80% |
| 3 (switcher model) | 7 | 2 | 0 | 5 | 71% |
| 4 (animation tier) | 8 | 1 | 0 | 7 | 88% |
| 5 (row layout) | 10 | 2 | 0 | 8 | 80% |
| 6 (feed scope) | 11 | 1 | 0 | 10 | 91% |
| 7 (feed pagination) | 12 | 1 | 0 | 11 | 92% |
| 8 (tab fate) | 12 | 0 | 0 | 12 | **100%** |

Ontology converged at Round 8 — every entity defined was reused with no renames in the final round.

## Interview Transcript
<details>
<summary>Full Q&amp;A (8 rounds + Round 0)</summary>

### Round 0 — Topology confirmation
**Q:** Four top-level components proposed (TabBar restructure, Service row reorder, Incident feed aggregation, Animation pass). Right?
**A:** Looks right — all 4 active.

### Round 1 — Component #4 / Constraints (animation library)
**Q:** TanStack doesn't ship an animation library. Which one?
**A:** Framer Motion / `motion`.
**Ambiguity:** 58.5%.

### Round 2 — Component #3 / Criteria (display model)
**Q:** How should aggregated incident history look on the homepage bottom?
**A:** Chronological feed (interleaved across all services).
**Ambiguity:** 54%.

### Round 3 — Component #1 / Criteria (switcher interaction)
**Q:** How should the two big switcher cards actually switch?
**A:** In-page toggle — swap content, one URL.
**Ambiguity:** 54% (stalled).

### Round 4 — Component #4 / Criteria, Contrarian mode (animation scope)
**Q:** Pick an animation tier rather than every animation.
**A:** Tier A — Essential motion.
**Ambiguity:** 38.4%.

### Round 5 — Component #2 / Criteria+Constraints (row layout edge case)
**Q:** Service-row layout when a service has NO subchecks; badge alignment rules?
**A:** Fixed 4-col grid; uptime right of mid; badge fixed-width right-aligned.
**Ambiguity:** 32.2%.

### Round 6 — Component #3 / Constraints, Simplifier mode (feed scope)
**Q:** What's the smallest version of the cross-service incident feed?
**A:** *Free text:* "往下刷新新条目这样的" → infinite-scroll model.
**Ambiguity:** ~26% (partial credit, criteria not yet at threshold).

### Round 7 — Component #3 / Constraints (pagination + refresh)
**Q:** Page size, lower time bound, and whether new incidents auto-appear at the top?
**A:** 20/page · all-time · auto-refresh top every 60s.
**Ambiguity:** 22%.

### Round 8 — Component #1 / Constraints (PubTabBar + /claude-code fate)
**Q:** What happens to PubTabBar and /claude-code?
**A:** Delete PubTabBar; /claude-code redirects to /#claude-code.
**Ambiguity:** **16.5%** ✓
</details>
