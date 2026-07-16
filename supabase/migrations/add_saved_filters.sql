-- Roadmap B3 — smart lists: saved, named filter criteria per CRM list
-- (contacts/companies/deals). "Auto-update" isn't a stored computation —
-- applying a saved filter just re-runs the same client-side filter the
-- list page already does against whatever data it just fetched, so the
-- result is always current for free.
--
-- Self-contained: (re)defines is_staff() idempotently rather than assuming
-- tighten_authenticated_rls.sql already ran — that migration is where
-- is_staff() was first defined, but "function public.is_staff() does not
-- exist" when applying this file means it (and its AUDIT #47 OAuth-token
-- RLS fixes) was never actually applied to this database. Run
-- tighten_authenticated_rls.sql and tighten_authenticated_rls_part2.sql
-- too, not just this file — this redefinition only unblocks this table.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm where tm.id = auth.uid()::text
  );
$$;

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
