-- ─── AI Proposal Generator ──────────────────────────────────────────────────
-- Adds storage for the rendered PDF and the AI drafting metadata behind the
-- new "Generate Proposal" pipeline (form intake -> AI draft -> branded PDF),
-- which replaces the old client-side jsPDF ProposalBuilderPanel.
alter table public.proposals add column if not exists pdf_path text;
alter table public.proposals add column if not exists form_submission_id text references public.form_submissions(id) on delete set null;
alter table public.proposals add column if not exists generation_notes text;

-- ─── Storage Bucket for Generated Proposal PDFs ─────────────────────────────
-- Run in Supabase SQL Editor. Mirrors the client-files bucket pattern in
-- add_storage_and_time_entry_fields.sql.
insert into storage.buckets (id, name, public)
values ('proposal-pdfs', 'proposal-pdfs', false)
on conflict (id) do nothing;

create policy "auth_upload_proposal_pdfs" on storage.objects
  for insert to authenticated with check (bucket_id = 'proposal-pdfs');

create policy "auth_read_proposal_pdfs" on storage.objects
  for select to authenticated using (bucket_id = 'proposal-pdfs');

create policy "auth_delete_proposal_pdfs" on storage.objects
  for delete to authenticated using (bucket_id = 'proposal-pdfs');
