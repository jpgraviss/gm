-- ─── Fix: proposal-pdfs storage bucket had no company scoping ──────────────
-- add_proposal_generation.sql granted the generic `authenticated` role
-- broad select/insert/delete on the ENTIRE proposal-pdfs bucket, with zero
-- per-company scoping -- while the app's own route
-- (app/api/proposals/[id]/pdf/route.ts) carefully gates access via
-- requirePortalClient(req, proposal.company). Portal clients hold real
-- Supabase Auth JWTs (app/login/page.tsx signs them in directly via
-- supabase.auth.signInWithPassword), so a portal client for Company A
-- could call the Supabase Storage REST API directly with their own JWT
-- and read (or delete) Company B's generated proposal PDF -- a straight
-- bypass of the app's own per-company authorization.
--
-- Every legitimate access to this bucket already goes through server-side
-- code using the service role (uploads in app/api/proposals/generate,
-- lib/automations-engine.ts, and app/api/ai/chat/route.ts; downloads via
-- a signed URL minted server-side in app/api/proposals/[id]/pdf/route.ts
-- and app/api/proposals/view/[token]/route.ts) -- the service role
-- bypasses RLS entirely, so no `authenticated`-role policy is actually
-- needed for the app to function. Dropping them closes the direct-API
-- bypass with no loss of legitimate functionality.
drop policy if exists "auth_upload_proposal_pdfs" on storage.objects;
drop policy if exists "auth_read_proposal_pdfs" on storage.objects;
drop policy if exists "auth_delete_proposal_pdfs" on storage.objects;
