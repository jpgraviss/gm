-- Add content_blocks column to broadcasts table for persisting the email block editor state
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS content_blocks jsonb DEFAULT NULL;
