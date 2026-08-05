-- AUDIT #699 — public /go/book appointments landed on an essentially random
-- staff member's Google Calendar.
--
-- The legacy `bookings` push in app/api/calendar/sync/route.ts correctly
-- scopes by `.eq('calendar_slug', cal.slug)`, but the `booking_type_bookings`
-- push had no scoping filter at all — because `booking_types` had no owner
-- concept in the schema, only a global `workspace_id`. So whichever staff
-- Google Calendar happened to process first in a given cron run received
-- every pending public booking; if that person later disconnected Google
-- Calendar, subsequent batches silently landed on whoever processed next.
-- Non-deterministic, undocumented, and a real risk of a genuinely missed
-- client meeting. Same root cause as the already-fixed #231, which only
-- addressed the iCal feed and not this sync loop.
--
-- `owner_calendar_slug` points at the `calendar_settings.slug` that owns a
-- booking type — the same key the legacy bookings path already scopes on,
-- so both push paths become consistent.
--
-- Nullable on purpose: existing booking types have no owner yet, and the
-- sync loop treats a NULL owner as "not yet assigned" and skips it rather
-- than falling back to the old random-calendar behavior. That is a
-- deliberate fail-safe — a booking that visibly doesn't sync is far easier
-- to notice and fix than one that silently lands on the wrong person's
-- calendar. Assign owners in the booking-type editor after applying this.
ALTER TABLE public.booking_types
  ADD COLUMN IF NOT EXISTS owner_calendar_slug text;

CREATE INDEX IF NOT EXISTS idx_booking_types_owner
  ON public.booking_types(owner_calendar_slug);
