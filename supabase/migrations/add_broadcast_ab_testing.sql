-- A/B testing support for broadcast subject lines
alter table public.broadcasts
  add column if not exists ab_test_enabled boolean not null default false,
  add column if not exists variant_b_subject text,
  add column if not exists ab_split_pct integer not null default 50,
  add column if not exists ab_winner text,
  add column if not exists variant_a_opens integer not null default 0,
  add column if not exists variant_b_opens integer not null default 0,
  add column if not exists variant_a_sent integer not null default 0,
  add column if not exists variant_b_sent integer not null default 0;
