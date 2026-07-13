-- The GravHub SEO plugin's analyzer (class-seo-analyzer.php) computes and
-- sends word_count, readability_score, and focus_keyword per page, but
-- wordpress_seo_scores had no columns for them — the API route silently
-- discarded all three on every sync. Adding real columns so this data
-- (already being sent, at zero extra cost) actually gets stored and shown.
alter table public.wordpress_seo_scores
  add column if not exists word_count integer,
  add column if not exists readability_score numeric,
  add column if not exists focus_keyword text;
