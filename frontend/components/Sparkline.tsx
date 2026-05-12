interface Props {
  data: number[];
  w?: number;
  h?: number;
  mode?: "uptime" | "value";
}

export default function Sparkline({ data, w = 120, h = 24, mode = "uptime" }: Props) {
  if (!data.length) return null;
  const n = data.length;
  const xStep = w / (n - 1 || 1);
  const max = mode === "uptime" ? 1 : Math.max(...data);
  const points = data.map((v, i) => [
    i * xStep,
    h - (v / (max || 1)) * (h - 2) - 1,
  ] as [number, number]);
  const path =
    "M" +
    points
      .map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1))
      .join(" L");

  return (
    <svg
      width={w}
      height={h}
      style={{ display: "block" }}
      aria-label="30 day uptime"
    >
      <path
        d={path}
        stroke="var(--fg-3)"
        strokeWidth="1"
        fill="none"
        strokeLinejoin="round"
      />
      {data.map((v, i) => {
        if (v >= 1) return null;
        const color = v === 0 ? "var(--down)" : "var(--degraded)";
        return (
          <rect
            key={i}
            x={i * xStep - 0.6}
            y={h - 4}
            width="1.2"
            height="3"
            fill={color}
          />
        );
      })}
    </svg>
  );
}
