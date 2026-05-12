import type { HeartbeatPoint } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

interface Props {
  /** Alias for data — accepts the Service.heartbeats field directly */
  points?: HeartbeatPoint[];
  data?: HeartbeatPoint[];
  w?: number;
  h?: number;
  gap?: number;
}

export default function HeartbeatStrip({
  points,
  data,
  w = 360,
  h = 28,
  gap = 1,
}: Props) {
  const items = points ?? data ?? [];
  const n = items.length;
  if (n === 0) return null;
  const segW = (w - gap * (n - 1)) / n;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {items.map((p, i) => (
        <rect
          key={i}
          x={i * (segW + gap)}
          y={0}
          width={segW}
          height={h}
          rx={1}
          fill={`var(--${p.status})`}
          opacity={p.status === "ok" ? 0.65 : 0.95}
        >
          <title>
            {`${p.t.slice(11, 16)} UTC — ${STATUS_LABELS[p.status] ?? p.status}`}
          </title>
        </rect>
      ))}
    </svg>
  );
}
