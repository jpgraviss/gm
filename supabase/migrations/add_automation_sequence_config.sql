-- Minimal, purpose-built config storage for automations, scoped to the
-- sequence-level Automate tab (app/crm/sequences/[id]/page.tsx). This is
-- NOT a general fix for the automation builder's lack of per-action config
-- (AUDIT.md #12, which covers automations with multiple actions where a
-- flat blob would be ambiguous) — automations created from the Automate
-- tab only ever have exactly one action, so one config object per row is
-- unambiguous and sufficient here.

alter table public.automations
  add column if not exists config jsonb not null default '{}';

comment on column public.automations.config is
  'Action-specific parameters (e.g. sequenceId, senderType) merged into the trigger context when the automation runs. Safe only for single-action automations.';

-- Round-robin state for the "Rotate Contact Owner" automation action.
-- Tracked durably (not in-memory) so rotation position survives across
-- cold starts, matching the pattern already used for sequence daily send
-- counts (getDailySendCount in app/api/sequences/execute/route.ts).
create table if not exists public.rotation_state (
  id           text primary key,
  automation_id text not null references public.automations(id) on delete cascade,
  last_index   integer not null default -1,
  updated_at   timestamptz not null default now()
);

create unique index if not exists idx_rotation_state_automation on public.rotation_state(automation_id);

alter table public.rotation_state enable row level security;
create policy "auth_read_rotation_state" on public.rotation_state for select to authenticated using (true);
