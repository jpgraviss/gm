---
name: google-search-console
description: Fetch real Google Search Console data for a Graviss client — top search queries, top ranking pages, query/page combinations, countries, devices, or daily trend for clicks/impressions/CTR/position. Use this whenever a client's organic search performance, keyword rankings, click-through rate, or search impressions from Google Search Console are needed. Client is identified by slug, not a raw site URL or property string.
---

# Search Console data connector

Fetch-only. Returns a JSON envelope (client, source, report, date range, rows, totals,
meta) — no formatting or interpretation. A separate report-building layer consumes
this output.

**Invoke with:**

```
python3 skills/google-search-console/query_gsc.py --client SLUG --report TYPE [flags]
```

Client `SLUG` comes from `skills/clients.json` — never hardcode a site URL. An
unknown slug prints every valid slug plus a suggestion if one is close.

## Report types

| type | dimensions |
|---|---|
| `queries` | query |
| `pages` | page |
| `query_pages` | query, page |
| `countries` | country |
| `devices` | device |
| `dates` | date |

Metrics are fixed by the Search Console API and always included: `clicks`,
`impressions`, `ctr`, `position`. There is no `--metrics` flag here — unlike GA4,
Search Console doesn't let you choose a different metric set.

## CLI contract

```
--client SLUG           required unless --all-clients
--all-clients           loop every active client in clients.json
--report TYPE           required, see table above
--days N                lookback window, default 30
--start YYYY-MM-DD       explicit start, overrides --days
--end YYYY-MM-DD         explicit end — see the lag note below before overriding
--compare                also fetch the immediately preceding period of equal length
--limit N                max rows, default 25 (paginates automatically past the API's 25000/request cap)
--output json|table|csv  default json — table/csv are for human inspection only
```

**Output is JSON by default.**

## ⚠️ Data lag — read this before asking "why are the numbers wrong"

Search Console data is roughly **2 to 3 days behind real time**. A request with
`--end` set to today will come back with zero or partial rows for the last couple of
days — this is the single most common source of "the numbers look wrong" in Search
Console reporting.

To avoid this, **`--end` defaults to 3 days ago, not today**, whenever `--end` isn't
given explicitly. When that default kicks in, the envelope's `meta.warnings` records
exactly what date it used, so it's never a silent adjustment.

## Examples

```
# Top 25 queries for the last 30 days (ending 3 days ago by default)
python3 skills/google-search-console/query_gsc.py --client formetco --report queries

# Top 50 pages by clicks, last quarter vs. the prior quarter
python3 skills/google-search-console/query_gsc.py --client formetco --report pages \
  --days 90 --compare --limit 50

# Daily click/impression trend across every active client
python3 skills/google-search-console/query_gsc.py --all-clients --report dates
```

## Notes

- `gsc_property` in `clients.json` must be the exact Search Console property string:
  `sc-domain:example.com` for a domain property, or `https://example.com/` (trailing
  slash included) for a URL-prefix property. These are not interchangeable — the API
  rejects the wrong form outright.
- `--limit` above 25000 paginates automatically using `startRow`; you don't need to
  page manually.
- `--all-clients` never aborts on one client's failure — a client whose property isn't
  shared with the service account gets an envelope with an `error` key instead of
  crashing the whole batch. Run `python3 skills/verify_access.py` first if you're not
  sure which clients are actually reachable.
