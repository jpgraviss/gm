ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS service_types text[] NOT NULL DEFAULT '{}';
UPDATE public.projects SET service_types = ARRAY[service_type] WHERE service_types = '{}' AND service_type IS NOT NULL AND service_type != '';
