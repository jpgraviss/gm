-- AUDIT.md #444 — lib/client-reports.ts's saveReportSnapshot() did a blind
-- insert with a random id (`snap-${Date.now()}-${random}-${product}`), so
-- every re-generation of a report for the same company+product+period
-- (staff re-running a report, a retry after a partial failure, a cron
-- re-delivery) silently added another row instead of replacing the old
-- one. getPreviousSnapshot()'s `order('period_start', desc).limit(1)` then
-- had no deterministic tiebreak among same-period duplicates, feeding the
-- AI-generated month-over-month narrative that gets emailed to real
-- clients — this could silently flip an "up X%" claim to "down X%" (or
-- vice versa) depending purely on which duplicate row happened to sort
-- first.
--
-- This adds the unique index saveReportSnapshot() now upserts against,
-- same convention as add_client_integrations.sql's
-- `unique (workspace_id, company_name)` (that upsert also relies on
-- workspace_id's column default rather than setting it explicitly — same
-- pattern used here).
--
-- NOTE: this migration has NOT been run against the live database — apply
-- manually. Existing duplicate rows (if any have already accumulated) will
-- need a manual dedup pass before this index can be created, since a
-- unique index creation fails if duplicates already exist; check for dupes
-- first with:
--   select workspace_id, company_name, product, period_start, period_end, count(*)
--   from public.client_data_snapshots
--   group by 1,2,3,4,5 having count(*) > 1;

create unique index if not exists idx_client_data_snapshots_natural_key
  on public.client_data_snapshots (workspace_id, company_name, product, period_start, period_end);
