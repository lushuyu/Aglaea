/**
 * Aglaea — formatting helpers
 * Ported from docs/design/project/src/components.jsx
 */

/**
 * Relative time string: "just now", "3m ago", "2h ago", "5d ago", or ISO date.
 * Pass `now` to make it testable / tick-driven.
 */
export function fmtTime(iso: string | null | undefined, now?: Date): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const ref = now ?? new Date();
  const ms = ref.getTime() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24);
  if (dd < 30) return `${dd}d ago`;
  return d.toISOString().slice(0, 10);
}

/**
 * Human-readable duration between two ISO timestamps.
 * If `endIso` is omitted, uses current time.
 */
export function fmtDuration(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date();
  let s = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Formatted clock string for incident timestamps (UTC).
 * Output: "13 May, 07:42 UTC"
 */
export function fmtClock(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }) + " UTC"
  );
}

/**
 * Compact number formatter: 1.2K, 3.4M, 5.67B.
 */
export function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

/**
 * Admin local-time string in Asia/Singapore timezone (SGT).
 * Returns e.g. "07:42 SGT"
 */
export function fmtSGT(date?: Date): string {
  const d = date ?? new Date();
  return d.toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Singapore",
  }) + " SGT";
}
