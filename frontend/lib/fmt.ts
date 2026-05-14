/**
 * Aglaea — formatting helpers
 * Uses date-fns + date-fns-tz for locale-aware and timezone-aware formatting.
 */

import { formatDistanceToNow, format, formatDuration, intervalToDuration } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Relative time string: "3 minutes ago", "about 2 hours ago", etc.
 * Thin wrapper around date-fns formatDistanceToNow.
 * Pass `now` to make it testable / tick-driven.
 */
export function fmtTime(iso: string | null | undefined, _now?: Date): string {
  if (!iso) return "—";
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

/**
 * Absolute date-time string: "2024-05-13 07:42"
 */
export function fmtAbsolute(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd HH:mm");
}

/**
 * Human-readable duration between two ISO timestamps.
 * If `endIso` is omitted, uses current time.
 */
export function fmtDuration(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : new Date();
  const duration = intervalToDuration({ start, end });
  const h = duration.hours ?? 0;
  const m = duration.minutes ?? 0;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Formatted clock string for incident timestamps (UTC).
 * Output: "13 May, 07:42 UTC"
 */
export function fmtClock(iso: string): string {
  return format(new Date(iso), "d MMM, HH:mm") + " UTC";
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
  return formatInTimeZone(d, "Asia/Singapore", "HH:mm") + " SGT";
}
