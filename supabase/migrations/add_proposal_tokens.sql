ALTER TABLE proposals ADD COLUMN IF NOT EXISTS token text UNIQUE;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS client_notes text;
-- Allow anonymous access by token
CREATE POLICY IF NOT EXISTS "anon_read_proposals_by_token" ON proposals FOR SELECT TO anon USING (token IS NOT NULL);
