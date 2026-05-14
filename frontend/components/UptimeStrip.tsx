/**
 * UptimeStrip — 30 vertical bars showing daily uptime status over the past 30 days.
 * Color mapping uses existing CSS status tokens (--ok, --degraded, --down, --unknown).
 * Each bar is 7px wide × 28px tall with a 2px gap. Total strip ~278px wide.
 */

const BAR_W = 7;
const BAR_H = 28;
const GAP = 2;

const STATUS_LABELS: Record<string, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
  unknown: "No data",
};

const STATUS_OPACITY: Record<string, number> = {
  ok: 0.75,
  degraded: 0.95,
  down: 0.95,
  unknown: 0.4,
};

export interface UptimeDayEntry {
  date: string;
  status: "ok" | "degraded" | "down" | "unknown";
}

interface Props {
  days: UptimeDayEntry[];
  onBarClick?: (date: string) => void;
}

export default function UptimeStrip({ days, onBarClick }: Props) {
  if (!days.length) return null;
  const n = days.length;
  const totalW = n * BAR_W + (n - 1) * GAP;
  return (
    <svg
      width={totalW}
      height={BAR_H}
      style={{ display: "block", flexShrink: 0 }}
      aria-label="30-day uptime history"
    >
      {days.map((d, i) => (
        <rect
          key={d.date}
          x={i * (BAR_W + GAP)}
          y={0}
          width={BAR_W}
          height={BAR_H}
          rx={1}
          fill={`var(--${d.status})`}
          opacity={STATUS_OPACITY[d.status] ?? 0.9}
          style={{ cursor: onBarClick ? "pointer" : "default" }}
          onClick={onBarClick ? () => onBarClick(d.date) : undefined}
        >
          <title>{`${d.date} — ${STATUS_LABELS[d.status] ?? d.status}`}</title>
        </rect>
      ))}
    </svg>
  );
}
