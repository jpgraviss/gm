-- Prevent double-booking the same slot: two concurrent visitors could each
-- check-then-insert against the same time window. Adding a partial unique
-- index on (calendar_slug, date, start_time) for non-cancelled bookings
-- causes the second insert to fail atomically, so the API can catch it and
-- return "slot already taken."

CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot_unique
  ON public.bookings (calendar_slug, date, start_time)
  WHERE status <> 'cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS booking_type_bookings_slot_unique
  ON public.booking_type_bookings (booking_type_id, date, start_time)
  WHERE status <> 'cancelled';
