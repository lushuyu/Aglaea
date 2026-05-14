"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminGetIncident,
  adminPublishIncident,
  adminRejectIncident,
  adminRegenerateReport,
  adminAddIncidentUpdate,
  adminEditIncidentSummary,
} from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import MutationErrorBanner from "@/components/MutationErrorBanner";
import Swimlane from "@/components/Swimlane";
import DiffView from "@/components/DiffView";
import { fmtTime, fmtDuration, fmtSGT } from "@/lib/fmt";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { SwimlaneData, SwimlaneSegment, IncidentUpdate } from "@/types/api";

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
  // Regenerate burst-polling signals.
  // regenBaselineCount: report_generation_count at click time (drives refetchInterval).
  // regenPendingSince: timestamp (ms) when regen was triggered (30s safety cap).
  const [regenPendingSince, setRegenPendingSince] = useState<number | null>(null);
  const [regenBaselineCount, setRegenBaselineCount] = useState<number | null>(null);

  // Summary edit dialog state
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [summaryError, setSummaryError] = useState<Error | null>(null);

  // Add update form state
  const [updateText, setUpdateText] = useState("");
  const [updateError, setUpdateError] = useState<Error | null>(null);

  // Refs for refetchInterval closure (avoid stale captures)
  const regenBaselineCountRef = useRef<number | null>(null);
  const regenPendingSinceRef = useRef<number | null>(null);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["admin-incident", id],
    queryFn: () => adminGetIncident(id),
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 15_000;
      const baseline = regenBaselineCountRef.current;
      // If baseline has advanced (regenerate completed), stop burst polling
      if (baseline !== null && d.incident.report_generation_count > baseline) {
        return false;
      }
      // If we're inside the burst window, poll every 5s
      if (
        regenPendingSinceRef.current !== null &&
        Date.now() - regenPendingSinceRef.current < 30_000
      ) {
        return 5_000;
      }
      return 15_000;
    },
  });

  // Sync state into refs so the refetchInterval closure sees current values
  useEffect(() => {
    regenBaselineCountRef.current = regenBaselineCount;
  }, [regenBaselineCount]);

  useEffect(() => {
    regenPendingSinceRef.current = regenPendingSince;
  }, [regenPendingSince]);

  // Seed editor with draft text on first load
  useEffect(() => {
    if (data && !isDirty) {
      setEditedText(data.incident.report_text ?? "");
    }
  }, [data, isDirty]);

  // Close burst-poll window when count advances past baseline, or after 30s cap
  useEffect(() => {
    if (regenPendingSince === null) return;
    const currentCount = data?.incident.report_generation_count ?? null;
    const countAdvanced =
      regenBaselineCount !== null &&
      currentCount !== null &&
      currentCount > regenBaselineCount;
    if (countAdvanced) {
      setRegenPendingSince(null);
      setRegenBaselineCount(null);
      return;
    }
    const elapsed = Date.now() - regenPendingSince;
    const remaining = 30_000 - elapsed;
    if (remaining <= 0) {
      setRegenPendingSince(null);
      setRegenBaselineCount(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setRegenPendingSince(null);
      setRegenBaselineCount(null);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [regenPendingSince, regenBaselineCount, data]);

  const publishMutation = useMutation({
    mutationFn: () =>
      adminPublishIncident(id, { published_text: editedText }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["admin-incident", id] });
      const previous = queryClient.getQueryData(["admin-incident", id]);
      queryClient.setQueryData(["admin-incident", id], (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          incident: {
            ...old.incident,
            report_state: "published" as const,
            published_at: new Date().toISOString(),
          },
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin-incident", id], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "admin-incident" ||
          query.queryKey[0] === "public-active-incidents",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-incidents"] });
      setIsDirty(false);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => adminRejectIncident(id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["admin-incident", id] });
      const previous = queryClient.getQueryData(["admin-incident", id]);
      queryClient.setQueryData(["admin-incident", id], (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          incident: {
            ...old.incident,
            report_state: "rejected" as const,
          },
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin-incident", id], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "admin-incident" ||
          query.queryKey[0] === "public-active-incidents",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-incidents"] });
    },
  });

  const regenMutation = useMutation({
    mutationFn: () => {
      // Capture baselines BEFORE the request flies so refetchInterval detects completion
      const baseline = data?.incident.report_generation_count ?? null;
      setRegenBaselineCount(baseline);
      regenBaselineCountRef.current = baseline;
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
      // Open the burst-poll window
      const now = Date.now();
      setRegenPendingSince(now);
      regenPendingSinceRef.current = now;
    },
    onError: () => {
      setRegenBaselineCount(null);
      regenBaselineCountRef.current = null;
    },
  });

  const summaryMutation = useMutation({
    mutationFn: () =>
      adminEditIncidentSummary(Number(id), summaryDraft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-incident", id] });
      setSummaryDialogOpen(false);
      setSummaryError(null);
      toast.success("Summary updated");
    },
    onError: (err: Error) => {
      setSummaryError(err);
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: () =>
      adminAddIncidentUpdate(Number(id), { text: updateText }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "admin-incident" ||
          query.queryKey[0] === "public-active-incidents",
      });
      setUpdateText("");
      setUpdateError(null);
      toast.success("Update added");
    },
    onError: (err: Error) => {
      setUpdateError(err);
    },
  });

  const isRefreshing = regenMutation.isPending || isFetching;

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
          {isRefreshing && (
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

      <MutationErrorBanner
        error={publishMutation.isError ? (publishMutation.error as Error) : null}
      />
      <MutationErrorBanner
        error={rejectMutation.isError ? (rejectMutation.error as Error) : null}
      />
      <MutationErrorBanner
        error={regenMutation.isError ? (regenMutation.error as Error) : null}
      />

      {/* Summary block */}
      <div
        style={{
          marginBottom: 24,
          padding: "16px 20px",
          background: "var(--bg-1)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--radius)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 15,
              fontWeight: 500,
              color: "var(--fg-1)",
              margin: 0,
            }}
          >
            Summary
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSummaryDraft(incident.summary ?? "");
              setSummaryError(null);
              setSummaryDialogOpen(true);
            }}
          >
            Edit summary
          </Button>
        </div>
        {incident.summary ? (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--fg-1)",
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
            }}
          >
            {incident.summary}
          </p>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--fg-3)",
              fontFamily: "var(--font-mono)",
            }}
          >
            No summary yet. Add one to display it on the public incident page.
          </p>
        )}
        <div style={{ marginTop: 10 }}>
          <StatusBadge lifecycle={incident.lifecycle_state} size="sm" />
        </div>
      </div>

      {/* Updates timeline */}
      <div
        style={{
          marginBottom: 24,
          padding: "16px 20px",
          background: "var(--bg-1)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--radius)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--fg-1)",
            margin: "0 0 14px 0",
          }}
        >
          Updates
        </h3>

        {/* Existing updates list (reverse-chrono from backend) */}
        {incident.updates.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            {incident.updates.map((upd: IncidentUpdate) => {
              const absTime = new Date(upd.t).toLocaleString();
              const relTime = formatDistanceToNow(new Date(upd.t), {
                addSuffix: true,
              });
              const kindStyles: Record<
                IncidentUpdate["kind"],
                { background: string; color: string; border: string }
              > = {
                state_transition: {
                  background:
                    "color-mix(in oklch, var(--info, #3b82f6) 12%, transparent)",
                  color: "var(--info, #2563eb)",
                  border:
                    "1px solid color-mix(in oklch, var(--info, #3b82f6) 28%, transparent)",
                },
                summary_update: {
                  background: "var(--bg-2)",
                  color: "var(--fg-3)",
                  border: "1px solid var(--line-2)",
                },
                manual: {
                  background:
                    "color-mix(in oklch, var(--accent) 12%, transparent)",
                  color: "var(--accent)",
                  border: "1px solid var(--accent-line)",
                },
              };
              return (
                <div
                  key={upd.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    paddingBottom: 12,
                    marginBottom: 12,
                    borderBottom: "1px solid var(--line-1)",
                  }}
                >
                  <span
                    title={absTime}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--fg-3)",
                      whiteSpace: "nowrap",
                      minWidth: 110,
                      paddingTop: 2,
                    }}
                  >
                    {relTime}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      padding: "2px 7px",
                      borderRadius: 999,
                      whiteSpace: "nowrap",
                      alignSelf: "flex-start",
                      paddingTop: 3,
                      ...kindStyles[upd.kind],
                    }}
                  >
                    {upd.kind.replace("_", " ")}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: "var(--fg-1)",
                      lineHeight: 1.55,
                    }}
                  >
                    {upd.text ??
                      (upd.kind === "state_transition"
                        ? "(state transition)"
                        : "(no text)")}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p
            style={{
              margin: "0 0 16px 0",
              fontSize: 12,
              color: "var(--fg-3)",
              fontFamily: "var(--font-mono)",
            }}
          >
            No updates yet.
          </p>
        )}

        {/* Add manual update form */}
        <div
          style={{
            borderTop: "1px solid var(--line-2)",
            paddingTop: 14,
          }}
        >
          <MutationErrorBanner
            error={updateError}
            onDismiss={() => setUpdateError(null)}
          />
          <Textarea
            placeholder="Write a status update…"
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            style={{ minHeight: 80, marginBottom: 10 }}
          />
          <Button
            variant="default"
            size="sm"
            disabled={!updateText.trim() || addUpdateMutation.isPending}
            onClick={() => addUpdateMutation.mutate()}
          >
            {addUpdateMutation.isPending ? "Adding…" : "Add update"}
          </Button>
        </div>
      </div>

      {/* Summary edit dialog */}
      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit summary</DialogTitle>
          </DialogHeader>
          <MutationErrorBanner
            error={summaryError}
            onDismiss={() => setSummaryError(null)}
          />
          <Textarea
            value={summaryDraft}
            onChange={(e) => setSummaryDraft(e.target.value)}
            placeholder="Plain-text summary of the incident…"
            style={{ minHeight: 120 }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSummaryDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={summaryMutation.isPending}
              onClick={() => summaryMutation.mutate()}
            >
              {summaryMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
