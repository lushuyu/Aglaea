"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminListAuditLog } from "@/lib/api";
import { fmtSGT } from "@/lib/fmt";

const PAGE_SIZE = 50;

export default function AdminAuditLogPage() {
  const [offset, setOffset] = useState(0);
  const [eventFilter, setEventFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", offset, eventFilter],
    queryFn: () =>
      adminListAuditLog({
        limit: PAGE_SIZE,
        offset,
        event: eventFilter || undefined,
      }),
    refetchInterval: 30_000,
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-h2">Audit log</h1>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--fg-3)",
          }}
        >
          {total} entries
        </span>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Filter by event type…"
          value={eventFilter}
          onChange={(e) => {
            setEventFilter(e.target.value);
            setOffset(0);
          }}
          style={{
            background: "var(--bg-0)",
            color: "var(--fg-0)",
            border: "1px solid var(--line-2)",
            borderRadius: "var(--radius)",
            padding: "6px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            width: 280,
          }}
        />
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

      {!isLoading && entries.length === 0 && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--fg-3)",
            padding: "32px 0",
          }}
        >
          No entries found.
        </div>
      )}

      {entries.length > 0 && (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time (SGT)</th>
                <th>Actor</th>
                <th>Event</th>
                <th>IP</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr key={i}>
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--fg-3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtSGT(new Date(entry.t))}
                  </td>
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color:
                        entry.actor_type === "user"
                          ? "var(--fg-1)"
                          : "var(--fg-3)",
                    }}
                  >
                    {entry.actor}
                  </td>
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--accent)",
                    }}
                  >
                    {entry.event}
                  </td>
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--fg-3)",
                    }}
                  >
                    {entry.ip}
                  </td>
                  <td>
                    <details>
                      <summary
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--fg-3)",
                          cursor: "pointer",
                        }}
                      >
                        view
                      </summary>
                      <div className="audit-details">
                        <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                marginTop: 20,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-3)",
              }}
            >
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                style={{
                  padding: "4px 12px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--radius)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  cursor: offset === 0 ? "default" : "pointer",
                  opacity: offset === 0 ? 0.5 : 1,
                  color: "var(--fg-1)",
                }}
              >
                ← prev
              </button>
              <span>
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                style={{
                  padding: "4px 12px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--radius)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  cursor:
                    offset + PAGE_SIZE >= total ? "default" : "pointer",
                  opacity: offset + PAGE_SIZE >= total ? 0.5 : 1,
                  color: "var(--fg-1)",
                }}
              >
                next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
