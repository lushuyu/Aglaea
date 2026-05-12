"use client";

import { useQuery } from "@tanstack/react-query";
import { adminGetClaudeCode } from "@/lib/api";
import LineChart from "@/components/LineChart";
import Heatmap from "@/components/Heatmap";
import Donut from "@/components/Donut";
import StackedBars from "@/components/StackedBars";
import { fmtNum } from "@/lib/fmt";

export default function AdminClaudeCodePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-claude-code"],
    queryFn: adminGetClaudeCode,
    refetchInterval: 60_000,
  });

  const metrics = data?.metrics;

  if (isLoading) {
    return (
      <div className="admin-page">
        <div className="admin-page-hd">
          <h1 className="admin-h2">Claude Code</h1>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--fg-3)",
            padding: "32px 0",
          }}
        >
          Loading…
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="admin-page">
        <div className="admin-page-hd">
          <h1 className="admin-h2">Claude Code</h1>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--fg-3)",
            padding: "32px 0",
          }}
        >
          No data available.
        </div>
      </div>
    );
  }

  const totalTokens = metrics.token_total_30d.reduce(
    (a, p) => a + p.value,
    0
  );
  const totalCost = metrics.cost_trend_30d.reduce((a, p) => a + p.usd, 0);
  const totalSessions = metrics.sessions_daily_30d.reduce(
    (a, p) => a + p.count,
    0
  );
  const totalCommits = metrics.commits_daily_30d.reduce(
    (a, p) => a + p.count,
    0
  );

  const hourlyLabels = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0")
  );
  const heatmapRowLabels = metrics.active_hours_heatmap.map(
    (_, i) => `W${i + 1}`
  );

  const locChartData = metrics.loc_daily_30d.map((p) => ({
    x: p.date,
    added: p.added,
    removed: p.removed,
  }));

  const tokenLineData = metrics.token_total_30d.map((p) => ({
    x: p.ts.slice(0, 10),
    y: p.value,
  }));
  const costLineData = metrics.cost_trend_30d.map((p) => ({
    x: p.ts.slice(0, 10),
    y: p.usd,
  }));
  const sessionLineData = metrics.sessions_daily_30d.map((p) => ({
    x: p.date,
    y: p.count,
  }));
  const commitLineData = metrics.commits_daily_30d.map((p) => ({
    x: p.date,
    y: p.count,
  }));

  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-h2">Claude Code</h1>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--fg-3)",
          }}
        >
          last 30 days
        </span>
      </div>

      {/* Glance tiles */}
      <div className="glance-row" style={{ marginBottom: 40 }}>
        <div className="glance-tile">
          <div className="glance-value">{fmtNum(totalTokens)}</div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Tokens</div>
        </div>
        <div className="glance-tile">
          <div className="glance-value">${totalCost.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Cost</div>
        </div>
        <div className="glance-tile">
          <div className="glance-value">{fmtNum(totalSessions)}</div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Sessions</div>
        </div>
        <div className="glance-tile">
          <div className="glance-value">{fmtNum(totalCommits)}</div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Commits</div>
        </div>
        <div className="glance-tile">
          <div className="glance-value">
            {(metrics.cache_hit_rate_7d * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Cache hit</div>
        </div>
      </div>

      {/* Charts grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginBottom: 32,
        }}
      >
        {tokenLineData.length > 0 && (
          <div className="chart-card">
            <div className="chart-card-hd">Token usage</div>
            <div className="chart-card-body">
              <LineChart series={[{ name: "tokens", data: tokenLineData }]} yFormat={fmtNum} w={480} h={140} />
            </div>
          </div>
        )}

        {costLineData.length > 0 && (
          <div className="chart-card">
            <div className="chart-card-hd">Cost (USD)</div>
            <div className="chart-card-body">
              <LineChart
                series={[{ name: "cost", data: costLineData }]}
                yFormat={(v) => `$${v.toFixed(2)}`}
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
              <LineChart series={[{ name: "sessions", data: sessionLineData }]} yFormat={fmtNum} w={480} h={140} />
            </div>
          </div>
        )}

        {commitLineData.length > 0 && (
          <div className="chart-card">
            <div className="chart-card-hd">Commits</div>
            <div className="chart-card-body">
              <LineChart series={[{ name: "commits", data: commitLineData }]} yFormat={fmtNum} w={480} h={140} />
            </div>
          </div>
        )}

        {metrics.token_by_model.length > 0 && (
          <div className="chart-card">
            <div className="chart-card-hd">Model distribution</div>
            <div className="chart-card-body">
              <Donut
                data={metrics.token_by_model.map((m) => ({
                  label: m.model,
                  value: m.value,
                }))}
                size={120}
                strokeW={16}
              />
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

        {locChartData.length > 0 && (
          <div className="chart-card" style={{ gridColumn: "1 / -1" }}>
            <div className="chart-card-hd">Lines of code</div>
            <div className="chart-card-body">
              <StackedBars
                data={locChartData}
                keys={["added", "removed"]}
                w={880}
                h={140}
              />
            </div>
          </div>
        )}
      </div>

      {/* Hourly heatmap */}
      {metrics.active_hours_heatmap.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 32 }}>
          <div className="chart-card-hd">Active hours heatmap</div>
          <div className="chart-card-body">
            <Heatmap
              data={metrics.active_hours_heatmap}
              rowLabels={heatmapRowLabels}
              colLabels={hourlyLabels}
              w={720}
            />
          </div>
        </div>
      )}

      {/* Per-host breakdown */}
      {metrics.by_host && Object.keys(metrics.by_host).length > 0 && (
        <div className="admin-section">
          <h2 className="admin-h3" style={{ marginBottom: 12 }}>
            Per-host
          </h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Host</th>
                <th>Tokens 30d</th>
                <th>Cost 30d</th>
                <th>Sessions 30d</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics.by_host).map(([host, hm]) => (
                <tr key={host}>
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    {host}
                  </td>
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    {fmtNum(hm.tokens_30d)}
                  </td>
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    ${hm.cost_30d.toFixed(2)}
                  </td>
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    {fmtNum(hm.sessions_30d)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
