alter table public.portal_clients
  add column if not exists verification_code text,
  add column if not exists verification_expires timestamptz,
  add column if not exists setup_completed boolean default false,
  add column if not exists pending_approval boolean default false,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz;
