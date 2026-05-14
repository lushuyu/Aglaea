# Implementation Plan: Aglaea Public Homepage Revamp (2026-05)

**Status:** `pending approval` (consensus reached — Architect REVISE → iteration 2 → Critic APPROVE)
**Source spec:** `.omc/specs/deep-interview-aglaea-homepage-revamp-2026-05.md` (ambiguity 16.5%, spec line 51 amended in iteration 2)
**Mode:** consensus · direct · non-interactive
**Iteration:** 2 (final — Critic APPROVED; three executor-scope notes folded back into Steps 2.2, 4.3, and a TanStack v5 `onSuccess`-removal fix)

---

## Requirements Summary

Restructure the Aglaea public homepage so **Status** and **Claude Code analytics** become in-body switchable panels (framer-motion `AnimatePresence`, hash deep-link, no routed navigation between them). Reorder each service row so subchecks sit in the middle and uptime moves to the right of subchecks; unify status badge sizing at fixed 110px right-aligned. Add a new bottom-half cross-service incident feed using `useInfiniteQuery` (20/page, no time floor) with a 60-second head poll that prepends new incidents via `AnimatePresence`. Introduce a minimal Tier-A animation language using framer-motion as the single motion primitive, respecting `prefers-reduced-motion` via `<MotionConfig reducedMotion="user">`.

## RALPLAN-DR Summary

### Principles
1. **Single motion primitive** — framer-motion is the only animation library.
2. **Brownfield minimalism** — modify what exists, delete what's redundant, introduce new components only where necessary.
3. **Hash-deep-link parity** — `/claude-code` bookmarks keep working via client-side redirect to `/#claude-code`. Back/forward navigates between hash states.
4. **Layout stability** — fixed 4-column grid + fixed 110px badge column = badge anchored at the same x-coordinate for every row.
5. **Accessibility-first motion** — `<MotionConfig reducedMotion="user">` wraps a **thin client shell** (not the whole public layout) so the rest of the layout stays a server component.

### Decision Drivers (top 3)
1. **User-visible UX consistency** — switcher feels native, badges align, animation looks intentional rather than busy.
2. **Code maintainability** — one motion library, deleted dead components, minimal new abstractions, no half-finished migrations.
3. **Backward compatibility** — `/claude-code` bookmarks, per-service `/services/[slug]/incidents` pages, and existing public API contracts must keep working.

### Viable Options

**A. Hash → panel state binding for HomePanels (#1)**

| Option | Pros | Cons |
|---|---|---|
| A1. Client toggle, hash + `useSyncExternalStore` (chosen) | Honors user's Round-3 decision ("URL stays at /"); no new Next.js concept surface; ~15 LoC; Strict-Mode safe | Forces a `'use client'` boundary on the homepage shell; SSR renders default panel before hydration |
| A2. Parallel routes + search param `/?panel=cc` (Architect's synthesis) | Keeps both panels as server components with full ISR; cleaner redirect; no hash-strip risk | Changes the URL on switch — contradicts user's explicit Round-3 "one URL" requirement |
| A3. Next.js `useSearchParams` | Idiomatic Next API | Same URL-change problem as A2; hash is not exposed via App Router anyway |

**Why A1 over the synthesis A2:** the user explicitly chose "in-page toggle, swap content, one URL" in Round 3 with the rendered preview confirming the hash-based model. A2 is architecturally cleaner but contradicts a stated user preference. We address A1's defects (Strict-Mode race, client-boundary infection, hash-strip) inside the steps below rather than overriding the user's decision.

**B. Cross-service incident feed data source (#3)**

| Option | Pros | Cons |
|---|---|---|
| B1. New `GET /api/public/incidents?limit=20&before=<cursor_ts>&before_id=<cursor_id>` (chosen) | One round trip per page; scales O(log N) with proper composite-index; cursor pagination is idiomatic for infinite scroll | Requires a new backend route + visibility unit test + composite cursor |
| B2. Client-side fanout over `/api/public/services/:slug/incidents` | No backend changes; reuses existing visibility predicate verbatim | O(N_services) requests per page-load AND per 60s poll; pagination across services is awkward (per-service cursors); merges duplicates if a service emits two incidents in the same millisecond |

**Why B1:** even at the current ~10-service scale, B2 issues 10 requests every 60 seconds per visitor. B1 issues 1. Cross-service merge with per-service cursors also has correctness problems (advancing one service's cursor leaves others stale). B1's correctness risks (visibility leak, duplicate cursors) are addressable with one test + composite cursor design; B2's correctness risks are systemic. **The spec line 51 self-contradiction (header "no new endpoints" vs body "endpoint-agnostic") was amended in iteration 2 to explicitly allow B1.**

**C. framer-motion package (#4)** — `framer-motion@^11` chosen. Peer-dep `react: ^18.0.0 || ^19.0.0` confirmed against this repo's `react@^18.3.1`.

**D. ServiceRow status-change animation** — `motion.div layout` prop chosen. Auto-magic, framer's primary use case.

**E. MotionConfig placement (new, raised by Architect)**

| Option | Pros | Cons |
|---|---|---|
| E1. Thin `<PublicMotionShell>` client wrapper around `{children}` inside `(public)/layout.tsx` (chosen) | Keeps `(public)/layout.tsx` a server component; only wraps the children that need motion; minimal `'use client'` infection | One extra file |
| E2. Mark `(public)/layout.tsx` itself `'use client'` | Single edit | Kills RSC for the entire public shell (header, footer, navbar) — fails Principle 2 |

**F. `/claude-code` redirect mechanism (new, raised by Architect)**

| Option | Pros | Cons |
|---|---|---|
| F1. `'use client'` page running `useEffect(() => router.replace('/#claude-code'))` (chosen) | Hash is set client-side, reliably preserved; works in every browser | Brief loading flash during JS hydration |
| F2. Server `redirect('/#claude-code')` | One-line; idiomatic | Hash fragment in `Location:` header is unreliably preserved across browsers/proxies (RFC 7231 §7.1.2 is ambiguous; Chromium preserves, others have historically stripped) |
| F3. Next.js middleware redirect | Edge-fast | Same hash-strip ambiguity as F2 |

---

## Acceptance Criteria

All 24 criteria from the deep-interview spec carry forward unchanged with two clarifications added by Architect feedback:

### #1 TabBar restructure
- [ ] AC-1.1 `frontend/components/PubTabBar.tsx` is deleted; `frontend/app/(public)/layout.tsx` no longer imports or renders it (lines 7 + 52 currently).
- [ ] AC-1.2 Two large rounded-rectangle switcher cards render inside `frontend/app/(public)/page.tsx`, positioned above the existing `<StatusBanner>` and active-incidents card.
- [ ] AC-1.3 Clicking a card toggles which panel is visible below without navigating (URL stays `/`); hash updates to `/#status` or `/#claude-code` via `history.replaceState` (no scroll jump).
- [ ] AC-1.4 The transition between panels uses `<AnimatePresence mode="wait">` with fade+slide (~180ms).
- [ ] AC-1.5 Navigating directly to `/claude-code` performs a **client-side** `router.replace('/#claude-code')` from a `'use client'` page and the Claude Code panel is preselected on mount.
- [ ] AC-1.6 Browser back/forward navigates between hash states via `popstate`; subscription uses `useSyncExternalStore` to be safe under React 18 Strict Mode double-invocation.
- [ ] AC-1.7 The Status card carries the `◎ live` glyph + sublabel; the Claude Code card carries `⟡ analytics`. Active card has accent-colored border and elevated shadow.
- [ ] AC-1.8 About does not appear anywhere in the body switcher (it remains only in the header).

### #2 Service row reorder + badge alignment
- [ ] AC-2.1 `frontend/styles/screens/public-overview.css:85` service-row grid is 4 columns: `1fr minmax(0, 280px) 280px 110px`.
- [ ] AC-2.2 `<UptimeStrip>` renders in column 3 (was column 2).
- [ ] AC-2.3 `<SubcheckStrip>` renders in column 2 (was column 3).
- [ ] AC-2.4 When a service has no subchecks, column 2 collapses to 0 width; uptime and badge stay in fixed slots so the badge right edge is consistent.
- [ ] AC-2.5 `<StatusBadge>` renders at fixed 110px width, text right-aligned, identical font-size + padding for every variant.
- [ ] AC-2.6 Visual diff: badge text baseline aligns across rows when stacked.
- [ ] AC-2.7 The `sm` size variant on `<StatusBadge>` continues to exist for other call sites but is not used inside homepage service rows.

### #3 Cross-service incident feed
- [ ] AC-3.1 A new `<IncidentFeed>` component renders below the service list on the homepage.
- [ ] AC-3.2 The feed shows the latest 20 incidents across all services on initial load, newest first.
- [ ] AC-3.3 Each feed row shows: service-name chip, incident status pill, duration (or "ongoing"), and started_at timestamp.
- [ ] AC-3.4 Each row is a Next.js `<Link>` to `/services/[slug]/incidents`.
- [ ] AC-3.5 Scrolling to the bottom triggers `useInfiniteQuery` to fetch the next 20 older incidents via the **composite cursor** `(started_at, id)` — the cursor sent to the API is the `started_at` and `id` of the **last** item on the current last page.
- [ ] AC-3.6 Every 60 seconds, a separate `useQuery` re-queries the head; new incidents (by `id` not already present in any cached page) prepend at the top with framer-motion fade+slide-down (~250ms). Items already in cache are NEVER duplicated.
- [ ] AC-3.7 Existing rows do not re-animate when new rows prepend (stable keys = `incident.id`).
- [ ] AC-3.8 Loading skeleton renders for the initial fetch and for "load more"; head-poll is silent.
- [ ] AC-3.9 Empty state `"No incidents recorded."` for zero-incident accounts.
- [ ] AC-3.10 (new, Architect) Backend route reuses the **exact same service-visibility predicate** that `/api/public/services/:slug/incidents` already enforces; a unit test creates an incident on a non-public service and asserts it is excluded.
- [ ] AC-3.11 (new, Architect) Backend route accepts and emits composite cursor `(started_at, id)`; pagination is stable across same-millisecond incidents.

### #4 Animation pass (Tier A)
- [ ] AC-4.1 `framer-motion@^11` is added to `frontend/package.json` (peer-dep `react: ^18.0.0 || ^19.0.0`).
- [ ] AC-4.2 `<MotionConfig reducedMotion="user">` wraps `{children}` via a new thin client component `<PublicMotionShell>` rendered inside `frontend/app/(public)/layout.tsx`; the layout itself stays a server component.
- [ ] AC-4.3 Switcher panel transition (AC-1.4) is the only `AnimatePresence` usage in the public homepage outside the incident feed.
- [ ] AC-4.4 `<ServiceRow>` uses `layout` prop so badge color + reorder shift tween 250ms when status changes.
- [ ] AC-4.5 Switcher cards and service rows have a hover variant: scale 1.01 + box-shadow lift, 120ms ease-out.
- [ ] AC-4.6 Incident feed prepend (AC-3.6) is the only other motion surface; no entrance stagger elsewhere.
- [ ] AC-4.7 No new CSS `@keyframes` added in this revamp; existing tokens.css keyframes stay untouched.

---

## Implementation Steps

Ordered by dependency.

### Phase 0 — Provider hoist (REQUIRED, was missing in iteration 1)

**Step 0.1** — Hoist `QueryClientProviderWrapper` from admin-only mount to a location that also serves the public route group.

- **Current state** (verified via grep): `QueryClientProviderWrapper` is mounted only at `frontend/app/admin/layout.tsx:27`. The public route group has no QueryClient. `<IncidentFeed>`'s `useInfiniteQuery` would throw `No QueryClient set` without this fix.
- **Action:** add a `QueryClientProvider` wrapper to the public route group. Two valid sub-options:
  - **Option 0.1a (preferred):** move the mount up to `frontend/app/layout.tsx` (root). One QueryClient shared by admin + public + every other route. Remove the duplicate mount in `app/admin/layout.tsx`.
  - **Option 0.1b:** add a second mount in `frontend/app/(public)/layout.tsx` (separate QueryClient per route group). Acceptable if there's a reason to isolate admin and public cache.
- **Risk gate:** if 0.1a is chosen, verify admin pages still receive their QueryClient (because the root layout now provides it). If 0.1b is chosen, verify public-only consumers don't depend on admin's cache and vice versa.

### Phase 1 — Foundation (framer-motion + MotionConfig shell)

**Step 1.1** — Install `framer-motion`.
- File: `frontend/package.json` — add `"framer-motion": "^11.11.0"` to `dependencies`; run `npm install`.

**Step 1.2** — Create thin client wrapper `<PublicMotionShell>`.
- File: `frontend/components/PublicMotionShell.tsx` (new, `'use client'`).
- Body: `import { MotionConfig } from 'framer-motion'; export default function PublicMotionShell({ children }) { return <MotionConfig reducedMotion="user">{children}</MotionConfig>; }`.

**Step 1.3** — Wire `<PublicMotionShell>` into the public layout.
- File: `frontend/app/(public)/layout.tsx` (keep as a **server component**).
- Action: wrap the rendered tree with `<PublicMotionShell>{...}</PublicMotionShell>`. This isolates the `'use client'` boundary to the motion shell only; the rest of the layout (header chrome, footer, server-side data) stays RSC.

### Phase 2 — TabBar restructure (#1)

**Step 2.1** — Create `<SwitcherCard>` component.
- File: `frontend/components/SwitcherCard.tsx` (new, `'use client'`).
- Props: `{ icon: ReactNode, label: string, sublabel: string, active: boolean, onClick: () => void }`.
- Renders as `motion.button` with hover variant `{ scale: 1.01, boxShadow: 'var(--shadow-lift)' }`, 120ms ease-out; active-state visual is accent-colored border + elevated shadow.

**Step 2.2** — Create `<HomePanels>` client controller.
- File: `frontend/components/HomePanels.tsx` (new, `'use client'`).
- Hash subscription via `useSyncExternalStore` (NOT `useEffect` + `useState`) so React 18 Strict Mode double-invocation does not overwrite user input:
  ```tsx
  function subscribe(cb: () => void) {
    window.addEventListener('hashchange', cb);
    return () => window.removeEventListener('hashchange', cb);
  }
  function getSnapshot() { return window.location.hash; }
  function getServerSnapshot() { return ''; }
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const activePanel = hash === '#claude-code' ? 'cc' : 'status';
  ```
- On user click: call `history.replaceState(null, '', newHash)` then `window.dispatchEvent(new HashChangeEvent('hashchange'))` to fire the store update. `history.replaceState` does NOT auto-emit `hashchange` per the HTML spec — the manual dispatch is required.
- Render: `<SwitcherCard>` × 2, then `<AnimatePresence mode="wait">` wrapping `<motion.div key={activePanel}>` that selects between `statusPanel` and `ccPanel` ReactNode props.
- **Pre-rendering:** both `statusPanel` and `ccPanel` are passed as ReactNode props from the parent server component (`page.tsx`), so both panels' children are rendered server-side and the active one is mounted (the inactive one is detached by AnimatePresence). This is an explicit trade — see R10 below.

**Step 2.3** — Refactor homepage to use HomePanels.
- File: `frontend/app/(public)/page.tsx`.
- Keep server-side data fetching for Status (current contents at lines 26-80).
- Extract Claude Code panel body into `frontend/components/ClaudeCodePanel.tsx` from `frontend/app/(public)/claude-code/page.tsx`. The extracted component stays a server component (preserves `revalidate = 30`).
- Pass both as ReactNode props: `<HomePanels statusPanel={<StatusPanel ... />} ccPanel={<ClaudeCodePanel />} />`.
- **Forbid:** the executor must NOT mark `ClaudeCodePanel.tsx` as `'use client'`. Server-side ISR must be preserved.

**Step 2.4** — Remove PubTabBar from layout.
- File: `frontend/app/(public)/layout.tsx:7` — remove `import PubTabBar from "@/components/PubTabBar"`.
- File: `frontend/app/(public)/layout.tsx:52` — remove `<PubTabBar />`.

**Step 2.5** — Delete `PubTabBar.tsx`.
- File: `frontend/components/PubTabBar.tsx` — delete.
- Post-condition: `grep -rn "PubTabBar" frontend/` returns zero results.

**Step 2.6** — Convert `/claude-code` route into a **client-side** redirect.
- File: `frontend/app/(public)/claude-code/page.tsx`.
- Replace its body with:
  ```tsx
  'use client';
  import { useEffect } from 'react';
  import { useRouter } from 'next/navigation';
  export default function Page() {
    const router = useRouter();
    useEffect(() => { router.replace('/#claude-code'); }, [router]);
    return null;
  }
  ```
- This ensures the hash is set client-side and reliably preserved (no RFC 7231 ambiguity).

**Step 2.7** — CSS: remove PubTabBar styles, add switcher card styles.
- File: `frontend/styles/screens/public-overview.css`.
- Remove `.pub-tab-bar` rules around line 15.
- Add `.switcher-cards` grid container (`display: grid; grid-template-columns: 1fr 1fr; gap: 16px`) and `.switcher-card` styles (rounded-rectangle, accent border on active state, dark/light theme tokens, ~120-160px tall).

### Phase 3 — Service row + badge alignment (#2)

**Step 3.1** — Update CSS grid.
- File: `frontend/styles/screens/public-overview.css:85`.
- Replace existing grid-template-columns with `1fr minmax(0, 280px) 280px 110px`; preserve column-gap.

**Step 3.2** — Swap JSX column order.
- File: `frontend/app/(public)/page.tsx` (service-row mapping lines ~224-264).
- Move `<SubcheckStrip>` to column 2 (was column 3).
- Move `<UptimeStrip>` to column 3 (was column 2).
- Wrap each row's outer container in `motion.div layout`.

**Step 3.3** — Unify `<StatusBadge>` homepage sizing.
- File: `frontend/components/StatusBadge.tsx:62-98`.
- Add a `size="row"` variant (or equivalent prop): `width: 110px`, `text-align: right`, identical font-size + padding for every status variant.
- Preserve existing `md` and `sm` variants for other call sites.

### Phase 4 — Cross-service incident feed (#3)

**Step 4.1** — Add backend route `GET /api/public/incidents`.
- File: under `backend/app/api/public/...` (exact path follows existing FastAPI router structure — confirm at execution time).
- Query params:
  - `limit` (default 20, max 100).
  - `before_ts` (ISO timestamp, optional) AND `before_id` (incident id, optional) — composite cursor; if either is missing, treat as no cursor.
- Response: `IncidentWithService[]` — flat list joined with the service row (so payload includes `service_slug` + `service_name`).
- Ordering: `ORDER BY started_at DESC, id DESC` (composite cursor requires composite sort).
- Cursor logic: `WHERE (started_at, id) < (before_ts, before_id)` (lexicographic tuple comparison; equivalent to `started_at < ? OR (started_at = ? AND id < ?)`).
- Visibility: reuse the **exact same predicate** that `/api/public/services/:slug/incidents` already enforces (the user-visibility join). Do not re-implement.
- Test (AC-3.10): unit test that creates an incident on a non-public service and asserts the endpoint excludes it.

**Step 4.2** — Add client API function `listAllIncidents`.
- File: `frontend/lib/api.ts` (next to existing incident functions at lines 82-90 and 341-349).
- Signature: `listAllIncidents({ limit, beforeTs, beforeId }: { limit?: number; beforeTs?: string; beforeId?: string }) → Promise<IncidentWithService[]>`.

**Step 4.3** — Create `<IncidentFeed>` client component.
- File: `frontend/components/IncidentFeed.tsx` (new, `'use client'`).
- Infinite query:
  ```tsx
  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['public-incidents'],
    queryFn: ({ pageParam }) => listAllIncidents({ limit: 20, ...pageParam }),
    initialPageParam: {},
    getNextPageParam: (lastPage) => {
      const last = lastPage[lastPage.length - 1];
      return last ? { beforeTs: last.started_at, beforeId: last.id } : undefined;
    },
  });
  ```
- Infinite-scroll trigger: `IntersectionObserver` on a sentinel `<div>` at the list bottom (NOT framer's `useInView`, which fires on visibility flips). Default config: `rootMargin: '200px'` (pre-load before sentinel is visible), `threshold: 0`. The observer is created in a `useEffect` keyed on the sentinel ref; cleanup disconnects on unmount or when `hasNextPage` is false.
- **Head poll** (separate query — TanStack Query v5 removed `onSuccess` on `useQuery`, so the merge runs inside the `queryFn` itself):
  ```tsx
  const queryClient = useQueryClient();
  useQuery({
    queryKey: ['public-incidents-head'],
    queryFn: async () => {
      const head = await listAllIncidents({ limit: 20 });
      queryClient.setQueryData<InfiniteData<IncidentWithService[]>>(
        ['public-incidents'],
        (old) => {
          if (!old) return old;
          const existingIds = new Set(old.pages.flat().map(i => i.id));
          const newOnes = head.filter(i => !existingIds.has(i.id));
          if (newOnes.length === 0) return old; // no-op keeps reference stable so React skips re-render
          // Prepend new incidents to page 0; do NOT modify page count or page boundaries.
          const newPage0 = [...newOnes, ...old.pages[0]];
          return { ...old, pages: [newPage0, ...old.pages.slice(1)] };
        }
      );
      return head; // return value is unused but required by useQuery
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
  ```
- **Why this is dedupe-safe:** the `existingIds` set guarantees no incident appears twice. The cursor for `getNextPageParam` reads from the **last** item of the **last** page, so prepending to page 0 does not invalidate cursors.
- **Why the cursor invariants hold:** `getNextPageParam` is called only when fetching the next page; it reads `pages[pages.length - 1][last]`. Mutating `pages[0]` is safe because we never alter `pages[length-1]` boundaries.
- Render: `<AnimatePresence initial={false}>` around `<motion.li key={incident.id}>` items with `initial={{ opacity: 0, y: -8 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0 }}`, `transition={{ duration: 0.25 }}`. `initial={false}` is critical — without it, every existing item animates on mount.
- Empty state when total count is 0.
- Loading skeleton for initial load + load-more; head poll is silent.

**Step 4.4** — Mount `<IncidentFeed>` on the homepage.
- File: `frontend/app/(public)/page.tsx`.
- Add below the service list section with an h2/h3 heading (copy decision: "Recent Incidents" — confirm in execution).

### Phase 5 — Animation polish & wiring (#4)

**Step 5.1** — Confirm hover variants on `<SwitcherCard>` (Step 2.1) and `<ServiceRow>` (Step 3.2): `whileHover={{ scale: 1.01, boxShadow: 'var(--shadow-lift)' }}`, `transition={{ duration: 0.12, ease: 'easeOut' }}`.

**Step 5.2** — Manual test with `prefers-reduced-motion: reduce` enabled in DevTools — confirm `<MotionConfig reducedMotion="user">` disables non-essential motion.

**Step 5.3** — Audit framer-motion imports — must appear only in `HomePanels`, `SwitcherCard`, `PublicMotionShell`, the service-row wrapper in `page.tsx`, and `IncidentFeed`. Nowhere else.

### Phase 6 — Verification

**Step 6.1** — `cd frontend && npm run typecheck`.
**Step 6.2** — `cd frontend && npm run lint`.
**Step 6.3** — `cd frontend && npm test` (or skip if no test script).
**Step 6.4** — Backend unit test for visibility (Step 4.1 test).
**Step 6.5** — Manual smoke test (V5 – V13 below).

---

## Risks and Mitigations

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Hash-based panel state breaks SSR — homepage is server-rendered | High | Low | `<HomePanels>` is a `'use client'` boundary; server renders default Status panel; brief hash sync flash post-hydration is acceptable since both panels are public. |
| R2 | `framer-motion` peer-dep conflict with React 18.3 / Next 15 | Low | Medium | Verified: `framer-motion@^11` declares `react: ^18.0.0 \|\| ^19.0.0`. Pin to `^11.11.0` in package.json. `npm install` fails loudly on mismatch. |
| R3 | 60s head poll × N visitors → backend load | Medium | Low | Single endpoint (B1) with cursor pagination is O(log N) per query. Add a 10s server-side cache on the head query as a follow-up if observed. |
| R4 | New `/api/public/incidents` endpoint leaks incidents of non-public services | Low | High | Reuse the exact same visibility predicate as `/api/public/services/:slug/incidents`. AC-3.10 unit test asserts this. |
| R5 | `motion.div layout` on every service row causes jitter when many rows render | Low | Low | `layout` re-tweens only on actual position/size changes; service rows rarely move. If observed, switch to `layout="position"`. |
| R6 | Removing PubTabBar breaks an unseen import | Low | Medium | Grep enumerated all 3 references (`PubTabBar.tsx:13`, `layout.tsx:7`, `layout.tsx:52`); Step 2.4 + 2.5 remove all three. CI typecheck catches anything missed. |
| R7 | Hash sync re-fires under React 18 Strict Mode double-invocation | Medium | Medium | Use `useSyncExternalStore` (Step 2.2) — by design idempotent and Strict-Mode safe. |
| R8 | `IncidentFeed` throws "No QueryClient set" because public route has none | **Was certain; now mitigated** | High | **Phase 0 / Step 0.1** hoists `QueryClientProvider` to a location that serves both admin and public. Verified the current sole mount is `app/admin/layout.tsx:27`. |
| R9 | `/claude-code` server redirect strips the hash | **Was certain; now mitigated** | Medium | Step 2.6 uses a **client-side** redirect (`'use client'` page with `useEffect(router.replace)`). Hash is set client-side and reliably preserved. |
| R10 | Both panels' server-rendered data fetches on every `/` load (CC fetch fires even when user views Status) | Medium | Low | Acknowledged trade for honoring user's "one URL" Round-3 choice. Each panel keeps its own `revalidate = 30` ISR so the cost is amortized. Follow-up optimization (lazy CC fetch via client `useQuery`) can be added later without changing this plan's contract. |
| R11 | Head-poll merge creates duplicates if `setQueryData` runs concurrently with `fetchNextPage` | Low | Medium | The dedupe-by-id set in Step 4.3 guarantees no `id` appears twice regardless of race ordering. Cursor for next-page reads from `pages[last][last]` which is unaffected by page-0 prepend. |
| R12 | Composite cursor `(started_at, id)` returns wrong window if backend doesn't enforce tuple comparison correctly | Medium | Medium | Step 4.1 explicitly specifies `(started_at, id) < (before_ts, before_id)`; AC-3.11 requires same-millisecond-incident pagination test. |

## Verification Steps

| ID | Check | Method | Pass criterion |
|---|---|---|---|
| V1 | TypeScript compiles | `cd frontend && npm run typecheck` | Exit 0 |
| V2 | Lint passes | `cd frontend && npm run lint` | Exit 0 |
| V3 | Existing tests pass | `cd frontend && npm test` | Exit 0 or N/A |
| V4 | No PubTabBar references remain | `grep -rn PubTabBar frontend/` | Zero results |
| V5 | Switcher click swaps panels + updates hash | Manual: click each card | URL hash matches `#status` / `#claude-code`; panel content swaps |
| V6 | Back/forward navigates hash states | Manual: click cards then press Back | Previous panel re-selected |
| V7 | `/claude-code` redirects and preselects CC | Manual: visit `/claude-code` | Lands at `/#claude-code` with CC panel active |
| V8 | Service-row layout is consistent | Manual visual diff | Badge right edges align with and without subchecks |
| V9 | All status badges same size | Manual visual diff | All variants identical width 110px |
| V10 | Incident feed initial 20 + infinite scroll | Manual: scroll to bottom | Load-more triggers; next 20 append |
| V11 | Head poll prepends new incident with animation | Manual: create test incident via admin, wait 60s | New row appears at top with fade+slide; no duplicates |
| V12 | New endpoint excludes private-service incidents | Backend unit test (Step 4.1 test) | Private incident not in response |
| V13 | Reduced motion disables non-essential motion | DevTools: enable `prefers-reduced-motion: reduce` | Switcher transitions snap; feed prepend snaps |
| V14 | Strict Mode double-effect does not desync hash | Dev mode + React Strict Mode + rapid click | Active panel matches hash 100% of the time |
| V15 | Composite cursor handles same-millisecond incidents | Backend unit test: insert two incidents at same `started_at` | Pagination returns both exactly once, no skip or duplicate |

---

## ADR

### Decision
Use a hash-based in-page panel toggle (option A1), a new flat `GET /api/public/incidents` endpoint with composite cursor (option B1), `framer-motion@^11` as the single motion primitive (option C1), `motion.div layout` for service-row animation (option D1), a thin `<PublicMotionShell>` client wrapper for `<MotionConfig>` (option E1), and a client-side `router.replace` for the `/claude-code` redirect (option F1).

### Drivers
1. **Honor user's Round-3 decision** ("URL stays at /") — rules out parallel-route synthesis (A2) even though it is architecturally cleaner.
2. **Correctness at scale** — rules out client-side fanout (B2) because cross-service merge + per-service cursors compound correctness problems.
3. **Server-component preservation** — rules out marking `(public)/layout.tsx` itself `'use client'` (E2); a thin shell is enough.
4. **Cross-browser hash preservation** — rules out server-side redirect (F2/F3) because hash-fragment-in-`Location` is ambiguous across browsers.

### Alternatives Considered
- **A2: Parallel routes + search param** — Architect's synthesis. Architecturally superior (keeps both panels as RSC, lazy CC fetch, clean redirect). Rejected because it changes the URL on switch, contradicting the user's explicit Round-3 "one URL" preference. Recorded for a possible future redesign if the user later relaxes the constraint.
- **B2: Client-side fanout** — no backend change. Rejected because (a) 10 requests per 60s poll per visitor, (b) cross-service merge with per-service cursors has correctness gaps (advancing one cursor leaves others stale, same-millisecond cross-service duplicates).
- **E2: Mark layout `'use client'`** — single edit. Rejected because it kills RSC for the entire public shell.
- **F2/F3: Server / middleware redirect** — one line. Rejected because hash preservation is browser-dependent.

### Why Chosen
The chosen combination is the minimum-divergence path from both the user's explicit decisions in the deep interview AND the Architect's correctness concerns. Every deviation from the architecturally-cleanest option is justified by a specific user preference recorded in the interview transcript.

### Consequences
- (+) Behaviorally matches the spec's preview mockups and the user's Round 3/7 choices.
- (+) No backend visibility-leak risk (predicate reuse + unit test).
- (+) Head-poll merge is dedupe-safe and cursor-stable.
- (+) Strict-Mode safe hash subscription.
- (+) RSC preserved for the public layout shell.
- (–) Both panels' data fetches on every `/` load (~2× backend cost for CC vs lazy-load) — see R10.
- (–) Brief hash-sync flash on first paint when arriving at `/#claude-code` — see R1.
- (–) Brief loading flash during `/claude-code` redirect — see Step 2.6.

### Follow-ups
1. Optionally migrate to parallel-route synthesis (A2) if the user later accepts URL-change-on-switch — removes R1 and R10 entirely.
2. Add a 10s server-side cache on the head-query endpoint if R3 observed in production.
3. Reconsider lazy CC fetch via client `useQuery` if backend cost from R10 becomes material.

---

## File Inventory

**Created (6):**
- `frontend/components/SwitcherCard.tsx`
- `frontend/components/HomePanels.tsx`
- `frontend/components/ClaudeCodePanel.tsx` (extracted from `/claude-code/page.tsx` body — must stay a server component)
- `frontend/components/PublicMotionShell.tsx` (thin client wrapper for `<MotionConfig>`)
- `frontend/components/IncidentFeed.tsx`
- Backend route file for `GET /api/public/incidents` (exact path TBD during execution)

**Modified (7):**
- `frontend/package.json` — add framer-motion
- `frontend/app/layout.tsx` OR `frontend/app/(public)/layout.tsx` — host `QueryClientProvider` (Phase 0)
- `frontend/app/admin/layout.tsx` — remove duplicate `QueryClientProvider` if option 0.1a chosen
- `frontend/app/(public)/layout.tsx` — remove PubTabBar import/render; wrap children with `<PublicMotionShell>`
- `frontend/app/(public)/page.tsx` — add HomePanels, restructure service-row grid, add IncidentFeed
- `frontend/app/(public)/claude-code/page.tsx` — replace body with client-side `router.replace('/#claude-code')`
- `frontend/components/StatusBadge.tsx` — homepage variant 110px right-aligned
- `frontend/styles/screens/public-overview.css` — drop tab bar styles, add switcher card styles, change service-row grid template
- `frontend/lib/api.ts` — add `listAllIncidents`

**Deleted (1):**
- `frontend/components/PubTabBar.tsx`

---

## Changelog

### Iteration 2 polish (post-Critic APPROVE)
Three executor-scope fixes folded back to keep the plan copy-pasteable:
- Step 4.3 head-poll: replaced removed-in-v5 `onSuccess` callback with an in-`queryFn` merge.
- Step 2.2 hash store: explicit `window.dispatchEvent(new HashChangeEvent('hashchange'))` after `history.replaceState` (HTML spec requires manual dispatch).
- Step 4.3 IntersectionObserver: explicit defaults (`rootMargin: '200px'`, `threshold: 0`) + cleanup on unmount / `hasNextPage` false.

### Iteration 1 → 2 (post-Architect REVISE)

Resolved 7 Architect findings:

1. **Spec self-contradiction at line 51** — amended the spec body to remove the contradictory "No new backend endpoints" header. The spec is endpoint-agnostic; B1 is the consensus choice with safety constraints.
2. **R8 false claim** — verified `QueryClientProvider` is only mounted in `app/admin/layout.tsx:27`. Added explicit **Phase 0** to hoist or duplicate the provider so the public route group has one.
3. **R9 fragile hash redirect** — replaced server `redirect('/#claude-code')` with a client-side `useEffect(() => router.replace('/#claude-code'))` in a `'use client'` page (option F1).
4. **Head-poll merge underspecified** — Step 4.3 now includes explicit dedupe-by-id set, page-0 prepend with no cursor invalidation, and `initial={false}` on `AnimatePresence` so existing rows don't re-animate.
5. **Composite cursor missing** — Step 4.1 + AC-3.11 + V15 require `(started_at, id)` cursor with lexicographic tuple comparison.
6. **MotionConfig client infection** — Step 1.2 + 1.3 introduce a thin `<PublicMotionShell>` client component so `(public)/layout.tsx` stays a server component (option E1).
7. **Strict Mode hash race** — Step 2.2 uses `useSyncExternalStore` instead of `useEffect` + `useState` for hash subscription (AC-1.6, V14).

Plus:
- ADR section added.
- Added options E (MotionConfig placement) and F (`/claude-code` redirect mechanism) to RALPLAN-DR Viable Options.
- Risks R7, R8, R9, R10, R11, R12 expanded with concrete mitigations.
- Acceptance criteria AC-3.10 + AC-3.11 added.
- Verification V14 + V15 added.
- File inventory expanded by 1 (PublicMotionShell) + 1 (admin layout deduplication) + 1 (root layout if option 0.1a).
