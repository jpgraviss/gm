-- AUDIT #66 follow-up (task #126) — extend adjust_sequence_counts() to also
-- cover completed_count, and finish rolling it out to the remaining call
-- sites (execute/webhooks/unsubscribe/reply-check/enrollments) that were
-- still doing a plain read-then-write.
--
-- app/api/sequences/execute/route.ts fetches one `seq` snapshot per
-- sequence ID up front, then loops over every enrollment for that sequence
-- in a single request — so two enrollments in the same sequence completing
-- in the same batch both read active_count/completed_count from the SAME
-- stale snapshot and one increment is lost. This isn't just a
-- cross-request race, it reproduces deterministically within one cron
-- tick. completed_count needs the same atomic column-update treatment as
-- enrolled_count/active_count already got.
--
-- Function signature is changing (new p_completed_delta param), so the old
-- 4-arg overload must be dropped first — CREATE OR REPLACE only replaces a
-- function with an identical parameter type list; a different arg count
-- creates a second, ambiguous overload instead of replacing the first,
-- which would break every existing 3-named-arg call site with a
-- "function is not unique" error.
drop function if exists public.adjust_sequence_counts(text, int, int, text);

create or replace function public.adjust_sequence_counts(
  p_sequence_id text,
  p_enrolled_delta int,
  p_active_delta int,
  p_last_modified text default null,
  p_completed_delta int default 0
)
returns void
language plpgsql
as $$
begin
  update public.sequences
  set enrolled_count  = greatest(0, enrolled_count + p_enrolled_delta),
      active_count    = greatest(0, active_count + p_active_delta),
      completed_count = greatest(0, completed_count + p_completed_delta),
      last_modified   = coalesce(p_last_modified, last_modified)
  where id = p_sequence_id;
end;
$$;
