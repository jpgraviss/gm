-- AUDIT.md #12, Increment 2 — real per-action config.
--
-- automations.actions was text[] — a flat array of action-type label
-- strings with nowhere to store per-action parameters. Two "Add Tag"
-- actions in one automation could never carry two different tag names;
-- every action read from one shared, automation-level context instead of
-- its own config.
--
-- Converts actions to jsonb: an array of {type, config} objects instead
-- of bare strings. Existing rows are backfilled so each string `a` becomes
-- {type: a, config: {}} — matches current real behavior exactly, since no
-- action has ever had real per-action config before this.
--
-- Postgres won't allow a subquery directly inside an ALTER COLUMN ... TYPE
-- USING transform expression ("cannot use subquery in transform
-- expression") — the aggregate-over-unnest() logic has to live in a
-- function instead, called as a plain scalar expression per row. The
-- helper function is dropped again immediately after use.
create or replace function public._migrate_actions_to_jsonb(arr text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('type', a, 'config', '{}'::jsonb)),
    '[]'::jsonb
  )
  from unnest(arr) as a
$$;

alter table public.automations
  alter column actions type jsonb
  using public._migrate_actions_to_jsonb(actions),
  alter column actions set default '[]'::jsonb;

drop function public._migrate_actions_to_jsonb(text[]);
