"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { adminListServices, adminListIncidents } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { fmtTime, fmtSGT } from "@/lib/fmt";

export default function AdminDashboard() {
  const { data: svcData, isLoading: svcLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: adminListServices,
    refetchInterval: 30_000,
  });

  const { data: incData, isLoading: incLoading } = useQuery({
    queryKey: ["admin-incidents"],
    queryFn: adminListIncidents,
    refetchInterval: 30_000,
  });

  const services = svcData?.services ?? [];
  const incidents = incData?.incidents ?? [];

  const downCount = services.filter((s) => s.last_status === "down").length;
  const degradedCount = services.filter(
    (s) => s.last_status === "degraded"
  ).length;
  const ongoingCount = incidents.filter((i) => i.status === "ongoing").length;
  const pendingReview = incidents.filter(
    (i) => i.report_state === "draft"
  ).length;

  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-h2">Dashboard</h1>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--fg-3)",
          }}
        >
          {fmtSGT()} SGT
        </span>
      </div>

      {/* Glance row */}
      <div className="glance-row" style={{ marginBottom: 40 }}>
        <div className="glance-tile">
          <div className="glance-value">{services.length}</div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Services</div>
        </div>
        <div className="glance-tile">
          <div
            className="glance-value"
            style={{ color: downCount > 0 ? "var(--down)" : undefined }}
          >
            {downCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Down</div>
        </div>
        <div className="glance-tile">
          <div
            className="glance-value"
            style={{
              color: degradedCount > 0 ? "var(--degraded)" : undefined,
            }}
          >
            {degradedCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Degraded</div>
        </div>
        <div className="glance-tile">
          <div
            className="glance-value"
            style={{ color: ongoingCount > 0 ? "var(--degraded)" : undefined }}
          >
            {ongoingCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Ongoing</div>
        </div>
        <div className="glance-tile">
          <div
            className="glance-value"
            style={{ color: pendingReview > 0 ? "var(--accent)" : undefined }}
          >
            {pendingReview}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
            Pending review
          </div>
        </div>
      </div>

      <div className="dash-grid">
        {/* Active incidents */}
        <div className="admin-section">
          <div className="section-hd" style={{ marginBottom: 12 }}>
            <span className="admin-h3">Active incidents</span>
            <Link
              href="/admin/incidents"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--accent)",
                textDecoration: "none",
              }}
            >
              all →
            </Link>
          </div>
          {incLoading && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-3)",
                padding: "16px 0",
              }}
            >
              Loading…
            </div>
          )}
          {!incLoading && ongoingCount === 0 && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-3)",
                padding: "16px 0",
              }}
            >
              No active incidents
            </div>
          )}
          {incidents
            .filter((i) => i.status === "ongoing")
            .map((inc) => (
              <Link
                key={inc.id}
                href={`/admin/incidents/${inc.id}`}
                className="admin-incident-card"
                style={{ textDecoration: "none", display: "block" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--fg-3)",
                    }}
                  >
                    #{inc.id} · {inc.service_slug}
                  </span>
                  <StatusBadge status="degraded" size="sm" />
                </div>
                <div style={{ fontSize: 13, color: "var(--fg-1)" }}>
                  {inc.affected_subchecks.join(", ") || "All subchecks"}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-3)",
                    marginTop: 4,
                  }}
                >
                  since {fmtTime(inc.started_at)}
                </div>
              </Link>
            ))}
        </div>

        {/* Pending reports */}
        <div className="admin-section">
          <div className="section-hd" style={{ marginBottom: 12 }}>
            <span className="admin-h3">Pending review</span>
          </div>
          {!incLoading && pendingReview === 0 && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-3)",
                padding: "16px 0",
              }}
            >
              No drafts pending
            </div>
          )}
          {incidents
            .filter((i) => i.report_state === "draft")
            .slice(0, 8)
            .map((inc) => (
              <Link
                key={inc.id}
                href={`/admin/incidents/${inc.id}`}
                className="admin-draft-row"
                style={{
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 4px",
                  borderBottom: "1px solid var(--line-1)",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--fg-1)" }}>
                  #{inc.id} · {inc.service_slug}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--accent)",
                  }}
                >
                  draft
                </span>
              </Link>
            ))}
        </div>
      </div>

      {/* Services overview */}
      <div className="admin-section" style={{ marginTop: 40 }}>
        <div className="section-hd" style={{ marginBottom: 12 }}>
          <span className="admin-h3">Services</span>
          <Link
            href="/admin/services"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--accent)",
              textDecoration: "none",
            }}
          >
            manage →
          </Link>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Kind</th>
              <th>Status</th>
              <th>Last heartbeat</th>
              <th>Uptime 30d</th>
            </tr>
          </thead>
          <tbody>
            {svcLoading && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--fg-3)",
                  }}
                >
                  Loading…
                </td>
              </tr>
            )}
            {services.map((svc) => (
              <tr key={svc.slug}>
                <td>
                  <Link
                    href={`/admin/services/${svc.slug}`}
                    style={{
                      color: "var(--fg-0)",
                      textDecoration: "none",
                      fontFamily: "var(--font-serif)",
                    }}
                  >
                    {svc.display_name}
                  </Link>
                </td>
                <td>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--fg-3)",
                    }}
                  >
                    {svc.kind}
                  </span>
                </td>
                <td>
                  <StatusBadge status={svc.last_status ?? "unknown"} size="sm" />
                </td>
                <td>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--fg-3)",
                    }}
                  >
                    {fmtTime(svc.last_heartbeat_at)}
                  </span>
                </td>
                <td>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--fg-1)",
                    }}
                  >
                    {(svc.uptime_30d_pct ?? 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
