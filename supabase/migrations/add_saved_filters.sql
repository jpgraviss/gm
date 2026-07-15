-- Roadmap B3 — smart lists: saved, named filter criteria per CRM list
-- (contacts/companies/deals). "Auto-update" isn't a stored computation —
-- applying a saved filter just re-runs the same client-side filter the
-- list page already does against whatever data it just fetched, so the
-- result is always current for free.
CREATE TABLE IF NOT EXISTS public.saved_filters (
  id text PRIMARY KEY,
  name text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('contacts', 'companies', 'deals')),
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_date timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_entity_type ON public.saved_filters(entity_type);

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_saved_filters" ON public.saved_filters FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
