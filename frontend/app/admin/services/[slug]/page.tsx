"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminGetService,
  adminUpdateService,
  adminDeleteService,
  adminCreateApiKey,
  adminRevokeApiKey,
} from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import HeartbeatStrip from "@/components/HeartbeatStrip";
import { fmtTime } from "@/lib/fmt";
import type { ServiceKind } from "@/types/api";

export default function AdminServiceDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const queryClient = useQueryClient();
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-service", slug],
    queryFn: () => adminGetService(slug),
    refetchInterval: 30_000,
  });

  const [form, setForm] = useState<{
    display_name: string;
    description: string;
    kind: ServiceKind;
    glyph: string;
    expected_interval_seconds: number;
    probe_url: string;
    probe_interval_seconds: number;
    probe_expected_status: number;
    public_visible: boolean;
    deepseek_context: string;
  } | null>(null);

  // Populate form once when data first arrives
  useEffect(() => {
    if (data && !form) {
      const svc = data.service;
      setForm({
        display_name: svc.display_name,
        description: svc.description,
        kind: svc.kind,
        glyph: svc.glyph,
        expected_interval_seconds: svc.expected_interval_seconds,
        probe_url: svc.probe_url ?? "",
        probe_interval_seconds: svc.probe_interval_seconds ?? 60,
        probe_expected_status: svc.probe_expected_status ?? 200,
        public_visible: svc.public_visible,
        deepseek_context: svc.deepseek_context ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminUpdateService>[1]) =>
      adminUpdateService(slug, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-service", slug] });
      void queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: () => adminCreateApiKey(slug, { label: newKeyLabel }),
    onSuccess: (resp) => {
      setNewKeyPlaintext(resp.plaintext);
      setNewKeyLabel("");
      void queryClient.invalidateQueries({ queryKey: ["admin-service", slug] });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: string) => adminRevokeApiKey(slug, keyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-service", slug] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminDeleteService(slug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      router.push("/admin/services");
    },
  });

  function handleDelete() {
    if (
      window.confirm(
        `Delete service "${slug}"? This removes all heartbeats, incidents, and API keys. This cannot be undone.`
      )
    ) {
      deleteMutation.mutate();
    }
  }

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
          Failed to load service.
        </div>
      </div>
    );
  }

  const { service: svc, api_keys, incidents } = data;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    updateMutation.mutate(form);
  }

  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-h2">{svc.display_name}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <StatusBadge status={svc.last_status ?? "unknown"} />
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            style={{
              padding: "6px 14px",
              background: "transparent",
              color: "var(--down)",
              border: "1px solid var(--down)",
              borderRadius: "var(--radius)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              cursor: deleteMutation.isPending ? "default" : "pointer",
              opacity: deleteMutation.isPending ? 0.5 : 1,
            }}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete service"}
          </button>
        </div>
      </div>

      {/* Heartbeat strip */}
      {svc.heartbeats && svc.heartbeats.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <HeartbeatStrip points={svc.heartbeats} w={680} h={28} />
        </div>
      )}

      {/* Edit form */}
      {form && (
        <form onSubmit={handleSave} className="admin-section">
          <h2 className="admin-h3" style={{ marginBottom: 16 }}>
            Configuration
          </h2>
          <div className="form-grid">
            <div className="field">
              <label>Display name</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) =>
                  setForm((f) => f && { ...f, display_name: e.target.value })
                }
                required
              />
            </div>
            <div className="field">
              <label>Kind</label>
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm(
                    (f) => f && { ...f, kind: e.target.value as ServiceKind }
                  )
                }
              >
                <option value="push">push</option>
                <option value="pull">pull</option>
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => f && { ...f, description: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>Expected interval (s)</label>
              <input
                type="number"
                min={10}
                value={form.expected_interval_seconds}
                onChange={(e) =>
                  setForm(
                    (f) =>
                      f && {
                        ...f,
                        expected_interval_seconds: Number(e.target.value),
                      }
                  )
                }
              />
            </div>
            {form.kind === "pull" && (
              <>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Probe URL</label>
                  <input
                    type="url"
                    value={form.probe_url}
                    onChange={(e) =>
                      setForm(
                        (f) => f && { ...f, probe_url: e.target.value }
                      )
                    }
                  />
                </div>
                <div className="field">
                  <label>Probe interval (s)</label>
                  <input
                    type="number"
                    min={10}
                    value={form.probe_interval_seconds}
                    onChange={(e) =>
                      setForm(
                        (f) =>
                          f && {
                            ...f,
                            probe_interval_seconds: Number(e.target.value),
                          }
                      )
                    }
                  />
                </div>
                <div className="field">
                  <label>Expected HTTP status</label>
                  <input
                    type="number"
                    value={form.probe_expected_status}
                    onChange={(e) =>
                      setForm(
                        (f) =>
                          f && {
                            ...f,
                            probe_expected_status: Number(e.target.value),
                          }
                      )
                    }
                  />
                </div>
              </>
            )}
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>DeepSeek context</label>
              <textarea
                rows={4}
                value={form.deepseek_context}
                onChange={(e) =>
                  setForm(
                    (f) => f && { ...f, deepseek_context: e.target.value }
                  )
                }
                style={{
                  width: "100%",
                  background: "var(--bg-0)",
                  color: "var(--fg-0)",
                  border: "1px solid var(--line-2)",
                  borderRadius: "var(--radius)",
                  padding: "8px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  resize: "vertical",
                }}
              />
            </div>
            <div className="field">
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={form.public_visible}
                  onChange={(e) =>
                    setForm(
                      (f) => f && { ...f, public_visible: e.target.checked }
                    )
                  }
                />
                Public visible
              </label>
            </div>
          </div>

          {updateMutation.isError && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "var(--down-soft)",
                border: "1px solid var(--down-line)",
                borderRadius: "var(--radius)",
                fontSize: 12,
                color: "var(--down)",
              }}
            >
              {(updateMutation.error as Error).message}
            </div>
          )}
          {updateMutation.isSuccess && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "var(--ok-soft)",
                border: "1px solid var(--ok-line)",
                borderRadius: "var(--radius)",
                fontSize: 12,
                color: "var(--ok)",
              }}
            >
              Saved.
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              style={{
                padding: "8px 20px",
                background: "var(--accent)",
                color: "var(--bg-0)",
                border: "none",
                borderRadius: "var(--radius)",
                fontFamily: "var(--font-serif)",
                fontSize: 14,
                cursor: updateMutation.isPending ? "default" : "pointer",
                opacity: updateMutation.isPending ? 0.6 : 1,
              }}
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* API Keys */}
      <div className="admin-section" style={{ marginTop: 40 }}>
        <h2 className="admin-h3" style={{ marginBottom: 16 }}>
          API keys
        </h2>

        {newKeyPlaintext && (
          <div style={{ marginBottom: 16 }}>
            <div className="warn-banner" style={{ marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--degraded)",
                }}
              >
                Save this key — it will not be shown again.
              </span>
            </div>
            <div className="key-display">{newKeyPlaintext}</div>
            <button
              onClick={() => setNewKeyPlaintext(null)}
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "var(--fg-3)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Prefix</th>
              <th>Created</th>
              <th>Last used</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {api_keys.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--fg-3)",
                  }}
                >
                  No keys
                </td>
              </tr>
            )}
            {api_keys.map((key) => (
              <tr
                key={key.id}
                style={{ opacity: key.revoked_at ? 0.5 : 1 }}
              >
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {key.label}
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  {key.prefix}…
                </td>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-3)",
                  }}
                >
                  {fmtTime(key.created_at)}
                </td>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--fg-3)",
                  }}
                >
                  {key.last_used_at ? fmtTime(key.last_used_at) : "—"}
                </td>
                <td>
                  {!key.revoked_at && (
                    <button
                      onClick={() => revokeKeyMutation.mutate(key.id)}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--down)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="Key label"
            value={newKeyLabel}
            onChange={(e) => setNewKeyLabel(e.target.value)}
            style={{
              background: "var(--bg-0)",
              color: "var(--fg-0)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius)",
              padding: "6px 10px",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              width: 200,
            }}
          />
          <button
            onClick={() => createKeyMutation.mutate()}
            disabled={!newKeyLabel || createKeyMutation.isPending}
            style={{
              padding: "6px 16px",
              background: "var(--accent)",
              color: "var(--bg-0)",
              border: "none",
              borderRadius: "var(--radius)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              cursor:
                !newKeyLabel || createKeyMutation.isPending
                  ? "default"
                  : "pointer",
              opacity: !newKeyLabel || createKeyMutation.isPending ? 0.6 : 1,
            }}
          >
            {createKeyMutation.isPending ? "Creating…" : "Create key"}
          </button>
        </div>
      </div>

      {/* Recent incidents */}
      {incidents.length > 0 && (
        <div className="admin-section" style={{ marginTop: 40 }}>
          <h2 className="admin-h3" style={{ marginBottom: 12 }}>
            Recent incidents
          </h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Started</th>
                <th>Report</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {incidents.slice(0, 10).map((inc) => (
                <tr key={inc.id}>
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--fg-3)",
                    }}
                  >
                    #{inc.id}
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
                      color:
                        inc.report_state === "published"
                          ? "var(--ok)"
                          : inc.report_state === "draft"
                          ? "var(--accent)"
                          : "var(--fg-3)",
                    }}
                  >
                    {inc.report_state}
                  </td>
                  <td>
                    <a
                      href={`/admin/incidents/${inc.id}`}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--accent)",
                        textDecoration: "none",
                      }}
                    >
                      review →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
