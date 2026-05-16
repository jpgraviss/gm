-- Booking Types: configurable appointment types with availability rules
create table if not exists public.booking_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default '00000000-0000-0000-0000-000000000001',
  name text not null,
  slug text not null unique,
  description text,
  duration_minutes int not null default 30,
  location text not null default 'zoom',
  color text not null default '#015035',
  availability jsonb not null default '{"days":[1,2,3,4,5],"start":"09:00","end":"17:00"}'::jsonb,
  buffer_minutes int not null default 15,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_types_workspace on public.booking_types(workspace_id);
create index if not exists idx_booking_types_slug on public.booking_types(slug);
create index if not exists idx_booking_types_active on public.booking_types(active);

-- Bookings: individual appointments booked by guests
create table if not exists public.booking_type_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_type_id uuid not null references public.booking_types(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  guest_company text,
  notes text,
  google_event_id text,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_type_bookings_type on public.booking_type_bookings(booking_type_id);
create index if not exists idx_booking_type_bookings_date on public.booking_type_bookings(date);
create index if not exists idx_booking_type_bookings_status on public.booking_type_bookings(status);

-- RLS policies
alter table public.booking_types enable row level security;
alter table public.booking_type_bookings enable row level security;

-- Authenticated users can manage booking types
create policy "Authenticated users can manage booking types"
  on public.booking_types for all
  using (true)
  with check (true);

-- Anyone can read active booking types (for public booking pages)
create policy "Public can read active booking types"
  on public.booking_types for select
  using (active = true);

-- Anyone can insert bookings (public booking flow)
create policy "Public can create bookings"
  on public.booking_type_bookings for insert
  with check (true);

-- Authenticated users can read all bookings
create policy "Authenticated users can read bookings"
  on public.booking_type_bookings for select
  using (true);

-- Authenticated users can update bookings
create policy "Authenticated users can update bookings"
  on public.booking_type_bookings for update
  using (true)
  with check (true);
