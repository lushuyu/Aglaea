#!/usr/bin/env bash
# pre-commit hook: argon2 sync-wrap guard (Principle 6)
# Fails if argon2 .verify() is called outside asyncio.to_thread in async handlers.
set -euo pipefail

result=$(grep -rn "\.verify(" backend/aglaea/ 2>/dev/null \
    | grep -v "asyncio.to_thread" \
    | grep -v "^[^:]*:#" \
    | grep -v "test_" \
    || true)

if [ -n "$result" ]; then
    echo "ERROR: argon2 .verify() called without asyncio.to_thread wrapper:"
    echo "$result"
    echo "Fix: wrap as: await asyncio.to_thread(ph.verify, hash, plaintext)"
    exit 1
fi
exit 0
