import type { SwimlaneData } from "@/lib/types";

interface Props {
  lanes: SwimlaneData[];
  w?: number;
  laneH?: number;
  gap?: number;
}

export default function Swimlane({
  lanes,
  w = 720,
  laneH = 24,
  gap = 6,
}: Props) {
  if (!lanes.length) return null;

  const allStarts = lanes.flatMap((l) =>
    l.segments.map((s) => +new Date(s.start))
  );
  const allEnds = lanes.flatMap((l) =>
    l.segments.map((s) => +new Date(s.end))
  );
  const tMin = Math.min(...allStarts);
  const tMax = Math.max(...allEnds);
  const labelW = 96;
  const innerW = w - labelW;
  const sx = (t: string) =>
    labelW + ((+new Date(t) - tMin) / (tMax - tMin || 1)) * innerW;
  const h = lanes.length * (laneH + gap);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h + 18}`}
      style={{ display: "block" }}
    >
      {lanes.map((l, i) => {
        const y = i * (laneH + gap);
        return (
          <g key={l.name}>
            <text
              x={0}
              y={y + laneH / 2 + 4}
              fontSize="11"
              fill="var(--fg-2)"
              className="mono"
            >
              {l.name}
            </text>
            <rect
              x={labelW}
              y={y}
              width={innerW}
              height={laneH}
              fill="var(--bg-2)"
              rx="3"
            />
            {l.segments.map((s, j) => {
              const x0 = sx(s.start);
              const x1 = sx(s.end);
              return (
                <rect
                  key={j}
                  x={x0}
                  y={y}
                  width={Math.max(1, x1 - x0)}
                  height={laneH}
                  rx="2"
                  fill={`var(--${s.status})`}
                  opacity={s.status === "ok" ? 0.55 : 0.92}
                >
                  <title>{`${l.name}: ${s.status} — ${new Date(s.start).toISOString().slice(11, 16)} → ${new Date(s.end).toISOString().slice(11, 16)}`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
      <text
        x={labelW}
        y={h + 12}
        fontSize="10"
        fill="var(--fg-3)"
        className="mono"
      >
        {new Date(tMin).toISOString().slice(11, 16)} UTC
      </text>
      <text
        x={w}
        y={h + 12}
        fontSize="10"
        fill="var(--fg-3)"
        className="mono"
        textAnchor="end"
      >
        {new Date(tMax).toISOString().slice(11, 16)} UTC
      </text>
    </svg>
  );
}
