-- First-touch UTM/source attribution on crm_contacts. Deals join through
-- deals.contact_id to get a contact's original source — deliberately not
-- duplicated onto deals itself, so there's one source of truth per lead
-- ("original source", same concept HubSpot uses) instead of two fields that
-- can drift.
--
-- Captured once at contact-creation time by the public funnel/form submit
-- routes and never overwritten afterward, so a contact's first real touch
-- point survives even if they later convert through a different channel.

alter table public.crm_contacts
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text,
  add column if not exists landing_url text;
