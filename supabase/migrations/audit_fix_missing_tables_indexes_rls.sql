-- ============================================================================
-- Audit fix: missing tables, indexes, and RLS hardening
-- Generated from schema-vs-API audit on 2026-07-04
-- ============================================================================

-- ─── 1. Missing tables ─────────────────────────────────────────────────────

-- portal_magic_tokens: used by portal invite/magic-link flows
CREATE TABLE IF NOT EXISTS public.portal_magic_tokens (
  id               text PRIMARY KEY,
  token            text NOT NULL UNIQUE,
  email            text NOT NULL,
  portal_client_id text REFERENCES public.portal_clients(id) ON DELETE CASCADE,
  expires_at       timestamptz NOT NULL,
  used             boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_magic_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_portal_magic_tokens"
  ON public.portal_magic_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_portal_magic_tokens_token ON public.portal_magic_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_magic_tokens_email ON public.portal_magic_tokens(email);

-- contact_timeline: used by AI scoring route
CREATE TABLE IF NOT EXISTS public.contact_timeline (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  contact_id text NOT NULL,
  type       text NOT NULL,
  title      text,
  body       text,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_contact_timeline"
  ON public.contact_timeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_contact_timeline"
  ON public.contact_timeline FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_contact_timeline_contact_id ON public.contact_timeline(contact_id);

-- company_files: metadata for uploaded company documents
CREATE TABLE IF NOT EXISTS public.company_files (
  id           text PRIMARY KEY,
  company_id   text NOT NULL REFERENCES public.crm_companies(id) ON DELETE CASCADE,
  name         text NOT NULL,
  storage_path text NOT NULL,
  url          text,
  content_type text,
  size_bytes   integer,
  category     text DEFAULT 'General',
  notes        text,
  file_ext     text,
  uploaded_by  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_company_files"
  ON public.company_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_company_files"
  ON public.company_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_delete_company_files"
  ON public.company_files FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_company_files_company_id ON public.company_files(company_id);

-- ─── 2. Fix overly permissive RLS on funnels ───────────────────────────────

-- Drop the wide-open policies that default to PUBLIC (anonymous access)
DROP POLICY IF EXISTS "funnels_all" ON public.funnels;
DROP POLICY IF EXISTS "funnel_pages_all" ON public.funnel_pages;

-- Replace with authenticated-only policies
CREATE POLICY "auth_all_funnels"
  ON public.funnels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_funnel_pages"
  ON public.funnel_pages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anon SELECT only (for public-facing published funnels)
CREATE POLICY "anon_read_funnels"
  ON public.funnels FOR SELECT TO anon USING (status = 'Published');
CREATE POLICY "anon_read_funnel_pages"
  ON public.funnel_pages FOR SELECT TO anon USING (true);

-- ─── 3. Enable RLS on tables that are missing it ───────────────────────────

ALTER TABLE IF EXISTS public.calendar_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_calendar_subscriptions"
  ON public.calendar_subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.chatbots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_chatbots"
  ON public.chatbots FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_chatbot_conversations"
  ON public.chatbot_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.scheduled_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_scheduled_emails"
  ON public.scheduled_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.gi_visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_gi_visitors"
  ON public.gi_visitors FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.gi_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_gi_events"
  ON public.gi_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 4. Missing indexes for high-traffic queries ───────────────────────────

-- Bookings (public-facing, every slot check)
CREATE INDEX IF NOT EXISTS idx_bookings_calendar_slug ON public.bookings(calendar_slug);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- Portal clients (login / magic link flows)
CREATE INDEX IF NOT EXISTS idx_portal_clients_email ON public.portal_clients(email);
CREATE INDEX IF NOT EXISTS idx_portal_clients_company ON public.portal_clients(company);

-- Portal dashboard lookups by company name
CREATE INDEX IF NOT EXISTS idx_contracts_company ON public.contracts(company);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON public.invoices(company);
CREATE INDEX IF NOT EXISTS idx_projects_company ON public.projects(company);

-- Calendar settings (slug lookup for public booking pages)
CREATE INDEX IF NOT EXISTS idx_calendar_settings_user_email ON public.calendar_settings(user_email);

-- Sequence processing (cron job under load)
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_contact_email ON public.sequence_enrollments(contact_email);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status_next_send
  ON public.sequence_enrollments(status, next_send_at)
  WHERE status = 'active';

-- Deals by pipeline
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_id ON public.deals(pipeline_id);

-- Contracts by renewal date (cron renewal checks)
CREATE INDEX IF NOT EXISTS idx_contracts_renewal_date ON public.contracts(renewal_date);

-- Team members by status (active member queries)
CREATE INDEX IF NOT EXISTS idx_team_members_status ON public.team_members(status);
