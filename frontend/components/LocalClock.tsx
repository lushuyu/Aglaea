"use client";

import { useState, useEffect } from "react";

/**
 * LocalClock — renders current browser-local time.
 * Public pages render in browser-local time (no explicit TZ). AC2.7.
 */
export default function LocalClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const date = now.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const tzName =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "local";
  const tzAbbr = (() => {
    try {
      const parts = new Intl.DateTimeFormat(undefined, {
        timeZoneName: "short",
      }).formatToParts(now);
      const tz = parts.find((p) => p.type === "timeZoneName");
      return tz ? tz.value : "";
    } catch {
      return "";
    }
  })();

  return (
    <span title={tzName}>
      {date} {time} {tzAbbr}
    </span>
  );
}
