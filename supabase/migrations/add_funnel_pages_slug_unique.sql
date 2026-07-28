-- AUDIT.md #430 — `funnel_pages` had no unique constraint on
-- (funnel_id, slug), only a plain non-unique index
-- (idx_funnel_pages_slug, from add_funnels.sql). `POST
-- /api/funnels/[id]/pages` set a new page's slug with no
-- uniqueness check at all (unlike funnel-level creation in
-- app/api/funnels/route.ts, which already retries up to 10x on
-- collision) — a duplicate slug within the same funnel (easy to
-- trigger via the editor's "Add" button, which had no
-- double-click guard) made the second page unreachable via a
-- direct `?step=` link, with no page-delete route or UI anywhere
-- to recover except deleting the whole funnel.
--
-- The application-level fix (retry-on-collision in
-- app/api/funnels/[id]/pages/route.ts POST, mirroring the
-- funnel-level pattern, plus a saving-state double-click guard on
-- the "Add" button in app/funnels/page.tsx) closes the hole for
-- all NEW pages going forward. This migration adds the matching
-- DB-level constraint so the invariant holds even if a future
-- code path forgets the retry loop.
--
-- NOTE: this migration has NOT been run against the live database
-- — apply manually. Before applying, check for any pre-existing
-- duplicate (funnel_id, slug) pairs (creating a unique index fails
-- if duplicates already exist):
--
--   select funnel_id, slug, count(*)
--   from public.funnel_pages
--   group by funnel_id, slug
--   having count(*) > 1;
--
-- If that query returns any rows, rename the extra slug(s) (e.g.
-- append a short random suffix, same shape the retry loop now
-- generates) before creating the index below.

create unique index if not exists idx_funnel_pages_funnel_slug_unique
  on public.funnel_pages (funnel_id, slug);

-- The old non-unique index from add_funnels.sql is now redundant
-- (a unique index on the same leading columns already serves any
-- lookup/join the old one did) — drop it.
drop index if exists public.idx_funnel_pages_slug;
