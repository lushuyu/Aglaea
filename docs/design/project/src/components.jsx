/* Aglaea — shared atomic components, glyphs, status pieces, sparkline */
/* eslint-disable */

const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;

// ── time helpers ───────────────────────────────────────────────
const fmtTime = (iso, now) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const ms = (now || new Date()) - d;
  const s = Math.floor(ms / 1000);
  if (s < 5)   return "just now";
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `${dd}d ago`;
  return d.toISOString().slice(0, 10);
};

const fmtDuration = (startIso, endIso) => {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date();
  let s = Math.max(0, Math.floor((end - start) / 1000));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const fmtClock = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "short", timeZone: "UTC" }) + " UTC";
};

const fmtNum = (n) => {
  if (n == null) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
};

// ── Status atoms ───────────────────────────────────────────────
// Color + SHAPE pairing for color-blind safety:
//   ok       → ● filled disc (sage)
//   degraded → ◐ half disc (orange)
//   down     → ▲ triangle (red)
//   unknown  → ○ ring (gray)
const STATUS_LABELS = { ok: "Operational", degraded: "Degraded", down: "Down", unknown: "Unknown" };
const STATUS_SHORT  = { ok: "OK", degraded: "DEG", down: "DOWN", unknown: "—" };

function StatusGlyph({ status, size = 12 }) {
  const s = size;
  const c = `var(--${status})`;
  const stroke = `var(--${status}-line, var(--${status}))`;
  if (status === "ok") {
    return <svg width={s} height={s} viewBox="0 0 12 12" style={{flexShrink:0}}>
      <circle cx="6" cy="6" r="4.5" fill={c} />
    </svg>;
  }
  if (status === "degraded") {
    return <svg width={s} height={s} viewBox="0 0 12 12" style={{flexShrink:0}}>
      <circle cx="6" cy="6" r="4.5" fill="none" stroke={c} strokeWidth="1.5"/>
      <path d="M6 1.5 A4.5 4.5 0 0 1 6 10.5 Z" fill={c}/>
    </svg>;
  }
  if (status === "down") {
    return <svg width={s} height={s} viewBox="0 0 12 12" style={{flexShrink:0}}>
      <path d="M6 1.2 L11 10.5 L1 10.5 Z" fill={c} />
    </svg>;
  }
  return <svg width={s} height={s} viewBox="0 0 12 12" style={{flexShrink:0}}>
    <circle cx="6" cy="6" r="4.5" fill="none" stroke={stroke} strokeWidth="1.5"/>
  </svg>;
}

function StatusBadge({ status, label, size = "md" }) {
  const text = label ?? STATUS_LABELS[status] ?? status;
  return (
    <span className={"status-badge st-" + status + (size === "sm" ? " sm" : "")}>
      <StatusGlyph status={status} size={size === "sm" ? 10 : 12} />
      <span>{text}</span>
    </span>
  );
}

function StatusBanner({ status, title, sub }) {
  return (
    <div className={"status-banner st-" + status}>
      <div className="banner-glyph"><StatusGlyph status={status} size={18} /></div>
      <div className="grow">
        <div className="serif" style={{ fontSize: 22, color: "var(--fg-0)" }}>{title}</div>
        {sub && <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Service glyphs (line-art, classical motifs) ───────────────
function ServiceGlyph({ kind, size = 22 }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (kind) {
    case "graces": // three stars in a triangle — Three Graces
      return <svg {...props}>
        <path d="M12 3.5 L13 6 L15.5 6 L13.5 7.6 L14.3 10 L12 8.6 L9.7 10 L10.5 7.6 L8.5 6 L11 6 Z" />
        <path d="M5.5 14.5 L6.3 16.4 L8.3 16.4 L6.8 17.6 L7.3 19.5 L5.5 18.4 L3.7 19.5 L4.2 17.6 L2.7 16.4 L4.7 16.4 Z" />
        <path d="M18.5 14.5 L19.3 16.4 L21.3 16.4 L19.8 17.6 L20.3 19.5 L18.5 18.4 L16.7 19.5 L17.2 17.6 L15.7 16.4 L17.7 16.4 Z" />
      </svg>;
    case "hyacinth": // bell-flower spike
      return <svg {...props}>
        <path d="M12 21 V11" />
        <path d="M12 11 C10.5 11 9 9.5 9 8 C9 6.5 10.5 5 12 5 C13.5 5 15 6.5 15 8 C15 9.5 13.5 11 12 11 Z" />
        <path d="M9 8 C8 9 7.5 10 8 11" />
        <path d="M15 8 C16 9 16.5 10 16 11" />
        <path d="M10 13 H14 M10.5 16 H13.5 M11 19 H13" />
      </svg>;
    case "hydra": // three serpent heads
      return <svg {...props}>
        <path d="M5 19 C5 14 7 12 9 12 C7 11 6 9 8 7" />
        <circle cx="7" cy="6" r="0.6" fill="currentColor" />
        <path d="M12 19 C12 13 12 11 12 9 C12 7 13 6 14 6" />
        <circle cx="14" cy="5.5" r="0.6" fill="currentColor" />
        <path d="M19 19 C19 14 17 12 15 12 C17 11 18 9 16 7" />
        <circle cx="17" cy="6" r="0.6" fill="currentColor" />
        <path d="M4 20 H20" />
      </svg>;
    case "key": // ornate key
      return <svg {...props}>
        <circle cx="8" cy="12" r="3.5" />
        <path d="M11.5 12 H20" />
        <path d="M16 12 V15" />
        <path d="M18.5 12 V14.5" />
      </svg>;
    case "winged": // winged sandal / caduceus simplified
      return <svg {...props}>
        <path d="M12 4 V20" />
        <path d="M9 8 C10 6 11 5 12 5 C13 5 14 6 15 8" />
        <path d="M8 12 C9 10 10.5 9 12 9 C13.5 9 15 10 16 12" />
        <path d="M5 12 C7 10 10 12 12 10 C14 12 17 10 19 12" />
      </svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="6" /></svg>;
  }
}

// ── Aglaea brand mark — three stars + monogram ────────────────
function Brandmark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{display:"block"}}>
      <defs>
        <linearGradient id="aglGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--gold-200)" />
          <stop offset="100%" stopColor="var(--gold-500)" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="none" stroke="var(--accent-line)" strokeWidth="0.6"/>
      <g fill="url(#aglGrad)">
        <circle cx="12" cy="6" r="1.3" />
        <circle cx="6.5" cy="15.5" r="1.1" />
        <circle cx="17.5" cy="15.5" r="1.1" />
      </g>
      <g stroke="var(--accent-line)" strokeWidth="0.5">
        <line x1="12" y1="6" x2="6.5" y2="15.5" />
        <line x1="12" y1="6" x2="17.5" y2="15.5" />
        <line x1="6.5" y1="15.5" x2="17.5" y2="15.5" />
      </g>
    </svg>
  );
}

// ── Star-field background (public side) ───────────────────────
function StarField() {
  const stars = useMemo(() => {
    const r = (() => { let s = 7; return () => { s = (s*9301+49297)%233280; return s/233280; }; })();
    return Array.from({ length: 90 }, () => ({
      x: r() * 100, y: r() * 100, s: r() * 1.4 + 0.3, o: r() * 0.5 + 0.15, d: r() * 4 + 2,
    }));
  }, []);
  return (
    <div className="starfield" aria-hidden="true">
      <svg width="100%" height="100%" preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}>
        {stars.map((s, i) => (
          <circle key={i} cx={s.x + "%"} cy={s.y + "%"} r={s.s} fill="var(--gold-200)"
            opacity={s.o}>
            <animate attributeName="opacity"
              values={`${s.o};${s.o * 0.3};${s.o}`} dur={s.d + "s"} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
    </div>
  );
}

// ── Sparkline (uptime — Tufte hairline) ───────────────────────
function Sparkline({ data, w = 120, h = 24, mode = "uptime" }) {
  if (!data || !data.length) return null;
  const n = data.length;
  const xStep = w / (n - 1 || 1);
  const max = mode === "uptime" ? 1 : Math.max(...data);
  const points = data.map((v, i) => [i * xStep, h - (v / max) * (h - 2) - 1]);
  const path = "M" + points.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" L");
  // Mark down/degraded days as small ticks
  const marks = data.map((v, i) => {
    if (v >= 1) return null;
    const color = v === 0 ? "var(--down)" : "var(--degraded)";
    return <rect key={i} x={i * xStep - 0.6} y={h - 4} width="1.2" height="3" fill={color} />;
  });
  return (
    <svg width={w} height={h} style={{display:"block"}} aria-label="30 day uptime">
      <path d={path} stroke="var(--fg-3)" strokeWidth="1" fill="none" strokeLinejoin="round" />
      {marks}
    </svg>
  );
}

// ── Subcheck strip (compact representation of nested checks) ──
function SubcheckStrip({ subchecks }) {
  const keys = Object.keys(subchecks || {});
  if (!keys.length) return <span className="muted text-xs">— no subchecks</span>;
  return (
    <div className="subcheck-strip">
      {keys.map(k => {
        const s = subchecks[k];
        return (
          <div key={k} className="subcheck-pip" title={`${k}: ${STATUS_LABELS[s.status]}${s.message ? " — " + s.message : ""}`}>
            <StatusGlyph status={s.status} size={9} />
            <span className="mono text-xs muted">{k}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Heartbeat strip (Vercel-style segments) ───────────────────
function HeartbeatStrip({ data, w = 360, h = 28, gap = 1 }) {
  const n = data.length;
  const segW = (w - gap * (n - 1)) / n;
  return (
    <svg width={w} height={h} style={{display:"block"}}>
      {data.map((p, i) => (
        <rect key={i} x={i * (segW + gap)} y={0} width={segW} height={h} rx={1}
          fill={`var(--${p.status})`} opacity={p.status === "ok" ? 0.65 : 0.95}>
          <title>{`${p.t.slice(11,16)} UTC — ${STATUS_LABELS[p.status]}`}</title>
        </rect>
      ))}
    </svg>
  );
}

// ── Uptime calendar (one cell per day) ────────────────────────
function UptimeCalendar({ days, w = 360, cellH = 28 }) {
  const n = days.length;
  return (
    <div className="uptime-cal" style={{ display:"grid", gridTemplateColumns:`repeat(${n}, 1fr)`, gap: 2, width: w, maxWidth: "100%" }}>
      {days.map((v, i) => {
        const status = v >= 1 ? "ok" : v > 0 ? "degraded" : "down";
        return (
          <div key={i} className="cal-cell" style={{
            height: cellH, borderRadius: 2, background: `var(--${status})`,
            opacity: status === "ok" ? 0.5 : 0.95,
            animationDelay: (i * 8) + "ms",
          }} title={`Day ${i - n + 1}: ${STATUS_LABELS[status]}`} />
        );
      })}
    </div>
  );
}

// ── Stat tile ──────────────────────────────────────────────────
function StatTile({ label, value, sub, accent }) {
  return (
    <div className="card" style={{ padding: 16, minWidth: 0 }}>
      <div className="text-xs mono" style={{ color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
      <div className="serif" style={{ fontSize: 32, color: accent ? "var(--accent)" : "var(--fg-0)", marginTop: 8, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div className="text-xs muted" style={{ marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ── Modal scaffold ────────────────────────────────────────────
function Modal({ open, onClose, title, children, footer, width = 520 }) {
  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ width }} onClick={e => e.stopPropagation()}>
        {title && <div className="modal-hd"><h3 className="serif" style={{fontSize:20}}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-ft">{footer}</div>}
      </div>
    </div>
  );
}

// ── Empty / Skeleton blocks ───────────────────────────────────
function Skeleton({ w, h = 14 }) {
  return <div className="skeleton" style={{ width: w, height: h }} />;
}
function EmptyState({ icon = "⌘", title, sub, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon serif">{icon}</div>
      <div className="serif" style={{ fontSize: 20 }}>{title}</div>
      {sub && <div className="muted" style={{ marginTop: 8, maxWidth: 360, textAlign: "center" }}>{sub}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// expose
Object.assign(window, {
  fmtTime, fmtDuration, fmtClock, fmtNum,
  STATUS_LABELS, STATUS_SHORT,
  StatusGlyph, StatusBadge, StatusBanner,
  ServiceGlyph, Brandmark, StarField,
  Sparkline, SubcheckStrip, HeartbeatStrip, UptimeCalendar,
  StatTile, Modal, Skeleton, EmptyState,
});
