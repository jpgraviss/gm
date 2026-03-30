CREATE TABLE IF NOT EXISTS portal_notifications (
  id text PRIMARY KEY,
  portal_client_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  read boolean DEFAULT false,
  emailed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE portal_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON portal_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_manage" ON portal_notifications FOR ALL TO authenticated USING (true);
CREATE POLICY "anon_read" ON portal_notifications FOR SELECT TO anon USING (true);
