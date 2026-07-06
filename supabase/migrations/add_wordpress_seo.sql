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
