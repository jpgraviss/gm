-- AUDIT.md #66 — sequences.enrolled_count/active_count were adjusted via a
-- plain read-then-write ("read current count, write back +delta") at three
-- separate call sites. Two concurrent enroll/unenroll calls on the same
-- sequence (for different contacts) could both read the same base count
-- and one increment/decrement gets lost. These are display-only analytics
-- — the real "one active enrollment per contact" invariant is already
-- DB-enforced by #44's unique index regardless of this — but the display
-- numbers deserve the same atomic pattern already used for
-- next_rotation_index/upsert_training_progress (#43/#45).
create or replace function public.adjust_sequence_counts(
  p_sequence_id text,
  p_enrolled_delta int,
  p_active_delta int,
  p_last_modified text default null
)
returns void
language plpgsql
as $$
begin
  update public.sequences
  set enrolled_count = greatest(0, enrolled_count + p_enrolled_delta),
      active_count   = greatest(0, active_count + p_active_delta),
      last_modified  = coalesce(p_last_modified, last_modified)
  where id = p_sequence_id;
end;
$$;
