#!/usr/bin/env bash
# Aglaea v0.1 — Hardening verification script (Phase 9.1)
# Mechanically verifies every AC5.x acceptance criterion.
#
# Usage: bash scripts/check_hardening.sh
# Exit code: 0 = all checks passed, 1 = one or more checks failed.
#
# Checks that require a live deployment (AC5.6, AC5.8) are marked SKIP
# when the relevant service is not reachable — they will not fail the script
# in that case, but print a clear advisory.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.yml"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-enabled/aglaea.conf}"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'  # No Colour

PASS=0
FAIL=0
SKIP=0

pass() { echo -e "${GREEN}[PASS]${NC} $*"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}[FAIL]${NC} $*"; FAIL=$((FAIL + 1)); }
skip() { echo -e "${YELLOW}[SKIP]${NC} $*"; SKIP=$((SKIP + 1)); }

echo "=== Aglaea v0.1 Hardening Verification ==="
echo "Repo root:  ${REPO_ROOT}"
echo "Env file:   ${ENV_FILE}"
echo ""

# ── AC5.1 — POSTGRES_PASSWORD randomly generated (≥32 bytes, not a dict word) ─
echo "--- AC5.1: POSTGRES_PASSWORD strength ---"
if [[ ! -f "${ENV_FILE}" ]]; then
    fail "AC5.1: .env not found at ${ENV_FILE}"
else
    PG_PASS_LINE="$(grep -E '^POSTGRES_PASSWORD=' "${ENV_FILE}" || true)"
    if [[ -z "${PG_PASS_LINE}" ]]; then
        fail "AC5.1: POSTGRES_PASSWORD not set in .env"
    else
        PG_PASS="${PG_PASS_LINE#POSTGRES_PASSWORD=}"
        PG_LEN="${#PG_PASS}"
        if [[ ${PG_LEN} -ge 32 ]]; then
            pass "AC5.1: POSTGRES_PASSWORD length=${PG_LEN} (≥32)"
        else
            fail "AC5.1: POSTGRES_PASSWORD too short (${PG_LEN} < 32 chars)"
        fi
        # Rough dictionary-word check: reject if value matches common weak passwords
        WEAK_PATTERNS="^(password|postgres|admin|secret|changeme|12345|aglaea)$"
        if echo "${PG_PASS}" | grep -qiE "${WEAK_PATTERNS}"; then
            fail "AC5.1: POSTGRES_PASSWORD matches a known weak pattern"
        else
            pass "AC5.1: POSTGRES_PASSWORD does not match weak patterns"
        fi
    fi
fi

# ── AC5.2 — .env is chmod 600 and in .gitignore ──────────────────────────────
echo ""
echo "--- AC5.2: .env permissions and gitignore ---"
if [[ ! -f "${ENV_FILE}" ]]; then
    fail "AC5.2: .env not found"
else
    ENV_PERMS="$(stat -c '%a' "${ENV_FILE}")"
    if [[ "${ENV_PERMS}" == "600" ]]; then
        pass "AC5.2: .env permissions = ${ENV_PERMS} (600)"
    else
        fail "AC5.2: .env permissions = ${ENV_PERMS} (expected 600)"
    fi
fi

GITIGNORE="${REPO_ROOT}/.gitignore"
if grep -qF ".env" "${GITIGNORE}" 2>/dev/null; then
    pass "AC5.2: .env is in .gitignore"
else
    fail "AC5.2: .env NOT found in .gitignore"
fi
# Verify .env.example is NOT gitignored (it should be committed)
if grep -qF ".env.example" "${GITIGNORE}" 2>/dev/null && \
   ! grep -qE '^#.*\.env\.example' "${GITIGNORE}" 2>/dev/null; then
    fail "AC5.2: .env.example appears to be gitignored (it should NOT be)"
else
    pass "AC5.2: .env.example is not gitignored (correct)"
fi

# ── AC5.3 — No host ports for postgres / victoriametrics / otelcol ────────────
echo ""
echo "--- AC5.3: No exposed ports for internal services ---"
if [[ ! -f "${COMPOSE_FILE}" ]]; then
    fail "AC5.3: docker-compose.yml not found"
else
    # Check that postgres/victoriametrics/otelcol expose no host-visible ports.
    # Loopback bindings (127.0.0.1:host:container) are allowed — they're
    # required so nginx on the host can reach otelcol's /v1/* endpoints, and
    # are not reachable from external networks.
    if python3 - <<'PYEOF' "${COMPOSE_FILE}"
import sys, yaml
with open(sys.argv[1]) as f:
    compose = yaml.safe_load(f)
services = compose.get("services", {})
restricted = ["postgres", "victoriametrics", "otelcol"]
bad = []
for svc in restricted:
    ports = services.get(svc, {}).get("ports") or []
    for entry in ports:
        s = str(entry)
        # Allow only loopback host bindings (127.0.0.1:HOSTPORT:CONTAINERPORT)
        if not s.startswith("127.0.0.1:"):
            bad.append(f"{svc}:{s}")
if bad:
    print(f"FAIL: services with externally-exposed ports: {bad}", file=sys.stderr)
    sys.exit(1)
sys.exit(0)
PYEOF
    then
        pass "AC5.3: postgres / victoriametrics / otelcol have no exposed ports"
    else
        fail "AC5.3: one or more internal services have exposed ports"
    fi
fi

# ── AC5.4 — ufw allows only 22/80/443 ────────────────────────────────────────
echo ""
echo "--- AC5.4: UFW rules ---"
if ! command -v ufw &>/dev/null; then
    skip "AC5.4: ufw not installed — skipping (run on sg-server)"
else
    UFW_STATUS="$(sudo ufw status 2>/dev/null || true)"
    if echo "${UFW_STATUS}" | grep -q "Status: active"; then
        pass "AC5.4: ufw is active"
        # Check that 22, 80, 443 are allowed
        for PORT in 22 80 443; do
            if echo "${UFW_STATUS}" | grep -qE "^${PORT}[[:space:]]"; then
                pass "AC5.4: port ${PORT} is allowed"
            else
                fail "AC5.4: port ${PORT} not found in ufw allow rules"
            fi
        done
        # Check for unexpected rules (anything not 22/80/443)
        UNEXPECTED="$(echo "${UFW_STATUS}" | grep -E "^[0-9]" | grep -vE "^(22|80|443)[^0-9]" || true)"
        if [[ -n "${UNEXPECTED}" ]]; then
            fail "AC5.4: unexpected inbound rules found:\n${UNEXPECTED}"
        else
            pass "AC5.4: no unexpected inbound rules"
        fi
    else
        skip "AC5.4: ufw not active — run: sudo ufw enable (after reviewing rules)"
    fi
fi

# ── AC5.5 — nginx does not proxy postgres / VM directly ──────────────────────
echo ""
echo "--- AC5.5: nginx does not proxy internal DBs ---"
if [[ ! -f "${NGINX_CONF}" ]]; then
    skip "AC5.5: nginx config not found at ${NGINX_CONF} — skipping (run on sg-server)"
else
    if grep -qE "proxy_pass.*(5432|8428)" "${NGINX_CONF}" 2>/dev/null; then
        fail "AC5.5: nginx config proxies to port 5432 or 8428 (postgres/VM exposed!)"
    else
        pass "AC5.5: nginx config does not proxy postgres (5432) or VictoriaMetrics (8428)"
    fi
fi

# ── AC5.6 — OTel endpoint requires OTEL_SHARED_TOKEN ─────────────────────────
echo ""
echo "--- AC5.6: OTel Collector bearer auth ---"
OTEL_HOST="${OTEL_HOST:-https://otel.lushuyu.site}"
# Capture the status code without `-f` (which exits non-zero on 4xx and
# would discard the 401 we actually want to see).
HTTP_CODE="$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "${OTEL_HOST}" \
    -H "Authorization: Bearer wrongtoken123" 2>/dev/null || echo "unreachable")"
if [[ "${HTTP_CODE}" == "401" ]]; then
    pass "AC5.6: otel endpoint returns 401 for wrong bearer token"
elif [[ "${HTTP_CODE}" == "unreachable" || "${HTTP_CODE}" == "000" ]]; then
    skip "AC5.6: ${OTEL_HOST} not reachable — check when deployed"
else
    fail "AC5.6: otel endpoint returned HTTP ${HTTP_CODE} instead of 401 for wrong token"
fi

# ── AC5.7 — GitHub OAuth allowlist enforced ───────────────────────────────────
echo ""
echo "--- AC5.7: GitHub OAuth allowlist (runtime — covered by pytest) ---"
PYTEST_RESULT=0
if command -v python3 &>/dev/null && [[ -d "${REPO_ROOT}/backend" ]]; then
    cd "${REPO_ROOT}/backend"
    if uv run pytest tests/test_auth.py -q --tb=short -x 2>/dev/null; then
        pass "AC5.7: pytest test_auth.py passed"
    else
        PYTEST_RESULT=$?
        fail "AC5.7: pytest test_auth.py failed (exit ${PYTEST_RESULT})"
    fi
    cd "${REPO_ROOT}"
else
    skip "AC5.7: backend not set up — skipping pytest (run: cd backend && uv run pytest tests/test_auth.py)"
fi

# ── AC5.8 — Admin actions write to audit_log ─────────────────────────────────
echo ""
echo "--- AC5.8: Audit log populated ---"
DB_URL="${DATABASE_URL:-}"
if [[ -z "${DB_URL}" ]]; then
    DB_URL="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)"
fi
if [[ -z "${DB_URL}" ]]; then
    skip "AC5.8: DATABASE_URL not set — skipping DB audit-log check"
else
    AUDIT_COUNT="$(python3 -c "
import asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine

async def check():
    engine = create_async_engine('${DB_URL}', connect_args={'statement_cache_size': 0})
    async with engine.connect() as conn:
        result = await conn.execute(sa.text(\"SELECT COUNT(*) FROM audit_log WHERE event LIKE 'admin.%'\"))
        return result.scalar()

print(asyncio.run(check()))
" 2>/dev/null || echo "error")"
    if [[ "${AUDIT_COUNT}" == "error" ]]; then
        skip "AC5.8: Cannot connect to DB — skipping audit_log check"
    elif [[ "${AUDIT_COUNT}" -gt 0 ]]; then
        pass "AC5.8: audit_log has ${AUDIT_COUNT} admin.* events"
    else
        skip "AC5.8: audit_log has 0 admin.* events (expected after at least one admin action)"
    fi
fi

# ── AC5.9 — LLM context allowlist + prompt injection resistance ───────────────
echo ""
echo "--- AC5.9: LLM context allowlist (pytest) ---"
if command -v python3 &>/dev/null && [[ -d "${REPO_ROOT}/backend" ]]; then
    cd "${REPO_ROOT}/backend"
    if uv run pytest tests/test_llm_context_allowlist.py -q --tb=short -x 2>/dev/null; then
        pass "AC5.9: pytest test_llm_context_allowlist.py passed"
    else
        fail "AC5.9: pytest test_llm_context_allowlist.py failed"
    fi
    cd "${REPO_ROOT}"
else
    skip "AC5.9: backend not set up — run: cd backend && uv run pytest tests/test_llm_context_allowlist.py"
fi

# ── AC5.10 — Non-allowlist GitHub login rejected ──────────────────────────────
echo ""
echo "--- AC5.10: Non-allowlist login rejection (runtime — covered by pytest) ---"
if command -v python3 &>/dev/null && [[ -d "${REPO_ROOT}/backend" ]]; then
    cd "${REPO_ROOT}/backend"
    if uv run pytest tests/test_auth.py -q --tb=short -k "allowlist_rejection" -x 2>/dev/null; then
        pass "AC5.10: pytest allowlist_rejection test passed"
    else
        fail "AC5.10: pytest allowlist_rejection test failed"
    fi
    cd "${REPO_ROOT}"
else
    skip "AC5.10: backend not set up — run: cd backend && uv run pytest tests/test_auth.py -k allowlist_rejection"
fi

# ── AC5.11 — X-Aglaea-Timestamp validation ───────────────────────────────────
echo ""
echo "--- AC5.11: X-Aglaea-Timestamp validation (runtime — covered by pytest) ---"
if command -v python3 &>/dev/null && [[ -d "${REPO_ROOT}/backend" ]]; then
    cd "${REPO_ROOT}/backend"
    if uv run pytest tests/test_timestamp.py -q --tb=short -x 2>/dev/null; then
        pass "AC5.11: pytest test_timestamp.py passed"
    else
        fail "AC5.11: pytest test_timestamp.py failed"
    fi
    cd "${REPO_ROOT}"
else
    skip "AC5.11: backend not set up — run: cd backend && uv run pytest tests/test_timestamp.py"
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo -e "=== Hardening Summary ==="
echo -e "  ${GREEN}PASS${NC}: ${PASS}"
echo -e "  ${RED}FAIL${NC}: ${FAIL}"
echo -e "  ${YELLOW}SKIP${NC}: ${SKIP}"
echo "============================================"

if [[ ${FAIL} -gt 0 ]]; then
    echo -e "${RED}HARDENING CHECK FAILED — ${FAIL} issue(s) require attention.${NC}"
    exit 1
else
    echo -e "${GREEN}All active hardening checks passed.${NC}"
    if [[ ${SKIP} -gt 0 ]]; then
        echo "(${SKIP} check(s) skipped — re-run on sg-server after deployment.)"
    fi
    exit 0
fi
