-- ─── Internal knowledge base / help center ──────────────────────────────────

create table if not exists public.knowledge_articles (
  id            text primary key,
  workspace_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  title         text not null,
  body          text not null default '',
  category      text not null default 'Getting Started',
  tags          text[] not null default '{}',
  author        text,
  status        text not null default 'draft',
  views         integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_knowledge_articles_category on public.knowledge_articles(category);
create index if not exists idx_knowledge_articles_status on public.knowledge_articles(status);
create index if not exists idx_knowledge_articles_workspace on public.knowledge_articles(workspace_id);
create index if not exists idx_knowledge_articles_created on public.knowledge_articles(created_at desc);

alter table public.knowledge_articles enable row level security;
create policy "auth_read_knowledge_articles"  on public.knowledge_articles for select to authenticated using (true);
create policy "auth_write_knowledge_articles" on public.knowledge_articles for all to authenticated using (true) with check (true);
