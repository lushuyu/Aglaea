#!/usr/bin/env bash
# Aglaea v0.1 — Regenerate frontend API types from backend OpenAPI schema (Phase 0.10)
#
# Boots the FastAPI dev server briefly, fetches /openapi.json, runs
# openapi-typescript to regenerate frontend/types/api.ts, then kills the server.
#
# Usage:
#   bash scripts/regen-api-types.sh
#
# In CI (after running this, check for drift):
#   bash scripts/regen-api-types.sh && git diff --exit-code frontend/types/api.ts
#
# Requirements:
#   - Python env with aglaea backend deps installed (uv sync in backend/)
#   - Node + npx available
#   - .env present (or DATABASE_URL set; backend uses a test DSN fallback if not connecting)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"
FRONTEND_TYPES_DIR="${REPO_ROOT}/frontend/types"
OUTPUT_FILE="${FRONTEND_TYPES_DIR}/api.ts"
SERVER_PORT=18765   # Non-standard port to avoid conflicts
SERVER_PID=""

cleanup() {
    if [[ -n "${SERVER_PID}" ]]; then
        echo "Stopping dev server (PID ${SERVER_PID})..."
        kill "${SERVER_PID}" 2>/dev/null || true
        wait "${SERVER_PID}" 2>/dev/null || true
    fi
}
trap cleanup EXIT

echo "=== Regenerating frontend/types/api.ts from OpenAPI schema ==="

# Ensure output directory exists
mkdir -p "${FRONTEND_TYPES_DIR}"

# Start FastAPI dev server in the background
echo "Starting FastAPI dev server on port ${SERVER_PORT}..."
cd "${BACKEND_DIR}"

# Use a no-DB config for schema generation (schema does not require DB connectivity)
DATABASE_URL="postgresql+asyncpg://aglaea:placeholder@localhost:5432/aglaea" \
DEEPSEEK_API_KEY="placeholder" \
GITHUB_OAUTH_CLIENT_ID="placeholder" \
GITHUB_OAUTH_CLIENT_SECRET="placeholder" \
SESSION_SECRET="placeholder" \
BOOTSTRAP_GITHUB_LOGIN="lushuyu" \
    uv run uvicorn aglaea.main:app --host 127.0.0.1 --port "${SERVER_PORT}" \
    --no-access-log &
SERVER_PID=$!

echo "Server PID: ${SERVER_PID}"

# Wait for server to be ready (up to 30s)
MAX_WAIT=30
ELAPSED=0
until curl -sf "http://127.0.0.1:${SERVER_PORT}/api/health" >/dev/null 2>&1; do
    sleep 1
    ELAPSED=$((ELAPSED + 1))
    if [[ ${ELAPSED} -ge ${MAX_WAIT} ]]; then
        echo "ERROR: Dev server did not start within ${MAX_WAIT}s." >&2
        exit 1
    fi
done
echo "Server ready."

# Fetch OpenAPI schema
SCHEMA_FILE="$(mktemp /tmp/aglaea-openapi-XXXXXX.json)"
echo "Fetching /openapi.json → ${SCHEMA_FILE}..."
curl -sf "http://127.0.0.1:${SERVER_PORT}/openapi.json" -o "${SCHEMA_FILE}"

# Run openapi-typescript
echo "Running openapi-typescript → ${OUTPUT_FILE}..."
cd "${REPO_ROOT}/frontend"
npx openapi-typescript "${SCHEMA_FILE}" -o "${OUTPUT_FILE}"

# Cleanup schema file
rm -f "${SCHEMA_FILE}"

echo ""
echo "=== Done: ${OUTPUT_FILE} regenerated ==="
echo ""
echo "In CI, run: git diff --exit-code frontend/types/api.ts"
echo "A non-zero exit means the backend API changed without regenerating types."
