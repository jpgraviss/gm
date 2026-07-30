"""Client slug -> property mapping and resolution.

clients.json is the single source of truth for which GA4 property, GSC
property, and (eventually) GBP location a client slug maps to. Connector
scripts resolve every client through here rather than taking raw property
IDs on the command line, so slugs — not IDs — are the stable interface
shared with GravHub's own client records.
"""
from __future__ import annotations

import difflib
import json
from pathlib import Path

REGISTRY_PATH = Path(__file__).resolve().parent.parent / "clients.json"


class UnknownClientError(ValueError):
    """Raised by resolve() for a slug with no match — always carries the
    full list of valid slugs (and a suggestion, when close) rather than
    surfacing as a bare KeyError."""


def _normalize(slug: str) -> str:
    return slug.strip().lower().replace("_", "-")


def _load() -> list[dict]:
    with open(REGISTRY_PATH) as f:
        data = json.load(f)
    return data["clients"]


def all_clients() -> list[dict]:
    """Every client in the registry, active or not."""
    return _load()


def all_active() -> list[dict]:
    """Active clients only — what --all-clients runs loop over. A churned
    client stays in clients.json with active: false rather than being
    deleted, so it's excluded here without losing the record."""
    return [c for c in _load() if c.get("active", True)]


def resolve(slug: str) -> dict:
    """Return the client record matching slug.

    Case-insensitive and tolerant of underscore/hyphen variation (e.g.
    "Formetco", "formetco", "for_metco" if that were the real slug all
    normalize the same way). Raises UnknownClientError listing every valid
    slug, plus a closest-match suggestion when one is available.
    """
    target = _normalize(slug)
    clients = _load()
    by_slug = {_normalize(c["slug"]): c for c in clients}

    if target in by_slug:
        return by_slug[target]

    valid_slugs = sorted(by_slug.keys())
    suggestion = difflib.get_close_matches(target, valid_slugs, n=1, cutoff=0.5)
    message = (
        f"Unknown client slug '{slug}'.\n"
        f"Valid slugs: {', '.join(valid_slugs) if valid_slugs else '(none registered in clients.json yet)'}"
    )
    if suggestion:
        message += f"\nDid you mean '{suggestion[0]}'?"
    raise UnknownClientError(message)
