-- Add hubspot_data JSONB column to crm_contacts for storing extended
-- HubSpot contact properties that have no direct GravHub equivalent.
alter table public.crm_contacts
  add column if not exists hubspot_data jsonb;
