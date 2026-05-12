interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export default function StatTile({ label, value, sub, accent }: Props) {
  return (
    <div className="card" style={{ padding: 16, minWidth: 0 }}>
      <div
        className="text-xs mono"
        style={{
          color: "var(--fg-3)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
        }}
      >
        {label}
      </div>
      <div
        className="serif"
        style={{
          fontSize: 32,
          color: accent ? "var(--accent)" : "var(--fg-0)",
          marginTop: 8,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-xs muted" style={{ marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
