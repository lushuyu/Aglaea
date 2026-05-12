import { fmtNum } from "@/lib/fmt";

interface DataPoint {
  x: string;
  y: number;
}

interface Props {
  data: DataPoint[];
  w?: number;
  h?: number;
  pad?: number;
  yFormat?: (v: number) => string;
  color?: string;
}

export default function BarChart({
  data,
  w = 600,
  h = 140,
  pad = 24,
  yFormat = fmtNum,
  color = "var(--c-1)",
}: Props) {
  if (!data.length) return null;
  const ys = data.map((d) => d.y);
  const yMax = Math.max(...ys, 1) * 1.05;
  const n = data.length;
  const barW = (w - pad * 2) / n - 2;
  const sx = (i: number) => pad + i * ((w - pad * 2) / n) + 1;
  const sy = (y: number) =>
    h - pad - (y / yMax) * (h - pad * 2);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <text x={4} y={11} fontSize="10" fill="var(--fg-3)" className="mono">
        {yFormat(yMax)}
      </text>
      <line
        x1={pad}
        x2={w - pad}
        y1={h - pad}
        y2={h - pad}
        stroke="var(--line-1)"
      />
      {data.map((d, i) => (
        <rect
          key={i}
          x={sx(i)}
          y={sy(d.y)}
          width={barW}
          height={h - pad - sy(d.y)}
          fill={color}
          opacity={d.y === 0 ? 0.15 : 0.75}
        >
          <title>{`${d.x}: ${yFormat(d.y)}`}</title>
        </rect>
      ))}
    </svg>
  );
}
