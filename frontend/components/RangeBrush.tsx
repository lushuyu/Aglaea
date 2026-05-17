"use client";

import { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  Brush,
  ResponsiveContainer,
  XAxis,
  Tooltip,
} from "recharts";
import type { TokenDataPoint } from "@/types/api";

type Preset = "7d" | "30d" | "90d" | "all";

interface RangeBrushProps {
  timeline: TokenDataPoint[];
  startMs: number;
  endMs: number;
  onChange: (next: { startMs: number; endMs: number }) => void;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export default function RangeBrush({
  timeline,
  startMs,
  endMs,
  onChange,
}: RangeBrushProps) {
  const rows = useMemo(
    () =>
      timeline.map((p) => ({
        ts: new Date(p.ts).getTime(),
        label: p.ts.slice(0, 10),
        value: p.value,
      })),
    [timeline]
  );

  const earliestMs = rows[0]?.ts ?? 0;
  const latestMs = rows[rows.length - 1]?.ts ?? 0;

  const [startIdx, setStartIdx] = useState(0);
  const [endIdx, setEndIdx] = useState(Math.max(0, rows.length - 1));

  useEffect(() => {
    if (rows.length === 0) return;
    let s = rows.findIndex((r) => r.ts >= startMs);
    let e = rows.findIndex((r) => r.ts > endMs) - 1;
    if (s < 0) s = 0;
    if (e < 0) e = rows.length - 1;
    if (e < s) e = s;
    setStartIdx(s);
    setEndIdx(e);
  }, [rows, startMs, endMs]);

  const handleBrushChange = (e: { startIndex?: number; endIndex?: number }) => {
    const s = e.startIndex ?? 0;
    const en = e.endIndex ?? rows.length - 1;
    setStartIdx(s);
    setEndIdx(en);
    const ns = rows[s]?.ts ?? earliestMs;
    const ne = rows[en]?.ts ?? latestMs;
    if (ns !== startMs || ne !== endMs) {
      onChange({ startMs: ns, endMs: ne + 86_400_000 });
    }
  };

  const applyPreset = (p: Preset) => {
    if (rows.length === 0) return;
    const oneDay = 86_400_000;
    const end = latestMs + oneDay;
    let start: number;
    if (p === "7d") start = end - 7 * oneDay;
    else if (p === "30d") start = end - 30 * oneDay;
    else if (p === "90d") start = end - 90 * oneDay;
    else start = earliestMs;
    onChange({ startMs: start, endMs: end });
  };

  const activePreset: Preset | null = useMemo(() => {
    if (rows.length === 0) return null;
    const oneDay = 86_400_000;
    const spanDays = Math.round((endMs - startMs) / oneDay);
    if (Math.abs(startMs - earliestMs) < oneDay && spanDays >= rows.length - 1)
      return "all";
    if (spanDays === 7) return "7d";
    if (spanDays === 30) return "30d";
    if (spanDays === 90) return "90d";
    return null;
  }, [startMs, endMs, earliestMs, rows.length]);

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: "32px 0",
          textAlign: "center",
          color: "var(--fg-3)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}
      >
        No timeline data yet.
      </div>
    );
  }

  return (
    <div className="cc-range-brush">
      <div className="cc-range-presets">
        {(["7d", "30d", "90d", "all"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => applyPreset(p)}
            className={`cc-range-chip ${activePreset === p ? "is-active" : ""}`}
          >
            {p === "all" ? "All time" : `Last ${p}`}
          </button>
        ))}
        <div className="cc-range-readout">
          {fmtDay(startMs)} → {fmtDay(endMs - 1)}
        </div>
      </div>
      <div style={{ width: "100%", height: 110 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" hide />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "var(--bg-1)",
                border: "1px solid var(--bd)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--fg-0)",
              }}
              formatter={(v) => [fmtCompact(Number(v)), "tokens"] as [string, string]}
              labelFormatter={(l) => String(l)}
            />
            <Bar dataKey="value" fill="var(--accent, #888)" />
            <Brush
              dataKey="label"
              height={22}
              startIndex={startIdx}
              endIndex={endIdx}
              onChange={handleBrushChange}
              stroke="var(--fg-2, #888)"
              fill="var(--bg-2, rgba(255,255,255,0.03))"
              travellerWidth={8}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
