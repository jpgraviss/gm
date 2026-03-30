-- ─── Storage Bucket for Client Files ────────────────────────────────────────
-- Creates the client-files storage bucket used by the client portal.
-- Run in Supabase SQL Editor.
insert into storage.buckets (id, name, public)
values ('client-files', 'client-files', false)
on conflict (id) do nothing;

-- Allow authenticated users to upload/read/delete client files
create policy "auth_upload_client_files" on storage.objects
  for insert to authenticated with check (bucket_id = 'client-files');

create policy "auth_read_client_files" on storage.objects
  for select to authenticated using (bucket_id = 'client-files');

create policy "auth_delete_client_files" on storage.objects
  for delete to authenticated using (bucket_id = 'client-files');

-- ─── Time Entries: Add invoiced tracking fields ─────────────────────────────
alter table public.time_entries add column if not exists invoiced boolean not null default false;
alter table public.time_entries add column if not exists invoice_id text references public.invoices(id) on delete set null;
alter table public.time_entries add column if not exists approved boolean not null default false;
alter table public.time_entries add column if not exists approved_by text;
alter table public.time_entries add column if not exists approved_at timestamptz;

-- Index for quick lookup of uninvoiced billable time
create index if not exists idx_time_entries_billable_uninvoiced
  on public.time_entries (billable, invoiced) where billable = true and invoiced = false;
