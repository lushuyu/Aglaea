"""Pytest configuration — sets test-friendly env defaults before app import."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Make `aglaea` importable when running `pytest` from repo root or backend/.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Defaults — individual tests override as needed.
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://aglaea:test@localhost:5432/aglaea_test"
)
os.environ.setdefault("SESSION_SECRET", "test-session-secret-very-long-string-value")
os.environ.setdefault("DEEPSEEK_API_KEY", "")
os.environ.setdefault("HEALTHCHECKS_SELFPING_URL", "")
os.environ.setdefault("NTFY_TOPIC_URL", "")
os.environ.setdefault("BOOTSTRAP_GITHUB_LOGIN", "lushuyu")
os.environ.setdefault("ENVIRONMENT", "test")
