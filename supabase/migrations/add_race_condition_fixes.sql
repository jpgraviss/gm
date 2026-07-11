-- Atomic replacements for three read-then-write races found during the
-- 2026-07 follow-up audit (AUDIT.md #43, #44, #45): each previous
-- implementation did a SELECT, computed a new value in application code,
-- then wrote it back — two concurrent callers could read the same
-- pre-update row and clobber each other's write.

-- #44 — Sequence enrollment's "one active sequence at a time" guarantee
-- was only enforced by a check-then-insert in application code. This
-- index makes it a real DB-level invariant: at most one row with
-- status='active' per contact_email. A contact's row stops matching this
-- partial index the moment it's completed/unenrolled/bounced, so
-- re-enrollment afterward is unaffected.
create unique index if not exists idx_sequence_enrollments_one_active_per_contact
  on public.sequence_enrollments (contact_email)
  where status = 'active';

-- #43 — Rotate Contact Owner round-robin. Concurrent automation runs no
-- longer read/increment/write last_index separately; the UPDATE's SET
-- expression reads the row under the lock the UPSERT already holds.
create or replace function public.next_rotation_index(p_automation_id text, p_member_count int)
returns int
language sql
as $$
  insert into public.rotation_state (id, automation_id, last_index, updated_at)
  values ('rot-' || p_automation_id, p_automation_id, 0, now())
  on conflict (automation_id) do update
    set last_index = (public.rotation_state.last_index + 1) % greatest(p_member_count, 1),
        updated_at = now()
  returning last_index;
$$;

-- #45 — training_progress checklist merge. Concurrent PATCHes to
-- different checklist items on the same content_id no longer overwrite
-- each other; the JSONB `||` merge happens inside the UPSERT itself.
create or replace function public.upsert_training_progress(
  p_id text,
  p_user_email text,
  p_content_id text,
  p_set_completed boolean,
  p_completed boolean,
  p_set_checklist boolean,
  p_checklist_item_id text,
  p_checklist_value boolean
)
returns public.training_progress
language plpgsql
as $$
declare
  result public.training_progress;
begin
  insert into public.training_progress (id, user_email, content_id, completed, checklist_state, updated_at)
  values (
    p_id,
    p_user_email,
    p_content_id,
    coalesce(p_set_completed and p_completed, false),
    case when p_set_checklist then jsonb_build_object(p_checklist_item_id, p_checklist_value) else '{}'::jsonb end,
    now()
  )
  on conflict (user_email, content_id) do update
    set completed = case when p_set_completed then p_completed else public.training_progress.completed end,
        checklist_state = case when p_set_checklist
          then public.training_progress.checklist_state || jsonb_build_object(p_checklist_item_id, p_checklist_value)
          else public.training_progress.checklist_state end,
        updated_at = now()
  returning * into result;
  return result;
end;
$$;
