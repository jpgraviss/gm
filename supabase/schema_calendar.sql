-- ─── Calendar & Booking Schema ───────────────────────────────────────────────
-- Run this in your Supabase SQL editor AFTER schema.sql

-- ── Calendar Settings (one row per team member who wants a booking link) ──────
create table if not exists calendar_settings (
  id                    text primary key default gen_random_uuid()::text,
  user_email            text unique not null,
  user_name             text not null,
  slug                  text unique not null,          -- e.g. "jaycee-graviss"
  title                 text not null default 'Book a Call',
  description           text,
  duration              int  not null default 30,      -- slot length in minutes
  buffer                int  not null default 15,      -- gap after each booking
  timezone              text not null default 'America/Chicago',
  available_days        int[] not null default '{1,2,3,4,5}', -- 0=Sun … 6=Sat
  available_start       text not null default '09:00', -- "HH:MM" 24h
  available_end         text not null default '17:00',
  google_refresh_token  text,
  google_access_token   text,
  google_token_expiry   timestamptz,
  active                boolean not null default true,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ── Bookings ──────────────────────────────────────────────────────────────────
create table if not exists bookings (
  id               text primary key default gen_random_uuid()::text,
  calendar_slug    text not null references calendar_settings(slug) on delete cascade,
  client_name      text not null,
  client_email     text not null,
  client_company   text,
  client_phone     text,
  notes            text,
  date             date not null,
  start_time       text not null,   -- "HH:MM" in the host's timezone
  end_time         text not null,   -- "HH:MM" in the host's timezone
  timezone         text not null,   -- host timezone at time of booking
  status           text not null default 'confirmed',  -- confirmed | cancelled | rescheduled
  google_event_id  text,
  meet_link        text,
  created_at       timestamptz default now()
);

create index if not exists bookings_slug_date on bookings(calendar_slug, date);
create index if not exists bookings_email on bookings(client_email);

-- ── Trigger to keep updated_at fresh ─────────────────────────────────────────
create trigger calendar_settings_updated_at
  before update on calendar_settings
  for each row execute function update_updated_at();
