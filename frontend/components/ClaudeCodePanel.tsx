"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getClaudeCodeMetric } from "@/lib/api";
import StatTile from "@/components/StatTile";
import LineChart from "@/components/LineChart";
import Donut from "@/components/Donut";
import RangeBrush from "@/components/RangeBrush";
import { fmtNum } from "@/lib/fmt";

const ONE_DAY_MS = 86_400_000;
const DEFAULT_SPAN_DAYS = 30;

export default function ClaudeCodePanel() {
  const [range, setRange] = useState<{ startMs: number; endMs: number } | null>(
    null
  );

  const queryArg = range
    ? { start_ms: range.startMs, end_ms: range.endMs }
    : undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-claude-code", range?.startMs ?? null, range?.endMs ?? null],
    queryFn: () => getClaudeCodeMetric(queryArg),
    staleTime: 30_000,
  });

  const metrics = data?.metrics;

  if (range === null && metrics) {
    const initEnd = metrics.range_end_ms;
    const initStart = initEnd - DEFAULT_SPAN_DAYS * ONE_DAY_MS;
    setRange({ startMs: initStart, endMs: initEnd });
  }

  const totals = useMemo(() => {
    if (!metrics) return null;
    const totalTokens = metrics.token_total.reduce((a, p) => a + p.value, 0);
    const totalSessions = metrics.sessions_daily.reduce(
      (a, p) => a + p.count,
      0
    );
    const totalCost = metrics.cost_trend.reduce((a, p) => a + p.usd, 0);
    const totalCommits = metrics.commits_daily.reduce(
      (a, p) => a + p.count,
      0
    );
    const avgTokensPerSession =
      totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0;
    return {
      totalTokens,
      totalSessions,
      totalCost,
      totalCommits,
      avgTokensPerSession,
    };
  }, [metrics]);

  const tokenLineData = useMemo(
    () =>
      metrics
        ? metrics.token_total.map((p) => ({
            x: p.ts.slice(0, 10),
            y: p.value,
          }))
        : [],
    [metrics]
  );

  const sessionLineData = useMemo(
    () =>
      metrics
        ? metrics.sessions_daily.map((p) => ({ x: p.date, y: p.count }))
        : [],
    [metrics]
  );

  const modelDonutData = useMemo(
    () =>
      metrics
        ? metrics.token_by_model.map((m) => ({
            label: m.model,
            value: m.value,
          }))
        : [],
    [metrics]
  );

  if (isLoading && !metrics) {
    return (
      <div className="container">
        <div style={{ paddingTop: 32 }}>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 28,
              fontWeight: 400,
              color: "var(--fg-0)",
              marginBottom: 32,
            }}
          >
            Claude Code
          </h1>
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "var(--fg-3)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
          >
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (isError || !metrics || !totals) {
    return (
      <div className="container">
        <div style={{ paddingTop: 32 }}>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 28,
              fontWeight: 400,
              color: "var(--fg-0)",
              marginBottom: 32,
            }}
          >
            Claude Code
          </h1>
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "var(--fg-3)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
          >
            No data available
          </div>
        </div>
      </div>
    );
  }

  const effectiveRange = range ?? {
    startMs: metrics.range_start_ms,
    endMs: metrics.range_end_ms,
  };

  return (
    <div className="container">
      <div style={{ paddingTop: 32 }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 400,
            color: "var(--fg-0)",
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          Claude Code
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--fg-3)",
            marginBottom: 24,
          }}
        >
          Aggregate usage analytics — drag the brush below to scope the view.
        </p>

        <div className="chart-card" style={{ marginBottom: 32 }}>
          <div className="chart-card-hd">Token usage timeline</div>
          <div className="chart-card-body">
            <RangeBrush
              timeline={metrics.timeline}
              startMs={effectiveRange.startMs}
              endMs={effectiveRange.endMs}
              onChange={setRange}
            />
          </div>
        </div>

        <div className="cc-grid" style={{ marginBottom: 48 }}>
          <StatTile label="Total tokens" value={fmtNum(totals.totalTokens)} />
          <StatTile label="Sessions" value={fmtNum(totals.totalSessions)} />
          <StatTile
            label="Avg tokens / session"
            value={fmtNum(totals.avgTokensPerSession)}
          />
          <StatTile
            label="Est. cost"
            value={`$${totals.totalCost.toFixed(2)}`}
          />
          <StatTile label="Commits" value={fmtNum(totals.totalCommits)} />
          <StatTile
            label="Cache hit rate"
            value={`${(metrics.cache_hit_rate * 100).toFixed(1)}%`}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            marginBottom: 48,
          }}
        >
          {tokenLineData.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-hd">Token usage</div>
              <div className="chart-card-body">
                <LineChart
                  series={[{ name: "tokens", data: tokenLineData }]}
                  yFormat={fmtNum}
                  w={480}
                  h={140}
                />
              </div>
            </div>
          )}

          {sessionLineData.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-hd">Sessions</div>
              <div className="chart-card-body">
                <LineChart
                  series={[{ name: "sessions", data: sessionLineData }]}
                  yFormat={fmtNum}
                  w={480}
                  h={140}
                />
              </div>
            </div>
          )}

          {modelDonutData.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-hd">Model distribution</div>
              <div className="chart-card-body">
                <Donut data={modelDonutData} size={120} strokeW={16} />
              </div>
            </div>
          )}

          {metrics.terminal_type_share.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-hd">Terminal type</div>
              <div className="chart-card-body">
                <Donut
                  data={metrics.terminal_type_share.map((t) => ({
                    label: t.type,
                    value: t.value,
                  }))}
                  size={120}
                  strokeW={16}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
