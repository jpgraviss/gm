ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS service_types text[] NOT NULL DEFAULT '{}';
-- Backfill from existing single service_type
UPDATE public.deals SET service_types = ARRAY[service_type] WHERE service_types = '{}' AND service_type IS NOT NULL AND service_type != '';
