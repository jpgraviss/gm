-- ─── Personal BCC-to-log email address per team member ──────────────────────
-- HubSpot-style: each staff member gets a unique address they can BCC on any
-- client email, which gets parsed by the inbound webhook and logged as a CRM
-- activity against the matching contact/company.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS bcc_email text UNIQUE;

-- Dedup table so a Resend webhook retry doesn't log the same email twice
-- (mirrors the processed_emails pattern used for email-to-ticket conversion).
CREATE TABLE IF NOT EXISTS public.bcc_processed_emails (
  id            text PRIMARY KEY,
  message_id    text UNIQUE NOT NULL,
  activity_id   text,
  processed_at  timestamptz DEFAULT now()
);
ALTER TABLE public.bcc_processed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON public.bcc_processed_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert" ON public.bcc_processed_emails FOR INSERT TO authenticated WITH CHECK (true);
