import { fmtNum } from "@/lib/fmt";

interface DataPoint {
  x: string;
  [key: string]: number | string;
}

interface Props {
  data: DataPoint[];
  keys: string[];
  colors?: string[];
  w?: number;
  h?: number;
  pad?: number;
  yFormat?: (v: number) => string;
}

export default function StackedBars({
  data,
  keys,
  colors,
  w = 600,
  h = 140,
  pad = 24,
  yFormat = fmtNum,
}: Props) {
  if (!data.length) return null;
  const totals = data.map((d) =>
    keys.reduce((a, k) => a + (Number(d[k]) || 0), 0)
  );
  const yMax = Math.max(...totals, 1) * 1.05;
  const n = data.length;
  const barW = (w - pad * 2) / n - 2;
  const sx = (i: number) => pad + i * ((w - pad * 2) / n) + 1;
  const sy = (y: number) => h - pad - (y / yMax) * (h - pad * 2);

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
      {data.map((d, i) => {
        let acc = 0;
        return keys.map((k, ki) => {
          const v = Number(d[k]) || 0;
          const y0 = sy(acc + v);
          const yh = sy(acc) - y0;
          acc += v;
          return (
            <rect
              key={k}
              x={sx(i)}
              y={y0}
              width={barW}
              height={yh}
              fill={(colors && colors[ki]) ?? `var(--c-${ki + 1})`}
              opacity="0.85"
            >
              <title>{`${d["x"]} — ${k}: ${yFormat(v)}`}</title>
            </rect>
          );
        });
      })}
    </svg>
  );
}
