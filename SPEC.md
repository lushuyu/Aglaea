# Aglaea v0.1 — Specification

> Personal SRE & monitoring platform. Single maintainer: Shuyu (@lushuyu).
> Status: v0.1 design complete, implementation pending.

---

## 1. Overview

**Aglaea** does two things in one platform:

1. **Public status page** (`status.lushuyu.site`) — service uptime, incident history, aggregated Claude Code usage analytics. No auth.
2. **Private admin dashboard** (`status.lushuyu.site/admin`) — full management of services, API keys, incident drafts, sensitive metrics. GitHub OAuth, single user allowlist.

Aglaea ingests telemetry from two sources:

- **Claude Code OTEL stream** from Shuyu's three devices (Mac, Win, SG-VPS). Aggregated time-series in VictoriaMetrics.
- **Service heartbeats** pushed (Hyacine, Cerydra) and pulled (static pages). State + history in PostgreSQL/TimescaleDB.

Aglaea **does not** replace `healthchecks.io` or `ntfy`. Those continue to serve critical alerting. Aglaea adds visualization and historical record-keeping with LLM-assisted post-mortems.

**Out of scope for v0.1**: Cipher integration (Cipher not yet deployed), JS RUM beacons, mobile-first UI, i18n, WCAG audit, automated backups, multi-user, real-time WebSocket, incident pattern auto-clustering.

---

## 2. Architecture

```
Claude Code on Mac/Win/SG-VPS
        │ OTLP/HTTP + bearer
        ▼
[OTel Collector]   drops PII (user.email, account_uuid)
        │ remote_write
        ▼
[VictoriaMetrics]   1y retention
        ▲
        │ PromQL (read-only)
        │
┌───────┴────────────────────────────────────────────┐
│  Aglaea Backend (FastAPI, Python 3.12+)            │
│   ├─ Public read API (sanitized, PromQL hardcoded) │
│   ├─ Admin API (full access, OAuth session)        │
│   ├─ Service push API (bearer + optional HMAC)     │
│   ├─ Incident detector (background worker)         │
│   ├─ Pull prober (background worker)               │
│   └─ LLM report generator (DeepSeek V4 Pro)        │
└───────┬────────────────────────────────────────────┘
        │
        ▼
[PostgreSQL 16 + TimescaleDB]   services / heartbeat_events / incidents / api_keys / admin_users / audit_log

[Aglaea Frontend (Next.js, TypeScript)]
   ├─ /status (public)
   └─ /admin (auth-gated)

[Hyacine on NUS server] ───HTTPS heartbeat + bearer──┐
[Cerydra on SG VPS]     ───HTTPS heartbeat + bearer──┤───► Aglaea
[Static pages]          ◄────HTTP GET from Aglaea────┘
```

All Aglaea components are co-located on the Singapore VPS (`sg-server.lushuyu.site`). Nginx is the only public-facing component; Postgres/VM/Collector are bound to the docker internal network only.

---

## 3. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Backend language | Python 3.12+ | Match Cipher pattern, async-friendly |
| Web framework | FastAPI | Same as Cipher, mature OAuth/Pydantic ecosystem |
| Schema validation | Pydantic v2, strict mode | Unknown fields → 400 |
| Relational DB | PostgreSQL 16 + TimescaleDB extension | Reuse Cipher operational knowledge |
| Time-series DB | VictoriaMetrics 1.103+ | OTel-native via remote_write, low ops |
| OTLP ingest | OpenTelemetry Collector (contrib) | Decouples Aglaea from telemetry hot path |
| LLM | DeepSeek V4 Pro | Cheap, prompt cache-friendly, API key reused from Cerydra |
| Frontend | Next.js (App Router) + TypeScript | Match design output from Claude Design |
| Reverse proxy | nginx (existing on SG VPS) | Maintainer edits conf directly |
| Containerization | docker-compose | Match Cerydra pattern |
| Background jobs | Single in-process asyncio tasks from FastAPI lifespan (locked v0.1; C18) | Personal scale, no Celery needed; split-container migration is 1-PR if needed |
| Migrations | Alembic | Standard for SQLAlchemy/Postgres |
| Auth (admin) | GitHub OAuth + session cookie | Single user, allowlist |
| Auth (service push) | Per-service bearer token (argon2 hash) | Standard |
| Notifications | Existing ntfy + healthchecks.io | Aglaea does not duplicate |

---

## 4. Repository layout

```
Aglaea/
├── README.md
├── SPEC.md                       (this file)
├── docker-compose.yml
├── .env.example
├── .gitignore
├── docs/
│   ├── design/                   (Claude Design output)
│   └── architecture-notes.md
├── infra/
│   ├── nginx.conf.example        (snippet to add to sg-server's nginx)
│   ├── otelcol-config.yaml
│   └── ufw-rules.sh
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/
│   ├── aglaea/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routers/
│   │   │   ├── public.py
│   │   │   ├── admin.py
│   │   │   ├── service_push.py
│   │   │   └── auth.py
│   │   ├── workers/
│   │   │   ├── incident_detector.py
│   │   │   ├── pull_prober.py
│   │   │   └── report_generator.py
│   │   ├── llm/
│   │   │   ├── deepseek.py
│   │   │   └── prompts.py
│   │   └── security/
│   │       ├── auth.py
│   │       ├── hmac.py
│   │       └── audit.py
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── (public)/
│   │   │   └── admin/
│   │   ├── components/
│   │   ├── lib/
│   │   └── styles/
│   └── public/
└── scripts/
    ├── bootstrap.sh
    └── generate-token.py
```

---

## 5. Data model

### 5.1 Schema (PostgreSQL + TimescaleDB)

```sql
-- admin users
CREATE TABLE admin_users (
    id            BIGSERIAL PRIMARY KEY,
    github_login  TEXT NOT NULL UNIQUE,
    github_id     BIGINT NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- service registry
CREATE TYPE service_kind AS ENUM ('push', 'pull');

CREATE TABLE services (
    id                          BIGSERIAL PRIMARY KEY,
    slug                        TEXT NOT NULL UNIQUE
                                  CHECK (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
    display_name                TEXT NOT NULL,
    description                 TEXT,
    kind                        service_kind NOT NULL,
    public_visible              BOOLEAN NOT NULL DEFAULT TRUE,

    expected_interval_seconds   INT,
    probe_url                   TEXT,
    probe_interval_seconds      INT DEFAULT 60,
    probe_timeout_seconds       INT DEFAULT 10,
    probe_expected_status       INT DEFAULT 200,

    last_heartbeat_at           TIMESTAMPTZ,
    last_status                 TEXT,
    last_subchecks              JSONB,
    last_message                TEXT,

    deepseek_context            TEXT,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT push_must_have_interval CHECK
        (kind != 'push' OR expected_interval_seconds IS NOT NULL),
    CONSTRAINT pull_must_have_url CHECK
        (kind != 'pull' OR probe_url IS NOT NULL)
);
CREATE INDEX idx_services_public ON services(public_visible) WHERE public_visible;

-- API keys
CREATE TABLE api_keys (
    id            BIGSERIAL PRIMARY KEY,
    service_id    BIGINT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    label         TEXT NOT NULL,
    key_hash      TEXT NOT NULL,                  -- argon2
    key_prefix    TEXT NOT NULL,                  -- first 8 chars, UI display only
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at  TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    UNIQUE(service_id, label)
);
CREATE INDEX idx_api_keys_active ON api_keys(service_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

-- heartbeat events (TimescaleDB hypertable)
CREATE TABLE heartbeat_events (
    ts          TIMESTAMPTZ NOT NULL,             -- server-receive time
    service_id  BIGINT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status      TEXT NOT NULL,
    subchecks   JSONB,
    metrics     JSONB,
    message     TEXT,
    source      TEXT NOT NULL,                    -- push | probe
    client_ts   TIMESTAMPTZ,                      -- diagnostic only
    PRIMARY KEY (service_id, ts)
);
SELECT create_hypertable('heartbeat_events', 'ts');
ALTER TABLE heartbeat_events SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'service_id'
);
SELECT add_compression_policy('heartbeat_events', INTERVAL '7 days');
SELECT add_retention_policy('heartbeat_events', INTERVAL '30 days');

-- incidents (permanent)
CREATE TYPE incident_status AS ENUM ('ongoing', 'resolved');
CREATE TYPE incident_report_state AS ENUM ('none', 'draft', 'published', 'rejected');

CREATE TABLE incidents (
    id                        BIGSERIAL PRIMARY KEY,
    service_id                BIGINT NOT NULL REFERENCES services(id),
    status                    incident_status NOT NULL DEFAULT 'ongoing',
    started_at                TIMESTAMPTZ NOT NULL,
    resolved_at               TIMESTAMPTZ,
    initial_failure_payload   JSONB,
    final_recovery_payload    JSONB,
    affected_subchecks        TEXT[],

    report_state              incident_report_state NOT NULL DEFAULT 'none',
    report_text               TEXT,
    report_generated_at       TIMESTAMPTZ,
    report_generation_count   INT NOT NULL DEFAULT 0,
    report_generation_reason  TEXT,

    published_text            TEXT,
    published_at              TIMESTAMPTZ,
    published_by              BIGINT REFERENCES admin_users(id),

    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_incidents_service_started ON incidents(service_id, started_at DESC);
CREATE INDEX idx_incidents_ongoing ON incidents(service_id, started_at DESC)
    WHERE status = 'ongoing';
CREATE INDEX idx_incidents_published ON incidents(service_id, started_at DESC)
    WHERE published_at IS NOT NULL;

-- audit log
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_type  TEXT NOT NULL,
    actor_id    TEXT,
    event       TEXT NOT NULL,
    ip          INET,
    details     JSONB
);
CREATE INDEX idx_audit_log_ts ON audit_log(ts DESC);
CREATE INDEX idx_audit_log_event ON audit_log(event, ts DESC);
```

### 5.2 Retention policy

| Data | Storage | Retention |
|---|---|---|
| OTEL metrics | VictoriaMetrics | 1 year |
| Heartbeat events | Postgres TimescaleDB | Compress at 7d, drop at 30d |
| Incidents | Postgres | Permanent |
| Audit log | Postgres | Permanent (low volume) |

---

## 6. API routes

### 6.1 Public (no auth, output already sanitized)

| Method | Path | Description |
|---|---|---|
| GET | `/api/public/services` | All `public_visible=true` services, current state |
| GET | `/api/public/services/{slug}` | Single service detail |
| GET | `/api/public/services/{slug}/incidents` | Incident history, `published_text` only |
| GET | `/api/public/services/{slug}/incidents/{id}` | Single incident |
| GET | `/api/public/claude-code/series/{metric}` | Pre-defined aggregated Claude Code metrics |

Allowed metric whitelist for `/api/public/claude-code/series/{metric}`:
`token-total`, `token-by-model`, `cost-trend`, `cache-hit-rate`, `active-time-ratio`, `sessions-daily`, `commits-daily`, `loc-daily`, `active-hours-heatmap`, `terminal-type-share`.

All PromQL queries are hardcoded in the backend. `host.name` dimension is always aggregated away (`sum without (host_name)`).

### 6.2 Service push (bearer token)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/heartbeat` | Service identity derived from bearer token |

Request body (Pydantic strict, unknown fields → 400):

```json
{
  "status": "ok",                          // required: ok | degraded | down
  "subchecks": {                           // optional, nested
    "jin10":    {"status": "ok",       "latency_ms": 120},
    "moomoo":   {"status": "degraded", "latency_ms": 4800, "message": "high latency"},
    "deepseek": {"status": "ok"}
  },
  "metrics": {                             // optional, service-defined
    "last_generate_count": 12,
    "claude_headless_ok": true
  },
  "message": "fetched 12 mails",
  "client_ts": "2026-05-13T07:30:00Z"
}
```

Optional headers for replay protection:
- `X-Aglaea-Signature: hmac-sha256(token_secret, body)`
- `X-Aglaea-Timestamp: <unix epoch>` (requests with `|now - ts| > 300s` rejected)

### 6.3 Admin (GitHub OAuth + session cookie)

| Method | Path | Description |
|---|---|---|
| GET  | `/api/auth/github/login` | Redirect to GitHub |
| GET  | `/api/auth/github/callback` | Callback, allowlist check, signin |
| POST | `/api/auth/logout` | |
| GET  | `/api/auth/me` | Current admin info |
| GET  | `/api/admin/services` | All services |
| POST | `/api/admin/services` | Create |
| PATCH | `/api/admin/services/{id}` | Update |
| DELETE | `/api/admin/services/{id}` | Soft delete |
| POST | `/api/admin/services/{id}/keys` | Generate key (plaintext returned **once**) |
| DELETE | `/api/admin/services/{id}/keys/{key_id}` | Revoke |
| GET | `/api/admin/incidents?status=&service_id=` | List |
| GET | `/api/admin/incidents/{id}` | Detail with `report_text` (latest draft) |
| POST | `/api/admin/incidents/{id}/regenerate` | Manual regenerate, optional `instruction` |
| POST | `/api/admin/incidents/{id}/publish` | Copy `report_text` → `published_text` |
| POST | `/api/admin/incidents/{id}/reject` | Set `report_state=rejected` |
| PATCH | `/api/admin/incidents/{id}/report` | Manual edit of `report_text` |
| GET | `/api/admin/claude-code/series/{metric}` | Full metrics with `host_name` dimension |
| GET | `/api/admin/claude-code/raw-query?promql=...` | Ad-hoc PromQL (admin only) |
| GET | `/api/admin/audit-log?event=&since=` | |

---

## 7. Background workers

### 7.1 Incident detector

Runs every 10s. For each service:

- **Open incident**:
  - If `kind=push` and `now - last_heartbeat_at > expected_interval_seconds × 2` and no ongoing incident → open with `affected_subchecks=['_heartbeat_lost_']`
  - If `last_status != 'ok'` and no ongoing incident → open with `affected_subchecks` derived from `last_subchecks` failing keys
- **Close incident**:
  - If ongoing exists and last 3 consecutive heartbeats are `ok` → set `status=resolved`, `resolved_at=NOW()`, capture `final_recovery_payload`
- **Subcheck change detection**:
  - During ongoing, compare current `last_subchecks` to incident's last-known subcheck state. If changed, trigger report regeneration with `reason=subcheck_changed`.

### 7.2 Pull prober

For each `kind=pull` service, scheduled at `probe_interval_seconds`:

1. HTTPS GET `probe_url` with `probe_timeout_seconds`
2. Determine status:
   - HTTP status code == `probe_expected_status` → `ok`
   - Cert expires within `CERT_WARN_DAYS = 14` days (global constant in `backend/aglaea/config.py`, not per-service) → `degraded` (override `ok` to `degraded`) with `message='cert expires in N days'`
   - Cert already expired → `down`
   - Connection refused / timeout / wrong status → `down`
3. Insert `heartbeat_events` row with `source='probe'`
4. Update `services.last_*`

### 7.3 Report generator

Triggered by incident detector or admin manual request. Throttling rules:

- **T0**: Incident first opened → generate immediately, `reason='initial'`
- **T1**: *(DROPPED in v0.1 per deep-interview C38)* — `enum ReportTrigger.SUBCHECK_CHANGED` is reserved in code with `.priority` value for v1.x revival, but the incident detector NEVER enqueues it. Runtime assertion at `report_generator.run_trigger()` entry catches accidental enqueue.
- **T2**: 30 minutes since last generation while ongoing → generate, `reason='periodic'`
- **T3**: Incident transitions to `resolved` → generate, `reason='final'`
- Hard cap: `report_generation_count > 12` → emit ntfy alert, stop auto-generation
- Trigger precedence: T3 > T0 > T1 > T2 via single enum + `max(triggers, key=lambda t: t.priority)` site

LLM call:

```
[CACHED PREFIX, per service]
- System prompt (style, format, allowlist reminder)
- service.deepseek_context (long-form description)

[DYNAMIC SUFFIX]
- Incident metadata (started_at, status, duration, affected_subchecks)
- Heartbeat timeline during incident (allowlist fields only)
- Recent similar incidents (last 30d, same service, allowlist fields only)
- Optional admin instruction (if regenerate triggered manually)
```

**Allowlist enforcement** is at the data assembly layer (`backend/aglaea/llm/context.py`), not just in prompt templates. Fields not in allowlist cannot reach the LLM regardless of prompt phrasing.

Failure handling: DeepSeek API errors leave incident `report_state=none` (or previous state) untouched. Admin can manually retry from UI.

---

## 8. Public/private boundary

### 8.1 Claude Code OTEL data

| Field | Visibility | Mechanism |
|---|---|---|
| Token total trends (count + USD) | Public | Aggregated |
| Cost USD trends + totals | Public | Aggregated |
| Model split (Opus/Sonnet/Haiku) | Public | Aggregated |
| Cache hit rate | Public | Aggregated |
| Active time CLI/user ratio | Public | Aggregated |
| Sessions / commits / PRs / LOC daily | Public | Aggregated |
| Active hours heatmap (7×24) | Public | Aggregated |
| Terminal type share | Public | Aggregated |
| `host.name` (mac / win / sg-vps) | Restricted | Stripped in public API; visible in admin |
| `user.email` | Never stored | Dropped at OTel Collector processor |
| `user.account_uuid` | Never stored | Dropped at OTel Collector processor |

### 8.2 Service monitoring data

| Field | Visibility |
|---|---|
| Service up/down state | Public |
| Service uptime % | Public |
| Service display names (Hyacine / Cerydra / etc.) | Public |
| Subcheck names + states (jin10 / moomoo / deepseek / discord) | Public |
| Service deployment IP / hostname | Never stored |
| Hyacine `last_generate_count` | Restricted |
| Hyacine `claude_headless_ok` boolean | Public |
| Incident `published_text` | Public (after admin publish) |
| Incident `report_text` (latest auto draft) | Restricted |
| Incident skeleton during ongoing-unpublished | Public (subcheck states + timeline only, **no LLM-generated text**) |
| Audit log | Restricted |

---

## 9. Security hardening

### 9.1 Postgres

- No `ports:` mapping in docker-compose; only docker-internal network access
- `POSTGRES_PASSWORD` generated via `openssl rand -base64 32`, stored in `.env` (chmod 600, gitignored)
- `--auth-host=scram-sha-256 --auth-local=scram-sha-256`
- Connections only from `aglaea-backend` container by name (docker DNS)

### 9.2 VictoriaMetrics & OTel Collector

- No `ports:` mapping; docker-internal only
- OTLP/HTTP endpoint (4318) reverse-proxied through nginx, never exposed directly
- Bearer auth check at nginx layer (`OTEL_SHARED_TOKEN` from `.env`)

### 9.3 Network

- `ufw default deny incoming`
- Only 22 / 80 / 443 open at host level
- All other communication via docker internal networks

### 9.4 Application

- Per-service bearer tokens, argon2id hashed at rest. All argon2 `verify(...)` calls MUST be wrapped in `await asyncio.to_thread(...)` (CPU-bound ~50-200ms; gates the event loop otherwise).
- Plaintext returned only once at generation (UI modal with explicit "I have copied this" confirmation)
- **HMAC deferred to v1.x (C17).** v0.1 requires `X-Aglaea-Timestamp` header (unix epoch seconds, ±300s window) as mandatory replacement. Missing/out-of-window → 401 + `audit_log(event=auth.timestamp_window_rejected, ...)`. Migration path to add HMAC is non-breaking: add `api_keys.hmac_secret_hash` column + UI modal field.
- Pydantic strict mode: unknown fields → 400; heartbeat body cap 64 KB (>64 KB → 413)
- Rate limit: per-token 60 req/min (heartbeat push)
- All auth failures (401/403) and key revocations logged to `audit_log`; >10 failures/min → ntfy alert

### 9.5 Frontend

- HttpOnly + SameSite=Lax session cookie for admin
- CSP header restricting external script sources
- No service IPs / internal paths / stack traces ever rendered on public pages
- Non-allowlist GitHub login attempt returns generic friendly error (no info leak)

### 9.6 Domain obscurity

- Aglaea is **not** linked from public-facing project pages
- `robots.txt` disallows admin paths from indexing (additional defense, not primary)
- `status.lushuyu.site` is the only public domain

---

## 10. Deployment

### 10.1 docker-compose.yml (key services)

```yaml
services:
  postgres:
    image: timescale/timescaledb:2.17.0-pg16
    environment:
      POSTGRES_USER: aglaea
      POSTGRES_DB: aglaea
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --auth-local=scram-sha-256"
    volumes: [pg_data:/var/lib/postgresql/data]
    networks: [internal]
    restart: unless-stopped

  victoriametrics:
    image: victoriametrics/victoria-metrics:v1.103.0
    command:
      - '--retentionPeriod=1y'
      - '--storageDataPath=/storage'
      - '--httpListenAddr=:8428'
    volumes: [vm_data:/storage]
    networks: [internal]
    restart: unless-stopped

  otelcol:
    image: otel/opentelemetry-collector-contrib:0.111.0
    command: ["--config=/etc/otelcol/config.yaml"]
    volumes:
      - ./infra/otelcol-config.yaml:/etc/otelcol/config.yaml:ro
    environment:
      - OTEL_SHARED_TOKEN=${OTEL_SHARED_TOKEN}
    networks: [internal]
    restart: unless-stopped
    depends_on: [victoriametrics]

  aglaea-backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://aglaea:${POSTGRES_PASSWORD}@postgres:5432/aglaea
      VM_URL: http://victoriametrics:8428
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY}
      GITHUB_OAUTH_CLIENT_ID: ${GITHUB_OAUTH_CLIENT_ID}
      GITHUB_OAUTH_CLIENT_SECRET: ${GITHUB_OAUTH_CLIENT_SECRET}
      SESSION_SECRET: ${SESSION_SECRET}
      BOOTSTRAP_GITHUB_LOGIN: ${BOOTSTRAP_GITHUB_LOGIN}
    networks: [internal]
    depends_on: [postgres, victoriametrics]
    restart: unless-stopped

  aglaea-frontend:
    build: ./frontend
    networks: [internal]
    depends_on: [aglaea-backend]
    restart: unless-stopped

volumes:
  pg_data:
  vm_data:

networks:
  internal:
    driver: bridge
```

### TLS topology (locked v0.1; C31)

TLS uses **Cloudflare Origin CA wildcard certificate** for `*.lushuyu.site` (~15-year validity), reusing Cerydra's existing deploy pattern on the same sg-server. No certbot, no acme.sh, no cron. DNS for `status.lushuyu.site` + `otel.lushuyu.site` MUST be orange-cloud (CF proxy).

```
[Device / Browser] --HTTPS (CF Universal SSL)--> [Cloudflare edge]
                                                       |
                                                       v
                                                  --HTTPS (Origin CA *.lushuyu.site)--> [nginx on sg-server]
                                                                                              |
                                                                                              v
                                                                                        [docker-internal services]
```

Repo ships `infra/nginx.conf.example` referencing the existing Origin CA cert+key paths; first deploy step is to SSH the VPS and discover the exact path from Cerydra's existing nginx config.

### 10.2 nginx server block (add to existing nginx config)

```nginx
server {
    listen 443 ssl http2;
    server_name status.lushuyu.site;

    ssl_certificate     /path/to/cert;
    ssl_certificate_key /path/to/key;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:<frontend-port>;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:<backend-port>;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# OTLP/HTTP receiver (separate subdomain or path)
server {
    listen 443 ssl http2;
    server_name otel.lushuyu.site;

    ssl_certificate     /path/to/cert;
    ssl_certificate_key /path/to/key;

    location / {
        if ($http_authorization != "Bearer ${OTEL_SHARED_TOKEN}") {
            return 401;
        }
        proxy_pass http://127.0.0.1:<otelcol-http-port>;
        proxy_set_header Host $host;
    }
}
```

(Maintainer adapts ports and TLS paths to existing nginx layout.)

### 10.3 .env template (`.env.example`, real `.env` is gitignored + chmod 600)

```bash
POSTGRES_PASSWORD=                 # openssl rand -base64 32
DEEPSEEK_API_KEY=                  # reused from Cerydra's .env (copy value, do not cat)
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
SESSION_SECRET=                    # openssl rand -hex 32
OTEL_SHARED_TOKEN=                 # openssl rand -hex 32
HEALTHCHECKS_SELFPING_URL=         # optional; env-gates the self-ping worker
BOOTSTRAP_GITHUB_LOGIN=lushuyu     # config string, idempotent INSERT trigger for first admin row
```

**Env enumeration (locked v0.1; deep-interview C-A2)**: 7 secrets (`POSTGRES_PASSWORD`, `DEEPSEEK_API_KEY`, `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `SESSION_SECRET`, `OTEL_SHARED_TOKEN`, `HEALTHCHECKS_SELFPING_URL`) + 1 config string (`BOOTSTRAP_GITHUB_LOGIN`) = 8 vars total.

### 10.4 Bootstrap procedure (cold start)

1. Generate secrets: `POSTGRES_PASSWORD`, `SESSION_SECRET`, `OTEL_SHARED_TOKEN` (all via `openssl rand`)
2. Copy `DEEPSEEK_API_KEY` from Cerydra's `.env` (manual paste; do not `cat`)
3. Register GitHub OAuth app at `https://github.com/settings/applications/new`, set callback to `https://status.lushuyu.site/api/auth/github/callback`, copy client ID + secret to Aglaea `.env`
4. `docker compose up -d`
5. Run Alembic migrations: `docker compose exec aglaea-backend alembic upgrade head`
6. Add nginx server block, reload nginx
7. Visit `https://status.lushuyu.site/admin` → "Sign in with GitHub" → first login for `BOOTSTRAP_GITHUB_LOGIN` auto-inserts row in `admin_users`
8. Via admin UI: register services (Hyacine, Cerydra, static pages), generate API tokens, copy tokens once
9. Configure devices' Claude Code with OTEL settings pointing at `https://otel.lushuyu.site`
10. Configure Hyacine/Cerydra reporter modules with Aglaea endpoint and tokens

---

## 11. Integration: Cerydra (private repo)

- Cerydra already exists at `~/cerydra` (or similar; Claude Code to locate via `find ~ -maxdepth 3 -name cerydra -type d`)
- Add `webhook_reporter` module to Cerydra following the same shape as Hyacine's (see §12)
- `/doctor` command output is the authoritative source for subcheck structure. Claude Code must read the existing implementation and derive Aglaea's expected subcheck schema from it.
- Locked subchecks (deep-interview C28): `jin10`, `cls`, `wscn`, `moomoo`, `deepseek`, `discord` — 6 keys. Rationale: cls and wscn are tier-equivalent financial-news sources to jin10; hiding them while showing jin10 violates the public status page's "no lying by omission" property. `db` (internal sqlite) and `ntfy` (Cerydra's own alert channel) are infrastructure-meta and have no Aglaea-side meaning.
- Metrics to report (subject to `/doctor` review):
  - `subchecks`: nested per-component status
  - `last_command_processed_at`
  - `discord_connected` (boolean)
  - Any other field already surfaced by `/doctor`
- Aglaea endpoint URL and bearer token go in Cerydra's `.env`; Aglaea references stay out of any committed code

## 12. Integration: Hyacine (public/open-source repo)

**Critical constraint**: Hyacine is a public open-source project. Aglaea references must not appear anywhere in committed code or docs.

Add a `webhook_reporter` module to Hyacine mainline with the following properties:

- **Default disabled** (`enabled = false` in config)
- **Generic naming**: documented as "compatible with any monitoring webhook endpoint", no mention of Aglaea
- **Field allowlist as class constant**: only the following fields can ever be sent:
  - `process_status` (string)
  - `claude_headless_ok` (boolean)
  - `last_generate_count` (integer)
  - `last_report_sent_at` (ISO timestamp)
  - `mailbox_lag_seconds` (integer, optional)
- **Configuration via env / config file** (private deployment provides values):
  - `WEBHOOK_REPORTER_ENABLED`
  - `WEBHOOK_REPORTER_ENDPOINT`
  - `WEBHOOK_REPORTER_TOKEN`
  - `WEBHOOK_REPORTER_INTERVAL_SECONDS` (default 60)
- **In-memory ring buffer** for transient network failures (capacity 100, drop oldest; never persist to disk)
- **POST body** matches Aglaea's `/api/v1/heartbeat` schema (§6.2)

Claude Code must read `~/hyacine` (or wherever Hyacine sits) to understand existing state representation before designing the field set above. The list here is provisional.

---

## 13. Hardening checklist (must verify before first public deployment)

- [ ] `POSTGRES_PASSWORD` is randomly generated, not a dictionary word
- [ ] `.env` is chmod 600 and in `.gitignore`
- [ ] No `ports:` mappings for postgres / VM / otelcol in `docker-compose.yml`
- [ ] `ufw status` shows only 22 / 80 / 443 open
- [ ] nginx config does not proxy postgres / VM directly
- [ ] OTel Collector endpoint requires `OTEL_SHARED_TOKEN`
- [ ] GitHub OAuth allowlist enforced before session creation
- [ ] All admin actions write to `audit_log`
- [ ] LLM context allowlist tested with deliberately malicious heartbeat payload
- [ ] First admin login bootstraps via `BOOTSTRAP_GITHUB_LOGIN` only; second non-allowlist login is rejected

---

## 14. v0.1 explicit non-goals

- **Cipher integration** (Cipher not yet deployed; revisit when Cipher is live)
- **Real-time WebSocket** (polling is sufficient for personal use)
- **Pattern auto-clustering** (v1 uses light grouping via LLM prompt context; embedding-based clustering is v2)
- **JS RUM beacon** for static pages (server-side probe is sufficient)
- **Mobile-first design** (desktop primary; responsive welcome but not required)
- **Internationalization** (English UI, Chinese in casual chat with maintainer)
- **WCAG audit** (reasonable defaults only)
- **Automated Postgres backups** (single user, single machine, accepted risk)
- **Multi-user / team features** (single admin)

---

## 15. Open implementation questions

All deep-interview rounds (Round 0-6) resolved these. Locked decisions:

- Library version pins → C12-C16 (Python 3.12, FastAPI ≥0.115, Pydantic ≥2.9, SQLAlchemy ≥2.0 async, Next.js 15.x).
- Migration tool concrete config → C13/C15 (Alembic async_engine_from_config + run_async + TimescaleDB raw-SQL blocks).
- Background worker execution model → **CLOSED, C18**: single in-process asyncio tasks from FastAPI lifespan. Split-container migration is 1-PR if needed in v1.x.
- Frontend state management → C24 (hybrid: RSC + revalidate for public, Server Actions for admin static, TanStack Query for admin interactive).
- DeepSeek client → raw httpx wrapper with explicit `timeout=60s`; DeepSeek auto-caches identical prefixes.
- Test coverage targets and CI config → backend pytest + ruff + mypy; frontend tsc --noEmit + vitest + build. GitHub Actions in Phase 0.11.
- Sentry / error tracking → C36 (no Sentry; `docker logs | jq` is the v0.1 debug path).
- `/api/admin/claude-code/raw-query` confirmation step → N15 (no confirmation in v0.1; admin auth gate sufficient for single-user system).

---

End of SPEC v0.1.
