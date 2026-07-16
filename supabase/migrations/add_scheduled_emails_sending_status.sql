-- Add 'sending' status to scheduled_emails for atomic claim pattern
-- Prevents duplicate sends when two cron ticks overlap

DO $$
BEGIN
  ALTER TABLE public.scheduled_emails DROP CONSTRAINT IF EXISTS scheduled_emails_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.scheduled_emails
  ADD CONSTRAINT scheduled_emails_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled'));

-- Rescue any rows stuck in 'sending' from a crashed worker so they get retried.
-- Cron re-runs every 5 min; anything stuck > 15 min is definitely orphaned.
UPDATE public.scheduled_emails
  SET status = 'pending'
  WHERE status = 'sending';
