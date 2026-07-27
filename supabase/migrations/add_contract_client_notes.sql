-- AUDIT.md #470 — app/client/approvals/page.tsx's handleRequestChanges()
-- lets a portal client type free-text feedback ("Describe what you would
-- like changed...") before submitting Request Changes on a pending
-- contract. The proposals table already has renewal_notes to receive the
-- equivalent proposal feedback (see app/api/proposals/[id]/route.ts), but
-- contracts had no free-text column at all — client_signed/internal_signed
-- are date strings, terminated_reason is termination-specific and would
-- collide with a later real termination. Without this column the feedback
-- the client typed had nowhere to go.
--
-- NOTE: this migration has NOT been run against the live database — apply
-- manually (see AUDIT.md #380 for the same no-live-DB-access convention
-- this session follows).

alter table public.contracts
  add column if not exists client_notes text;
