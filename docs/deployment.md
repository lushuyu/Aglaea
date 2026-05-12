# Aglaea v0.1 — Deployment Guide (sg-server cold start)

This document is the authoritative cold-start procedure for deploying Aglaea on
`sg-server` (the Singapore VPS where Cerydra already runs).

## Prerequisites

- SSH access to sg-server as `ubuntu` (or root).
- Cerydra already running (same VPS — Aglaea shares nginx + Cloudflare Origin CA cert).
- GitHub OAuth App registered (see Step 4).
- The `DEEPSEEK_API_KEY` value from Cerydra's `.env` available for pasting.

## Cloudflare DNS (do this first)

Before deploying, ensure both DNS records exist and are **orange-cloud (proxied)**:

| Record | Type | Value | Proxied |
|--------|------|-------|---------|
| `status.lushuyu.site` | A | sg-server IP | Yes (orange cloud) |
| `otel.lushuyu.site` | A | sg-server IP | Yes (orange cloud) |

Gray-cloud bypasses CF Universal SSL and will show a certificate trust error in
browsers, because the Origin CA cert is not trusted by public CA stores.

## Step-by-step cold start

### 1. Clone the repo on sg-server

```bash
ssh ubuntu@sg-server.lushuyu.site
cd ~
git clone https://github.com/lushuyu/Aglaea.git
cd Aglaea
```

### 2. Generate secrets (bootstrap.sh)

```bash
bash scripts/bootstrap.sh
```

The script will:
- Generate `POSTGRES_PASSWORD`, `SESSION_SECRET`, `OTEL_SHARED_TOKEN` via `openssl rand`.
- Prompt you to paste `DEEPSEEK_API_KEY` (copy from `~/Cerydra/.env` — do not `cat` it).
- Prompt for `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.
- Write `.env` with `chmod 600`.

### 3. Locate the Cloudflare Origin CA cert paths

Cerydra already has a `*.lushuyu.site` Origin CA cert installed. Find the paths:

```bash
sudo grep -r "ssl_certificate" /etc/nginx/sites-available/
```

Example output (actual paths may differ):
```
/etc/nginx/sites-available/cerydra.conf:    ssl_certificate     /etc/ssl/cloudflare/lushuyu.site.pem;
/etc/nginx/sites-available/cerydra.conf:    ssl_certificate_key /etc/ssl/cloudflare/lushuyu.site.key;
```

Note these paths — you will need them in Step 5.

### 4. Register GitHub OAuth App

1. Go to: https://github.com/settings/applications/new
2. Fill in:
   - **Application name**: Aglaea (or any name)
   - **Homepage URL**: `https://status.lushuyu.site`
   - **Authorization callback URL**: `https://status.lushuyu.site/api/auth/github/callback`
3. Click **Register application**.
4. Copy **Client ID** and **Client Secret** — provide them when `bootstrap.sh` prompts.

### 5. Configure nginx

Copy the example config to the nginx sites directory:

```bash
sudo cp infra/nginx.conf.example /etc/nginx/sites-available/aglaea.conf
sudo nano /etc/nginx/sites-available/aglaea.conf
```

Make these edits in the file:
1. Replace both occurrences of `/etc/ssl/cloudflare/lushuyu.site.pem` with the actual cert path from Step 3.
2. Replace both occurrences of `/etc/ssl/cloudflare/lushuyu.site.key` with the actual key path from Step 3.
3. Replace `REPLACE_WITH_OTEL_SHARED_TOKEN` with the `OTEL_SHARED_TOKEN` value from `.env`:
   ```bash
   grep OTEL_SHARED_TOKEN .env
   ```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/aglaea.conf /etc/nginx/sites-enabled/aglaea.conf
nginx -t
sudo systemctl reload nginx
```

### 6. Apply UFW rules

```bash
sudo bash infra/ufw-rules.sh
# Review the output, then:
sudo ufw enable
sudo ufw status verbose
```

Expected output shows only 22/tcp, 80/tcp, 443/tcp allowed.

### 7. Start Docker services

```bash
docker compose up -d
```

Verify all 5 services are healthy:

```bash
docker compose ps
```

Expected: postgres, victoriametrics, otelcol, aglaea-backend, aglaea-frontend all `healthy` or `running`.

### 8. Run database migrations

```bash
docker compose exec aglaea-backend alembic upgrade head
```

Verify:

```bash
docker compose exec aglaea-backend alembic current
```

### 9. First admin login

1. Visit `https://status.lushuyu.site/admin`
2. Click **Sign in with GitHub**
3. Authorize the OAuth app
4. The account `lushuyu` (set as `BOOTSTRAP_GITHUB_LOGIN`) is auto-inserted into `admin_users`

### 10. Register services and generate API tokens

Via the admin UI at `https://status.lushuyu.site/admin`:

1. **Add service**: Cerydra (kind=push, expected_interval=60s)
2. **Generate API token**: copy the plaintext token shown once in the modal
3. Add the token to Cerydra's `.env` as `WEBHOOK_REPORTER_TOKEN`
4. Set `WEBHOOK_REPORTER_ENDPOINT=https://status.lushuyu.site/api/v1/heartbeat`
5. Set `WEBHOOK_REPORTER_ENABLED=1`
6. Restart Cerydra: `sudo systemctl restart cerydra`

### 11. Configure OTEL on devices

See device-specific recipes in `docs/otel-devices.md` (created in Phase 8.5).

General pattern for Claude Code OTEL on each device:
```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.lushuyu.site
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <OTEL_SHARED_TOKEN>"
```

Replace `<OTEL_SHARED_TOKEN>` with the value from `.env`.

## Verification

After completing all steps, run the hardening check:

```bash
bash scripts/check_hardening.sh
```

All active checks should PASS. SKIP items require a live deployment or active DB.

## Subsequent deploys

```bash
ssh ubuntu@sg-server.lushuyu.site
cd ~/Aglaea
git pull
docker compose pull  # pull any updated base images
docker compose up -d --build
docker compose exec aglaea-backend alembic upgrade head
```

## Rollback

```bash
git log --oneline -5
git checkout <prev-commit>
docker compose up -d --build
docker compose exec aglaea-backend alembic downgrade -1
```

## Logs

```bash
# All services
docker compose logs -f

# Backend only (JSON structured — pipe through jq)
docker compose logs -f aglaea-backend | jq .

# Filter by request_id
docker compose logs aglaea-backend | jq 'select(.request_id == "abc123")'
```

## Notes

- The Cloudflare Origin CA cert (`*.lushuyu.site`) has ~15-year validity — no renewal cron needed.
- nginx config lives at `/etc/nginx/sites-available/aglaea.conf` — edit directly on sg-server for quick fixes.
- The `infra/nginx.conf.example` in the repo is the canonical template; keep it in sync with the live config.
- Postgres data persists in Docker volume `pg_data`. If you `docker compose down -v`, data is lost — this is accepted risk per SPEC §14 (no automated backups in v0.1).
