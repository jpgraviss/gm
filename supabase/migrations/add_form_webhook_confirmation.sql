ALTER TABLE forms ADD COLUMN IF NOT EXISTS webhook_url text;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS send_confirmation boolean DEFAULT false;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS confirmation_subject text;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS confirmation_message text;
