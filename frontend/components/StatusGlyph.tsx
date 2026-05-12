import type { ServiceStatus } from "@/lib/types";

interface Props {
  status: ServiceStatus;
  size?: number;
}

/**
 * Shape + color pairing for color-blind safety:
 *   ok       → ● filled disc (sage)
 *   degraded → ◐ half disc (orange)
 *   down     → ▲ triangle (red)
 *   unknown  → ○ ring (gray)
 */
export default function StatusGlyph({ status, size = 12 }: Props) {
  const s = size;
  const c = `var(--${status})`;
  const stroke = `var(--${status}-line, var(--${status}))`;

  if (status === "ok") {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 12 12"
        style={{ flexShrink: 0 }}
        aria-label="Operational"
      >
        <circle cx="6" cy="6" r="4.5" fill={c} />
      </svg>
    );
  }
  if (status === "degraded") {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 12 12"
        style={{ flexShrink: 0 }}
        aria-label="Degraded"
      >
        <circle cx="6" cy="6" r="4.5" fill="none" stroke={c} strokeWidth="1.5" />
        <path d="M6 1.5 A4.5 4.5 0 0 1 6 10.5 Z" fill={c} />
      </svg>
    );
  }
  if (status === "down") {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 12 12"
        style={{ flexShrink: 0 }}
        aria-label="Down"
      >
        <path d="M6 1.2 L11 10.5 L1 10.5 Z" fill={c} />
      </svg>
    );
  }
  // unknown
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 12 12"
      style={{ flexShrink: 0 }}
      aria-label="Unknown"
    >
      <circle
        cx="6"
        cy="6"
        r="4.5"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
    </svg>
  );
}
