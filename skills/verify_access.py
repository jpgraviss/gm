#!/usr/bin/env python3
"""Safety net for the manual GA4/GSC property-sharing process.

With 11-20 client properties invited by hand into one service account,
some invitations get missed or applied to the wrong property. This script
attempts a minimal one-row query against both GA4 and Search Console for
every active client and reports which ones are actually reachable — run
it right after sending invitations, and rerun it whenever a client is
added.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _shared import auth, registry  # noqa: E402


def _short_error(e: Exception) -> str:
    """One-line error summary. Never echoes credential file contents or
    full key paths — just the API's own error text, truncated."""
    msg = str(e).replace("\n", " ").strip()
    return msg[:120]


def check_ga4(client_record: dict, creds) -> tuple[bool, str]:
    property_id = client_record.get("ga4_property_id")
    if not property_id:
        return False, "no ga4_property_id configured"
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import DateRange, Metric, RunReportRequest

        api_client = BetaAnalyticsDataClient(credentials=creds)
        request = RunReportRequest(
            property=f"properties/{property_id}",
            metrics=[Metric(name="sessions")],
            date_ranges=[DateRange(start_date="7daysAgo", end_date="today")],
            limit=1,
        )
        api_client.run_report(request)
        return True, ""
    except Exception as e:
        return False, _short_error(e)


def check_gsc(client_record: dict, creds) -> tuple[bool, str]:
    site_url = client_record.get("gsc_property")
    if not site_url:
        return False, "no gsc_property configured"
    try:
        from googleapiclient.discovery import build

        service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
        body = {"startDate": "7daysAgo", "endDate": "today", "dimensions": ["date"], "rowLimit": 1}
        service.searchanalytics().query(siteUrl=site_url, body=body).execute()
        return True, ""
    except Exception as e:
        return False, _short_error(e)


def main():
    try:
        auth.resolve_key_path()
    except auth.CredentialsNotFoundError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)

    creds = auth.get_credentials()
    clients = registry.all_active()

    if not clients:
        print("No active clients in clients.json yet — nothing to verify.")
        sys.exit(0)

    results = []
    for c in clients:
        ga4_ok, ga4_err = check_ga4(c, creds)
        gsc_ok, gsc_err = check_gsc(c, creds)
        results.append({
            "slug": c["slug"],
            "ga4_ok": ga4_ok,
            "gsc_ok": gsc_ok,
            "error": " | ".join(filter(None, [ga4_err, gsc_err])),
        })

    slug_width = max(len("client"), max(len(r["slug"]) for r in results))
    header = f"{'client'.ljust(slug_width)}  GA4    GSC    error"
    print(header)
    print("-" * len(header))

    any_failed = False
    for r in results:
        if not (r["ga4_ok"] and r["gsc_ok"]):
            any_failed = True
        ga4_col = "yes" if r["ga4_ok"] else "no"
        gsc_col = "yes" if r["gsc_ok"] else "no"
        print(f"{r['slug'].ljust(slug_width)}  {ga4_col:<5}  {gsc_col:<5}  {r['error']}")

    sys.exit(1 if any_failed else 0)


if __name__ == "__main__":
    main()
