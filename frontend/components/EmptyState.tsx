import type { ReactNode } from "react";

interface Props {
  icon?: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}

export default function EmptyState({
  icon = "⌘",
  title,
  sub,
  action,
}: Props) {
  return (
    <div className="empty-state">
      <div className="empty-icon serif">{icon}</div>
      <div className="serif" style={{ fontSize: 20 }}>
        {title}
      </div>
      {sub && (
        <div
          className="muted"
          style={{ marginTop: 8, maxWidth: 360, textAlign: "center" }}
        >
          {sub}
        </div>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
