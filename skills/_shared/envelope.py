"""JSON output envelope shared by every connector script and report type.

Two consumers depend on this shape later: a report-formatting skill/prompt
layer, and (later still) the GravHub SEO operations engine. Keep it exactly
as documented in the build spec — extend `meta` for anything script-specific
rather than adding ad hoc top-level fields.

This module contains rendering only (json/table/csv). It does not decide
what data goes into an envelope — that's each connector's job.
"""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_envelope(
    *,
    client: str,
    source: str,
    report: str,
    property_id,
    date_range: dict | None,
    comparison_range: dict | None,
    rows: list[dict],
    totals: dict | None = None,
    warnings: list[str] | None = None,
    sampled: bool = False,
) -> dict:
    return {
        "client": client,
        "source": source,
        "report": report,
        "property_id": property_id,
        "date_range": date_range,
        "comparison_range": comparison_range,
        "rows": rows,
        "totals": totals or {},
        "meta": {
            "row_count": len(rows),
            "sampled": sampled,
            "fetched_at": _now_iso(),
            "warnings": warnings or [],
        },
    }


def build_error_envelope(*, client: str, source: str, report: str, error: str) -> dict:
    """Shape returned for one failed client during an --all-clients run.
    The run must keep going past a single failure — this is how the caller
    sees exactly which clients broke and why, rather than the whole batch
    aborting on the first bad property."""
    return {
        "client": client,
        "source": source,
        "report": report,
        "property_id": None,
        "date_range": None,
        "comparison_range": None,
        "rows": [],
        "totals": {},
        "error": error,
        "meta": {
            "row_count": 0,
            "sampled": False,
            "fetched_at": _now_iso(),
            "warnings": [],
        },
    }


def render(envelope: dict, output: str = "json") -> str:
    if output == "json":
        return json.dumps(envelope, indent=2)
    if output == "table":
        return _render_table(envelope)
    if output == "csv":
        return _render_csv(envelope)
    raise ValueError(f"Unknown output format '{output}' — expected json, table, or csv")


def render_many(envelopes: list[dict], output: str = "json") -> str:
    """--all-clients always emits a JSON array, regardless of --output —
    table/csv don't have a sane meaning across N clients' worth of rows at
    once, so only json is supported here."""
    if output != "json":
        raise ValueError("--all-clients only supports --output json (table/csv are per-client)")
    return json.dumps(envelopes, indent=2)


def emit(envelope: dict, output: str = "json") -> None:
    print(render(envelope, output))


def _render_table(envelope: dict) -> str:
    rows = envelope.get("rows", [])
    if not rows:
        return "(no rows)"
    headers = list(rows[0].keys())
    widths = [
        max(len(h), max((len(str(r.get(h, ""))) for r in rows), default=0))
        for h in headers
    ]
    lines = ["  ".join(h.ljust(w) for h, w in zip(headers, widths))]
    lines.append("  ".join("-" * w for w in widths))
    for r in rows:
        lines.append("  ".join(str(r.get(h, "")).ljust(w) for h, w in zip(headers, widths)))
    return "\n".join(lines)


def _render_csv(envelope: dict) -> str:
    rows = envelope.get("rows", [])
    if not rows:
        return ""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()
