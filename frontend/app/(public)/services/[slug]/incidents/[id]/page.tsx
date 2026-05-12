import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicService, getPublicIncident } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import StatusBadge from "@/components/StatusBadge";
import Swimlane from "@/components/Swimlane";
import { fmtTime, fmtDuration } from "@/lib/fmt";
import type { SwimlaneData, SwimlaneSegment } from "@/types/api";

export const revalidate = 30;

interface Props {
  params: Promise<{ slug: string; id: string }>;
}

export default async function PublicIncidentDetail({ params }: Props) {
  const { slug, id } = await params;

  let svcResp;
  try {
    svcResp = await getPublicService(slug);
  } catch {
    notFound();
  }

  let incResp;
  try {
    incResp = await getPublicIncident(slug, id);
  } catch {
    notFound();
  }

  const svc = svcResp.service;
  const { incident, timeline } = incResp;

  // Build swimlane data from timeline events
  const laneMap = new Map<string, SwimlaneSegment[]>();
  const sortedEvents = [...timeline].sort(
    (a, b) => +new Date(a.t) - +new Date(b.t)
  );
  for (const ev of sortedEvents) {
    if (!laneMap.has(ev.sub)) laneMap.set(ev.sub, []);
  }
  // Build segments: each event spans to the next event in same lane
  for (const [sub, segs] of laneMap.entries()) {
    const eventsForSub = sortedEvents.filter((e) => e.sub === sub);
    for (let i = 0; i < eventsForSub.length; i++) {
      const ev = eventsForSub[i];
      const next = eventsForSub[i + 1];
      const end = next
        ? next.t
        : incident.resolved_at ?? new Date().toISOString();
      segs.push({ start: ev.t, end, status: ev.status });
    }
  }
  const lanes: SwimlaneData[] = Array.from(laneMap.entries()).map(
    ([name, segments]) => ({ name, segments })
  );

  return (
    <div className="container">
      <Breadcrumb
        items={[
          { label: "Status", href: "/" },
          { label: svc.display_name, href: `/services/${slug}` },
          { label: "Incidents", href: `/services/${slug}/incidents` },
          { label: `#${incident.id}` },
        ]}
      />

      <div style={{ paddingTop: 24 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 24,
            marginBottom: 32,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 26,
                fontWeight: 400,
                color: "var(--fg-0)",
                marginBottom: 8,
                letterSpacing: "-0.02em",
              }}
            >
              Incident #{incident.id}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <StatusBadge
                status={incident.status === "ongoing" ? "degraded" : "ok"}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--fg-3)",
                }}
              >
                {fmtTime(incident.started_at)}
                {incident.resolved_at &&
                  ` — ${fmtDuration(incident.started_at, incident.resolved_at)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Published report */}
        {incident.published_text && (
          <div style={{ marginBottom: 48 }}>
            <div className="section-hd" style={{ marginBottom: 20 }}>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 16,
                  color: "var(--fg-1)",
                }}
              >
                Incident report
              </span>
              {incident.published_at && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-3)",
                  }}
                >
                  published {fmtTime(incident.published_at)}
                </span>
              )}
            </div>
            <div className="incident-prose">
              {incident.published_text.split("\n").map((line, i) => (
                <p key={i}>{line || <br />}</p>
              ))}
            </div>
          </div>
        )}

        {/* Swimlane */}
        {lanes.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <div className="section-hd" style={{ marginBottom: 16 }}>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 16,
                  color: "var(--fg-1)",
                }}
              >
                Subcheck timeline
              </span>
            </div>
            <Swimlane lanes={lanes} />
          </div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <div className="section-hd" style={{ marginBottom: 16 }}>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 16,
                  color: "var(--fg-1)",
                }}
              >
                Event log
              </span>
            </div>
            <div className="timeline">
              {sortedEvents.map((ev, i) => (
                <div key={i} className="timeline-row">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--fg-3)",
                      minWidth: 80,
                    }}
                  >
                    {fmtTime(ev.t)}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--accent)",
                      minWidth: 80,
                    }}
                  >
                    {ev.sub}
                  </span>
                  <StatusBadge status={ev.status} size="sm" />
                  {ev.note && (
                    <span style={{ fontSize: 13, color: "var(--fg-2)" }}>
                      {ev.note}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar incidents */}
        {incResp.similar && incResp.similar.length > 0 && (
          <div>
            <div className="section-hd" style={{ marginBottom: 16 }}>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 16,
                  color: "var(--fg-1)",
                }}
              >
                Similar incidents
              </span>
            </div>
            {incResp.similar.map((s) => (
              <Link
                key={s.id}
                href={`/services/${slug}/incidents/${s.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "10px 4px",
                  borderBottom: "1px solid var(--line-1)",
                  textDecoration: "none",
                  color: "var(--fg-1)",
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-3)",
                    minWidth: 32,
                  }}
                >
                  #{s.id}
                </span>
                <span style={{ flex: 1 }}>{s.summary}</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-3)",
                  }}
                >
                  {fmtTime(s.started_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
