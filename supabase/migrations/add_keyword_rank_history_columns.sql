-- app/api/rank-tracker/sync-gsc/route.ts has always tried to write clicks
-- and impressions onto keyword_rank_history (real GSC data, correctly
-- fetched), but no migration ever added these columns — the insert has been
-- silently failing (caught, console.error'd only, never thrown) since the
-- route was built. Historical CTR/impression trend data was never actually
-- being persisted despite the code believing it was.

alter table public.keyword_rank_history
  add column if not exists clicks integer,
  add column if not exists impressions integer;
