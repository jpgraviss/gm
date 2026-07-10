-- ─── Add a persistent notes field to crm_companies ──────────────────────────
-- crm_contacts already has a scalar `notes text` column; crm_companies had
-- none at all. The company detail panel's Activity tab already logs
-- chronological notes via crm_activities (type='note'), but there was no
-- persistent scratchpad — this mirrors the contacts pattern.

ALTER TABLE public.crm_companies
  ADD COLUMN IF NOT EXISTS notes text;
