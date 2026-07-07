-- WordPress site health data reported by the GravHub SEO plugin
CREATE TABLE IF NOT EXISTS wordpress_site_health (
  id text PRIMARY KEY,
  company_name text NOT NULL,
  site_url text NOT NULL UNIQUE,
  wp_version text,
  php_version text,
  plugins jsonb DEFAULT '[]',
  themes jsonb DEFAULT '[]',
  security jsonb DEFAULT '{}',
  last_reported_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wordpress_site_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_wordpress_site_health"  ON wordpress_site_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_wordpress_site_health" ON wordpress_site_health FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_write_wordpress_site_health" ON wordpress_site_health FOR ALL    TO anon USING (true) WITH CHECK (true);

-- Managed SEO settings pushed from GravHub to WordPress
CREATE TABLE IF NOT EXISTS wordpress_seo_settings (
  id text PRIMARY KEY,
  site_url text NOT NULL,
  page_path text NOT NULL,
  meta_title text,
  meta_description text,
  og_title text,
  og_description text,
  og_image text,
  schema_markup jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(site_url, page_path)
);

ALTER TABLE wordpress_seo_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_wordpress_seo_settings"  ON wordpress_seo_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_wordpress_seo_settings" ON wordpress_seo_settings FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_write_wordpress_seo_settings" ON wordpress_seo_settings FOR ALL    TO anon USING (true) WITH CHECK (true);

-- On-page SEO scores reported by the plugin
CREATE TABLE IF NOT EXISTS wordpress_seo_scores (
  id text PRIMARY KEY,
  site_url text NOT NULL,
  page_path text NOT NULL,
  page_title text,
  score integer,
  issues jsonb DEFAULT '[]',
  checked_at timestamptz DEFAULT now(),
  UNIQUE(site_url, page_path)
);

ALTER TABLE wordpress_seo_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_wordpress_seo_scores"  ON wordpress_seo_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_wordpress_seo_scores" ON wordpress_seo_scores FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_write_wordpress_seo_scores" ON wordpress_seo_scores FOR ALL    TO anon USING (true) WITH CHECK (true);

-- Add wordpress JSONB column to app_settings for API key storage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'wordpress'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN wordpress jsonb NOT NULL DEFAULT '{}';
  END IF;
END $$;
