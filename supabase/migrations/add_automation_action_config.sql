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
-- Postgres can't auto-cast text[] -> jsonb, and jsonb_agg() over an empty
-- unnest() returns NULL (not '[]'), which the column's own
-- "not null default '{}'" would reject — hence the explicit COALESCE.
alter table public.automations
  alter column actions type jsonb
  using coalesce(
    (select jsonb_agg(jsonb_build_object('type', a, 'config', '{}'::jsonb)) from unnest(actions) as a),
    '[]'::jsonb
  ),
  alter column actions set default '[]'::jsonb;
