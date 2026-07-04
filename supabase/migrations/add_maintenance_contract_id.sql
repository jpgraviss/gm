ALTER TABLE public.maintenance_records
  ADD COLUMN IF NOT EXISTS contract_id text REFERENCES public.contracts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_contract_id ON public.maintenance_records(contract_id);
