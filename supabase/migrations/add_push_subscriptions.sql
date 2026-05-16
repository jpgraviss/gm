create table if not exists push_subscriptions (
  id         text primary key,
  user_id    text not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user_id on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "Users can manage own subscriptions"
  on push_subscriptions for all
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create policy "Service role full access on push_subscriptions"
  on push_subscriptions for all
  using (auth.role() = 'service_role');
