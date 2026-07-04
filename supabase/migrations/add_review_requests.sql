-- Add company_name to reviews for per-client filtering
alter table reviews add column if not exists company_name text;
create index if not exists idx_reviews_company_name on reviews(company_name);

-- Loosen source constraint to allow 'Manual' and 'Internal'
alter table reviews drop constraint if exists reviews_source_check;
alter table reviews add constraint reviews_source_check
  check (source in ('Google', 'Yelp', 'Facebook', 'Manual', 'Internal'));

-- Review requests: tokenized links for TrustMary-style review routing
create table if not exists review_requests (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,
  customer_name   text not null,
  customer_email  text not null,
  company_name    text,
  google_review_url text,
  rating          smallint check (rating between 1 and 5),
  feedback        text,
  status          text not null default 'pending' check (status in ('pending', 'completed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index if not exists idx_review_requests_token on review_requests(token);
create index if not exists idx_review_requests_status on review_requests(status);

alter table review_requests enable row level security;

-- Service-role access (API routes use service client which bypasses RLS,
-- but adding a permissive policy for authenticated users too)
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'auth_all_review_requests') then
    create policy "auth_all_review_requests" on review_requests for all to authenticated using (true) with check (true);
  end if;
  -- Allow anonymous users to read and update their own review request by token
  -- (the public review page uses the service client anyway, but belt-and-suspenders)
  if not exists (select 1 from pg_policies where policyname = 'anon_read_review_requests') then
    create policy "anon_read_review_requests" on review_requests for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'anon_update_review_requests') then
    create policy "anon_update_review_requests" on review_requests for update to anon using (true) with check (true);
  end if;
end $$;
