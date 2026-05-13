/**
 * Aglaea v0.1 — API types (hand-written placeholder).
 * Compatible with SPEC.md §5 entity shapes and §6 endpoint shapes.
 * Will be overwritten by scripts/regen-api-types.sh once the backend
 * OpenAPI spec is available from a running instance.
 */

// ── Core status enum ───────────────────────────────────────────────────────
export type ServiceStatus = "ok" | "degraded" | "down" | "unknown";
export type IncidentStatus = "ongoing" | "resolved";
export type ReportState = "none" | "draft" | "published" | "rejected";
export type ServiceKind = "push" | "pull";

// ── Subcheck ───────────────────────────────────────────────────────────────
export interface Subcheck {
  status: ServiceStatus;
  latency_ms?: number;
  message?: string;
}

export type SubcheckMap = Record<string, Subcheck>;

// ── PublicService — mirrors backend PublicService allowlist (8 fields) ────────
// Used by all app/(public)/** pages. Add fields here ONLY if the backend
// PublicService schema (schemas/public.py) also exposes them.
export interface PublicService {
  slug: string;
  display_name: string;
  description: string | null;
  kind: ServiceKind;
  last_status: ServiceStatus | null;
  last_subchecks: SubcheckMap | null;
  last_heartbeat_at: string | null;
  public_visible: boolean;
}

// ── AdminService — full service shape returned by admin endpoints ──────────
// Used by app/admin/** pages only. The admin endpoint returns additional fields
// not present in the public allowlist.
export interface AdminService {
  slug: string;
  display_name: string;
  description: string;
  kind: ServiceKind;
  /** Service-type glyph key (graces | hyacinth | hydra | key | winged) */
  glyph: string;
  expected_interval_seconds: number;
  probe_url?: string;
  probe_interval_seconds?: number;
  probe_timeout_seconds?: number;
  probe_expected_status?: number;
  last_heartbeat_at: string;
  last_status: ServiceStatus;
  last_subchecks: SubcheckMap;
  last_message?: string;
  /** DeepSeek system-prompt context (admin-only field) */
  deepseek_context?: string;
  public_visible: boolean;
  /** 30-day uptime percentage */
  uptime_30d_pct: number;
  /** 30-day daily uptime array: 1.0=ok, 0.5=degraded, 0=down */
  uptime_30d: number[];
  /** Last 60-min heartbeat strip */
  heartbeats: HeartbeatPoint[];
  current_incident_id?: number | null;
}

/** @deprecated Use AdminService for admin pages, PublicService for public pages. */
export type Service = AdminService;

// ── HeartbeatPoint (strip display) ────────────────────────────────────────
export interface HeartbeatPoint {
  t: string;
  status: ServiceStatus;
}

// ── HeartbeatEvent (DB entity) ─────────────────────────────────────────────
export interface HeartbeatEvent {
  ts: string;
  service_id: number;
  status: ServiceStatus;
  subchecks: SubcheckMap;
  metrics?: Record<string, unknown>;
  message?: string;
  source: "push" | "probe";
  client_ts?: string;
}

// ── Incident ───────────────────────────────────────────────────────────────
export interface Incident {
  id: number;
  service_slug: string;
  status: IncidentStatus;
  started_at: string;
  resolved_at?: string | null;
  affected_subchecks: string[];
  report_state: ReportState;
  report_text?: string | null;
  report_generated_at?: string | null;
  report_generation_count: number;
  report_generation_reason?: string | null;
  published_text?: string | null;
  published_at?: string | null;
  published_by?: string | null;
  similar_ids?: number[];
}

// ── Timeline event ─────────────────────────────────────────────────────────
export interface TimelineEvent {
  t: string;
  sub: string;
  status: ServiceStatus;
  note: string;
}

// ── Swimlane segment ───────────────────────────────────────────────────────
export interface SwimlaneSegment {
  start: string;
  end: string;
  status: ServiceStatus;
}

export interface SwimlaneData {
  name: string;
  segments: SwimlaneSegment[];
}

// ── ApiKey ─────────────────────────────────────────────────────────────────
export interface ApiKey {
  id: string;
  label: string;
  /** Truncated prefix for display */
  prefix: string;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

// ── AdminUser ──────────────────────────────────────────────────────────────
export interface AdminUser {
  id: number;
  github_login: string;
  github_id: number;
  created_at: string;
  last_login_at?: string | null;
  deleted_at?: string | null;
}

// ── AuditLog ───────────────────────────────────────────────────────────────
export interface AuditLog {
  t: string;
  actor_type: "user" | "system";
  actor: string;
  event: string;
  ip: string;
  details: Record<string, unknown>;
}

// ── Claude Code metrics ────────────────────────────────────────────────────
export interface TokenDataPoint {
  ts: string;
  value: number;
}

export interface CostDataPoint {
  ts: string;
  usd: number;
}

export interface SessionDataPoint {
  date: string;
  count: number;
}

export interface CommitDataPoint {
  date: string;
  count: number;
}

export interface LocDataPoint {
  date: string;
  added: number;
  removed: number;
}

export interface ModelTokens {
  model: string;
  value: number;
}

export interface TerminalShare {
  type: string;
  value: number;
}

export interface HostMetrics {
  tokens_30d: number;
  cost_30d: number;
  sessions_30d: number;
}

export interface ClaudeCodeMetrics {
  token_total_30d: TokenDataPoint[];
  cost_trend_30d: CostDataPoint[];
  token_by_model: ModelTokens[];
  cache_hit_rate_7d: number;
  active_time_ratio_7d: { cli: number; user: number };
  sessions_daily_30d: SessionDataPoint[];
  commits_daily_30d: CommitDataPoint[];
  loc_daily_30d: LocDataPoint[];
  active_hours_heatmap: number[][];
  terminal_type_share: TerminalShare[];
  /** Admin-only: per-host breakdown */
  by_host?: Record<string, HostMetrics>;
}

// ── Public API response shapes ─────────────────────────────────────────────
export interface PublicServicesResponse {
  services: PublicService[];
}

export interface PublicServiceResponse {
  service: PublicService;
}

export interface PublicIncidentHistoryResponse {
  incidents: Incident[];
}

export interface PublicIncidentResponse {
  incident: Incident;
  timeline: TimelineEvent[];
  similar?: Incident[];
}

export interface PublicClaudeCodeResponse {
  metrics: ClaudeCodeMetrics;
}

// ── Admin API response shapes ──────────────────────────────────────────────
export interface AdminServicesResponse {
  services: Service[];
}

export interface AdminServiceResponse {
  service: Service;
  api_keys: ApiKey[];
  incidents: Incident[];
}

export interface AdminIncidentsResponse {
  incidents: Incident[];
}

export interface AdminIncidentResponse {
  incident: Incident;
  timeline: TimelineEvent[];
  heartbeats: HeartbeatEvent[];
  similar: Array<{
    id: number;
    started_at: string;
    duration_min: number;
    summary: string;
  }>;
}

export interface AdminAuditResponse {
  entries: AuditLog[];
  total: number;
}

export interface AdminClaudeCodeResponse {
  metrics: ClaudeCodeMetrics;
}

// ── Mutation payloads ──────────────────────────────────────────────────────
export interface CreateServicePayload {
  display_name: string;
  slug: string;
  description: string;
  kind: ServiceKind;
  glyph?: string;
  expected_interval_seconds?: number;
  probe_url?: string;
  probe_interval_seconds?: number;
  probe_timeout_seconds?: number;
  probe_expected_status?: number;
  public_visible?: boolean;
  deepseek_context?: string;
}

export interface PublishIncidentPayload {
  published_text: string;
}

export interface RejectIncidentPayload {
  reason?: string;
}

export interface GenerateReportPayload {
  instruction?: string;
}

export interface CreateApiKeyPayload {
  label: string;
}

export interface CreateApiKeyResponse {
  key: ApiKey;
  /** Plaintext key — shown once only */
  plaintext: string;
}
