import type { ServiceStatus } from "@/lib/types";
import type { LifecycleState } from "@/types/api";
import StatusGlyph from "./StatusGlyph";

const STATUS_LABELS: Record<ServiceStatus, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

// Token-aligned colors for lifecycle state pills
const LIFECYCLE_STYLES: Record<
  LifecycleState,
  { background: string; color: string; border: string }
> = {
  investigating: {
    background: "var(--down-soft)",
    color: "var(--down)",
    border: "1px solid var(--down-line)",
  },
  identified: {
    background: "color-mix(in oklch, var(--warn, #f59e0b) 14%, transparent)",
    color: "var(--warn, #d97706)",
    border: "1px solid color-mix(in oklch, var(--warn, #f59e0b) 30%, transparent)",
  },
  monitoring: {
    background: "color-mix(in oklch, var(--info, #3b82f6) 12%, transparent)",
    color: "var(--info, #2563eb)",
    border: "1px solid color-mix(in oklch, var(--info, #3b82f6) 28%, transparent)",
  },
  resolved: {
    background: "var(--ok-soft)",
    color: "var(--ok)",
    border: "1px solid var(--ok-line)",
  },
};

interface ServiceStatusProps {
  status: ServiceStatus;
  lifecycle?: never;
  label?: string;
  size?: "md" | "sm";
}

interface LifecycleProps {
  status?: never;
  lifecycle: LifecycleState;
  label?: string;
  size?: "md" | "sm";
}

type Props = ServiceStatusProps | LifecycleProps;

export default function StatusBadge({ status, lifecycle, label, size = "md" }: Props) {
  // Lifecycle state pill variant
  if (lifecycle !== undefined) {
    const text = label ?? LIFECYCLE_LABELS[lifecycle] ?? lifecycle;
    const styles = LIFECYCLE_STYLES[lifecycle];
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontFamily: "var(--font-mono)",
          fontSize: size === "sm" ? 11 : 12,
          padding: size === "sm" ? "2px 8px" : "3px 10px",
          borderRadius: 999,
          whiteSpace: "nowrap",
          ...styles,
        }}
      >
        {text}
      </span>
    );
  }

  // Original service status pill
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
