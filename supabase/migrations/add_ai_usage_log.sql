-- ─── AI Usage Log ────────────────────────────────────────────────────────
-- Tracks every chatCompletion() call (lib/ai-client.ts) so Settings > AI
-- Usage can show real call volume, provider split (Ollama vs Groq vs no
-- provider configured), and per-feature breakdown — since neither Ollama
-- nor Groq expose a usage-query API this app can call directly, this is
-- the only reliable way to see actual usage/quota proximity.
create table if not exists public.ai_usage_log (
  id text primary key,
  source text not null,               -- 'ollama' | 'groq' | 'none'
  feature text not null,              -- short label identifying the call site
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  duration_ms integer,
  success boolean not null default true,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_log_created_at on public.ai_usage_log (created_at desc);
create index if not exists idx_ai_usage_log_source on public.ai_usage_log (source);
create index if not exists idx_ai_usage_log_feature on public.ai_usage_log (feature);

alter table public.ai_usage_log enable row level security;

-- Read-only for staff; writes happen server-side only via the service role
-- (chatCompletion()'s own fire-and-forget log insert), so no insert policy
-- is needed for the authenticated role.
create policy "auth_read_ai_usage_log" on public.ai_usage_log for select to authenticated using (true);
