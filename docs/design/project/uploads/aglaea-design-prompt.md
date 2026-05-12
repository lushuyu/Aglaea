# Project Aglaea — Frontend Design Brief

Design the complete frontend for a personal status & analytics platform called **Aglaea**. Produce a high-fidelity, clickable HTML/React prototype covering every screen listed below, plus a coherent design system (tokens, components, typography, dark/light themes).

---

## 1. Product context

**Aglaea** is one developer's private SRE platform. It does two things in one UI:

1. **Public status page** — like `status.claude.com`. Shows whether a small set of self-hosted services is up, displays incident history, and shows aggregated Claude Code usage analytics. Anyone can view, no login.
2. **Private admin dashboard** — full management interface for the same data, plus sensitive metrics. Requires GitHub OAuth login.

The name "Aglaea" comes from Greek mythology — one of the Three Graces (Charites), goddess of beauty, splendor, and glory. The sibling services it monitors are also named after classical figures: **Hyacine** (a mailbox briefing system), **Cerydra** (a Discord investment-group agent), **Cipher** (an ETF simulation platform). Lean into the classical/celestial naming when picking visual metaphors, but the UI itself should be a serious, information-dense modern monitoring tool — not skeuomorphic Greek architecture. Think "status pages designed by someone who reads Tufte" with a thin layer of mythological warmth in copy and accent illustration.

**Users**:
- Public visitors (occasional, curious about whether a service is up)
- The owner (daily, lives in the admin panel during incidents)

**Aesthetic constraints**:
- Dark mode is the default. Provide a light mode too.
- Information density should be high — the owner uses this on a desktop monitor next to terminal windows.
- Public side can be slightly more decorative; admin side prioritizes scannability.
- Avoid generic "cloud SaaS" sterility. A small amount of typographic character (a serif display face for headings, restrained accent colors) is welcome.

---

## 2. Information architecture

Two completely separate route trees. The public side never links to admin URLs. Admin side has a small "view as public" affordance.

### Public (no auth)

```
/                                     status overview
/services/{slug}                      service detail
/services/{slug}/incidents            incident history list
/services/{slug}/incidents/{id}       single incident
/claude-code                          Claude Code analytics dashboard
/about                                what Aglaea is, why it exists
```

### Admin (GitHub OAuth gated)

```
/admin                                dashboard
/admin/services                       service registry
/admin/services/{id}                  service detail + key management
/admin/services/new                   add service
/admin/incidents                      all incidents (incl. unpublished drafts)
/admin/incidents/{id}                 incident review (the critical screen)
/admin/claude-code                    full analytics (with host.name split)
/admin/audit-log                      auth failures and important events
/admin/settings                       global config
```

### Auth

```
/login                                GitHub OAuth entry
/auth/callback                        callback handler
```

---

## 3. Data model (what each screen has to work with)

### Service object

```json
{
  "slug": "cerydra",
  "display_name": "Cerydra",
  "description": "Discord investment-group agent",
  "kind": "push",
  "last_heartbeat_at": "2026-05-13T07:30:00Z",
  "last_status": "ok",                      // ok | degraded | down | unknown
  "last_subchecks": {
    "jin10":    { "status": "ok",       "latency_ms": 120,  "message": null },
    "moomoo":   { "status": "degraded", "latency_ms": 4800, "message": "high latency" },
    "deepseek": { "status": "ok" },
    "discord":  { "status": "ok" }
  },
  "uptime_30d_pct": 99.42,
  "current_incident_id": null
}
```

Note that subchecks are **arbitrary key-value** — different services have different ones. The UI must render any nested structure gracefully (Cerydra has 4, Hyacine has 3, a static page has none).

### Incident object (public)

```json
{
  "id": 42,
  "service_slug": "cerydra",
  "status": "resolved",                     // ongoing | resolved
  "started_at": "2026-05-12T14:23:00Z",
  "resolved_at": "2026-05-12T15:01:00Z",
  "affected_subchecks": ["jin10"],
  "published_text": "On May 12 around 14:23 SGT, Cerydra's Jin10 MCP component lost connectivity. The agent continued to serve cached news for 38 minutes before connectivity restored automatically. Similar to the May 8 incident — this pattern recurs roughly weekly and is being investigated upstream.",
  "published_at": "2026-05-12T15:30:00Z"
}
```

If a public incident is `ongoing` and has no `published_text` yet, the public UI must show **skeleton information only**: which service, when it started, current subcheck state, no narrative. Do **not** invent narrative text. Communicate the bare facts and the fact that an update is pending review.

### Incident object (admin)

Same as public, plus:

```json
{
  "report_state": "draft",                  // none | draft | published | rejected
  "report_text": "<latest auto-generated draft, may differ from published_text>",
  "report_generated_at": "2026-05-12T15:05:00Z",
  "report_generation_count": 4,
  "report_generation_reason": "subcheck_changed",
  "heartbeat_timeline": [/* recent heartbeats during incident */],
  "recent_similar_incidents": [/* same service, last 30d */]
}
```

### Claude Code metrics (public — host.name aggregated away)

```json
{
  "token_total_30d": [{ "ts": "...", "value": 1234567 }, ...],
  "token_by_model": [
    { "model": "claude-opus-4-7",    "value": 234567 },
    { "model": "claude-sonnet-4-6",  "value": 890123 }
  ],
  "cost_trend_30d": [{ "ts": "...", "usd": 4.23 }, ...],
  "cache_hit_rate_7d": 0.62,
  "active_time_ratio_7d": { "cli": 41200, "user": 88300 },
  "sessions_daily_30d": [{ "date": "2026-05-12", "count": 17 }, ...],
  "commits_daily_30d": [...],
  "loc_daily_30d": [{ "date": "...", "added": 1234, "removed": 567 }],
  "active_hours_heatmap": [/* 7 days × 24 hours, count per cell */],
  "terminal_type_share": [{ "type": "iTerm.app", "value": 0.7 }, ...]
}
```

### Claude Code metrics (admin — adds host.name dimension)

Same series, but each value optionally split by `host_name` ∈ {`mac`, `win`, `sg-vps`}. Toggle in UI to show stacked vs aggregated.

---

## 4. Screens to design

For each screen, design the full layout, all states (loading, empty, error), and key interactions. Build them as a clickable React prototype with mock data.

### 4.1 Public status overview (`/`) — the hero screen

The most-viewed screen. Should give a definitive "is everything OK" answer in under a second.

Must include:
- A global status banner at the top — one of three states: "All systems operational" (green), "Some services degraded" (amber), "Active incidents" (red). Banner shows the message of the worst ongoing incident if any.
- A list of services, each as a horizontal row or card. Each row shows:
  - Service display name + small classical-themed glyph or initial
  - Current status with color + label
  - Subcheck strip (compact representation of nested subchecks — e.g., colored dots in a row labeled by subcheck name)
  - 30-day uptime % and a sparkline of uptime by day
  - Link to detail
- "Active incidents" section pinned above services if any are ongoing
- "Recent incidents" section at the bottom — last 5 resolved
- Footer with link to Claude Code analytics and "About Aglaea"
- Auto-refresh every 30 seconds with subtle visual indicator

States: loading skeleton; all-green happy state; one-service-down state; multi-incident state; empty state (no services configured — shouldn't happen but design it anyway).

### 4.2 Public service detail (`/services/{slug}`)

For one service in depth. Must include:
- Service name, description, current status
- Subchecks rendered as a list/grid, each with its own current status, recent message, latency if applicable
- 30-day uptime calendar (one cell per day, color-coded)
- Heartbeat timeline (last hour, as a horizontal strip of status segments — like Vercel's uptime visualization)
- Active incident card if any (skeleton form during ongoing-unpublished)
- Link to incident history

### 4.3 Public incident page (`/services/{slug}/incidents/{id}`)

For one incident. Must include:
- Service, status (ongoing/resolved), duration
- Timeline of subcheck state changes during the incident
- `published_text` rendered as prose (markdown-capable)
- Linked references to similar past incidents if the post-mortem mentions them
- For ongoing-unpublished: clear visual treatment showing "no narrative yet, monitoring in progress" + the skeleton timeline. No placeholder text that could be mistaken for content.

### 4.4 Public Claude Code dashboard (`/claude-code`)

A small analytics page. Sections:
- Top stat row: total tokens this week, total cost (USD est.), cache hit rate, active time ratio
- Token usage trend (line chart, 30 days)
- Cost trend (line chart, 30 days)
- Model split (donut or stacked bar)
- Sessions per day (bar chart)
- Commits / LOC per day (small multiples)
- Active hours heatmap (7×24 grid)
- Terminal type share (small)

Keep it readable — this is a public page, casual visitor should grasp "the owner uses Claude Code roughly this much, productively". The owner sees the same view, just with host_name split on the admin side.

### 4.5 Login (`/login`)

Single button: "Sign in with GitHub". Note that only one specific GitHub account is allowlisted; show a friendly error if someone else tries.

### 4.6 Admin dashboard (`/admin`) — the daily entry point

What the owner sees first thing every day. Must include:
- Glance row: services up / total, ongoing incidents count, unpublished drafts waiting for review, anomalies flagged
- Ongoing incidents card (most prominent if any) — quick links to review
- Drafts pending review (auto-generated by DeepSeek, awaiting admin publish)
- Recent activity feed (heartbeat anomalies, recent regenerations, audit events)
- Quick links to each major admin section

### 4.7 Admin services list (`/admin/services`)

Table or card grid of all services (public + private). Each row shows:
- Slug, display name, kind (push/pull), public visibility toggle
- Current status, last heartbeat
- Number of active API keys
- Actions: edit, view, delete

Top-right: "Add service" button.

### 4.8 Admin service detail (`/admin/services/{id}`)

For managing one service. Sections:
- Metadata editor (display name, description, intervals, public_visible, deepseek_context)
- Subcheck configuration (display labels, ordering — for rendering)
- API keys section:
  - List of keys with label, prefix, created date, last used, revoke button
  - "Generate new key" button → modal shows plaintext **once** with clear "copy now, won't be shown again" warning
- Recent heartbeats table (last 50)
- Recent incidents

### 4.9 Admin incident review (`/admin/incidents/{id}`) — the critical screen

This is where the owner spends time during/after incidents. Most novel UX.

The screen has these zones:

**Left/main: incident timeline & data**
- Service, status, duration
- Subcheck state-change timeline (as a horizontal swimlane chart, one lane per subcheck, colored segments for status)
- Heartbeat events table (filterable)
- "Recent similar incidents" sidebar with linked summaries

**Right: report editor**
- Current `published_text` (if any) — read-only, labeled clearly
- Latest auto-generated `report_text` — editable markdown
- Diff view between `published_text` and `report_text` so the owner can see what's new
- Generation metadata: count, last generated at, reason (`initial` / `subcheck_changed` / `periodic` / `final`)
- Actions:
  - **Publish** — copy `report_text` → `published_text`, public now sees it
  - **Reject** — discard current draft, don't publish
  - **Regenerate** — text input for an instruction ("focus on the recurrence pattern with Jin10"), then regenerate button. Single-shot, replaces current draft.
  - **Save edits** — manual changes to `report_text` without regenerating
- Live indicator: "draft will auto-regenerate when subchecks change or every 30 min"

This screen should make the cost-of-mistake low: nothing goes public until **Publish** is clicked, and the diff makes it impossible to accidentally publish unreviewed AI content.

### 4.10 Admin Claude Code dashboard (`/admin/claude-code`)

Same as public version but with:
- Host filter chips (all / mac / win / sg-vps) — applies to all charts
- Stacked variant of every chart by host
- Additional sensitive panels: cost forecasting, anomaly highlights, raw PromQL textarea for ad-hoc queries

### 4.11 Audit log (`/admin/audit-log`)

Filterable table:
- Timestamp, actor type, actor ID, event, IP, details (expandable JSON)
- Filter by event type and date range
- Sort by time descending

### 4.12 Admin settings (`/admin/settings`)

- DeepSeek API status (last call, success/failure rate, no key shown)
- Notification destinations (ntfy URL, healthchecks linkage — read-only)
- Retention policies (display only, configured server-side)
- "Export all incidents as JSON" button

---

## 5. Design system requirements

Deliver a coherent design system before assembling screens.

**Color**: a desaturated, slightly cool dark palette as default. Status colors clearly distinguishable for the 1 in 12 men with red-green color blindness — pair color with shape or label, never color alone.

**Typography**: pair a serif display face (for page titles, incident titles, hero numbers) with a clean sans for UI text and a monospace for data. Suggest: Source Serif 4 / Inter / JetBrains Mono, or comparable. Use a typographic scale, not arbitrary sizes.

**Spacing & layout**: 8-point grid. Generous whitespace on public side, tighter on admin. Max content width on public pages (don't sprawl on ultrawide); full-width admin tables.

**Components needed**: status badge, status banner, subcheck strip, sparkline, uptime calendar cell, heartbeat segment, timeline swimlane, stat tile, donut chart, line chart, bar chart, heatmap cell, diff viewer, markdown editor, API key reveal modal, confirmation modal, filter chip, audit log row.

**Iconography**: prefer geometric line icons. The classical-mythology accent can show up in a single small mark (constellation-inspired logo, three-graces motif somewhere subtle) — do not overuse.

**Motion**: minimal. Status transitions can have a 200ms color fade. No bouncing, no parallax. Loading states should feel calm.

---

## 6. Constraints to enforce in the design

- The public side **must not** display: host names, IP addresses, deployment topology, raw token counts beyond what's already in scope, internal API URLs, error stack traces.
- The admin side **must** make the "draft vs published" boundary visually unambiguous on the incident review screen.
- "Skeleton mode" for unpublished ongoing incidents must look distinct from a populated incident — the user should never wonder "is this all the info there is or is there more loading?"
- The "Generate new key" modal must show plaintext only once, with explicit copy affordance and a "I have copied this" confirmation before dismissing.
- Login error for non-allowlisted GitHub accounts should be friendly but firm — no implication that retrying with different account on same screen will work; this is a private system.

---

## 7. Inspiration

- `status.claude.com`, `status.openai.com` for the public status surface (clean, calm, scannable)
- Linear's app for admin density and command-K patterns
- Vercel and Stripe status pages for incident timelines
- Grafana for chart aesthetics but stripped of its 2015 chrome
- Subtle classical references via typography rather than imagery (a single serif display face can do more than ten Greek-column illustrations)

---

## 8. Deliverables expected

A clickable React prototype as an artifact, including:

1. **Design tokens file** (colors, type scale, spacing, motion timings) — as comments or a single config block
2. **Component library** demonstrated on a single "kitchen sink" route
3. **All routes from sections 4.1–4.12**, navigable via a top nav/sidebar
4. **Two themes** (dark default, light alternative) — togglable
5. **Mock data** for all screens including:
   - 4–5 services with varied subcheck configurations
   - 3 ongoing incidents (one with draft, one published, one in skeleton-only state)
   - 8–10 historical incidents
   - 30 days of Claude Code metrics

For each screen, also annotate (with inline comments or a sidebar panel) any decisions you made about edge cases — empty states, error states, very long incident texts, services with 10+ subchecks, etc.

Don't worry about real data fetching — wire components with hardcoded mock objects matching the shapes in section 3. The backend developer will adapt to your contracts.

---

## 9. Out of scope

- Real-time WebSocket layer (assume polling is fine for v1)
- Mobile-first design (desktop primary; mobile responsive is welcome but not the focus)
- Internationalization (English only for v1)
- Accessibility audit pass (build with reasonable defaults — semantic HTML, keyboard nav, contrast — but no full WCAG pass yet)

---

Begin with the design system and the public status overview (`/`). Then proceed through admin incident review (`/admin/incidents/{id}`) — these are the two screens that set the tone. Everything else extends from those.
