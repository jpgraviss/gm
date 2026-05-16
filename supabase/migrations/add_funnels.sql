-- Funnels & funnel pages
create table if not exists funnels (
  id            text primary key,
  workspace_id  text,
  name          text not null,
  slug          text not null unique,
  status        text not null default 'Draft' check (status in ('Draft', 'Published')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_funnels_workspace on funnels (workspace_id);
create index if not exists idx_funnels_slug on funnels (slug);

create table if not exists funnel_pages (
  id            text primary key,
  funnel_id     text not null references funnels (id) on delete cascade,
  name          text not null,
  slug          text not null,
  blocks        jsonb not null default '[]'::jsonb,
  sort_order    integer not null default 0,
  views         integer not null default 0,
  conversions   integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_funnel_pages_funnel on funnel_pages (funnel_id);
create index if not exists idx_funnel_pages_slug on funnel_pages (funnel_id, slug);

-- RLS
alter table funnels enable row level security;
alter table funnel_pages enable row level security;

create policy "funnels_all" on funnels for all using (true) with check (true);
create policy "funnel_pages_all" on funnel_pages for all using (true) with check (true);
