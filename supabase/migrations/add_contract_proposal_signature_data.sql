-- AUDIT.md #155 — app/portal/approvals/page.tsx's Accept flow renders a
-- full e-signature capture UI (typed cursive name OR a drawn HTML canvas
-- signature, with "E-Signature Required... By signing, you agree to the
-- terms" copy) but handleAccept() discarded the captured signature
-- entirely — it only ever PATCHed {status, clientSigned/respondedDate} (a
-- bare date string). Neither contracts nor proposals had a column to store
-- a signature, so the capture UI was pure theater: clients believed they
-- were signing something, and nothing was kept.
--
-- This is a separate, non-functional parallel to the app's REAL
-- e-signature system (signature_requests.signature_data, used by the
-- public /proposal/[token] and /sign/[token] flows — see
-- add_signature_requests.sql and app/api/signatures/[token]/route.ts). The
-- columns below mirror that table's naming/shape rather than inventing a
-- new one: signature_data (text) holds the same payload shape
-- signature_requests.signature_data does — a canvas.toDataURL() PNG data
-- URI when drawn. Unlike the /sign/[token] flow, this portal path also
-- offers a typed-cursive-name mode with no drawn image at all, so
-- signature_data holds the typed name string in that case instead; the new
-- signature_type column ('typed' | 'drawn') records which, so a value in
-- signature_data can always be rendered/audited correctly rather than
-- guessed at.
--
-- NOTE: this migration has NOT been run against the live database — apply
-- manually (see AUDIT.md #380 for the same no-live-DB-access convention
-- this session follows).

alter table public.contracts
  add column if not exists signature_data text,
  add column if not exists signature_type text;

alter table public.contracts
  drop constraint if exists contracts_signature_type_check;
alter table public.contracts
  add constraint contracts_signature_type_check
  check (signature_type is null or signature_type in ('typed', 'drawn'));

alter table public.proposals
  add column if not exists signature_data text,
  add column if not exists signature_type text;

alter table public.proposals
  drop constraint if exists proposals_signature_type_check;
alter table public.proposals
  add constraint proposals_signature_type_check
  check (signature_type is null or signature_type in ('typed', 'drawn'));
