"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { adminListServices } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import ServiceGlyph from "@/components/ServiceGlyph";
import { fmtTime } from "@/lib/fmt";

export default function AdminServicesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: adminListServices,
    refetchInterval: 60_000,
  });

  const services = data?.services ?? [];

  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-h2">Services</h1>
        <Link
          href="/admin/services/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: "var(--accent)",
            color: "var(--bg-0)",
            borderRadius: "var(--radius)",
            fontFamily: "var(--font-serif)",
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          + New service
        </Link>
      </div>

      {isLoading && (
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
      )}

      {!isLoading && services.length === 0 && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--fg-3)",
            padding: "32px 0",
          }}
        >
          No services configured.
        </div>
      )}

      {services.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Kind</th>
              <th>Status</th>
              <th>Last heartbeat</th>
              <th>Uptime 30d</th>
              <th>Public</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => (
              <tr key={svc.slug}>
                <td>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <ServiceGlyph kind={svc.glyph} size={24} />
                    <div>
                      <div
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: 14,
                          color: "var(--fg-0)",
                        }}
                      >
                        {svc.display_name}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--fg-3)",
                        }}
                      >
                        {svc.slug}
                      </div>
                    </div>
                  </div>
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
                <td>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: svc.public_visible
                        ? "var(--ok)"
                        : "var(--fg-3)",
                    }}
                  >
                    {svc.public_visible ? "yes" : "no"}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/admin/services/${svc.slug}`}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--accent)",
                      textDecoration: "none",
                    }}
                  >
                    edit →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
