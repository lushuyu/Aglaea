"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { adminListIncidents } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { fmtTime, fmtDuration } from "@/lib/fmt";

export default function AdminIncidentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-incidents"],
    queryFn: adminListIncidents,
    refetchInterval: 30_000,
  });

  const incidents = data?.incidents ?? [];

  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-h2">Incidents</h1>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            color: "var(--fg-3)",
          }}
        >
          {incidents.length} total
        </span>
      </div>

      {isLoading && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            color: "var(--fg-3)",
            padding: "32px 0",
          }}
        >
          Loading…
        </div>
      )}

      {!isLoading && incidents.length === 0 && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            color: "var(--fg-3)",
            padding: "32px 0",
          }}
        >
          No incidents recorded.
        </div>
      )}

      {incidents.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Service</th>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Affected</th>
              <th>Report</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((inc) => (
              <tr key={inc.id}>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 16,
                    color: "var(--fg-3)",
                  }}
                >
                  #{inc.id}
                </td>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 16,
                    color: "var(--fg-1)",
                  }}
                >
                  {inc.service_slug}
                </td>
                <td>
                  <StatusBadge
                    status={inc.status === "ongoing" ? "degraded" : "ok"}
                    size="sm"
                  />
                </td>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-3)",
                  }}
                >
                  {fmtTime(inc.started_at)}
                </td>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-3)",
                  }}
                >
                  {inc.resolved_at
                    ? fmtDuration(inc.started_at, inc.resolved_at)
                    : "—"}
                </td>
                <td
                  style={{
                    fontSize: 16,
                    color: "var(--fg-2)",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {inc.affected_subchecks.join(", ") || "—"}
                </td>
                <td>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color:
                        inc.report_state === "published"
                          ? "var(--ok)"
                          : inc.report_state === "draft"
                          ? "var(--accent)"
                          : inc.report_state === "rejected"
                          ? "var(--down)"
                          : "var(--fg-3)",
                    }}
                  >
                    {inc.report_state}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/admin/incidents/${inc.id}`}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--accent)",
                      textDecoration: "none",
                    }}
                  >
                    review →
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
