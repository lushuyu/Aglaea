"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminCreateService } from "@/lib/api";
import { serviceCreateSchema, type ServiceCreateValues } from "@/lib/schemas/service";
import type { CreateServicePayload, ServiceKind } from "@/types/api";

// Extra fields not covered by the core zod schema
type ExtraFields = {
  description: string;
  kind: ServiceKind;
  glyph: string;
  deepseek_context: string;
  probe_url: string;
  probe_interval_seconds: number;
  probe_expected_status: number;
};

export default function AdminNewServicePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ServiceCreateValues>({
    resolver: zodResolver(serviceCreateSchema),
    defaultValues: {
      slug: "",
      display_name: "",
      public_visible: true,
      expected_interval_seconds: 300,
    },
  });

  // Extra fields outside the zod schema (kind, glyph, etc.)
  const [extra, setExtra] = useState<ExtraFields>({
    description: "",
    kind: "push",
    glyph: "default",
    deepseek_context: "",
    probe_url: "",
    probe_interval_seconds: 60,
    probe_expected_status: 200,
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

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue("display_name", v, { shouldValidate: true });
    // Auto-fill slug only if user hasn't typed one yet
    const currentSlug = watch("slug");
    if (!currentSlug) {
      setValue("slug", slugify(v), { shouldValidate: false });
    }
  }

  function onValid(values: ServiceCreateValues) {
    const payload: CreateServicePayload = {
      display_name: values.display_name,
      slug: values.slug,
      public_visible: values.public_visible,
      expected_interval_seconds: values.expected_interval_seconds,
      description: extra.description,
      kind: extra.kind,
      glyph: extra.glyph,
      deepseek_context: extra.deepseek_context,
      ...(extra.kind === "pull"
        ? {
            probe_url: extra.probe_url,
            probe_interval_seconds: extra.probe_interval_seconds,
            probe_expected_status: extra.probe_expected_status,
          }
        : {}),
    };
    mutation.mutate(payload);
  }

  return (
    <div className="admin-page">
      <div className="admin-page-hd">
        <h1 className="admin-h2">New service</h1>
      </div>

      <form onSubmit={handleSubmit(onValid)} className="admin-section">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="display_name">Display name</label>
            <input
              id="display_name"
              type="text"
              {...register("display_name")}
              onChange={handleNameChange}
            />
            {errors.display_name && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--down)",
                  fontFamily: "var(--font-mono)",
                  marginTop: 4,
                  display: "block",
                }}
              >
                {errors.display_name.message}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="slug">Slug</label>
            <input
              id="slug"
              type="text"
              {...register("slug")}
            />
            {errors.slug && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--down)",
                  fontFamily: "var(--font-mono)",
                  marginTop: 4,
                  display: "block",
                }}
              >
                {errors.slug.message}
              </span>
            )}
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="description">Description</label>
            <input
              id="description"
              type="text"
              value={extra.description}
              onChange={(e) =>
                setExtra((x) => ({ ...x, description: e.target.value }))
              }
            />
          </div>

          <div className="field">
            <label htmlFor="kind">Kind</label>
            <select
              id="kind"
              value={extra.kind}
              onChange={(e) =>
                setExtra((x) => ({ ...x, kind: e.target.value as ServiceKind }))
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
              value={extra.glyph}
              onChange={(e) =>
                setExtra((x) => ({ ...x, glyph: e.target.value }))
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
              max={3600}
              {...register("expected_interval_seconds", { valueAsNumber: true })}
            />
            {errors.expected_interval_seconds && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--down)",
                  fontFamily: "var(--font-mono)",
                  marginTop: 4,
                  display: "block",
                }}
              >
                {errors.expected_interval_seconds.message}
              </span>
            )}
          </div>

          {extra.kind === "pull" && (
            <>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="probe_url">Probe URL</label>
                <input
                  id="probe_url"
                  type="url"
                  value={extra.probe_url}
                  onChange={(e) =>
                    setExtra((x) => ({ ...x, probe_url: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="probe_interval">Probe interval (s)</label>
                <input
                  id="probe_interval"
                  type="number"
                  min={10}
                  value={extra.probe_interval_seconds}
                  onChange={(e) =>
                    setExtra((x) => ({
                      ...x,
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
                  value={extra.probe_expected_status}
                  onChange={(e) =>
                    setExtra((x) => ({
                      ...x,
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
              value={extra.deepseek_context}
              onChange={(e) =>
                setExtra((x) => ({ ...x, deepseek_context: e.target.value }))
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
                {...register("public_visible")}
              />
              Public visible
            </label>
            {errors.public_visible && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--down)",
                  fontFamily: "var(--font-mono)",
                  marginTop: 4,
                  display: "block",
                }}
              >
                {errors.public_visible.message}
              </span>
            )}
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
