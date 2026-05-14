"""Bearer-token primitives — generate, hash (argon2id), verify (in to_thread).

CRITICAL: Principle 6 + AC1.7. Every `argon2.PasswordHasher().verify(...)`
call goes through `_verify_in_thread()` which wraps with
`await asyncio.to_thread(...)`. Calling `verify` directly in an async handler
stalls the event loop for ~50-200ms per call and gates every worker tick.

CI lint: `grep -rE "argon2.*\\.verify\\(" backend/ | grep -v "asyncio.to_thread"`
must be empty. The implementation here is the ONE allowed call site.
"""

from __future__ import annotations

import asyncio
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Final

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from aglaea.models.api_keys import ApiKey

_PREFIX_LEN: Final[int] = 8
_TOKEN_RAW_BYTES: Final[int] = 32

# Single hasher instance — argon2id-default params (memory_cost / time_cost
# parallelism per the library defaults; we don't tune below safe minima).
_hasher = PasswordHasher()


@dataclass(slots=True, frozen=True)
class GeneratedKey:
    """One-time return-shape for a freshly minted API key."""

    plaintext: str
    prefix: str
    hash: str


def generate_key() -> GeneratedKey:
    """Produce a new bearer token. Plaintext returned exactly once."""
    raw = secrets.token_urlsafe(_TOKEN_RAW_BYTES)
    return GeneratedKey(
        plaintext=raw,
        prefix=raw[:_PREFIX_LEN],
        hash=_hasher.hash(raw),
    )


def _verify_sync(hashed: str, plaintext: str) -> bool:
    """Synchronous argon2id verify. Only call from `_verify_in_thread`."""
    try:
        return _hasher.verify(hashed, plaintext)
    except VerifyMismatchError:
        return False
    except Exception:  # noqa: BLE001 — argon2 raises a variety on malformed
        return False


async def _verify_in_thread(hashed: str, plaintext: str) -> bool:
    """All argon2 verification flows through this wrapper.

    `_verify_sync` is the ONLY synchronous verify call in the codebase, and
    it is invoked exclusively here via `asyncio.to_thread`.
    """
    return await asyncio.to_thread(_verify_sync, hashed, plaintext)


async def verify_bearer(
    session: AsyncSession,
    *,
    plaintext_token: str,
) -> ApiKey | None:
    """Locate the matching active api_keys row.

    Strategy: filter active candidate rows by `key_prefix` (small set;
    indexed), then argon2-verify the candidates off-thread. Returns the
    matched row or None.
    """
    if not plaintext_token or len(plaintext_token) < _PREFIX_LEN:
        return None
    prefix = plaintext_token[:_PREFIX_LEN]

    stmt = select(ApiKey).where(
        ApiKey.key_prefix == prefix,
        ApiKey.revoked_at.is_(None),
    )
    result = await session.execute(stmt)
    candidates = list(result.scalars())

    for row in candidates:
        if await _verify_in_thread(row.key_hash, plaintext_token):
            await session.execute(
                update(ApiKey).where(ApiKey.id == row.id).values(last_used_at=datetime.now(UTC))
            )
            return row
    return None
