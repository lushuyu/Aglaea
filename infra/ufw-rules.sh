#!/usr/bin/env bash
# Aglaea v0.1 — UFW hardening script
# AC3.6, AC5.4: Only ports 22/80/443 allowed inbound.
#
# WARNING: This script sets "ufw default deny incoming" which WILL BLOCK
# all inbound traffic except 22/80/443. If you have other services listening
# on public ports (e.g., a VPN, custom monitoring port), add them explicitly
# BEFORE running this script or you will lose access.
#
# This script is IDEMPOTENT — safe to run multiple times.
# It does NOT call "ufw enable" automatically; you must do that manually
# after reviewing the rules with "ufw status verbose".
#
# Usage:
#   sudo bash infra/ufw-rules.sh
#   # Review output, then: sudo ufw enable

set -euo pipefail

# Check if running as root (ufw requires root)
if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root (sudo)." >&2
    exit 1
fi

echo "=== Aglaea UFW hardening ==="
echo "Setting default policies..."

ufw default deny incoming
ufw default allow outgoing

echo "Allowing SSH (22/tcp)..."
ufw allow 22/tcp comment "SSH"

echo "Allowing HTTP (80/tcp)..."
ufw allow 80/tcp comment "HTTP (nginx → HTTPS redirect)"

echo "Allowing HTTPS (443/tcp)..."
ufw allow 443/tcp comment "HTTPS (nginx — status.lushuyu.site + otel.lushuyu.site)"

echo ""
echo "=== UFW rules configured (NOT yet enabled) ==="
echo "Review the status below, then run: sudo ufw enable"
echo ""

ufw status verbose
