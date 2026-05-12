"""`--seed-demo` flag for local development (Phase 1.4).

Production bootstrap goes through the admin UI; this is for dev / testing
only. Seeds two services (one push, one pull) and prints generated bearer
plaintext to stdout EXACTLY ONCE per key.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from sqlalchemy import select

from aglaea.db import session_scope
from aglaea.models.api_keys import ApiKey
from aglaea.models.services import Service, ServiceKind
from aglaea.security.bearer import generate_key

log = logging.getLogger(__name__)


SEED_SERVICES = [
    {
        "slug": "cerydra",
        "display_name": "Cerydra",
        "description": "Investment news collator (push reporter).",
        "kind": ServiceKind.push,
        "expected_interval_seconds": 60,
        "public_visible": True,
    },
    {
        "slug": "example-static",
        "display_name": "Example Static Site",
        "description": "Static page probed via GET.",
        "kind": ServiceKind.pull,
        "probe_url": "https://example.com",
        "probe_interval_seconds": 60,
        "probe_timeout_seconds": 10,
        "probe_expected_status": 200,
        "public_visible": True,
    },
]


async def _seed_demo() -> None:
    async with session_scope() as session:
        for entry in SEED_SERVICES:
            stmt = select(Service).where(Service.slug == entry["slug"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if existing is not None:
                log.info("seed.skip", extra={"slug": entry["slug"]})
                continue
            service = Service(**entry)
            session.add(service)
            await session.flush()
            log.info("seed.created", extra={"slug": entry["slug"]})

            minted = generate_key()
            key_row = ApiKey(
                service_id=service.id,
                label="demo",
                key_hash=minted.hash,
                key_prefix=minted.prefix,
            )
            session.add(key_row)
            await session.flush()
            sys.stdout.write(
                f"SEED-KEY service={entry['slug']} plaintext={minted.plaintext}\n"
            )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Aglaea seeding utility")
    parser.add_argument(
        "--seed-demo",
        action="store_true",
        help="Insert demo services + emit bearer plaintext to stdout (dev only).",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    if args.seed_demo:
        asyncio.run(_seed_demo())
        return 0
    print("nothing to do; pass --seed-demo for dev seeding", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
