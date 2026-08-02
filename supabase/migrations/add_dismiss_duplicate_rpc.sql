-- AUDIT #683 — POST /api/crm/duplicates/ignore did a non-atomic
-- read-modify-write on app_settings.dismissed_duplicates: SELECT the
-- current JSON, push the new groupKey into it in application code, then
-- upsert the whole row back. Two concurrent "Ignore" calls on different
-- duplicate groups (two staff working the queue at once, or a
-- double-click) can both read the same pre-update array, and the second
-- upsert silently clobbers the first's addition — the earlier dismissal
-- reappears on the next scan. Same read-then-write race class as #43/#44/
-- #45 (add_race_condition_fixes.sql), fixed the same way: do the
-- read-modify-write inside a single statement, under the row lock the
-- UPSERT already holds, instead of splitting it across app code and a
-- network round trip.
create or replace function public.dismiss_duplicate(p_type text, p_group_key text)
returns void
language plpgsql
as $$
begin
  insert into public.app_settings (id, dismissed_duplicates)
  values ('global', jsonb_build_object(p_type, jsonb_build_array(p_group_key)))
  on conflict (id) do update
  set dismissed_duplicates = jsonb_set(
    coalesce(public.app_settings.dismissed_duplicates, '{}'::jsonb),
    array[p_type],
    (
      select coalesce(jsonb_agg(distinct elem), '[]'::jsonb)
      from jsonb_array_elements(
        coalesce(public.app_settings.dismissed_duplicates -> p_type, '[]'::jsonb)
        || jsonb_build_array(p_group_key)
      ) as elem
    ),
    true
  );
end;
$$;
