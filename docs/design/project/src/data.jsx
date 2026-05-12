/* ============================================================
   Aglaea — Mock data
   Five services named after classical figures, with varied
   subcheck shapes, incidents in every state, and 30d analytics.
   ============================================================ */

// Live "now" — we tick it from the app so timestamps feel alive.
const NOW = new Date("2026-05-13T07:42:00Z");

const minutesAgo = (m) => new Date(NOW.getTime() - m * 60 * 1000).toISOString();
const hoursAgo   = (h) => new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();
const daysAgo    = (d) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

// Deterministic-ish rng so reloads look stable
function rng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ── Services ──────────────────────────────────────────────────
const SERVICES = [
  {
    slug: "aglaea",
    display_name: "Aglaea",
    description: "Public status & analytics platform (this site).",
    glyph: "graces",
    kind: "pull",
    last_heartbeat_at: minutesAgo(0),
    last_status: "ok",
    last_subchecks: {
      web:    { status: "ok",  latency_ms: 42 },
      api:    { status: "ok",  latency_ms: 78 },
      db:     { status: "ok",  latency_ms: 11 },
    },
    uptime_30d_pct: 99.97,
    current_incident_id: null,
    public_visible: true,
    deepseek_context: "Aglaea is the SRE platform itself. Self-monitoring loop.",
  },
  {
    slug: "hyacine",
    display_name: "Hyacine",
    description: "Morning briefing — aggregates email, calendars, and news into a 6am digest.",
    glyph: "hyacinth",
    kind: "push",
    last_heartbeat_at: minutesAgo(4),
    last_status: "ok",
    last_subchecks: {
      imap:     { status: "ok", latency_ms: 240 },
      summarizer: { status: "ok", latency_ms: 1120 },
      delivery:  { status: "ok", latency_ms: 88 },
    },
    uptime_30d_pct: 99.81,
    current_incident_id: null,
    public_visible: true,
    deepseek_context: "Hyacine runs at 5:50 SGT daily. Sensitive to upstream summarizer rate limits.",
  },
  {
    slug: "cerydra",
    display_name: "Cerydra",
    description: "Discord investment-group agent — market briefings, alerts, on-demand Q&A.",
    glyph: "hydra",
    kind: "push",
    last_heartbeat_at: minutesAgo(1),
    last_status: "degraded",
    last_subchecks: {
      jin10:     { status: "degraded", latency_ms: 4800, message: "high latency — Jin10 upstream slow" },
      moomoo:    { status: "ok", latency_ms: 320 },
      deepseek:  { status: "ok", latency_ms: 760 },
      discord:   { status: "ok", latency_ms: 110 },
    },
    uptime_30d_pct: 98.42,
    current_incident_id: 47,
    public_visible: true,
    deepseek_context: "Cerydra has weekly recurrence pattern with Jin10 MCP. Pattern under upstream investigation.",
  },
];

// 30-day uptime sparkline data (per service). 1 = ok, 0.5 = degraded, 0 = down.
function uptimeSeries(seed, baseUp = 1.0) {
  const r = rng(seed);
  return Array.from({ length: 30 }, (_, i) => {
    const v = r();
    if (v < 0.01) return 0;
    if (v < 0.04) return 0.5;
    return baseUp >= 1 ? 1 : (v < 0.1 ? 0.5 : 1);
  });
}
SERVICES.forEach((s, i) => {
  s.uptime_30d = uptimeSeries(7 + i * 13, s.uptime_30d_pct / 100);
});

// Force the visible incident days
SERVICES[2].uptime_30d[29] = 0.5; // cerydra degraded today

// Heartbeat strip — last 60 minutes, one entry per minute
function heartbeatStrip(seed, currentStatus) {
  const r = rng(seed);
  const out = [];
  for (let i = 59; i >= 0; i--) {
    let st = "ok";
    const v = r();
    if (i < 8 && currentStatus === "down") st = v < 0.7 ? "down" : "degraded";
    else if (i < 12 && currentStatus === "degraded") st = v < 0.5 ? "degraded" : "ok";
    else if (v < 0.02) st = "degraded";
    out.push({ t: minutesAgo(i), status: st });
  }
  return out;
}
SERVICES.forEach((s, i) => {
  s.heartbeats = heartbeatStrip(101 + i * 7, s.last_status);
});

// ── Incidents ─────────────────────────────────────────────────
const INCIDENTS = [
  // active — has draft, awaiting publish
  {
    id: 47, service_slug: "cerydra", status: "ongoing",
    started_at: minutesAgo(38), resolved_at: null,
    affected_subchecks: ["jin10"],
    published_text: null,
    published_at: null,
    report_state: "draft",
    report_text: "Around 07:04 SGT, Cerydra's Jin10 MCP component began returning 4–5s latencies, eventually crossing the 3s degraded threshold. The agent continues serving cached news; no user-facing message loss detected. Pattern matches the May 8 incident — likely upstream throttling, currently being investigated.\n\nNo manual remediation taken yet. Recovery has been autonomous in prior incidents (median 41 min).",
    report_generated_at: minutesAgo(2),
    report_generation_count: 4,
    report_generation_reason: "subcheck_changed",
  },
  // active — published narrative already (rare but happens for fast-moving ones)
  {
    id: 46, service_slug: "hyacine", status: "ongoing",
    started_at: hoursAgo(2), resolved_at: null,
    affected_subchecks: ["summarizer"],
    published_text: "Hyacine's summarizer has been intermittently slow since 05:42 SGT. Briefings are delivering 4–8 minutes late but otherwise complete. No data loss. Likely upstream LLM provider — monitoring.",
    published_at: hoursAgo(1.7),
    report_state: "published",
    report_text: "Hyacine's summarizer has been intermittently slow since 05:42 SGT. Briefings are delivering 4–8 minutes late but otherwise complete. No data loss. Likely upstream LLM provider — monitoring.",
    report_generated_at: hoursAgo(1.8),
    report_generation_count: 2,
    report_generation_reason: "periodic",
  },
  // resolved, published — recent
  {
    id: 45, service_slug: "cerydra", status: "resolved",
    started_at: daysAgo(1.1), resolved_at: daysAgo(1.05),
    affected_subchecks: ["jin10"],
    published_text: "On May 12 around 14:23 SGT, Cerydra's Jin10 MCP component lost connectivity. The agent continued to serve cached news for 38 minutes before connectivity restored automatically. Similar to the May 8 incident — this pattern recurs roughly weekly and is being investigated upstream.",
    published_at: daysAgo(1.04),
    report_state: "published",
    report_generation_count: 3,
    similar_ids: [42, 38],
  },
  {
    id: 43, service_slug: "hyacine", status: "resolved",
    started_at: daysAgo(4.2), resolved_at: daysAgo(4.18),
    affected_subchecks: ["imap"],
    published_text: "IMAP polling failed for 28 minutes overnight (May 9 02:14–02:42 SGT) due to a Gmail OAuth token refresh hiccup. No briefings missed — token re-issued automatically and queue caught up.",
    published_at: daysAgo(4.16),
    report_state: "published",
    report_generation_count: 2,
  },
  {
    id: 42, service_slug: "cerydra", status: "resolved",
    started_at: daysAgo(5.4), resolved_at: daysAgo(5.36),
    affected_subchecks: ["jin10"],
    published_text: "Recurrence of weekly Jin10 connectivity blip. 53 min. Auto-recovered. Filed upstream.",
    published_at: daysAgo(5.35),
    report_state: "published",
    report_generation_count: 1,
  },
  {
    id: 41, service_slug: "aglaea", status: "resolved",
    started_at: daysAgo(8.1), resolved_at: daysAgo(8.09),
    affected_subchecks: ["api"],
    published_text: "Brief API timeout cluster following a deploy. 6 minutes. Rolled back.",
    published_at: daysAgo(8.08),
    report_state: "published",
    report_generation_count: 1,
  },
  {
    id: 39, service_slug: "cerydra", status: "resolved",
    started_at: daysAgo(13.2), resolved_at: daysAgo(13.18),
    affected_subchecks: ["discord"],
    published_text: "Discord gateway disconnect — 22 minutes. Auto-reconnected.",
    published_at: daysAgo(13.17),
    report_state: "published",
    report_generation_count: 1,
  },
  {
    id: 38, service_slug: "cerydra", status: "resolved",
    started_at: daysAgo(19.5), resolved_at: daysAgo(19.45),
    affected_subchecks: ["jin10"],
    published_text: "Weekly Jin10 blip. 41 min. Auto-recovered. Pattern noted.",
    published_at: daysAgo(19.44),
    report_state: "published",
    report_generation_count: 2,
  },
];

// Timeline for incident #47 (subcheck state changes)
const INCIDENT_TIMELINES = {
  47: [
    { t: minutesAgo(38), sub: "jin10", status: "degraded", note: "Latency crossed 3000ms threshold." },
    { t: minutesAgo(31), sub: "jin10", status: "down", note: "Two consecutive timeouts." },
    { t: minutesAgo(18), sub: "jin10", status: "degraded", note: "Partial recovery." },
    { t: minutesAgo(2),  sub: "jin10", status: "degraded", note: "Still elevated. Draft regenerated." },
  ],
  46: [
    { t: hoursAgo(2),    sub: "summarizer", status: "degraded", note: "p95 latency > 8s." },
    { t: hoursAgo(1.3),  sub: "summarizer", status: "degraded", note: "Persisting." },
  ],
  45: [
    { t: daysAgo(1.1),   sub: "jin10", status: "down", note: "Lost connection." },
    { t: daysAgo(1.05),  sub: "jin10", status: "ok",   note: "Recovered automatically." },
  ],
};

// Recent similar incidents lookup
const SIMILAR = {
  47: [
    { id: 45, started_at: daysAgo(1.1), duration_min: 38, summary: "Jin10 lost connectivity — auto-recovered." },
    { id: 42, started_at: daysAgo(5.4), duration_min: 53, summary: "Same weekly Jin10 pattern." },
    { id: 38, started_at: daysAgo(19.5), duration_min: 41, summary: "Recurrence." },
  ],
};

// Heartbeat timeline (for admin incident review). 30 entries.
const INCIDENT_HEARTBEATS = {
  47: Array.from({ length: 30 }, (_, i) => {
    const t = minutesAgo(38 - i);
    const isDown = i >= 7 && i < 20;
    const isDeg = !isDown && (i >= 0);
    return {
      t,
      sub: "jin10",
      status: isDown ? "down" : (isDeg ? "degraded" : "ok"),
      latency_ms: isDown ? null : 3200 + Math.round(Math.sin(i) * 600 + 1200),
      message: isDown ? "timeout" : "elevated latency",
    };
  }),
};

// ── Claude Code metrics ───────────────────────────────────────
function dailySeries(seed, base, jitter) {
  const r = rng(seed);
  return Array.from({ length: 30 }, (_, i) => {
    const dow = (new Date(daysAgo(29 - i))).getDay();
    const weekend = dow === 0 || dow === 6 ? 0.55 : 1.0;
    const trend = 1 + i * 0.008;
    const j = (r() - 0.5) * 2 * jitter;
    return Math.max(0, Math.round((base + j) * weekend * trend));
  });
}

const CLAUDE_CODE = {
  token_total_30d: dailySeries(31, 1_900_000, 600_000).map((v, i) => ({
    ts: daysAgo(29 - i), value: v,
  })),
  cost_trend_30d: dailySeries(32, 4.6, 2.0).map((v, i) => ({
    ts: daysAgo(29 - i), usd: Math.round(v * 100) / 100,
  })),
  token_by_model: [
    { model: "claude-opus-4-7",    value: 14_230_000 },
    { model: "claude-sonnet-4-6",  value: 38_410_000 },
    { model: "claude-haiku-4-5",   value:  5_120_000 },
  ],
  cache_hit_rate_7d: 0.62,
  active_time_ratio_7d: { cli: 41_200, user: 88_300 }, // seconds
  sessions_daily_30d: dailySeries(33, 14, 6).map((v, i) => ({
    date: daysAgo(29 - i).slice(0, 10), count: v,
  })),
  commits_daily_30d: dailySeries(34, 9, 5).map((v, i) => ({
    date: daysAgo(29 - i).slice(0, 10), count: v,
  })),
  loc_daily_30d: dailySeries(35, 800, 400).map((v, i) => ({
    date: daysAgo(29 - i).slice(0, 10),
    added: v,
    removed: Math.round(v * (0.3 + Math.random() * 0.3)),
  })),
  // 7×24 heatmap (rows = days, cols = hours)
  active_hours_heatmap: (() => {
    const r = rng(99);
    return Array.from({ length: 7 }, (_, d) =>
      Array.from({ length: 24 }, (_, h) => {
        const workHour = h >= 9 && h <= 23;
        const lateNight = h >= 22 || h <= 2;
        let base = 0;
        if (workHour) base = 3 + Math.floor(r() * 8);
        if (lateNight) base = 5 + Math.floor(r() * 10);
        if (d === 0 || d === 6) base = Math.round(base * 0.55); // weekends
        if (h >= 3 && h <= 7) base = 0;
        return base;
      })
    );
  })(),
  terminal_type_share: [
    { type: "iTerm.app",   value: 0.71 },
    { type: "tmux",        value: 0.18 },
    { type: "VS Code",     value: 0.08 },
    { type: "Apple_Terminal", value: 0.03 },
  ],
  // Admin-only: host_name split
  by_host: {
    mac:    { tokens_30d: 41_200_000, cost_30d: 132.40, sessions_30d: 312 },
    "sg-vps": { tokens_30d: 14_600_000, cost_30d:  46.10, sessions_30d:  88 },
    win:    { tokens_30d:  1_960_000, cost_30d:   8.20, sessions_30d:  22 },
  },
};

// API keys for service detail
const API_KEYS = {
  cerydra: [
    { id: "k_8a1", label: "primary-runner", prefix: "agl_live_8a1c…", created_at: daysAgo(94), last_used_at: minutesAgo(1) },
    { id: "k_2f4", label: "backup-worker", prefix: "agl_live_2f4e…", created_at: daysAgo(60), last_used_at: hoursAgo(8) },
  ],
  hyacine: [
    { id: "k_b03", label: "cron-poster", prefix: "agl_live_b03d…", created_at: daysAgo(120), last_used_at: hoursAgo(2) },
  ],
};

// Audit log
const AUDIT = [
  { t: minutesAgo(2),  actor_type: "system", actor: "deepseek-worker", event: "draft.generated",  ip: "10.0.0.3",  details: { incident: 47, count: 4 } },
  { t: minutesAgo(38), actor_type: "system", actor: "heartbeat-loss",  event: "incident.opened",  ip: "—",         details: { service: "cerydra", incident: 47 } },
  { t: hoursAgo(1),    actor_type: "user",   actor: "yvon",            event: "incident.publish", ip: "203.0.113.7", details: { incident: 46 } },
  { t: hoursAgo(3),    actor_type: "user",   actor: "yvon",            event: "auth.success",     ip: "203.0.113.7", details: { method: "github_oauth" } },
  { t: hoursAgo(4),    actor_type: "system", actor: "ratelimit",       event: "auth.rate_limited", ip: "185.220.101.7", details: { attempts: 12 } },
  { t: hoursAgo(7),    actor_type: "user",   actor: "unknown",         event: "auth.denied",      ip: "185.220.101.7", details: { github_id: 99812, reason: "not_allowlisted" } },
  { t: hoursAgo(10),   actor_type: "user",   actor: "unknown",         event: "auth.denied",      ip: "45.32.0.4",   details: { github_id: 41200, reason: "not_allowlisted" } },
  { t: daysAgo(1.05),  actor_type: "user",   actor: "yvon",            event: "incident.publish", ip: "203.0.113.7", details: { incident: 45 } },
  { t: daysAgo(1.1),   actor_type: "system", actor: "heartbeat-loss",  event: "incident.opened",  ip: "—",         details: { service: "cerydra", incident: 45 } },
  { t: daysAgo(3.5),   actor_type: "user",   actor: "yvon",            event: "apikey.created",   ip: "203.0.113.7", details: { service: "cerydra", label: "primary-runner" } },
  { t: daysAgo(4.2),   actor_type: "system", actor: "heartbeat-loss",  event: "incident.opened",  ip: "—",         details: { service: "hyacine", incident: 43 } },
];

// expose
Object.assign(window, {
  NOW, SERVICES, INCIDENTS, INCIDENT_TIMELINES, INCIDENT_HEARTBEATS,
  SIMILAR, CLAUDE_CODE, API_KEYS, AUDIT,
  minutesAgo, hoursAgo, daysAgo,
});
