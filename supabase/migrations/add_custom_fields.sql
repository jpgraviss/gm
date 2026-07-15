-- Roadmap B2 — custom fields on contacts, companies, deals. Staff define a
-- field once (custom_field_definitions) and every record of that entity
-- type gets a slot for it in its own `custom_fields` jsonb bag. Values are
-- stored as plain strings regardless of field_type (select/date/number
-- included) — the field_type only drives which input control the UI shows
-- and how the value is parsed for display; keeping storage untyped avoids
-- a second migration every time a new field_type is added.
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

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id text PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('contacts', 'companies', 'deals')),
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_date timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, field_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_entity_type ON public.custom_field_definitions(entity_type);

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_custom_field_definitions" ON public.custom_field_definitions FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.crm_companies ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
