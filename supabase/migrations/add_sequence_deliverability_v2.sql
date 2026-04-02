-- Migration: add_sequence_deliverability_v2
-- Fixes missing columns and constraints from initial deliverability migration

-- 1. Add missing columns to sequence_enrollments
alter table public.sequence_enrollments
  add column if not exists delivery_status text default 'pending',
  add column if not exists last_message_id text;

-- 2. Add missing variant column to sequence_activities for A/B testing
alter table public.sequence_activities
  add column if not exists variant text; -- 'A' or 'B' for A/B test tracking

-- 3. Fix suppression list: ensure the table uses correct column names
-- The original migration used 'source' for the sequence reference column
-- but some code paths used 'sequence_id'. Standardize on 'source'.
-- Also ensure the unique constraint is on email only (global suppression).
do $$
begin
  -- Drop the incorrect composite unique index if it exists
  if exists (
    select 1 from pg_indexes where indexname = 'sequence_suppression_list_email_sequence_id_key'
  ) then
    drop index public.sequence_suppression_list_email_sequence_id_key;
  end if;
end$$;

-- Ensure email unique constraint exists
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sequence_suppression_list_email_key' and conrelid = 'public.sequence_suppression_list'::regclass
  ) then
    alter table public.sequence_suppression_list add constraint sequence_suppression_list_email_key unique (email);
  end if;
exception when others then
  -- Constraint may already exist under a different name
  null;
end$$;

-- 4. Add index on sequence_activities for variant-based queries
create index if not exists idx_seq_activities_variant
  on public.sequence_activities (sequence_id, variant)
  where variant is not null;

-- 5. Add index for enrollment delivery status lookups
create index if not exists idx_seq_enrollments_delivery_status
  on public.sequence_enrollments (sequence_id, delivery_status);

-- 6. Add enrolled_at default for sequence_enrollments if missing
alter table public.sequence_enrollments
  alter column enrolled_at set default now();

-- 7. Service role policies for new operations (webhook/cron writes)
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'service_write_seq_activities' and tablename = 'sequence_activities'
  ) then
    create policy "service_write_seq_activities" on public.sequence_activities
      for all to service_role using (true) with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'service_write_suppression' and tablename = 'sequence_suppression_list'
  ) then
    create policy "service_write_suppression" on public.sequence_suppression_list
      for all to service_role using (true) with check (true);
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'service_write_enrollments' and tablename = 'sequence_enrollments'
  ) then
    create policy "service_write_enrollments" on public.sequence_enrollments
      for all to service_role using (true) with check (true);
  end if;
end$$;
