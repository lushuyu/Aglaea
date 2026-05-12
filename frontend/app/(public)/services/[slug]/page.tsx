import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicService } from "@/lib/api";
import StatusBanner from "@/components/StatusBanner";
import StatusBadge from "@/components/StatusBadge";
import Breadcrumb from "@/components/Breadcrumb";
import { fmtTime } from "@/lib/fmt";

export const revalidate = 30;

interface Props {
  params: Promise<{ slug: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  ok: "Operational",
  degraded: "Degraded performance",
  down: "Service disruption",
  unknown: "Status unknown",
};

export default async function PublicServiceDetail({ params }: Props) {
  const { slug } = await params;

  let resp;
  try {
    resp = await getPublicService(slug);
  } catch {
    notFound();
  }

  const svc = resp.service;

  return (
    <div className="container">
      <Breadcrumb
        items={[
          { label: "Status", href: "/" },
          { label: svc.display_name },
        ]}
      />

      <div style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 32,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 30,
                fontWeight: 400,
                color: "var(--fg-0)",
                marginBottom: 4,
                letterSpacing: "-0.02em",
              }}
            >
              {svc.display_name}
            </h1>
            {svc.description && (
              <p style={{ fontSize: 14, color: "var(--fg-2)" }}>
                {svc.description}
              </p>
            )}
          </div>
        </div>

        <StatusBanner
          status={svc.last_status}
          title={STATUS_LABEL[svc.last_status ?? "unknown"] ?? svc.last_status ?? "unknown"}
          sub={`Last checked ${fmtTime(svc.last_heartbeat_at)}`}
        />

        {/* Subchecks */}
        {svc.last_subchecks && Object.keys(svc.last_subchecks).length > 0 && (
          <div style={{ marginTop: 40 }}>
            <div className="section-hd">
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 16,
                  color: "var(--fg-1)",
                }}
              >
                Subchecks
              </span>
            </div>
            <div className="subchecks-grid" style={{ marginTop: 16 }}>
              {Object.entries(svc.last_subchecks).map(([key, sc]) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--line-1)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      color: "var(--fg-1)",
                    }}
                  >
                    {key}
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    {sc.latency_ms !== undefined && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--fg-3)",
                        }}
                      >
                        {sc.latency_ms}ms
                      </span>
                    )}
                    <StatusBadge status={sc.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link to incident history */}
        <div style={{ marginTop: 48 }}>
          <Link
            href={`/services/${slug}/incidents`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--accent)",
              textDecoration: "none",
              borderBottom: "1px solid var(--accent-line)",
              paddingBottom: 2,
            }}
          >
            View incident history →
          </Link>
        </div>
      </div>
    </div>
  );
}
