"""Cross-dialect column type variants.

Production uses Postgres (INET, JSONB) but the in-memory SQLite test
harness in `tests/test_auth.py` cannot compile those types. Each export
falls through to a SQLite-native type when the dialect is sqlite.
"""

from __future__ import annotations

from sqlalchemy import ARRAY, JSON, String, Text
from sqlalchemy.dialects.postgresql import INET, JSONB

# Postgres INET ↔ SQLite VARCHAR(45) (IPv6 max length).
PortableINET = INET().with_variant(String(45), "sqlite")

# Postgres JSONB ↔ SQLite JSON1 (generic JSON type uses native JSON1 ext).
PortableJSONB = JSONB().with_variant(JSON(), "sqlite")

# Postgres ARRAY(Text) ↔ SQLite JSON (stored as JSON array).
PortableTextArray = ARRAY(Text()).with_variant(JSON(), "sqlite")
