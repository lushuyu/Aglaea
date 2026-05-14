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
# No server is launched anymore; schema is extracted in-process.

echo "=== Regenerating frontend/types/api.ts from OpenAPI schema ==="

# Ensure output directory exists
mkdir -p "${FRONTEND_TYPES_DIR}"

# Dump OpenAPI schema by importing the FastAPI app and calling app.openapi().
# This avoids booting uvicorn (which would start lifespan workers that try to
# connect to the DB and crash without one). app.openapi() is pure route
# introspection — no DB, no network.
echo "Dumping OpenAPI schema via app.openapi()..."
cd "${BACKEND_DIR}"

SCHEMA_FILE="$(mktemp /tmp/aglaea-openapi-XXXXXX.json)"

DATABASE_URL="postgresql+asyncpg://aglaea:placeholder@localhost:5432/aglaea" \
DEEPSEEK_API_KEY="placeholder" \
GITHUB_OAUTH_CLIENT_ID="placeholder" \
GITHUB_OAUTH_CLIENT_SECRET="placeholder" \
SESSION_SECRET="placeholder_session_secret_32chars_ok" \
BOOTSTRAP_GITHUB_LOGIN="lushuyu" \
    uv run python -c "import json, sys; from aglaea.main import app; json.dump(app.openapi(), sys.stdout)" \
    > "${SCHEMA_FILE}"

echo "Schema written → ${SCHEMA_FILE}"

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
