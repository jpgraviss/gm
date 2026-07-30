---
name: google-analytics
description: Fetch real GA4 (Google Analytics 4) data for a Graviss client — traffic overview, top pages, landing pages, traffic sources, organic-only traffic, countries, devices, daily trends, key events (conversions), realtime activity, or a custom metric/dimension query. Use this whenever a client's website traffic, sessions, users, page views, engagement, bounce rate, or conversion numbers from Google Analytics are needed. Client is identified by slug, not a raw GA4 property ID.
---

# GA4 data connector

Fetch-only. Returns a JSON envelope (client, source, report, date range, rows, totals,
meta) — it does not format or interpret the numbers. A separate report-building layer
consumes this output.

**Invoke with:**

```
python3 skills/google-analytics/query_ga4.py --client SLUG --report TYPE [flags]
```

Client `SLUG` comes from `skills/clients.json` — never hardcode a GA4 property ID.
Look up valid slugs with any `registry.py` call, or just try a slug: an unknown one
prints every valid slug plus a suggestion if one is close.

## Report types

| type | dimensions | what you get |
|---|---|---|
| `overview` | none | users, new users, sessions, page views, engagement rate, bounce rate, avg session duration |
| `pages` | pagePath, pageTitle | page views by URL, ordered by views descending |
| `landing_pages` | landingPage | sessions/engagement/key events by landing page — the one that matters most for SEO reporting |
| `sources` | sessionSource, sessionMedium | traffic broken out by source/medium |
| `organic` | sessionSource | traffic filtered to organic medium only |
| `countries` | country | sessions/users by country |
| `devices` | deviceCategory | sessions/users by device category |
| `daily` | date | sessions/users/page views per day, ascending — for trend charts |
| `key_events` | eventName | key-event (conversion) counts and rate |
| `realtime` | unifiedScreenName | active users right now — **no date range**, rejects `--compare`/`--days`/`--start`/`--end` |
| `custom` | user-supplied via `--dimensions` | any metrics via `--metrics`, comma-separated GA4 API names |

## CLI contract

```
--client SLUG           required unless --all-clients
--all-clients           loop every active client in clients.json
--report TYPE           required, see table above
--days N                lookback window, default 30
--start YYYY-MM-DD       explicit start, overrides --days
--end YYYY-MM-DD         explicit end, defaults to today
--compare                also fetch the immediately preceding period of equal length
--limit N                max rows, default 25
--output json|table|csv  default json — table/csv are for human inspection only
--metrics NAME,NAME      required for --report custom
--dimensions NAME,NAME   optional for --report custom
```

**Output is JSON by default.** Use `--output table` when a human needs to eyeball
results directly.

## Examples

```
# Traffic overview for the last 30 days
python3 skills/google-analytics/query_ga4.py --client formetco --report overview

# Top 10 landing pages, last quarter, compared to the prior quarter
python3 skills/google-analytics/query_ga4.py --client formetco --report landing_pages \
  --days 90 --compare --limit 10

# Custom query: sessions and conversions by channel grouping, across every active client
python3 skills/google-analytics/query_ga4.py --all-clients --report custom \
  --metrics sessions,keyEvents --dimensions sessionDefaultChannelGroup
```

## Notes

- GA4 data for the current day is always incomplete. If `--end` resolves to today,
  the envelope's `meta.warnings` says so — don't treat a same-day number as final.
- `realtime` has no date range at all; passing `--compare`, `--days`, `--start`, or
  `--end` with it is a hard error, not a silent ignore.
- `--all-clients` never aborts on one client's failure — a client whose GA4 property
  isn't shared with the service account gets an envelope with an `error` key instead
  of crashing the whole batch. Run `python3 skills/verify_access.py` first if you're
  not sure which clients are actually reachable.
- Metric/dimension names are exact GA4 Data API identifiers (camelCase, e.g.
  `screenPageViews`, `sessionDefaultChannelGroup`) — the same vocabulary Google's own
  GA4 Query Explorer uses.
