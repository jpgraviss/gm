-- AUDIT.md #407 — wires up gmail_settings.notifyOnReply for the native
-- Gmail-connected-inbox send path (app/api/gmail/send), which had no way to
-- recognize "this inbound message is a reply to something I sent" the way
-- the separate sequence_enrollments.message_ids + reply-check cron already
-- does for sequence email. thread_id lets a later inbound message viewed in
-- the same Gmail thread (app/api/gmail/message) be matched back to the
-- outbound send that started it; replied_at is a one-shot "already notified
-- for this thread" guard, same shape as tracked_emails' existing
-- last_opened_at/last_clicked_at columns.
ALTER TABLE tracked_emails ADD COLUMN IF NOT EXISTS thread_id text;
ALTER TABLE tracked_emails ADD COLUMN IF NOT EXISTS replied_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tracked_emails_thread ON tracked_emails(team_member_id, thread_id);
