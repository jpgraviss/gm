-- AUDIT.md #217 — notification "read" state had no DB persistence; Header.tsx's
-- markAllRead()/per-item click only mutated local React state, which reset on
-- nearly every navigation since Header is instantiated fresh per page.
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id                text PRIMARY KEY,
  user_email        text NOT NULL,
  notification_id   text NOT NULL,
  read_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_email, notification_id)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_notification_reads" ON public.notification_reads;
CREATE POLICY "auth_all_notification_reads"
  ON public.notification_reads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user_email ON public.notification_reads(user_email);
