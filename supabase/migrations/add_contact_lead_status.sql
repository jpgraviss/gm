-- Add lead_status column to crm_contacts for HubSpot-style lead tracking
alter table public.crm_contacts
  add column if not exists lead_status text;
