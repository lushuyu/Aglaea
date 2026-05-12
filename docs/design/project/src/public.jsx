/* Aglaea — Public-facing screens */
/* eslint-disable */

// ── Public chrome (header + footer for public side) ───────────
function PublicChrome({ children, route, go }) {
  const [hideTabs, setHideTabs] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY, ticking = false;
    const onScroll = () => {
      if (ticking) return;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y < 24) setHideTabs(false);
        else if (delta > 4) setHideTabs(true);
        else if (delta < -4) setHideTabs(false);
        lastY = y;
        ticking = false;
      });
      ticking = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <>
      <StarField />
      <header className="pub-header">
        <a href="#/" onClick={(e)=>{e.preventDefault();go("/");}} className="brand-link">
          <Brandmark size={26} />
          <span className="serif" style={{ fontSize: 22, letterSpacing: ".02em" }}>Aglaea</span>
          <span className="muted text-xs mono" style={{ marginLeft: 8, paddingLeft: 10, borderLeft: "1px solid var(--line-2)" }}>
            status &amp; signal
          </span>
        </a>
        <a href="#/login" onClick={e=>{e.preventDefault();go("/login");}} className="pub-nav-cta">
          Admin →
        </a>
      </header>
      <div className={"pub-tabbar" + (hideTabs ? " is-hidden" : "")}>
        <div className="pub-tabbar-inner">
          <PubTab onClick={()=>go("/")} active={route === "/"} icon="◐" label="Status" sub="services & incidents"/>
          <PubTab onClick={()=>go("/claude-code")} active={route.startsWith("/claude-code")} icon="✧" label="Claude Code" sub="usage analytics"/>
          <PubTab onClick={()=>go("/about")} active={route === "/about"} icon="A" label="About" sub="what this is"/>
        </div>
      </div>
      <main className="pub-main">
        <div key={route} className="page-fade">{children}</div>
      </main>
      <footer className="pub-footer">
        <div className="pub-footer-inner">
          <div className="row gap-3" style={{ alignItems: "center" }}>
            <Brandmark size={16} />
            <span className="serif" style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1 }}>Aglaea</span>
            <span className="muted text-xs mono" style={{ lineHeight: 1 }}>v1.0 · {new Date().getUTCFullYear()}</span>
          </div>
          <div className="muted text-xs" style={{ maxWidth: 480, textAlign: "right", lineHeight: 1.6 }}>
            <em>“…and Aglaia youngest of the Graces…”</em>
            <div className="mono" style={{ marginTop: 4, opacity: .65 }}>Hesiod, <i>Theogony</i> 945</div>
          </div>
        </div>
      </footer>
    </>
  );
}

function PubTab({ onClick, active, icon, label, sub }) {
  return (
    <button className={"pub-tab" + (active ? " on" : "")} onClick={onClick}>
      <span className="pub-tab-icon serif">{icon}</span>
      <div className="col" style={{ alignItems: "flex-start", lineHeight: 1.2 }}>
        <span className="pub-tab-label">{label}</span>
        <span className="pub-tab-sub">{sub}</span>
      </div>
    </button>
  );
}

// ── 4.1 Public status overview ────────────────────────────────
function PublicOverview({ go, tick }) {
  const services = window.SERVICES;
  const incidents = window.INCIDENTS;
  const ongoing = incidents.filter(i => i.status === "ongoing");
  const worst = services.reduce((acc, s) => {
    const order = { ok: 0, unknown: 1, degraded: 2, down: 3 };
    return order[s.last_status] > order[acc] ? s.last_status : acc;
  }, "ok");
  const bannerCfg = {
    ok:        { title: "All systems operational.", sub: "Every service is responding within tolerance." },
    degraded:  { title: "Some services degraded.",   sub: ongoing[0] ? `${ongoing[0].service_slug} — see active incidents below.` : null },
    down:      { title: "Active incident in progress.", sub: ongoing[0] ? `${ongoing[0].service_slug} — see active incidents below.` : null },
    unknown:   { title: "Status indeterminate.", sub: "Some heartbeats stale." },
  }[worst];

  const recent = incidents.filter(i => i.status === "resolved").slice(0, 5);

  return (
    <div className="container">
      <section style={{ marginTop: 8 }}>
        <StatusBanner status={worst} title={bannerCfg.title} sub={bannerCfg.sub} />
        <div className="row between" style={{ marginTop: 12, color: "var(--fg-3)" }}>
          <div className="row gap-2 text-xs mono">
            <span className={"live-dot " + (worst === "ok" ? "" : worst)}></span>
            <span>auto-refreshing · last checked {fmtTime(window.NOW.toISOString(), new Date(window.NOW.getTime() + tick))}</span>
          </div>
          <div className="text-xs mono muted-2"><LocalClock /></div>
        </div>
      </section>

      {ongoing.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <SectionHeader label="Active incidents" count={ongoing.length} />
          <div className="col gap-3" style={{ marginTop: 16 }}>
            {ongoing.map(inc => <ActiveIncidentCard key={inc.id} incident={inc} go={go} />)}
          </div>
        </section>
      )}

      <section style={{ marginTop: 48 }}>
        <SectionHeader label="Services" count={services.length} />
        <div className="services-list" style={{ marginTop: 16 }}>
          {services.map(s => <ServiceRow key={s.slug} service={s} go={go} />)}
        </div>
      </section>

      <section style={{ marginTop: 48 }}>
        <SectionHeader label="Recent incidents" />
        <div className="recent-list" style={{ marginTop: 16 }}>
          {recent.map(inc => <RecentIncidentRow key={inc.id} incident={inc} go={go} />)}
          {!recent.length && <div className="card" style={{padding:32, textAlign:"center", color:"var(--fg-2)"}}>No incidents in the last 30 days.</div>}
        </div>
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <a href="#/about" onClick={e=>{e.preventDefault();go("/about");}} className="text-sm muted">Subscribe / RSS · About this site →</a>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ label, count, action }) {
  return (
    <div className="section-hd">
      <div className="row gap-3" style={{ alignItems: "baseline" }}>
        <h2 className="serif" style={{ fontSize: 22, whiteSpace: "nowrap" }}>{label}</h2>
        {count != null && <span className="text-xs mono muted-2">{count}</span>}
      </div>
      {action}
    </div>
  );
}

function ServiceRow({ service: s, go }) {
  return (
    <div className="service-row hover-row" onClick={() => go(`/services/${s.slug}`)}>
      <div className="service-row-left">
        <span style={{ color: s.last_status === "ok" ? "var(--fg-2)" : `var(--${s.last_status})` }}>
          <ServiceGlyph kind={s.glyph} size={22} />
        </span>
        <div className="col" style={{ minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 17, color: "var(--fg-0)" }}>{s.display_name}</div>
          <div className="text-xs muted truncate" style={{ maxWidth: 360 }}>{s.description}</div>
        </div>
      </div>
      <div className="service-row-mid">
        <SubcheckStrip subchecks={s.last_subchecks} />
      </div>
      <div className="service-row-right">
        <div className="col" style={{ alignItems: "flex-end", gap: 4, minWidth: 180 }}>
          <UptimeCalendar days={s.uptime_30d} w={180} cellH={14} />
          <div className="text-xs mono muted-2">{s.uptime_30d_pct.toFixed(2)}% · 30d</div>
        </div>
        <StatusBadge status={s.last_status} size="sm" />
      </div>
    </div>
  );
}

function ActiveIncidentCard({ incident, go }) {
  const service = window.SERVICES.find(s => s.slug === incident.service_slug);
  const isSkeleton = !incident.published_text;
  return (
    <div className={"card active-incident " + (isSkeleton ? "skeleton-mode" : "")}
      onClick={() => go(`/services/${incident.service_slug}/incidents/${incident.id}`)}>
      <div className="row between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div className="row gap-3" style={{ flexWrap: "wrap", rowGap: 4 }}>
          <StatusBadge status={service.last_status} />
          <span className="serif" style={{ fontSize: 18 }}>{service.display_name}</span>
          <span className="muted text-sm">·</span>
          <span className="text-sm muted" style={{ whiteSpace: "nowrap" }}>started {fmtTime(incident.started_at)}</span>
        </div>
        <span className="text-xs mono muted-2">incident #{incident.id}</span>
      </div>
      {isSkeleton ? (
        <div className="skeleton-notice">
          <div className="text-xs mono" style={{ color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            ◐ Monitoring — narrative pending review
          </div>
          <div className="muted text-sm" style={{ marginTop: 6, lineHeight: 1.55 }}>
            We are aware of the issue. A written update will appear here once it has been reviewed.
            Affected subchecks: <span className="mono" style={{ color: "var(--fg-1)" }}>{incident.affected_subchecks.join(", ")}</span>.
          </div>
        </div>
      ) : (
        <p style={{ margin: 0, lineHeight: 1.6, color: "var(--fg-1)" }}>{incident.published_text}</p>
      )}
    </div>
  );
}

function RecentIncidentRow({ incident: inc, go }) {
  const service = window.SERVICES.find(s => s.slug === inc.service_slug);
  return (
    <div className="recent-row hover-row" onClick={() => go(`/services/${inc.service_slug}/incidents/${inc.id}`)}>
      <div className="recent-left">
        <span className="muted-2 mono text-xs" style={{ width: 64 }}>{new Date(inc.started_at).toISOString().slice(5, 10)}</span>
        <StatusBadge status="ok" label="Resolved" size="sm" />
        <span style={{ color: "var(--fg-1)" }}>{service.display_name}</span>
      </div>
      <div className="recent-mid truncate muted text-sm">{inc.published_text?.slice(0, 80) || "—"}</div>
      <div className="recent-right text-xs mono muted-2">{fmtDuration(inc.started_at, inc.resolved_at)}</div>
    </div>
  );
}

// ── 4.2 Public service detail ─────────────────────────────────
function PublicServiceDetail({ slug, go }) {
  const s = window.SERVICES.find(x => x.slug === slug);
  if (!s) return <NotFound go={go} />;
  const myIncidents = window.INCIDENTS.filter(i => i.service_slug === slug);
  const active = myIncidents.filter(i => i.status === "ongoing");
  const past = myIncidents.filter(i => i.status === "resolved");

  return (
    <div className="container">
      <Breadcrumb items={[
        { label: "All services", href: "/", go },
        { label: s.display_name },
      ]} />

      <header className="service-header">
        <div className="row gap-4" style={{ alignItems: "flex-start" }}>
          <div className="service-glyph-lg" style={{ color: s.last_status === "ok" ? "var(--accent)" : `var(--${s.last_status})` }}>
            <ServiceGlyph kind={s.glyph} size={44} />
          </div>
          <div className="col gap-2" style={{ flex: 1 }}>
            <div className="row gap-3" style={{ alignItems: "center" }}>
              <h1 className="serif" style={{ fontSize: 40 }}>{s.display_name}</h1>
              <StatusBadge status={s.last_status} />
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 15, maxWidth: 640 }}>{s.description}</p>
            <div className="text-xs mono muted-2" style={{ marginTop: 4 }}>
              <span className="live-dot" style={{ display: "inline-block", marginRight: 6, verticalAlign: -1 }} />
              last heartbeat {fmtTime(s.last_heartbeat_at)} · {s.kind} monitoring
            </div>
          </div>
        </div>
      </header>

      {active.length > 0 && (
        <section style={{ marginTop: 24 }}>
          {active.map(inc => <ActiveIncidentCard key={inc.id} incident={inc} go={go} />)}
        </section>
      )}

      <section style={{ marginTop: 32 }}>
        <SectionHeader label="Subchecks" />
        {Object.keys(s.last_subchecks).length ? (
          <div className="subchecks-grid" style={{ marginTop: 16 }}>
            {Object.entries(s.last_subchecks).map(([k, v]) => (
              <div key={k} className="card" style={{ padding: 16 }}>
                <div className="row between" style={{ marginBottom: 10 }}>
                  <div className="mono text-sm" style={{ color: "var(--fg-1)" }}>{k}</div>
                  <StatusBadge status={v.status} size="sm" />
                </div>
                <div className="row gap-4 text-xs muted">
                  <div>latency <span className="mono" style={{ color: "var(--fg-1)" }}>{v.latency_ms != null ? v.latency_ms + "ms" : "—"}</span></div>
                </div>
                {v.message && <div className="text-xs muted-2" style={{ marginTop: 8, fontStyle: "italic" }}>{v.message}</div>}
              </div>
            ))}
          </div>
        ) : <div className="card" style={{ padding: 24, marginTop: 16, textAlign:"center", color:"var(--fg-2)" }}>
          This service has no nested subchecks — it reports a single heartbeat.
        </div>}
      </section>

      <section style={{ marginTop: 40 }}>
        <SectionHeader label="Last hour" />
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <HeartbeatStrip data={s.heartbeats} w={720} h={32} />
          <div className="row between text-xs mono muted-2" style={{ marginTop: 8 }}>
            <span>−60m</span>
            <span>now</span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <SectionHeader label="Last 30 days" />
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <span className="text-sm muted">Uptime calendar</span>
            <span className="serif" style={{ fontSize: 22 }}>{s.uptime_30d_pct.toFixed(2)}<span className="muted-2" style={{fontSize:14}}>%</span></span>
          </div>
          <UptimeCalendar days={s.uptime_30d} w={720} />
          <div className="row between text-xs mono muted-2" style={{ marginTop: 8 }}>
            <span>30d ago</span>
            <span>today</span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <SectionHeader label="Incident history" count={past.length} action={
          <a className="text-sm" href="#" onClick={e=>{e.preventDefault();go(`/services/${slug}/incidents`);}}>View all →</a>
        } />
        <div className="recent-list" style={{ marginTop: 16 }}>
          {past.slice(0, 5).map(inc => <RecentIncidentRow key={inc.id} incident={inc} go={go} />)}
          {!past.length && <div className="card" style={{padding:24, textAlign:"center", color:"var(--fg-2)"}}>No past incidents.</div>}
        </div>
      </section>
    </div>
  );
}

// ── 4.2b Incident history list ────────────────────────────────
function PublicIncidentHistory({ slug, go }) {
  const s = window.SERVICES.find(x => x.slug === slug);
  if (!s) return <NotFound go={go} />;
  const all = window.INCIDENTS.filter(i => i.service_slug === slug);
  return (
    <div className="container">
      <Breadcrumb items={[
        { label: "All services", href: "/", go },
        { label: s.display_name, href: `/services/${slug}`, go },
        { label: "Incidents" },
      ]} />
      <h1 className="serif" style={{ fontSize: 36, marginTop: 16 }}>{s.display_name} — Incidents</h1>
      <div className="recent-list" style={{ marginTop: 20 }}>
        {all.map(inc => <RecentIncidentRow key={inc.id} incident={inc} go={go} />)}
      </div>
    </div>
  );
}

// ── 4.3 Public incident page ──────────────────────────────────
function PublicIncidentDetail({ slug, id, go }) {
  const s = window.SERVICES.find(x => x.slug === slug);
  const inc = window.INCIDENTS.find(i => i.id === +id);
  if (!s || !inc) return <NotFound go={go} />;
  const timeline = window.INCIDENT_TIMELINES[inc.id] || [];
  const isSkeleton = inc.status === "ongoing" && !inc.published_text;

  return (
    <div className="container narrow">
      <Breadcrumb items={[
        { label: "All services", href: "/", go },
        { label: s.display_name, href: `/services/${slug}`, go },
        { label: `Incident #${inc.id}` },
      ]} />

      <header style={{ marginTop: 24, paddingBottom: 24, borderBottom: "1px solid var(--line-2)" }}>
        <div className="row gap-3" style={{ marginBottom: 12 }}>
          <span className="tag" style={{ color: inc.status === "ongoing" ? "var(--degraded)" : "var(--ok)", borderColor: inc.status === "ongoing" ? "var(--degraded-line)" : "var(--ok-line)" }}>
            {inc.status === "ongoing" ? "● Ongoing" : "✓ Resolved"}
          </span>
          <span className="text-sm muted">{s.display_name}</span>
        </div>
        <h1 className="serif" style={{ fontSize: 36, lineHeight: 1.15 }}>
          {isSkeleton ? "Active incident — monitoring" : (inc.published_text?.split(".")[0] + ".")}
        </h1>
        <div className="row gap-5" style={{ marginTop: 16, color: "var(--fg-2)", fontSize: 13 }}>
          <div><span className="muted-2 mono text-xs">STARTED</span><br/>{fmtClock(inc.started_at)}</div>
          {inc.resolved_at && <div><span className="muted-2 mono text-xs">RESOLVED</span><br/>{fmtClock(inc.resolved_at)}</div>}
          <div><span className="muted-2 mono text-xs">DURATION</span><br/>{fmtDuration(inc.started_at, inc.resolved_at)}</div>
          <div><span className="muted-2 mono text-xs">SUBCHECKS</span><br/><span className="mono">{inc.affected_subchecks.join(", ")}</span></div>
        </div>
      </header>

      {isSkeleton ? (
        <section style={{ marginTop: 32 }}>
          <div className="card skeleton-mode" style={{ padding: 24 }}>
            <div className="text-xs mono" style={{ color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>
              ◐ Narrative pending
            </div>
            <p style={{ margin: 0, color: "var(--fg-1)", lineHeight: 1.65 }}>
              No written update has been published yet. We do not auto-publish AI-generated text;
              an update will appear here once a human has reviewed it. Below is the bare-facts timeline as we know it.
            </p>
          </div>

          <SectionHeader label="Subcheck timeline" />
          <div className="card" style={{ padding: 20, marginTop: 16 }}>
            {timeline.length ? <TimelineList items={timeline} /> :
              <div className="muted text-sm">No state changes recorded yet.</div>}
          </div>
        </section>
      ) : (
        <>
          <article style={{ marginTop: 32 }}>
            <div className="incident-prose">
              {inc.published_text.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
            </div>
            {inc.published_at && <div className="text-xs mono muted-2" style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line-1)" }}>
              Published {fmtClock(inc.published_at)}
            </div>}
          </article>

          {timeline.length > 0 && (
            <section style={{ marginTop: 40 }}>
              <SectionHeader label="Subcheck timeline" />
              <div className="card" style={{ padding: 20, marginTop: 16 }}>
                <TimelineList items={timeline} />
              </div>
            </section>
          )}

          {inc.similar_ids && (
            <section style={{ marginTop: 40 }}>
              <SectionHeader label="Similar past incidents" />
              <div className="recent-list" style={{ marginTop: 16 }}>
                {inc.similar_ids.map(sid => {
                  const sinc = window.INCIDENTS.find(x => x.id === sid);
                  return sinc ? <RecentIncidentRow key={sid} incident={sinc} go={go} /> : null;
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TimelineList({ items }) {
  return (
    <div className="timeline">
      {items.map((it, i) => (
        <div key={i} className="timeline-row">
          <div className="timeline-marker"><StatusGlyph status={it.status} size={11} /></div>
          <div className="timeline-time mono text-xs muted-2">{new Date(it.t).toISOString().slice(11, 16)} UTC</div>
          <div className="timeline-body">
            <span className="mono text-sm" style={{ color: "var(--fg-1)" }}>{it.sub}</span>
            <span className="muted text-sm"> · {STATUS_LABELS[it.status]} — {it.note}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb text-xs mono">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="muted-2"> / </span>}
          {it.href ? (
            <a href="#" onClick={e=>{e.preventDefault();it.go(it.href);}}>{it.label}</a>
          ) : <span className="muted">{it.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}

function LocalClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  // Short TZ abbreviation (e.g. "GMT+8", "PDT") — best-effort
  const tzAbbr = (() => {
    try {
      const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(now);
      const tz = parts.find(p => p.type === "timeZoneName");
      return tz ? tz.value : "";
    } catch { return ""; }
  })();
  return <span title={tzName}>{date} {time} {tzAbbr}</span>;
}

function NotFound({ go }) {
  return (
    <div className="container">
      <div style={{ padding: "80px 0", textAlign: "center" }}>
        <h1 className="serif" style={{ fontSize: 56 }}>404</h1>
        <p className="muted">That page is not in the registry.</p>
        <button className="btn" style={{ marginTop: 24 }} onClick={()=>go("/")}>← Back to status</button>
      </div>
    </div>
  );
}

// ── 4.4 Public Claude Code dashboard ─────────────────────────
function PublicClaudeCode({ go }) {
  const cc = window.CLAUDE_CODE;
  const weekTokens = cc.token_total_30d.slice(-7).reduce((a, p) => a + p.value, 0);
  const weekCost = cc.cost_trend_30d.slice(-7).reduce((a, p) => a + p.usd, 0);
  const cliRatio = cc.active_time_ratio_7d.cli / (cc.active_time_ratio_7d.cli + cc.active_time_ratio_7d.user);

  return (
    <div className="container">
      <header style={{ marginTop: 24, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--line-1)" }}>
        <div className="row between" style={{ alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <h1 className="serif" style={{ fontSize: 28, lineHeight: 1.2 }}>Claude Code usage</h1>
          <span className="text-xs mono muted-2">last 30 days · aggregated</span>
        </div>
      </header>

      <section className="cc-stats">
        <StatTile label="Tokens · 7d" value={fmtNum(weekTokens)} sub={"vs prev. week +12%"} accent />
        <StatTile label="Cost · 7d" value={`$${weekCost.toFixed(2)}`} sub="usd estimate" />
        <StatTile label="Cache hit · 7d" value={(cc.cache_hit_rate_7d * 100).toFixed(0) + "%"} sub="of prompt tokens" />
        <StatTile label="CLI time · 7d" value={(cliRatio * 100).toFixed(0) + "%"} sub="of total active time" />
      </section>

      <section className="cc-grid" style={{ marginTop: 28 }}>
        <ChartCard title="Token usage" sub="last 30 days, total per day">
          <LineChart series={[{
            name: "tokens", color: "var(--c-1)",
            data: cc.token_total_30d.map(p => ({ x: p.ts, y: p.value })),
          }]} h={180} yFormat={fmtNum} />
        </ChartCard>
        <ChartCard title="Cost trend" sub="usd per day">
          <LineChart series={[{
            name: "cost", color: "var(--c-3)",
            data: cc.cost_trend_30d.map(p => ({ x: p.ts, y: p.usd })),
          }]} h={180} yFormat={v => "$" + v.toFixed(1)} />
        </ChartCard>
        <ChartCard title="Model split" sub="30d tokens" span={1}>
          <Donut data={cc.token_by_model.map(m => ({ label: m.model.replace("claude-", "").replace("-4-7", " 4.7").replace("-4-6", " 4.6").replace("-4-5", " 4.5"), value: m.value }))} />
        </ChartCard>
        <ChartCard title="Sessions per day" sub="last 30 days">
          <BarChart data={cc.sessions_daily_30d.map(d => ({ x: d.date, y: d.count }))} h={160} />
        </ChartCard>
        <ChartCard title="Commits per day" sub="last 30 days">
          <BarChart data={cc.commits_daily_30d.map(d => ({ x: d.date, y: d.count }))} h={140} color="var(--c-2)" />
        </ChartCard>
        <ChartCard title="LOC churn" sub="added · removed per day">
          <SmallMultiplesLoc data={cc.loc_daily_30d} />
        </ChartCard>
        <ChartCard title="Active hours" sub="7 days × 24 hours" span={2}>
          <Heatmap data={cc.active_hours_heatmap}
            rowLabels={["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]}
            colLabels={Array.from({length:24}, (_,i) => String(i).padStart(2,"0"))} />
        </ChartCard>
        <ChartCard title="Terminal" sub="share of sessions">
          <div className="col gap-2">
            {cc.terminal_type_share.map(t => (
              <div key={t.type} className="col gap-1">
                <div className="row between text-xs">
                  <span className="mono" style={{color:"var(--fg-1)"}}>{t.type}</span>
                  <span className="muted-2 mono">{(t.value * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: 4, background: "var(--bg-2)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: (t.value*100)+"%", height: "100%", background: "var(--accent)", opacity: .6 }}/>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </section>

      <div className="muted text-xs mono" style={{ marginTop: 32, textAlign: "center", letterSpacing: ".06em" }}>
        host names · IPs · raw token counts &gt; 30d window not shown on this page
      </div>
    </div>
  );
}

function ChartCard({ title, sub, children, span = 1 }) {
  return (
    <div className="card chart-card" style={{ gridColumn: `span ${span}` }}>
      <div className="chart-card-hd">
        <div className="serif" style={{ fontSize: 17 }}>{title}</div>
        {sub && <div className="text-xs mono muted-2">{sub}</div>}
      </div>
      <div className="chart-card-body">{children}</div>
    </div>
  );
}

function SmallMultiplesLoc({ data }) {
  const added = data.map(d => ({ x: d.date, y: d.added }));
  const removed = data.map(d => ({ x: d.date, y: -d.removed }));
  const yMax = Math.max(...added.map(p => p.y));
  const yMin = Math.min(...removed.map(p => p.y));
  return (
    <svg width="100%" viewBox="0 0 600 140" style={{display:"block"}}>
      <line x1="24" x2="600" y1="70" y2="70" stroke="var(--line-1)" />
      <text x="4" y="14" fontSize="10" fill="var(--fg-3)" className="mono">+{fmtNum(yMax)}</text>
      <text x="4" y="135" fontSize="10" fill="var(--fg-3)" className="mono">{fmtNum(yMin)}</text>
      {data.map((d, i) => {
        const x = 24 + (i / (data.length - 1)) * (576);
        const h1 = (d.added / yMax) * 55;
        const h2 = (d.removed / -yMin) * 55;
        return (
          <g key={i}>
            <rect x={x - 2} y={70 - h1} width="3" height={h1} fill="var(--ok)" opacity=".8" />
            <rect x={x - 2} y={70} width="3" height={h2} fill="var(--down)" opacity=".7" />
          </g>
        );
      })}
    </svg>
  );
}

// ── 4.x About page ────────────────────────────────────────────
function PublicAbout({ go }) {
  return (
    <div className="container narrow">
      <header style={{ marginTop: 24, marginBottom: 40 }}>
        <h1 className="serif" style={{ fontSize: 56, lineHeight: 1.05 }}>
          About Aglaea.
        </h1>
      </header>
      <article className="incident-prose">
        <p style={{ fontSize: 17 }}>
          <span className="serif" style={{ fontSize: 28, float: "left", lineHeight: 1, marginRight: 8, marginTop: 6, color: "var(--accent)" }}>A</span>
          glaea is one developer's private monitoring platform — and its public face.
          Like the goddess it borrows its name from, it watches over a small constellation of services and tells you,
          in as few words as possible, whether everything is well.
        </p>
        <p>
          The sibling services it monitors are also named after classical figures:
          <strong> Hyacine</strong> (a morning briefing system) and
          <strong> Cerydra</strong> (a Discord investment-group agent).
          Each runs independently, reports heartbeats here, and gets a written postmortem when something fails.
        </p>
        <h2 className="serif" style={{ fontSize: 24, marginTop: 32 }}>What you'll see here</h2>
        <p>
          A short page that answers <em>is everything OK?</em> in under a second,
          a per-service detail view with 30-day history, and a Claude Code analytics dashboard
          showing how often the owner is actually working.
        </p>
        <p>
          Incident narratives are AI-drafted but never auto-published — a human reviews every word
          before anything appears on this site. While monitoring is in progress and the narrative is
          still being prepared, the incident shows only what we factually know.
        </p>
        <h2 className="serif" style={{ fontSize: 24, marginTop: 32 }}>Privacy</h2>
        <p>
          This public side never displays host names, IP addresses, deployment topology,
          internal URLs, or error stack traces. It's designed to be informative to visitors
          while remaining boring to attackers.
        </p>
        <hr style={{ marginTop: 40, marginBottom: 24 }}/>
        <p className="muted" style={{ fontSize: 13 }}>
          Built with care by one person.
        </p>
      </article>
    </div>
  );
}

Object.assign(window, {
  PublicChrome, PublicOverview, PublicServiceDetail, PublicIncidentHistory,
  PublicIncidentDetail, PublicClaudeCode, PublicAbout, NotFound,
  ChartCard, SectionHeader, RecentIncidentRow, ActiveIncidentCard, TimelineList, Breadcrumb, LocalClock,
});
