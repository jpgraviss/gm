-- AUDIT.md #415 — the HubSpot engagements import (notes/calls/emails/
-- meetings) did a pure existence check against `crm_activities` and
-- skipped a previously-imported row forever, with no way to tell an
-- unchanged row from one a rep had since edited in HubSpot (e.g. a
-- corrected call disposition or a rewritten meeting note). Mirrors the
-- freshness-comparison fix already shipped for Granola (commit 8093d94,
-- lib/granola.ts) but that fix reused an existing column
-- (granola_meeting_notes.occurred_at) that already held a comparable
-- signal on every row; crm_activities has no such column to double up —
-- `timestamp` is the engagement's own business time (call/meeting
-- occurred-at) and must not be overwritten with HubSpot's mod-time, and
-- `created_at` is relied on elsewhere as row-insertion time, not
-- business time (see the comment in app/api/crm/activities/route.ts).
--
-- So this adds a dedicated column instead: the imported engagement's
-- HubSpot `hs_lastmodifieddate`, written on every insert/update by
-- app/api/integrations/hubspot/engagements/route.ts and compared against
-- the incoming value on re-import to decide skip vs. update. NULL (all
-- pre-fix rows, until their next re-import) is treated by that route as
-- "unknown, needs a compare" rather than "definitely stale" — unlike
-- Granola's occurred_at, which was already populated on every existing
-- row before its fix landed, here NULL is the expected general case for
-- anything imported before this migration, not just an edge case.
--
-- NOTE: this migration has NOT been run against the live database —
-- apply manually (see AUDIT.md #380 for the same no-live-DB-access
-- convention this session follows).

alter table public.crm_activities
  add column if not exists hs_last_modified timestamptz;
