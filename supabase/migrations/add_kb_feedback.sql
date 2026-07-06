-- Knowledge Base feedback counters
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS helpful_count integer DEFAULT 0;
ALTER TABLE public.knowledge_articles ADD COLUMN IF NOT EXISTS not_helpful_count integer DEFAULT 0;
