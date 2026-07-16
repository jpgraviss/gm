-- Growth report automation — staff-editable "what we did this month" /
-- "next month priorities" content per client per reporting period.
--
-- Deliverable counts like "25 backlinks built" or "8 GBP posts published"
-- shown in the example report aren't tracked anywhere in GravHub today (no
-- backlink log, no GBP post counter, no content-piece tracker) — fabricating
-- those numbers would be exactly the kind of fake-looking-real data this
-- codebase's audit process exists to catch. This table lets staff enter the
-- real work done as short bullets instead, which the generated report then
-- assembles alongside the parts that ARE real automated data (GSC/GA4/rank
-- tracker numbers, narrative built from those numbers).
CREATE TABLE IF NOT EXISTS public.report_work_log (
  id text PRIMARY KEY,
  company_name text NOT NULL,
  company_id text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_month jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_name, period_start)
);

CREATE INDEX IF NOT EXISTS idx_report_work_log_company_period ON public.report_work_log(company_name, period_start);

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

ALTER TABLE public.report_work_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_report_work_log" ON public.report_work_log FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
