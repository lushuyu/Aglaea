import type { ServiceStatus } from "@/lib/types";
import StatusGlyph from "./StatusGlyph";

const STATUS_LABELS: Record<ServiceStatus, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

interface Props {
  status: ServiceStatus;
  label?: string;
  size?: "md" | "sm";
}

export default function StatusBadge({ status, label, size = "md" }: Props) {
  const text = label ?? STATUS_LABELS[status] ?? status;
  return (
    <span
      className={
        "status-badge st-" + status + (size === "sm" ? " sm" : "")
      }
    >
      <StatusGlyph status={status} size={size === "sm" ? 10 : 12} />
      <span>{text}</span>
    </span>
  );
}
