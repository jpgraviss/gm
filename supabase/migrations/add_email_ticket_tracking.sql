ALTER TABLE tickets ADD COLUMN IF NOT EXISTS gmail_message_id text;

CREATE TABLE IF NOT EXISTS processed_emails (
  id text PRIMARY KEY,
  gmail_message_id text UNIQUE NOT NULL,
  ticket_id text,
  processed_at timestamptz DEFAULT now()
);
ALTER TABLE processed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON processed_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert" ON processed_emails FOR INSERT TO authenticated WITH CHECK (true);
