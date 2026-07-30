# Google Business Profile — pending

Not built yet. GBP API access was submitted separately and is sitting in Google's
multi-week approval queue as of this writing — see `clients.json`'s `gbp_location_id`
field, which stays `null` for every client until that lands.

When access is approved:

- GBP typically needs an OAuth user-consent flow rather than a service account (unlike
  GA4/GSC, which share one service-account credential today) — `skills/_shared/auth.py`
  already has a `get_gbp_credentials()` stub reserved for this, so this connector can
  be added without touching the other two.
- Follow the same shape as `google-analytics/` and `google-search-console/`: a
  `SKILL.md`, a `query_gbp.py`, the same JSON envelope from `skills/_shared/envelope.py`,
  and a `gbp_location_id`-keyed lookup through `skills/_shared/registry.py` instead of
  a new registry file.
- Report types will likely cover: reviews (rating, text, response status), search/maps
  insights (views, searches, actions), and Q&A — confirm the exact API surface against
  the Business Profile Performance API once access is live, since it has changed shape
  more than once.

Do not build this until GBP access is actually approved — there's nothing to test it
against, and the API surface is worth re-confirming at that point rather than guessing
now.
