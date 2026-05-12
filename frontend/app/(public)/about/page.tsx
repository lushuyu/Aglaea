export const revalidate = 30;

export default function PublicAbout() {
  return (
    <div className="container narrow">
      <div className="incident-prose" style={{ paddingTop: 32 }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 32,
            fontWeight: 400,
            color: "var(--fg-0)",
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          About Aglaea
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--accent)",
            marginBottom: 32,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Status &amp; Signal Platform
        </p>

        <p>
          Aglaea is a real-time service status and incident intelligence
          platform. It monitors external API dependencies, aggregates heartbeat
          data, and surfaces AI-generated incident reports — so teams spend less
          time triage and more time resolving.
        </p>

        <h2>What we monitor</h2>
        <p>
          Each service tracked by Aglaea has a set of subchecks — named
          integration points polled at regular intervals. Status rolls up from
          worst subcheck to overall service health. When a service enters a
          degraded or down state, Aglaea opens an incident automatically.
        </p>

        <h2>Incident reports</h2>
        <p>
          Incidents are enriched with AI-generated summaries drawn from raw
          event telemetry. Reports go through a review queue before publication,
          ensuring accuracy while preserving speed. Published reports include a
          full timeline, affected subchecks, and resolution notes.
        </p>

        <h2>Claude Code analytics</h2>
        <p>
          The Claude Code section tracks aggregate usage patterns across the
          monitored fleet — token consumption, session counts, model
          distribution, and hourly activity heatmaps.
        </p>

        <h2>Data freshness</h2>
        <p>
          Public pages revalidate every 30 seconds. Subchecks and heartbeat
          data reflect the most recent poll cycle. Incident timelines are
          updated in real time as events arrive.
        </p>
      </div>
    </div>
  );
}
