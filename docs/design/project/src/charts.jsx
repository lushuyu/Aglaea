/* Aglaea — chart primitives (hairline / Tufte) */
/* eslint-disable */

// ── LineChart (single or multi series) ─────────────────────────
function LineChart({ series, w = 600, h = 180, pad = 24, yFormat = (v) => v, showDots = false, area = false }) {
  // series: [{ name, color, data: [{x:Number|Date, y:Number}, ...] }]
  if (!series || !series.length) return null;
  const all = series.flatMap(s => s.data);
  const xs = all.map(p => +new Date(p.x));
  const ys = all.map(p => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys), yMax = Math.max(...ys) * 1.05 || 1;
  const sx = (x) => pad + ((+new Date(x) - xMin) / (xMax - xMin || 1)) * (w - pad * 2);
  const sy = (y) => h - pad - ((y - yMin) / (yMax - yMin || 1)) * (h - pad * 2);

  // tick marks (sparse)
  const yTicks = [yMin, yMin + (yMax - yMin) * 0.5, yMax].map(v => Math.round(v));
  const days = Math.round((xMax - xMin) / (24 * 3600 * 1000));
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:"block"}}>
      {/* y baseline tick labels (no gridlines) */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <text x={4} y={sy(v) + 3} fontSize="10" fill="var(--fg-3)" className="mono">
            {yFormat(v)}
          </text>
        </g>
      ))}
      {/* x range labels */}
      <text x={pad} y={h - 4} fontSize="10" fill="var(--fg-3)" className="mono">−{days}d</text>
      <text x={w - pad} y={h - 4} fontSize="10" fill="var(--fg-3)" className="mono" textAnchor="end">now</text>
      {/* baseline */}
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="var(--line-1)" />
      {/* series */}
      {series.map((s, i) => {
        const path = s.data.map((p, j) => (j ? "L" : "M") + sx(p.x).toFixed(1) + "," + sy(p.y).toFixed(1)).join(" ");
        const areaPath = path + ` L${sx(s.data[s.data.length-1].x).toFixed(1)},${h - pad} L${sx(s.data[0].x).toFixed(1)},${h - pad} Z`;
        const color = s.color || `var(--c-${i+1})`;
        return (
          <g key={s.name}>
            {area && <path d={areaPath} fill={color} opacity="0.08" />}
            <path d={path} stroke={color} strokeWidth="1.2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {showDots && s.data.map((p, j) => (
              <circle key={j} cx={sx(p.x)} cy={sy(p.y)} r="1.5" fill={color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ── BarChart (vertical bars) ───────────────────────────────────
function BarChart({ data, w = 600, h = 140, pad = 24, yFormat = (v) => v, color = "var(--c-1)" }) {
  if (!data || !data.length) return null;
  const ys = data.map(d => d.y);
  const yMax = Math.max(...ys, 1) * 1.05;
  const n = data.length;
  const barW = (w - pad * 2) / n - 2;
  const sx = (i) => pad + i * ((w - pad * 2) / n) + 1;
  const sy = (y) => h - pad - (y / yMax) * (h - pad * 2);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:"block"}}>
      <text x={4} y={11} fontSize="10" fill="var(--fg-3)" className="mono">{yFormat(yMax)}</text>
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="var(--line-1)" />
      {data.map((d, i) => (
        <rect key={i} x={sx(i)} y={sy(d.y)} width={barW} height={h - pad - sy(d.y)}
          fill={color} opacity={d.y === 0 ? 0.15 : 0.75}>
          <title>{`${d.x}: ${yFormat(d.y)}`}</title>
        </rect>
      ))}
    </svg>
  );
}

// ── Stacked BarChart ───────────────────────────────────────────
function StackedBars({ data, keys, colors, w = 600, h = 140, pad = 24, yFormat = (v) => v }) {
  // data: [{ x, [key1]: value, [key2]: value, ... }]
  const totals = data.map(d => keys.reduce((a, k) => a + (d[k] || 0), 0));
  const yMax = Math.max(...totals, 1) * 1.05;
  const n = data.length;
  const barW = (w - pad * 2) / n - 2;
  const sx = (i) => pad + i * ((w - pad * 2) / n) + 1;
  const sy = (y) => h - pad - (y / yMax) * (h - pad * 2);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:"block"}}>
      <text x={4} y={11} fontSize="10" fill="var(--fg-3)" className="mono">{yFormat(yMax)}</text>
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="var(--line-1)" />
      {data.map((d, i) => {
        let acc = 0;
        return keys.map((k, ki) => {
          const v = d[k] || 0;
          const y0 = sy(acc + v);
          const yh = sy(acc) - y0;
          acc += v;
          return <rect key={k} x={sx(i)} y={y0} width={barW} height={yh}
            fill={colors[ki] || `var(--c-${ki+1})`} opacity="0.85">
            <title>{`${d.x} — ${k}: ${yFormat(v)}`}</title>
          </rect>;
        });
      })}
    </svg>
  );
}

// ── Donut chart ────────────────────────────────────────────────
function Donut({ data, size = 140, strokeW = 18, colors }) {
  // data: [{ label, value }]
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = size / 2 - strokeW / 2 - 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <svg width={size} height={size}>
        <circle cx={c} cy={c} r={r} stroke="var(--line-1)" strokeWidth={strokeW} fill="none" />
        {data.map((d, i) => {
          const frac = d.value / total;
          const len = circ * frac;
          const color = (colors && colors[i]) || `var(--c-${i+1})`;
          const el = <circle key={d.label} cx={c} cy={c} r={r}
            stroke={color} strokeWidth={strokeW} fill="none"
            strokeDasharray={`${len} ${circ}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${c} ${c})`} />;
          offset += len;
          return el;
        })}
        <text x={c} y={c - 4} textAnchor="middle" fontSize="11" fill="var(--fg-3)" className="mono">total</text>
        <text x={c} y={c + 13} textAnchor="middle" fontSize="15" fill="var(--fg-0)" className="serif">
          {total >= 1e6 ? (total / 1e6).toFixed(1) + "M" : (total >= 1e3 ? (total / 1e3).toFixed(1) + "K" : total)}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
        {data.map((d, i) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: (colors && colors[i]) || `var(--c-${i+1})`, flexShrink: 0 }} />
            <span style={{ color: "var(--fg-1)" }}>{d.label}</span>
            <span className="mono muted-2">{((d.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Heatmap (rows × cols) ─────────────────────────────────────
function Heatmap({ data, rowLabels = [], colLabels = [], colorVar = "--accent", w = 560 }) {
  const rows = data.length, cols = data[0]?.length || 0;
  const max = Math.max(1, ...data.flat());
  const cellW = (w - 28) / cols;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `28px 1fr`, fontSize: 11, fontFamily: "var(--font-mono)" }}>
      <div></div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, color: "var(--fg-3)", paddingBottom: 4 }}>
        {colLabels.map((c, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9.5 }}>{i % 3 === 0 ? c : ""}</div>
        ))}
      </div>
      {data.map((row, ri) => (
        <Fragment key={ri}>
          <div style={{ color: "var(--fg-3)", paddingRight: 6, display: "flex", alignItems: "center", height: 18 }}>
            {rowLabels[ri]}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 1.5 }}>
            {row.map((v, ci) => {
              const t = v / max;
              return <div key={ci} style={{
                height: 18, borderRadius: 2,
                background: v === 0 ? "var(--bg-2)" : `color-mix(in oklch, var(${colorVar}) ${15 + t * 75}%, transparent)`,
              }} title={`${rowLabels[ri]} ${colLabels[ci]}: ${v}`} />;
            })}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

// ── Swimlane (multi-subcheck status segments over time) ───────
function Swimlane({ lanes, w = 720, laneH = 24, gap = 6 }) {
  // lanes: [{ name, segments: [{ start, end, status }] }]
  const allStarts = lanes.flatMap(l => l.segments.map(s => +new Date(s.start)));
  const allEnds   = lanes.flatMap(l => l.segments.map(s => +new Date(s.end)));
  const tMin = Math.min(...allStarts), tMax = Math.max(...allEnds);
  const labelW = 96;
  const innerW = w - labelW;
  const sx = (t) => labelW + ((+new Date(t) - tMin) / (tMax - tMin || 1)) * innerW;
  const h = lanes.length * (laneH + gap);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h + 18}`} style={{display:"block"}}>
      {lanes.map((l, i) => {
        const y = i * (laneH + gap);
        return (
          <g key={l.name}>
            <text x={0} y={y + laneH / 2 + 4} fontSize="11" fill="var(--fg-2)" className="mono">{l.name}</text>
            <rect x={labelW} y={y} width={innerW} height={laneH} fill="var(--bg-2)" rx="3" />
            {l.segments.map((s, j) => {
              const x0 = sx(s.start), x1 = sx(s.end);
              return <rect key={j} x={x0} y={y} width={Math.max(1, x1 - x0)} height={laneH}
                rx="2" fill={`var(--${s.status})`} opacity={s.status === "ok" ? 0.55 : 0.92}>
                <title>{`${l.name}: ${s.status} — ${new Date(s.start).toISOString().slice(11,16)} → ${new Date(s.end).toISOString().slice(11,16)}`}</title>
              </rect>;
            })}
          </g>
        );
      })}
      {/* x-axis */}
      <text x={labelW} y={h + 12} fontSize="10" fill="var(--fg-3)" className="mono">
        {new Date(tMin).toISOString().slice(11, 16)} UTC
      </text>
      <text x={w} y={h + 12} fontSize="10" fill="var(--fg-3)" className="mono" textAnchor="end">
        {new Date(tMax).toISOString().slice(11, 16)} UTC
      </text>
    </svg>
  );
}

// ── Diff viewer (line-level diff for incident text) ───────────
function DiffView({ before, after }) {
  // ultra-simple: split lines, mark line-by-line difference
  const a = (before || "").split("\n");
  const b = (after || "").split("\n");
  const maxLen = Math.max(a.length, b.length);
  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    const av = a[i] ?? "";
    const bv = b[i] ?? "";
    if (av === bv) rows.push({ kind: " ", text: bv });
    else {
      if (av) rows.push({ kind: "-", text: av });
      if (bv) rows.push({ kind: "+", text: bv });
    }
  }
  return (
    <div className="diff">
      {rows.map((r, i) => (
        <div key={i} className={"diff-row diff-" + (r.kind === "+" ? "add" : r.kind === "-" ? "del" : "same")}>
          <span className="diff-marker mono">{r.kind}</span>
          <span className="diff-text">{r.text || "\u00A0"}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { LineChart, BarChart, StackedBars, Donut, Heatmap, Swimlane, DiffView });
