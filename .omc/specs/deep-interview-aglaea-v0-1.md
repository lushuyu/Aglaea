# Deep Interview Spec: Aglaea v0.1 implementation

> Status: **pending approval** — produced by `/oh-my-claudecode:deep-interview`. Awaits explicit execution selection (refine via omc-plan consensus, autopilot, ralph, team, or further refine).

## Metadata

| Field | Value |
|---|---|
| Interview ID | `aglaea-v0-1-2026-05-13` |
| Type | Brownfield (SPEC.md + Cerydra + Hyacine present; Aglaea repo pre-init) |
| Rounds | 6 (Round 0 topology + 6 interview rounds, batches of 4 questions per round per maintainer preference) |
| Final ambiguity | **14%** (weakest active component: Frontend) |
| Threshold | 0.20 (`omc.deepInterview.ambiguityThreshold` default) |
| Initial context summarized | No (SPEC.md + CLAUDE_CODE_PROMPT.md + design bundle fit in prompt budget after design extraction) |
| Status | **PASSED** (overall ambiguity ≤ 0.20 across all active components) |
| Generated | 2026-05-13 |
| Spec path | `.omc/specs/deep-interview-aglaea-v0-1.md` |
| Source artifacts | `SPEC.md`, `CLAUDE_CODE_PROMPT.md`, `docs/design/project/Aglaea.html`, `cerydra/push/doctor.py`, `hyacine/pyproject.toml` + `hyacine/LICENSE` |

## Clarity Breakdown

| Component | Goal (35%) | Constraints (25%) | Criteria (25%) | Context (15%) | Weighted | Ambiguity |
|---|---:|---:|---:|---:|---:|---:|
| Backend | 0.97 | 0.95 | 0.92 | 0.92 | **0.945** | 5.5% |
| Frontend | 0.92 | 0.88 | 0.75 | 0.92 | **0.860** | 14.0% |
| Infrastructure | 0.95 | 0.92 | 0.92 | 0.95 | **0.935** | 6.5% |
| Cerydra reporter | 0.92 | 0.85 | 0.78 | 0.95 | **0.872** | 12.8% |
| **Overall (weakest active)** | | | | | | **14.0%** |

## Topology

| Component | Status | Description | Coverage / Deferral Note |
|---|---|---|---|
| **Backend** | active | FastAPI 3.12 + SQLAlchemy 2.x async + asyncpg + Alembic; 3 API surfaces; 3 in-process workers (incident detector / pull prober / report generator); DeepSeek client; audit log. | Stack pins, worker model, allowlist module, trigger semantics, close-rule, request-id propagation all locked. AC §1. |
| **Frontend** | active | Next.js 15.x App Router + TypeScript (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes); hybrid data-fetch strategy (RSC for public, Server Actions for admin static, TanStack Query for admin interactive); verbatim port of `docs/design/project/src/{tokens,screens}.css`. | Stack + styling rules + data strategy locked. AC §2. Subcheck strip layout for 6 keys is the one open design-time question (delegated back to Claude Design, not backend). |
| **Infrastructure** | active | docker-compose with Postgres+TimescaleDB / VictoriaMetrics / OTel Collector / aglaea-backend / aglaea-frontend; nginx behind CloudFlare Origin CA (no certbot); ufw; bootstrap.sh; .env.example. | TLS, nginx layout, logging, ops defaults all locked. AC §3. |
| **Cerydra reporter** | active | `cerydra/monitoring/webhook.py` — new `WebhookReporter` class, generic name (mirrors Hyacine §12 module shape), push-only, `WEBHOOK_REPORTER_*` env namespace. Projects 6 subchecks (jin10, cls, wscn, moomoo, deepseek, discord). | Module path, env names, subcheck set, push-vs-pull all locked. AC §4. |
| **Hyacine reporter** | **deferred** | Public-OSS PR to add `webhook_reporter` to hyacine mainline per SPEC §12. MIT license cleared — PR contribution is acceptable. | Excluded from v0.1 ambiguity math. User-confirmed deferral in Round 0: "ship backend + Cerydra first, then PR Hyacine as future work." Spec preserves the design intent so the PR can be drafted from this document directly when scope expands. |

## Goal

Stand up Aglaea v0.1 — a single-tenant personal SRE platform on `status.lushuyu.site` — that:

1. Receives heartbeats from Cerydra (push, every `WEBHOOK_REPORTER_INTERVAL_SECONDS`) with 6 subchecks (jin10, cls, wscn, moomoo, deepseek, discord) projected from `cerydra.push.doctor.run_doctor()`.
2. Pull-probes static service URLs registered via the admin UI on their `probe_interval_seconds`.
3. Detects incidents, generates DeepSeek narrative drafts on T0/T2/T3 triggers, and surfaces them in an admin review screen where a human approves publish.
4. Exposes a public status page that aggregates host-name dimensions, never leaks restricted fields per SPEC §8.2, and renders incident timelines as bare facts when no published narrative exists.
5. Ingests Claude Code OTEL streams from three devices (Mac / Win / SG-VPS) for aggregated usage analytics; the OTel Collector drops PII (`user.email`, `user.account_uuid`) before metrics reach VictoriaMetrics.
6. Adds `cerydra/monitoring/webhook.py` to the Cerydra repo (private; explicit `WEBHOOK_REPORTER_ENDPOINT=https://status.lushuyu.site/api/v1/heartbeat`).

Hyacine reporter is **deferred** — the spec contains the design but no v0.1 implementation work.

## Constraints

### Non-negotiable (carried verbatim from SPEC §D + CLAUDE_CODE_PROMPT §D)

- C1. No Cipher integration.
- C2. No hardcoded Postgres password — `openssl rand -base64 32` at deploy, `.env` chmod 600 + gitignored.
- C3. No `ports:` mapping for Postgres / VictoriaMetrics / OTel Collector in docker-compose — docker-internal only.
- C4. `.env.example` ships in repo with empty values; real `.env` never committed.
- C5. DeepSeek API key reused from Cerydra by manual `cp` of the env file — never `cat` / `grep` / display the value during agentic work.
- C6. **Hyacine reporter (when implemented) must never contain "Aglaea" references in committed code.** Generic naming (`webhook_reporter`), Aglaea endpoint + token only in private deployment `.env`.
- C7. Bearer tokens stored as argon2id hashes; plaintext returned exactly once at generation via admin UI modal with "I have copied this" confirmation.
- C8. Public API endpoints aggregate away `host.name` (`sum without (host_name)`). PromQL queries hardcoded server-side, not user-controlled.
- C9. LLM context allowlist enforced at `backend/aglaea/llm/context.py` — the allowlist is the only path from DB to LLM prompt; prompt templates cannot reference DB fields directly.
- C10. Existing healthchecks.io + ntfy remain authoritative for critical alerting. Aglaea is purely additive.
- C11. No fallback to default credentials anywhere (maintainer's prior server was hijacked due to default Postgres creds).

### Stack pins (locked in Round 1)

- C12. Python **3.12**. Two tracked artifacts: Docker image tag `python:3.12-slim`; pyproject `requires-python = ">=3.12"`.
- C13. Postgres driver: **asyncpg only**. NO psycopg2-binary. Alembic uses the same asyncpg engine via SQLAlchemy 2.x `async_engine_from_config` + `run_async` standard pattern.
- C14. ORM: **SQLAlchemy 2.x async + Alembic**. ORM mapped to `services` / `api_keys` / `incidents` / `admin_users` / `audit_log`. `heartbeat_events` may be ORM-mapped but its Timescale-specific DDL is manual.
- C15. **TimescaleDB DDL discipline** — `create_hypertable`, `ALTER TABLE ... SET (timescaledb.compress, ...)`, `add_compression_policy`, `add_retention_policy` live ONLY in Alembic `upgrade()` / `downgrade()` raw SQL blocks. Never autogenerated. Each migration file marks the manual block with a fixed comment: `# === TimescaleDB-specific (manual) ===`.
- C16. Dep manager: **uv** with `uv.lock`. Docker build uses `uv sync --frozen` for cached image layers.

### Security & semantics (locked in Round 2)

- C17. **HMAC dropped for v0.1.** TLS + bearer + REQUIRED `X-Aglaea-Timestamp` (±5 minute window; outside → 401 + `audit_log(event=auth.timestamp_window_rejected)`). Migration path to add HMAC later is non-breaking: add `api_keys.hmac_secret_hash` column + UI modal field. Spec §6.2 "optional HMAC" stays in the table but the v0.1 backend rejects the `X-Aglaea-Signature` header path entirely (404 / ignored).
- C18. **Workers run as in-process asyncio tasks from FastAPI lifespan.** SINGLE container. Three workers: `incident_detector`, `pull_prober`, `report_generator`. Hard I/O timeouts: httpx ≤ 30s, SQLAlchemy statements ≤ 5s (`statement_timeout`), DeepSeek call ≤ 60s. Each worker has a top-level `try/except Exception` that logs full traceback + emits ntfy alert + `asyncio.sleep(backoff)` + continues. **Workers MUST NEVER silently die.** Migration to two-container is a 1-PR change if needed in v1.x.
- C19. **Allowlist single source of truth** at `backend/aglaea/security/visibility.py`. Exports `frozenset` constants:
  - `PUBLIC_FIELDS_SERVICE`
  - `PUBLIC_FIELDS_INCIDENT_PUBLISHED`
  - `PUBLIC_FIELDS_INCIDENT_SKELETON`
  - `PUBLIC_FIELDS_HEARTBEAT`
  - `LLM_CONTEXT_FIELDS_HEARTBEAT`
  - `LLM_CONTEXT_FIELDS_INCIDENT`
  - `LLM_CONTEXT_FIELDS_SERVICE`
  Public Pydantic response models reference these constants in `model_config` or per-field includes — never hand-written field lists. `llm/context.py` imports the same constants.
- C20. **Bootstrap allowlist idempotent.** `BOOTSTRAP_GITHUB_LOGIN` semantics: on first OAuth success where `github_login == env var`, `INSERT INTO admin_users` if no row matches (active, not soft-deleted). Already-present row → no-op. Allowlist check at every OAuth callback: `SELECT 1 FROM admin_users WHERE github_login = ? AND deleted_at IS NULL`. Soft-deleted rows DO NOT satisfy the check. Recovery from self-soft-delete: `UPDATE admin_users SET deleted_at = NULL` or restart container (env-var-triggered idempotent INSERT recreates row if absent).

### Frontend (locked in Round 3)

- C21. Next.js **15.x** + App Router. Route groups: `app/(public)/` + `app/admin/`. Server Actions for admin mutations. Docker base `node:20-alpine`.
- C22. TypeScript: `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. Rationale alignment — `exactOptionalPropertyTypes` mirrors backend Pydantic v2 strict semantics (absent ≠ explicitly-undefined). Third-party `.d.ts` conflicts → file-level `// @ts-expect-error <reason>`; NEVER globally relax tsconfig.
- C23. Styling: **verbatim port** of `docs/design/project/src/tokens.css` + `screens.css`. Structural rules (enforced in PR review):
  - `app/globals.css` imports `tokens.css` as the CSS variable root.
  - `screens.css` is split into `styles/<screen>.css` files, imported per route.
  - New components use `*.module.css` referencing `var(--*)` from `tokens.css`.
  - **HARD RULE**: no hex / px literal inside components — every value goes through a token. PR-review-blocking.
- C24. **Hybrid data fetching strategy:**
  | Route type | Read | Mutate |
  |---|---|---|
  | Public (`app/(public)/**`) | RSC + `fetch` with `revalidate: 30` | none |
  | Admin static (lists, settings) | RSC | Server Action + `revalidatePath` |
  | Admin interactive (incident review, key gen, audit filter) | client component + TanStack Query | TanStack `useMutation` + `invalidateQueries` for surgical refresh |
  `<QueryClientProvider>` wraps `app/admin/layout.tsx` **only**. Public bundle never includes TanStack.
- C25. Admin dashboard timezone display: **Asia/Singapore (SGT)** matching the design prototype. Public pages render timestamps in browser-local time.

### Cerydra reporter (locked in Round 4)

- C26. **Push, not pull.** Cerydra owns scheduling.
- C27. Module path: `cerydra/monitoring/webhook.py`. Class: `WebhookReporter`. Lives alongside existing `monitoring/heartbeat.py` and `monitoring/ntfy.py`. Wired into runtime from the same place as those.
- C28. **Subcheck set: 6 keys** — `jin10`, `cls`, `wscn`, `moomoo`, `deepseek`, `discord`. **Edits SPEC §11's provisional list of 4.** Rationale: cls and wscn are tier-equivalent financial-news sources to jin10 for the investment-group user; hiding them while showing jin10 violates the status page's purpose. db (internal sqlite) and ntfy (Cerydra's own alert channel) are infrastructure-meta with no Aglaea-side meaning.
- C29. **Frontend dependency**: the prototype `.subcheck-strip` is tuned for 4 keys. 6 keys may overflow the row. Send back to Claude Design to re-tune (options: wrap to 2 rows; OR keep core 4 in main strip + cls/wscn as secondary). Backend schema is unaffected (JSONB key set).
- C30. Env namespace: `WEBHOOK_REPORTER_*` identical between Cerydra and Hyacine — module code is near-copy-pasteable. Specific vars: `WEBHOOK_REPORTER_ENABLED`, `WEBHOOK_REPORTER_ENDPOINT`, `WEBHOOK_REPORTER_TOKEN`, `WEBHOOK_REPORTER_INTERVAL_SECONDS` (default 60). Future multi-destination expansion: `WEBHOOK_REPORTER_<DEST>_*`.

### Infrastructure (locked in Round 5)

- C31. **TLS via Cloudflare Origin CA wildcard** `*.lushuyu.site` (~15-year validity). DNS for `status.lushuyu.site` + `otel.lushuyu.site` set to orange-cloud (CF proxy). TLS chain: Browser → CF Universal SSL → CF edge → Origin CA → nginx on sg-server. **No certbot, no acme.sh, no cron.** Reuses Cerydra's existing deploy pattern on the same sg-server. nginx server blocks reference the existing Origin CA cert+key paths.
- C32. nginx config: `/etc/nginx/sites-available/aglaea.conf` (single file for both server blocks), symlinked to `sites-enabled/`. Reload via `nginx -t && systemctl reload nginx`. Repo ships `infra/nginx.conf.example` as the canonical snippet (not auto-deployed).
- C33. Logging: JSON-structured to stdout via `python-json-logger`. Required fields: `timestamp`, `level`, `logger`, `message`, `request_id`. Aggregation: `docker logs aglaea-backend` is the v0.1 read path. Future Loki/Promtail noted in `docs/notes` only — zero v0.1 code.
- C34. **RequestIDMiddleware** (new v0.1 requirement): every incoming HTTP request generates or passes through `X-Request-ID` (preferred order: incoming header value if well-formed; fallback `uuid4().hex[:16]`). Propagates into: every log line for that request scope, response header, and `audit_log.details.request_id`. This is v0.1's only tracing — no OTel tracing inside Aglaea itself.
- C35. **Self-monitor worker**: backend lifespan registers an asyncio task that every 60s POSTs to `$HEALTHCHECKS_SELFPING_URL`. Failure does NOT raise, only logs at WARN. If env var unset → worker doesn't start.
- C36. **No Sentry.** JSON logs + `docker logs | jq` is the v0.1 debug path.
- C37. **No Postgres backup.** Per SPEC §14, confirmed.

### Worker semantics (locked in Round 6)

- C38. **T1 (subcheck_changed) trigger DROPPED.** Active LLM-regen tiers: **T0** (initial) → **T2** (periodic 30 min) → **T3** (final on resolve). Hard cap >12 generations per incident still emits ntfy alert + halts auto-generation. T1 reserved in code (`enum ReportTrigger.SUBCHECK_CHANGED`) with `.priority` value but never fired, so a v1.x revival is zero-reshape.
- C39. **Trigger precedence**: T3 > T0 > T1 > T2. Single implementation site (`detector.report_trigger.pick(...)` or equivalent) using `max(triggers, key=lambda t: t.priority)`. **Forbidden**: precedence logic in SQL, precedence split across multiple functions.
- C40. **`affected_subchecks` accumulating set**: incident detector every tick unions in subcheck names that report non-ok in the live heartbeat. Once added, never removed during the incident.
- C41. **Close rule**: incident transitions to `resolved` when the last 3 consecutive heartbeats all satisfy: `heartbeat.status == 'ok' AND all(subchecks[k].status == 'ok' for k in incident.affected_subchecks)`.
- C42. **Cert-warn threshold**: global constant `CERT_WARN_DAYS = 14` in `backend/aglaea/config.py`. NOT in `.env`. Pull-prober logic: cert remaining validity < 14 days AND not yet expired → force status to `degraded` with `message='cert expires in N days'`. Expired → `down`.

## Non-Goals

### Carried from SPEC §14

- N1. Cipher integration.
- N2. Real-time WebSocket (polling sufficient for personal use).
- N3. Pattern auto-clustering (embedding-based clustering is v2).
- N4. JS RUM beacon for static pages.
- N5. Mobile-first design (desktop primary; responsive welcome but not required).
- N6. Internationalization (English UI, Chinese in casual chat).
- N7. WCAG audit.
- N8. Automated Postgres backups.
- N9. Multi-user / team features.

### Added by this interview

- N10. **Hyacine reporter v0.1 implementation deferred** — design is captured here but no code lands in v0.1. PR to hyacine mainline is post-v0.1 work.
- N11. **HMAC v0.1 implementation deferred** — migration path is non-breaking (add column + modal field).
- N12. **No Loki/Promtail/external log shipper in v0.1** — `docker logs` only. Documented as future work in `docs/notes`.
- N13. **No Sentry in v0.1.**
- N14. **No automated CI in v0.1 beyond Phase 0 skeleton.** The CLAUDE_CODE_PROMPT §C Phase 0 leaves "CI skeleton (if any)" optional — no explicit requirement to wire GH Actions / etc. in v0.1.
- N15. **No PromQL ad-hoc query confirmation step** — SPEC §15 reopens whether `/api/admin/claude-code/raw-query` needs a confirmation step; v0.1 ships it without (admin-only auth gate is sufficient for a single-user system).

## Acceptance Criteria

Organized by component. Each item is testable.

### §AC.1 Backend

- [ ] AC1.1 — `pyproject.toml` declares `requires-python = ">=3.12"` and Docker `aglaea-backend` image is `python:3.12-slim` based; `uv.lock` is committed.
- [ ] AC1.2 — Alembic `env.py` uses `async_engine_from_config` + `run_async` pattern; no psycopg2-binary anywhere in `pyproject.toml` / lockfile.
- [ ] AC1.3 — Every TimescaleDB-specific DDL statement appears inside an `upgrade()` raw-SQL block tagged with `# === TimescaleDB-specific (manual) ===`. Test: `grep -L "TimescaleDB-specific (manual)" alembic/versions/*.py | xargs grep -l "create_hypertable" → empty output`.
- [ ] AC1.4 — `security/visibility.py` exports the 7 frozenset constants from C19. Unit test: every `PublicService` response field name is in `PUBLIC_FIELDS_SERVICE`.
- [ ] AC1.5 — Service-push request with `X-Aglaea-Timestamp` older than `now-300s` or newer than `now+300s` returns 401 AND writes `audit_log(event=auth.timestamp_window_rejected, details={timestamp, now, delta})`.
- [ ] AC1.6 — A worker's inner function can be made to raise; the worker is still alive on the next tick (top-level `try/except` + backoff + continue). Test: monkeypatch `pull_prober._probe_one` to raise once; assert next tick still polls.
- [ ] AC1.7 — Every `httpx.AsyncClient(...)` instantiation has an explicit `timeout=` kwarg. CI lint: `grep "httpx.AsyncClient(" backend/ | grep -v "timeout=" → empty`.
- [ ] AC1.8 — Soft-deleted `admin_users` row does NOT satisfy OAuth allowlist check. Test: seed 2 rows, soft-delete one, attempt sign-in → 403.
- [ ] AC1.9 — Bootstrap idempotency: with `admin_users` already populated, first OAuth callback matching `BOOTSTRAP_GITHUB_LOGIN` does NOT INSERT a duplicate row.
- [ ] AC1.10 — `RequestIDMiddleware` propagation: response header `X-Request-ID` equals the value present in `audit_log.details.request_id` for any audit-triggering request.
- [ ] AC1.11 — `enum ReportTrigger` has 4 members (`INITIAL`, `SUBCHECK_CHANGED`, `PERIODIC`, `FINAL`); `pick()` returns the highest `.priority`. Unit test asserts T3 > T0 > T1 > T2 ordering.
- [ ] AC1.12 — `incident_detector` worker NEVER calls `report_generator` with `reason=subcheck_changed` in v0.1 (T1 dropped). Integration test: induce subcheck flap during ongoing incident → no new draft generated until T2/T3 fires.
- [ ] AC1.13 — `affected_subchecks` is monotone: a subcheck recorded in tick N appears in `affected_subchecks` for every subsequent tick of the same incident, even if it later returns to ok.
- [ ] AC1.14 — Close rule: incident closes only when last 3 heartbeats all have `status=ok` AND every `affected_subchecks` key is ok in each of those 3 heartbeats.
- [ ] AC1.15 — Pull prober marks status `degraded` with message `cert expires in N days` when probe TLS cert remaining < `CERT_WARN_DAYS` (14); `down` if expired.
- [ ] AC1.16 — Per SPEC §9.4: `>10` auth failures in 1 minute from a single IP emit ntfy alert; audit log records each 401/403.

### §AC.2 Frontend

- [ ] AC2.1 — `package.json` pins `next@^15`, `react@^18`, `typescript@^5`.
- [ ] AC2.2 — `tsconfig.json` sets `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. CI runs `tsc --noEmit`.
- [ ] AC2.3 — `app/globals.css` imports the verbatim port of `docs/design/project/src/tokens.css`. The 12 status / theme tokens enumerated in tokens.css are present unchanged.
- [ ] AC2.4 — No hex color literal in any `*.module.css` file. CI lint: `grep -rE '#[0-9a-fA-F]{3,6}\b' app/**/*.module.css → empty`.
- [ ] AC2.5 — `QueryClientProvider` is imported only in files under `app/admin/`. CI lint: `grep -rE 'QueryClientProvider' app/\(public\)/ → empty`.
- [ ] AC2.6 — Public bundle size after build does not include `@tanstack/react-query`. Verified via build report.
- [ ] AC2.7 — Admin dashboard "Local time" indicator renders Singapore time (Asia/Singapore TZ). Public pages render browser-local time.
- [ ] AC2.8 — Public Service `/status` row renders the 6-key subcheck set for Cerydra without horizontal overflow on a 1280px viewport. (Awaits Claude Design re-tune per C29; pre-tune fallback: subcheck strip wraps to 2 rows at width <= prototype's design width.)
- [ ] AC2.9 — Incident review screen "Publish" button is disabled when draft == published_text; clicking it issues a Server Action that updates `published_text` + calls `invalidateQueries(['incidents', id])`.

### §AC.3 Infrastructure

- [ ] AC3.1 — `docker-compose.yml` has NO `ports:` mapping under `postgres`, `victoriametrics`, `otelcol`.
- [ ] AC3.2 — `infra/nginx.conf.example` references `*.lushuyu.site` Cloudflare Origin CA cert/key paths matching Cerydra's existing nginx config conventions. No `certbot` / `acme.sh` references anywhere in repo.
- [ ] AC3.3 — All backend log lines emitted via `python-json-logger` are valid JSON; every line includes `timestamp`, `level`, `logger`, `message`, `request_id` (request_id may be `null` for non-request contexts like worker ticks).
- [ ] AC3.4 — `HEALTHCHECKS_SELFPING_URL` env var unset → no self-ping worker registered. Set → worker POSTs every 60s; if POST fails, worker logs WARN and continues.
- [ ] AC3.5 — `.env.example` ships with empty values for the 7 secrets enumerated in SPEC §10.3 plus `HEALTHCHECKS_SELFPING_URL`. `.env` is in `.gitignore`. `chmod 600 .env` instruction in `scripts/bootstrap.sh`.
- [ ] AC3.6 — `ufw status` (post-bootstrap) shows only 22 / 80 / 443 inbound allowed.
- [ ] AC3.7 — OTel Collector OTLP/HTTP endpoint is reachable only through nginx with `Authorization: Bearer ${OTEL_SHARED_TOKEN}`. nginx returns 401 for missing or wrong header.
- [ ] AC3.8 — `bootstrap.sh` cold-start sequence completes without manual file editing other than: (a) generating secrets and writing them into `.env`, (b) registering the GitHub OAuth app and pasting client id/secret, (c) reloading nginx. SPEC §10.4 steps 1–10.

### §AC.4 Cerydra reporter

- [ ] AC4.1 — `cerydra/monitoring/webhook.py` exists with a `WebhookReporter` class that exposes the same async-loop entry point shape as `cerydra/monitoring/heartbeat.py` (so it's wired in alongside heartbeat / ntfy from `cerydra/runtime.py`).
- [ ] AC4.2 — `WebhookReporter` reads only the `WEBHOOK_REPORTER_*` env names. No `AGLAEA_*` env names anywhere in Cerydra committed code. (Same code shape as the future Hyacine PR — only differences are `.env` values.)
- [ ] AC4.3 — Heartbeat POST body matches SPEC §6.2 schema, with `subchecks` containing exactly 6 keys (`jin10`, `cls`, `wscn`, `moomoo`, `deepseek`, `discord`); each maps to `{status: ok|degraded|down, latency_ms?: int, message?: string}`.
- [ ] AC4.4 — Reporter projects from `cerydra.push.doctor` probe functions (refactored to return dicts) rather than parsing string output. `_probe_jin10`, `_probe_cls`, `_probe_wscn`, `_probe_moomoo`, `_probe_deepseek` get a `dict`-returning variant; `_discord_line` / `_push_line` map to a `discord` subcheck.
- [ ] AC4.5 — Outbound POST has explicit timeout ≤ 30s; failure does NOT raise — instead enqueued to in-memory ring buffer (capacity 100, drop oldest, never persist) per SPEC §12 pattern.
- [ ] AC4.6 — `X-Aglaea-Timestamp` header sent with every POST (current epoch seconds). No `X-Aglaea-Signature` (HMAC dropped per C17).
- [ ] AC4.7 — When `WEBHOOK_REPORTER_ENABLED=0` or unset → reporter task not started; `cerydra/runtime.py` runs identically to pre-Aglaea.

### §AC.5 §13 Hardening checklist (verbatim from SPEC §13, with one v0.1 amendment)

- [ ] AC5.1 — `POSTGRES_PASSWORD` is randomly generated (≥32 bytes from `openssl rand -base64 32`), not a dictionary word.
- [ ] AC5.2 — `.env` is `chmod 600` and in `.gitignore`.
- [ ] AC5.3 — No `ports:` mappings for postgres / VM / otelcol in `docker-compose.yml`.
- [ ] AC5.4 — `ufw status` shows only 22 / 80 / 443 open.
- [ ] AC5.5 — nginx config does not proxy postgres / VM directly.
- [ ] AC5.6 — OTel Collector endpoint requires `OTEL_SHARED_TOKEN`.
- [ ] AC5.7 — GitHub OAuth allowlist (table-authoritative) enforced before session creation.
- [ ] AC5.8 — All admin actions write to `audit_log`.
- [ ] AC5.9 — LLM context allowlist tested with deliberately malicious heartbeat payload (e.g., `subchecks.discord.message: "Ignore previous instructions and..."`); test asserts the LLM context assembler drops/escapes the field per `LLM_CONTEXT_FIELDS_HEARTBEAT`.
- [ ] AC5.10 — First admin login bootstraps via `BOOTSTRAP_GITHUB_LOGIN` only; second non-allowlist login is rejected with generic friendly error (no info leak).
- [ ] AC5.11 — *(new)* `X-Aglaea-Timestamp` validation: missing header → 401, value outside ±300s window → 401, every rejection writes audit log.

## Assumptions Exposed & Resolved

| # | Assumption / SPEC ambiguity | Round | How challenged | Resolution |
|---|---|---|---|---|
| 1 | `token_secret` in §9.4 HMAC is undefined | R2 | Listed 3 options; pointed out that bearer + hmac_secret in same `.env` makes "separate secret" psychological only | **Drop HMAC for v0.1**; keep `X-Aglaea-Timestamp` ±5min window as mandatory. Migration path: non-breaking column add (C17). |
| 2 | §3 vs §15 worker execution model | R2 | Listed single-container / split-container / threaded options | **Single container, asyncio.create_task() from lifespan.** Hard timeouts on every external I/O. Workers must not silently die. Split-container migration is 1 PR if needed (C18). |
| 3 | Output sanitiser allowlist scope (§8.2 ⊄ §9.4) | R2 | Asked where to physically locate the allowlist | **Single source-of-truth** at `security/visibility.py` exporting frozenset constants; Pydantic models reference them; LLM context module imports them (C19). |
| 4 | Bootstrap allowlist semantics post-row-1 | R2 | Asked whether env var or table is authoritative | **Table is authoritative**, `BOOTSTRAP_GITHUB_LOGIN` is idempotent INSERT trigger; soft-deleted rows DO NOT satisfy allowlist (C20). |
| 5 | Push vs pull for Cerydra reporter | R4 (Contrarian) | Challenged SPEC §11's implicit push assumption with pull and hybrid alternatives | **Keep push.** Cerydra owns scheduling; no Aglaea-reaches-Cerydra firewall assumption; matches future Hyacine pattern (C26). |
| 6 | Cerydra reporter module placement | R4 | 3 options: generic monitoring/webhook vs reporting/aglaea vs extend heartbeat.py | **`cerydra/monitoring/webhook.py`** — generic name mirrors Hyacine §12 module shape (C27). |
| 7 | SPEC §11 subcheck set (4 vs 6) | R4 | Read `cerydra/push/doctor.py` source; identified user-relevance tiers | **6 subchecks**: jin10 + cls + wscn + moomoo + deepseek + discord. Drops db + ntfy. Edits SPEC §11. Frontend strip layout dependency raised to Claude Design (C28, C29). |
| 8 | Cerydra env naming pattern | R4 | Asked between Aglaea-prefixed and generic `WEBHOOK_REPORTER_*` | **`WEBHOOK_REPORTER_*`** — identical between Cerydra and (future) Hyacine, module code copy-pasteable. URL value tells you the destination (C30). |
| 9 | TLS management | R5 | Surfaced certbot / acme.sh / reuse-existing | **Reuse Cloudflare Origin CA wildcard** `*.lushuyu.site`; no certbot/acme.sh/cron. Reuses Cerydra's existing deploy pattern on the same VPS (C31). |
| 10 | Logging format + aggregation | R5 | 4 options spanning JSON-stdout to log files | **JSON to stdout via `python-json-logger`**; `docker logs` only for v0.1; new `RequestIDMiddleware` is the v0.1 tracing primitive (C33, C34). |
| 11 | Operational defaults — Sentry, self-ping, backup | R5 | Combined picks | **No Sentry. Healthchecks.io self-ping ON** via 60s asyncio worker. **No backup** per SPEC §14 (C35–C37). |
| 12 | §7.3 T1 trigger necessity | R6 (Simplifier) | Challenged whether subcheck-change deserves its own LLM-regen tier | **Drop T1.** Real-time state already carried by skeleton + swimlane; LLM is narrative. Admin can hit Regenerate. `affected_subchecks` tracking unaffected (C38). |
| 13 | Trigger precedence when collisions | R6 | Listed priority-wins / first-fire / coalesce | **Priority-wins T3 > T0 > T1 > T2** via single enum + `max()` site. Forbidden: SQL precedence, multi-site precedence (C39). |
| 14 | Close-incident subcheck strictness | R6 | Listed lenient / strict / per-affected | **Per-affected**: `last 3 heartbeats all status=ok AND every affected_subchecks key ok`. `affected_subchecks` monotone (C40, C41). |
| 15 | Per-service cert-warn threshold | R6 | Asked 7d / 14d / per-service column | **Global `CERT_WARN_DAYS = 14`** in `aglaea/config.py`. No per-service column (C42). |

Spec-source ambiguities NOT requiring user resolution (locked by inference + brownfield citation):
- §7.3 "cached prefix per service" → clarified as "structure prompt so service-stable text is at the front" (DeepSeek caching is automatic on identical prefixes, no explicit cache_control headers).
- Public Claude Code time windows → 7d for cache hit / CLI time, 30d for tokens / cost / sessions (matches prototype).
- `/api/public/services` ordering → by status desc (worst first), then `display_name` asc.
- Frontend admin TZ → Asia/Singapore (locked in C25, matches prototype Local-time chip).
- Rate-limit: 60 req/min per-token, fixed-window in v0.1 (sliding window is YAGNI at expected 1 req/min).
- `affected_subchecks` sentinel `_heartbeat_lost_` → confirmed as documented sentinel string for the §7.1 push-loss case.
- `deepseek_context` size: SOFT cap 8 KB warning in admin UI (no DB constraint); future hard cap if needed.

## Technical Context

### Brownfield citations gathered before/during interview

- **`/home/lushuyu/Aglaea/SPEC.md`** — 723-line authoritative spec v0.1. Loaded in full.
- **`/home/lushuyu/Aglaea/CLAUDE_CODE_PROMPT.md`** — 184-line briefing prompt. §A context loading order, §B interview targets, §C phasing, §D 11 non-negotiables, §E communication preferences, §F output expectations.
- **`/home/lushuyu/Aglaea/docs/design/`** — full Claude Design bundle (placed in repo this session). `Aglaea.html` is React-via-Babel-CDN single-file prototype; `src/tokens.css` (12 KB) + `src/screens.css` (24 KB) are the styling contract; `src/{data,components,charts,public,auth,admin,design-system,tweaks-panel}.jsx` are the code references. Chat transcript `chats/chat1.md` captures the gold-on-dark Newsreader aesthetic decision.
- **`/home/lushuyu/Cerydra/cerydra`** — private repo. Confirmed: `push/doctor.py` returns `list[str]` (text lines), runs 8 probes in parallel; `monitoring/heartbeat.py` + `monitoring/ntfy.py` already exist; `report/{worker,service,claude_runner}.py` is the LLM report stack; `llm/deepseek.py` is the existing DeepSeek client to reference (not necessarily reuse).
- **`/home/lushuyu/hyacine`** — public OSS. **MIT license** confirmed (2026 The HyacineAI contributors). pyproject: `requires-python = ">=3.11,<3.13"`, FastAPI ≥0.115, SQLAlchemy ≥2.0, Pydantic ≥2.9 + pydantic-settings, httpx ≥0.27. Has `scripts/doctor.py` + `tests/test_doctor.py` + `tests/test_monitoring.py`. NO existing `webhook_reporter` module — greenfield addition when deferral lifts.
- **Aglaea repo** — not yet `git init`. Only files at root before this session: `SPEC.md`, `CLAUDE_CODE_PROMPT.md`. This session added `docs/design/` and `.omc/state/` + `.omc/specs/`.

### CloudFlare topology (per maintainer R5 answer)

```
[Device / Browser]
       │
       │ HTTPS (CF Universal SSL, auto)
       ▼
[Cloudflare edge]
       │
       │ HTTPS (Origin CA wildcard *.lushuyu.site, ~15y)
       ▼
[nginx on sg-server]    ─── proxy_pass ───►   [aglaea-frontend / aglaea-backend / otelcol]
                                              (all docker-internal, no host port mapping)
```

DNS records for `status.lushuyu.site` and `otel.lushuyu.site` MUST be set orange-cloud (proxied through CF).

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| Service | core domain | slug, display_name, description, kind (push\|pull), expected_interval_seconds, probe_url, probe_interval_seconds, probe_timeout_seconds, probe_expected_status, last_heartbeat_at, last_status, last_subchecks, last_message, deepseek_context, public_visible | has many ApiKey · has many HeartbeatEvent · has many Incident |
| ApiKey | core domain | label, key_hash (argon2id), key_prefix, created_at, last_used_at, revoked_at | belongs to Service |
| HeartbeatEvent | core domain (TimescaleDB hypertable, 7d compress, 30d drop) | ts, service_id, status (ok\|degraded\|down), subchecks (JSONB), metrics (JSONB), message, source (push\|probe), client_ts | belongs to Service |
| Incident | core domain (permanent) | status (ongoing\|resolved), started_at, resolved_at, initial_failure_payload, final_recovery_payload, affected_subchecks (monotone set), report_state (none\|draft\|published\|rejected), report_text, report_generated_at, report_generation_count, report_generation_reason, published_text, published_at, published_by | belongs to Service · published_by AdminUser |
| AdminUser | core domain | github_login, github_id, created_at, last_login_at, deleted_at (soft delete) | publishes Incident |
| AuditLog | supporting | ts, actor_type, actor_id, event, ip, details (JSONB incl. request_id) | references any entity by id in details |
| ReportTrigger | supporting (enum) | priority, name (INITIAL, SUBCHECK_CHANGED, PERIODIC, FINAL) | used by report_generator |
| DeepSeekContext | external system | cached_prefix (per-service system + deepseek_context), dynamic_suffix (allowlisted heartbeat timeline + allowlisted similar incidents) | consumes Incident + HeartbeatEvent + Service via LLM_CONTEXT_FIELDS_* allowlists |
| OTELStream | external system | host_name (admin-only), model, tokens, cost_usd, session_id | dropped of user.email / user.account_uuid at OTel Collector |
| WebhookReporter (Cerydra) | external system | endpoint, token, interval_seconds, enabled, in-memory ring buffer (capacity 100) | produces HeartbeatEvent via POST /api/v1/heartbeat |

## Ontology Convergence

| Round | Entity count | New | Changed | Stable | Stability ratio |
|---|---:|---:|---:|---:|---:|
| 1 | 8 | 8 | – | – | N/A |
| 2 | 8 | 0 | 0 | 8 | 100% |
| 3 | 8 | 0 | 0 | 8 | 100% |
| 4 | 9 (+WebhookReporter, after Cerydra discussion) | 1 | 0 | 8 | 89% |
| 5 | 9 | 0 | 0 | 9 | 100% |
| 6 | 10 (+ReportTrigger enum) | 1 | 0 | 9 | 90% |

Domain model stabilized by Round 2 and stayed essentially flat — Round 4 added the `WebhookReporter` boundary entity (already implied in SPEC §11/§12 but not previously enumerated); Round 6 added the `ReportTrigger` enum, which formalises C39's single-source-of-truth precedence requirement. No entities renamed across the 6 rounds.

## Interview Transcript

<details>
<summary>Full Q&A (6 rounds, batched 4 questions per round per maintainer preference)</summary>

### Round 0 — Topology gate
**Q:** Is the 5-component topology right? Add/remove/merge/defer?
**A:** Defer Hyacine reporter — keep in spec as future-work, exclude from ambiguity math.
**Lock:** 4 active (Backend, Frontend, Infra, Cerydra) + 1 deferred (Hyacine).

### Round 1 — Backend / Constraints (stack pins)
**Q1 Python version:** 3.12. Tracked as two artifacts: `python:3.12-slim` Docker tag AND `requires-python = ">=3.12"`.
**Q2 DB driver:** asyncpg only. Alembic uses the SAME engine via async_engine_from_config + run_async. NO psycopg2-binary.
**Q3 ORM:** SQLAlchemy 2.x async + Alembic. TimescaleDB DDL in `upgrade()` raw SQL blocks tagged `# === TimescaleDB-specific (manual) ===`.
**Q4 Deps:** uv + uv.lock; `uv sync --frozen` in Docker.
**Ambiguity after:** Backend 12.8%, Frontend 34.5%, Infra 25.3%, Cerydra 37.3%.

### Round 2 — Cross-cutting / SPEC ambiguities
**Q1 HMAC:** Drop for v0.1. Bearer + mandatory `X-Aglaea-Timestamp` ±5min. Non-breaking migration path.
**Q2 Workers:** Single container, asyncio.create_task() from lifespan. Hard timeouts. Never silently die.
**Q3 Allowlist:** Single source-of-truth at `security/visibility.py` exporting frozenset constants. Pydantic models reference them.
**Q4 Bootstrap allowlist:** Table authoritative; `BOOTSTRAP_GITHUB_LOGIN` = idempotent INSERT trigger. Soft-deleted rows don't satisfy check.
**Ambiguity after:** Backend 12.8%, Frontend 34.5%, Infra 20.5%, Cerydra 30.4%.

### Round 3 — Frontend / Constraints
**Q1 Next.js:** 15.x + App Router. `app/(public)/` + `app/admin/` route groups.
**Q2 TypeScript:** strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes (aligned with backend Pydantic strict).
**Q3 Styling:** Verbatim port of tokens.css + screens.css. CSS Modules for components. No hex / px literal in components.
**Q4 Data fetching:** Hybrid by route type. RSC + revalidate:30 for public; Server Actions for admin static; TanStack Query for admin interactive (`<QueryClientProvider>` in admin layout only).
**Ambiguity after:** Backend 12.8%, Frontend 14%, Infra 20.5%, Cerydra 30.4%.

### Round 4 — Cerydra (Contrarian challenge)
**Q1 Push vs Pull (Contrarian):** Keep push. Cerydra owns scheduling.
**Q2 Module path:** `cerydra/monitoring/webhook.py` generic. Mirrors Hyacine §12.
**Q3 Subcheck set:** **6 keys, not SPEC §11's 4** — jin10 + cls + wscn + moomoo + deepseek + discord. cls/wscn are tier-equivalent news sources; hiding them is lying by omission. Frontend strip layout deferred to Claude Design.
**Q4 Env names:** `WEBHOOK_REPORTER_*`. Module code near-copy-pasteable between repos.
**Ambiguity after:** Backend 12.8%, Frontend 14%, Infra 20.5%, Cerydra 12.8%.

### Round 5 — Infrastructure
**Q1 TLS:** Reuse Cloudflare Origin CA wildcard `*.lushuyu.site`. No certbot. Reuse Cerydra's existing deploy.
**Q2 nginx:** Single `sites-available/aglaea.conf` symlinked.
**Q3 Logging:** JSON-stdout via python-json-logger. New `RequestIDMiddleware` is v0.1's only tracing.
**Q4 Ops:** No Sentry. healthchecks.io self-ping ON (60s asyncio worker, env-gated). No backup per SPEC §14.
**Ambiguity after:** Backend 12.8%, Frontend 14%, Infra 6.5%, Cerydra 12.8%.

### Round 6 — Backend cleanup (Simplifier challenge)
**Q1 T1 (Simplifier):** Drop T1. LLM is narrative, real-time state is in skeleton + swimlane. Active tiers: T0/T2/T3. `affected_subchecks` tracking still maintained.
**Q2 Precedence:** Hard order T3 > T0 > T1 > T2. Single enum + `max()` site. T1 reserved for v1.x.
**Q3 Close rule:** Top-level ok AND all `affected_subchecks` ok for last 3 heartbeats. `affected_subchecks` is monotone.
**Q4 Cert-warn:** Global `CERT_WARN_DAYS = 14` in `config.py`. No per-service column.
**Ambiguity after:** Backend 5.5%, Frontend 14%, Infra 6.5%, Cerydra 12.8%. **Threshold met.**

</details>

## Implementation phasing (from CLAUDE_CODE_PROMPT §C, re-affirmed)

Each phase is independently testable. The first 5 phases can be sequenced; Phase 6 (Frontend) and Phase 7 (Infra) can run in parallel after Phase 5; Phase 8 (Integration) requires Phases 3+4 done; Phase 9 (Hardening) runs last but should be drafted alongside as a moving checklist.

- **Phase 0** — Repo scaffolding (`pyproject.toml` with `uv` + `requires-python = ">=3.12"`, `package.json` with Next 15, `docker-compose.yml` skeleton, Alembic init with async env.py, `.env.example`, `.gitignore`, `git init`).
- **Phase 1** — Database & migrations (SPEC §5 schema; Alembic migration with TimescaleDB raw-SQL blocks tagged `# === TimescaleDB-specific (manual) ===`; seed script).
- **Phase 2** — Backend auth & security (GitHub OAuth callback + table-authoritative allowlist with `BOOTSTRAP_GITHUB_LOGIN` idempotent INSERT, session middleware, bearer token auth, `X-Aglaea-Timestamp` validation, audit logging, `security/visibility.py` frozenset constants).
- **Phase 3** — Service registry & heartbeat ingest (services CRUD, api_keys CRUD with one-shot plaintext modal, `POST /api/v1/heartbeat` validating timestamp + bearer + Pydantic strict).
- **Phase 4** — Workers (incident_detector with monotone `affected_subchecks` + close rule; pull_prober with CERT_WARN_DAYS=14; report_generator with T0/T2/T3 + precedence enum + LLM allowlist enforcement at `llm/context.py`; self-ping worker).
- **Phase 5** — Read APIs (public read endpoints with hardcoded PromQL + host_name stripping; admin read endpoints; audit log API; PromQL ad-hoc endpoint without confirmation step per N15).
- **Phase 6** — Frontend (Next.js 15 App Router; verbatim CSS port; hybrid data strategy; routes from prototype).
- **Phase 7** — Infrastructure (docker-compose finalization, `infra/nginx.conf.example` referencing CF Origin CA cert paths, `infra/otelcol-config.yaml` with PII-drop processors, `infra/ufw-rules.sh`, `scripts/bootstrap.sh`).
- **Phase 8** — Integration: Cerydra `cerydra/monitoring/webhook.py` with the 6-subcheck projection + `WEBHOOK_REPORTER_*` envs; OTel device-side configuration docs for Mac / Win / SG-VPS. (Hyacine reporter deferred per Round 0.)
- **Phase 9** — Hardening verification: walk §AC.5 checklist; close any gaps.

Parallelizable:
- Phase 6 & Phase 7 after Phase 5.
- Phase 8 can begin once Phase 3 (heartbeat ingest endpoint live in staging) is ready, even before Phase 4 worker logic is final.
