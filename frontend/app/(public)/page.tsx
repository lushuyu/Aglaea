import { getPublicServices } from "@/lib/api";
import StatusBanner from "@/components/StatusBanner";
import StatusBadge from "@/components/StatusBadge";
import SubcheckStrip from "@/components/SubcheckStrip";
import type { PublicService, ServiceStatus } from "@/types/api";

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

  return (
    <div className="container">
      <div style={{ paddingTop: 32, paddingBottom: 40 }}>
        <StatusBanner status={overall} title={STATUS_LABEL[overall]} />
      </div>

      <div className="section-hd">
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 18,
            color: "var(--fg-1)",
          }}
        >
          Services
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--fg-3)",
          }}
        >
          {services.length} monitored
        </span>
      </div>

      <div className="services-list" style={{ marginTop: 8 }}>
        {services.length === 0 && (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "var(--fg-3)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
          >
            No services configured
          </div>
        )}
        {services.map((svc) => (
          <div key={svc.slug} className="service-row">
            <div className="service-row-left">
              <div>
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
                      fontSize: 12,
                      color: "var(--fg-3)",
                      marginTop: 2,
                    }}
                  >
                    {svc.description}
                  </div>
                )}
              </div>
            </div>

            <div className="service-row-mid">
              {svc.last_subchecks && Object.keys(svc.last_subchecks).length > 0 && (
                <SubcheckStrip subchecks={svc.last_subchecks} />
              )}
            </div>

            <div className="service-row-right">
              <StatusBadge status={svc.last_status} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
