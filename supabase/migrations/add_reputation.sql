-- Reviews table: stores reviews from Google, Yelp, Facebook, etc.
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  source        text not null check (source in ('Google', 'Yelp', 'Facebook')),
  reviewer_name text not null,
  rating        smallint not null check (rating between 1 and 5),
  text          text,
  date          timestamptz not null default now(),
  response      text,
  response_date timestamptz,
  status        text not null default 'pending' check (status in ('pending', 'responded')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_reviews_workspace on reviews(workspace_id);
create index idx_reviews_source on reviews(source);
create index idx_reviews_rating on reviews(rating);
create index idx_reviews_status on reviews(status);
create index idx_reviews_date on reviews(date desc);

-- Review campaigns table: stores review request campaigns
create table if not exists review_campaigns (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  name           text not null,
  template       text not null,
  audience       text not null,
  sent_count     integer not null default 0,
  opened_count   integer not null default 0,
  reviews_count  integer not null default 0,
  status         text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'active')),
  scheduled_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_review_campaigns_workspace on review_campaigns(workspace_id);
create index idx_review_campaigns_status on review_campaigns(status);
