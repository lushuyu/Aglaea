#!/usr/bin/env python3
"""generate-token.py — Dev/test helper for manually seeding bearer tokens.

⚠️  FOR DEV AND TEST USE ONLY — NOT FOR PRODUCTION BOOTSTRAPPING.

In production, bearer tokens are generated via the admin UI, which:
  1. Calls the /api/admin/services/{id}/keys endpoint.
  2. Returns the plaintext token exactly once in a modal.
  3. Stores only the argon2id hash in the database.

This script is provided for:
  - Local development without a running UI.
  - Seeding test fixtures.
  - Verifying that argon2id hashing is working correctly.

Outputs: plaintext token + argon2id hash + key prefix (first 8 chars).
The plaintext is shown once — do not store it anywhere insecure.

Usage:
    python scripts/generate-token.py
    python scripts/generate-token.py --prefix svc_cerydra_

Requires: argon2-cffi (pip install argon2-cffi)
"""
from __future__ import annotations

import argparse
import secrets
import sys

try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError
except ImportError:
    print(
        "ERROR: argon2-cffi not installed.\n"
        "Install with: pip install argon2-cffi  (or: uv pip install argon2-cffi)",
        file=sys.stderr,
    )
    sys.exit(1)


def generate_token(prefix: str = "ak_") -> tuple[str, str, str]:
    """Generate a bearer token and its argon2id hash.

    Returns:
        (plaintext, hash, key_prefix)

    The key_prefix is the first 8 chars of the plaintext — stored in DB for
    display in the admin UI (e.g. "ak_abc123...") without revealing the full token.
    """
    # Generate 32 cryptographically random bytes, URL-safe base64 encoded.
    raw = secrets.token_urlsafe(32)
    plaintext = f"{prefix}{raw}"
    key_prefix = plaintext[:8]

    # argon2id hash — same settings as backend/aglaea/security/bearer.py
    ph = PasswordHasher(
        time_cost=2,        # iterations
        memory_cost=65536,  # 64 MiB
        parallelism=2,
        hash_len=32,
        salt_len=16,
    )
    token_hash = ph.hash(plaintext)

    return plaintext, token_hash, key_prefix


def verify_token(plaintext: str, token_hash: str) -> bool:
    """Verify plaintext against stored hash (for sanity checking)."""
    ph = PasswordHasher()
    try:
        ph.verify(token_hash, plaintext)
        return True
    except VerifyMismatchError:
        return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a dev/test argon2id-hashed bearer token.",
        epilog="FOR DEV/TEST USE ONLY — production tokens are generated via admin UI.",
    )
    parser.add_argument(
        "--prefix",
        default="ak_",
        help="Token prefix (default: ak_). Example: svc_cerydra_",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("  Aglaea bearer token generator — DEV/TEST USE ONLY")
    print("=" * 60)
    print()

    plaintext, token_hash, key_prefix = generate_token(prefix=args.prefix)

    # Verify the hash round-trips correctly
    if not verify_token(plaintext, token_hash):
        print("ERROR: argon2id hash verification failed!", file=sys.stderr)
        sys.exit(1)

    print(f"Plaintext token (show ONCE, then discard):")
    print(f"  {plaintext}")
    print()
    print(f"Key prefix (store in DB api_keys.key_prefix for UI display):")
    print(f"  {key_prefix}")
    print()
    print(f"argon2id hash (store in DB api_keys.key_hash):")
    print(f"  {token_hash}")
    print()
    print("─" * 60)
    print("To seed manually:")
    print("  INSERT INTO api_keys (service_id, label, key_hash, key_prefix)")
    print(f"  VALUES (<service_id>, '<label>', '<hash_above>', '{key_prefix}');")
    print()
    print("⚠️  The plaintext above is shown ONCE.")
    print("    Store it securely (e.g. in Cerydra's .env as WEBHOOK_REPORTER_TOKEN).")
    print("    Once this terminal session closes, it cannot be recovered.")


if __name__ == "__main__":
    main()
