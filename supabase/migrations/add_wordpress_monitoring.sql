-- WordPress monitoring support
-- Adds WP credential columns to monitored_sites and a wordpress_checks table

ALTER TABLE public.monitored_sites ADD COLUMN IF NOT EXISTS is_wordpress boolean DEFAULT false;
ALTER TABLE public.monitored_sites ADD COLUMN IF NOT EXISTS wp_username text;
ALTER TABLE public.monitored_sites ADD COLUMN IF NOT EXISTS wp_app_password text;

CREATE TABLE IF NOT EXISTS public.wordpress_checks (
  id                   text PRIMARY KEY,
  site_id              text NOT NULL REFERENCES public.monitored_sites(id) ON DELETE CASCADE,
  is_wordpress         boolean NOT NULL DEFAULT false,
  wp_version           text,
  site_title           text,
  plugins              jsonb DEFAULT '[]'::jsonb,
  themes               jsonb DEFAULT '[]'::jsonb,
  core_update_available boolean DEFAULT false,
  security_headers     jsonb DEFAULT '{}'::jsonb,
  login_page_exposed   boolean DEFAULT false,
  xmlrpc_enabled       boolean DEFAULT false,
  checked_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wordpress_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_wordpress_checks" ON public.wordpress_checks;
CREATE POLICY "auth_all_wordpress_checks"
  ON public.wordpress_checks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wordpress_checks_site_id ON public.wordpress_checks(site_id);
CREATE INDEX IF NOT EXISTS idx_wordpress_checks_checked_at ON public.wordpress_checks(checked_at);
