"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminCreateService } from "@/lib/api";
import type { CreateServicePayload, ServiceKind } from "@/types/api";

export default function AdminNewServicePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<CreateServicePayload>({
    display_name: "",
    slug: "",
    description: "",
    kind: "push",
    glyph: "default",
    expected_interval_seconds: 300,
    public_visible: true,
    deepseek_context: "",
  });

  const mutation = useMutation({
    mutationFn: adminCreateService,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      router.push("/admin/services");
    },
  });

  function slugify(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleNameChange(v: string) {
    setForm((f) => ({
      ...f,
      display_name: v,
      slug: f.slug || slugify(v),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(form);
  }

  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-h2">New service</h1>
      </div>

      <form onSubmit={handleSubmit} className="admin-section">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="display_name">Display name</label>
            <input
              id="display_name"
              type="text"
              value={form.display_name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="slug">Slug</label>
            <input
              id="slug"
              type="text"
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({ ...f, slug: e.target.value }))
              }
              pattern="[a-z0-9-]+"
              required
            />
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="description">Description</label>
            <input
              id="description"
              type="text"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>

          <div className="field">
            <label htmlFor="kind">Kind</label>
            <select
              id="kind"
              value={form.kind}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  kind: e.target.value as ServiceKind,
                }))
              }
            >
              <option value="push">push</option>
              <option value="pull">pull</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="glyph">Glyph</label>
            <select
              id="glyph"
              value={form.glyph ?? "default"}
              onChange={(e) =>
                setForm((f) => ({ ...f, glyph: e.target.value }))
              }
            >
              <option value="graces">graces</option>
              <option value="hyacinth">hyacinth</option>
              <option value="hydra">hydra</option>
              <option value="key">key</option>
              <option value="winged">winged</option>
              <option value="default">default</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="expected_interval">Expected interval (s)</label>
            <input
              id="expected_interval"
              type="number"
              min={10}
              value={form.expected_interval_seconds ?? 300}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  expected_interval_seconds: Number(e.target.value),
                }))
              }
            />
          </div>

          {form.kind === "pull" && (
            <>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="probe_url">Probe URL</label>
                <input
                  id="probe_url"
                  type="url"
                  value={form.probe_url ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, probe_url: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="probe_interval">Probe interval (s)</label>
                <input
                  id="probe_interval"
                  type="number"
                  min={10}
                  value={form.probe_interval_seconds ?? 60}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      probe_interval_seconds: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="probe_expected_status">
                  Expected HTTP status
                </label>
                <input
                  id="probe_expected_status"
                  type="number"
                  value={form.probe_expected_status ?? 200}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      probe_expected_status: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </>
          )}

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="deepseek_context">DeepSeek context</label>
            <textarea
              id="deepseek_context"
              rows={4}
              value={form.deepseek_context ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  deepseek_context: e.target.value,
                }))
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
            <label
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <input
                type="checkbox"
                checked={form.public_visible ?? true}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    public_visible: e.target.checked,
                  }))
                }
              />
              Public visible
            </label>
          </div>
        </div>

        {mutation.isError && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: "var(--down-soft)",
              border: "1px solid var(--down-line)",
              borderRadius: "var(--radius)",
              fontSize: 13,
              color: "var(--down)",
            }}
          >
            {(mutation.error as Error).message}
          </div>
        )}

        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <button
            type="submit"
            disabled={mutation.isPending}
            style={{
              padding: "10px 24px",
              background: "var(--accent)",
              color: "var(--bg-0)",
              border: "none",
              borderRadius: "var(--radius)",
              fontFamily: "var(--font-serif)",
              fontSize: 14,
              cursor: mutation.isPending ? "default" : "pointer",
              opacity: mutation.isPending ? 0.6 : 1,
            }}
          >
            {mutation.isPending ? "Creating…" : "Create service"}
          </button>
          <Link
            href="/admin/services"
            style={{
              fontSize: 13,
              color: "var(--fg-3)",
              textDecoration: "none",
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
