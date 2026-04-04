-- ─── Structured change fields on contract_addendums ────────────────────────
-- Adds typed fields so addendums carry the concrete changes being made,
-- not just a free-form description.
alter table public.contract_addendums
  add column if not exists change_type       text,
  add column if not exists value_delta       numeric(12, 2),
  add column if not exists term_delta_months integer,
  add column if not exists scope_added       text,
  add column if not exists scope_removed     text,
  add column if not exists effective_date    date;
