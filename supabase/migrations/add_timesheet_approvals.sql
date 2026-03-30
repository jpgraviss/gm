ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending';
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS rejection_note text;
