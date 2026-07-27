-- AUDIT.md #370 — track when a scheduled_emails row was actually claimed
-- into 'sending', not just when it was originally due (send_at). send_at
-- is frozen at insert time and is unreliable for detecting a row stuck
-- mid-send: a backlogged claim can legitimately pick up a row whose
-- send_at is well in the past, which would look "stuck" immediately if
-- age were measured off send_at instead of the real claim time. Mirrors
-- broadcasts, which already stamps sent_at at claim time for the same
-- reason (see app/api/cron/route.ts's dispatchScheduledBroadcasts).

ALTER TABLE public.scheduled_emails
  ADD COLUMN IF NOT EXISTS sending_at timestamptz;

-- Any row already sitting in 'sending' when this migration runs has no
-- recorded claim time — treat it as claimed "now" so it's eligible for
-- rescue after the same threshold from this point forward, rather than
-- either rescuing it instantly (sending_at NULL treated as infinitely
-- old) or never rescuing it (NULL treated as infinitely new).
UPDATE public.scheduled_emails
  SET sending_at = now()
  WHERE status = 'sending' AND sending_at IS NULL;
