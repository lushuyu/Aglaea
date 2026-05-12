const STATUS_LABELS: Record<string, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
};

interface Props {
  days: number[];
  w?: number;
  cellH?: number;
}

export default function UptimeCalendar({ days, w = 360, cellH = 28 }: Props) {
  const n = days.length;
  return (
    <div
      className="uptime-cal"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${n}, 1fr)`,
        gap: 2,
        width: w,
        maxWidth: "100%",
      }}
    >
      {days.map((v, i) => {
        const status = v >= 1 ? "ok" : v > 0 ? "degraded" : "down";
        return (
          <div
            key={i}
            className="cal-cell"
            style={{
              height: cellH,
              borderRadius: 2,
              background: `var(--${status})`,
              opacity: status === "ok" ? 0.5 : 0.95,
              animationDelay: `${i * 8}ms`,
            }}
            title={`Day ${i - n + 1}: ${STATUS_LABELS[status] ?? status}`}
          />
        );
      })}
    </div>
  );
}
