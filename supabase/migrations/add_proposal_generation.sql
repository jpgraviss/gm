-- ─── AI Proposal Generator ──────────────────────────────────────────────────
-- Adds storage for the rendered PDF and the AI drafting metadata behind the
-- new "Generate Proposal" pipeline (form intake -> AI draft -> branded PDF),
-- which replaces the old client-side jsPDF ProposalBuilderPanel.
alter table public.proposals add column if not exists pdf_path text;
alter table public.proposals add column if not exists form_submission_id text references public.form_submissions(id) on delete set null;
alter table public.proposals add column if not exists generation_notes text;

-- ─── Storage Bucket for Generated Proposal PDFs ─────────────────────────────
-- Run in Supabase SQL Editor.
--
-- AUDIT — this originally mirrored the client-files bucket pattern in
-- add_storage_and_time_entry_fields.sql (a broad `authenticated`-role
-- select/insert/delete policy with no per-company scoping), but that
-- pattern is wrong for a bucket holding another company's pricing/scope
-- data: portal clients hold real Supabase Auth JWTs, so a broad
-- authenticated policy lets Company A's portal client read Company B's
-- proposal PDF directly via the Storage REST API, bypassing the app's own
-- requirePortalClient() scoping entirely. No `authenticated`-role policy
-- is created here at all — every legitimate access already goes through
-- server-side code using the service role (which bypasses RLS), so
-- nothing needs one. See fix_proposal_pdfs_storage_rls.sql for the
-- corresponding cleanup on an environment that already applied the old
-- version of this file.
insert into storage.buckets (id, name, public)
values ('proposal-pdfs', 'proposal-pdfs', false)
on conflict (id) do nothing;
