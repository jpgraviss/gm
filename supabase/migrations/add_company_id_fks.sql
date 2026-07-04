-- ─── Add company_id FK columns to all entity tables ─────────────────────────
-- Backfills by matching existing company TEXT name to crm_companies.name

-- Deals: add company_id, contact_id, pipeline_id
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS company_id  text REFERENCES public.crm_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id  text REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_id text;

-- Proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.crm_companies(id) ON DELETE SET NULL;

-- Contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.crm_companies(id) ON DELETE SET NULL;

-- Invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.crm_companies(id) ON DELETE SET NULL;

-- Projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.crm_companies(id) ON DELETE SET NULL;

-- Maintenance Records
ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.crm_companies(id) ON DELETE SET NULL;

-- Renewals
ALTER TABLE public.renewals
  ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.crm_companies(id) ON DELETE SET NULL;

-- App Tasks
ALTER TABLE public.app_tasks
  ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.crm_companies(id) ON DELETE SET NULL;

-- Tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.crm_companies(id) ON DELETE SET NULL;

-- Portal Clients (column may exist from earlier migration, add FK if missing)
ALTER TABLE public.portal_clients
  ADD COLUMN IF NOT EXISTS company_id text REFERENCES public.crm_companies(id) ON DELETE SET NULL;

-- ─── Add FK constraint to crm_activities.company_id (column exists, no FK) ──
-- Safe: only adds constraint if column exists and has no FK yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'crm_activities' AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.column_name = 'company_id'
  ) THEN
    ALTER TABLE public.crm_activities
      ADD CONSTRAINT crm_activities_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.crm_companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_deals_company_id       ON public.deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id       ON public.deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_id      ON public.deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_proposals_company_id   ON public.proposals(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company_id   ON public.contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id    ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id    ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_company_id ON public.maintenance_records(company_id);
CREATE INDEX IF NOT EXISTS idx_renewals_company_id    ON public.renewals(company_id);
CREATE INDEX IF NOT EXISTS idx_app_tasks_company_id   ON public.app_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tickets_company_id     ON public.tickets(company_id);

-- ─── Backfill company_id from company name ───────────────────────────────────
UPDATE public.deals d
  SET company_id = c.id
  FROM public.crm_companies c
  WHERE d.company_id IS NULL AND d.company = c.name;

UPDATE public.proposals p
  SET company_id = c.id
  FROM public.crm_companies c
  WHERE p.company_id IS NULL AND p.company = c.name;

UPDATE public.contracts ct
  SET company_id = c.id
  FROM public.crm_companies c
  WHERE ct.company_id IS NULL AND ct.company = c.name;

UPDATE public.invoices i
  SET company_id = c.id
  FROM public.crm_companies c
  WHERE i.company_id IS NULL AND i.company = c.name;

UPDATE public.projects pr
  SET company_id = c.id
  FROM public.crm_companies c
  WHERE pr.company_id IS NULL AND pr.company = c.name;

UPDATE public.maintenance_records mr
  SET company_id = c.id
  FROM public.crm_companies c
  WHERE mr.company_id IS NULL AND mr.company = c.name;

UPDATE public.renewals r
  SET company_id = c.id
  FROM public.crm_companies c
  WHERE r.company_id IS NULL AND r.company = c.name;

UPDATE public.app_tasks t
  SET company_id = c.id
  FROM public.crm_companies c
  WHERE t.company_id IS NULL AND t.company = c.name;

UPDATE public.tickets tk
  SET company_id = c.id
  FROM public.crm_companies c
  WHERE tk.company_id IS NULL AND tk.company = c.name;

UPDATE public.portal_clients pc
  SET company_id = c.id
  FROM public.crm_companies c
  WHERE pc.company_id IS NULL AND pc.company = c.name;
