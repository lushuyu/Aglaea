import Link from "next/link";
import { getPublicServices, getPublicActiveIncidents, getPublicUptime } from "@/lib/api";
import StatusBanner from "@/components/StatusBanner";
import StatusBadge from "@/components/StatusBadge";
import SubcheckStrip from "@/components/SubcheckStrip";
import UptimeStrip from "@/components/UptimeStrip";
import HomePanels from "@/components/HomePanels";
import ClaudeCodePanel from "@/components/ClaudeCodePanel";
import IncidentFeed from "@/components/IncidentFeed";
import ServiceRow from "@/components/ServiceRow";
import { formatDistanceToNow } from "date-fns";
import type { PublicService, ServiceStatus, PublicIncidentPublished, UptimeDay } from "@/types/api";

export const revalidate = 30;

function overallStatus(services: PublicService[]): ServiceStatus {
  if (services.some((s) => s.last_status === "down")) return "down";
  if (services.some((s) => s.last_status === "degraded")) return "degraded";
  if (services.some((s) => s.last_status === "unknown")) return "unknown";
  return "ok";
}

const STATUS_LABEL: Record<ServiceStatus, string> = {
  ok: "All systems operational",
  degraded: "Partial degradation detected",
  down: "Service disruption in progress",
  unknown: "Status unknown",
};

export default async function PublicOverview() {
  let services: PublicService[] = [];
  try {
    services = await getPublicServices();
  } catch {
    // backend unreachable — render empty state
  }

  const overall = overallStatus(services);

  // Fetch active incidents for services that appear degraded/down
  const nonOkServices = services.filter(
    (s) => s.last_status !== "ok" && s.last_status !== null
  );

  type ActiveRow = {
    slug: string;
    displayName: string;
    incident: PublicIncidentPublished;
  };

  const activeRows: ActiveRow[] = [];
  // Fetch uptime for all services in parallel with incident data
  const [, uptimeResults] = await Promise.all([
    Promise.all(
      nonOkServices.map(async (svc) => {
        try {
          const resp = await getPublicActiveIncidents(svc.slug);
          const published = resp.incidents.find(
            (inc): inc is PublicIncidentPublished =>
              "summary" in inc && inc.lifecycle_state !== "resolved"
          );
          if (published) {
            activeRows.push({
              slug: svc.slug,
              displayName: svc.display_name,
              incident: published,
            });
          }
        } catch {
          // service may have no active incidents endpoint — skip silently
        }
      })
    ),
    Promise.all(
      services.map(async (svc) => {
        try {
          const resp = await getPublicUptime(svc.slug, 30);
          return { slug: svc.slug, days: resp.days };
        } catch {
          return { slug: svc.slug, days: [] as UptimeDay[] };
        }
      })
    ),
  ]);

  const uptimeBySlug = new Map(uptimeResults.map((r) => [r.slug, r.days]));

  const statusPanel = (
    <>
      <div style={{ paddingTop: 32, paddingBottom: 40 }}>
        <StatusBanner status={overall} title={STATUS_LABEL[overall]} />
      </div>

      {/* Active Incidents card */}
      {activeRows.length > 0 && (
        <div
          style={{
            marginBottom: 36,
            padding: "20px 24px",
            background: "var(--bg-1)",
            border: "1px solid var(--line-2)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 16,
              fontWeight: 500,
              color: "var(--fg-0)",
              margin: "0 0 16px 0",
            }}
          >
            Active Incidents
          </h2>
          <div>
            {activeRows.map(({ slug, displayName, incident }) => {
              const summary = incident.summary ?? "";
              const truncated =
                summary.length > 200
                  ? summary.slice(0, 200) + "…"
                  : summary;
              const relTime = formatDistanceToNow(
                new Date(incident.started_at),
                { addSuffix: true }
              );
              return (
                <div
                  key={incident.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                    paddingBottom: 14,
                    marginBottom: 14,
                    borderBottom: "1px solid var(--line-1)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: 14,
                          color: "var(--fg-0)",
                        }}
                      >
                        {displayName}
                      </span>
                      <StatusBadge
                        lifecycle={incident.lifecycle_state}
                        size="sm"
                      />
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--fg-3)",
                        }}
                      >
                        since {relTime}
                      </span>
                    </div>
                    {truncated && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "var(--fg-2)",
                          lineHeight: 1.55,
                        }}
                      >
                        {truncated}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/services/${slug}/incidents/${incident.id}`}
                    style={{
                      flexShrink: 0,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--accent)",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      paddingTop: 2,
                    }}
                  >
                    View incident
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="services-list">
        {services.length === 0 && (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "var(--fg-3)",
              fontFamily: "var(--font-mono)",
              fontSize: 15,
            }}
          >
            No services configured
          </div>
        )}
        {services.map((svc) => {
          const uptimeDays = uptimeBySlug.get(svc.slug) ?? [];
          return (
            <Link
              key={svc.slug}
              href={`/services/${svc.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <ServiceRow>
                {/* column 1: name + description */}
                <div className="service-row__name">
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 16,
                      color: "var(--fg-0)",
                    }}
                  >
                    {svc.display_name}
                  </div>
                  {svc.description && (
                    <div
                      style={{
                        fontSize: 16,
                        color: "var(--fg-3)",
                        marginTop: 2,
                      }}
                    >
                      {svc.description}
                    </div>
                  )}
                </div>

                {/* column 2: SubcheckStrip (was column 3) */}
                <div className="service-row-mid">
                  {svc.last_subchecks && Object.keys(svc.last_subchecks).length > 0 && (
                    <SubcheckStrip subchecks={svc.last_subchecks} />
                  )}
                </div>

                {/* column 3: UptimeStrip (was column 2) */}
                <div className="service-row-uptime">
                  {uptimeDays.length > 0 && (
                    <UptimeStrip days={uptimeDays} />
                  )}
                </div>

                {/* column 4: StatusBadge with size="row" */}
                <div className="service-row-right">
                  <StatusBadge status={svc.last_status ?? "unknown"} size="row" />
                </div>
              </ServiceRow>
            </Link>
          );
        })}
      </div>

      <IncidentFeed />
    </>
  );

  return (
    <main className="container">
      <HomePanels
        statusPanel={statusPanel}
        ccPanel={<ClaudeCodePanel />}
      />
    </main>
  );
}
