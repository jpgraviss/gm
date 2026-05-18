create table if not exists public.calendar_subscriptions (
  id text primary key default gen_random_uuid()::text,
  user_email text not null,
  name text not null,
  ical_url text not null,
  last_synced_at timestamptz,
  event_count integer default 0,
  created_at timestamptz default now()
);

create index if not exists calendar_subscriptions_user_email on calendar_subscriptions(user_email);

alter table bookings add column if not exists subscription_id text references calendar_subscriptions(id) on delete set null;
