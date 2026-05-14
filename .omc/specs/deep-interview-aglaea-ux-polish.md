# Deep Interview Spec: Aglaea v0.1 UX Polish

## Metadata
- Interview ID: aglaea-ux-polish-2026-05-14
- Rounds: 9 + Round 0 topology gate + post-spec user-driven addition (Component 5)
- Final Ambiguity Score: ~19%
- Type: brownfield (Aglaea v0.1, deployed at https://status.lushuyu.site)
- Generated: 2026-05-14
- Threshold: 0.20
- Initial Context Summarized: no (initial 4-bullet prompt was compact)
- Status: PASSED
- Challenge modes used: Contrarian (Round 6), Simplifier (Round 7)

## Clarity Breakdown

Brownfield weights: Goal 35% / Constraints 25% / Criteria 25% / Context 15%.

| Component | Goal | Constraints | Criteria | Context | Component Score |
|-----------|------|-------------|----------|---------|-----------------|
| 1. Typography upscale | 0.90 | 0.85 | 0.70 | 0.95 | 0.86 → 0.14 ambig |
| 2. Service row + status strip | 0.85 | 0.85 | 0.70 | 0.90 | 0.81 → 0.19 ambig |
| 3. Incident flow (Statuspage style) | 0.85 | 0.78 | 0.75 | 0.85 | 0.81 → 0.19 ambig |
| 4. Homepage density | 0.90 | 0.85 | 0.85 | 0.90 | 0.88 → 0.12 ambig |
| 5. Library upgrade (TanStack / shadcn / etc.) | 0.85 | 0.80 | 0.75 | 0.85 | 0.81 → 0.19 ambig |
| **Overall (weakest)** | | | | | **~0.19** |

## Topology

All four Round 0 components confirmed active. No deferrals.

| Component | Status | Description | Coverage |
|-----------|--------|-------------|----------|
| 1. Typography upscale | active | Both public + admin surfaces bump base 14px → 16px, scale proportionally across `--fs-*` tokens. | AC §1.1-1.4 |
| 2. Service row + status strip | active | Public homepage service rows become clickable links to service detail; add 30-day daily-aggregate red/orange/green strip per row. | AC §2.1-2.5 |
| 3. Incident flow | active | Replace single draft → publish model with Statuspage-style two-layer incident: mutable Summary (DeepSeek-rewritten at key moments) + append-only Update stream (template-generated on every status transition). Surface incidents on homepage banner + service row link + detail page. | AC §3.1-3.13 |
| 4. Homepage density | active | Drop "Services" section header, keep PubTabBar as-is, move About link from footer into header, add lushuyu.site link in header, remove footer entirely. | AC §4.1-4.5 |
| 5. Library upgrade | active | Replace hand-rolled UX patterns with battle-tested libraries: TanStack Query functional `refetchInterval` + optimistic `onMutate` + `MutationErrorBanner` + invalidate-by-predicate, `@tanstack/react-table` for admin tables, `react-hook-form` + `zod` (schemas derived from backend OpenAPI) for forms, `sonner` for toasts, `date-fns` for time formatting, copy-in shadcn-style headless dialog/dropdown primitives. Surgical, not full design framework. | AC §5.1-5.10 |

## Goal

Polish Aglaea v0.1 across five UX surfaces so the deployed status page (a) reads bigger, (b) navigates obviously, (c) communicates ongoing incidents in the canonical Statuspage style with DeepSeek-driven prose summaries, (d) presents its full content above the fold on a default desktop viewport, and (e) stops re-implementing patterns that TanStack Query / shadcn-style headless primitives / form + validation libraries already handle — so future features add features instead of re-introducing bug surface in hand-rolled state machines.

## Constraints

- **No new public ports.** Postgres / VictoriaMetrics / OTel Collector stay docker-internal. Only loopback bindings for backend/frontend/otelcol as already configured.
- **No new external services.** DeepSeek is the only LLM; no Anthropic/OpenAI swap.
- **DeepSeek call budget:** Per incident, DeepSeek runs at most: (a) once on incident open, (b) on a status transition to a "new worst" subcheck status (same subcheck within 5 minutes does NOT re-trigger), (c) once on incident close. Updates (the timestamped stream) are template-generated, NOT LLM-generated.
- **No incident_updates schema decision locked in this spec.** The plan phase decides between (a) separate `incident_updates` table with FK to `incidents.id`, or (b) JSONB `updates[]` array on the `incidents` row. Both satisfy the requirements; the trade-offs are migration cost vs. query simplicity vs. row-size growth.
- **Auto-close rule:** All subchecks listed in `incident.affected_subchecks` must report `status="ok"` for 5 consecutive minutes (continuous heartbeat coverage with no gap) before `incident_detector` worker sets `resolved_at`. Admin manual-close path is out of scope for this iteration.
- **Mobile:** v0.1 polish targets desktop primarily. Mobile rendering must remain functional but is not the optimization target.
- **No schema migration in C1/C2/C4.** Only C3 may require a migration (depending on schema choice).
- **About page exists or will exist as a static route.** This spec assumes `/about` is reachable; if it does not exist yet, the header link should still be wired and the page stubbed with one-paragraph placeholder content.
- **Library upgrade is surgical, not framework adoption.** New deps allowed: `react-hook-form`, `zod`, `@tanstack/react-table`, `sonner` (or `react-hot-toast`), `date-fns`. shadcn primitives are copy-in (not an npm dep). Forbidden: ant-design, chakra, mantine, material-ui, daisyui, or anything that imposes a global design system. Existing `@tanstack/react-query` stays on its current major.
- **C5 ordering is planner-decided.** Three viable orderings — (a) Phase 5 first then rebuild C1-C4 on the new primitives, (b) intersperse C5 within C1-C4 (adopt the helper at the moment it's needed), or (c) C1-C4 first then C5 as a refactor pass. ADR in the consensus plan picks one.

## Non-Goals

- Mobile-first responsive redesign.
- Public-side timeline for unpublished/ongoing incidents (CR-6 Path A from the prior ralplan stays in effect).
- Real `heartbeats[]` / `similar[]` arrays on the admin incident endpoint (deferred per prior plan §OOS).
- Manual admin "Mark resolved" button on the incident detail page.
- WebSocket / live-tailing of the Update stream (polling at 15s is fine).
- Internationalization / RTL.
- Audit-log table indexing (deferred per Risk #3 of the prior ralplan).
- Admin gate on the auto-published Summary (fully auto per Round 2 decision).
- Public OTel telemetry export.
- Full design-system adoption (ant-design / chakra / mantine / material-ui).
- E2E test suite migration as part of the library upgrade (separate effort).
- Backend OpenAPI generation infra (the zod-from-OpenAPI tooling needs `aglaea` to emit a usable OpenAPI doc; this spec assumes FastAPI's auto-generated `/openapi.json` is sufficient).
- Replacing `@tanstack/react-query` itself or upgrading its major version.

## Acceptance Criteria

### Component 1 — Typography upscale
- [ ] **1.1** `<body>` font-size on both public-facing and admin-side pages is 16px.
- [ ] **1.2** The `--fs-*` CSS variable scale is updated proportionally (each variable × ~1.14, rounded to integer pixel where the original was integer; new scale anchored at `--fs-16: 16px` as the base).
- [ ] **1.3** All `fontSize: <N>` inline declarations that referenced the old scale (12 / 13 / 14 / 15 / 16 / 18 / 20 / 22 / 24 / 26 / 28 / 30) shift to the new proportional values. A grep audit confirms no orphan `fontSize: 12` or `fontSize: 14` references remain in either `app/(public)/**` or `app/admin/**` source.
- [ ] **1.4** No visual regression: the StatusBadge pill, SubcheckStrip pip, admin table rows, public homepage service rows, and incident detail page all render without overflow on a 1280px-wide desktop viewport. Screenshot verification before/after.

### Component 2 — Service row + status strip
- [ ] **2.1** Each row in `/(public)/page.tsx` is wrapped in `<Link href="/services/${slug}">` so the entire row navigates on click.
- [ ] **2.2** A new "30-day status strip" component renders 30 vertical bars in each service row, mid-section. Each bar represents one day (UTC) over the past 30 days, oldest on the left.
- [ ] **2.3** Bar color rule: any heartbeat that day with `status="down"` → red; else any with `status="degraded"` → orange; else if any heartbeats present and all `ok` → green; if no heartbeats received that day → gray.
- [ ] **2.4** Clicking a bar (per-day cell) navigates to `/services/{slug}/incidents` filtered by that day OR to a day-detail page (decided in planning). Hovering shows a tooltip with the UTC date.
- [ ] **2.5** The 30-day data source is the existing `heartbeat_events` hypertable, aggregated to daily worst-status via a Postgres query (`status` precedence `down > degraded > ok`, NULL if zero rows that day). One query per service row at page-load time is acceptable for v0.1 (fewer than ~10 services).

### Component 3 — Incident flow (Statuspage style)
- [ ] **3.1** Incident model gains a mutable `summary: text \| null` field (or repurposes `report_text` as `summary`, decided in planning).
- [ ] **3.2** Incident model gains an append-only `updates` collection — schema TBD (separate table OR JSONB array), but each update has at minimum: `t: timestamptz`, `kind: enum(state_transition | manual)`, `text: text`, `status_snapshot: jsonb`.
- [ ] **3.3** Incident model gains a `lifecycle_state: enum(investigating | identified | monitoring | resolved)`. Default on open: `investigating`. On admin-supplied state transition: arbitrary forward jump permitted. On auto-close: `resolved`.
- [ ] **3.4** `report_generator` worker is updated so that on incident open, DeepSeek is invoked and the response stored in `incident.summary`. The page is publicly visible IMMEDIATELY (no admin gate) once the summary lands.
- [ ] **3.5** On any subcheck status transition during an incident, the `incident_detector` worker (or a new worker) appends a single Update row with `kind="state_transition"`, `text` rendered from a template (e.g., `"{subcheck} now {status}"` + optional message snippet), and `status_snapshot` capturing the per-subcheck states at that moment.
- [ ] **3.6** DeepSeek is NOT invoked on every transition. It IS re-invoked to rewrite `incident.summary` only when (a) the transition is a "new worst" (severity strictly increased: ok→degraded, degraded→down, ok→down) AND (b) the same `(subcheck, severity_class)` pair has not triggered a DeepSeek re-write within the prior 5 minutes (5-minute cooldown per pair).
- [ ] **3.7** On incident close (auto-close: all `affected_subchecks` `ok` for 5 consecutive minutes, OR admin-manual close — manual deferred to v0.2), DeepSeek is invoked once to write a final retrospective `summary` (the postmortem). `lifecycle_state` becomes `resolved`. `resolved_at` is set.
- [ ] **3.8** Admin retains ability to manually edit `summary` and to insert a manual Update with `kind="manual"` and free-form text. Manual Updates do NOT trigger DeepSeek.
- [ ] **3.9** Public homepage `/(public)/page.tsx` renders an "Active Incidents" card section directly below the global StatusBanner, only when at least one incident has `lifecycle_state != resolved`. Each card shows: service name, current Summary first paragraph (truncated to 200 chars), lifecycle_state pill, "since" timestamp, and a "View incident" link to the detail page.
- [ ] **3.10** Service row right-side StatusBadge becomes a clickable "View incident" link only when that service has an active incident. Otherwise stays as the current static status pill.
- [ ] **3.11** Public incident detail page `/(public)/services/{slug}/incidents/{id}` renders three sections vertically: (a) a header with title + lifecycle_state pill + started/resolved timestamps, (b) the current `summary` block, (c) the reverse-chronological Update stream (most recent first; each row: timestamp + lifecycle_state-pill if it changed + text).
- [ ] **3.12** Admin incident detail page `/admin/incidents/{id}` adds: "Add manual update" button + text-input, "Edit summary" button (opens edit mode for the summary block), and an explicit "Trigger summary regenerate" button (calls existing /regenerate endpoint with a now-explicit reason field).
- [ ] **3.13** Audit-log entries are created on: DeepSeek summary regenerate (existing), manual summary edit (new), manual update insert (new). State-transition Updates are NOT audited (they are derived from heartbeat data which is already in `heartbeat_events`).

### Component 4 — Homepage density
- [ ] **4.1** "Services" section header (40px) on `/(public)/page.tsx` is removed.
- [ ] **4.2** `pub-footer` (~80px) is removed entirely from `/(public)/layout.tsx`.
- [ ] **4.3** Header (`pub-header`) gains two right-aligned links: "About" (→ `/about`) and a personal-site link displayed as "lushuyu.site" (→ `https://lushuyu.site`, opens in new tab, `rel="noopener noreferrer"`).
- [ ] **4.4** If `/about` does not exist as a route, create a one-paragraph placeholder page at `app/(public)/about/page.tsx`.
- [ ] **4.5** PubTabBar (Status / Claude Code switcher, ~48px) stays as-is (independent row). Verified on a 1280×800 desktop viewport that the homepage now renders: Header + TabBar + StatusBanner + (Active Incidents card if any) + Service list + nothing below — no footer scrolling required when ≤ 5 services and zero incidents.

### Component 5 — Library upgrade
- [ ] **5.1** Regenerate polling burst in `app/admin/incidents/[id]/page.tsx` (currently `regenPendingSince` + `setTimeout` + manual `report_generation_count` tracking) replaced with TanStack Query's functional `refetchInterval`: `refetchInterval: (query) => query.state.data?.incident.report_generation_count !== regenBaselineCount ? false : 5000`. The 30-second safety cap survives as a derived flag from `useQuery`'s `dataUpdatedAt` or a wrapping `useEffect`, not as a separate state machine.
- [ ] **5.2** The "Queued — refreshing" chip visibility flag is `regenMutation.isPending || query.isFetching` evaluated inline at render time, not a separate `useState` boolean.
- [ ] **5.3** `publishMutation`, `rejectMutation`, and `adminRevokeApiKey` gain `onMutate` optimistic updates that write the expected post-mutation state into the query cache, with `onError` rollback that restores the cached value if the server call fails. UI flips immediately on click; failure path visibly reverts.
- [ ] **5.4** A reusable `<MutationErrorBanner mutation={...} />` component is added (probably under `frontend/components/`) and replaces the duplicated error-banner JSX currently in `app/admin/incidents/[id]/page.tsx` (one each for publish/reject/regenerate) and `app/admin/services/[slug]/page.tsx`.
- [ ] **5.5** Cache-invalidation cascades use the predicate form where multiple sibling queries share a key prefix (e.g., `queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'admin-service' })`) so a single mutation can refresh all admin-service-related caches in one call.
- [ ] **5.6** `@tanstack/react-table` (already from the same vendor) is added as a dependency and used to render `app/admin/services/page.tsx`, `app/admin/incidents/page.tsx`, and `app/admin/audit-log/page.tsx`. Each gains: column sorting, basic free-text filter, virtual scroll when row count > 50. The existing styling is preserved (no Material/Ant look).
- [ ] **5.7** `react-hook-form` + `zod` are added as deps. `app/admin/services/new/page.tsx` is the migration pilot: its `useState`-based form becomes a `useForm({resolver: zodResolver(schema)})` form. The zod schema is generated from the backend's `/openapi.json` (FastAPI's auto-export) via the existing `openapi-typescript` toolchain or a sibling generator — the exact tool choice is planner-decided. Future `incident-update` and `summary-edit` forms also use this pattern.
- [ ] **5.8** `sonner` (preferred) replaces all `window.confirm` calls and the bespoke "API key plaintext shown once" modal alert. Toasts fire on: service delete (success / failure), service create (success / failure), api-key generate (with the plaintext shown in a long-lived toast that the user can manually copy and dismiss), api-key revoke (success / failure), incident publish / reject / regenerate-requested.
- [ ] **5.9** `date-fns` (with `zh-CN` locale) replaces `lib/fmt.ts:fmtTime` / `fmtDuration`. New default time format for "recently happened" timestamps is `formatDistanceToNow(date, { addSuffix: true, locale: zhCN })`. Absolute time is still available via `format(date, 'yyyy-MM-dd HH:mm')` for incident detail pages and any auditing surface.
- [ ] **5.10** A minimal shadcn-style headless primitive set is copied into `frontend/components/ui/` (e.g., `dialog.tsx`, `dropdown.tsx`, `button.tsx`, `input.tsx`, `toast.tsx`). These are not from an npm package — they are copy-in code originally derived from shadcn/ui, styled with the existing Aglaea token system (`var(--*)`). No global theme injection. At minimum the regenerate dialog, the api-key generate modal, and the future "add manual update" dialog use these.

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "All 4 issues should be tackled together." | Round 0 topology gate — could split or defer. | All 4 active, no deferrals. |
| "Just make fonts bigger." | Round 4 — magnitude / scope / parity? | Base 16px on both surfaces, proportional bump of the existing CSS variable scale. |
| "Show a red/orange/green bar." | Round 5 — what cadence and depth? | 30 days × daily aggregate, color = worst status of the day. |
| "Incident page should look like Statuspage." | Round 1 — single document, stream of updates, or hybrid? | Mutable Summary + append-only Update stream (two layers). |
| "DeepSeek auto-generates everything." | Round 2 — also auto-publish without admin review? | Yes, fully auto: DeepSeek writes Summary at Open / new-worst transition / Close. No admin gate. Manual override paths preserved. |
| "DeepSeek runs on every heartbeat change." | Round 6 Contrarian — flappy incident would cost 10× per hour, latency lags reality. | DeepSeek runs only at Open / new-worst transition (5-min cooldown per `(subcheck, severity)` pair) / Close. Template-generated Updates on every transition. |
| "Incidents are invisible on the frontend." | Round 7 Simplifier — minimum visibility surface? | Three surfaces: homepage banner, service row link, detail page. |
| "Footer is annoying." | Round 8 — remove or just shrink? | Removed entirely; About + personal-site links move to header. |
| "Incident auto-close needs to be tight." | Round 9 — 1 min / 5 min / admin manual / both? | All affected_subchecks `ok` for 5 consecutive minutes; manual close deferred to v0.2. |
| "We can hand-roll each UX pattern." | Post-spec user pushback after running the v0.1 deploy: regenerate polling burst, mutation error UI, optimistic updates, modal alerts — all reinventing what TanStack Query / shadcn-style primitives / form + validation libraries already provide. Hand-rolling concentrates bugs. | New Component 5: surgical library upgrade (TanStack helpers, react-table, react-hook-form + zod, sonner, date-fns, copy-in shadcn primitives). No global design system. |

## Technical Context

### Existing files relevant to each component

**Typography (C1):**
- `frontend/styles/tokens.css:1-26` — `--fs-*` scale + `--row-h-admin`.
- `frontend/app/globals.css:182` — body `font-size: 14px`.
- Inline `fontSize:` declarations: see explore agent's report in this interview's transcript section.

**Service row + strip (C2):**
- `frontend/app/(public)/page.tsx:74-111` — service-row JSX.
- `frontend/styles/screens/public-overview.css:83-96` — grid layout.
- `frontend/components/Heatmap.tsx` — existing daily-strip-like component, unused on homepage; may be reusable.
- Backend: new query needed against `heartbeat_events` aggregating to daily worst-status; consider a SQL view or a dedicated endpoint `/api/public/services/{slug}/uptime?days=30`.

**Incident flow (C3):**
- `backend/aglaea/models/incidents.py` — current schema (gains `summary`, `lifecycle_state`, updates collection).
- `backend/aglaea/workers/report_generator.py` — DeepSeek call site; current INITIAL/PERIODIC/FINAL triggers map onto new Open/new-worst/Close moments.
- `backend/aglaea/workers/incident_detector.py` — opens incidents; will also append state-transition Updates and run auto-close rule.
- `backend/aglaea/routers/admin_incidents.py` — already wraps regenerate/publish/reject; needs new endpoints for manual update insert + summary edit.
- `backend/aglaea/routers/public.py` — already returns `{incident, timeline, similar}`; needs to also return current Summary + Updates stream.
- `frontend/app/admin/incidents/[id]/page.tsx` — needs the new editor UI for Summary + Updates.
- `frontend/app/(public)/services/[slug]/incidents/[id]/page.tsx` — render three-section layout.
- `frontend/app/(public)/page.tsx` — Active Incidents card section addition.

**Homepage density (C4):**
- `frontend/app/(public)/layout.tsx:25-40` — header + tabbar markup; `pub-header`, `PubTabBar`, `pub-footer` CSS classes.
- `frontend/styles/screens/public-overview.css` — layout grid.

**Library upgrade (C5):**
- `frontend/package.json` — existing deps already include `@tanstack/react-query@^5`. New deps to add: `react-hook-form`, `zod`, `@hookform/resolvers`, `@tanstack/react-table`, `sonner`, `date-fns`. shadcn primitives are NOT a dep — they ship as files under `frontend/components/ui/`.
- `frontend/lib/fmt.ts` — current `fmtTime` / `fmtDuration` to be deprecated; thin wrappers may remain during migration, then deleted.
- `frontend/app/admin/incidents/[id]/page.tsx` — Phase 1 frontend's `regenPendingSince` + `setTimeout` + `regenBaselineCount` block is the canonical demonstration of the "hand-rolled where library handles it" pattern. The refactor here is the AC §5.1-5.2 pilot.
- `frontend/app/admin/services/new/page.tsx` — form-state refactor pilot for AC §5.7 (react-hook-form + zod).
- `frontend/app/admin/services/page.tsx` / `incidents/page.tsx` / `audit-log/page.tsx` — table refactor targets for AC §5.6.
- Backend `/openapi.json` is auto-generated by FastAPI and already served at `https://status.lushuyu.site/api/openapi.json`. The zod-schema generator runs against this URL.

### Reusable infrastructure
- `services/timeline.py:build_admin_timeline / build_public_timeline` already aggregate timeline events; the new "Update stream" may either consume the same helper or have its own (decision in planning).
- DeepSeek call path already wrapped with sanitization + audit; new call sites reuse this.

## Ontology (Key Entities)

| Entity | Type | Fields (new in bold) | Relationships |
|--------|------|----------------------|---------------|
| Service | core domain | slug, display_name, kind, last_status, last_subchecks, last_heartbeat_at, public_visible, **uptime_30d (derived)** | has many Incidents, has many HeartbeatEvents |
| Incident | core domain | id, service_id, status, started_at, resolved_at, affected_subchecks, **summary (mutable)**, **lifecycle_state (enum)**, published_text, published_at | belongs to Service, has many **IncidentUpdates** |
| **IncidentUpdate** | core domain (new) | t, kind (state_transition\|manual), text, status_snapshot (jsonb), author (admin_id if manual) | belongs to Incident |
| HeartbeatEvent | core domain | ts, service_id, status, subchecks (jsonb), metrics, message | belongs to Service |
| Subcheck | supporting (nested) | status, latency_ms, message — embedded in HeartbeatEvent.subchecks JSONB | scoped within HeartbeatEvent |
| AdminUser | core domain | id, github_login, github_id, last_login_at | authors manual IncidentUpdates |
| ApiKey | supporting | service_id, key_hash, key_prefix, label, revoked_at | belongs to Service |
| AuditLog | supporting | t, actor_type, actor_id, event, details (jsonb) | references various |

**Status enum** (used by subcheck + service + heartbeat): `ok | degraded | down` (server-side) + `unknown` (client-side fallback).

**Lifecycle enum** (new on Incident): `investigating | identified | monitoring | resolved`. Default = investigating.

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|--------------|-----|---------|--------|-----------------|
| 0 | 5 | 5 | - | - | N/A |
| 1 | 6 | 1 (IncidentUpdate) | - | 5 | 83% |
| 2 | 6 | 0 | 1 (Incident gains lifecycle_state) | 5 | 100% |
| 3 | 6 | 0 | 0 | 6 | 100% |
| 4 | 6 | 0 | 0 | 6 | 100% |
| 5 | 6 | 0 | 0 | 6 | 100% |
| 6 | 6 | 0 | 0 | 6 | 100% |
| 7 | 6 | 0 | 0 | 6 | 100% |
| 8 | 6 | 0 | 0 | 6 | 100% |
| 9 | 6 | 0 | 0 | 6 | 100% |

Ontology converged at Round 2 (after IncidentUpdate was named in Round 1 and Incident gained lifecycle_state in Round 2). All subsequent rounds clarified attributes/behaviors on already-named entities.

## Interview Transcript

<details>
<summary>Full Q&A (9 rounds + Round 0)</summary>

### Round 0 — Topology confirmation
**Q:** I read your 4 items as 4 top-level components (Typography upscale / Services row + strip / Incident flow / Homepage density). Is this topology right?
**A:** 4 components 都要做, 确认.

### Round 1 — Component 3 / Goal
**Q:** A single postmortem vs. a stream of timestamped updates — what shape do you want?
**A:** "Summary + 后续追加" two-layer (Atlassian Statuspage / Anthropic Status style).

### Round 2 — Component 3 / Constraints — auto vs manual
**Q:** When an incident opens, who writes the Summary, is there a human gate, what triggers a new Update?
**A:** Fully auto: DeepSeek writes Summary + state transitions auto-append Updates.

### Round 3 — Component 4 / Goal — what to compress
**Q:** Above-the-fold stack is 342px; what does "annoying" actually mean?
**A:** Drop "Services" section header. Keep TabBar independent (Status + Claude Code are the two core views, justify the row). About link can move up to header. Also add a link to lushuyu.site (personal site).

### Round 4 — Component 1 / Constraints — font scale
**Q:** How much bigger, uniform or per-component, admin parity?
**A:** Both surfaces base 16px, others proportional bump (×1.14).

### Round 5 — Component 2 / Constraints — strip shape
**Q:** 30 days × per-day? 90 days? 24 hours?
**A:** 30 days × per-day aggregate.

### Round 6 — Component 3 / Contrarian mode — DeepSeek cadence
**Q:** Flappy incident with 10 transitions/hour would call DeepSeek 10×; when is it actually rational?
**A:** Open / new-worst transition (5-min cooldown) / Close — three moments only.

### Round 7 — Component 3 / Simplifier mode — visibility surface
**Q:** Minimum surfaces where incidents must appear to count as "visible"?
**A:** Homepage banner + service row link + detail page — all three.

### Round 8 — Component 4 / Criteria — footer fate
**Q:** Header gets About + personal-site links; what about footer?
**A:** Remove footer entirely.

### Round 9 — Component 3 / Criteria — close rule
**Q:** When does an incident auto-close?
**A:** All affected subchecks `ok` for 5 consecutive minutes.

### Post-spec addition — Component 5 (user-driven)
**Context:** After the 9-round spec was crystallized and the execution-bridge question was asked, the user pushed back on the implicit assumption that every new UX pattern would be hand-rolled. They explicitly itemized: (1) regenerate polling-burst is reinventing TanStack `refetchInterval`'s functional form; (2) chip-visibility flag is reinventing `mutation.isPending || query.isFetching`; (3) optimistic updates via `onMutate` could replace mutate→invalidate→wait-refetch round-trips for publish/reject/api-key-revoke; (4) error-banner JSX is duplicated across mutations and should be a `<MutationErrorBanner>` component; (5) invalidate-by-predicate would replace per-key invalidation cascades. Plus broader-scope picks: `@tanstack/react-table` for admin tables, `react-hook-form` + `zod` (with zod schemas generated from the FastAPI OpenAPI doc) for forms, `sonner` toasts replacing `window.confirm` + the bespoke api-key-plaintext modal, `date-fns` replacing `lib/fmt.ts`, copy-in shadcn-style headless primitives. Explicit constraint: surgical, not a full design framework.
**Resolution:** Added as Component 5 to topology with its own AC §5.1-5.10. Ordering (do C5 first / intersperse with C1-C4 / refactor pass at end) deferred to the consensus planning phase via an ADR question. No new ontology entities; the change is package.json + component-shape level.

</details>

## Status

**pending approval**

Spec ready for the next pipeline stage. The recommended path is consensus refinement via `omc-plan --consensus --direct` so the schema decision (separate `incident_updates` table vs. JSONB array on the incident row), the DeepSeek-rewrite throttle implementation, and the exact wire shape of the new Update stream get a Planner / Architect / Critic triple-check before any source edits.
