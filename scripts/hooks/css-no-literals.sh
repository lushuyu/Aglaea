#!/usr/bin/env bash
# pre-commit hook: CSS token guard
# Fails if any *.module.css file contains hex color literals or px values.
# Principle 5: all values must go through var(--*) tokens.
set -euo pipefail

files=$(git diff --cached --name-only | grep "\.module\.css$" || true)
if [ -z "$files" ]; then
    exit 0
fi

result=$(echo "$files" | xargs grep -En '#[0-9a-fA-F]{3,6}\b|[0-9]+px\b' 2>/dev/null || true)
if [ -n "$result" ]; then
    echo "ERROR: hex/px literals found in *.module.css (use var(--*) tokens):"
    echo "$result"
    exit 1
fi
exit 0
