#!/usr/bin/env python3
"""Search Console data connector — fetch only.

Pulls a report from the Search Console API (searchanalytics.query) for one
Graviss client (or every active client) and prints a JSON envelope (see
skills/_shared/envelope.py). No formatting or interpretation here — see
SKILL.md in this directory for the full report-type table and CLI contract.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from _shared import auth, dates, envelope, registry  # noqa: E402

REPORT_DIMENSIONS = {
    "queries": ["query"],
    "pages": ["page"],
    "query_pages": ["query", "page"],
    "countries": ["country"],
    "devices": ["device"],
    "dates": ["date"],
}

# Fixed by the Search Console API — do not attempt to request others.
METRICS = ["clicks", "impressions", "ctr", "position"]

# Search Console data lags roughly 2-3 days; a request ending today comes
# back zero or partial. Default --end to 3 days ago instead of today.
GSC_LAG_DAYS = 3
API_PAGE_SIZE = 25000


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Fetch Search Console data for a Graviss client.")
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--client", help="Client slug from clients.json")
    group.add_argument("--all-clients", action="store_true", help="Run for every active client")
    p.add_argument("--report", required=True, choices=sorted(REPORT_DIMENSIONS.keys()))
    p.add_argument("--days", type=int, default=30)
    p.add_argument("--start", help="YYYY-MM-DD, overrides --days")
    p.add_argument("--end", help="YYYY-MM-DD, defaults to 3 days ago (Search Console's reporting lag)")
    p.add_argument("--compare", action="store_true", help="Also fetch the immediately preceding period")
    p.add_argument("--limit", type=int, default=25)
    p.add_argument("--output", choices=["json", "table", "csv"], default="json")
    return p


def _fetch_page(service, site_url: str, date_range: dict, dims: list[str], row_limit: int, start_row: int):
    from googleapiclient.errors import HttpError

    body = {
        "startDate": date_range["start"],
        "endDate": date_range["end"],
        "dimensions": dims,
        "rowLimit": row_limit,
        "startRow": start_row,
    }
    last_error = None
    for attempt in range(3):
        try:
            return service.searchanalytics().query(siteUrl=site_url, body=body).execute()
        except HttpError as e:
            status = getattr(e.resp, "status", None)
            last_error = e
            if status in (429, 503) and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            raise
    raise last_error


def _run_query(client_record: dict, date_range: dict, dims: list[str], limit: int) -> list[dict]:
    """Fetches one GSC report for one client + date range, paginating past
    the API's 25000-row-per-request cap when --limit exceeds it. Imports
    googleapiclient lazily so credential/registry failures never require
    the library to be importable."""
    from googleapiclient.discovery import build

    creds = auth.get_credentials()
    service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
    site_url = client_record["gsc_property"]

    rows: list[dict] = []
    start_row = 0
    remaining = limit
    while remaining > 0:
        page_size = min(remaining, API_PAGE_SIZE)
        resp = _fetch_page(service, site_url, date_range, dims, page_size, start_row)
        api_rows = resp.get("rows", [])
        for r in api_rows:
            record = dict(zip(dims, r["keys"]))
            record["clicks"] = r.get("clicks")
            record["impressions"] = r.get("impressions")
            record["ctr"] = r.get("ctr")
            record["position"] = r.get("position")
            rows.append(record)
        if len(api_rows) < page_size:
            break
        start_row += page_size
        remaining -= page_size

    return rows


def run_for_client(slug: str, args) -> dict:
    try:
        client_record = registry.resolve(slug)
    except registry.UnknownClientError as e:
        return envelope.build_error_envelope(client=slug, source="gsc", report=args.report, error=str(e))

    warnings: list[str] = []
    date_range = dates.resolve_range(args.days, args.start, args.end, default_end_offset_days=GSC_LAG_DAYS)
    if not args.end:
        warnings.append(
            f"--end not given — defaulted to {date_range['end']} (today minus {GSC_LAG_DAYS} days) "
            "because Search Console data lags roughly 2-3 days and a request ending today "
            "would return zero or partial rows."
        )

    dims = REPORT_DIMENSIONS[args.report]

    try:
        rows = _run_query(client_record, date_range, dims, args.limit)
    except Exception as e:
        return envelope.build_error_envelope(client=slug, source="gsc", report=args.report, error=str(e))

    comparison_range = None
    comparison_rows = None
    if args.compare:
        comparison_range = dates.comparison_range(date_range)
        try:
            comparison_rows = _run_query(client_record, comparison_range, dims, args.limit)
        except Exception as e:
            warnings.append(f"Comparison-period fetch failed: {e}")
            comparison_range = None

    env = envelope.build_envelope(
        client=client_record["slug"],
        source="gsc",
        report=args.report,
        property_id=client_record["gsc_property"],
        date_range=date_range,
        comparison_range=comparison_range,
        rows=rows,
        warnings=warnings,
    )
    if comparison_rows is not None:
        env["comparison_rows"] = comparison_rows
    return env


def main():
    args = build_arg_parser().parse_args()

    if not args.all_clients:
        try:
            registry.resolve(args.client)
        except registry.UnknownClientError as e:
            print(str(e), file=sys.stderr)
            sys.exit(1)

    try:
        auth.resolve_key_path()
    except auth.CredentialsNotFoundError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)

    if args.all_clients:
        results = []
        for c in registry.all_active():
            try:
                results.append(run_for_client(c["slug"], args))
            except Exception as e:
                results.append(envelope.build_error_envelope(
                    client=c["slug"], source="gsc", report=args.report, error=str(e),
                ))
        print(envelope.render_many(results, args.output))
        if any("error" in r for r in results):
            sys.exit(1)
    else:
        env = run_for_client(args.client, args)
        envelope.emit(env, args.output)
        if "error" in env:
            sys.exit(1)


if __name__ == "__main__":
    main()
