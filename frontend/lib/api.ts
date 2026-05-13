/**
 * Aglaea — typed API fetch helpers
 *
 * Public routes use AGLAEA_BACKEND_INTERNAL_URL (SSR/RSC, server-side).
 * Admin client components use the same-origin /api/... path (nginx proxies).
 */

import type {
  PublicServicesResponse,
  PublicServiceResponse,
  PublicIncidentHistoryResponse,
  PublicIncidentResponse,
  PublicClaudeCodeResponse,
  AdminServicesResponse,
  AdminServiceResponse,
  AdminIncidentsResponse,
  AdminIncidentResponse,
  AdminAuditResponse,
  AdminClaudeCodeResponse,
  CreateServicePayload,
  PublishIncidentPayload,
  GenerateReportPayload,
  CreateApiKeyPayload,
  CreateApiKeyResponse,
  PublicService,
  Service,
  Incident,
} from "@/types/api";

// ── Base URL resolution ────────────────────────────────────────────────────

/**
 * Internal URL for SSR (RSC) calls — resolves to docker-internal or localhost.
 * Client-side calls use the same-origin path /api/... (proxied by nginx).
 */
function internalBase(): string {
  return (
    process.env["AGLAEA_BACKEND_INTERNAL_URL"] ?? "http://aglaea-backend:8000"
  );
}

// ── Generic fetch wrapper ──────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options?: RequestInit & { next?: { revalidate?: number; tags?: string[] } }
): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText} (${url})`);
  }
  return res.json() as Promise<T>;
}

// ── Public API ─────────────────────────────────────────────────────────────

/** GET /api/public/services — all public-visible services, ordered worst-first */
export async function getPublicServices(): Promise<PublicService[]> {
  const data = await apiFetch<PublicServicesResponse>(
    `${internalBase()}/api/public/services`,
    { next: { revalidate: 30 } }
  );
  return data.services;
}

/** GET /api/public/services/:slug */
export async function getPublicService(slug: string): Promise<PublicServiceResponse> {
  return apiFetch<PublicServiceResponse>(
    `${internalBase()}/api/public/services/${encodeURIComponent(slug)}`,
    { next: { revalidate: 30 } }
  );
}

/** GET /api/public/services/:slug/incidents */
export async function getPublicIncidentHistory(
  slug: string
): Promise<Incident[]> {
  const data = await apiFetch<PublicIncidentHistoryResponse>(
    `${internalBase()}/api/public/services/${encodeURIComponent(slug)}/incidents`,
    { next: { revalidate: 30 } }
  );
  return data.incidents;
}

/** GET /api/public/services/:slug/incidents/:id */
export async function getPublicIncident(
  slug: string,
  id: string
): Promise<PublicIncidentResponse> {
  return apiFetch<PublicIncidentResponse>(
    `${internalBase()}/api/public/services/${encodeURIComponent(slug)}/incidents/${encodeURIComponent(id)}`,
    { next: { revalidate: 30 } }
  );
}

/** GET /api/public/claude-code */
export async function getClaudeCodeMetric(): Promise<PublicClaudeCodeResponse> {
  return apiFetch<PublicClaudeCodeResponse>(
    `${internalBase()}/api/public/claude-code`,
    { next: { revalidate: 30 } }
  );
}

// ── Admin API (called from server components or client with /api/... path) ──

function adminBase(): string {
  // On server: use internal URL
  if (typeof window === "undefined") return internalBase();
  // On client: same-origin, nginx proxies /api → backend
  return "";
}

/** GET /api/admin/services */
export async function adminListServices(): Promise<AdminServicesResponse> {
  return apiFetch<AdminServicesResponse>(`${adminBase()}/api/admin/services`, {
    credentials: "include",
  });
}

/** GET /api/admin/services/:slug */
export async function adminGetService(slug: string): Promise<AdminServiceResponse> {
  return apiFetch<AdminServiceResponse>(
    `${adminBase()}/api/admin/services/${encodeURIComponent(slug)}`,
    { credentials: "include" }
  );
}

/** POST /api/admin/services */
export async function adminCreateService(
  payload: CreateServicePayload
): Promise<{ service: Service }> {
  return apiFetch<{ service: Service }>(`${adminBase()}/api/admin/services`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
}

/** PATCH /api/admin/services/:slug */
export async function adminUpdateService(
  slug: string,
  payload: Partial<CreateServicePayload>
): Promise<{ service: Service }> {
  return apiFetch<{ service: Service }>(
    `${adminBase()}/api/admin/services/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    }
  );
}

/** DELETE /api/admin/services/:slug — returns 204, body intentionally empty */
export async function adminDeleteService(slug: string): Promise<void> {
  const res = await fetch(
    `${adminBase()}/api/admin/services/${encodeURIComponent(slug)}`,
    { method: "DELETE", credentials: "include" }
  );
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
}

/** GET /api/admin/incidents */
export async function adminListIncidents(): Promise<AdminIncidentsResponse> {
  return apiFetch<AdminIncidentsResponse>(`${adminBase()}/api/admin/incidents`, {
    credentials: "include",
  });
}

/** GET /api/admin/incidents/:id */
export async function adminGetIncident(id: string): Promise<AdminIncidentResponse> {
  return apiFetch<AdminIncidentResponse>(
    `${adminBase()}/api/admin/incidents/${encodeURIComponent(id)}`,
    { credentials: "include" }
  );
}

/** POST /api/admin/incidents/:id/publish */
export async function adminPublishIncident(
  id: string | number,
  payload: PublishIncidentPayload
): Promise<{ incident: Incident }> {
  return apiFetch<{ incident: Incident }>(
    `${adminBase()}/api/admin/incidents/${encodeURIComponent(String(id))}/publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    }
  );
}

/** POST /api/admin/incidents/:id/reject */
export async function adminRejectIncident(
  id: string | number
): Promise<{ incident: Incident }> {
  return apiFetch<{ incident: Incident }>(
    `${adminBase()}/api/admin/incidents/${encodeURIComponent(String(id))}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      credentials: "include",
    }
  );
}

/** POST /api/admin/incidents/:id/regenerate */
export async function adminRegenerateReport(
  id: string | number,
  payload: GenerateReportPayload
): Promise<{ incident: Incident }> {
  return apiFetch<{ incident: Incident }>(
    `${adminBase()}/api/admin/incidents/${encodeURIComponent(String(id))}/regenerate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    }
  );
}

/** GET /api/admin/audit-log */
export async function adminListAuditLog(params?: {
  event?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminAuditResponse> {
  const qs = params
    ? "?" +
      new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )
      ).toString()
    : "";
  return apiFetch<AdminAuditResponse>(
    `${adminBase()}/api/admin/audit-log${qs}`,
    { credentials: "include" }
  );
}

/** GET /api/admin/claude-code */
export async function adminGetClaudeCode(): Promise<AdminClaudeCodeResponse> {
  return apiFetch<AdminClaudeCodeResponse>(
    `${adminBase()}/api/admin/claude-code`,
    { credentials: "include" }
  );
}

/** POST /api/admin/services/:slug/keys */
export async function adminCreateApiKey(
  slug: string,
  payload: CreateApiKeyPayload
): Promise<CreateApiKeyResponse> {
  return apiFetch<CreateApiKeyResponse>(
    `${adminBase()}/api/admin/services/${encodeURIComponent(slug)}/keys`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    }
  );
}

/** DELETE /api/admin/services/:slug/keys/:keyId — returns 204, no body */
export async function adminRevokeApiKey(
  slug: string,
  keyId: string
): Promise<void> {
  const res = await fetch(
    `${adminBase()}/api/admin/services/${encodeURIComponent(slug)}/keys/${encodeURIComponent(keyId)}`,
    { method: "DELETE", credentials: "include" }
  );
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return;
}
