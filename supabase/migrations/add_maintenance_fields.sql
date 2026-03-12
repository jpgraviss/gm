-- Add new fields to maintenance_records table
alter table public.maintenance_records add column if not exists end_date text;
alter table public.maintenance_records add column if not exists cancellation_fee numeric;
alter table public.maintenance_records add column if not exists payment_terms text;
