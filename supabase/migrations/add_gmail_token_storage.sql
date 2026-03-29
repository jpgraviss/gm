-- Store Gmail OAuth tokens per team member so users stay signed in
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS gmail_access_token text;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS gmail_email text;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS gmail_token_expires_at timestamptz;
