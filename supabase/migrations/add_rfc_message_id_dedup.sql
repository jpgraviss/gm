-- task #129 — app/api/tickets/from-email's processed_emails.gmail_message_id
-- is unique per Gmail *account*, not globally: the same physical email
-- landing in two different staff members' connected Gmail inboxes (e.g. a
-- shared support alias forwarding to multiple people) gets a distinct
-- gmail_message_id per account, so the existing unique constraint never
-- catches it and a ticket gets created once per account that received it.
--
-- The RFC 5322 Message-ID header is set by the originating mail server and
-- is identical across every mailbox that received a copy — a stable
-- cross-account dedup key. Nullable + partial unique index since not every
-- message reliably has one (rare malformed/spam mail).
ALTER TABLE public.processed_emails
  ADD COLUMN IF NOT EXISTS rfc_message_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_emails_rfc_message_id
  ON public.processed_emails(rfc_message_id)
  WHERE rfc_message_id IS NOT NULL;
