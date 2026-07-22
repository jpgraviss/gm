-- AUDIT.md #277 — app/api/crm/import/route.ts has set import_batch_id on every
-- crm_contacts/crm_companies/deals insert since it was introduced (commit
-- 3d02fa4, "Bulk select/delete + duplicate merge"), but no migration ever
-- added the column — every CSV import insert has been failing outright
-- (PGRST204, unknown column) since that commit, and import/undo/route.ts's
-- delete-by-batch also depends on this column existing.
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS import_batch_id text;
ALTER TABLE public.crm_companies ADD COLUMN IF NOT EXISTS import_batch_id text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS import_batch_id text;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_import_batch_id ON public.crm_contacts(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_companies_import_batch_id ON public.crm_companies(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_import_batch_id ON public.deals(import_batch_id) WHERE import_batch_id IS NOT NULL;
