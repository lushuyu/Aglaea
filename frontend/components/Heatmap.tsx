interface Props {
  data: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  colorVar?: string;
  w?: number;
}

export default function Heatmap({
  data,
  rowLabels = [],
  colLabels = [],
  colorVar = "--accent",
  w = 560,
}: Props) {
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  const max = Math.max(1, ...data.flat());

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr",
        fontSize: 11,
        fontFamily: "var(--font-mono)",
      }}
    >
      <div />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          color: "var(--fg-3)",
          paddingBottom: 4,
        }}
      >
        {colLabels.map((c, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 9.5 }}>
            {i % 3 === 0 ? c : ""}
          </div>
        ))}
      </div>
      {data.map((row, ri) => (
        <>
          <div
            key={`label-${ri}`}
            style={{
              color: "var(--fg-3)",
              paddingRight: 6,
              display: "flex",
              alignItems: "center",
              height: 18,
            }}
          >
            {rowLabels[ri]}
          </div>
          <div
            key={`row-${ri}`}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 1.5,
            }}
          >
            {row.map((v, ci) => {
              const t = v / max;
              return (
                <div
                  key={ci}
                  style={{
                    height: 18,
                    borderRadius: 2,
                    background:
                      v === 0
                        ? "var(--bg-2)"
                        : `color-mix(in oklch, var(${colorVar}) ${15 + t * 75}%, transparent)`,
                  }}
                  title={`${rowLabels[ri] ?? ri} ${colLabels[ci] ?? ci}: ${v}`}
                />
              );
            })}
          </div>
        </>
      ))}
    </div>
  );
}
