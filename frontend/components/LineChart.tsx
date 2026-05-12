import { fmtNum } from "@/lib/fmt";

interface DataPoint {
  x: string | number | Date;
  y: number;
}

interface Series {
  name: string;
  color?: string;
  data: DataPoint[];
}

interface Props {
  series: Series[];
  w?: number;
  h?: number;
  pad?: number;
  yFormat?: (v: number) => string;
  showDots?: boolean;
  area?: boolean;
}

export default function LineChart({
  series,
  w = 600,
  h = 180,
  pad = 24,
  yFormat = fmtNum,
  showDots = false,
  area = false,
}: Props) {
  if (!series.length) return null;
  const all = series.flatMap((s) => s.data);
  const xs = all.map((p) => +new Date(p.x));
  const ys = all.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(...ys) * 1.05 || 1;

  const sx = (x: string | number | Date) =>
    pad + ((+new Date(x) - xMin) / (xMax - xMin || 1)) * (w - pad * 2);
  const sy = (y: number) =>
    h - pad - ((y - yMin) / (yMax - yMin || 1)) * (h - pad * 2);

  const yTicks = [yMin, yMin + (yMax - yMin) * 0.5, yMax].map((v) =>
    Math.round(v)
  );
  const days = Math.round((xMax - xMin) / (24 * 3600 * 1000));

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      {yTicks.map((v, i) => (
        <text
          key={i}
          x={4}
          y={sy(v) + 3}
          fontSize="10"
          fill="var(--fg-3)"
          className="mono"
        >
          {yFormat(v)}
        </text>
      ))}
      <text x={pad} y={h - 4} fontSize="10" fill="var(--fg-3)" className="mono">
        −{days}d
      </text>
      <text
        x={w - pad}
        y={h - 4}
        fontSize="10"
        fill="var(--fg-3)"
        className="mono"
        textAnchor="end"
      >
        now
      </text>
      <line
        x1={pad}
        x2={w - pad}
        y1={h - pad}
        y2={h - pad}
        stroke="var(--line-1)"
      />
      {series.map((s, i) => {
        const path = s.data
          .map(
            (p, j) =>
              (j ? "L" : "M") +
              sx(p.x).toFixed(1) +
              "," +
              sy(p.y).toFixed(1)
          )
          .join(" ");
        const last = s.data[s.data.length - 1];
        const first = s.data[0];
        const areaPath =
          last && first
            ? path +
              ` L${sx(last.x).toFixed(1)},${h - pad} L${sx(first.x).toFixed(1)},${h - pad} Z`
            : path;
        const color = s.color ?? `var(--c-${i + 1})`;
        return (
          <g key={s.name}>
            {area && (
              <path d={areaPath} fill={color} opacity="0.08" />
            )}
            <path
              d={path}
              stroke={color}
              strokeWidth="1.2"
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {showDots &&
              s.data.map((p, j) => (
                <circle
                  key={j}
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r="1.5"
                  fill={color}
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
}
