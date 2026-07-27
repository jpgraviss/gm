-- AUDIT.md #482 — the HubSpot deals import keyed update-detection off
-- `${company}|${stage}|${value}`, a composite of mutable HubSpot fields.
-- The entire point of syncing a pipeline is that stage/amount change over
-- time, so any real progression recomputes a key that no longer matches
-- the stored one, and the importer inserts a duplicate row instead of
-- updating — leaving the old, now-stale row behind. Same bug class as the
-- Granola fix (commit 8093d94) and the HubSpot engagements fix (#415,
-- commit 93186b8, migration add_crm_activities_hs_last_modified.sql):
-- both replaced a mutable/fragile comparison key with a stable id or
-- freshness signal actually written back on every insert/update.
--
-- `deals` has no column at all holding the HubSpot deal id (the row `id`
-- column is a mix of legacy HubSpot-numeric-id values from the original
-- bulk import in 20250706120000_import_hubspot_latest.sql and app-
-- generated `deal-<timestamp>-<rand>` values from manually-created deals
-- and the current importer — it cannot be relied on as a clean HubSpot-id
-- lookup key going forward). This adds a dedicated column instead.
--
-- app/api/integrations/hubspot/deals/route.ts now keys its update lookup
-- on hubspot_deal_id first. NULL (every row that predates this fix,
-- including the legacy bulk-imported ones whose `id` happens to already
-- be the HubSpot id) is treated as "unknown, not yet linked" rather than
-- "definitely a new deal" — same NULL-means-unknown reasoning #415 used
-- for hs_last_modified — so the importer falls back to the old
-- company|stage|value composite match ONCE per row to find the correct
-- existing deal and backfill hubspot_deal_id onto it instead of creating
-- a duplicate. Every sync after that backfill lands uses the stable id
-- directly.
--
-- NOTE: this migration has NOT been run against the live database —
-- apply manually (see AUDIT.md #380 for the same no-live-DB-access
-- convention this session follows).

alter table public.deals
  add column if not exists hubspot_deal_id text;

create unique index if not exists idx_deals_hubspot_deal_id
  on public.deals(hubspot_deal_id)
  where hubspot_deal_id is not null;
