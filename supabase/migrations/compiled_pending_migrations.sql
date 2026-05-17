-- ============================================================================
-- COMPILED PENDING MIGRATIONS
-- Generated: 2026-05-17
-- ============================================================================
-- Sources:
--   1. add_portal_config.sql
--   2. add_portal_verification.sql
--   3. add_verification_codes.sql
--   4. add_rank_tracker_v2.sql
--   5. add_delivery_system.sql
--   6. Additional app_settings columns
-- ============================================================================


-- ============================================================================
-- 1. PORTAL CONFIG (add_portal_config.sql)
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE public.portal_clients ADD COLUMN portal_config jsonb DEFAULT '{}'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.portal_clients ADD COLUMN services text[] DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.portal_clients ADD COLUMN company_id text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_portal_clients_company_id ON public.portal_clients (company_id);


-- ============================================================================
-- 2. PORTAL VERIFICATION (add_portal_verification.sql)
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE public.portal_clients ADD COLUMN verification_code text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.portal_clients ADD COLUMN verification_expires timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.portal_clients ADD COLUMN setup_completed boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.portal_clients ADD COLUMN pending_approval boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.portal_clients ADD COLUMN approved_by text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.portal_clients ADD COLUMN approved_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;


-- ============================================================================
-- 3. VERIFICATION CODES (add_verification_codes.sql)
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE team_members ADD COLUMN verification_code text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE team_members ADD COLUMN verification_expires timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE team_members ADD COLUMN setup_completed boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE team_members ADD COLUMN pending_approval boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;


-- ============================================================================
-- 4. RANK TRACKER V2 (add_rank_tracker_v2.sql)
-- ============================================================================

-- Add new columns to tracked_keywords
DO $$ BEGIN
  ALTER TABLE public.tracked_keywords ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracked_keywords ADD COLUMN target_url text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracked_keywords ADD COLUMN search_engine text NOT NULL DEFAULT 'google';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracked_keywords ADD COLUMN location text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tracked_keywords ADD COLUMN search_volume integer;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tracked_keywords_tags ON public.tracked_keywords USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_tracked_keywords_company_id ON public.tracked_keywords(company_id);

-- Competitor domains per workspace
CREATE TABLE IF NOT EXISTS public.rank_tracker_competitors (
  id            text PRIMARY KEY,
  workspace_id  uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  domain        text NOT NULL,
  label         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, domain)
);

ALTER TABLE public.rank_tracker_competitors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_read_rt_competitors" ON public.rank_tracker_competitors FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_write_rt_competitors" ON public.rank_tracker_competitors FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Competitor rank snapshots
CREATE TABLE IF NOT EXISTS public.competitor_rank_snapshots (
  id                 text PRIMARY KEY,
  workspace_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  competitor_id      text NOT NULL REFERENCES public.rank_tracker_competitors(id) ON DELETE CASCADE,
  tracked_keyword_id text NOT NULL REFERENCES public.tracked_keywords(id) ON DELETE CASCADE,
  position           numeric,
  url                text,
  checked_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_kw ON public.competitor_rank_snapshots(tracked_keyword_id, checked_at DESC);

ALTER TABLE public.competitor_rank_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_read_competitor_snaps" ON public.competitor_rank_snapshots FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_write_competitor_snaps" ON public.competitor_rank_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Scheduled rank reports
CREATE TABLE IF NOT EXISTS public.rank_tracker_reports (
  id            text PRIMARY KEY,
  workspace_id  uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name          text NOT NULL,
  frequency     text NOT NULL DEFAULT 'weekly',
  recipients    text[] NOT NULL DEFAULT '{}',
  filters       jsonb NOT NULL DEFAULT '{}',
  last_sent_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rank_tracker_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_read_rt_reports" ON public.rank_tracker_reports FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_write_rt_reports" ON public.rank_tracker_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 5. DELIVERY SYSTEM (add_delivery_system.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.delivery_workflows (
  id                text PRIMARY KEY,
  company_id        text,
  project_id        text,
  company_name      text NOT NULL,
  project_name      text,
  service_type      text NOT NULL DEFAULT 'Website',
  step_01_agreement       text NOT NULL DEFAULT 'Pending',
  step_01_contract_id     text,
  step_01_completed_at    timestamptz,
  step_02_invoice         text NOT NULL DEFAULT 'Pending',
  step_02_invoice_id      text,
  step_02_completed_at    timestamptz,
  step_03_welcome         text NOT NULL DEFAULT 'Pending',
  step_03_email_sent_at   timestamptz,
  step_03_opened_at       timestamptz,
  step_04_portal          text NOT NULL DEFAULT 'Pending',
  step_04_first_login     timestamptz,
  step_05_strategy_call   text NOT NULL DEFAULT 'Pending',
  step_05_booking_id      text,
  step_05_completed_at    timestamptz,
  step_05_notes           text,
  step_06_usage_guide     text NOT NULL DEFAULT 'Pending',
  step_06_email_sent_at   timestamptz,
  step_06_opened_at       timestamptz,
  step_07_fulfillment     text NOT NULL DEFAULT 'Pending',
  step_07_deliverables    jsonb NOT NULL DEFAULT '[]',
  step_07_completed_at    timestamptz,
  step_08_monthly_report  text NOT NULL DEFAULT 'Pending',
  step_08_last_sent_at    timestamptz,
  step_08_send_day        integer DEFAULT 5,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_workflows_company ON public.delivery_workflows(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_workflows_project ON public.delivery_workflows(project_id);

CREATE TABLE IF NOT EXISTS public.delivery_templates (
  id              text PRIMARY KEY,
  step            integer NOT NULL,
  template_type   text NOT NULL,
  name            text NOT NULL,
  file_path       text NOT NULL,
  file_size       integer,
  version         text DEFAULT 'v1',
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_events (
  id              text PRIMARY KEY,
  workflow_id     text REFERENCES public.delivery_workflows(id) ON DELETE CASCADE,
  company_id      text,
  step            integer,
  event_type      text NOT NULL,
  description     text,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_workflow ON public.delivery_events(workflow_id);
CREATE INDEX IF NOT EXISTS idx_delivery_events_company ON public.delivery_events(company_id);

ALTER TABLE public.delivery_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all_delivery_workflows" ON public.delivery_workflows FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_all_delivery_templates" ON public.delivery_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_all_delivery_events" ON public.delivery_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 6. MISSING APP_SETTINGS COLUMNS
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE public.app_settings ADD COLUMN hubspot jsonb NOT NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings ADD COLUMN resend jsonb NOT NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings ADD COLUMN google_reviews jsonb NOT NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings ADD COLUMN email_templates jsonb NOT NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.app_settings ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
