/* Aglaea — Design system kitchen sink */
/* eslint-disable */

function DesignSystem({ go }) {
  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <header style={{ marginBottom: 40 }}>
        <div className="text-xs mono muted-2" style={{ letterSpacing:".1em", textTransform:"uppercase" }}>Reference</div>
        <h1 className="serif" style={{ fontSize: 48, marginTop: 8 }}>Design system.</h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 15, maxWidth: 620 }}>
          Tokens, atoms, and primitives Aglaea is built from. All components in one place for review.
        </p>
      </header>

      <Section title="Palette">
        <div className="ds-swatches">
          <Swatch token="--gold-100" />
          <Swatch token="--gold-200" />
          <Swatch token="--gold-300" />
          <Swatch token="--gold-400" label="accent" />
          <Swatch token="--gold-500" />
          <Swatch token="--gold-600" />
          <Swatch token="--teal-300" />
          <Swatch token="--teal-500" />
          <Swatch token="--bg-0" />
          <Swatch token="--bg-1" />
          <Swatch token="--bg-2" />
          <Swatch token="--bg-3" />
        </div>
      </Section>

      <Section title="Status palette" sub="Color + shape pairing for color-blind safety.">
        <div className="row gap-3" style={{ flexWrap: "wrap" }}>
          <StatusBadge status="ok" />
          <StatusBadge status="degraded" />
          <StatusBadge status="down" />
          <StatusBadge status="unknown" />
        </div>
      </Section>

      <Section title="Typography">
        <div className="col gap-3">
          <div>
            <div className="text-xs mono muted-2" style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: ".08em" }}>Display · Newsreader serif</div>
            <div className="serif" style={{ fontSize: 56, lineHeight: 1.05 }}>All systems operational.</div>
            <div className="serif" style={{ fontSize: 32, marginTop: 8 }}>Heading — h2</div>
            <div className="serif" style={{ fontSize: 22, marginTop: 8 }}>Heading — h3</div>
          </div>
          <div>
            <div className="text-xs mono muted-2" style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: ".08em" }}>Body · Inter</div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, maxWidth: 540 }}>
              The body type pairs a clean sans with the serif display. Numerics use tabular figures
              so columns line up: <span className="num">1,234,567</span> tokens, <span className="num">99.42%</span> uptime.
            </p>
          </div>
          <div>
            <div className="text-xs mono muted-2" style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: ".08em" }}>Mono · JetBrains Mono</div>
            <div className="mono" style={{ fontSize: 14 }}>incident.id = 47 · service = cerydra · status = ongoing</div>
          </div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-primary">Publish</button>
          <button className="btn">Default</button>
          <button className="btn btn-ghost">Ghost</button>
          <button className="btn btn-danger">Reject</button>
          <button className="btn btn-sm">Small</button>
          <button className="btn btn-lg">Large</button>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="form-grid" style={{ maxWidth: 600 }}>
          <Field label="Display name" value="Cerydra" />
          <Field label="Slug" value="cerydra" mono />
          <Field label="Description" value="Discord investment-group agent" full multiline />
        </div>
      </Section>

      <Section title="Service glyphs">
        <div className="row gap-4" style={{ color: "var(--accent)", padding: 16, background: "var(--bg-1)", borderRadius: 8 }}>
          {["graces", "hyacinth", "hydra", "key", "winged"].map(g => (
            <div key={g} className="col" style={{ alignItems: "center", gap: 6 }}>
              <ServiceGlyph kind={g} size={32} />
              <span className="text-xs mono muted-2">{g}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Brandmark + star field">
        <div className="row gap-6">
          <div className="col" style={{ alignItems: "center", gap: 8 }}>
            <Brandmark size={48} />
            <span className="text-xs mono muted-2">24×24</span>
          </div>
          <div className="col" style={{ alignItems: "center", gap: 8 }}>
            <Brandmark size={64} />
            <span className="text-xs mono muted-2">64×64</span>
          </div>
        </div>
      </Section>

      <Section title="Sparkline · uptime calendar · heartbeat strip">
        <div className="col gap-4">
          <div className="card" style={{ padding: 16, maxWidth: 480 }}>
            <Sparkline data={window.SERVICES[2].uptime_30d} w={460} h={36} />
            <div className="text-xs mono muted-2" style={{ marginTop: 6 }}>30-day uptime · {window.SERVICES[2].uptime_30d_pct.toFixed(2)}%</div>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <UptimeCalendar days={window.SERVICES[2].uptime_30d} w={620} />
          </div>
          <div className="card" style={{ padding: 16 }}>
            <HeartbeatStrip data={window.SERVICES[2].heartbeats} w={620} h={28} />
          </div>
        </div>
      </Section>

      <Section title="Charts">
        <div className="cc-grid">
          <ChartCard title="Line" sub="single series">
            <LineChart series={[{ name:"a", data: window.CLAUDE_CODE.token_total_30d.map(p=>({x:p.ts,y:p.value})) }]} h={140} yFormat={fmtNum} />
          </ChartCard>
          <ChartCard title="Bar">
            <BarChart data={window.CLAUDE_CODE.sessions_daily_30d.map(d=>({x:d.date,y:d.count}))} h={140} />
          </ChartCard>
          <ChartCard title="Donut">
            <Donut data={window.CLAUDE_CODE.token_by_model.map(m=>({label:m.model.split("-").pop(), value:m.value}))} />
          </ChartCard>
        </div>
      </Section>

      <Section title="Status banners">
        <div className="col gap-3">
          <StatusBanner status="ok" title="All systems operational." sub="Every service responding within tolerance." />
          <StatusBanner status="degraded" title="Some services degraded." sub="cerydra — jin10 elevated latency." />
          <StatusBanner status="down" title="Active incident in progress." sub="cerydra — jin10 unreachable." />
        </div>
      </Section>

      <Section title="Tags & chips">
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          <span className="tag">push</span>
          <span className="tag">pull</span>
          <span className="tag" style={{ color: "var(--accent)", borderColor: "var(--accent-line)" }}>draft</span>
          <span className="chip on">selected</span>
          <span className="chip">unselected</span>
          <span className="kbd">⌘K</span>
          <span className="kbd">↵</span>
        </div>
      </Section>

      <Section title="Motion">
        <div className="muted text-sm" style={{ maxWidth: 540, lineHeight: 1.7 }}>
          fast <span className="kbd">120ms</span> for hover ·
          base <span className="kbd">200ms</span> for status transitions ·
          slow <span className="kbd">400ms</span> for skeleton fade.
          Easing: <span className="mono">cubic-bezier(.22,.61,.36,1)</span>.
          No bouncing. No parallax.
        </div>
      </Section>
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <div style={{ marginBottom: 18, paddingBottom: 8, borderBottom: "1px solid var(--line-1)" }}>
        <div className="text-xs mono muted-2" style={{ textTransform: "uppercase", letterSpacing: ".08em" }}>{title}</div>
        {sub && <div className="text-sm muted" style={{ marginTop: 4 }}>{sub}</div>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ token, label }) {
  const ref = useRef(null);
  const [hex, setHex] = useState("");
  useEffect(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    setHex(v);
  }, [token]);
  return (
    <div className="ds-swatch">
      <div className="ds-swatch-color" style={{ background: `var(${token})` }} />
      <div className="text-xs mono" style={{ color: "var(--fg-1)", marginTop: 6 }}>{token}</div>
      <div className="text-xs mono muted-2">{hex}</div>
      {label && <div className="text-xs muted" style={{ marginTop: 2 }}>{label}</div>}
    </div>
  );
}

Object.assign(window, { DesignSystem });
