-- ─── Link WordPress-connected sites and tracked keywords to CRM companies ───
-- wordpress_site_health had no company linkage at all (only a free-text
-- company_name self-reported by the plugin). tracked_keywords already had a
-- company_id column but it was never FK-constrained or backfilled, unlike
-- every other entity table (see add_company_id_fks.sql).

ALTER TABLE public.wordpress_site_health
  ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.crm_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wordpress_site_health_company_id
  ON public.wordpress_site_health(company_id);

-- Backfill by matching the self-reported company_name to crm_companies.name
UPDATE public.wordpress_site_health wsh
SET company_id = c.id
FROM public.crm_companies c
WHERE wsh.company_id IS NULL
  AND lower(trim(wsh.company_name)) = lower(trim(c.name));

-- tracked_keywords.company_id already exists (add_rank_tracker_v2.sql) but
-- has no FK constraint and was never backfilled from company_name.
ALTER TABLE public.tracked_keywords
  ADD CONSTRAINT tracked_keywords_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.crm_companies(id) ON DELETE SET NULL
  NOT VALID;

-- NOT VALID lets the constraint apply going forward without failing on any
-- existing rows that don't match a company — validate separately once data
-- is cleaned up, if desired:
-- ALTER TABLE public.tracked_keywords VALIDATE CONSTRAINT tracked_keywords_company_id_fkey;

UPDATE public.tracked_keywords tk
SET company_id = c.id
FROM public.crm_companies c
WHERE tk.company_id IS NULL
  AND lower(trim(tk.company_name)) = lower(trim(c.name));
