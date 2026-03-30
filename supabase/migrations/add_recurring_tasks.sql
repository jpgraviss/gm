ALTER TABLE app_tasks ADD COLUMN IF NOT EXISTS recurrence jsonb;
ALTER TABLE app_tasks ADD COLUMN IF NOT EXISTS parent_task_id text;
