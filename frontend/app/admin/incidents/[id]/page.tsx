"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminGetIncident,
  adminPublishIncident,
  adminRejectIncident,
  adminRegenerateReport,
} from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import Swimlane from "@/components/Swimlane";
import DiffView from "@/components/DiffView";
import { fmtTime, fmtDuration, fmtSGT } from "@/lib/fmt";
import type { SwimlaneData, SwimlaneSegment } from "@/types/api";

type Tab = "report" | "timeline" | "diff" | "raw";

export default function AdminIncidentReviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("report");
  const [editedText, setEditedText] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [regenInstruction, setRegenInstruction] = useState("");
  const [showRegenInput, setShowRegenInput] = useState(false);
  // Regenerate burst-polling state. When regenerate is queued, we track:
  //  - regenPendingSince: timestamp (ms) of the regen request (null when not pending).
  //  - regenBaselineCount: report_generation_count captured at click time.
  //  - regenBaselineText: report_text captured at click time (fallback signal).
  // Burst window terminates when count increments past baseline, OR text changes
  // (fallback), OR 30s safety cap elapses.
  const [regenPendingSince, setRegenPendingSince] = useState<number | null>(
    null
  );
  const [regenBaselineCount, setRegenBaselineCount] = useState<number | null>(
    null
  );
  const [regenBaselineText, setRegenBaselineText] = useState<string | null>(
    null
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-incident", id],
    queryFn: () => adminGetIncident(id),
    refetchInterval: regenPendingSince !== null ? 5_000 : 15_000,
  });

  // Seed editor with draft text on first load
  useEffect(() => {
    if (data && !isDirty) {
      setEditedText(data.incident.report_text ?? "");
    }
  }, [data, isDirty]);

  const publishMutation = useMutation({
    mutationFn: () =>
      adminPublishIncident(id, { published_text: editedText }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin-incident", id],
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-incidents"] });
      setIsDirty(false);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => adminRejectIncident(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin-incident", id],
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-incidents"] });
    },
  });

  const regenMutation = useMutation({
    mutationFn: () => {
      // Capture baselines BEFORE the request flies so the burst-poll can
      // detect when the worker's new draft lands.
      setRegenBaselineCount(data?.incident.report_generation_count ?? null);
      setRegenBaselineText(data?.incident.report_text ?? null);
      return adminRegenerateReport(id, {
        instruction: regenInstruction || undefined,
      });
    },
    onSuccess: (resp) => {
      void queryClient.invalidateQueries({
        queryKey: ["admin-incident", id],
      });
      setEditedText(resp.incident.report_text ?? "");
      setIsDirty(false);
      setRegenInstruction("");
      // Open the burst-poll window. Dialog stays mounted so the chip is visible.
      setRegenPendingSince(Date.now());
    },
    onError: () => {
      // Keep the dialog open so the user can read the error and retry.
      // No baseline cleanup needed — regenPendingSince is still null.
      setRegenBaselineCount(null);
      setRegenBaselineText(null);
    },
  });

  // Close the burst-poll window once the worker's new draft is observable, or
  // after the 30s safety cap elapses (covers the silent-DeepSeek-failure case).
  useEffect(() => {
    if (regenPendingSince === null) return;
    const currentCount = data?.incident.report_generation_count ?? null;
    const currentText = data?.incident.report_text ?? null;
    const countAdvanced =
      regenBaselineCount !== null &&
      currentCount !== null &&
      currentCount > regenBaselineCount;
    const textChanged =
      regenBaselineText !== null &&
      currentText !== null &&
      currentText !== regenBaselineText;
    if (countAdvanced || textChanged) {
      setRegenPendingSince(null);
      setRegenBaselineCount(null);
      setRegenBaselineText(null);
      return;
    }
    const elapsed = Date.now() - regenPendingSince;
    const remaining = 30_000 - elapsed;
    if (remaining <= 0) {
      setRegenPendingSince(null);
      setRegenBaselineCount(null);
      setRegenBaselineText(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setRegenPendingSince(null);
      setRegenBaselineCount(null);
      setRegenBaselineText(null);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [regenPendingSince, regenBaselineCount, regenBaselineText, data]);

  const regenChipVisible =
    regenMutation.isPending || regenPendingSince !== null;

  if (isLoading) {
    return (
      <div className="admin-page">
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
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-page">
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--down)",
            padding: "32px 0",
          }}
        >
          Failed to load incident.
        </div>
      </div>
    );
  }

  const { incident, timeline, heartbeats, similar } = data;

  // Build swimlane from timeline
  const laneMap = new Map<string, SwimlaneSegment[]>();
  const sortedEvents = [...timeline].sort(
    (a, b) => +new Date(a.t) - +new Date(b.t)
  );
  for (const ev of sortedEvents) {
    if (!laneMap.has(ev.sub)) laneMap.set(ev.sub, []);
  }
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

  const reportState = incident.report_state;
  const canPublish =
    (reportState === "draft" || reportState === "none") &&
    !!editedText.trim() &&
    editedText.trim() !== (incident.published_text ?? "").trim();
  const canReject = reportState === "draft" || reportState === "none";
  const canRegen = true;

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="ir-header">
        <div>
          <h1 className="admin-h2" style={{ marginBottom: 6 }}>
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
              className="ir-status-pill"
              data-state={reportState}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 999,
                background:
                  reportState === "published"
                    ? "var(--ok-soft)"
                    : reportState === "draft"
                    ? "color-mix(in oklch, var(--accent) 12%, transparent)"
                    : reportState === "rejected"
                    ? "var(--down-soft)"
                    : "var(--bg-2)",
                color:
                  reportState === "published"
                    ? "var(--ok)"
                    : reportState === "draft"
                    ? "var(--accent)"
                    : reportState === "rejected"
                    ? "var(--down)"
                    : "var(--fg-3)",
                border:
                  reportState === "published"
                    ? "1px solid var(--ok-line)"
                    : reportState === "draft"
                    ? "1px solid var(--accent-line)"
                    : reportState === "rejected"
                    ? "1px solid var(--down-line)"
                    : "1px solid var(--line-2)",
              }}
            >
              {reportState}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-3)",
              }}
            >
              {incident.service_slug} ·{" "}
              {fmtTime(incident.started_at)}
              {incident.resolved_at &&
                ` · ${fmtDuration(incident.started_at, incident.resolved_at)}`}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => setShowRegenInput((v) => !v)}
            style={{
              padding: "8px 16px",
              background: "var(--bg-2)",
              color: "var(--fg-1)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ↺ Regenerate
          </button>
          {canReject && (
            <button
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              style={{
                padding: "8px 16px",
                background: "var(--down-soft)",
                color: "var(--down)",
                border: "1px solid var(--down-line)",
                borderRadius: "var(--radius)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                cursor: rejectMutation.isPending ? "default" : "pointer",
                opacity: rejectMutation.isPending ? 0.6 : 1,
              }}
            >
              {rejectMutation.isPending ? "Rejecting…" : "Reject"}
            </button>
          )}
          <button
            onClick={() => publishMutation.mutate()}
            disabled={!canPublish || publishMutation.isPending}
            style={{
              padding: "8px 20px",
              background: "var(--accent)",
              color: "var(--bg-0)",
              border: "none",
              borderRadius: "var(--radius)",
              fontFamily: "var(--font-serif)",
              fontSize: 14,
              cursor: !canPublish || publishMutation.isPending ? "default" : "pointer",
              opacity: !canPublish || publishMutation.isPending ? 0.6 : 1,
            }}
          >
            {publishMutation.isPending ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {/* Regen input */}
      {showRegenInput && (
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 16,
            padding: "12px 16px",
            background: "var(--bg-1)",
            border: "1px solid var(--line-2)",
            borderRadius: "var(--radius)",
          }}
        >
          <input
            type="text"
            placeholder="Instruction (optional) — e.g., 'focus on the moomoo subcheck timeline'"
            value={regenInstruction}
            onChange={(e) => setRegenInstruction(e.target.value)}
            style={{
              flex: 1,
              background: "var(--bg-0)",
              color: "var(--fg-0)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius)",
              padding: "6px 10px",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          />
          <button
            onClick={() => regenMutation.mutate()}
            disabled={regenMutation.isPending}
            style={{
              padding: "6px 16px",
              background: "var(--accent)",
              color: "var(--bg-0)",
              border: "none",
              borderRadius: "var(--radius)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              cursor: regenMutation.isPending ? "default" : "pointer",
              opacity: regenMutation.isPending ? 0.6 : 1,
            }}
          >
            {regenMutation.isPending ? "Generating…" : "Generate"}
          </button>
          {regenChipVisible && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--accent)",
                padding: "3px 10px",
                borderRadius: 999,
                background: "color-mix(in oklch, var(--accent) 12%, transparent)",
                border: "1px solid var(--accent-line)",
                whiteSpace: "nowrap",
              }}
            >
              Queued — refreshing
            </span>
          )}
        </div>
      )}

      {(publishMutation.isError || rejectMutation.isError) && (
        <div
          style={{
            marginBottom: 16,
            padding: "8px 12px",
            background: "var(--down-soft)",
            border: "1px solid var(--down-line)",
            borderRadius: "var(--radius)",
            fontSize: 12,
            color: "var(--down)",
          }}
        >
          {((publishMutation.error ?? rejectMutation.error) as Error).message}
        </div>
      )}

      {regenMutation.isError && (
        <div
          style={{
            marginBottom: 16,
            padding: "8px 12px",
            background: "var(--down-soft)",
            border: "1px solid var(--down-line)",
            borderRadius: "var(--radius)",
            fontSize: 12,
            color: "var(--down)",
          }}
        >
          Regenerate failed: {(regenMutation.error as Error).message}
        </div>
      )}

      {/* Two-column layout */}
      <div className="ir-grid">
        {/* Left: editor pane */}
        <div className="ir-left">
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: 4,
              borderBottom: "1px solid var(--line-2)",
              marginBottom: 16,
            }}
          >
            {(["report", "timeline", "diff", "raw"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`ir-tab${activeTab === t ? " on" : ""}`}
                style={{
                  padding: "8px 14px",
                  background: "none",
                  border: "none",
                  borderBottom:
                    activeTab === t
                      ? "2px solid var(--accent)"
                      : "2px solid transparent",
                  marginBottom: -1,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: activeTab === t ? "var(--fg-0)" : "var(--fg-3)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {t}
                {t === "report" && isDirty && (
                  <span className="ir-dirty-dot" />
                )}
              </button>
            ))}
          </div>

          {/* Report editor */}
          {activeTab === "report" && (
            <div className="ir-editor-pane">
              {reportState === "published" ? (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "var(--ok-soft)",
                    border: "1px solid var(--ok-line)",
                    borderRadius: "var(--radius)",
                    marginBottom: 12,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--ok)",
                  }}
                >
                  Published {incident.published_at
                    ? fmtTime(incident.published_at)
                    : ""}{" "}
                  by {incident.published_by ?? "admin"}
                </div>
              ) : null}
              <textarea
                className="ir-textarea"
                value={editedText}
                onChange={(e) => {
                  setEditedText(e.target.value);
                  setIsDirty(
                    e.target.value !== (incident.report_text ?? "")
                  );
                }}
                placeholder={
                  reportState === "none"
                    ? "No report generated yet. Use Regenerate to create one."
                    : "Edit the incident report…"
                }
                style={{
                  width: "100%",
                  minHeight: 360,
                  background: "var(--bg-0)",
                  color: "var(--fg-0)",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--radius)",
                  padding: "12px 16px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: 1.7,
                  resize: "vertical",
                }}
              />
            </div>
          )}

          {/* Timeline tab */}
          {activeTab === "timeline" && (
            <div>
              {lanes.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <Swimlane lanes={lanes} />
                </div>
              )}
              <div className="timeline">
                {sortedEvents.map((ev, i) => (
                  <div key={i} className="timeline-row">
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--fg-3)",
                        minWidth: 90,
                      }}
                    >
                      {fmtTime(ev.t)}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--accent)",
                        minWidth: 90,
                      }}
                    >
                      {ev.sub}
                    </span>
                    <StatusBadge status={ev.status} size="sm" />
                    {ev.note && (
                      <span style={{ fontSize: 12, color: "var(--fg-2)" }}>
                        {ev.note}
                      </span>
                    )}
                  </div>
                ))}
                {sortedEvents.length === 0 && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--fg-3)",
                    }}
                  >
                    No timeline events
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Diff tab */}
          {activeTab === "diff" && (
            <DiffView
              before={incident.report_text ?? ""}
              after={editedText}
            />
          )}

          {/* Raw tab */}
          {activeTab === "raw" && (
            <pre
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-1)",
                background: "var(--bg-0)",
                border: "1px solid var(--line-2)",
                borderRadius: "var(--radius)",
                padding: "12px 16px",
                overflow: "auto",
                maxHeight: 480,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(
                { incident, timeline: sortedEvents.slice(0, 20) },
                null,
                2
              )}
            </pre>
          )}
        </div>

        {/* Right: meta card */}
        <div className="ir-right">
          <div className="ir-meta-card">
            <h3 className="admin-h4" style={{ marginBottom: 12 }}>
              Details
            </h3>
            <div className="ir-meta-row">
              <span style={{ color: "var(--fg-3)", fontSize: 12 }}>
                Service
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--fg-1)",
                }}
              >
                {incident.service_slug}
              </span>
            </div>
            <div className="ir-meta-row">
              <span style={{ color: "var(--fg-3)", fontSize: 12 }}>
                Started (SGT)
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--fg-1)",
                }}
              >
                {fmtSGT(new Date(incident.started_at))}
              </span>
            </div>
            {incident.resolved_at && (
              <div className="ir-meta-row">
                <span style={{ color: "var(--fg-3)", fontSize: 12 }}>
                  Duration
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--fg-1)",
                  }}
                >
                  {fmtDuration(incident.started_at, incident.resolved_at)}
                </span>
              </div>
            )}
            <div className="ir-meta-row">
              <span style={{ color: "var(--fg-3)", fontSize: 12 }}>
                Affected
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--fg-1)",
                  wordBreak: "break-word",
                }}
              >
                {incident.affected_subchecks.join(", ") || "—"}
              </span>
            </div>
            <div className="ir-meta-row">
              <span style={{ color: "var(--fg-3)", fontSize: 12 }}>
                Regen count
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--fg-1)",
                }}
              >
                {incident.report_generation_count}
              </span>
            </div>
            {incident.report_generation_reason && (
              <div className="ir-meta-row" style={{ flexDirection: "column", gap: 4 }}>
                <span style={{ color: "var(--fg-3)", fontSize: 12 }}>
                  Regen reason
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-2)",
                  }}
                >
                  {incident.report_generation_reason}
                </span>
              </div>
            )}
            {incident.report_generated_at && (
              <div className="ir-meta-row">
                <span style={{ color: "var(--fg-3)", fontSize: 12 }}>
                  Generated
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-3)",
                  }}
                >
                  {fmtTime(incident.report_generated_at)}
                </span>
              </div>
            )}
          </div>

          {/* Similar incidents */}
          {similar.length > 0 && (
            <div className="ir-meta-card" style={{ marginTop: 16 }}>
              <h3 className="admin-h4" style={{ marginBottom: 12 }}>
                Similar
              </h3>
              {similar.map((s) => (
                <a
                  key={s.id}
                  href={`/admin/incidents/${s.id}`}
                  className="similar-row"
                  style={{
                    display: "block",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--line-1)",
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--accent)",
                      }}
                    >
                      #{s.id}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--fg-3)",
                      }}
                    >
                      {s.duration_min}m
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--fg-2)" }}>
                    {s.summary}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
