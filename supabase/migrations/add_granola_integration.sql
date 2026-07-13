-- Granola (granola.ai) meeting-notes integration. Follows the same
-- inert-until-configured pattern as AUDIT.md #33 (geolocation): fully
-- wired end to end, but makes zero network calls until an admin pastes a
-- real API key into Settings > Integrations.
alter table public.app_settings
  add column if not exists granola jsonb not null default '{}';

create table if not exists public.granola_meeting_notes (
  id                   text primary key,
  granola_document_id  text not null unique,
  title                text not null default '',
  summary              text,
  attendees            jsonb not null default '[]'::jsonb,
  occurred_at          timestamptz,
  company_id           text references public.crm_companies(id) on delete set null,
  contact_id           text references public.crm_contacts(id) on delete set null,
  activity_id          text references public.crm_activities(id) on delete set null,
  synced_at            timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

create index if not exists idx_granola_notes_company on public.granola_meeting_notes(company_id);
create index if not exists idx_granola_notes_contact on public.granola_meeting_notes(contact_id);

alter table public.granola_meeting_notes enable row level security;

-- AUDIT.md #47 precedent — scope SELECT to staff only, not "any
-- authenticated user", from the start rather than shipping the wide-open
-- pattern and having to tighten it later.
create policy "staff_read_granola_notes" on public.granola_meeting_notes
  for select to authenticated
  using (
    exists (
      select 1 from public.team_members tm
      where tm.email = (auth.jwt() ->> 'email')
    )
  );
