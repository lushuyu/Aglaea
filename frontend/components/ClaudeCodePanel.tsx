import { getClaudeCodeMetric } from "@/lib/api";
import StatTile from "@/components/StatTile";
import LineChart from "@/components/LineChart";
import Heatmap from "@/components/Heatmap";
import Donut from "@/components/Donut";
import { fmtNum } from "@/lib/fmt";

export default async function ClaudeCodePanel() {
  let data = null;
  try {
    const resp = await getClaudeCodeMetric();
    data = resp.metrics;
  } catch {
    // backend unreachable
  }

  if (!data) {
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

  // Aggregate totals from 30-day arrays
  const totalTokens = data.token_total_30d.reduce((a, p) => a + p.value, 0);
  const totalSessions = data.sessions_daily_30d.reduce(
    (a, p) => a + p.count,
    0
  );
  const avgTokensPerSession =
    totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0;
  const totalCost = data.cost_trend_30d.reduce((a, p) => a + p.usd, 0);

  const modelDonutData = data.token_by_model.map((m) => ({
    label: m.model,
    value: m.value,
  }));

  const hourlyLabels = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0")
  );
  const heatmapRowLabels = data.active_hours_heatmap.map(
    (_, i) => `W${i + 1}`
  );

  const tokenLineData = data.token_total_30d.map((p) => ({
    x: p.ts.slice(0, 10),
    y: p.value,
  }));
  const sessionLineData = data.sessions_daily_30d.map((p) => ({
    x: p.date,
    y: p.count,
  }));

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
            marginBottom: 40,
          }}
        >
          Aggregate usage analytics — last 30 days.
        </p>

        {/* Glance tiles */}
        <div
          className="cc-grid"
          style={{ marginBottom: 48 }}
        >
          <StatTile
            label="Total tokens"
            value={fmtNum(totalTokens)}
            sub="last 30 days"
          />
          <StatTile
            label="Sessions"
            value={fmtNum(totalSessions)}
            sub="last 30 days"
          />
          <StatTile
            label="Avg tokens / session"
            value={fmtNum(avgTokensPerSession)}
          />
          <StatTile
            label="Est. cost"
            value={`$${totalCost.toFixed(2)}`}
            sub="last 30 days"
          />
          <StatTile
            label="Cache hit rate"
            value={`${(data.cache_hit_rate_7d * 100).toFixed(1)}%`}
            sub="last 7 days"
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
          {/* Token usage over time */}
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

          {/* Sessions over time */}
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

          {/* Model distribution */}
          {modelDonutData.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-hd">Model distribution</div>
              <div className="chart-card-body">
                <Donut data={modelDonutData} size={120} strokeW={16} />
              </div>
            </div>
          )}

          {/* Terminal type share */}
          {data.terminal_type_share.length > 0 && (
            <div className="chart-card">
              <div className="chart-card-hd">Terminal type</div>
              <div className="chart-card-body">
                <Donut
                  data={data.terminal_type_share.map((t) => ({
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

        {/* Hourly activity heatmap */}
        {data.active_hours_heatmap.length > 0 && (
          <div className="chart-card" style={{ marginBottom: 48 }}>
            <div className="chart-card-hd">Hourly activity heatmap</div>
            <div className="chart-card-body">
              <Heatmap
                data={data.active_hours_heatmap}
                rowLabels={heatmapRowLabels}
                colLabels={hourlyLabels}
                w={640}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
