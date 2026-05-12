interface DataItem {
  label: string;
  value: number;
}

interface Props {
  data: DataItem[];
  size?: number;
  strokeW?: number;
  colors?: string[];
}

export default function Donut({
  data,
  size = 140,
  strokeW = 18,
  colors,
}: Props) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = size / 2 - strokeW / 2 - 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const totalLabel =
    total >= 1e6
      ? (total / 1e6).toFixed(1) + "M"
      : total >= 1e3
      ? (total / 1e3).toFixed(1) + "K"
      : String(total);

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <svg width={size} height={size}>
        <circle
          cx={c}
          cy={c}
          r={r}
          stroke="var(--line-1)"
          strokeWidth={strokeW}
          fill="none"
        />
        {data.map((d, i) => {
          const frac = d.value / total;
          const len = circ * frac;
          const color = (colors && colors[i]) ?? `var(--c-${i + 1})`;
          const el = (
            <circle
              key={d.label}
              cx={c}
              cy={c}
              r={r}
              stroke={color}
              strokeWidth={strokeW}
              fill="none"
              strokeDasharray={`${len} ${circ}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}
            />
          );
          offset += len;
          return el;
        })}
        <text
          x={c}
          y={c - 4}
          textAnchor="middle"
          fontSize="11"
          fill="var(--fg-3)"
          className="mono"
        >
          total
        </text>
        <text
          x={c}
          y={c + 13}
          textAnchor="middle"
          fontSize="15"
          fill="var(--fg-0)"
          className="serif"
        >
          {totalLabel}
        </text>
      </svg>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontSize: 12,
        }}
      >
        {data.map((d, i) => (
          <div
            key={d.label}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background:
                  (colors && colors[i]) ?? `var(--c-${i + 1})`,
                flexShrink: 0,
              }}
            />
            <span style={{ color: "var(--fg-1)" }}>{d.label}</span>
            <span className="mono muted-2">
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
