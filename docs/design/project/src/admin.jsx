/* Aglaea — Admin chrome + dashboard + services + claude-code + audit + settings */
/* eslint-disable */

// ── Admin chrome (sidebar) ────────────────────────────────────
function AdminChrome({ children, route, go }) {
  const sections = [
    { key: "/admin",          label: "Dashboard",   icon: "▦" },
    { key: "/admin/services", label: "Services",    icon: "◇" },
    { key: "/admin/incidents", label: "Incidents",  icon: "◐" },
    { key: "/admin/claude-code", label: "Claude Code", icon: "✧" },
    { key: "/admin/audit-log", label: "Audit log",  icon: "≡" },
    { key: "/admin/settings",  label: "Settings",   icon: "⌘" },
  ];
  const matchKey = (key) => key === "/admin" ? route === "/admin" : route.startsWith(key);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <a href="#/admin" onClick={e=>{e.preventDefault();go("/admin");}} className="row gap-2" style={{textDecoration:"none"}}>
            <Brandmark size={20} />
            <span className="serif" style={{ fontSize: 17, color: "var(--fg-0)" }}>Aglaea</span>
            <span className="tag" style={{ height: 18, padding: "0 6px", fontSize: 9.5 }}>admin</span>
          </a>
        </div>
        <nav className="admin-nav">
          {sections.map(s => (
            <a key={s.key} href={"#"+s.key} onClick={e=>{e.preventDefault();go(s.key);}}
               className={"admin-nav-item" + (matchKey(s.key) ? " on" : "")}>
              <span className="admin-nav-icon mono">{s.icon}</span>
              <span>{s.label}</span>
              {s.key === "/admin/incidents" && (() => {
                const drafts = window.INCIDENTS.filter(i => i.status === "ongoing" && i.report_state === "draft").length;
                return drafts ? <span className="admin-nav-badge">{drafts}</span> : null;
              })()}
            </a>
          ))}
        </nav>
        <div className="admin-side-foot">
          <a href="#/" onClick={e=>{e.preventDefault();go("/");}} className="text-xs muted">
            ↗ View as public
          </a>
          <div className="text-xs mono muted-2" style={{ marginTop: 10 }}>
            signed in as <span style={{ color: "var(--fg-1)" }}>yvon</span>
          </div>
          <a href="#/login" onClick={e=>{e.preventDefault();go("/login");}} className="text-xs muted" style={{ marginTop: 4, display: "block" }}>
            Sign out
          </a>
        </div>
      </aside>
      <div className="admin-main">
        <div key={route} className="page-fade">{children}</div>
      </div>
    </div>
  );
}

// ── Admin dashboard ───────────────────────────────────────────
function AdminDashboard({ go, tick }) {
  const services = window.SERVICES;
  const incidents = window.INCIDENTS;
  const ongoing = incidents.filter(i => i.status === "ongoing");
  const drafts = ongoing.filter(i => i.report_state === "draft");
  const skeleton = ongoing.filter(i => i.report_state === "none");
  const upCount = services.filter(s => s.last_status === "ok").length;

  const recentActivity = [
    ...window.AUDIT.slice(0, 6),
  ];

  return (
    <div className="admin-page">
      <PageHeader title="Dashboard" sub={`Welcome back, yvon. Local time ${new Date().toLocaleString("en-GB", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Singapore" })} SGT`} />

      <div className="glance-row">
        <GlanceTile label="Services up" value={`${upCount} / ${services.length}`} tone={upCount === services.length ? "ok" : "degraded"} />
        <GlanceTile label="Ongoing incidents" value={ongoing.length} tone={ongoing.length ? "down" : "ok"} />
        <GlanceTile label="Drafts to review" value={drafts.length} tone={drafts.length ? "degraded" : "ok"} onClick={()=>drafts.length && go(`/admin/incidents/${drafts[0].id}`)} />
        <GlanceTile label="Anomalies · 24h" value="2" tone="degraded" sub="cerydra weekly · hyacine summarizer" />
      </div>

      {ongoing.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2 className="admin-h2">Ongoing</h2>
          <div className="col gap-3">
            {ongoing.map(inc => {
              const s = services.find(x => x.slug === inc.service_slug);
              const isSkeleton = inc.report_state === "none";
              return (
                <div key={inc.id} className={"admin-incident-card" + (isSkeleton ? " is-skeleton" : "")}
                  onClick={()=>go(`/admin/incidents/${inc.id}`)}>
                  <div className="row gap-3" style={{ alignItems: "flex-start" }}>
                    <span style={{color:`var(--${s.last_status})`, marginTop: 2}}><ServiceGlyph kind={s.glyph} size={22}/></span>
                    <div className="grow">
                      <div className="row gap-3" style={{ alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", rowGap: 4 }}>
                        <span className="serif" style={{ fontSize: 18 }}>{s.display_name}</span>
                        <StatusBadge status={s.last_status} size="sm" />
                        <span className="text-xs mono muted-2" style={{ whiteSpace: "nowrap" }}>#{inc.id} · {fmtDuration(inc.started_at)}</span>
                      </div>
                      <div className="text-sm muted" style={{ lineHeight: 1.55 }}>
                        {isSkeleton ? (
                          <span><strong style={{color:"var(--degraded)"}}>◐ No draft yet</strong> — affected: <span className="mono">{inc.affected_subchecks.join(", ")}</span></span>
                        ) : (
                          inc.report_state === "draft"
                            ? <span><strong style={{color:"var(--accent)"}}>Draft #{inc.report_generation_count}</strong> · {inc.report_text.slice(0, 140)}…</span>
                            : <span><strong style={{color:"var(--ok)"}}>Published</strong> · {inc.published_text.slice(0, 140)}…</span>
                        )}
                      </div>
                    </div>
                    <div className="col gap-2" style={{ alignItems: "flex-end" }}>
                      {inc.report_state === "draft" && <button className="btn btn-primary btn-sm">Review →</button>}
                      {isSkeleton && <button className="btn btn-sm">Open →</button>}
                      {inc.report_state === "published" && <button className="btn btn-sm">Open →</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="dash-grid">
        <section className="dash-col">
          <h2 className="admin-h2">Drafts pending review</h2>
          {drafts.length ? (
            <div className="col gap-2">
              {drafts.map(d => {
                const s = services.find(x => x.slug === d.service_slug);
                return (
                  <div key={d.id} className="card hover-row admin-draft-row" onClick={()=>go(`/admin/incidents/${d.id}`)}>
                    <div className="row gap-2"><StatusGlyph status={s.last_status} size={10} /><span className="serif">{s.display_name}</span></div>
                    <div className="text-xs muted truncate">{d.report_text.slice(0, 90)}…</div>
                    <span className="text-xs mono muted-2">gen #{d.report_generation_count} · {fmtTime(d.report_generated_at)}</span>
                  </div>
                );
              })}
            </div>
          ) : <EmptyMini icon="✓" text="No drafts waiting." />}

          <h2 className="admin-h2" style={{ marginTop: 32 }}>Quick links</h2>
          <div className="quick-grid">
            <QuickLink onClick={()=>go("/admin/services/new")} icon="+" label="Add service" sub="register a new heartbeat target" />
            <QuickLink onClick={()=>go("/admin/services")} icon="◇" label="Services" sub={`${services.length} registered`} />
            <QuickLink onClick={()=>go("/admin/audit-log")} icon="≡" label="Audit log" sub="auth events & system changes" />
            <QuickLink onClick={()=>go("/admin/claude-code")} icon="✧" label="Claude Code" sub="with host split" />
          </div>
        </section>

        <section className="dash-col">
          <h2 className="admin-h2">Recent activity</h2>
          <div className="activity-feed">
            {recentActivity.map((a, i) => (
              <div key={i} className="activity-row">
                <div className="activity-time mono text-xs muted-2">{fmtTime(a.t)}</div>
                <div className="activity-body">
                  <span className="mono text-xs" style={{ color: a.actor_type === "user" ? "var(--accent)" : "var(--c-2)" }}>{a.actor}</span>
                  <span className="text-sm muted"> {a.event.replace(/\./g, " ")}</span>
                  {a.details && <span className="text-xs muted-2"> · {Object.values(a.details).slice(0,2).join(" ")}</span>}
                </div>
              </div>
            ))}
            <a className="text-xs muted" href="#" onClick={e=>{e.preventDefault();go("/admin/audit-log");}}>View full audit log →</a>
          </div>
        </section>
      </div>
    </div>
  );
}

function PageHeader({ title, sub, action }) {
  return (
    <header className="admin-page-hd">
      <div>
        <h1 className="serif" style={{ fontSize: 30 }}>{title}</h1>
        {sub && <div className="muted text-sm" style={{ marginTop: 4 }}>{sub}</div>}
      </div>
      {action}
    </header>
  );
}

function GlanceTile({ label, value, sub, tone = "ok", onClick }) {
  return (
    <div className={"glance-tile tone-" + tone + (onClick ? " clickable" : "")} onClick={onClick}>
      <div className="text-xs mono muted-2" style={{ textTransform:"uppercase", letterSpacing:".08em" }}>{label}</div>
      <div className="serif glance-value">{value}</div>
      {sub && <div className="text-xs muted" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function QuickLink({ icon, label, sub, onClick }) {
  return (
    <button className="quick-link hover-row" onClick={onClick}>
      <span className="quick-icon mono">{icon}</span>
      <div className="col" style={{ alignItems: "flex-start" }}>
        <span style={{ color: "var(--fg-1)", fontSize: 13 }}>{label}</span>
        <span className="text-xs muted-2">{sub}</span>
      </div>
    </button>
  );
}

function EmptyMini({ icon, text }) {
  return <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--fg-2)" }}>
    <span className="serif" style={{ fontSize: 22, color: "var(--accent)" }}>{icon}</span>
    <div className="text-sm" style={{ marginTop: 6 }}>{text}</div>
  </div>;
}

// ── Admin Services list ──────────────────────────────────────
function AdminServices({ go }) {
  const services = window.SERVICES;
  return (
    <div className="admin-page">
      <PageHeader title="Services" sub={`${services.length} registered`}
        action={<button className="btn btn-primary" onClick={()=>go("/admin/services/new")}>+ Add service</button>}
      />

      <div className="admin-table">
        <div className="admin-table-hd">
          <div style={{width:32}}></div>
          <div style={{flex:"1.2 1 0", minWidth: 180}}>Service</div>
          <div style={{width:80}}>Kind</div>
          <div style={{flex:"1 1 0"}}>Status</div>
          <div style={{width:120}}>Last beat</div>
          <div style={{width:80}}>API keys</div>
          <div style={{width:90}}>Public</div>
          <div style={{width:90, textAlign:"right"}}></div>
        </div>
        {services.map(s => {
          const keys = (window.API_KEYS[s.slug] || []).length;
          return (
            <div key={s.slug} className="admin-table-row hover-row" onClick={()=>go(`/admin/services/${s.slug}`)}>
              <div style={{width:32, color: s.last_status === "ok" ? "var(--fg-2)" : `var(--${s.last_status})`}}>
                <ServiceGlyph kind={s.glyph} size={18}/>
              </div>
              <div style={{flex:"1.2 1 0", minWidth: 180}}>
                <div style={{color:"var(--fg-1)"}}>{s.display_name}</div>
                <div className="text-xs muted-2 mono">{s.slug}</div>
              </div>
              <div style={{width:80}}><span className="tag" style={{height:20, fontSize:10}}>{s.kind}</span></div>
              <div style={{flex:"1 1 0"}}><StatusBadge status={s.last_status} size="sm"/></div>
              <div style={{width:120}} className="text-xs mono muted">{fmtTime(s.last_heartbeat_at)}</div>
              <div style={{width:80}} className="mono">{keys}</div>
              <div style={{width:90}}>
                <span className="mini-toggle" data-on={s.public_visible}>
                  <span className="mini-toggle-dot"/>
                </span>
              </div>
              <div style={{width:90, textAlign:"right"}} className="text-xs muted-2">→</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Admin Service detail ─────────────────────────────────────
function AdminServiceDetail({ slug, go }) {
  const s = window.SERVICES.find(x => x.slug === slug);
  if (!s) return <NotFound go={go} />;
  const keys = window.API_KEYS[slug] || [];
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyLabel, setKeyLabel] = useState("");
  const myIncidents = window.INCIDENTS.filter(i => i.service_slug === slug);

  function generate() {
    const random = Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14);
    setNewKey("agl_live_" + random);
    setKeyCopied(false);
  }

  return (
    <div className="admin-page">
      <Breadcrumb items={[
        { label: "Services", href: "/admin/services", go },
        { label: s.display_name },
      ]}/>
      <PageHeader title={s.display_name}
        sub={<span><span className="mono muted-2">{s.slug}</span> · <StatusBadge status={s.last_status} size="sm"/></span>}
        action={<div className="row gap-2"><button className="btn" onClick={()=>go(`/services/${slug}`)}>↗ Public view</button></div>}
      />

      <div className="admin-section">
        <h2 className="admin-h3">Metadata</h2>
        <div className="form-grid">
          <Field label="Display name" value={s.display_name} />
          <Field label="Slug" value={s.slug} mono />
          <Field label="Description" value={s.description} full />
          <Field label="Kind" value={s.kind} mono />
          <Field label="Heartbeat interval" value="60s" mono />
          <ToggleField label="Public visible" value={s.public_visible} />
          <ToggleField label="Auto-generate drafts" value={true} />
          <Field label="DeepSeek context" value={s.deepseek_context} full multiline />
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-h3">Subcheck configuration</h2>
        {Object.keys(s.last_subchecks).length ? (
          <div className="col gap-2">
            {Object.entries(s.last_subchecks).map(([k, v], i) => (
              <div key={k} className="subcheck-config-row">
                <span className="mono text-xs muted-2">{i + 1}</span>
                <span className="mono" style={{ color: "var(--fg-1)", width: 120 }}>{k}</span>
                <input className="input" defaultValue={k} style={{ maxWidth: 200 }} />
                <StatusBadge status={v.status} size="sm" />
                <span className="text-xs mono muted-2 grow">{v.message || "—"}</span>
                <button className="btn btn-ghost btn-sm">↑</button>
                <button className="btn btn-ghost btn-sm">↓</button>
              </div>
            ))}
          </div>
        ) : <div className="muted text-sm">No subchecks configured.</div>}
      </div>

      <div className="admin-section">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 className="admin-h3">API keys</h2>
          <button className="btn btn-primary btn-sm" onClick={()=>{setShowKeyModal(true);setNewKey(null);setKeyLabel("");}}>+ Generate new key</button>
        </div>
        {keys.length ? (
          <div className="admin-table">
            <div className="admin-table-hd">
              <div style={{flex:"1 1 0"}}>Label</div>
              <div style={{flex:"1 1 0"}}>Prefix</div>
              <div style={{width:120}}>Created</div>
              <div style={{width:120}}>Last used</div>
              <div style={{width:80, textAlign:"right"}}></div>
            </div>
            {keys.map(k => (
              <div key={k.id} className="admin-table-row">
                <div style={{flex:"1 1 0", color:"var(--fg-1)"}}>{k.label}</div>
                <div style={{flex:"1 1 0"}} className="mono">{k.prefix}</div>
                <div style={{width:120}} className="text-xs mono muted">{fmtTime(k.created_at)}</div>
                <div style={{width:120}} className="text-xs mono muted">{fmtTime(k.last_used_at)}</div>
                <div style={{width:80, textAlign:"right"}}>
                  <button className="btn btn-ghost btn-sm btn-danger">Revoke</button>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="muted text-sm">No keys yet.</div>}
      </div>

      <div className="admin-section">
        <h2 className="admin-h3">Recent heartbeats</h2>
        <div className="card" style={{ padding: 16 }}>
          <HeartbeatStrip data={s.heartbeats} w={720} h={28} />
          <div className="row between text-xs mono muted-2" style={{ marginTop: 6 }}>
            <span>−60m</span><span>now</span>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-h3">Recent incidents</h2>
        <div className="recent-list">
          {myIncidents.slice(0, 5).map(inc => <RecentIncidentRow key={inc.id} incident={inc} go={(p)=>go(p.replace("/services/", "/admin/").replace("/incidents/", "/incidents/"))} />)}
        </div>
      </div>

      <Modal open={showKeyModal} onClose={()=>setShowKeyModal(false)} title="Generate new API key" width={520}
        footer={newKey ? (
          <div className="row between" style={{ width: "100%" }}>
            <span className="text-xs muted-2">This key will not be shown again.</span>
            <div className="row gap-2">
              <button className="btn" onClick={()=>setShowKeyModal(false)} disabled={!keyCopied}>
                {keyCopied ? "Done" : "Copy key first to dismiss"}
              </button>
            </div>
          </div>
        ) : (
          <div className="row between" style={{ width: "100%" }}>
            <button className="btn btn-ghost" onClick={()=>setShowKeyModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={generate} disabled={!keyLabel.trim()}>Generate</button>
          </div>
        )}
      >
        {!newKey ? (
          <div className="col gap-3">
            <label className="text-sm muted">Label
              <input className="input" placeholder="e.g. ci-runner" autoFocus
                value={keyLabel} onChange={e=>setKeyLabel(e.target.value)} style={{ marginTop: 6 }}/>
            </label>
            <div className="text-xs muted-2" style={{ lineHeight: 1.55 }}>
              The plaintext key will be displayed <strong>once</strong> on the next screen.
              Copy it before dismissing — there is no recovery.
            </div>
          </div>
        ) : (
          <div className="col gap-4">
            <div className="warn-banner">
              <strong style={{ color: "var(--degraded)" }}>⚠ Copy this key now.</strong>
              <span className="text-sm muted"> It will not be shown again, ever.</span>
            </div>
            <div className="key-display mono">{newKey}</div>
            <div className="row gap-2">
              <button className="btn btn-primary grow" onClick={()=>{
                navigator.clipboard?.writeText(newKey).catch(()=>{});
                setKeyCopied(true);
              }}>{keyCopied ? "✓ Copied" : "Copy to clipboard"}</button>
            </div>
            {keyCopied && (
              <label className="row gap-2" style={{ alignItems: "flex-start" }}>
                <input type="checkbox" defaultChecked /> <span className="text-sm">I have safely copied this key.</span>
              </label>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, value, mono, full, multiline }) {
  return (
    <div className={"field" + (full ? " full" : "")}>
      <label className="text-xs mono muted-2" style={{ textTransform:"uppercase", letterSpacing:".08em" }}>{label}</label>
      {multiline
        ? <textarea className="input" defaultValue={value} style={{ minHeight: 60 }} />
        : <input className={"input" + (mono ? " mono" : "")} defaultValue={value} />}
    </div>
  );
}

function ToggleField({ label, value }) {
  const [v, setV] = useState(value);
  return (
    <div className="field row between" style={{ height: 56, alignItems: "center" }}>
      <label className="text-xs mono muted-2" style={{ textTransform:"uppercase", letterSpacing:".08em" }}>{label}</label>
      <span className="mini-toggle" data-on={v} onClick={()=>setV(!v)}><span className="mini-toggle-dot"/></span>
    </div>
  );
}

// ── New service form ─────────────────────────────────────────
function AdminServiceNew({ go }) {
  return (
    <div className="admin-page">
      <Breadcrumb items={[
        { label: "Services", href: "/admin/services", go },
        { label: "New" },
      ]}/>
      <PageHeader title="Add service" sub="Register a new heartbeat target." />
      <div className="admin-section">
        <div className="form-grid">
          <Field label="Display name" value="" />
          <Field label="Slug" value="" mono />
          <Field label="Description" value="" full />
          <div className="field">
            <label className="text-xs mono muted-2" style={{ textTransform:"uppercase", letterSpacing:".08em" }}>Kind</label>
            <div className="row gap-2" style={{ marginTop: 6 }}>
              <span className="chip on">push</span>
              <span className="chip">pull</span>
            </div>
          </div>
          <Field label="Heartbeat interval" value="60" mono />
          <ToggleField label="Public visible" value={true} />
          <Field label="DeepSeek context" value="" full multiline />
        </div>
        <div className="row gap-2" style={{ marginTop: 24, justifyContent:"flex-end" }}>
          <button className="btn" onClick={()=>go("/admin/services")}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>go("/admin/services")}>Create service</button>
        </div>
      </div>
    </div>
  );
}

// ── Admin incidents list ─────────────────────────────────────
function AdminIncidents({ go }) {
  const [filter, setFilter] = useState("all");
  const list = window.INCIDENTS.filter(i => {
    if (filter === "ongoing") return i.status === "ongoing";
    if (filter === "draft") return i.report_state === "draft";
    if (filter === "skeleton") return i.report_state === "none";
    if (filter === "resolved") return i.status === "resolved";
    return true;
  });
  return (
    <div className="admin-page">
      <PageHeader title="Incidents" sub="All incidents across all services. Includes unpublished drafts." />
      <div className="row gap-2" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        {["all","ongoing","draft","skeleton","resolved"].map(f => (
          <span key={f} className={"chip " + (filter === f ? "on" : "")} onClick={()=>setFilter(f)}>
            {f}
          </span>
        ))}
      </div>
      <div className="admin-table">
        <div className="admin-table-hd">
          <div style={{width:60}}>#</div>
          <div style={{flex:"1 1 0"}}>Service</div>
          <div style={{width:120}}>State</div>
          <div style={{width:120}}>Started</div>
          <div style={{width:90}}>Duration</div>
          <div style={{flex:"2 1 0"}}>Summary</div>
          <div style={{width:60, textAlign:"right"}}></div>
        </div>
        {list.map(inc => {
          const s = window.SERVICES.find(x => x.slug === inc.service_slug);
          const stateTone =
            inc.report_state === "draft" ? "var(--accent)" :
            inc.report_state === "published" ? "var(--ok)" :
            inc.report_state === "none" ? "var(--down)" : "var(--fg-3)";
          return (
            <div key={inc.id} className="admin-table-row hover-row" onClick={()=>go(`/admin/incidents/${inc.id}`)}>
              <div style={{width:60}} className="mono">#{inc.id}</div>
              <div style={{flex:"1 1 0"}}>
                <span className="row gap-2">
                  <span style={{color:`var(--${s.last_status})`}}><ServiceGlyph kind={s.glyph} size={14}/></span>
                  {s.display_name}
                </span>
              </div>
              <div style={{width:120, color: stateTone}} className="mono text-xs" >
                {inc.status === "ongoing" ? "● ongoing" : "✓ resolved"}
                <div className="text-xs" style={{opacity:.7}}>{inc.report_state}</div>
              </div>
              <div style={{width:120}} className="text-xs mono muted">{fmtTime(inc.started_at)}</div>
              <div style={{width:90}} className="mono text-xs">{fmtDuration(inc.started_at, inc.resolved_at)}</div>
              <div style={{flex:"2 1 0"}} className="text-xs muted truncate">{inc.published_text || inc.report_text || "no narrative"}</div>
              <div style={{width:60, textAlign:"right"}} className="text-xs muted-2">→</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 4.9 ADMIN INCIDENT REVIEW — the critical screen ──────────
function AdminIncidentReview({ id, go }) {
  const inc = window.INCIDENTS.find(i => i.id === +id);
  if (!inc) return <NotFound go={go} />;
  const s = window.SERVICES.find(x => x.slug === inc.service_slug);

  const [draftText, setDraftText] = useState(inc.report_text || "");
  const [publishedText, setPublishedText] = useState(inc.published_text || "");
  const [tab, setTab] = useState("editor"); // editor | diff
  const [genInstruction, setGenInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genCount, setGenCount] = useState(inc.report_generation_count || 0);
  const [genReason, setGenReason] = useState(inc.report_generation_reason);
  const [reportState, setReportState] = useState(inc.report_state);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  const isSkeleton = reportState === "none";
  const hasUnpublishedChanges = draftText !== publishedText;

  function regenerate() {
    setGenerating(true);
    setTimeout(() => {
      const focus = genInstruction.trim();
      const synthDraft = focus
        ? `[Regenerated · focus: ${focus}]\n\n${draftText || "Draft generated."}\n\nAdditional emphasis: ${focus}`
        : `${draftText || "Initial draft."} \n\n(Auto-regenerated at ${new Date().toISOString().slice(11, 16)} UTC)`;
      setDraftText(synthDraft);
      setGenCount(c => c + 1);
      setGenReason(focus ? "manual" : "periodic");
      setReportState("draft");
      setGenInstruction("");
      setGenerating(false);
    }, 1200);
  }

  function publish() {
    setPublishedText(draftText);
    setReportState("published");
    setConfirmPublish(false);
  }

  function reject() {
    setDraftText("");
    setReportState("none");
    setConfirmReject(false);
  }

  const timeline = window.INCIDENT_TIMELINES[inc.id] || [];
  const heartbeats = window.INCIDENT_HEARTBEATS[inc.id] || [];
  const similar = window.SIMILAR[inc.id] || [];

  // Build swimlane from timeline
  const subs = inc.affected_subchecks.length ? inc.affected_subchecks : Object.keys(s.last_subchecks);
  const tStart = +new Date(inc.started_at);
  const tEnd = +new Date(inc.resolved_at || window.NOW);
  const lanes = subs.map(name => {
    const events = timeline.filter(t => t.sub === name);
    if (!events.length) return { name, segments: [{ start: inc.started_at, end: inc.resolved_at || window.NOW.toISOString(), status: "ok" }] };
    const segs = [];
    let cursor = tStart;
    events.forEach(ev => {
      const evT = +new Date(ev.t);
      if (evT > cursor) segs.push({ start: new Date(cursor).toISOString(), end: ev.t, status: segs.length ? segs[segs.length-1].status : "ok" });
      cursor = evT;
      segs.push({ start: ev.t, end: ev.t, status: ev.status }); // placeholder
    });
    // re-bake: derive ranges
    const out = [];
    let last = "ok", lastT = tStart;
    events.forEach(ev => {
      const evT = +new Date(ev.t);
      out.push({ start: new Date(lastT).toISOString(), end: ev.t, status: last });
      last = ev.status;
      lastT = evT;
    });
    out.push({ start: new Date(lastT).toISOString(), end: new Date(tEnd).toISOString(), status: last });
    return { name, segments: out };
  });

  return (
    <div className="admin-page incident-review">
      <Breadcrumb items={[
        { label: "Incidents", href: "/admin/incidents", go },
        { label: `#${inc.id}` },
      ]}/>

      <header className="ir-header">
        <div className="col gap-2">
          <div className="row gap-3" style={{ alignItems: "center" }}>
            <span style={{color:`var(--${s.last_status})`}}><ServiceGlyph kind={s.glyph} size={28}/></span>
            <h1 className="serif" style={{ fontSize: 28 }}>{s.display_name}</h1>
            <span className="tag" style={{ color: inc.status === "ongoing" ? "var(--degraded)" : "var(--ok)", borderColor: inc.status === "ongoing" ? "var(--degraded-line)" : "var(--ok-line)" }}>
              {inc.status === "ongoing" ? "● Ongoing" : "✓ Resolved"}
            </span>
            <span className="text-xs mono muted-2">incident #{inc.id}</span>
          </div>
          <div className="row gap-5 text-xs mono muted-2">
            <span>STARTED <span style={{color:"var(--fg-1)"}}>{fmtClock(inc.started_at)}</span></span>
            {inc.resolved_at ? (
              <span>RESOLVED <span style={{color:"var(--fg-1)"}}>{fmtClock(inc.resolved_at)}</span></span>
            ) : (
              <span>ELAPSED <span style={{color:"var(--fg-1)"}}>{fmtDuration(inc.started_at)}</span></span>
            )}
            <span>SUBCHECKS <span style={{color:"var(--fg-1)"}}>{inc.affected_subchecks.join(", ")}</span></span>
          </div>
        </div>
        <div className="ir-status-pill">
          <div className="text-xs mono muted-2" style={{ textTransform:"uppercase", letterSpacing:".08em" }}>Report</div>
          <div className={"ir-report-state st-" + reportState}>
            {reportState === "none" && "◐ No draft"}
            {reportState === "draft" && `✎ Draft · gen #${genCount}`}
            {reportState === "published" && "✓ Published"}
            {reportState === "rejected" && "✕ Rejected"}
          </div>
        </div>
      </header>

      <div className="ir-grid">
        {/* LEFT — incident data */}
        <div className="ir-left">
          <section className="card" style={{ padding: 20 }}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <h3 className="admin-h4">Subcheck timeline</h3>
              <span className="text-xs mono muted-2">{subs.length} lane{subs.length>1?"s":""}</span>
            </div>
            <Swimlane lanes={lanes} w={620} />
          </section>

          <section className="card" style={{ padding: 20 }}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <h3 className="admin-h4">Heartbeat events</h3>
              <div className="row gap-2">
                <span className="chip on">all</span>
                <span className="chip">downs</span>
                <span className="chip">degraded</span>
              </div>
            </div>
            {heartbeats.length ? (
              <div className="hb-table">
                <div className="hb-row hb-hd">
                  <div style={{width:80}}>time</div>
                  <div style={{width:90}}>subcheck</div>
                  <div style={{width:90}}>status</div>
                  <div style={{width:80, textAlign:"right"}}>latency</div>
                  <div className="grow">message</div>
                </div>
                {heartbeats.slice(0, 12).map((h, i) => (
                  <div key={i} className="hb-row">
                    <div style={{width:80}} className="mono text-xs muted">{new Date(h.t).toISOString().slice(11,16)}</div>
                    <div style={{width:90}} className="mono text-xs">{h.sub}</div>
                    <div style={{width:90}}><StatusBadge status={h.status} size="sm"/></div>
                    <div style={{width:80, textAlign:"right"}} className="mono text-xs muted">{h.latency_ms ? h.latency_ms+"ms" : "—"}</div>
                    <div className="grow text-xs muted-2 truncate">{h.message}</div>
                  </div>
                ))}
                <div className="text-xs muted-2 mono" style={{textAlign:"center", padding:"10px 0"}}>+ {Math.max(0, heartbeats.length - 12)} more</div>
              </div>
            ) : <div className="muted text-sm">No heartbeat events captured.</div>}
          </section>

          <section className="card" style={{ padding: 20 }}>
            <h3 className="admin-h4" style={{ marginBottom: 12 }}>Recent similar incidents</h3>
            {similar.length ? (
              <div className="col gap-2">
                {similar.map(sim => (
                  <div key={sim.id} className="similar-row hover-row" onClick={()=>go(`/admin/incidents/${sim.id}`)}>
                    <span className="mono text-xs muted-2" style={{width: 60}}>#{sim.id}</span>
                    <span className="text-xs mono muted" style={{width: 100}}>{fmtTime(sim.started_at)}</span>
                    <span className="text-xs mono" style={{width: 80, color:"var(--fg-1)"}}>{sim.duration_min}m</span>
                    <span className="text-sm muted grow truncate">{sim.summary}</span>
                  </div>
                ))}
              </div>
            ) : <div className="muted text-sm">No matching past incidents.</div>}
          </section>
        </div>

        {/* RIGHT — report editor */}
        <div className="ir-right">
          <div className="card ir-editor-card">
            <div className="ir-editor-tabs">
              <button className={"ir-tab" + (tab==="editor"?" on":"")} onClick={()=>setTab("editor")}>
                Editor {hasUnpublishedChanges && <span className="ir-dirty-dot"/>}
              </button>
              <button className={"ir-tab" + (tab==="diff"?" on":"")} onClick={()=>setTab("diff")}>
                Diff vs published
              </button>
              <div className="grow"/>
              <span className="text-xs mono muted-2">
                {reportState !== "none" && genReason && (
                  <>last: {genReason} · {fmtTime(inc.report_generated_at)}</>
                )}
              </span>
            </div>

            {tab === "editor" ? (
              <div className="ir-editor-pane">
                {publishedText && (
                  <details className="ir-published-block">
                    <summary>
                      <StatusGlyph status="ok" size={10}/>
                      <span className="text-xs mono" style={{ color:"var(--ok)", textTransform:"uppercase", letterSpacing:".08em" }}>
                        Currently published
                      </span>
                      <span className="text-xs muted-2 mono">{fmtTime(inc.published_at)}</span>
                    </summary>
                    <div className="ir-published-text">{publishedText}</div>
                  </details>
                )}

                {isSkeleton ? (
                  <div className="ir-skeleton-state">
                    <div className="text-xs mono" style={{ color:"var(--degraded)", textTransform:"uppercase", letterSpacing:".08em" }}>
                      ◐ No draft generated yet
                    </div>
                    <p className="muted text-sm" style={{ lineHeight: 1.55, marginTop: 8 }}>
                      DeepSeek will auto-generate a draft when subchecks change or in {Math.ceil(28 - (Date.now() / 60000) % 30)} min, whichever is first.
                      Or generate one now with optional focus.
                    </p>
                  </div>
                ) : (
                  <div className="col gap-2">
                    <label className="text-xs mono muted-2" style={{ textTransform:"uppercase", letterSpacing:".08em" }}>
                      Editable draft · markdown
                    </label>
                    <textarea
                      className="input ir-textarea"
                      value={draftText}
                      onChange={e=>setDraftText(e.target.value)}
                      placeholder="Draft text…"
                    />
                  </div>
                )}

                <div className="ir-regen">
                  <label className="text-xs mono muted-2" style={{ textTransform:"uppercase", letterSpacing:".08em" }}>
                    Regenerate with focus (optional)
                  </label>
                  <div className="row gap-2" style={{ marginTop: 6 }}>
                    <input className="input"
                      placeholder='e.g. "focus on the recurrence pattern with Jin10"'
                      value={genInstruction}
                      onChange={e=>setGenInstruction(e.target.value)}/>
                    <button className="btn" onClick={regenerate} disabled={generating}>
                      {generating ? <span className="row gap-2"><span className="spin"/> Generating…</span> : "Regenerate"}
                    </button>
                  </div>
                  <div className="text-xs muted-2" style={{ marginTop: 6 }}>
                    Single-shot. Replaces the current draft.
                  </div>
                </div>
              </div>
            ) : (
              <div className="ir-editor-pane">
                <div className="text-xs mono muted-2" style={{ marginBottom: 8, textTransform:"uppercase", letterSpacing:".08em" }}>
                  Published <span style={{color:"var(--down)"}}>−</span> vs Draft <span style={{color:"var(--ok)"}}>+</span>
                </div>
                <DiffView before={publishedText} after={draftText} />
              </div>
            )}

            <div className="ir-actions">
              <div className="ir-action-info">
                <div className="text-xs mono muted-2" style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span className="live-dot" style={{ background: "var(--accent)" }}/>
                  Auto-regenerates on subcheck change or every 30 min
                </div>
              </div>
              <div className="row gap-2">
                <button className="btn btn-ghost btn-sm" onClick={()=>setConfirmReject(true)} disabled={isSkeleton || reportState === "published"}>
                  Reject
                </button>
                <button className="btn btn-sm" onClick={()=>setPublishedText(publishedText)} disabled={!hasUnpublishedChanges}>
                  Save edits
                </button>
                <button className="btn btn-primary btn-sm" onClick={()=>setConfirmPublish(true)} disabled={!hasUnpublishedChanges || isSkeleton}>
                  Publish →
                </button>
              </div>
            </div>
          </div>

          <div className="ir-meta-card card">
            <h4 className="admin-h4" style={{ marginBottom: 12 }}>Generation history</h4>
            <div className="ir-meta-row"><span className="muted-2 text-xs mono">count</span><span className="mono">{genCount}</span></div>
            <div className="ir-meta-row"><span className="muted-2 text-xs mono">last_reason</span><span className="mono text-xs">{genReason || "—"}</span></div>
            <div className="ir-meta-row"><span className="muted-2 text-xs mono">last_at</span><span className="mono text-xs muted">{fmtTime(inc.report_generated_at)}</span></div>
            <div className="ir-meta-row"><span className="muted-2 text-xs mono">state</span><span className="mono text-xs" style={{color: reportState==="published"?"var(--ok)":"var(--accent)"}}>{reportState}</span></div>
          </div>
        </div>
      </div>

      <Modal open={confirmPublish} onClose={()=>setConfirmPublish(false)} title="Publish to public site?"
        footer={<div className="row between" style={{width:"100%"}}>
          <button className="btn btn-ghost" onClick={()=>setConfirmPublish(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={publish}>Yes, publish</button>
        </div>}
      >
        <p className="text-sm" style={{ lineHeight: 1.6 }}>
          This will replace the publicly-visible narrative for <strong>incident #{inc.id}</strong>
          {publishedText ? " (an existing version is already published)" : " (currently unpublished)"}.
          A public visitor will see your draft text within seconds.
        </p>
        <div className="warn-banner" style={{ marginTop: 16 }}>
          <span className="text-xs muted" style={{ lineHeight: 1.5 }}>
            <strong>Reminder:</strong> the published text becomes part of the public record.
            Old versions are retained in the audit log.
          </span>
        </div>
      </Modal>

      <Modal open={confirmReject} onClose={()=>setConfirmReject(false)} title="Reject this draft?"
        footer={<div className="row between" style={{width:"100%"}}>
          <button className="btn btn-ghost" onClick={()=>setConfirmReject(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={reject}>Discard draft</button>
        </div>}
      >
        <p className="text-sm" style={{ lineHeight: 1.6 }}>
          The current draft will be discarded. Any published version remains untouched.
          A new draft can be auto- or manually regenerated.
        </p>
      </Modal>
    </div>
  );
}

// ── Admin Claude Code (with host split) ──────────────────────
function AdminClaudeCode({ go }) {
  const cc = window.CLAUDE_CODE;
  const [hostFilter, setHostFilter] = useState("all"); // all | mac | win | sg-vps
  const [stacked, setStacked] = useState(true);

  // Build per-host data (mock split by ratios)
  const hostKeys = ["mac", "sg-vps", "win"];
  const hostRatio = { mac: 0.72, "sg-vps": 0.24, win: 0.04 };

  const buildStacked = (series, valueKey) => series.map(p => ({
    x: typeof p.ts === "string" ? p.ts.slice(0, 10) : p.date,
    mac: Math.round((p[valueKey] || p.value || p.count) * hostRatio.mac),
    "sg-vps": Math.round((p[valueKey] || p.value || p.count) * hostRatio["sg-vps"]),
    win: Math.round((p[valueKey] || p.value || p.count) * hostRatio.win),
  }));

  const tokenStacked = buildStacked(cc.token_total_30d, "value");
  const costStacked = buildStacked(cc.cost_trend_30d, "usd");

  const hostColors = ["var(--c-1)", "var(--c-2)", "var(--c-4)"];

  return (
    <div className="admin-page">
      <PageHeader title="Claude Code" sub="Same as public, with host_name split and forecasting." />

      <div className="row gap-2" style={{ marginBottom: 24, flexWrap: "wrap" }}>
        <span className="text-xs mono muted-2" style={{ alignSelf: "center" }}>HOST</span>
        {["all", "mac", "sg-vps", "win"].map(h => (
          <span key={h} className={"chip " + (hostFilter === h ? "on" : "")} onClick={()=>setHostFilter(h)}>
            {h}
          </span>
        ))}
        <div className="grow"/>
        <span className="row gap-2 text-xs mono muted-2" style={{alignItems:"center"}}>
          Stacked by host
          <span className="mini-toggle" data-on={stacked} onClick={()=>setStacked(!stacked)}><span className="mini-toggle-dot"/></span>
        </span>
      </div>

      <div className="cc-stats">
        <StatTile label="Tokens · 30d" value={fmtNum(cc.by_host.mac.tokens_30d + cc.by_host["sg-vps"].tokens_30d + cc.by_host.win.tokens_30d)} sub="across 3 hosts" accent />
        <StatTile label="Cost · 30d" value={"$" + (cc.by_host.mac.cost_30d + cc.by_host["sg-vps"].cost_30d + cc.by_host.win.cost_30d).toFixed(2)} sub="usd estimate" />
        <StatTile label="Cache hit · 7d" value={(cc.cache_hit_rate_7d * 100).toFixed(0) + "%"} />
        <StatTile label="Forecast · MTD" value="$186.40" sub="↗ +14% vs prev month" />
      </div>

      <div className="cc-host-row">
        {hostKeys.map((h, i) => (
          <div key={h} className="card host-tile">
            <div className="row gap-2">
              <span style={{ width: 10, height: 10, borderRadius: 2, background: hostColors[i] }} />
              <span className="mono" style={{ color: "var(--fg-1)" }}>{h}</span>
            </div>
            <div className="serif" style={{ fontSize: 24, marginTop: 6 }}>{fmtNum(cc.by_host[h].tokens_30d)}</div>
            <div className="text-xs muted-2 mono">tokens · ${cc.by_host[h].cost_30d.toFixed(2)} · {cc.by_host[h].sessions_30d} sessions</div>
          </div>
        ))}
      </div>

      <div className="cc-grid" style={{ marginTop: 24 }}>
        <ChartCard title="Token usage" sub={stacked ? "stacked by host" : "aggregate"} span={2}>
          {stacked
            ? <StackedBars data={tokenStacked} keys={hostKeys} colors={hostColors} h={200} yFormat={fmtNum}/>
            : <LineChart series={[{ name:"tokens", data: cc.token_total_30d.map(p=>({x:p.ts, y:p.value})) }]} h={200} yFormat={fmtNum} />
          }
        </ChartCard>
        <ChartCard title="Cost trend">
          {stacked
            ? <StackedBars data={costStacked} keys={hostKeys} colors={hostColors} h={160} yFormat={v=>"$"+v.toFixed(0)}/>
            : <LineChart series={[{ name:"cost", data: cc.cost_trend_30d.map(p=>({x:p.ts, y:p.usd})) }]} h={160} yFormat={v=>"$"+v.toFixed(1)} />
          }
        </ChartCard>
        <ChartCard title="Anomaly highlights" sub="last 7 days">
          <div className="col gap-2">
            <AnomalyRow severity="degraded" what="cache_hit_rate" desc="drop 71%→58% on May 10" />
            <AnomalyRow severity="down" what="cost.win" desc="3× normal Tue 06:00 — likely runaway loop" />
            <AnomalyRow severity="ok" what="tokens.mac" desc="returned to baseline" />
          </div>
        </ChartCard>
        <ChartCard title="Active hours" sub="all hosts × 7d × 24h" span={2}>
          <Heatmap data={cc.active_hours_heatmap}
            rowLabels={["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]}
            colLabels={Array.from({length:24}, (_,i) => String(i).padStart(2,"0"))} />
        </ChartCard>
        <ChartCard title="Model split">
          <Donut data={cc.token_by_model.map(m => ({ label: m.model.replace("claude-", ""), value: m.value }))} />
        </ChartCard>
        <ChartCard title="PromQL — ad hoc query" sub="hit ⌘+enter to run" span={3}>
          <textarea className="input mono" rows={3} defaultValue={`sum by (host_name) (rate(claude_code_tokens_total{model="claude-opus-4-7"}[5m]))`} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}/>
          <div className="row gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-sm">Run</button>
            <span className="text-xs muted-2 mono">last result: 3 series · 234 points · 41ms</span>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function AnomalyRow({ severity, what, desc }) {
  return (
    <div className="row gap-2" style={{ padding: "8px 0", borderTop: "1px solid var(--line-1)" }}>
      <StatusGlyph status={severity} size={10} />
      <span className="mono text-xs" style={{ color: "var(--fg-1)", width: 120 }}>{what}</span>
      <span className="text-xs muted">{desc}</span>
    </div>
  );
}

// ── Audit log ────────────────────────────────────────────────
function AdminAuditLog({ go }) {
  const [eventFilter, setEventFilter] = useState("all");
  const events = window.AUDIT;
  const types = Array.from(new Set(events.map(e => e.event)));
  const list = eventFilter === "all" ? events : events.filter(e => e.event === eventFilter);
  const [expanded, setExpanded] = useState(new Set());
  const toggle = (i) => setExpanded(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  return (
    <div className="admin-page">
      <PageHeader title="Audit log" sub="Auth events and system changes. Read-only." />
      <div className="row gap-2" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <span className={"chip " + (eventFilter === "all" ? "on" : "")} onClick={()=>setEventFilter("all")}>all</span>
        {types.map(t => (
          <span key={t} className={"chip " + (eventFilter === t ? "on" : "")} onClick={()=>setEventFilter(t)}>{t}</span>
        ))}
        <div className="grow"/>
        <span className="text-xs mono muted-2" style={{alignSelf:"center"}}>
          showing {list.length} of {events.length}
        </span>
      </div>
      <div className="admin-table">
        <div className="admin-table-hd">
          <div style={{width:140}}>Time</div>
          <div style={{width:80}}>Actor</div>
          <div style={{width:130}}>Actor ID</div>
          <div style={{flex:"1 1 0"}}>Event</div>
          <div style={{width:140}}>IP</div>
          <div style={{width:30}}></div>
        </div>
        {list.map((e, i) => (
          <Fragment key={i}>
            <div className="admin-table-row hover-row" onClick={()=>toggle(i)}>
              <div style={{width:140}} className="mono text-xs">{new Date(e.t).toISOString().slice(0,16).replace("T", " ")}</div>
              <div style={{width:80}}>
                <span className="tag" style={{ height: 18, padding:"0 6px", fontSize:9.5,
                  color: e.actor_type === "user" ? "var(--accent)" : "var(--c-2)",
                  borderColor: e.actor_type === "user" ? "var(--accent-line)" : "rgba(78,145,138,.4)"}}>{e.actor_type}</span>
              </div>
              <div className="mono text-xs" style={{color:"var(--fg-1)", width: 130}}>{e.actor}</div>
              <div className="mono text-xs" style={{ color: e.event.includes("denied") || e.event.includes("rate_limited") ? "var(--down)" : "var(--fg-1)", flex:"1 1 0" }}>
                {e.event}
              </div>
              <div style={{width:140}} className="mono text-xs muted">{e.ip}</div>
              <div style={{width:30, textAlign:"right"}} className="muted-2">{expanded.has(i) ? "▾" : "▸"}</div>
            </div>
            {expanded.has(i) && (
              <div className="audit-details">
                <pre className="mono">{JSON.stringify(e.details, null, 2)}</pre>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Admin Settings ───────────────────────────────────────────
function AdminSettings({ go }) {
  return (
    <div className="admin-page">
      <PageHeader title="Settings" sub="Global configuration. Most values are read-only and set in the server config." />

      <div className="admin-section">
        <h2 className="admin-h3">DeepSeek API</h2>
        <div className="settings-row">
          <div>
            <div className="text-sm" style={{color:"var(--fg-1)"}}>Connection status</div>
            <div className="text-xs muted mono">last call · 2m ago · 200 OK</div>
          </div>
          <StatusBadge status="ok" />
        </div>
        <div className="settings-row">
          <div>
            <div className="text-sm" style={{color:"var(--fg-1)"}}>Success rate · 24h</div>
            <div className="text-xs muted mono">142 calls · 0 failures</div>
          </div>
          <span className="serif" style={{fontSize: 22, color:"var(--accent)"}}>100%</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="text-sm" style={{color:"var(--fg-1)"}}>API key</div>
            <div className="text-xs muted mono">not displayed · configured in server env</div>
          </div>
          <span className="mono text-xs muted-2">DEEPSEEK_API_KEY=•••••</span>
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-h3">Notifications</h2>
        <div className="settings-row">
          <div>
            <div className="text-sm" style={{color:"var(--fg-1)"}}>ntfy destination</div>
            <div className="text-xs muted mono">read-only · server config</div>
          </div>
          <span className="mono text-xs">ntfy.sh/aglaea-alerts-•••</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="text-sm" style={{color:"var(--fg-1)"}}>healthchecks.io linkage</div>
            <div className="text-xs muted mono">5 checks linked</div>
          </div>
          <span className="text-xs mono muted">linked</span>
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-h3">Retention</h2>
        <div className="settings-row">
          <div>
            <div className="text-sm" style={{color:"var(--fg-1)"}}>Heartbeats</div>
            <div className="text-xs muted mono">aggregated after 7 days, dropped after 90</div>
          </div>
          <span className="mono text-xs muted-2">7d / 90d</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="text-sm" style={{color:"var(--fg-1)"}}>Audit log</div>
            <div className="text-xs muted mono">kept for 1 year</div>
          </div>
          <span className="mono text-xs muted-2">365d</span>
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-h3">Export</h2>
        <div className="row gap-3">
          <button className="btn">Export all incidents (JSON)</button>
          <button className="btn">Export audit log (CSV)</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  AdminChrome, AdminDashboard, AdminServices, AdminServiceDetail, AdminServiceNew,
  AdminIncidents, AdminIncidentReview, AdminClaudeCode, AdminAuditLog, AdminSettings,
});
