-- Add portal_visible column to tracked_keywords (code already references it)
ALTER TABLE tracked_keywords ADD COLUMN IF NOT EXISTS portal_visible boolean DEFAULT true;

-- Add SEO report columns to client_integrations
ALTER TABLE client_integrations ADD COLUMN IF NOT EXISTS seo_reports_enabled boolean DEFAULT false;
ALTER TABLE client_integrations ADD COLUMN IF NOT EXISTS seo_report_recipients text[] DEFAULT NULL;
ALTER TABLE client_integrations ADD COLUMN IF NOT EXISTS last_seo_report_at timestamptz DEFAULT NULL;
