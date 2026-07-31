#!/usr/bin/env python3
"""GA4 data connector — fetch only.

Pulls a report from the GA4 Data API for one Graviss client (or every
active client) and prints a JSON envelope (see skills/_shared/envelope.py).
This script does no formatting or interpretation of the numbers — that's
a separate layer built later, consuming this JSON. See SKILL.md in this
directory for the full report-type table and CLI contract.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from _shared import auth, dates, envelope, registry  # noqa: E402

REPORT_DIMENSIONS = {
    "overview": [],
    "pages": ["pagePath", "pageTitle"],
    "landing_pages": ["landingPage"],
    "sources": ["sessionSource", "sessionMedium"],
    "organic": ["sessionSource"],
    "countries": ["country"],
    "devices": ["deviceCategory"],
    "daily": ["date"],
    "key_events": ["eventName"],
    "realtime": ["unifiedScreenName"],
    "custom": [],  # driven by --dimensions
}

OVERVIEW_METRICS = [
    "totalUsers", "newUsers", "sessions", "screenPageViews",
    "engagementRate", "bounceRate", "averageSessionDuration",
]

DEFAULT_METRICS = {
    "overview": OVERVIEW_METRICS,
    "pages": ["screenPageViews"],
    "landing_pages": ["sessions", "engagementRate", "keyEvents"],
    "sources": ["sessions", "totalUsers"],
    "organic": ["sessions", "totalUsers"],
    "countries": ["sessions", "totalUsers"],
    "devices": ["sessions", "totalUsers"],
    "daily": ["sessions", "totalUsers", "screenPageViews"],
    "key_events": ["eventCount", "eventCountPerUser"],
    "realtime": ["activeUsers"],
}

MAX_RETRIES = 3
REALTIME_ONLY_DEFAULTS = {"days": 30, "compare": False, "start": None, "end": None}


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Fetch GA4 data for a Graviss client.")
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument("--client", help="Client slug from clients.json")
    group.add_argument("--all-clients", action="store_true", help="Run for every active client")
    p.add_argument("--report", required=True, choices=sorted(REPORT_DIMENSIONS.keys()))
    p.add_argument("--days", type=int, default=30)
    p.add_argument("--start", help="YYYY-MM-DD, overrides --days")
    p.add_argument("--end", help="YYYY-MM-DD, defaults to today")
    p.add_argument("--compare", action="store_true", help="Also fetch the immediately preceding period")
    p.add_argument("--limit", type=int, default=25)
    p.add_argument("--output", choices=["json", "table", "csv"], default="json")
    p.add_argument("--metrics", help="Comma-separated GA4 metric names — required for --report custom")
    p.add_argument("--dimensions", help="Comma-separated GA4 dimension names — for --report custom")
    return p


def _rows_from_response(response, dims: list[str], metrics: list[str]) -> list[dict]:
    rows = []
    for row in response.rows:
        record = {}
        for i, d in enumerate(dims):
            record[d] = row.dimension_values[i].value
        for i, m in enumerate(metrics):
            record[m] = row.metric_values[i].value
        rows.append(record)
    return rows


def _fetch_with_retry(fn, *args, **kwargs):
    """Retries a GA4 API call on 429 (quota) / 503 (unavailable), up to
    MAX_RETRIES attempts total, with exponential backoff."""
    from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            return fn(*args, **kwargs)
        except (ResourceExhausted, ServiceUnavailable) as e:
            last_error = e
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
    raise last_error


def _run_realtime(api_client, property_id: str, limit: int):
    from google.analytics.data_v1beta.types import Dimension, Metric, RunRealtimeReportRequest

    dims = REPORT_DIMENSIONS["realtime"]
    metrics = DEFAULT_METRICS["realtime"]
    request = RunRealtimeReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name=d) for d in dims],
        metrics=[Metric(name=m) for m in metrics],
        limit=limit,
    )
    response = _fetch_with_retry(api_client.run_realtime_report, request)
    return _rows_from_response(response, dims, metrics), False, []


def _run_dated_report(api_client, property_id: str, report: str, args, date_range: dict):
    from google.analytics.data_v1beta.types import (
        DateRange, Dimension, Filter, FilterExpression, Metric, RunReportRequest,
    )

    if report == "custom":
        if not args.metrics:
            raise ValueError("--report custom requires --metrics (comma-separated GA4 metric names)")
        dims = args.dimensions.split(",") if args.dimensions else []
        metrics = args.metrics.split(",")
    else:
        dims = REPORT_DIMENSIONS[report]
        metrics = DEFAULT_METRICS[report]

    dim_filter = None
    if report == "organic":
        dim_filter = FilterExpression(
            filter=Filter(
                field_name="sessionMedium",
                string_filter=Filter.StringFilter(value="organic"),
            )
        )

    order_bys = None
    if report == "pages" and metrics:
        order_bys = [{"metric": {"metric_name": metrics[0]}, "desc": True}]

    def fetch(dr: dict):
        request = RunReportRequest(
            property=f"properties/{property_id}",
            dimensions=[Dimension(name=d) for d in dims],
            metrics=[Metric(name=m) for m in metrics],
            date_ranges=[DateRange(start_date=dr["start"], end_date=dr["end"])],
            dimension_filter=dim_filter,
            limit=args.limit,
            order_bys=order_bys,
        )
        return _fetch_with_retry(api_client.run_report, request)

    response = fetch(date_range)
    rows = _rows_from_response(response, dims, metrics)

    api_warnings = []
    metadata = getattr(response, "metadata", None)
    sampled = bool(metadata and getattr(metadata, "data_loss_from_other_row", False))
    if sampled:
        api_warnings.append("GA4 reported possible data loss from row aggregation (data_loss_from_other_row) — totals may be incomplete.")

    comparison_rows = None
    if args.compare:
        comp_response = fetch(dates.comparison_range(date_range))
        comparison_rows = _rows_from_response(comp_response, dims, metrics)

    return rows, comparison_rows, sampled, api_warnings


def _run_query(client_record: dict, args):
    """Runs one GA4 report for one client. Imports the google-analytics-data
    client lazily so credential/registry failures never require the
    library to be importable — see the definition-of-done in the build
    spec (a no-credentials run must fail cleanly, not with an ImportError
    traceback)."""
    from google.analytics.data_v1beta import BetaAnalyticsDataClient

    creds = auth.get_credentials()
    api_client = BetaAnalyticsDataClient(credentials=creds)
    property_id = client_record["ga4_property_id"]

    if args.report == "realtime":
        rows, sampled, api_warnings = _run_realtime(api_client, property_id, args.limit)
        return rows, None, sampled, api_warnings

    date_range = dates.resolve_range(args.days, args.start, args.end)
    return _run_dated_report(api_client, property_id, args.report, args, date_range)


def run_for_client(slug: str, args) -> dict:
    try:
        client_record = registry.resolve(slug)
    except registry.UnknownClientError as e:
        return envelope.build_error_envelope(client=slug, source="ga4", report=args.report, error=str(e))

    if args.report == "realtime" and (
        args.compare or args.start or args.end or args.days != REALTIME_ONLY_DEFAULTS["days"]
    ):
        return envelope.build_error_envelope(
            client=slug, source="ga4", report=args.report,
            error="--report realtime has no date range and does not accept --compare, --days, --start, or --end.",
        )

    warnings: list[str] = []
    date_range = None
    comparison_range = None
    # AUDIT #576 — dates.resolve_range() used to run outside this try/except,
    # so a bad --start/--end (single-`--client` path) raised straight out of
    # run_for_client with a bare traceback instead of the clean error
    # envelope every other failure in this function produces. The
    # --all-clients loop in main() was unaffected since it wraps this whole
    # call in its own try/except.
    try:
        if args.report != "realtime":
            date_range = dates.resolve_range(args.days, args.start, args.end)
            if dates.is_end_today(date_range):
                warnings.append("date_range.end is today — GA4 data for the current day is still incomplete.")
            if args.compare:
                comparison_range = dates.comparison_range(date_range)

        rows, comparison_rows, sampled, api_warnings = _run_query(client_record, args)
    except Exception as e:
        return envelope.build_error_envelope(client=slug, source="ga4", report=args.report, error=str(e))

    env = envelope.build_envelope(
        client=client_record["slug"],
        source="ga4",
        report=args.report,
        property_id=client_record["ga4_property_id"],
        date_range=date_range,
        comparison_range=comparison_range,
        rows=rows,
        warnings=warnings + api_warnings,
        sampled=sampled,
    )
    if comparison_rows is not None:
        env["comparison_rows"] = comparison_rows
    return env


def main():
    args = build_arg_parser().parse_args()

    # Slug validation needs no credentials, so it runs first — an unknown
    # slug should fail with the valid-slug listing even before a key file
    # exists.
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
            except Exception as e:  # keep the batch going past one bad client
                results.append(envelope.build_error_envelope(
                    client=c["slug"], source="ga4", report=args.report, error=str(e),
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
