ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS verification_code text,
  ADD COLUMN IF NOT EXISTS verification_expires timestamptz,
  ADD COLUMN IF NOT EXISTS setup_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_approval boolean DEFAULT false;
