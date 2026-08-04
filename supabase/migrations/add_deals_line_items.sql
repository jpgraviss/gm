ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]';
