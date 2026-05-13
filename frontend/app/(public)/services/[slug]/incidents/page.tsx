import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicService, getPublicIncidentHistory } from "@/lib/api";
import Breadcrumb from "@/components/Breadcrumb";
import StatusBadge from "@/components/StatusBadge";
import { fmtTime, fmtDuration } from "@/lib/fmt";
import type { Incident } from "@/types/api";

export const revalidate = 30;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PublicIncidentHistory({ params }: Props) {
  const { slug } = await params;

  let svcResp;
  try {
    svcResp = await getPublicService(slug);
  } catch {
    notFound();
  }

  let incidents: Incident[] = [];
  try {
    incidents = await getPublicIncidentHistory(slug);
  } catch {
    // return empty
  }

  const svc = svcResp.service;

  return (
    <div className="container">
      <Breadcrumb
        items={[
          { label: "Status", href: "/" },
          { label: svc.display_name, href: `/services/${slug}` },
          { label: "Incidents" },
        ]}
      />

      <div style={{ paddingTop: 24 }}>
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
          Incident history
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--fg-3)",
            marginBottom: 32,
          }}
        >
          {svc.display_name}
        </p>

        {incidents.length === 0 ? (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "var(--fg-3)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
          >
            No incidents recorded
          </div>
        ) : (
          <div className="recent-list">
            {incidents.map((inc) => (
              <Link
                key={inc.id}
                href={`/services/${slug}/incidents/${inc.id}`}
                className="recent-row"
                style={{ textDecoration: "none" }}
              >
                <div className="recent-left">
                  <StatusBadge
                    status={inc.status === "ongoing" ? "degraded" : "ok"}
                    size="sm"
                  />
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--fg-3)",
                      }}
                    >
                      #{inc.id}
                    </div>
                    <div
                      style={{ fontSize: 14, color: "var(--fg-1)", marginTop: 2 }}
                    >
                      {inc.affected_subchecks.join(", ") || "All subchecks"}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--fg-3)",
                  }}
                >
                  {fmtTime(inc.started_at)}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--fg-3)",
                    textAlign: "right",
                  }}
                >
                  {inc.resolved_at
                    ? fmtDuration(inc.started_at, inc.resolved_at)
                    : "ongoing"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
