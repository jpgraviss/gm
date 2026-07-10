-- Real FK from a CRM contact to the team member who owns it, alongside the
-- existing free-text `owner` display column. Needed for sequence automation
-- to resolve a "dynamic sender = this contact's assigned rep" without
-- fragile name-string matching, and for round-robin lead assignment to have
-- somewhere durable to write the rotation result.
--
-- Nullable and additive — nothing backfills it. Callers that need a sender
-- and find owner_id null fall back to the sequence's configured default
-- sender, same as today.

alter table public.crm_contacts
  add column if not exists owner_id text references public.team_members(id) on delete set null;

create index if not exists idx_crm_contacts_owner_id on public.crm_contacts(owner_id);

comment on column public.crm_contacts.owner_id is
  'FK to team_members — the contact''s assigned rep. The existing owner text column stays for display/backward-compat; this is the reference used for dynamic-sender resolution and round-robin.';
