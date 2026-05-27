create table if not exists public.portal_magic_tokens (
  id text primary key,
  email text not null,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_portal_magic_tokens_token on public.portal_magic_tokens(token);
create index if not exists idx_portal_magic_tokens_email on public.portal_magic_tokens(email);
alter table public.portal_magic_tokens enable row level security;
do $$ begin
  create policy "auth_all_portal_magic_tokens" on public.portal_magic_tokens for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;
